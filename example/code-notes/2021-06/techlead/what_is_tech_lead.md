---
title: 我谈技术管理(1)：技术管理是什么？
emoji: 🧘‍♂️
tags: 
  - TechLead
created: 2021-06-10T20:16:50.000Z
modified: 2021-06-14T21:50:50.000Z
---

## 前言

之前，我在团队主动承担了一段时间Tech Lead的职责，通过技术管理来锻炼自己，让我对管理这件事情不再那么抵触。最近在做总结，这次就来总结一下我这段时间对技术管理的思考。

## 系列指北

[我谈技术管理(1)：技术管理是什么？](https://blog.insutanto.tech/code-notes/2021-06/techlead/what_is_tech_lead)

[我谈技术管理(2)：我的经验](https://blog.insutanto.tech/code-notes/2021-06/techlead/my_experience)

## ”通过技术实现经营者的目标的人“

大家可能对技术管理或者Tech Lead的概念可能还比较模糊，技术管理乍一看是一个很大的课题：
技术涉及到技术团队的方方面面，包含了大量的细节，而技术管理到底需要管理什么？一些公司有单独设立技术管理的岗位，一些公司又没有，而技术管理者在团队中扮演什么样的角色？

要想知道这个问题的答案，我们要先知道，技术团队中有什么角色，这些角色都做些什么。

在技术团队的日常工作中，通常有三种角色：**产品管理者**，**工程师管理者**和**技术管理者**。我把**产品管理者**定义为”通过产品实现经营者的目标的人“，**工程师管理者**定义为”通过工程师下属实现经营者的目标的人“，类似的，可以把**技术管理者**定义为”**通过技术实现经营者的目标的人**“。

> 我将主管定义为“通过下属实现经营者的目标的人”，但根据企业实际情况的不同，主管的职责也存在着千差万别，不能一概而论。
——《10人以下小团队管理手册》[日]堀之内克彦

一般来说**产品管理者**由产品经理担任，**工程师管理者**是技术团队的经理/主管/总监。在一些组织的里，**技术管理者**往往没有单独的头衔，可能由拥有头衔的**工程师管理者**兼任，也可能无人扮演这个角色；因此，我不打算讨论具体的职位，只讲讲**技术管理者**这个**角色**。

接下来我们继续讲讲技术管理者——”**通过技术实现经营者的目标的人**“。

<iframe frameborder="0" style="width:100%;height:400px;" src="https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1#R5ZjLjpswFIafxstW4BuwhAyZbrqaRdcUPIDG4JQ4TdKn7wHsALlII%2BU6SjbY%2Fzm%2B%2FZ9tIhCZVZvXJlkUP1UmJMJOtkHkBWHsOsSHR6tse4V5QS%2FkTZmZpEF4K%2F8J29KoqzITy0miVkrqcjEVU1XXItUTLWkatZ6mvSs5HXWR5OJAeEsTeaj%2BKjNdGNXlwRD4Icq8MEP72OsDv5P0I2%2FUqjbj1aoWfaRKbDdmjcsiydR6JJEYkVmjlO5L1WYmZGurdaxvNz8R3U25EbX%2BTAPsMmIa%2FU3kyqzczE1vrRXQCFyHSvReSjlTUjVdgMwd33MY6GqRpKVuSXMHqkvdqA9hEzsDSFToSkLNbbtRtR530%2F1AP5y%2FnZ1otNiMJLOeV6EqoZstpJgoocZbs%2B1wwL6zXlkPGJljsooRwZ2YmK2T73ofPISCsfG0pfgMS10chtFjWer6e5bymztKznBU%2BIxT%2FFCO0uDujtIjjnKpzbon1vI%2FK2UD35bdRR1CAuGLzRCEUt49Y4qiEIUeihkKCPJdFHsojFHYFWDhPkexj2BP%2BcwOCRPuRzV97LMFW%2B0EzIsCU6gnssxrqKRAQgCmqCVQwhUemkBVZpm8HVbsOZajBWtfCiOubnCEq3chrOxsrNQ5jpUjP2ypQSGYoXD%2BPFg9fHes%2FGpYGYqAI%2BtoAr5egYL%2FPHxpMKXL%2BI3pemfTxSfo0pZlELZQ4fS2LOFSjjvM1zvPB3w%2FgXG0R1x%2BGazM23vJHjm09AhVeiGq%2Fj2o3uA4PwheSry9W5niY3%2F1r4k4uBriw9P5hIh5ENwbse3mCohZywUItowIil4GxF8SFuNsDxahV7twoTp8Jelio69QJP4P"></iframe>

## 技术管理者的职责

对技术管理者下了定义后，就不得不思考一个问题：**技术管理者的职责边界是什么**。接下来我们从技术到管理依次渐进，来聊聊技术管理应该做什么，不应该做什么。

### 应该做什么

1. 统一并优化宏观和微观上的技术栈
    1. 宏观（架构）上的技术栈：包含了基础设施、技术组件等方面
    2. 微观（代码）上的技术栈：包含工程实践、业务实践等方面
2. 对领域内团队的技术输出负责（架构、设计、代码、稳定性等）
3. 负责在领域内指导其他工程师（对事不对人）
4. 负责协助领域内任务和项目的项目管理
5. 与其他管理者在领域内创造价值
    1. 制定领域内的技术发展规划
    2. 协助工程师管理者培养工程师
    3. 协助工程师管理者制定、实现团队目标
    4. 协助产品管理者制定、实现业务目标
6. 跨团队推动更大规模的技术管理
7. 高屋建瓴的DevOps（通过管理思想做技术管理）

### 不应该做什么

1. 搭建与团队成员背景不符的技术栈
    1. 宏观上的技术栈：使用了大量团队成员不熟悉的基础设施、技术组件
    2. 微观上的技术栈：代码实践上过于激进或者保守，团队成员“望其项背”或者“嗤之以鼻”
2. 对领域内团队的技术输出亲力亲为（恨不得管到每一行代码）
3. 公开指责团队成员在领域内的过失（对人不对事）
4. 项目管理的关键节点上干扰项目的实现细节
5. 与其他管理者缺乏沟通
    1. 放任业务的发展被动的推动技术的发展
    2. 和工程师管理者忽略团队成员在技术上的诉求
    3. 被动接受其他管理者制定的目标
6. 视野局限于团队内的一亩三分地
7. 一叶（技术）障目不见泰山（管理）

## 最后

如果有可能，后续会有更多技术管理相关的分享。