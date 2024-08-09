---
title: OOXML：Excel(xlsx)是什么
emoji: 📊
tags: 
  - OOXML
  - Excel
created: 2021-05-07T20:16:50.000Z
modified: 2021-05-10T21:50:50.000Z
---

## 背景

现在(2020年)在线的文档预览和编辑的产品越来越多，国内各大互联网公司都相继退出了自己的协同文档编辑产品，这让我对日常办公用到的电子文档格式产生了好奇，无论是xlsx，pptx还是docx，都是微软office的格式，那么其他的产品（比如WPS）又是怎么实现这些文档的预览和编辑呢？查阅了资料，让我找到了一个看似不相干的”新“名词——OOXML。

> Office Open XML，也称为OpenXML或OOXML，是用于办公室文档的基于XML的格式，包括文字处理文档，电子表格，演示文稿以及图表，图表，形状和其他图形材料。

简单来说，OOXML是一个基于XML的文档格式标准，最早是微软Office2007的产品开发技术规范，先是成为 Ecma(ECMA-376) 的标准，最后改进推广，成为了 ISO 和 IEC (as ISO/IEC 29500) 的国际文档格式标准。我们熟知的xlsx，pptx，docx都是基于OOXML实现的，所以，通过OOXML标准，我们能够在不依赖Office的情况下，在任何平台读写Office Word，PPT和Excel文件。

这篇文章是系列文章的第一篇，介绍Excel是什么，工作表表格(grid)的XML格式，以及Excel文件是怎么组织起来的。

## 系列文章指北

[Excel是什么](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-xlsx)

[详解Excel工作表(worksheet)](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-worksheet)

