---
title: 面向对象设计原则(The Principles of OOD)
emoji: 👫
tags: 
  - translation
  - ood
created: 2021-04-01T20:16:50.000Z
modified: 2021-04-02T22:50:50.000Z
---

原文[The Principles of OOD](http://butunclebob.com/ArticleS.UncleBob.PrinciplesOfOod)

什么是面向对象设计？究竟是怎么回事？有什么利弊？在这个几乎每个软件开发者都在使用某种面向对象语言的时代，这个问题看起来似乎很傻。但是在我看来，这个问题是重要的，因为我们大多人使用这些语言，却不知道为什么，不知道怎么样发挥他们的最大价值。

纵观在我们业内发生的所有革命，有两个尤为成功，以至于他们已经在某种程度上渗透了我们的思想，让我们觉得他们是理所当然的。那就是**结构化编程**和**面向对象编程**。他们强烈影响了我们如今所有主流的现代语言。实际上，我们很难编写一个程序，让它既没有体现结构化程序设计，又没有体现面向对象程序设计。我们的主流语言没有**goto**，这似乎是遵循了**结构化编程**最著名的禁令；我们大多数的主流语言都是基于类的，并且不支持类外的函数或变量，这似乎是遵循了**面向对象编程**最明显的特征。

使用这些语言编写的程序，可能看上去是结构化的或者面向对象的，但是也可能不是。而今太多程序员不了解这两个领域的基本原则（而他们使用的语言衍生于这两个领域）。所以，在另一篇博客中，我会讨论**结构化编程**的设计原则，而在这篇文章中我想要聊聊**面向对象编程**的设计原则。

1995年3月，我在comp.object中写了一篇[文章](http://tinyurl.com/84emx)，是我OOD原则文集的第一篇，之后我写了多次相关的文章。你可以到我的书《[PPP](https://www.amazon.com/Software-Development-Principles-Practices-Paperback/dp/B011DBKELY)》中，以及网站[objectmentor](http://www.objectmentor.com/)上看到他们，也包括那个知名的[总结](http://www.objectmentor.com/resources/articles/Principles_and_Patterns.pdf)。

这些原则阐述了OOD的依赖管理，而不是概念化和建模。 这并不是说OO不是问题概念化的有效工具，也不是说OO不是创建模型的好方法。 虽然，许多人可以从其中中获得价值，但是，这些原则非常严格地集中在依赖管理上。

依赖管理是我们大多数人都需要面对的问题。每当我们在屏幕上看到一堆乱七八糟的遗留代码时，我们都在经历依赖管理不善的结果。糟糕的依赖管理会导致代码难以更改，脆弱，并且不可复用。实际上，在我的《PPP》一书中谈到了几种不同的设计风格，都与依赖管理有关。另一方面，当依赖得到很好的管理时，代码将保持灵活，健壮和可复用的。因此，依赖管理，以及这些原则，是软件开发人员渴求的软件设计**可复用、可扩展**(-ilities)的基础。

首先这5个，是类设计的原则：

| 缩写 | 全称                                              | 描述                                     |
|------|---------------------------------------------------|------------------------------------------|
| SRP  | 单一职责原则(The Single Responsibility Principle) | 一个类，只有一个修改原因。               |
| OCP  | 开闭原则(The Open Closed Principle)               | 你应该能够扩展类的行为，而不需要修改它。 |
| LSP  | 里氏替换原则(The Liskov Substitution Principle)   | 派生类可以替代其基类。                   |
| ISP  | 接口隔离原则(The Interface Segregation Principle) | 创建特定于客户的细粒度接口。             |
| DIP  | 依赖倒置原则(The Dependency Inversion Principle)  | 依赖抽象，而不是依赖实现。               |

接下来的六个原则是关于包的。 在我们的上下文中，包是二进制交付文件（如.jar文件）或dll，而不是诸如Java package这种命名空间或C ++命名空间。

前三个包原则是关于包的内聚，它们告诉我们在包中放入什么：

| 缩写 | 全称                                                      | 描述                       |
|------|-----------------------------------------------------------|----------------------------|
| REP  | 重用发布等价原则(The Release Reuse Equivalency Principle) | 重用的粒度就是发布的粒度。 |
| CCP  | 共同封闭原则(The Common Closure Principle)                | 一起变更的类打包在一起。   |
| CRP  | 共同复用原则(The Common Reuse Principle)                  | 一起使用的类打包在一起。   |

最后三个原则是关于包之间的耦合，并讨论关于评估一个系统的包结构的指标：

| 缩写 | 全称                                             | 描述                         |
|------|--------------------------------------------------|------------------------------|
| ADP  | 无环依赖原则(The Acyclic Dependencies Principle) | 包的依赖关系图，不允许有环。 |
| SDP  | 稳定依赖原则(The Stable Dependencies Principle)  | 依赖趋于稳定。               |
| SAP  | 稳定抽象原则(The Stable Abstractions Principle)  | 抽象性伴随稳定性提升。       |