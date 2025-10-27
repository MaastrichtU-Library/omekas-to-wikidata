# QuickStatements Documentation

**[← Back to Technical Documentation](../docs/DOCUMENTATION.md)**

Source: https://www.wikidata.org/wiki/Help:QuickStatements

_This is the documentation of QuickStatements V2. For QuickStatements 3.0, see [m:QuickStatements 3.0](https://meta.wikimedia.org/wiki/QuickStatements_3.0)._

## Overview

**QuickStatements** (**QS**) is a tool, written by Magnus Manske, that can edit Wikidata items based on a simple set of text commands. The tool can add and remove statements, labels, descriptions and aliases; as well as add statements with optional qualifiers and sources. The command sequence can be typed in the import window or created in a spreadsheet or text editor and pasted in. It can also be created by external code like Lua, called from a template and passed as a URL. Data edited in OpenRefine can also be exported to the QuickStatements format.

## The tools

The QuickStatements tool has gone through several iterations and rewrites. You should always use the [current version](https://quickstatements.toolforge.org) of this tool whenever possible. There are several QuickStatements versions available:
* **[QuickStatements version 2](https://quickstatements.toolforge.org)** (V2) rewrite or new interface (current version)
* **Release history**
  * [QuickStatements version 2](https://quickstatements.toolforge.org/index_old.html) (V2) original or old interface
  * [QuickStatements version 1](https://wikidata-todo.toolforge.org/quick_statements.php) (V1) (no longer works)

Syntax between versions can vary slightly. The rest of the document will describe the syntax of the current version, but will mark parts which were not supported in the earlier versions.

## Command sequence syntax

This section describes syntax used since V1 version of the tool, sometimes referred to as **V1 commands**.

### Add simple statement

You can specify the statements to add by typing/pasting into the tool's text area. Different parts of the statement are separated by a TAB or "|" characters. Each command is in a new line, or separated by "||" characters.

Hint: You can also use a spreadsheet software such as Microsoft Excel or LibreOffice Calc; copying/pasting the cells should automatically insert TABs. Also text editors like Notepad++ allow replacement of any symbol by the TAB character (\t).

Each statement _must_ consist of an entity, a property, and a value.
* An entity can be an item, a property, a lexeme, a form, or a sense.
* A value can be another entity, a string, a time, a location, or a quantity, depending on the property type, or one of the special values `somevalue` or `novalue` (see Unknown or no values).

Formatting of each part:
* **Items** on Wikidata are always in the form Qxx. On Commons they are always in the form Mxx.
  * Example: `Q4115189<TAB>P31<TAB>Q1`
  * Meaning: add to Q4115189 the statement P31=Q1
* **Properties** in the form Pxx.
* **Lexemes** in the form Lxxx.
* **Forms** in the form Lxxx-Fyy.
* **Senses** in the form Lxxx-Syy.
* **Strings** (including URLs, and numerical values of text fields, for example external-ID property values) _must_ be in "double quotes". Many statements take values in string format, including external identifiers (like P214), filenames (like P18) or other page names (like P373).
  * Example: `Q41576278<TAB>P373<TAB>"Antoni Ignacy Mietelski"`
  * Meaning: add to Q41576278 the statement P373="Antoni Ignacy Mietelski"
  * **Caution:** Some characters in the string seem to confuse the tool. Those include: "_" (underscore), " (double quote), " " (spaces), "=", and possibly more.
* **Monolingual text** prefix text in "double quotes" with the language and a colon, e.g. `en:"Some text"`
  * Example: `Q1214098<TAB>P1476<TAB>pl:"Krzy|acy"`
  * Meaning: add to Q1214098 the statement P1476="Krzy|acy" (Polish)
* **Time** values _must_ be in format eg `+1967-01-17T00:00:00Z/11`, where `/11` designates the precision. The precision is: 0 - billion years, 1 - hundred million years, ..., 6 - millennium, 7 - century, 8 - decade, **9 - year** (default), 10 - month, 11 - day, ~~12 - hour, 13 - minute, 14 - second~~.
  * Example: `Q41576483<TAB>P569<TAB>+1839-00-00T00:00:00Z/9`
  * Meaning: add to Q41576483 the statement P569=+1839
  * Use "+" for CE dates and "-" for BCE dates; and use at least 4 digits.
  * Set an additional "/J" if you want to set the date in Julian Calendar.
  * If submitting to the API, use "%09" instead of the TAB symbol, "%2B" instead of the "+" symbol, "%3A" instead of the ":" symbol, and "%2F" instead of the "/" symbol.
* **Location coordinates** in the form of `@LAT/LON`, with LAT and LON as decimal numbers.
  * Example: `Q3669835<TAB>P625<TAB>@43.26193/10.92708`
  * Meaning: add location to Q3669835
* **Quantity** in the form of `amount~toleranceUxx`, with amount and tolerance being a rational numbers and Uxx being the item number of a unit (Qxx). Unit and tolerance values are optional. Don't leave any spaces in the quantity definition.
  * QuickStatements version 1 used different syntax for Quantity: `amount[lower,upper]Uxx`, with amount, lower and upper being a rational numbers.
    * `lower`, `upper` are optional and _must_ be either both present or both absent. When present, they should be enclosed in square brackets and separated by `,`
    * `amount`, `lower` and `upper` _must_ use `.` as decimal separator, _must not_ use any thousands separator and _may_ be prefixed by "+" or "-".
    * `10`, `10U11573`, `-10[-12.5,-7.5]`, `0[-5,5]U11573` are all valid quantities (where U11573 indicates Q11573)
  * Quantities with tolerance _may_ be entered as `1.2~0.3` in QuickStatements version 2, which is the same as `1.2[0.9,1.5]` in QuickStatements version 1 and means 1.2�0.3.
* `somevalue` for unknown value
* `novalue` for no value. Both `novalue` and `somevalue` should be used without double quotes around it. Both of those statements do work as part of item creation statements using CREATE and LAST keywords.

### Add statement with qualifiers

Each statement "triplet" can be followed by an unlimited number of "qualifiers pairs" of property<TAB>value.

* Example: `Q41577083<TAB>P570<TAB>+1600-00-00T00:00:00Z/7<TAB>P1319<TAB>+1586-00-00T00:00:00Z/9`
* Meaning: add to Q41577083 the statement P570=16. century with qualifier P1319=+1586

### Add statement with sources

Each statement can be followed by an unlimited number of "source pairs" to add references of source property<TAB>value. The source property is identical to the "normal" property, except it uses the form Sxx instead of Pxx.

* Example: `Q22124656<TAB>P21<TAB>Q6581097<TAB>S143<TAB>Q24731821<TAB>S813<TAB>+2017-10-04T00:00:00Z/11`
* Meaning: add to Q22124656 the statement P21=Q6581097 with reference P143=Q24731821, P813=2017-10-04

By default, all sources will go into the same "reference group" (a block of property/value pairs). If you want to create more than one reference group in a single command row, simply prefix the first source property of the new group with an exclamation mark: "!Sxx" instead of "Sxx". (In the first reference group, the "!" is optional and will not influence the outcome.)

**Notes:**
* Existing statements with an exact match (property and value) will not be added again; however additional references might be added to the statement.
* You can mix qualifiers and references in the same statement. Just use Sxx instead of Pxx when using sources.
* In QuickStatements version 1 each source claim represented an individual reference, i.e. they were not grouped within one reference; it works properly now in QuickStatements version 2.

### Adding labels, aliases, descriptions and sitelinks

As with adding simple text statements, each command must consist of an item, a command, and a string in double quotes.
* To add a **label** in a specific language to an item, use "Lxx" instead of a property, with "xx" as the language code.
  * Example: `Q340122<TAB>Lpl<TAB>"Cyprian Kamil Norwid"`
  * Meaning: add Polish label "Cyprian Kamil Norwid" to Q340122
* To add an **alias** in a specific language to an item, use "Axx" instead of a property, with "xx" as the language code.
  * Example: `Q340122<TAB>Aen<TAB>"Cyprjan Kamil Norwid"`
  * Meaning: add English alias "Cyprjan Kamil Norwid" to Q340122
  * Tip: Multiple aliases can be added at the same time by separating them with the pipe character ("|"). Warning: This does not work when creating a new item.
  * Example: `Q340122<TAB>Aen<TAB>"Cyprian Kamil Norwid|Cypryan Kamil Norvid"`
* To add a **description** in a specific language to an item, use "Dxx" instead of a property, with "xx" as the language code.
  * Example: `Q340122<TAB>Dde<TAB>"polnischer Dichter"`
  * Meaning: add German description "polnischer Dichter" to Q340122
* To add a **sitelink** to a specific page on a site to an item, use "Sxxx" instead of a property, with "xxx" as the site (e.g. enwiki, commonswiki).
  * Example: `Q340122<TAB>Szhwiki<TAB>"^fﯷ�>�y"`
  * Meaning: add sitelink to Chinese Wikipedia to Q340122

If you want to remove a label/alias/description/sitelink, the value has to be an empty string and the rest of the command will be the same.

### Item creation

**Please ensure you do not create duplicate items!**

You can create new items by inserting a line consisting only of the word "CREATE". To add statements to the newly created item, use the word "LAST" instead of the Q number, and the statement will be added to the last created item.

An example for creating a new item, adding a sitelink, and setting a label:
```
CREATE
LAST<TAB>Sfrwiki<TAB>"Le croissant magnifique !"
LAST<TAB>Lfr<TAB>"Le croissant magnifique !"
```
Meaning: create a new item with a link to French Wikipedia and with French label "Le croissant magnifique!"

Properties may be created in the same way with "CREATE_PROPERTY" followed by a TAB or | and the entity type, e.g. one of:
`commonsMedia`, `globe-coordinate`, `wikibase-item`, `wikibase-property`, `string`, `monolingualtext`, `external-id`, `quantity`, `time`, `url`, `math`, `geo-shape`, `musical-notation`, `tabular-data`, `wikibase-lexeme`, `wikibase-form`, `wikibase-sense`.

This is mostly of use on third-party Wikibase instances, as property creation is restricted on Wikidata.

### Item merging

You can merge two items. The newer item will be merged and (if successful) redirected into the older item.

`MERGE<TAB>Q1<TAB>Q2`

### Removing statements

You can remove specific statements by prefixing a line with "-".
* Example: `-Q4115189<TAB>P31<TAB>Q1`
* Meaning: remove from Q4115189 the statement P31=Q1

Dates with precision>9 can be removed via their specific date:
```
-Q98426308    P585    +1988-05-11T00:00:00Z/11
```

Dates with precisiond9 may use either 00-00 or 01-01 as their month-date value, so it may be necessary to attempt to remove both:
```
-Q98426308    P585    +1988-01-01T00:00:00Z/9
-Q98426308    P585    +1988-00-00T00:00:00Z/9
```

In addition you may remove statements with a specific statement ID using the following syntax:
`-STATEMENT<TAB>Q1$00000000-0000-0000-0000-000000000000`

The statement ID can be received by:
* The source code of any entity page, where the ID may be found in the `<div>` elements with "wikibase-statementview" class
* API
* name of statement node in RDF which may be queried by query service (you need to replace the - after entity ID with $)

### Comments

Every command can have a comment at its end, which will be inserted into the edit summary for the command. Use the `/* ... */` syntax. ~~Before this a TAB _may_ be inserted.~~ Spaces around the comment will be removed before processing. The tool splits adding of a claim and its reference in two edits. When using the "version 1 format" import it seems not to be possible to add a comment for the edit adding the reference. The comment is added to the edit adding the claim (if the claim does not exist yet and is added at all).
* Example: `Q4115189<TAB>P31<TAB>Q1 /* This is a comment. */`
* Meaning: add to Q4115189 the statement P31=Q1, with "This is a comment." in the edit summary.

## CSV file syntax

### Commands

In QuickStatements version 2, one can also cut and paste a properly structured CSV file as an alternative to the syntax introduced in QuickStatements version 1. The file will specify commands (columns) to execute and their data (rows). The first line is a header row describing how the data in each column is to be interpreted.

For example, a column called P31 could contain the value Q5 to create a statement with property P31 and value Q5.

For some reason, _string values_ need to be put in """triple double quotations""".

**qid**: Always the first column of commands: the values in the column should contain the id of the item or entity to edit. If the cell is left empty, a new item will be created. See the item creation sample below.

The other columns may specify the following commands:

**P1234**: A property ID (uppercase) begins a new statement. The column value specifies the main value of the statement, in the same format as in QuickStatements version 1.

**qal1234**: A lowercase "qal" followed by a property number (without "P") adds a qualifier to the current statement. The column value specifies the value of the qualifier, in QuickStatements version 1 syntax. There must be some "P" column before a "qal" column to specify which statement the qualifier is added to.

**S1234**: An uppercase "S" followed by a property number (without "P") begins a new source for the current statement. The column value specifies the value of the source, in QuickStatements version 1 syntax. There must be some "P" column before an "S" column to specify which statement the source is added to.

**s1234**: A lowercase "s" followed by a property number (without "P") adds another property-value pair to the current source. The column value specifies the value of the source, in QuickStatements version 1 syntax. There must be some "S" column before an "s" column to specify which source the property-value pair is added to.

**Len**: An uppercase "L" followed by a language code sets the label in that language.

**Dfr**: An uppercase "D" followed by a language code sets the description in that language.

**Ade**: An uppercase "A" followed by a language code adds an alias in that language.

**Senwiki**: An uppercase "S" followed by a site ID adds a sitelink to that site.

**#**: A number sign character sets the edit summary (comment) of the preceding command. The tool splits adding of a claim and its reference in two edits. A comment can be added to the edit summary of each of them. For the claim by putting a "#" column between the columns for the claim and its reference, for the reference by putting a "#" column behind its columns. For example:
```
qid,P21,#,S143,s813,#
Q22124656,Q6581097,comment to claim adding edit,Q24731821,+2017-10-04T00:00:00Z/11,comment to reference adding edit
```

### Item creation

To create a new item, the first element of the row needs to be empty, so the line starts with a `,`.

For example:
```
qid,Len,Den,P31
,Regina Phalange,fictional character,Q95074
```

creates a new item. Suitable for LibreOffice (paste in cell A1)

| filename | label | description | qid,P31,Len,Den,P18 |
|----------|-------|-------------|--------------------|
| Mona Lisa - the Louvre.jpg | Mona Lisa | painting by Leonardo da Vinci | =`,Q3305213,"""&B2&""","""&C2&""",""""""&A2&"""""""` |
| Mona Lisa - the Louvre.jpg | Mona Lisa | painting by Leonardo da Vinci | `,Q3305213,"Mona Lisa","painting by Leonardo da Vinci","""Mona Lisa - the Louvre.jpg"""` |

### Statement removal commands

Statement column headers may also begin with "-" to remove the statement. (Note that this is only valid in the header for the whole column, not in individual values.) Removing other column types is not yet supported and will result in an error when the command is run; however, sitelinks and labels can be removed by setting them to the empty string (without "-" in the column header).

| qid,P31,-P31 |
|-------------|
| Q4115189,Q5,Q5 |

Adds to the sandbox item Q4115189 a P31 value of Q5 and then removes that same statement again.

### Commas and double quotes

**Labels, descriptions, aliases and sitelinks** do not need to be in double quotes unless they themselves contain commas (,) or double quotes (").

In this case, replace all double quotes with two double quotes (e.g. Toys "R" Us � Toys ""R"" Us) and then wrap the string in a pair of double quotes (e.g. "Toys ""R"" Us").

Samples: Toys "R" Us and Patterns, Predictors, and Outcome

| qid,Len |
|---------|
| Q4115189,"Toys ""R"" Us" |
| Q4115189,"Patterns, Predictors, and Outcome" |

To add a **string value** containing double quotes ("), replace all double quotes with two double quotes ("").

As any string value, then wrap it in three double quotes ("""), e.g. """Toys ""R"" Us""".

Samples for Q4115189#P370, notably `Toys "R" Us`

| qid,P370 |
|---------|
| Q4115189,"""Toys ""R"" Us""" |
| Q4115189,"""Patterns, Predictors, and Outcome""" |
| Q4115189,"""Wikidata sandbox item 1""" |

### Combined sample

| qid,Len,Den,Aen,P31,-P31,P21,P735,qal1545,S248,s214,S143,Senwiki |
|-------------------------------------------------------------------|
| Q4115189,Douglas Adams,author,Douglas No�l Adams,Q5,Q36180,Q6581097,Q463035,"""1""",Q54919,"""113230702""",Q328,Douglas Adams |
| Q4115189,"Toys ""R"" Us",testin sample,Toys R Us,Q5,Q36180,Q6581097,Q463035,"""1""",Q54919,"""113230702""",Q328,"Toys ""R"" Us" |

### Samples by value type

Samples use the sandbox item (Q4115189) and can be pasted directly into QuickStatements for testing. Should be risk-free.

**Label**

| qid,Len |
|---------|
| Q4115189,Sandbox |
| Q4115189,"Patterns, Predictors, and Outcome" |
| Q4115189,"Toys ""R"" Us" |

**Description**

| qid,Den |
|---------|
| Q4115189,Wikidata item for tests |
| Q4115189,"sample for Patterns, Predictors, and Outcome" |
| Q4115189,"description sample for Toys ""R"" Us" |

**Alias**

| qid,Aen |
|---------|
| Q4115189,Wikidata sandbox |
| Q4115189,"Predictors, Patterns, and Outcome" |
| Q4115189,"Toys ""4"" You" |

**Item**

| qid,P369 |
|---------|
| Q4115189,Q5 |
| Q4115189,somevalue |
| Q4115189,novalue |
| L123,Q5 |
| L123-S1,Q5 |
| L123-F1,Q5 |

`somevalue` is for unknown value, `novalue` for no value. F1 and S1 on Lexeme:L123 would have to exist for it to work.

**String or external identifiers (external-id)**

| qid,P370 |
|---------|
| Q4115189,"""Sandbox""" |
| Q4115189,"""Patterns, Predictors, and Outcome""" |
| Q4115189,"""Toys ""R"" Us""" |

**Monolingual text**

| qid,P1450 |
|---------|
| Q4115189,en:"Sandbox" |
| Q4115189,en:"Toys "R" Us" |
| Q4115189,"en:""Toys ""R"" Us""" |
| Q4115189,"en:""Patterns, Predictors, and Outcome""" |

`en` is for English

**Date/time**

| qid,P577 |
|---------|
| Q4115189,+1856-01-01T00:00:00Z/9 |
| Q4115189,+1856-01-01T00:00:00Z/10 |
| Q4115189,+1856-01-01T00:00:00Z/11 |

Precisions are 9=year, 10=month, 11=day, so the dates are 1856, January 1856 and 1 January 1856.

**Image/Commons media file**

| qid,P18 |
|---------|
| Q4115189,"""Frans Breydel - A merry company.jpg""" |
| Q4115189,"""'Girl Reading' by Mary Colman Wheeler, El Paso Museum of Art.JPG""" |
| Q4115189,"""Kaubalaeva ""E. Russ"" vrakk.jpg""" |
| Q4115189,"""''L'empereur Napoleon III'' de Franz-Xaver Winterhalter.jpg""" |

Images are:
* File:Frans Breydel - A merry company.jpg
* File:'Girl Reading' by Mary Colman Wheeler, El Paso Museum of Art.JPG (includes a single quote and a comma)
* File:Kaubalaeva "E. Russ" vrakk.jpg (includes double quotes)
* File:''L'empereur Napoleon III'' de Franz-Xaver Winterhalter.jpg

**URL**

| qid,P856 |
|---------|
| Q4115189,"""https://example.com/""" |
| Q4115189,"""https://example.com/equalsign=test""" |
| Q4115189,"""https://example.com/underscore_test""" |

**Coordinates**

| qid,P625 |
|---------|
| Q4115189,@43.26193/10.92708 |

**Quantity**

| qid,P1114 |
|---------|
| Q4115189,10 |
| Q4115189,+20 |
| Q4115189,+3.1415926 |
| Q4115189,-40 |
| Q4115189,5.5U11574 |
| Q4115189,+60U11573 |
| Q4115189,+7.5U11574 |
| Q4115189,-80~1.5 |
| Q4115189,2.2~0.3 |
| Q4115189,+1.2~0.3 |

`U11573` is for Q11573 (metre), `U11574` for Q11574 (second). Note the odd result of `1.2~0.3`.

### Full example

Full examples can be found at Help:QuickStatements/examples.

## Running QuickStatements

### Using QuickStatements version 2

Here is how to use QuickStatements (version 2) in basic mode:

1. Go to https://quickstatements.toolforge.org
2. Make sure you are logged into OAuth and your name is visible in the upper-right corner. If not, then log in.
3. Click "New batch".
4. For working with Wikimedia Commons Structured Data:
   1. Look for the pull-down menu _Create new command batch for ..._ and change project from _Wikidata_ to _Commons [Batch mode only!]_
   2. You need "M" ids to work on instead of "Q" numbers. Look up the media identifiers for Commons files with the [Minefield tool](https://hay.toolforge.org/minefield/)
   3. Use statements in the form of "MXXXX|PXX|QXXX" or use the CSV format option
   4. Initiate the query with the "Run" or "Run in the background" button to run it in the _batch mode_
5. Cut and paste your commands. See the syntax in the section above.
6. When you are done, click "Import V1 commands" or "Import CSV commands".
7. The tool will convert your commands into human-readable form. Inspect them and click "Run" or "Run in the background" to execute
8. As your commands are being processed, double-check the results, and press "STOP" if you detect a problem.
9. The user interface will tell you when all commands have been processed.

### Using QuickStatements version 1

QuickStatements version 1 is still available, but no longer maintained. It has stopped working for some users, but still works fine for others.
1. Go to https://wikidata-todo.toolforge.org/quick_statements.php
2. Cut and paste your commands into the window
3. Click "Do it"
4. The user interface will tell you when all statements have been processed.

### Using QuickStatements version 2 in batch mode

**Warning:** As of May 2020, duplicated items may be created in batch mode. Please make sure you can find and merge them! This does not affect frontend mode.

#### When to use batch mode?

Batch mode (also known as running in the background or asynchronous batch mode) means your statements are executed from a Wikimedia server, rather than from your Web browser. This has several advantages:
* Even if you close your browser or if your computer crashes, the statements will be executed until the last one.
* You can launch several batches in parallel, without slowing down your computer. (The batches seem to be run sequentially)
* You get a unique URL for your batch, to which you can refer later. This page shows some statistics about your run.
* To see all your recent batches click "Your last batch". To see everybody else's recent batches click "Last batches"
* You or a project admin can stop your batch by going to its URL. For instance, if it is realized that the batch is erroneous and you are offline, an admin can stop it immediately (by going to the individual batch page), rather than having to block you.
* If you discover that something went wrong, you can revert the whole batch afterwards

**But there are also drawbacks:**
* It takes a few more clicks, so as a rule of thumb, if you only have 10 or fewer statements, it's better to run them in normal mode.
* Depending on how busy the server is it might take time for your batch to start so that checking the results might not be possible immediately.
* There is a limit on the number of statements in a batch, and batches with more statements do not load properly (showing blank page and revolving circle). For simpler statements, the maximum seems to be around 25 thousand statements per batch, but it is much smaller for more complex statements.
* Batch mode seems to work well for simple statements without qualifiers or references, but more complex statements (where, for example, the successful addition of a qualifier depends on the base statement being already present), there seems to be a much higher error rate.

Before running a batch, it can be a good idea to run a few commands directly in non-batch mode to get a good view of what is being done.

#### Using batch mode

1. Prepare your statement normally as described in the Using QuickStatements version 2 section above
2. Instead of pressing "Run", press the "Run in background" button.
3. "Your last batches" will show a list of the most recent batches run by you, with statistics.

The following statistical values are available:
* DONE: The number of statements that were successfully run
* ERROR: The number of statements that failed
* INIT: The number of statements left to run
* RUN: The number of statements being run right now

### Running QuickStatements by URL

An alternative way of communicating with QuickStatements is to use a URL instead of cutting and pasting commands into the import window. For example, a command to add to Q37887397 the statement P214="96480189" with source P143=Q565 is
`Q37887397<TAB>P214<TAB>"96480189"<TAB>S143<TAB>Q565`.
You can also generate a prefilled QuickStatements window with
`https://quickstatements.toolforge.org/#/v1=Q37887397%7CP214%7C%2296480189%22%7CS143%7CQ565`.

The steps of converting V1 syntax to URL are:
1. replace TAB with "|" and newline with "||"
2. apply URL encoding to the string, which will replace "|" with "%7C", double quote with "%22", space with "%20", slash "/" with "%2F", etc.
3. put https://quickstatements.toolforge.org/#/v1= in front of it

Many templates on Commons, like Template:Creator or Template:Artwork use that technique to package information that can be imported to Wikidata into a clickable URL.

Hints:
* `[[File:Commons to Wikidata QuickStatements.svg|20px|link=https://quickstatements.toolforge.org/#/v1=Q37887397%7CP214%7C%2296480189%22%7CS143%7CQ565]]` will encode the URL within a handy clickable icon: [[File:Commons to Wikidata QuickStatements.svg|20px|link=https://quickstatements.toolforge.org/#/v1=Q37887397%7CP214%7C%2296480189%22%7CS143%7CQ565]] (click it but do not click "run"; pressing it will not work since that item already has that property).
* Pages with QuickStatements URLs may be located through Special:LinkSearch or through a database query calling externallinks table.

### Clients
- [Python](https://github.com/cthoyt/quickstatements_client)

## Limitations

QuickStatements version 2 currently cannot:
* create multiple items that are linked to each other
* set ranks for statements
* set comments when removing statements
* specify calendar for a date statement
* specify precision or globe for a location statement
* add statements to redirected items
* add a second statement with the same property and value but with different qualifiers, since additional qualifiers will be added to the first statement
* remove a qualifier without removing the statement itself
* edit or remove a reference without removing the statement itself
* update badges
* create lexemes

Note that for using QuickStatements, an account needs to be autoconfirmed. Also there is no way for users using bot accounts to mark their edits as _bot edit_ (but there is an open ticket to address that).

## FAQ

**Can QuickStatements add reference statements with more than one claim?**
Yes, current QuickStatements can add references that have for example both P143 and P813 or both P248 and P304.

**How do I experiment with QuickStatements?**
Use Q4115189 (Wikidata Sandbox).

**How do I report issues with the tool?**
Check with other users at the talk page or at Wikidata:Project chat. Confirmed bugs should be reported on Phabricator after reading mw:How to report a bug.

**Where do I suggest new features?**
You can ask at tool's Git page or at User:Magnus Manske/quick statements2, but be aware that we keep Magnus busy!

**What is the maximum number of commands I can enter at once?**
Not documented. It was already tested with over 11,000 commands. But note that such large batch runs will take several hours to complete.

## Best practices

* QuickStatements allows edits ranging from single statement to multi-thousand-item batch runs. Very large runs or potentially-controversial runs should go through the approval process described in Wikidata:Bots.
* Users should avoid creating duplicate items.
* All statements should have references as per Help:Sources. That might be less important for identifiers, like P214 or P650, etc.
* Users doing the edits are responsible for fixing or undoing their changes if issues are found. See about statement removal.
* This tool does not properly honor maxlag. This is generally not a problem, because the actions of the tool are limited by the usual edit limits of the controlling user. This can, however, cause problems if the controlling user is not subject to edit limits (e.g. admins).

## Using the API to start batches

If you are logged in on QuickStatements, you can get a token on your user page. That page also contains information about how to use the token to submit batches programmatically. _You need to have submitted at least one server-side batch manually before for this to work!_

## Edit groups

QuickStatements V2 creates edit groups for all individual batches. You may discuss individual edit groups, or rollback the whole edit group.

EditGroups is another external tool, not part of QuickStatements. Currently it works on Wikidata, and there is also an instance for Commons. On other Wikibase instances, it may be unavailable.

## QuickStatements 3.0

QuickStatements 3.0 is a similar tool developed and maintained by Wikimedia Brasil. It uses a syntax compatible with Magnus Manske's QuickStatements V2, but is otherwise an unrelated tool.

See [documentation](https://meta.wikimedia.org/wiki/QuickStatements_3.0/Documentation) and [issue tracker](https://github.com/WikiMovimentoBrasil/quickstatements3/issues).

## See also

* [YouTube instructions](https://www.youtube.com/watch?v=L0TYQ9LRRTQ)
* [CSV to quick_statements](https://ash-django.toolforge.org/csv2qs/) tool converts a properly formatted CSV file into a series of QuickStatements commands.
* Instructions on how to install QuickStatements as part of Wikibase suite

### Tools that export to QuickStatements

* Zotero export translator to QuickStatements format in zotkat: allows the collection of references in Zotero, which can then be exported to QuickStatements for uploading to Wikidata
* [topictagger](https://lubianat.shinyapps.io/topictagger/): finds potentially missing P921
* [New-Q5](https://new-q5.toolforge.org/): form for updating or creating an item that describes a person
* [Semantic MediaWiki](https://www.semantic-mediawiki.org) can export text files to be pasted as Quickstatements V1 or CSV files to be used as Quickstatements V2 via the [Templatefile result format](https://www.semantic-mediawiki.org/wiki/Help:Templatefile_format).