[详解Excel共享字符串(sharedStrings)](https://blog.insutanto.tech/code-notes/2021-05/ooxml/what-is-excel-sharedstrings)

Todo: 详解Excel绘图(drawing)

## Excel文档的包结构

OOXML是基于XML的文档格式标准，但是我们都知道，Excel文件是以xlsx为后缀的单个文件。这其实是因为（[http://officeopenxml.com/anatomyofOOXML-xlsx.php](http://officeopenxml.com/anatomyofOOXML-xlsx.php)）：

> SpreadsheetML或.xlsx文件是一个zip文件（一个包(package)），其中包含许多“组件”（通常是UTF-8或UTF-16编码）或XML文件。这个包可能包含图片等其他媒体文件。这个结构根据OOXML标准ECMA-376第2部分中概述的**开放包装约定(Open Packaging Conventions)**进行组织。
你可以通过简单地解压缩.xlsx文件来查看文件结构和组成SpreadsheetML文件的文件。

简单来说，一个Excel文档就是一个zip压缩文件，我们称呼一个Excel文档为一个"包"(package)，包里面不同的XML文件，我们通常称呼为”组件“。

这里我提供了一个示例Excel文件供大家参考。解压之后我们能够看到类似下面的目录结构，这就是我们Excel文件的目录构成了。

我标出了各个目录和文件在Excel文档中的含义，读完接下来的内容，你应该就能明白括号标注的内容，并且理解这些文件是什么，以及这些文件之间有什么联系了。

```xml
├── [Content_Types].xml (组件描述文件)
├── _rels (包的关联组件)
├── docProps (文档的属性)
│   ├── app.xml
│   ├── core.xml
│   └── custom.xml
└── xl 
    ├── _rels (工作簿组件的关联组件)
    │   └── workbook.xml.rels
    ├── charts (图表组件的目录)
    │   ├── _rels (图表组件的关联组件目录)
    │   │   ├── chart1.xml.rels (图表组件的关联组件)
    │   │   └── chart2.xml.rels
    │   ├── chart1.xml (表格组件)
    │   ├── chart2.xml (表格组件)
    │   ├── colors1.xml (颜色组件)
    │   ├── colors2.xml (颜色组件)
    │   ├── style1.xml (样式组件)
    │   └── style2.xml (样式组件)
    ├── drawings (绘图组件的目录)
    │   ├── _rels (绘图组件的关联组件目录)
    │   │   └── drawing1.xml.rels (绘图组件的关联组件)
    │   └── drawing1.xml
    ├── media (多媒体文件目录)
    │   └── image1.png
    ├── sharedStrings.xml (共享字符串组件)
    ├── styles.xml (样式组件)
    ├── tables (表格组件的目录)
    │   └── table1.xml (表格组件)
    ├── theme (主题组件的目录)
    │   └── theme1.xml (主题组件)
    ├── workbook.xml (工作簿组件)
    └── worksheets (工作表组件的目录)
        ├── _rels (工作表组件的关联组件目录)
        │   └── sheet1.xml.rels (工作表组件的关联组件)
        └── sheet1.xml (工作表组件)
```

## Excel文档的组织形式

Excel文档的包中包含了很多组件，最重要的可以分成：

1. Content Types
2. 主要内容(worksheet)
3. 关联(Relationships)

基本上理解了这三个东西，你就能明白了Excel包中的文件，是怎么组织起来，最后成为我们最后能看到的复杂Excel样式了。

### Content Types

> 每个包都必须在其根目录下有一个 [Content_Types] .xml 文件。该文件包含了包中组件的所有内容类型的列表。每个组件及其类型都必须在[Content_Types] .xml中列出。 以下是主要内容部分的内容类型：
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
在向包中添加新组件时，请一定记得这里，很重要。

下面是示例Excel文件中的 [Content_Types] .xml ，ContentType描述了各个组件的文档类型，PartName描述了组件在包内的名称(对于部分组件来说，也是XML文件的路径)：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="png" ContentType="image/png" />
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
    <Default Extension="xml" ContentType="application/xml" />
    <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" />
    <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
    <Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml" />
    <Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml" />
    <Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml" />
    <Override PartName="/xl/charts/colors1.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml" />
    <Override PartName="/xl/charts/colors2.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml" />
    <Override PartName="/xl/charts/style1.xml" ContentType="application/vnd.ms-office.chartstyle+xml" />
    <Override PartName="/xl/charts/style2.xml" ContentType="application/vnd.ms-office.chartstyle+xml" />
    <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml" />
    <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml" />
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" />
    <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml" />
    <Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml" />
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
</Types>
```

### 主要内容(worksheet)

> SpreadsheetML文档是一个包含许多不同组件（主要是XML文件）的包。
但是，大多数实际的内容都在一个或多个工作表(worksheet)组件（每个工作表(worksheet)一个）和一个共享字符串(sharedStrings)组件。 以Microsoft Excel为例，其内容位于xl文件夹中，而工作表(worksheet)位于worksheet子文件夹中。

> 工作簿(workbook)组件不包含实际内容，而仅包含电子表格的某些属性，并引用了一个个包含数据的工作表(worksheet)组件。
一个工作表组件可以是一个表格(grid)，图表(chart)或者对话框表(dialog sheet)。

工作表(worksheet)组件内容(xl/worksheets/sheet1.xml): 

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

因为太长，只截取部分共享字符串(sharedStrings)组件内容（xl/sharedStrings.xml）：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="36" uniqueCount="36">
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

而这些工作表(worksheet)本身只存储工作表自身行列的属性和数据，其他与工作表相关的内容，它会通过引用其他类型的组件来实现，比如Excel图表，多媒体文件等等，这些要通过**关联(Relationships)组件**，读取对应的数据。接下来我们来说说关联。

### 关联(Relationships)

> 每个包都包含一个关联(Relationships)组件，该关联部件定义了其他组件之间以及与包外部资源之间的关联。这样可以将关系与内容分开，并且可以轻松更改关联，而无需更改引用目标的来源。

OOXML使用这种组织的方式，可以将组件和组件之间解耦，而在实现读写逻辑时，我们可以从中获取极大的便利。比如我们需要修改某个Excel组件时，可以不修改引用他的组件，只需要修改这个组件本身，而不是组件包含在整个XML文件中，然后修改整个XML文件。比如我们只需要读取工作表数据时，可以不读其他组件的XML数据，提高程序效率。

我们在好几个包(package)下都能看到一个 _rels 目录，这个目录就是Excel文档的关联组件了，一般这个关联组件的目录下会有一个或多个 .rels 后缀的文件，文件基于XML格式描述资源之间的关系。组件之间使用**关联**将Excel文档组织起来。

以示例文件举例 xl/_rels 下的 workbook.xml.rels :

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings"
                  Target="sharedStrings.xml"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
                  Target="styles.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
                  Target="theme/theme1.xml"/>
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
                  Target="worksheets/sheet1.xml"/>
</Relationships>
```

文件里面，我们看到了关联的资源ID(Id)和资源路径(Target)的对应，以及关联的类型(Type)。

然后我们看看工作簿(xl/workbook.xml)的内容：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <fileVersion appName="xl" lastEdited="3" lowestEdited="5" rupBuild="9302"/>
    <workbookPr/>
    <bookViews>
        <workbookView windowWidth="21500" windowHeight="13180"/>
    </bookViews>
    <sheets>
        <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
    </sheets>
    <calcPr calcId="144525" concurrentCalc="0"/>
</workbook>
```

工作簿(workbook)怎么通过工作簿的关联组件(xl/_rel/workbook.xml.rels)来获取需要的工作表(sheet)组件？看关联组件的数据，我们发现，只需要找到关联ID为rId1的sheet组件的路径(Target)，然后再读取路径下的文件，工作簿就能获取到对应工作表组件的数据。

我们截取工作表组件(xl/worksheets/sheet1.xml)的部分xml内容，来看工作表又是怎么通过**关联**来进一步描述工作表的内容：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
           xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
           xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"
           xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
......
    <drawing r:id="rId1"/>
    <!-- 图表和多媒体的显示，都通过引用绘图(drawing)组件来实现 -->
    <tableParts count="1">
        <tablePart r:id="rId2"/>
        <!-- 表格(table)组件：用于查找特定的表定义组件 -->
    </tableParts>
</worksheet>
```

XML文件中drawing和tablePart的 r:Id 属性，告诉我们，这里工作表组件需要从关联组件中寻找绘图组件和表格组件。然后我们继续看工作表组件的**关联组件 (xl/worksheet/_rel/sheet1.xml.rels)**：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml" />
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml" />
</Relationships>
```

我们发现，工作表只要通过自己的关联组件，就能找到需要的其他组件了。

### 小结

我们使用 Content Type 文件登记Excel文档的组件信息，然后通过关联组件，将工作簿组件，工作表组件和绘图、表格等其他组件组合在一起，最终将Excel文档组织起来。

## 总结

OOXML是很复杂的，Excel文档的实现也是很复杂的，这篇文章仅作为学习参考，后面有可能的话，会增加更多Excel文档底层实现的内容。如果想要更多的了解OOXML和Excel文档，可以查阅下面的参考资料。

## 参考资料

officeopenxml.com [http://officeopenxml.com/](http://officeopenxml.com/)

officeopenxml.com介绍xlsx [http://officeopenxml.com/anatomyofOOXML-xlsx.php](http://officeopenxml.com/anatomyofOOXML-xlsx.php)

officeopenxml.com介绍xlsx(Spreadsheet)内容概述 [http://officeopenxml.com/SScontentOverview.php](http://officeopenxml.com/SScontentOverview.php)

OOXML维基百科 [https://en.wikipedia.org/wiki/Office_Open_XML](https://en.wikipedia.org/wiki/Office_Open_XML)

ISO/IEC 29500-1:2016 说明  [https://www.iso.org/standard/71691.html](https://www.iso.org/standard/71691.html)

ISO/IEC 国际标准文档列表 [https://standards.iso.org/ittf/PubliclyAvailableStandards/index.html](https://standards.iso.org/ittf/PubliclyAvailableStandards/index.html)

ISO/IEC 29500-1:2016 文档地址  [https://standards.iso.org/ittf/PubliclyAvailableStandards/c071691_ISO_IEC_29500-1_2016.zip](https://standards.iso.org/ittf/PubliclyAvailableStandards/c071691_ISO_IEC_29500-1_2016.zip)

Office DocumentFormat.OpenXml.Spreadsheet/Row [https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.row?view=openxml-2.8.1](https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.row?view=openxml-2.8.1)