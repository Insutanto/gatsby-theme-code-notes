---
title: OOXML：详解Excel共享字符串(sharedStrings)
emoji: 📊
tags: 
  - OOXML
  - Excel
created: 2021-05-15T20:16:50.000Z
modified: 2021-05-16T21:50:50.000Z
---

## 背景

这篇文章是系列文章的第二篇，介绍什么是共享字符串(sharedStrings)，共享字符串的XML格式，以及共享字符串富文本的坑。

**以下提到的文档均为：ISO/IEC 29500-1:2016** 

## 系列文章指北

[Excel是什么](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-xlsx)

[详解Excel工作表(worksheet)](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-worksheet)

[详解Excel共享字符串(sharedStrings)](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-sharedstrings)

Todo: 详解Excel绘图(drawing)

## 什么是共享字符串

共享字符串的详细定义，可以直接参考文档，一句话来说，共享字符串(sharedStrings)就是一个字符串表，将相同的字符串只存一份共享，来优化工作表的性能。

文档 18.4 Shared String Table：

> 字符串值可以直接存储在电子表格单元格元素中（第18.3.1.4节）；但是，将相同的值存储在多个单元格元素中可能会导致工作表组件非常大，从而可能导致性能下降。共享字符串表是在工作簿中共享的字符串值的索引列表，该列表允许实现仅将值存储一次。<br/>
[示例：例如考虑一个工作簿，该工作簿概述了各个国家/地区中城市的信息。可以有一个列用于表示国家名称，一列用于表示该国家中每个城市的名称，以及一列，其中包含每个城市的数据。在这种情况下，国家名称是重复的，在许多单元格中重复。]<br/>
在大多数情况下，重复是普遍存在的，并且在保存工作簿时通过使用共享的字符串表可以节省大量空间。在电子表格中显示文本时，单元格表将只包含字符串表中的索引作为单元格的值，而不是完整的字符串。<br/>
共享字符串表被允许包含显示字符串的所有必要信息：文本，格式属性和语音属性（对于东亚语言）。<br/>
工作簿中的大多数字符串都在单元格级别应用了格式，即，单元格中的整个字符串都应用了相同的格式。在这些情况下，单元格的格式存储在样式部分中，并且单元格的字符串可以存储在共享字符串表中。在这种情况下，存储在sharedStrings表中的字符串是非常简单的文本元素。<br/>
工作簿中的某些字符串可以在比单元格级别更详细的级别上应用格式。<br/>
例如，字符串中的特定字符可以加粗，着色，斜体等。在这些情况下，格式与文本一起存储在字符串表中，并被视为表中的唯一条目。<br/>

## 共享字符串的XML格式

`sst`标签也就是Shared String Table的缩写，所以 xl/sharedStrings.xml 实际上是一个XML 表。通常`sst`都有一个`count`属性，表示共享字符串表中的字符串（包含字符串值相同的富文本）总数。还可能有`uniqueCount`属性，表示去除不同格式的情况下，唯一字符串的总数。

而在`sst`下，由一个个`si`标签，也就是String Item组成。每个String Item下是一个`t`(Text)标签。

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="36">
    <si>
        <t>Ttitle</t>
    </si>
    <si>
        <t>A1</t>
    </si>
    <si>
        <t>B1</t>
    </si>
......
</sst>
```

除此之外，需要额外介绍一种文本——phonetic，也就是注音。相关的标签有`rPh`和`phoneticPr`。

`rPh` (Phonetic Run)是一连串文本，显示对应`si`(String Item)的注音。有两个属性`eb` (Base Text End Index)和`sb` (Base Text Start Index)，表示注音的终止索引和起始索引。

`phoneticPr` (Phonetic Properties)，也就是注音属性，有三个属性：
1. alignment: 文本对齐；
2. fontId (Font Id): 字体ID；
3. type (Character Type): 枚举值，用来指定显示注音的东亚字符集。

```xml
<si>
    <t>課きく毛こ</t>
    <rPh sb="0" eb="1">
        <t>カ</t>
    </rPh>
    <rPh sb="4" eb="5">
        <t>ケ</t>
    </rPh>
    <phoneticPr fontId="1"/>
</si>
```

## 共享字符串之富文本

富文本也是一种共享字符串，包含在`si`标签内。

文档 18.4 Shared String Table

> 工作簿中的某些字符串可以在比单元格级别更详细的级别上应用格式。
例如，字符串中的特定字符可以加粗，着色，斜体等。在这种情况下，
格式与文本一起存储在字符串表中，并在表中被视为唯一条目。

OOXML用`r` (Rich Text Run) 标签代表富文本段落，`r`标签内一般还会有：

1. `rFont`(Font): 字体标签，属性`val`保存字体名；
2. `t` (Text): 字符串文本
3. `rPr` (Run Properties): 段落的标签元素：
    1. `sz` (Font Size): `val`表示字体大小
    2. `rFont` (Font): `val`表示字体名
    3. `strike` (Strike Through): 删除线
    4. `u` (Underline): 下划线
    5. `b` (Bold): 加粗
    6. `i` (italic): 斜体
    7. `color` (Color): `theme`属性存的是主题索引，`rgb`属性存的是颜色的数值
    8. `charset` (Character Set): `val` 表示字符集（整形表示）
        1. 从 18.4.1 charset (Character Set) 摘录一部分:
            1. 0     ANSI_CHARSET
            2. 1     DEFAULT_CHARSET
            3. 134 GB2312_CHARSET
            4. 136 CHINESEBIG5_CHARSET、

关于 Rich Text Run 和 Run Properties 的翻译，我参考了名词 [running text](https://www.merriam-webster.com/dictionary/running%20text) （表示文档的文本段落，与标题，列表等内容区分开）。虽然微软的openxml文档里翻译成了“运行”，但是这里感觉还是翻译成“段落”和“文本段落”比较贴切。

```xml
......
    <si>
        <r>
            <t>test</t>
        </r>
        <r>
            <rPr>
                <b />
                <i />
                <sz val="11" />
                <color theme="1" />
                <rFont val="宋体" />
                <charset val="134" />
                <scheme val="minor" />
            </rPr>
            <t>7</t>
        </r>
    </si>
    <si>
        <r>
            <t>test</t>
        </r>
        <r>
            <rPr>
                <strike />
                <u />
                <sz val="11" />
                <color theme="1" />
                <rFont val="宋体" />
                <charset val="134" />
                <scheme val="minor" />
            </rPr>
            <t>7</t>
        </r>
    </si>

