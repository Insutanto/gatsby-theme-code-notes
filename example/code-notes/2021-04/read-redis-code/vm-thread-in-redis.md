---
title: Redis 多线程变迁(1) 之 Redis VM 多线程
emoji: 👻
tags: 
  - redis
  - 源来如此
created: 2021-04-10T20:16:50.000Z
modified: 2021-04-14T22:50:50.000Z
---

## 背景

Redis在早期，曾因单线程“闻名”。在redis的FAQ里有一个提问[《Redis is single threaded. How can I exploit multiple CPU / cores?》](https://redis.io/topics/faq#redis-is-single-threaded-how-can-i-exploit-multiple-cpu--cores)，说明了redis使用单线程的原因：

> CPU通常并不是Redis的瓶颈，因为Redis通常要么受内存限制，要么受网络限制。比如说，一般在Linux系统上运行的流水线Redis，每秒可以交付一百万个请求，如果你的应用程序主要使用O（N）或O（log（N））命令，几乎不会使用过多的CPU 。<br/>
......<br/>
不过从Redis 4.0开始，Redis就开始使用更多的线程了。目前使用多线程的场景（Redis 4.0），仅限于在后台删除对象，以及通过Redis modules实现的阻塞命令。在未来的版本中，计划是让Redis越来越线程化。

这不禁让我好奇，Redis一开始是单线程的吗？又是怎么朝多线程演化的呢，又是为什么让Redis越来越线程化呢。在阅读了几篇文章后，我决定自己读一遍相关源代码，了解Redis的多线程演化历史。

## 系列指北

Redis 多线程源码分析系列:

[Redis VM线程(Redis 1.3.x - Redis 2.4)](https://insutanto.net/code-notes/2021-04/read-redis-code/vm-thread-in-redis)

[Redis BIO线程(Redis 2.4+ 和 Redis 4.0+)](https://insutanto.net/code-notes/2021-04/read-redis-code/bio-thread-in-redis)

[Redis 网络IO线程(Redis 6.0+)](https://insutanto.net/code-notes/2021-04/read-redis-code/network-io-thread-in-redis)

## Redis VM线程(Redis 1.3.x - Redis 2.4)

实际上Redis很早就用到多线程，我们在 Redis 的 1.3.x (2010年)的源代码中，能看到 **Redis VM** 相关的多线程代码，这部分代码主要是在 Redis 中实现**线程化VM**的能力。**Redis VM** 可以将 Redis 中很少访问的 value 存到磁盘中，也可以将占用内存大的 value 存到磁盘。**Redis VM** 的底层是读写磁盘，所以在从磁盘读写 value 时，**阻塞VM**会产生阻塞主线程，影响所有的客户端，导致所有客户端耗时增加。所以 **Redis VM** 又提供了**线程化VM**，可以将读写文件数据的操作，放在**IO线程**中执行，这样就只影响一个客户端（需要从文件中读出数据的客户端），从而避免像**阻塞VM**那样，提升所有客户端的耗时**。**

我们从[《Virtual Memory technical specification》](https://redis.io/topics/internals-vm)能看到**线程化VM**的优势：

> 列举线程化VM设计目标的重要性：<br/>
简单的实现，很少条件竞争，简单的锁，VM系统多少与其余Redis代码解耦。<br/>
良好的性能，客户端访问内存中的value没有锁了。<br/>
能够在I / O线程中，对对象进行解码/编码。<br/>

但其实，**Redis VM** 是一个被弃用的短寿特性。在 Redis 1.3.x 出现 **Redis VM** 之后，Redis 2.4 是最后支持它的版本。Redis 1.3.x 在 2010年发布，Redis 2.6 在 2012年发布，**Redis  VM**的生命在Redis项目中，只持续了两年。我们现在从[《Virtual Memory》](https://redis.io/topics/virtual-memory)能看到弃用 **Redis VM** 的原因：

> ……我们发现使用VM有许多缺点和问题。在未来，我们只想提供有史以来最好的内存数据库（但仍像往常一样在磁盘上持久化），而至少现在，不考虑对大于RAM的数据库的支持。我们未来的工作重点是提供脚本，群集和更好的持久性。

我个人以为，去掉**Redis VM**的根本原因，可能是定位问题。Redis的准确定位了**磁盘备份**的**内存数据库**，去掉VM后的Redis更纯粹，更简单，更容易让用户理解和使用。

下面简单介绍下 Redis VM 的多线程代码。

Redis主线程和IO线程使用任务队列和单个互斥锁进行通信。队列定义和互斥锁定义如下：

```c
/* Global server state structure */
struct redisServer {
...
		list *io_newjobs; /* List of VM I/O jobs yet to be processed */
    list *io_processing; /* List of VM I/O jobs being processed */
    list *io_processed; /* List of VM I/O jobs already processed */
    list *io_ready_clients; /* Clients ready to be unblocked. All keys loaded */
    pthread_mutex_t io_mutex; /* lock to access io_jobs/io_done/io_thread_job */
    pthread_mutex_t io_swapfile_mutex; /* So we can lseek + write */
    pthread_attr_t io_threads_attr; /* attributes for threads creation */
...
}
```

Redis在需要处理IO任务时(比如使用的内存超过最大内存等情况)，Redis通过`queueIOJob`函数，将一个IO任务(`iojob`)入队到任务队列(`io_newjobs`)，在`queueIOJob`中，会根据VM的最大线程数，判断是否需要创建新的IO线程。

```c
void queueIOJob(iojob *j) {
    redisLog(REDIS_DEBUG,"Queued IO Job %p type %d about key '%s'\n",
        (void*)j, j->type, (char*)j->key->ptr);
    listAddNodeTail(server.io_newjobs,j);
    if (server.io_active_threads < server.vm_max_threads)
        spawnIOThread();
}
```

创建出的IO线程，主逻辑是`IOThreadEntryPoint`。IO线程会先从`io_newjobs`队列中取出一个`iojob`，然后推入`io_processing`队列，然后根据`iojob`中的`type`来执行对应的任务：

0. 从磁盘读数据到内存
1. 计算需要的page数
2. 将内存swap到磁盘

执行完成后，将`iojob`推入`io_processed`队列。最后，IO线程通过UINX管道，向主线程发送一个字节，告诉主线程，有一个新的任务处理完成，需要主线程处理结果。

```c
typedef struct iojob {
    int type;   /* Request type, REDIS_IOJOB_* */
    redisDb *db;/* Redis database */
    robj *key;  /* This I/O request is about swapping this key */
    robj *id;   /* Unique identifier of this job:
                   this is the object to swap for REDIS_IOREQ_*_SWAP, or the
                   vmpointer objct for REDIS_IOREQ_LOAD. */
    robj *val;  /* the value to swap for REDIS_IOREQ_*_SWAP, otherwise this
                 * field is populated by the I/O thread for REDIS_IOREQ_LOAD. */
    off_t page; /* Swap page where to read/write the object */
    off_t pages; /* Swap pages needed to save object. PREPARE_SWAP return val */
    int canceled; /* True if this command was canceled by blocking side of VM */
    pthread_t thread; /* ID of the thread processing this entry */
} iojob;
```

```c
#define REDIS_IOJOB_LOAD 0          /* Load from disk to memory */
#define REDIS_IOJOB_PREPARE_SWAP 1  /* Compute needed pages */
#define REDIS_IOJOB_DO_SWAP 2       /* Swap from memory to disk */
```

```c
void *IOThreadEntryPoint(void *arg) {
    iojob *j;
    listNode *ln;
    REDIS_NOTUSED(arg);

    pthread_detach(pthread_self());
    while(1) {
        /* Get a new job to process */
        lockThreadedIO();
        if (listLength(server.io_newjobs) == 0) {
            /* No new jobs in queue, exit. */
            ...
						unlockThreadedIO();
            return NULL;
        }
				ln = listFirst(server.io_newjobs);
        j = ln->value;
        listDelNode(server.io_newjobs,ln);
        /* Add the job in the processing queue */
				j->thread = pthread_self();
        listAddNodeTail(server.io_processing,j);
        ln = listLast(server.io_processing); /* We use ln later to remove it */
        unlockThreadedIO();
				...
        /* Process the Job */
        if (j->type == REDIS_IOJOB_LOAD) {
            vmpointer *vp = (vmpointer*)j->id;
            j->val = vmReadObjectFromSwap(j->page,vp->vtype);
        } else if (j->type == REDIS_IOJOB_PREPARE_SWAP) {
            j->pages = rdbSavedObjectPages(j->val);
        } else if (j->type == REDIS_IOJOB_DO_SWAP) {
            if (vmWriteObjectOnSwap(j->val,j->page) == REDIS_ERR)
                j->canceled = 1;
        }

        /* Done: insert the job into the processed queue */
        ...
				lockThreadedIO();
        listDelNode(server.io_processing,ln);
        listAddNodeTail(server.io_processed,j);
        unlockThreadedIO();
        /* Signal the main thread there is new stuff to process */
        redisAssert(write(server.io_ready_pipe_write,"x",1) == 1);
    }
    return NULL; /* never reached */
}
```

## 总结

因为 Redis VM 特性已经从Redis中删除，相关代码也比较古早，就不展开阐述了。

除了学习到多线程下，Redis 对数据读写的优化，我们在学习源码和Redis的官方博客时，能够明显感受到：

“去掉 **Redis VM** 的根本原因，可能是定位问题。Redis的准确定位了**磁盘备份**的**内存数据库**，去掉VM后的Redis更纯粹，更简单，更容易让用户理解和使用。”

有时候，砍掉性能不好、意义不明的特性代码，就是最好的性能优化吧。