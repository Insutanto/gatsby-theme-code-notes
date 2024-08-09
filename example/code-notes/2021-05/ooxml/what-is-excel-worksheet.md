---
title: OOXML：详解Excel工作表(worksheet)
emoji: 📊
tags: 
  - OOXML
  - Excel
created: 2021-05-10T20:16:50.000Z
modified: 2021-05-12T21:50:50.000Z
---

## 背景

这篇文章是系列文章的第二篇，介绍Excel工作表(worksheet)是什么，工作表的主要数据的XML格式，以及工作表是怎么和其他组件组成我们常见的Excel表格。

## 系列文章指北

[Excel是什么](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-xlsx)

[详解Excel工作表(worksheet)](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-worksheet)

[详解Excel共享字符串(sharedStrings)](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-sharedstrings)

Todo: 详解Excel绘图(drawing)

## Excel工作表(worksheet)是什么

工作表(sheet)是Excel包中的一个组件，我们在WPS或者Office中，打开一个Excel文件，对应的是工作簿(workbook)，而一个工作簿是由一个或多个工作表(sheet)组成，工作表(sheet)就是我们看到的主体部分了。

> 工作表(sheet)是工作簿中的中央结构，是用户执行其电子表格大部分工作的地方。工作表(sheet)最常见的类型是工作表(worksheet)，它表示为单元格网格。工作表(worksheet)单元格可以包含文本，数字，日期和公式。单元格也可以格式化。工作簿通常包含多个工作表。为了帮助数据分析和做出明智的决策，电子表格应用程序通常会实现有助于计算，分类，过滤，组织和以图形方式显示信息的功能和对象。

我们主要讲工作表(worksheet)的结构，因为这是最广泛的sheet。用户操作Excel最终都反应在工作表上，有些操作是直接修改了工作表里行列的数据，有些则和行列数据无关，属于浮动在工作表上的内容（比如绘图(drawing)组件，我们常见的图片和各种图表）。这里我们只讲讲工作表的行列数据，至于绘图(drawing)组件，后续会有单独的介绍。

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
           xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
           xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"
           xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
    <sheetPr/>
    <dimension ref="A1:F13"/> <!-- 表格的范围 -->
    <sheetViews>
        <sheetView tabSelected="1" workbookViewId="0">
            <selection activeCell="C14" sqref="C14"/> <!-- activeCell的位置 -->
        </sheetView>
    </sheetViews>
		<!-- 表格的默认cell配置 -->
    <sheetFormatPr defaultColWidth="9" defaultRowHeight="14" outlineLevelCol="5"/>
    <cols> <!-- 列属性 -->
        <col min="1" max="1" width="4.5625" customWidth="1"/>
        <col min="2" max="2" width="10.9296875" customWidth="1"/>
        <col min="3" max="3" width="10.546875" customWidth="1"/>
        <col min="4" max="4" width="11.71875" customWidth="1"/>
        <col min="6" max="6" width="4.5546875" customWidth="1"/>
    </cols>
    <sheetData>
        <row r="1" ht="40" customHeight="1" spans="1:6">
        <!-- r:行号, ht:行高(单位pt), customHeight:是否自定义行高, span:跨度, s:样式(style)索引, customFormat:是否行自定义格式 -->
            <c r="A1" s="2" t="s">
            <!-- r:单元格编号, s:样式(style)索引, t:单元格类型 -->
                <v>0</v><!-- 字符串在共享字符串组件中的索引 -->
            </c>
            <c r="B1" s="3"/>
            <c r="C1" s="3"/>
            <c r="D1" s="3"/>
            <c r="E1" s="3"/>
            <c r="F1" s="3"/>
        </row>
        <row r="2" s="1" customFormat="1" ht="22" customHeight="1" spans="1:6">
            <c r="A2" s="4" t="s">
                <v>1</v>
            </c>
            <c r="B2" s="4" t="s">
                <v>2</v>
            </c>
            <c r="C2" s="4" t="s">
                <v>3</v>
            </c>
            <c r="D2" s="4" t="s">
                <v>4</v>
            </c>
            <c r="E2" s="9" t="s">
                <v>5</v>
            </c>
            <c r="F2" s="9"/>
        </row>
......
    </sheetData>
    <mergeCells count="9">
        <mergeCell ref="A1:F1"/>
        <mergeCell ref="E2:F2"/>
......
    </mergeCells>
    <pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.511805555555556" footer="0.511805555555556"/>
    <!-- 页面边距配置，单位英寸(in) -->
    <headerFooter/>
    <drawing r:id="rId1"/>
    <!-- 图表和多媒体的显示，都通过引用绘图(drawing)组件来实现 -->
    <tableParts count="1">
        <tablePart r:id="rId2"/>
        <!-- 表格(table)组件：用于查找特定的表定义组件 -->
    </tableParts>