......
```

## 为什么富文本是魔鬼

我发现在工作表中，富文本可能是有最多兼容bug的特性。就不提各Web端的产品了（有些根本不支持富文本），光是 Microsoft Excel 和 WPS表格 的各个版本（ MacOS 和 Windows 版本，以及各种新老版本），显示相同的富文本数据，经常会渲染出不一样的效果。

### 消失的第一段富文本样式

比如，富文本中的字符串是包含了样式的，而单元格本身也包含了样式，所以单元格的样式和富文本的样式应该是什么样的关系？有的产品将单元格的字体样式覆盖了富文本的字体样式，而更广泛的做法，是将单元格的样式作为富文本中的第一个字符串样式，而在富文本中，第一串文本的样式为空。

### 一改毁所有

如果你使用 Apache POI 去直接修改富文本的内容，你会把所有相同文本的单元格内容都修改了。没有别的法子，如果你需要修改富文本里的部分内容，最保险的做法是：
**完整的保存一份富文本的数据，然后依照这份数据，创建新的富文本数据（确保与其他的富文本内容不同），再设置到对应的单元格。**
而使用一些旁门左道，比如拷贝XML对象，可以创建出第二份内容相同的富文本对象，但是也只能创建出两份。

### ”我没有设置这个字体“

这个错误，是来自于工作中遇到的客户反馈：“我没有设置这个字体，但是他出现了”。

然而，这并不一定是我们的错。如果你发现富文本中的 `color` 标签有`theme`属性，需要注意了，您的富文本字体可能会很魔幻。没错，你的单元格字体，富文本英文文本字体，富文本中文文本字体，会受到主题的影响。当我们使用程序创建Excel文档时，需要格外注意。

```c
  <a:fontScheme name="Office">
      <a:majorFont>
          <a:latin typeface="Calibri Light" />
          <a:ea typeface="" />
          <a:cs typeface="" />
          <a:font script="Jpan" typeface="ＭＳ Ｐゴシック" />
          <a:font script="Hang" typeface="맑은 고딕" />
          <a:font script="Hans" typeface="宋体" />
          <a:font script="Hant" typeface="新細明體" />
          <a:font script="Arab" typeface="Times New Roman" />
          <a:font script="Hebr" typeface="Times New Roman" />
......
      </a:majorFont>
      <a:minorFont>
          <a:latin typeface="Calibri" />
          <a:ea typeface="" />
          <a:cs typeface="" />
          <a:font script="Jpan" typeface="ＭＳ Ｐゴシック" />
          <a:font script="Hang" typeface="맑은 고딕" />
          <a:font script="Hans" typeface="宋体" />
          <a:font script="Hant" typeface="新細明體" />
          <a:font script="Arab" typeface="Arial" />
          <a:font script="Hebr" typeface="Arial" />
......
      </a:minorFont>
  </a:fontScheme>
```

## 总结

这篇文章主要讲了OOXML实现的共享字符串和富文本特性，共享字符串在数据结构上优化了OOXML文档的空间和性能，也让我们的读写逻辑变得更加复杂。**共享字符串和富文本的读写操作，一定要小心！**而如果想要更多的了解共享字符串和富文本，可以查阅下面的参考资料。下一篇，将是本系列的终点——绘图(drawing)组件。

## 参考资料

officeopenxml.com [http://officeopenxml.com/](http://officeopenxml.com/)

officeopenxml.com介绍xlsx [http://officeopenxml.com/anatomyofOOXML-xlsx.php](http://officeopenxml.com/anatomyofOOXML-xlsx.php)

officeopenxml.com介绍xlsx(Spreadsheet)内容概述 [http://officeopenxml.com/SScontentOverview.php](http://officeopenxml.com/SScontentOverview.php)

OOXML维基百科 [https://en.wikipedia.org/wiki/Office_Open_XML](https://en.wikipedia.org/wiki/Office_Open_XML)

ISO/IEC 29500-1:2016 说明  [https://www.iso.org/standard/71691.html](https://www.iso.org/standard/71691.html)

ISO/IEC 国际标准文档列表 [https://standards.iso.org/ittf/PubliclyAvailableStandards/index.html](https://standards.iso.org/ittf/PubliclyAvailableStandards/index.html)

ISO/IEC 29500-1:2016 文档地址  [https://standards.iso.org/ittf/PubliclyAvailableStandards/c071691_ISO_IEC_29500-1_2016.zip](https://standards.iso.org/ittf/PubliclyAvailableStandards/c071691_ISO_IEC_29500-1_2016.zip)

Office DocumentFormat.OpenXml.Spreadsheet/Row [https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.row?view=openxml-2.8.1](https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.row?view=openxml-2.8.1)