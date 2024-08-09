---
title: Redis 多线程变迁(3) 之 Redis 网络IO线程
emoji: 🏃
tags: 
  - redis
  - 源来如此
created: 2021-04-20T20:16:50.000Z
modified: 2021-04-25T22:50:50.000Z
---
## 系列指北

Redis 多线程源码分析系列:

[Redis VM线程(Redis 1.3.x - Redis 2.4)](https://blog.insutanto.tech/code-notes/2021-04/read-redis-code/vm-thread-in-redis)

[Redis BIO线程(Redis 2.4+ 和 Redis 4.0+)](https://blog.insutanto.tech/code-notes/2021-04/read-redis-code/bio-thread-in-redis)

[Redis 网络IO线程(Redis 6.0+)](https://blog.insutanto.tech/code-notes/2021-04/read-redis-code/network-io-thread-in-redis)


## Redis 网络IO线程(Redis 6.0+)

从2020年正式发布的 Redis 6.0 开始开始，Redis增加了与客户端IO读写线程，减轻主线程与客户端的网络IO负担。而实际上，这个设想在2015年开发 lazy free 特性的时候就已经出现了。[《Lazy Redis is better Redis》](http://antirez.com/news/93)#Not just lazy freeing :

> 既然聚合数据类型的值是完全不共享的，并且客户端输出缓冲区也不包含共享对象，有很多地方可以利用这一点。例如，最终有可能在 Redis 中实现线程化I/O，以便由不同的线程为不同的客户端提供服务。这意味着我们仅在访问数据库时才具有全局锁定，但是客户端读取/写入系统调用，甚至解析客户端发送的指令数据，都可以在不同的线程中进行。这是一种类似 memcached 的设计，我期待去实现和测试。<br/>
而且，有可能实现对某一线程中的聚合数据类型执行某些慢速操作，只会导致“几个”键被“阻塞”，而所有其他客户端都可以继续工作。这可以通过与我们当前使用阻塞操作（请参阅blocking.c）非常相似的方式来实现，此外还可以使用哈希表来存储当前正在使用哪些键以及它使用的客户端。因此，如果客户要求使用SMEMBERS之类的东西，就能够仅锁定键，处理创建输出缓冲区的请求，然后再次释放键。如果某个键被阻塞了，则尝试访问同一键的客户端都将被阻塞。<br/>
所有这些都需要进行更大幅度的内部修改，但是最重要的是，我们的禁忌要少一些。我们可以用更少的缓存丢失和更少内存占用的聚合数据类型，来弥补对象复制的时间，我们现在可以畅想无共享设计的线程化 Redis ，这是唯一可以轻松战胜我们单线程架构的设计。过去，如果为了实现并发访问，在数据结构和对象中增加一系列互斥锁，始终会被视为一个坏主意。但现在幸运的是，有方法可以两全其美。 我们可现在以仍然像过去那样，从主线程继续执行所有快速的操作。 而要在性能方面有所收获，需要增加一些复杂性作为代价。<br/>

上述是 antirez 在《Lazy Redis is better Redis》的 Not just lazy freeing 部分所分享的内容，理解这个，我们就能知道为何 Redis 要实现 IO 线程化了：

1. IO单线程时，某些键的阻塞操作会阻塞整个线程，而使用多线程，可以实现只有访问相同键的客户端被阻塞。
2. 去掉了共享对象，让IO线程化更加简单，不再需要向数据结构和对象中增加一系列的互斥锁来实现多线程，从而保留了Redis单线程的“传统艺能”。（PS：去掉共享对象，会增加内存的复制，但是也可以带来内存上更紧凑的数据类型，也因为内存上更加连续带来更少的缓存丢失。）

接下来，我们从 redis `server.c` 中的`main()`函数开始，看看IO线程是怎么运行的。

## IO线程的创建

![IO线程的创建](https://mermaid.ink/svg/eyJjb2RlIjoiJSV7aW5pdDogeyd0aGVtZSc6J2Jhc2UnfX0lJVxuZ3JhcGggVEJcbiAgICBzdWJncmFwaCBzZXJ2ZXIuY1xuICAgIFMxKFttYWluXSlcbiAgICBTMltpbml0U2VydmVyXVxuICAgIFMzW0luaXRTZXJ2ZXJMYXN0XVxuICAgIGVuZFxuICAgIHN1YmdyYXBoIG5ldHdvcmtpbmcuY1xuICAgIE4xW2luaXRUaHJlYWRlZElPXVxuICAgIHN1YmdyYXBoIElPVGhyZWFkXG4gICAgSU8xW0lPVGhyZWFkTWFpbl1cbiAgICBJTzJbSU9UaHJlYWRNYWluXVxuICAgIGVuZFxuICAgIGVuZFxuICAgIFMxLS1maXJzdCBjYWxsLS0-UzJcbiAgICBTMS0tdGhlbiBjYWxsLS0-UzNcbiAgICBTMy0tPk4xXG4gICAgTjEtLXB0aHJlYWRfY3JlYXRlLS0-SU8xXG4gICAgTjEtLXB0aHJlYWRfY3JlYXRlLS0-SU8yXG5cbiAgICBcbiIsIm1lcm1haWQiOnt9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)

通过 `pthread_create` 搜索到 `initThreadedIO()` 函数，然后整理下IO线程的创建过程：

无论是否哨兵模式，Redis都会执行`InitServerLast`：

```c
int main(int argc, char **argv) {
    struct timeval tv;
    int j;

    server.supervised = redisIsSupervised(server.supervised_mode);
    int background = server.daemonize && !server.supervised;
    if (background) daemonize();

    ......some log......

    readOOMScoreAdj();
    initServer();
    if (background || server.pidfile) createPidFile();
    redisSetProcTitle(argv[0]);
    redisAsciiArt();
    checkTcpBacklogSettings();

    if (!server.sentinel_mode) {
        moduleLoadFromQueue();
        ACLLoadUsersAtStartup();
        InitServerLast();
        loadDataFromDisk();

        ......

    } else {
        InitServerLast();
        sentinelIsRunning();
        ......
    }

    ......

    redisSetCpuAffinity(server.server_cpulist);
    setOOMScoreAdj(-1);

    aeMain(server.el);
    aeDeleteEventLoop(server.el);
    return 0;
}
```

`initServer()`中，Redis会初始化相关的任务队列，而在`InitServerLast`中，才会初始化网络IO相关的线程资源，因为Redis的网络IO多线程是可以配置的。Redis实现了网络IO多线程，但是网络IO的逻辑，既可以在ThreadedIO线程执行，也可以在主线程执行，给用户提供了选择：

```c
void initServer(void) {
    ......
    /* Initialization after setting defaults from the config system. */
    server.aof_state = server.aof_enabled ? AOF_ON : AOF_OFF;
    server.hz = server.config_hz;
    server.pid = getpid();
    server.in_fork_child = CHILD_TYPE_NONE;
    server.main_thread_id = pthread_self();
    server.current_client = NULL; // 当前正在执行命令的客户端
    server.errors = raxNew();
    server.fixed_time_expire = 0;
    server.clients = listCreate(); // 活跃的客户端列表
    server.clients_index = raxNew(); // 按照 client_id 索引的活跃的客户端字典
    server.clients_to_close = listCreate(); // 需要异步关闭的客户端列表
    server.slaves = listCreate();
    server.monitors = listCreate();
    server.clients_pending_write = listCreate(); // 等待写或者安装handler的客户端列表
    server.clients_pending_read = listCreate(); // 等待读socket缓冲区的客户端列表
    server.clients_timeout_table = raxNew();
    server.replication_allowed = 1;
    server.slaveseldb = -1; /* Force to emit the first SELECT command. */
    server.unblocked_clients = listCreate(); // 下一个循环之前，要取消阻塞的客户端列表
    server.ready_keys = listCreate();
    server.clients_waiting_acks = listCreate();
    server.get_ack_from_slaves = 0;
    server.client_pause_type = 0;
    server.paused_clients = listCreate();
    server.events_processed_while_blocked = 0;
    server.system_memory_size = zmalloc_get_memory_size();
    server.blocked_last_cron = 0;
    server.blocking_op_nesting = 0;
    ......
}
```

在 `InitServerLast()`中 ，除了 `initThreadedIO` (Redis网络IO线程)，我们还能看到`bioInit`(background I/O 初始化)，两个模块使用了不同的资源：

```c
/* Some steps in server initialization need to be done last (after modules
 * are loaded).
 * Specifically, creation of threads due to a race bug in ld.so, in which
 * Thread Local Storage initialization collides with dlopen call.
 * see: https://sourceware.org/bugzilla/show_bug.cgi?id=19329 */
void InitServerLast() {
    bioInit();
    initThreadedIO();
    set_jemalloc_bg_thread(server.jemalloc_bg_thread);
    server.initial_memory_usage = zmalloc_used_memory();
}
```

接下来我们来看看 Redis 源码的 `networking.c` 文件：
`io_threads` 线程池，`io_threads_mutex` 互斥锁，`io_threads_pending` IO线程客户端等待数，`io_threads_list` 每个IO线程的客户端列表。

```c
/* ==========================================================================
 * Threaded I/O
 * ========================================================================== */

#define IO_THREADS_MAX_NUM 128
#define IO_THREADS_OP_READ 0
#define IO_THREADS_OP_WRITE 1

pthread_t io_threads[IO_THREADS_MAX_NUM];
pthread_mutex_t io_threads_mutex[IO_THREADS_MAX_NUM];
redisAtomic unsigned long io_threads_pending[IO_THREADS_MAX_NUM];
int io_threads_op;      /* IO_THREADS_OP_WRITE or IO_THREADS_OP_READ. */

/* This is the list of clients each thread will serve when threaded I/O is
 * used. We spawn io_threads_num-1 threads, since one is the main thread
 * itself. */
list *io_threads_list[IO_THREADS_MAX_NUM];
```

然后就是创建线程的`initThreadedIO` 函数。初始化的时候IO线程处于未激活状态，等待后续激活，如果 Redis 配置的 `io_threads_num` 为 1，代表IO使用主线程单线程处理，如果线程数配置超过最大值 `IO_THREADS_MAX_NUM` (128) 则异常退出，最后，**创建的线程都将被锁上直到被唤醒**：

```c
/* Initialize the data structures needed for threaded I/O. */
void initThreadedIO(void) {
    server.io_threads_active = 0; /* We start with threads not active. */

    /* Don't spawn any thread if the user selected a single thread:
     * we'll handle I/O directly from the main thread. */
    if (server.io_threads_num == 1) return;

    if (server.io_threads_num > IO_THREADS_MAX_NUM) {
        serverLog(LL_WARNING,"Fatal: too many I/O threads configured. "
                             "The maximum number is %d.", IO_THREADS_MAX_NUM);
        exit(1);
    }

    /* Spawn and initialize the I/O threads. */
    for (int i = 0; i < server.io_threads_num; i++) {
        /* Things we do for all the threads including the main thread. */
        io_threads_list[i] = listCreate();
        if (i == 0) continue; /* Thread 0 is the main thread. */

        /* Things we do only for the additional threads. */
        pthread_t tid;
        pthread_mutex_init(&io_threads_mutex[i],NULL);
        io_threads_pending[i] = 0;
        pthread_mutex_lock(&io_threads_mutex[i]); /* Thread will be stopped. */
        if (pthread_create(&tid,NULL,IOThreadMain,(void*)(long)i) != 0) {
            serverLog(LL_WARNING,"Fatal: Can't initialize IO thread.");
            exit(1);
        }
        io_threads[i] = tid;
    }
}
```

## IO线程的工作流程

![IO线程的工作流程](https://mermaid.ink/svg/eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgc3ViZ3JhcGggc2VydmVyLmNcbiAgICAgICAgUzEoW0V2ZW50TG9vcF0pXG4gICAgICAgIFMyW2JlZm9yZVNsZWVwXVxuICAgIGVuZFxuICAgIHN1YmdyYXBoIG5ldHdvcmtpbmcuY1xuICAgIHN1YmdyYXBoIFJlYWRzVXNpbmdUaHJlYWRzXG4gICAgICAgIFIxW2xpc3RBZGROb2RlVGFpbF1cbiAgICBlbmRcbiAgICBzdWJncmFwaCBXcml0ZXNVc2luZ1RocmVhZHNcbiAgICAgICAgVzNbc3RhcnRUaHJlYWRlZElPXVxuICAgICAgICBXNFtsaXN0QWRkTm9kZVRhaWxdXG4gICAgZW5kXG4gICAgZW5kXG4gICAgUzEtLT5TMlxuICAgIFMyLS1maXJzdCBjYWxsLS0-UmVhZHNVc2luZ1RocmVhZHNcbiAgICBTMi0tdGhlbiBjYWxsLS0-V3JpdGVzVXNpbmdUaHJlYWRzXG4gICAgVzMtLWFkZCBjbGllbnQgdG8gaW9fdGhyZWFkc19saXN0LS0-VzQiLCJtZXJtYWlkIjp7fSwidXBkYXRlRWRpdG9yIjpmYWxzZX0)

Redis 在启动时，初始化函数 `initServer` 将 `beforeSleep` 和 `afterSleep` 注册为事件循环休眠前和休眠后的`handler` :

```c
void initServer(void) {
......
    server.el = aeCreateEventLoop(server.maxclients+CONFIG_FDSET_INCR);
......
    /* Register before and after sleep handlers (note this needs to be done
     * before loading persistence since it is used by processEventsWhileBlocked. */
    aeSetBeforeSleepProc(server.el,beforeSleep);
    aeSetAfterSleepProc(server.el,afterSleep);
......
}
```

事件循环执行 `beforeSleep` 时，会调用`handleClientsWithPendingReadsUsingThreads` 和`handleClientsWithPendingWritesUsingThreads`，分别是IO读写任务的分配逻辑。特殊情况下，在AOF和RDB数据恢复（从文件读取数据到内存）的时候，Redis会通过`processEventsWhileBlocked`调用 `beforeSleep`，这个时候，只会执行`handleClientsWithPendingReadsUsingThreads` ，这个时候IO写是**同步**的：

```c
/* This function gets called every time Redis is entering the
 * main loop of the event driven library, that is, before to sleep
 * for ready file descriptors.
 *
 * Note: This function is (currently) called from two functions:
 * 1. aeMain - The main server loop
 * 2. processEventsWhileBlocked - Process clients during RDB/AOF load
 *
 * If it was called from processEventsWhileBlocked we don't want
 * to perform all actions (For example, we don't want to expire
 * keys), but we do need to perform some actions.
 *
 * The most important is freeClientsInAsyncFreeQueue but we also
 * call some other low-risk functions. */
void beforeSleep(struct aeEventLoop *eventLoop) {
......
    /* Just call a subset of vital functions in case we are re-entering
     * the event loop from processEventsWhileBlocked(). Note that in this
     * case we keep track of the number of events we are processing, since
     * processEventsWhileBlocked() wants to stop ASAP if there are no longer
     * events to handle. */
    if (ProcessingEventsWhileBlocked) {
        uint64_t processed = 0;
        processed += handleClientsWithPendingReadsUsingThreads();
        processed += tlsProcessPendingData();
        processed += handleClientsWithPendingWrites();
        processed += freeClientsInAsyncFreeQueue();
        server.events_processed_while_blocked += processed;
        return;
    }

......
    /* We should handle pending reads clients ASAP after event loop. */
    handleClientsWithPendingReadsUsingThreads();

......
    /* Handle writes with pending output buffers. */
    handleClientsWithPendingWritesUsingThreads();

    /* Close clients that need to be closed asynchronous */
    freeClientsInAsyncFreeQueue();

......
    /* Before we are going to sleep, let the threads access the dataset by
     * releasing the GIL. Redis main thread will not touch anything at this
     * time. */
    if (moduleCount()) moduleReleaseGIL();

    /* Do NOT add anything below moduleReleaseGIL !!! */
}
```

在`handleClientsWithPendingReadsUsingThreads`函数中，Redis会执行IO读的任务分配逻辑，当Redis配置了IO线程的读取和解析(`io_threads_do_reads`)，可读的handler会将普通的客户端放到客户端队列中处理，而不是同步处理。这个函数将队列分配给IO线程处理，累积读取buffer中的数据：

1. IO线程在初始化时未激活，Redis配置了用IO线程读取和解析数据(`io_threads_do_reads`)，才会继续执行
2. 读取待处理的客户端列表 `clients_pending_read`，将任务按照取模平均分配到不同线程的任务队列`io_threads_list[target_id]`
3. 通过`setIOPendingCount`给对应的IO线程设置条件变量，激活IO线程
4. 依然在主线程处理一些客户端请求
5. 如果客户端等待写入，并且响应的buffer还有待写数据，或有待发送给客户端的响应对象，则给客户端的连接安装写handler

```c
/* When threaded I/O is also enabled for the reading + parsing side, the
 * readable handler will just put normal clients into a queue of clients to
 * process (instead of serving them synchronously). This function runs
 * the queue using the I/O threads, and process them in order to accumulate
 * the reads in the buffers, and also parse the first command available
 * rendering it in the client structures. */
int handleClientsWithPendingReadsUsingThreads(void) {
    // IO线程在初始化时未激活，Redis配置了用IO线程读取和解析数据(io_threads_do_reads)，才会继续执行
    if (!server.io_threads_active || !server.io_threads_do_reads) return 0;
    int processed = listLength(server.clients_pending_read);
    if (processed == 0) return 0;

    /* Distribute the clients across N different lists. */
    // 读取待处理的客户端列表 clients_pending_read，
    // 将任务按照取模平均分配到不同线程的任务队列io_threads_list[target_id]
    listIter li;
    listNode *ln;
    listRewind(server.clients_pending_read,&li);
    int item_id = 0;
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        int target_id = item_id % server.io_threads_num;
        listAddNodeTail(io_threads_list[target_id],c);
        item_id++;
    }

    /* Give the start condition to the waiting threads, by setting the
     * start condition atomic var. */
    // 通过setIOPendingCount给对应的IO线程设置条件变量，激活IO线程
    io_threads_op = IO_THREADS_OP_READ;
    for (int j = 1; j < server.io_threads_num; j++) {
        int count = listLength(io_threads_list[j]);
        setIOPendingCount(j, count);
    }

    /* Also use the main thread to process a slice of clients. */
    // 依然在主线程处理一些客户端请求
    listRewind(io_threads_list[0],&li);
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        readQueryFromClient(c->conn);
    }
    listEmpty(io_threads_list[0]);

    /* Wait for all the other threads to end their work. */
    while(1) {
        unsigned long pending = 0;
        for (int j = 1; j < server.io_threads_num; j++)
            pending += getIOPendingCount(j);
        if (pending == 0) break;
    }

    /* Run the list of clients again to process the new buffers. */
    while(listLength(server.clients_pending_read)) {
        ln = listFirst(server.clients_pending_read);
        client *c = listNodeValue(ln);
        c->flags &= ~CLIENT_PENDING_READ;
        listDelNode(server.clients_pending_read,ln);

        if (processPendingCommandsAndResetClient(c) == C_ERR) {
            /* If the client is no longer valid, we avoid
             * processing the client later. So we just go
             * to the next. */
            continue;
        }

        processInputBuffer(c);

        /* We may have pending replies if a thread readQueryFromClient() produced
         * replies and did not install a write handler (it can't).
         */
        // 如果客户端等待写入，
        // 并且响应的buffer还有待写数据，或有待发送给客户端的响应对象，
        // 则给客户端的连接安装写handler
        if (!(c->flags & CLIENT_PENDING_WRITE) && clientHasPendingReplies(c))
            clientInstallWriteHandler(c);
    }

    /* Update processed count on server */
    server.stat_io_reads_processed += processed;

    return processed;
}
```

在 `handleClientsWithPendingWritesUsingThreads` 中，Redis会执行IO线程的启动，IO线程写任务的分配等逻辑：

1. 如果没有开启多线程，或者等待的客户端数量小于线程数的两倍，则执行同步代码
2. 如果 IO 线程没有激活，则激活（在`initThreadedIO`函数创建线程时处于未激活状态）
3. 如果遇到需要关闭的客户端(`CLIENT_CLOSE_ASAP`)，则将其从待处理的客户端列表里删除
4. 读取待处理的客户端列表 `clients_pending_write` ，将任务按照取模平均分配到不同线程的任务队列`io_threads_list[target_id]`
5. 通过`setIOPendingCount`给对应的IO线程设置条件变量，激活IO线程
6. 依然在主线程处理一些客户端请求
7. 如果响应的buffer还有待写数据，或者还有待发送给客户端的响应对象，则给客户端的连接安装写handler
8. 最后调用`freeClientAsync` 将待释放的客户端放入`clients_to_close`队列，等待beforeSleep执行freeClientsInAsyncFreeQueue时实现异步释放客户端

```c
int handleClientsWithPendingWritesUsingThreads(void) {
    int processed = listLength(server.clients_pending_write);
    if (processed == 0) return 0; /* Return ASAP if there are no clients. */

    /* If I/O threads are disabled or we have few clients to serve, don't
     * use I/O threads, but the boring synchronous code. */
    // 如果没有开启多线程，或者等待的客户端数量小于线程数的两倍，则执行同步代码
    if (server.io_threads_num == 1 || stopThreadedIOIfNeeded()) {
        return handleClientsWithPendingWrites();
    }

    /* Start threads if needed. */
    // 如果 IO 线程没有激活，则激活（在initThreadedIO函数创建线程时处于未激活状态）
    if (!server.io_threads_active) startThreadedIO();

    /* Distribute the clients across N different lists. */
    listIter li;
    listNode *ln;
    listRewind(server.clients_pending_write,&li);
    int item_id = 0;
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        c->flags &= ~CLIENT_PENDING_WRITE;

        /* Remove clients from the list of pending writes since
         * they are going to be closed ASAP. */
        // 如果遇到需要关闭的客户端(CLIENT_CLOSE_ASAP)，则将其从待处理的客户端列表里删除
        if (c->flags & CLIENT_CLOSE_ASAP) {
            listDelNode(server.clients_pending_write, ln);
            continue;
        }

        int target_id = item_id % server.io_threads_num;
        listAddNodeTail(io_threads_list[target_id],c);
        item_id++;
    }

    /* Give the start condition to the waiting threads, by setting the
     * start condition atomic var. */
    // 通过setIOPendingCount给对应的IO线程设置条件变量，激活IO线程
    io_threads_op = IO_THREADS_OP_WRITE;
    for (int j = 1; j < server.io_threads_num; j++) {
        int count = listLength(io_threads_list[j]);
        setIOPendingCount(j, count);
    }
    
    /* Also use the main thread to process a slice of clients. */
    // 依然在主线程处理一些客户端请求
    listRewind(io_threads_list[0],&li);
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);
        writeToClient(c,0);
    }
    listEmpty(io_threads_list[0]);

    /* Wait for all the other threads to end their work. */
    while(1) {
        unsigned long pending = 0;
        for (int j = 1; j < server.io_threads_num; j++)
            pending += getIOPendingCount(j);
        if (pending == 0) break;
    }

    /* Run the list of clients again to install the write handler where
     * needed. */
    listRewind(server.clients_pending_write,&li);
    while((ln = listNext(&li))) {
        client *c = listNodeValue(ln);

        /* Install the write handler if there are pending writes in some
         * of the clients. */
        // 如果响应的buffer还有待写数据，或者还有待发送给客户端的响应对象，
        // 则给客户端的连接安装写handler
        if (clientHasPendingReplies(c) &&
                connSetWriteHandler(c->conn, sendReplyToClient) == AE_ERR)
        {
            // 将待释放的客户端放入clients_to_close队列，
            // 等待beforeSleep执行freeClientsInAsyncFreeQueue时实现异步释放客户端
            freeClientAsync(c);
        }
    }
    listEmpty(server.clients_pending_write);

    /* Update processed count on server */
    server.stat_io_writes_processed += processed;

    return processed;
}
```

## IO线程的主逻辑

在 `IOThreadMain` 函数中，是 Redis IO线程的主逻辑。

我们发现IO线程在创建后，会通过`redisSetCpuAffinity`函数和`server_cpulist`参数，来设置线程的CPU的亲和性，合理配置线程的CPU亲和性，能够一定程度上提升性能。

之后，IO线程会根据条件变量 `io_threads_pending[id]` 判断是否有等待的IO需要处理，然后从 `io_threads_list[myid]` 中获取分给自己的 client，再根据 `io_thread_op` 来判断，这个时候需要执行读写IO中的哪一个，  `readQueryFromClient` 还是 `writeToClient` :

```c
void *IOThreadMain(void *myid) {
    /* The ID is the thread number (from 0 to server.iothreads_num-1), and is
     * used by the thread to just manipulate a single sub-array of clients. */
    long id = (unsigned long)myid;
    char thdname[16];

    snprintf(thdname, sizeof(thdname), "io_thd_%ld", id);
    redis_set_thread_title(thdname);
    redisSetCpuAffinity(server.server_cpulist);
    makeThreadKillable();

    while(1) {
        /* Wait for start */
        for (int j = 0; j < 1000000; j++) {
            if (io_threads_pending[id] != 0) break;
        }

        /* Give the main thread a chance to stop this thread. */
        if (io_threads_pending[id] == 0) {
            pthread_mutex_lock(&io_threads_mutex[id]);
            pthread_mutex_unlock(&io_threads_mutex[id]);
            continue;
        }

        serverAssert(io_threads_pending[id] != 0);

        if (tio_debug) printf("[%ld] %d to handle\n", id, (int)listLength(io_threads_list[id]));

        /* Process: note that the main thread will never touch our list
         * before we drop the pending count to 0. */
        listIter li;
        listNode *ln;
        listRewind(io_threads_list[id],&li);
        while((ln = listNext(&li))) {
            client *c = listNodeValue(ln);
            if (io_threads_op == IO_THREADS_OP_WRITE) {
                writeToClient(c,0);
            } else if (io_threads_op == IO_THREADS_OP_READ) {
                readQueryFromClient(c->conn);
            } else {
                serverPanic("io_threads_op value is unknown");
            }
        }
        listEmpty(io_threads_list[id]);
        io_threads_pending[id] = 0;

        if (tio_debug) printf("[%ld] Done\n", id);
    }
}
```

## 总结

从Redis VM开始，到Redis BIO，再到最后的IO多线程，我们能看到 Redis 正在逐渐的向线程化的方向发展。特别是在实现Lazy Free之后(Redis BIO)，antirez似乎尝到了多线程的好处，在保证db操作单线程的情况下，让Redis发挥CPU一部分多核多线程的实力。我们不难发现，Redis 的多线程不过是顺势而为罢了，如果单线程没有瓶颈，就不会产生使用多线程的Redis。再结合现状来看，毕竟时代变了，从多年前的单核服务器，到后来的双核，四核服务器，再到现在动辄八核，十六核的服务器：
单线程模型固然简单，代码清晰，但是在摩尔定律失效，多核多线程的时代洪流下，有谁能够拒绝多线程的好处呢？