</worksheet>
```

## 工作表(worksheet)的行列数据

**以下提到的文档均为：ISO/IEC 29500-1:2016** 

### sheetFormatPr

```xml
<sheetFormatPr defaultColWidth="9" defaultRowHeight="14" outlineLevelCol="5"/>
```

`sheetFormatPr` 是工作表格式配置，我们这里看到的`defaultColWidth`是默认列宽度，`defaultRowHeight`是默认行高，以及`outlineLevelCol`表示Excel outline的层数([outline功能参考](https://support.microsoft.com/en-us/office/outline-group-data-in-a-worksheet-08ce98c4-0063-4d42-8ac7-8278c49e9aff))。

其他属性类型可以参考文档的 18.3.1.81 sheetFormatPr (Sheet Format Properties)。

### cols

示例参考文档的 18.3.1.17 cols (Column Information) :

```xml
<cols>
  <col min="4" max="4" width="12" bestFit="1" customWidth="1"/>
  <col min="5" max="5" width="9.140625" style="3"/>
</cols>
```

`cols`中标出了对应的列号(`min, max`)，列宽(`width`)，是否自适应列宽(`bestFit`)，是否自定义宽度(`customWidth`)，已经样式索引(`style`)。

### sheetData(row)

```xml
<row r="2" s="1" customFormat="1" ht="22" customHeight="1" spans="1:6">
.......
</row>
```

`sheetData`里的每个`row` 有以下属性:

`r`:行号,  `ht`:行高(单位pt)， `customHeight`:是否自定义行高， `span`:列的跨度， `s`:样式(style)索引，`customFormat`:是否行自定义格式。

### sheetData(c(cell的缩写))

```xml
<c r="A1" s="2" t="s">
<!-- r:单元格编号, s:样式(style)索引, t:单元格类型 -->
    <v>0</v><!-- 字符串在共享字符串组件中的索引 -->
</c>
```

`sheetData`里的每个`row`下，由不同的单元格(cell)填充，这里的例子，单元格只有三个属性：

`r` (Reference): 索引，`s` (Style Index): 样式索引，`t` (Cell Data Type): 单元格数据类型，`v` (Cell Value): 单元格数据。

注意，这里的单元格是字符串类型，所以值代表的是共享字符串(sharedStrings)的索引，而不是字符串本身。

完整请参考文档：18.3.1.4 c (Cell)

### mergeCells 和 mergeCell

```xml
<mergeCells count="9">
  <mergeCell ref="A1:F1"/>
  <mergeCell ref="E2:F2"/>
......
</mergeCells>
```

mergeCells是合并单元格的集合，只有一个属性`count`，表示工作表中合并单元格的数量。

mergeCell是一个合并单元格，属性中的 `ref` (Refrence) 表示的是合并单元格的索引，类型是字符串，表示的是一整块单元格区域。

### 联系其他组件

这里介绍一些和工作表相关的组件，组件之间的联系，是通过联系组件实现的，如果不了解工作表组件是怎么与其他组件联系，请参考系列文章第一篇[Excel是什么](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-xlsx)的相关内容。

**样式(style)组件：**

样式组件中，存储的是工作表单元格的格式设置数据。是可以按照顺序索引的列表形势。

下面是示例Excel文件中样式表出现的样式类型，感兴趣的可以参考文档了解，限于篇幅这里不做过多介绍：

18.8.31 numFmts (Number Formats)

18.8.23 fonts (Fonts)

18.8.21 fills (Fills)

18.8.5 borders (Borders)

18.8.9 cellStyleXfs (Formatting Records)

18.8.10 cellXfs (Cell Formats)

18.8.8 cellStyles (Cell Styles)

18.8.42 tableStyles (Table Styles)

我们要注意的是，**并非所有影响单元格样式的设置都在样式组件中，工作簿的主题组件设置，也会影响单元格样式**。

下面是示例Excel文件中的样式表(xl/styles.xml):

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <numFmts count="4">
        <numFmt numFmtId="44"
                formatCode="_(&quot;$&quot;* #,##0.00_);_(&quot;$&quot;* \(#,##0.00\);_(&quot;$&quot;* &quot;-&quot;??_);_(@_)"/>
        <numFmt numFmtId="176" formatCode="_ * #,##0_ ;_ * \-#,##0_ ;_ * &quot;-&quot;_ ;_ @_ "/>
        <numFmt numFmtId="177" formatCode="_ * #,##0.00_ ;_ * \-#,##0.00_ ;_ * &quot;-&quot;??_ ;_ @_ "/>
        <numFmt numFmtId="42"
                formatCode="_(&quot;$&quot;* #,##0_);_(&quot;$&quot;* \(#,##0\);_(&quot;$&quot;* &quot;-&quot;_);_(@_)"/>
    </numFmts>

    <fonts count="24">
        <font>
            <sz val="11"/>
            <color theme="1"/>
            <name val="Calibri"/>
            <charset val="134"/>
            <scheme val="minor"/>
        </font>
        <font>
            <b/>
            <sz val="11"/>
            <color theme="1"/>
            <name val="Calibri"/>
            <charset val="134"/>
            <scheme val="minor"/>
        </font>
......
    </fonts>
    <fills count="34">
        <fill>
            <patternFill patternType="none"/>
        </fill>
        <fill>
            <patternFill patternType="gray125"/>
        </fill>
        <fill>
            <patternFill patternType="solid">
                <fgColor theme="0" tint="-0.15"/>
                <bgColor indexed="64"/>
            </patternFill>
        </fill>
......
    </fills>
</styleSheet>
```

