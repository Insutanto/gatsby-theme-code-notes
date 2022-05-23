---
title: Scalene：一个Python的高性能CPU, GPU和内存分析器
emoji: 🚀
tags: 
  - python
  - profile
  - translation
created: 2021-03-25T20:16:50.000Z
modified: 2021-03-25T22:50:50.000Z
---

![scalene](https://github.com/plasma-umass/scalene/raw/master/docs/scalene-image.png)


《Scalene：一个Python的高性能CPU, GPU和内存分析器》 by [Emery Berger](https://emeryberger.com)

原文：
https://github.com/plasma-umass/scalene


# 关于 Scalene

```
  % pip install -U scalene
```

Scalene 是一个 Python 的高性能 CPU, GPU *和* 内存分析器，它可以做到很多其他Python分析器不能做到的事情。它在能提供更多详细信息的同时，比其他的分析器要快几个数量级。

### 快速且精确

- Scalene 是 _很快的_。 它使用采样的方式而不是直接测量或者依靠Python的追踪工具。它的开销一般不超过10-20% (通常更少)。
- Scalene 是 _精确的_。和大部分其他的Python分析器不同，Scalene 在 _行级别_ 下执行CPU分析，在你的程序中指出对应代码行的执行时间。和大多数分析器所返回的函数级分析结果相比，这种程度的细节可能会更有用。

### CPU 分析

- Scalene **将在 Python 中和本地代码中花费的时间分开** (包括库)。 大部分的 Python 程序员并不会去优化本地代码 (通常是在 Python 实现中或者外部库)， 所以这能帮开发者专注于他们实际上能够改进的代码。
- Scalene 用红色 **高亮热点** 代码 (占用了大量 CPU 时间和内存分配的), 使他们更容易被发现。
- Scalene 还会分离出 **系统时间**, 使查找 I/O 瓶颈变得容易。

### GPU 分析

- Scalene 上报 **GPU 时间** (目前仅限于基于nVidia的系统)。

### Memory 分析

- Scalene **分析内存使用**。 除了跟踪 CPU 使用， Scalene 也会指出需要为内存增长负责的特定代码行。 它是通过引用专门的内存分配器来实现的。
- Scalene 分理出 **Python代码 与 本地代码** 内存消耗的百分比。
- Scalene 产生 **_按行的_ 内存分析**.
- Scalene **识别可能的内存泄漏**.
- Scalene **分析 _内存拷贝量_**, 从而易于发现意外的内存拷贝。特别是因为跨越Python和底层库的边界导致的意外 (例如：意外的把 `numpy` 数组转化成了Python数组，反之亦然)。


### 其他特性

- Scalene 可以生成 **更少的分析** (通过 `--reduced-profile`) 只上报那些小号超过 1% CPU 或者执行至少100个分配的代码行。
- Scalene 支持通过 `@profile` 装饰器只对特定函数进行分析。
- 当 Scalene 在对后台启动(通过 `&`)的程序进行分析时， 你可以 **暂停和恢复分析**。

# 对比其他的分析器

## 性能和特性

下表将各种分析器的 **性能和特性** 跟 Scalene 进行比较。

![Performance and feature comparison](https://github.com/plasma-umass/scalene/blob/master/images/profiler-comparison.png)

**函数粒度的分析器** 只上报整个函数的信息， 而 **行粒度的分析器** (像 Scalene) 可以上报每一行的信息。

- **Time** is either real (wall-clock time), CPU-only, or both.
- **Efficiency**: :green_circle: = 快, :yellow_circle: = 较慢, :red_circle: = 最慢
- **Mem Cons.**: 跟踪内存消耗
- **Unmodified Code**: 适用于未修改的代码
- **Threads**: 适用于线程
- **Python/C**: 分别分析 Python/C 的时间和内存消耗
- **Mem Trend**: 显示一段时间内的内存使用趋势
- **Copy Vol.**: 上报 _内存拷贝量_, 内存复制的 MB/s

## 输出

Scalene 可以为正在被分析的程序打印带注释的源码
(通过 `--html` 选项打印文本或者HTML) 以及他在同一目录下使用的任何模块 (你可以选择 `--profile-all` 分析所有，也可以使用 `--cpu-percent-threshold` ，只分析 CPU 时间)。这里有一个代码片段
`pystone.py`.

![Example profile](https://github.com/plasma-umass/scalene/blob/master/images/sample-profile-pystone.png)

* **Memory usage at the top**: 通过 "sparklines" 可视化， 分析的代码在运行期间的内存占用。 Scalene 是一个统计的分析器， 意味着它使用采样，所以就肯定会有差异发生。一个运行时间更长的程序可以分配和释放更多的内存，会获得更稳定的结果。
* **"CPU % Python"**: Python 代码占用的时间。
* **"CPU % Native"**: 本地代码占用的时间 (例如 C/C++ 写的库)。
* **"Mem % Python"**: 相对于非 Python 代码(例如 C/C++ 写的库)，Python 代码的内存分配。
* **"Net (MB)"**: 正数代表内存分配的净值，负数代表内存回收的净值。
* **"Memory usage over time / %"**: 通过 "sparklines" 可视化， 表示这些代码行在程序运行时产生的内存消耗，以及此行内存活动总的百分比。
* **"Copy (MB/s)"**: 复制的 MB/s (参见 "关于 Scalene").

## Using `scalene`

下面的命令是让 Scalene 执行提供的示例程序。

```
  % scalene test/testme.py
```

**NEW**: Scalene 可以在 Jupyter notebooks 内部工作了。

行模式:

```
  %scrun [options] statement
```

Cell模式:

```
  %%scalene [options]
  code...
  code...
```

运行时加上 `--help`，来查看所有的选项。

    % scalene --help
     usage: scalene [-h] [--outfile OUTFILE] [--html] [--reduced-profile]
                    [--profile-interval PROFILE_INTERVAL] [--cpu-only]
                    [--profile-all] [--profile-only PROFILE_ONLY]
                    [--use-virtual-time]
                    [--cpu-percent-threshold CPU_PERCENT_THRESHOLD]
                    [--cpu-sampling-rate CPU_SAMPLING_RATE]
                    [--malloc-threshold MALLOC_THRESHOLD]
     
     Scalene: a high-precision CPU and memory profiler.
     https://github.com/plasma-umass/scalene
     
     command-line:
        % scalene [options] yourprogram.py
     or
        % python3 -m scalene [options] yourprogram.py
     
     in Jupyter, line mode:
        %scrun [options] statement
     
     in Jupyter, cell mode:
        %%scalene [options]
        code...
        code...
     
     optional arguments:
       -h, --help            show this help message and exit
       --outfile OUTFILE     file to hold profiler output (default: stdout)
       --html                output as HTML (default: text)
       --reduced-profile     generate a reduced profile, with non-zero lines only (default: False)
       --profile-interval PROFILE_INTERVAL
                             output profiles every so many seconds (default: inf)
       --cpu-only            only profile CPU time (default: profile CPU, memory, and copying)
       --profile-all         profile all executed code, not just the target program (default: only the target program)
       --profile-only PROFILE_ONLY
                             profile only code in files that contain the given string (default: no restrictions)
       --use-virtual-time    measure only CPU time, not time spent in I/O or blocking (default: False)
       --cpu-percent-threshold CPU_PERCENT_THRESHOLD
                             only report profiles with at least this percent of CPU time (default: 1%)
       --cpu-sampling-rate CPU_SAMPLING_RATE
                             CPU sampling rate (default: every 0.01s)
       --malloc-threshold MALLOC_THRESHOLD
                             only report profiles with at least this many allocations (default: 100)
     
     When running Scalene in the background, you can suspend/resume profiling
     for the process ID that Scalene reports. For example:
     
        % python3 -m scalene [options] yourprogram.py &
      Scalene now profiling process 12345
        to suspend profiling: python3 -m scalene.profile --off --pid 12345
        to resume profiling:  python3 -m scalene.profile --on  --pid 12345


## Installation

### pip (Mac OS X, Linux, and Windows WSL2)

Scalene 通过 pip 包的形式进行分发，可以运行在Mac OS X和Linux平台(包括在[Windows WSL2](docs.microsoft.com/en-us/windows/wsl/wsl2-index)中运行的Ubuntu)。 


你可以通过下面的方式安装：
```
  % pip install -U scalene
```

或者
```
  % python3 -m pip install -U scalene
```

### Homebrew (Mac OS X)

除了使用 `pip`，你可以使用 Homebrew 从这个仓库安装当前版本的 Scalene:

```
  % brew tap plasma-umass/scalene
  % brew install --head plasma-umass/scalene/libscalene
```

### ArchLinux

**NEW**: 通过 [AUR
package](https://aur.archlinux.org/packages/python-scalene-git/) 你可以在 Arch Linux 上安装 Scalene。使用你最喜欢的 AUR helper，或者手动下载 `PKGBUILD` 然后运行 `makepkg -cirs` 来构建。 注意，这会把
`libscalene.so` 放在 `/usr/lib`下; modify the below usage instructions accordingly.


# 技术信息

关于 Scalene 的技术细节，请看下面的论文: [Scalene: Scripting-Language Aware Profiling for Python](https://github.com/plasma-umass/scalene/raw/master/scalene-paper.pdf) ([arXiv link](https://arxiv.org/abs/2006.03879)).

# 成功案例

如果你成功使用 Scalene 调试性能问题， 请 [在这个 issue 下增加评论](https://github.com/plasma-umass/scalene/issues/58)!

# 致谢

Logo 由 [Sophia Berger](https://www.linkedin.com/in/sophia-berger/) 创作。

本材料基于美国国家科学基金会在1955610资助下的支持。
本材料中表达的任何观点，发现，结论或建议均为作者的个人观点，并不一定反映国家科学的观点。 
