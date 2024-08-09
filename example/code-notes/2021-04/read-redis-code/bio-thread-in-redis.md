---
title: Redis 多线程变迁(2) 之 Redis BIO 多线程
emoji: 👥
tags: 
  - redis
  - 源来如此
created: 2021-04-16T20:16:50.000Z
modified: 2021-04-20T21:50:50.000Z
---
## 系列指北

Redis 多线程源码分析系列:

[Redis VM线程(Redis 1.3.x - Redis 2.4)](https://blog.insutanto.tech/code-notes/2021-04/read-redis-code/vm-thread-in-redis)

[Redis BIO线程(Redis 2.4+ 和 Redis 4.0+)](https://blog.insutanto.tech/code-notes/2021-04/read-redis-code/bio-thread-in-redis)

[Redis 网络IO线程(Redis 6.0+)](https://blog.insutanto.tech/code-notes/2021-04/read-redis-code/network-io-thread-in-redis)

## Redis BIO线程(Redis 2.4+)

从系列上一篇我们知道，从一开始，除了“短寿”的VM特性和VM线程，Redis主要还是单线程的。不过，我们在Redis的官方文章里能看到，从 Redis 2.4 (2011年)开始，Redis会使用线程在后台执行一些主要跟磁盘I/O有关的慢速的I/O操作。我们把代码分支切到 Redis 2.4 的分支上，能发现有两个 BIO 线程，协助 Redis 进行AOF文件同步刷盘和文件删除的工作。

### 怎么找到多线程相关的代码

根据Redis的配置`appendfsync`，我们在代码里面找到配置对应的定义。

```c
// config.c
...
    else if (!strcasecmp(c->argv[2]->ptr,"appendfsync")) {
        if (!strcasecmp(o->ptr,"no")) {
            server.appendfsync = APPENDFSYNC_NO;
        } else if (!strcasecmp(o->ptr,"everysec")) {
            server.appendfsync = APPENDFSYNC_EVERYSEC;
        } else if (!strcasecmp(o->ptr,"always")) {
            server.appendfsync = APPENDFSYNC_ALWAYS;
        } else {
            goto badfmt;
        }
    }
...
```

通过搜索 `APPENDFSYNC_EVERYSEC` ，我们找到了 `backgroundRewriteDoneHandler`: 

```c
// aof.c
void backgroundRewriteDoneHandler(int statloc) {
......
    else if (server.appendfsync == APPENDFSYNC_EVERYSEC)
        aof_background_fsync(newfd);
......
}
```

在 `aof_background_fsync` 函数中，发现了后台任务相关函数：

```c
// aof.c
void aof_background_fsync(int fd) {
    bioCreateBackgroundJob(REDIS_BIO_AOF_FSYNC,(void*)(long)fd,NULL,NULL);
}
```

搜索关键词 `REDIS_BIO_AOF_FSYNC`，最后我们找到了BIO模块的头文件(`bio.h`)，包含了BIO相关的接口和常量定义：

```c
// bio.h
/* Exported API */
void bioInit(void);
void bioCreateBackgroundJob(int type, void *arg1, void *arg2, void *arg3);
unsigned long long bioPendingJobsOfType(int type);
void bioWaitPendingJobsLE(int type, unsigned long long num);
time_t bioOlderJobOfType(int type);

/* Background job opcodes */
#define REDIS_BIO_CLOSE_FILE    0 /* Deferred close(2) syscall. */
#define REDIS_BIO_AOF_FSYNC     1 /* Deferred AOF fsync. */
#define REDIS_BIO_NUM_OPS       2
```

最后，我们找到了 `bioInit`，发现 Redis 创建了2个 BIO 线程来执行 `bioProcessBackgroundJobs` 函数，而 `bioInit` 又是在 `server.c` 的 `main` 方法中，通过 `initServer` 函数来调用：

```c
// bio.c
/* Initialize the background system, spawning the thread. */
void bioInit(void) {
    pthread_attr_t attr;
    pthread_t thread;
    size_t stacksize;
    int j;

    /* Initialization of state vars and objects */
    for (j = 0; j < REDIS_BIO_NUM_OPS; j++) {
        pthread_mutex_init(&bio_mutex[j],NULL);
        pthread_cond_init(&bio_condvar[j],NULL);
        bio_jobs[j] = listCreate();
        bio_pending[j] = 0;
    }

    /* Set the stack size as by default it may be small in some system */
    pthread_attr_init(&attr);
    pthread_attr_getstacksize(&attr,&stacksize);
    if (!stacksize) stacksize = 1; /* The world is full of Solaris Fixes */
    while (stacksize < REDIS_THREAD_STACK_SIZE) stacksize *= 2;
    pthread_attr_setstacksize(&attr, stacksize);

    /* Ready to spawn our threads. We use the single argument the thread
     * function accepts in order to pass the job ID the thread is
     * responsible of. */
    for (j = 0; j < REDIS_BIO_NUM_OPS; j++) {
        void *arg = (void*)(unsigned long) j;
        if (pthread_create(&thread,&attr,bioProcessBackgroundJobs,arg) != 0) {
            redisLog(REDIS_WARNING,"Fatal: Can't initialize Background Jobs.");
            exit(1);
        }
    }
}
```

### BIO多线程的意义

在 `backgroundRewriteDoneHandler` 函数中，我们会给 BIO 线程增加后台任务，然后让 BIO 线程在后台处理一些工作，为了搞清楚 Redis 使用 BIO 多线程的意义，我们可以先弄清楚这个函数是做什么的。

看注释的描述，这个函数是在后台AOF重写(BGREWRITEAOF)结束时调用，然后我们继续往下看代码，主要是一些写文件的操作，直到我们看到 `aof.c` 中有一段很详细的注释：

> 剩下要做的唯一事情就是将临时文件重命名为配置的文件，并切换用于执行AOF写入的文件描述符。我们不希望close(2)或rename(2)调用在删除旧文件时阻塞服务器。
有两种可能的方案：<br/>
1）AOF已禁用，这是一次重写。临时文件将重命名为配置的文件。当该文件已经存在时，它将被取消链接(unlink)，这可能会阻塞server。<br/>
2）AOF已启用，重写的AOF将立即开始接收写操作。将临时文件重命名为配置文件后，原始AOF文件描述符将关闭。由于这将是对该文件的最后一个引用，因此关闭该文件将导致底层文件被取消链接(unlink)，这可能会阻塞server。<br/>
为了减轻取消链接(unlink)操作的阻塞效果（由方案1中的rename(2)或方案2中的close(2)引起），我们使用后台线程来解决此问题。首先，通过打开目标文件，使方案1与方案2相同。rename(2)之后的取消链接(unlink)操作将在为其描述符调用close(2)时执行。到那时，保证这条分支原子性的一切都已发生，因此，只要文件描述符再次被释放，我们就不在乎该关闭操作的影响或持续时间。<br/>

我们发现了Redis使用BIO线程(`REDIS_BIO_CLOSE_FILE`)的目的——后台线程删除文件，避免因为删除大文件耗时过长导致主线程阻塞：
在AOF重写时，`rename(2)`或者`close(2)`文件，可能会导致系统调用执行删除文件的操作，而删除文件的操作是在当前进程执行（内核态），所以如果文件较大，当前进程删除文件的耗时就会比较长。而如果在主线程删除比较大的文件，就会导致主线程被磁盘IO阻塞。

```c
//aof.c
/* A background append only file rewriting (BGREWRITEAOF) terminated its work.
 * Handle this. */
void backgroundRewriteDoneHandler(int statloc) {
    int exitcode = WEXITSTATUS(statloc);
    int bysignal = WIFSIGNALED(statloc);

    if (!bysignal && exitcode == 0) {
        int newfd, oldfd;
        int nwritten;
        char tmpfile[256];
        long long now = ustime();
				...
        /* Flush the differences accumulated by the parent to the
         * rewritten AOF. */
        snprintf(tmpfile,256,"temp-rewriteaof-bg-%d.aof",
            (int)server.bgrewritechildpid);
        newfd = open(tmpfile,O_WRONLY|O_APPEND);
        if (newfd == -1) {
            redisLog(REDIS_WARNING,
                "Unable to open the temporary AOF produced by the child: %s", strerror(errno));
            goto cleanup;
        }

        nwritten = write(newfd,server.bgrewritebuf,sdslen(server.bgrewritebuf));
        if (nwritten != (signed)sdslen(server.bgrewritebuf)) {
            if (nwritten == -1) {
                redisLog(REDIS_WARNING,
                    "Error trying to flush the parent diff to the rewritten AOF: %s", strerror(errno));
            } else {
                redisLog(REDIS_WARNING,
                    "Short write trying to flush the parent diff to the rewritten AOF: %s", strerror(errno));
            }
            close(newfd);
            goto cleanup;
        }

        redisLog(REDIS_NOTICE,
            "Parent diff successfully flushed to the rewritten AOF (%lu bytes)", nwritten);

        /* The only remaining thing to do is to rename the temporary file to
         * the configured file and switch the file descriptor used to do AOF
         * writes. We don't want close(2) or rename(2) calls to block the
         * server on old file deletion.
         *
         * There are two possible scenarios:
         *
         * 1) AOF is DISABLED and this was a one time rewrite. The temporary
         * file will be renamed to the configured file. When this file already
         * exists, it will be unlinked, which may block the server.
         *
         * 2) AOF is ENABLED and the rewritten AOF will immediately start
         * receiving writes. After the temporary file is renamed to the
         * configured file, the original AOF file descriptor will be closed.
         * Since this will be the last reference to that file, closing it
         * causes the underlying file to be unlinked, which may block the
         * server.
         *
         * To mitigate the blocking effect of the unlink operation (either
         * caused by rename(2) in scenario 1, or by close(2) in scenario 2), we
         * use a background thread to take care of this. First, we
         * make scenario 1 identical to scenario 2 by opening the target file
         * when it exists. The unlink operation after the rename(2) will then
         * be executed upon calling close(2) for its descriptor. Everything to
         * guarantee atomicity for this switch has already happened by then, so
         * we don't care what the outcome or duration of that close operation
         * is, as long as the file descriptor is released again. */
        if (server.appendfd == -1) {
            /* AOF disabled */

             /* Don't care if this fails: oldfd will be -1 and we handle that.
              * One notable case of -1 return is if the old file does
              * not exist. */
             oldfd = open(server.appendfilename,O_RDONLY|O_NONBLOCK);
        } else {
            /* AOF enabled */
            oldfd = -1; /* We'll set this to the current AOF filedes later. */
        }

        /* Rename the temporary file. This will not unlink the target file if
         * it exists, because we reference it with "oldfd". */
        if (rename(tmpfile,server.appendfilename) == -1) {
            redisLog(REDIS_WARNING,
                "Error trying to rename the temporary AOF: %s", strerror(errno));
            close(newfd);
            if (oldfd != -1) close(oldfd);
            goto cleanup;
        }

        if (server.appendfd == -1) {
            /* AOF disabled, we don't need to set the AOF file descriptor
             * to this new file, so we can close it. */
            close(newfd);
        } else {
            /* AOF enabled, replace the old fd with the new one. */
            oldfd = server.appendfd;
            server.appendfd = newfd;
            if (server.appendfsync == APPENDFSYNC_ALWAYS)
                aof_fsync(newfd);
            else if (server.appendfsync == APPENDFSYNC_EVERYSEC)
                aof_background_fsync(newfd);
            server.appendseldb = -1; /* Make sure SELECT is re-issued */
            aofUpdateCurrentSize();
            server.auto_aofrewrite_base_size = server.appendonly_current_size;

            /* Clear regular AOF buffer since its contents was just written to
             * the new AOF from the background rewrite buffer. */
            sdsfree(server.aofbuf);
            server.aofbuf = sdsempty();
        }

        redisLog(REDIS_NOTICE, "Background AOF rewrite successful");

        /* Asynchronously close the overwritten AOF. */
        if (oldfd != -1) bioCreateBackgroundJob(REDIS_BIO_CLOSE_FILE,(void*)(long)oldfd,NULL,NULL);

        redisLog(REDIS_VERBOSE,
            "Background AOF rewrite signal handler took %lldus", ustime()-now);
    } else if (!bysignal && exitcode != 0) {
        redisLog(REDIS_WARNING,
            "Background AOF rewrite terminated with error");
    } else {
        redisLog(REDIS_WARNING,
            "Background AOF rewrite terminated by signal %d",
            WTERMSIG(statloc));
    }

cleanup:
    sdsfree(server.bgrewritebuf);
    server.bgrewritebuf = sdsempty();
    aofRemoveTempFile(server.bgrewritechildpid);
    server.bgrewritechildpid = -1;
}
```

我们回到 `backgroundRewriteDoneHandler` 函数中调用的 `aof_background_fsync` 函数，在这个函数里，我们发现了另一个BIO线程(`REDIS_BIO_AOF_FSYNC`)的任务创建代码：

```c
void aof_background_fsync(int fd) {
    bioCreateBackgroundJob(REDIS_BIO_AOF_FSYNC,(void*)(long)fd,NULL,NULL);
}
```

阅读 `bioCreateBackgroundJob` 函数的代码，我们发现 Redis 在写对应Job类型的任务队列时加了互斥锁(mutex)，写完队列后通过释放条件变量和互斥锁，用来激活等待条件变量的 BIO线程，让 BIO线程继续执行任务队列的任务，这样保证队列在多线程下的数据一致性（还增加了对应 BIO类型的IO等待计数，暂时我们用不上），而 Redis BIO 线程就是从 BIO 的任务队列不断取任务的：

```c
// bio.c
void bioCreateBackgroundJob(int type, void *arg1, void *arg2, void *arg3) {
    struct bio_job *job = zmalloc(sizeof(*job));

    job->time = time(NULL);
    job->arg1 = arg1;
    job->arg2 = arg2;
    job->arg3 = arg3;
    pthread_mutex_lock(&bio_mutex[type]);
    listAddNodeTail(bio_jobs[type],job);
    bio_pending[type]++;
    pthread_cond_signal(&bio_condvar[type]);
    pthread_mutex_unlock(&bio_mutex[type]);
}
```

接着我们回到 BIO 线程的主函数 bioProcessBackgroundJobs，我们验证了 BIO 线程执行逻辑，BIO线程通过等待互斥锁和条件变量来判断是否继续读取队列。如前面的注释所说，在执行 `REDIS_BIO_CLOSE_FILE` 类型的任务时，调用的是 `close(fd)` 函数。继续阅读代码，发现在执行 `REDIS_BIO_AOF_FSYNC` 类型的任务时，调用的是函数 `aof_fsync`：

```c
// bio.c
void *bioProcessBackgroundJobs(void *arg) {
    struct bio_job *job;
    unsigned long type = (unsigned long) arg;

    pthread_detach(pthread_self());
    pthread_mutex_lock(&bio_mutex[type]);
    while(1) {
        listNode *ln;

        /* The loop always starts with the lock hold. */
        if (listLength(bio_jobs[type]) == 0) {
            pthread_cond_wait(&bio_condvar[type],&bio_mutex[type]);
            continue;
        }
        /* Pop the job from the queue. */
        ln = listFirst(bio_jobs[type]);
        job = ln->value;
        /* It is now possible to unlock the background system as we know have
         * a stand alone job structure to process.*/
        pthread_mutex_unlock(&bio_mutex[type]);

        /* Process the job accordingly to its type. */
        if (type == REDIS_BIO_CLOSE_FILE) {
            close((long)job->arg1);
        } else if (type == REDIS_BIO_AOF_FSYNC) {
            aof_fsync((long)job->arg1);
        } else {
            redisPanic("Wrong job type in bioProcessBackgroundJobs().");
        }
        zfree(job);

        /* Lock again before reiterating the loop, if there are no longer
         * jobs to process we'll block again in pthread_cond_wait(). */
        pthread_mutex_lock(&bio_mutex[type]);
        listDelNode(bio_jobs[type],ln);
        bio_pending[type]--;
    }
}
```

我们继续看 `aof_fsync` 的函数定义，发现 `aof_fsync` 其实就是 `fdatasync` 和 `fsync` :

```c
/* Define aof_fsync to fdatasync() in Linux and fsync() for all the rest */
#ifdef __linux__
#define aof_fsync fdatasync
#else
#define aof_fsync fsync
#endif
```

熟悉 Redis 的朋友知道，这是 Redis 2.4 中 BIO线程关于 Redis AOF 持久性的设计：

> 使用AOF Redis更加持久：<br/>
你有不同的fsync策略：完全不fsync，每秒fsync，每个查询fsync。使用fsync的默认策略，每秒的写入性能当然很好（fsync是使用后台线程执行的，并且当没有fsync执行时，主线程将尽力执行写入操作），但是你会损失一秒钟的写入数据。——[《Redis Persistence》](https://redis.io/topics/persistence)AOF advantages

而为什么fsync需要使用 BIO线程在后台执行，其实就很简单了。因为 Redis 需要保证数据的持久化，数据写入文件时，其实只是写到缓冲区，只有数据刷入磁盘，才能保证数据不会丢失，而 `fsync`将缓冲区刷入磁盘是一个同步IO操作。所以，在主线程执行缓冲区刷盘的操作，虽然能更好的保证数据的持久化，但是却会阻塞主线程。最后，为了减少阻塞，Redis 使用 BIO线程处理 `fsync`。但其实这并不意味着 Redis 不再受 `fsync` 的影响，实际上如果 `fsync` 过于缓慢（数据2S以上未刷盘），Redis主线程会不计代价的阻塞执行文件写入([Redis persistence demystified](http://oldblog.antirez.com/m/p.php?i=251)#appendfsync everysec)。

## Redis BIO线程(Redis 4.0+)

从 Redis 4.0 (2017年)开始，又增加了一个新的BIO线程，我们在 bio.h 中发现了新的定义——BIO_LAZY_FREE，这个线程主要用来协助 Redis 异步释放内存。在antirez的[《Lazy Redis is better Redis》](http://antirez.com/news/93)中，我们能了解到为什么要将释放内存放在异步线程中：

> (渐进式回收内存)这是一个很好的技巧，效果很好。 但是，我们还是必须在一个线程中执行此操作，这仍然让我感到很难过。当有很多逻辑需要处理，并且lazy free也非常频繁时，ops（每秒的操作数）会减少到正常值的65％左右。<br/>
释放不同线程中的对象会更简单：如果有一个线程正忙于仅执行释放操作，则释放应该总是比在数据集中添加新值快。<br/>
当然，主线程和lazy free线程之间在调用内存分配器上也存在一些竞争，但是Redis只会花一小部分时间在内存分配上，而将更多的时间花在I/O，命令分派，缓存未命中等等。<br/>

对这个特性背景感兴趣的朋友还可以看看这个issue: Lazy free of keys and databases #1748  [https://github.com/redis/redis/issues/1748](https://github.com/redis/redis/issues/1748)

```c
// bio.h
/* Background job opcodes */
#define BIO_CLOSE_FILE    0 /* Deferred close(2) syscall. */
#define BIO_AOF_FSYNC     1 /* Deferred AOF fsync. */
#define BIO_LAZY_FREE     2 /* Deferred objects freeing. */
#define BIO_NUM_OPS       3
```

我们回头看，发现在原来的基础上，增加了 `BIO_LAZY_FREE` 的部分。lazy free 的任务有三种：

1. 释放对象
2. 释放 Redis Database
3. 释放 跳表(skip list)

```c
// bio.c
void *bioProcessBackgroundJobs(void *arg) {
    struct bio_job *job;
    unsigned long type = (unsigned long) arg;
    sigset_t sigset;

    /* Check that the type is within the right interval. */
    if (type >= BIO_NUM_OPS) {
        serverLog(LL_WARNING,
            "Warning: bio thread started with wrong type %lu",type);
        return NULL;
    }

    /* Make the thread killable at any time, so that bioKillThreads()
     * can work reliably. */
    pthread_setcancelstate(PTHREAD_CANCEL_ENABLE, NULL);
    pthread_setcanceltype(PTHREAD_CANCEL_ASYNCHRONOUS, NULL);

    pthread_mutex_lock(&bio_mutex[type]);
    /* Block SIGALRM so we are sure that only the main thread will
     * receive the watchdog signal. */
    sigemptyset(&sigset);
    sigaddset(&sigset, SIGALRM);
    if (pthread_sigmask(SIG_BLOCK, &sigset, NULL))
        serverLog(LL_WARNING,
            "Warning: can't mask SIGALRM in bio.c thread: %s", strerror(errno));

    while(1) {
        listNode *ln;

        /* The loop always starts with the lock hold. */
        if (listLength(bio_jobs[type]) == 0) {
            pthread_cond_wait(&bio_newjob_cond[type],&bio_mutex[type]);
            continue;
        }
        /* Pop the job from the queue. */
        ln = listFirst(bio_jobs[type]);
        job = ln->value;
        /* It is now possible to unlock the background system as we know have
         * a stand alone job structure to process.*/
        pthread_mutex_unlock(&bio_mutex[type]);

        /* Process the job accordingly to its type. */
        if (type == BIO_CLOSE_FILE) {
            close((long)job->arg1);
        } else if (type == BIO_AOF_FSYNC) {
            aof_fsync((long)job->arg1);
        } else if (type == BIO_LAZY_FREE) {
            /* What we free changes depending on what arguments are set:
             * arg1 -> free the object at pointer.
             * arg2 & arg3 -> free two dictionaries (a Redis DB).
             * only arg3 -> free the skiplist. */
            if (job->arg1)
                lazyfreeFreeObjectFromBioThread(job->arg1);
            else if (job->arg2 && job->arg3)
                lazyfreeFreeDatabaseFromBioThread(job->arg2,job->arg3);
            else if (job->arg3)
                lazyfreeFreeSlotsMapFromBioThread(job->arg3);
        } else {
            serverPanic("Wrong job type in bioProcessBackgroundJobs().");
        }
        zfree(job);

        /* Unblock threads blocked on bioWaitStepOfType() if any. */
        pthread_cond_broadcast(&bio_step_cond[type]);

        /* Lock again before reiterating the loop, if there are no longer
         * jobs to process we'll block again in pthread_cond_wait(). */
        pthread_mutex_lock(&bio_mutex[type]);
        listDelNode(bio_jobs[type],ln);
        bio_pending[type]--;
    }
}
```

其中释放对象的主要逻辑在 decrRefCount 中：

```c
// lazyfree.c
/* Release objects from the lazyfree thread. It's just decrRefCount()
 * updating the count of objects to release. */
void lazyfreeFreeObjectFromBioThread(robj *o) {
    decrRefCount(o);
    atomicDecr(lazyfree_objects,1);
}
```

按照不同的数据类型，执行不同的内存释放逻辑：

```c
// object.c
void decrRefCount(robj *o) {
    if (o->refcount == 1) {
        switch(o->type) {
        case OBJ_STRING: freeStringObject(o); break;
        case OBJ_LIST: freeListObject(o); break;
        case OBJ_SET: freeSetObject(o); break;
        case OBJ_ZSET: freeZsetObject(o); break;
        case OBJ_HASH: freeHashObject(o); break;
        case OBJ_MODULE: freeModuleObject(o); break;
        default: serverPanic("Unknown object type"); break;
        }
        zfree(o);
    } else {
        if (o->refcount <= 0) serverPanic("decrRefCount against refcount <= 0");
        if (o->refcount != OBJ_SHARED_REFCOUNT) o->refcount--;
    }
}
```

### 扩展

其他的相关内容就不一一说明了，这里有一个扩展内容，算是 Redis 开发背后的故事。

我参考学习了文章[《Lazy Redis is better Redis》](http://antirez.com/news/93)，发现其实 antirez 在设计 lazy free 时还是比较纠结的。因为 lazy free 的特性涉及到了 Redis 本身的内部特性 —— 共享对象 (sharing objects)，lazy free 特性的推进受到了共享对象的影响。这里只说说结论，最后为了实现 lazy free 的特性，antirez 去掉了共享对象的特性。直到现在 (Redis 6.0)，共享对象仅在少部分地方出现，我们追踪代码的话，可以发现 `robj` 结构体的 `refcount` 目前大部分情况下等于 1。当然还有少部分情况，比如 `server.c` 中初始化创建整型数字的共享字符串，又或者手动增加计数来降低内存对象的回收速度等等。这就是为什么 Redis 明明去掉了共享对象的设计，但是我们还能看到 `refcount` 相关的代码，这大概就是历史遗留原因吧（手动狗头）。

```c
// server.c
#define OBJ_SHARED_REFCOUNT INT_MAX
typedef struct redisObject {
    unsigned type:4;
    unsigned encoding:4;
    unsigned lru:LRU_BITS; /* LRU time (relative to global lru_clock) or
                            * LFU data (least significant 8 bits frequency
                            * and most significant 16 bits access time). */
    int refcount;
    void *ptr;
} robj;
```

```c
// server.c
void createSharedObjects(void) {
......

    for (j = 0; j < OBJ_SHARED_INTEGERS; j++) {
        shared.integers[j] =
            makeObjectShared(createObject(OBJ_STRING,(void*)(long)j));
        shared.integers[j]->encoding = OBJ_ENCODING_INT;
    }
......
}
```