**共享字符串(sharedStrings)组件：**

共享字符串是工作簿级别的组件，所有的工作表都依赖共享字符串表里的数据。

参考文档 18.4 Shared String Table：

> 字符串值可以直接存储在电子表格单元格元素中（第18.3.1.4节）；但是，将相同的值存储在多个单元格元素中可能会导致工作表组件非常大，从而可能导致性能下降。共享字符串表是在工作簿中共享的字符串值的索引列表，该列表允许实现仅将值存储一次。

下面是示例Excel文件中的共享字符串表(xl/sharedStrings.xml)：

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
    <si>
        <t>C1</t>
    </si>
    <si>
        <t>D1</t>
    </si>
......
</sst>
```

**主题(theme)组件：**

> DrawingML是跨OOXML文档类型的共享语言。 当电子表格使用主题时，它包括主题组件，该主题组件包含在SpreadsheetML文档中。 主题组件包含有关文档主题的信息，例如，配色方案，字体和格式方案。

#Parts Specific to SpreadsheetML Documents [http://officeopenxml.com/anatomyofOOXML-xlsx.php](http://officeopenxml.com/anatomyofOOXML-xlsx.php)

详细可以参考文档 14.2.7 Theme Part：

> 此组件类型的实例包含关于文档主题的信息，主题是颜色方案，字体方案和格式方案（后者也称为效果）的组合。……对于SpreadsheetML文档，主题的选择会影响单元格内容和图表的颜色和样式等。 ……

通过Office Excel设置主题的方式([https://support.microsoft.com/en-us/topic/change-a-theme-and-make-it-the-default-in-word-or-excel-c846f997-968e-4daa-b2d4-42bd2afef904](https://support.microsoft.com/en-us/topic/change-a-theme-and-make-it-the-default-in-word-or-excel-c846f997-968e-4daa-b2d4-42bd2afef904))

主题组件属于DrawingML，是跨OOXML文档的，这里不做展开了。

## 总结

这篇文章仅作为学习Excel工作表的参考，工作表的结构比较简单，还是比较容易理解的，下一篇将介绍“坑”比较多的共享字符串组件。而如果想要更多的了解工作表，可以查阅下面的参考资料。

## 参考资料

officeopenxml.com [http://officeopenxml.com/](http://officeopenxml.com/)

officeopenxml.com介绍xlsx [http://officeopenxml.com/anatomyofOOXML-xlsx.php](http://officeopenxml.com/anatomyofOOXML-xlsx.php)

officeopenxml.com介绍xlsx(Spreadsheet)内容概述 [http://officeopenxml.com/SScontentOverview.php](http://officeopenxml.com/SScontentOverview.php)

OOXML维基百科 [https://en.wikipedia.org/wiki/Office_Open_XML](https://en.wikipedia.org/wiki/Office_Open_XML)

ISO/IEC 29500-1:2016 说明  [https://www.iso.org/standard/71691.html](https://www.iso.org/standard/71691.html)

ISO/IEC 国际标准文档列表 [https://standards.iso.org/ittf/PubliclyAvailableStandards/index.html](https://standards.iso.org/ittf/PubliclyAvailableStandards/index.html)

ISO/IEC 29500-1:2016 文档地址  [https://standards.iso.org/ittf/PubliclyAvailableStandards/c071691_ISO_IEC_29500-1_2016.zip](https://standards.iso.org/ittf/PubliclyAvailableStandards/c071691_ISO_IEC_29500-1_2016.zip)

Office DocumentFormat.OpenXml.Spreadsheet/Row [https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.row?view=openxml-2.8.1](https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.row?view=openxml-2.8.1)