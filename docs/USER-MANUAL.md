# Omeka S to Wikidata Tool - User Manual

**[← Back to README](../README.md)** | **[← Back to Technical Documentation](DOCUMENTATION.md)**

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [The Five-Step Process](#the-five-step-process)
4. [Step 1: Input - Data Collection](#step-1-input---data-collection)
5. [Step 2: Mapping - Property Assignment](#step-2-mapping---property-assignment)
6. [Step 3: Reconciliation - Data Refinement](#step-3-reconciliation---data-refinement)
7. [Step 4: References - Source Attribution](#step-4-references---source-attribution)
8. [Step 5: Export - QuickStatements Generation](#step-5-export---quickstatements-generation)
9. [Project Management](#project-management)
10. [Tips and Best Practices](#tips-and-best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

This tool helps you transfer data from Omeka S collections to Wikidata through a structured, guided workflow. The process transforms your collection data into Wikidata-compatible format and generates QuickStatements code for bulk import.

### The Five-Step Process

The tool guides you through five distinct stages:

1. **Input** - Collect data from your Omeka S API or paste JSON directly
2. **Mapping** - Map your data fields to Wikidata properties
3. **Reconciliation** - Refine individual values and link to existing Wikidata items
4. **References** - Add and configure references for your statements
5. **Export** - Generate QuickStatements code for Wikidata import

Each step builds on the previous one, ensuring your data is properly structured before moving forward.

---

## Getting Started

### First Time Users

When you first open the tool, you have two options:

1. **Start Fresh** - Begin a new project from Step 1
2. **Load Project** - Continue a previously saved project

### Important: Data Persistence

⚠️ **Critical Information About Data Saving:**

- **No Automatic Saving**: The tool does NOT automatically save your work
- **Manual Saves Only**: You must manually save your project using the "Save Project" button
- **Browser Reload Behavior**:
  - Depending on your browser settings, reloading or closing the page may result in data loss
  - Some browsers offer a one-time recovery option via a modal dialog
  - **This recovery cannot be guaranteed and should not be relied upon**
  - If you dismiss the recovery modal, your data cannot be recovered
- **Best Practice**: Save your project regularly, especially before:
  - Closing the browser tab
  - Navigating away from the page
  - Taking a break from work
  - Completing each major step

---

## The Five-Step Process

### Quick Overview

#### Step 1: Input
Collect and import your data from Omeka S APIs or JSON files. The tool validates and displays information about your dataset.

#### Step 2: Mapping
Map your Omeka S data fields to Wikidata properties. This is where you define which fields correspond to which Wikidata properties, using Entity Schemas for guidance.

#### Step 3: Reconciliation
Edit and refine individual data values. Link items to existing Wikidata entities and configure property-specific requirements (like languages for monolingual text).

#### Step 4: References
Add source references to your data. Configure which properties receive which references, with automatic detection of common reference patterns.

#### Step 5: Export
Generate QuickStatements code and export to Wikidata. Review and execute your imports through the QuickStatements interface.

---

## Step 1: Input - Data Collection

### Purpose
The Input step collects data from your Omeka S installation or allows you to paste JSON data directly.

### Data Source Options

#### Option A: Omeka S API URL

1. **Enter the API URL**
   - Paste your complete Omeka S API endpoint URL
   - Example: `https://your-omeka-site.org/api/items`

2. **Configure API Parameters**
   - Add any URL parameters to filter or select specific items
   - Examples:
     - `?item_set_id=123` - Select items from a specific set
     - `?resource_class_id=45` - Filter by resource class
     - `?per_page=50` - Limit number of items
     - Combine parameters: `?item_set_id=123&per_page=100`
   - You can use any valid Omeka S API parameters to refine your selection

3. **Click "Fetch Data"**
   - The tool attempts to retrieve data from the API
   - If CORS issues occur, automatic proxy fallback is attempted
   - You'll see a status message indicating success or any issues

#### Option B: Manual JSON Input

If API access doesn't work, you can enter JSON manually:

1. **Copy the API Response**
   - Visit your Omeka S API endpoint in a browser
   - Copy the entire JSON response

2. **Paste into the Tool**
   - Click the manual JSON input option
   - Paste the copied JSON into the text field

3. **Validate and Load**
   - The tool validates the JSON structure
   - If valid, data is loaded for processing

#### Option C: Experimental - Other Linked Data JSON

⚠️ **Experimental Feature**

- You may be able to paste other linked data JSON formats
- This functionality is not tested and may produce unexpected results
- Use at your own risk for non-Omeka S data sources

### Viewing Data Information

After successful data loading:

1. **Data Status Panel**
   - Shows the number of items loaded
   - Displays data structure information
   - May show warnings or validation messages

2. **View JSON Button**
   - **Important Note**: In some cases, clicking "View JSON" may redirect you to the API configuration page instead of showing raw JSON
   - This behavior depends on how the API endpoint is configured and cannot be controlled by this tool
   - **Workaround**: To view the actual JSON data:
     - Save your project (see [Project Management](#project-management))
     - Open the saved `.json` file in a text editor
     - The API response data is included in the project save file

3. **Continue Button**
   - Once you've verified the data looks correct, click "Continue"
   - This advances you to Step 2: Mapping

### Troubleshooting

**CORS Errors**
- The tool automatically attempts proxy services
- If all fail, use manual JSON input

**Invalid JSON**
- Check for syntax errors in manually pasted JSON
- Ensure the JSON follows Omeka S API response structure

**No Data Loaded**
- Verify the API URL is correct and accessible
- Check that the endpoint returns items
- Try adding `?per_page=10` to test with fewer items

---

## Step 2: Mapping - Property Assignment

### Purpose
Mapping connects your Omeka S data fields to Wikidata properties, defining how your data will be structured in Wikidata.

### Understanding the Interface

The mapping interface is divided into several sections:

#### Top Section: Entity Schema Selection

**Select Entity Schema** (Top Right)
- Entity Schemas provide templates for common item types
- Select a schema that matches your data (e.g., E473 for paintings, E1146 for books)
- The tool suggests appropriate Wikidata properties based on the selected schema
- Schemas are listed with their IDs and descriptions
- For more information, see the [Entity Schema Guide](Entity-Schema-Guide.md)

#### Main Sections: Key Organization

**1. Non-Linked Keys** (Top Left)
- Fields that have not yet been mapped
- These keys need to be assigned to Wikidata properties or marked as ignored
- Click on any key to open the mapping dialog

**2. Mapped Keys** (Center)
- Fields that have been successfully mapped to Wikidata properties
- Shows which property each key maps to
- Can be edited or unmapped if needed
- Keys automatically move here when you complete a mapping

**3. Ignored Keys** (Below Mapped Keys)
- Fields that you've chosen not to map
- Some keys are pre-ignored (internal Omeka S fields like `@context`, `@id`, etc.)
- Collapsible section - click to expand and review
- Can move keys from here back to mapped if you change your mind

**4. Entity Schema Information** (Bottom)
- Shows details about the currently selected Entity Schema
- Lists recommended properties for your item type
- Provides guidance on essential vs. optional properties

#### Bottom Section: Mapping Management

**Save Mapping**
- Exports only the mapping configuration (not the data)
- Creates a reusable template for similar datasets
- See [Mapping Files](#mapping-files) below

**Load Mapping**
- Imports a previously saved mapping configuration
- Automatically maps keys according to the loaded template
- Useful when processing multiple similar datasets

### Automatic Mapping

When you first enter the mapping step:

1. **Identifier Detection**
   - The tool automatically detects common identifiers in your data
   - Known identifier patterns are automatically mapped to appropriate Wikidata properties
   - This saves time on common mappings

2. **Pre-Ignored Keys**
   - Internal Omeka S fields are automatically moved to "Ignored Keys"
   - These typically include: `@context`, `@id`, `@type`, `o:id`, etc.
   - You can review and change these if needed

### Creating Mappings

#### To Map a Key:

1. **Click on a Non-Linked Key**
   - A mapping dialog opens

2. **Search for Property**
   - Type keywords to search Wikidata properties
   - The Entity Schema (if selected) prioritizes relevant properties
   - Results show: Property ID (e.g., P31), Label, and Description

3. **Select Property**
   - Click on the appropriate property
   - Review the property's constraints and data type
   - Confirm the selection

4. **Key Moves to Mapped Keys**
   - The key automatically appears in the "Mapped Keys" section
   - A preview shows sample values from your data

#### To Edit a Mapping:

1. **Click on a Mapped Key**
   - Opens the same mapping dialog
   - Shows current mapping

2. **Change Property**
   - Search for a different property
   - Select the new property
   - The mapping is updated

#### To Ignore a Key:

1. **In the Mapping Dialog**
   - Click "Ignore this key" or similar option
   - Key moves to "Ignored Keys" section

2. **From Ignored Back to Mapped**
   - Expand "Ignored Keys"
   - Click on the key
   - Map it normally
   - It moves back to "Mapped Keys"

### Mapping Files

#### Save Mapping
Saves ONLY the mapping configuration, not your data:

**What's Included:**
- Key-to-property assignments
- Property metadata (IDs, labels, descriptions)
- Ignored keys list
- Entity Schema selection
- Timestamps

**What's NOT Included:**
- Your actual data values
- Sample values
- Frequency information
- Item-specific information

**When to Use:**
- After completing a complex mapping
- When you'll process similar datasets in the future
- To share mapping templates with colleagues

#### Load Mapping
Loads a previously saved mapping configuration:

**What Happens:**
- Keys are automatically mapped according to the loaded configuration
- Ignored keys are restored
- Entity Schema selection is restored
- Your current data remains unchanged

**When to Use:**
- Processing a new batch of similar items
- Starting with a colleague's mapping template
- Recovering from a mistake (if you saved before the mistake)

### Best Practices

1. **Select Entity Schema First**
   - Choose the most appropriate schema before mapping
   - This prioritizes relevant properties in search results

2. **Review Pre-Mapped Identifiers**
   - Check the automatic identifier mappings
   - Adjust if they don't match your needs

3. **Map Essential Properties First**
   - Start with required properties (often shown in Entity Schema)
   - Then handle optional properties

4. **Use Ignore Strategically**
   - Ignore technical fields that aren't relevant to Wikidata
   - Don't ignore fields that might be useful later

5. **Save Mapping When Complete**
   - Create a reusable template for future use
   - Saves time on subsequent imports

6. **Expand Ignored Keys to Review**
   - Periodically check ignored keys to ensure nothing important was missed
   - Some pre-ignored keys might actually be useful for your use case

### Continuing to Next Step

Once all relevant keys are either mapped or ignored:

1. **Review Your Mappings**
   - Check that all important data is mapped
   - Verify property selections are appropriate

2. **Save Mapping** (Optional but Recommended)
   - Create a backup of your mapping work

3. **Click "Continue"**
   - Advances to Step 3: Reconciliation

---

## Step 3: Reconciliation - Data Refinement

### Purpose
Reconciliation allows you to refine each individual data value, link items to existing Wikidata entities, and configure property-specific requirements.

### What is Reconciliation?

Reconciliation is the process of:
- Editing specific values in your data
- Linking items to existing Wikidata entities instead of creating duplicates
- Setting property-specific parameters (like language codes for text)
- Ensuring data quality before export

### Interface Overview

The reconciliation interface shows:

1. **Item List**
   - All items from your dataset
   - Progress indicator (completed/skipped vs. total)

2. **Current Item View**
   - All properties and values for the selected item
   - Editing controls for each value

3. **Property Editors**
   - Type-specific editors based on Wikidata property data types
   - Validation and helper tools

### Item-Level Actions

#### Main Item Reconciliation

**Link to Existing Wikidata Item:**
- Search for existing items in Wikidata
- If your item already exists, link to it instead of creating a duplicate
- The search suggests matches based on your data
- Selecting an existing item marks it for updating rather than creation

**Create New Item:**
- If no match exists, the item will be created as new
- This is the default if you don't link to an existing item

### Property-Level Editing

Each property may have different editing requirements based on its Wikidata data type:

#### Text Values
- Simple text input
- Can be edited directly

#### Monolingual Text
- Requires a language code
- Select from dropdown or type language code (e.g., "en", "nl", "de")
- Each value must have a language specified

#### Wikidata Items
- Link to other Wikidata entities
- Search and select from existing items
- Shows item ID, label, and description

#### Quantities
- Numeric values
- May include units
- Validation ensures proper format

#### Dates
- Date/time values
- Format according to Wikidata date standards
- May include precision (year, month, day, etc.)

#### URLs
- Website addresses
- Validation ensures proper URL format

### Special Features

#### Batch Operations
- Mark multiple items as completed
- Skip items that don't need reconciliation
- Apply changes across similar items

#### Validation
- Real-time validation of input
- Error messages for invalid formats
- Warnings for potential issues

### Progress Tracking

The reconciliation step tracks:
- **Completed**: Items you've reviewed and finalized
- **Skipped**: Items you've chosen not to reconcile
- **Total**: All items in your dataset
- **Remaining**: Items still needing attention

### Best Practices

1. **Start with Main Item Links**
   - Check if your items exist in Wikidata first
   - Linking prevents duplicate entries

2. **Verify Language Codes**
   - Ensure monolingual text has correct language codes
   - Use ISO 639-1 codes (e.g., "en", "nl", "de")

3. **Use Search Effectively**
   - When linking to Wikidata items, use specific search terms
   - Verify the item ID and description match your intent

4. **Mark Progress**
   - Complete or skip items as you go
   - The progress bar helps track your work

5. **Save Project Regularly**
   - Reconciliation can be time-consuming
   - Save frequently to avoid losing work

### Continuing to Next Step

Once reconciliation is complete:

1. **Review Progress**
   - Check that all items are marked completed or skipped
   - Verify critical values are properly set

2. **Save Project** (Recommended)

3. **Click "Continue"**
   - Advances to Step 4: References

---

## Step 4: References - Source Attribution

### Purpose
References provide source attribution for your Wikidata statements, documenting where information comes from.

### What are References?

In Wikidata, references are metadata that support your statements by citing sources. They typically include:
- URLs to source materials
- Publication dates
- Author information
- Archive or catalog identifiers

### Interface Overview

The references interface displays:

1. **Detected References**
   - Automatically detected reference information from your data
   - Common patterns like URLs, dates, and identifiers

2. **Manual Reference Entry**
   - Add custom references
   - Configure reference properties

3. **Property Assignment**
   - Choose which properties receive which references
   - Not all properties require or benefit from references

### Automatic Reference Detection

The tool automatically detects common reference types:
- **URLs**: Web addresses in your data
- **Publication Dates**: Temporal information
- **Identifiers**: Catalog numbers, ISBNs, etc.
- **Source Titles**: Names of publications or archives

### Adding References

#### From Detected References:
1. Review automatically detected references
2. Select which ones to include
3. Assign to relevant properties

#### Manual Entry:
1. Click "Add Reference"
2. Select reference property (e.g., P854 "reference URL")
3. Enter reference value
4. Add additional reference properties as needed
5. Save the reference

### Assigning References to Properties

**Important**: Not every property requires or makes sense to have references.

#### To Assign References:
1. **Select Property**
   - Choose which property should receive references
   - Properties are listed from your mapping

2. **Select References**
   - Check which references apply to this property
   - You can assign different references to different properties

3. **Selective Assignment**
   - You can choose NOT to add references to some properties
   - Only assign references where they add value

#### Examples:

**Properties That Often Need References:**
- Dates (when the date is sourced from external documentation)
- Descriptions (when paraphrased from source materials)
- Historical claims (events, relationships, etc.)

**Properties That May Not Need References:**
- Identifiers (they are self-referencing)
- Properties where the value is the reference itself
- Structural properties (instance of, subclass of)

### Best Practices

1. **Be Selective**
   - Don't add references to every property automatically
   - Consider whether the reference adds meaningful information

2. **Use Appropriate Reference Properties**
   - P854: reference URL (for web sources)
   - P577: publication date
   - P248: stated in (for databases or publications)
   - P813: retrieved date (when you accessed the information)

3. **Complete References**
   - Include multiple reference properties when appropriate
   - Example: URL + retrieved date + stated in

4. **Verify URLs**
   - Check that reference URLs are accessible
   - Use permanent/archived URLs when possible

### Continuing to Next Step

Once references are configured:

1. **Review Assignments**
   - Check which properties have which references
   - Ensure important claims are properly sourced

2. **Save Project** (Recommended)

3. **Click "Continue"**
   - Advances to Step 5: Export

---

## Step 5: Export - QuickStatements Generation

### Purpose
The export step generates QuickStatements code that can be imported directly into Wikidata.

### What is QuickStatements?

QuickStatements is a Wikidata tool that allows bulk import of statements using a specific text format. This tool generates proper QuickStatements code for your entire dataset.

### Interface Overview

The export interface shows:

1. **Data Summary**
   - Number of items to be created/updated
   - Number of statements
   - Overview of changes

2. **QuickStatements Code**
   - Generated code in QuickStatements format
   - Can be reviewed before export

3. **Export Options**
   - Copy to clipboard
   - Download as file
   - Direct export to QuickStatements

### Reviewing Before Export

#### Data Summary
Review the summary to ensure:
- Item count matches your expectations
- All mapped properties are included
- References are properly attached

#### QuickStatements Code
The generated code should:
- Follow QuickStatements V1 or V2 format
- Include all mapped properties
- Properly format references
- Handle special characters correctly

### Exporting to QuickStatements

#### Option A: Direct Export

1. **Click "Export to QuickStatements"**
   - Opens QuickStatements in a new tab
   - Code is pre-filled in the QuickStatements interface

2. **Login Required**
   - You must be logged into Wikidata
   - QuickStatements requires authentication to execute

3. **Review in QuickStatements**
   - The code appears in the input field
   - You can review it one more time

4. **Execute**
   - Click the execute/import button in QuickStatements
   - Statements are processed and added to Wikidata
   - You'll see progress and results

#### Option B: Copy/Download

1. **Copy to Clipboard**
   - Click "Copy Code"
   - Paste into QuickStatements manually

2. **Download as File**
   - Click "Download"
   - Save the `.txt` file
   - Upload to QuickStatements later

### Testing with Wikidata Sandbox

⚠️ **Important for Testing**

Before importing real data, test your process:

1. **Use Wikidata Sandbox Item**
   - In Step 3 (Reconciliation), link your items to Q4115189 (Wikidata Sandbox)
   - This is a special item designed for testing

2. **Perform Real Edits Safely**
   - QuickStatements will execute against the Sandbox item
   - No real Wikidata items are affected
   - You can see the full process without consequences

3. **Review Results**
   - Check that statements appear correctly
   - Verify references are properly attached
   - Confirm formatting is correct

4. **Clean Up**
   - The Sandbox is regularly cleaned
   - Your test data will be automatically removed

5. **Run Again with Real Data**
   - Once satisfied with results, repeat the process
   - In reconciliation, link to real Wikidata items or create new ones
   - Export to QuickStatements for actual import

### After Export

#### QuickStatements Processing

**During Processing:**
- QuickStatements shows progress
- Each statement is processed in order
- Errors are displayed if they occur

**After Completion:**
- Summary shows successful imports
- Any errors are listed with explanations
- You can review the batch details

#### Verifying Results

1. **Check Wikidata Items**
   - Visit the created/updated items in Wikidata
   - Verify statements appear correctly
   - Check references are attached

2. **Review Errors**
   - If any statements failed, note the error messages
   - Common issues: duplicate statements, constraint violations
   - You may need to adjust and re-import

### Troubleshooting

**QuickStatements Errors**
- Check formatting of generated code
- Verify all property IDs are valid
- Ensure item references exist in Wikidata

**Login Issues**
- Ensure you're logged into Wikidata
- Check QuickStatements permissions
- Try using OAuth if available

**Partial Success**
- Some statements may succeed while others fail
- Review the error log in QuickStatements
- Fix issues and re-run for failed statements

### Best Practices

1. **Always Test First**
   - Use the Sandbox item for initial tests
   - Verify the process works as expected

2. **Review Generated Code**
   - Check a sample of the code before executing
   - Look for obvious formatting issues

3. **Import in Batches**
   - For large datasets, consider splitting into smaller batches
   - Easier to manage errors and track progress

4. **Document Your Import**
   - Save the QuickStatements code
   - Keep a record of what was imported and when

5. **Monitor Results**
   - Watch the QuickStatements progress
   - Don't navigate away until complete

---

## Project Management

### Saving Projects

**What is Saved:**
- All your data from Step 1
- Complete mapping configuration
- Reconciliation edits and progress
- Reference configurations
- Current step and state

**How to Save:**
1. Click "Save Project" (available at any step)
2. Choose location and filename
3. A `.json` file is downloaded

**When to Save:**
- Before closing the browser
- After completing major work (mapping, reconciliation)
- Before taking a break
- When switching between projects
- As regular backups during long sessions

### Loading Projects

**How to Load:**
1. Click "Load Project" on the start screen
2. Select your saved `.json` file
3. Project state is restored

**What is Restored:**
- All data and progress
- Current step position
- All configurations and edits

**When to Load:**
- Starting a new session
- Continuing previous work
- Recovering from browser issues
- Switching between projects

### Mapping Files vs. Project Files

**Project Files** (Save/Load Project):
- Contains everything: data + mappings + progress
- Large file size
- Use for continuing specific projects

**Mapping Files** (Save/Load Mapping in Step 2):
- Contains only mapping configuration
- Small file size
- Use as templates for similar datasets
- Reusable across different projects

### Best Practices

1. **Naming Convention**
   - Use descriptive names: `project-paintings-batch1-2025-10-15.json`
   - Include dates for version tracking
   - Indicate content type or batch number

2. **Version Control**
   - Save multiple versions at key milestones
   - Keep backups of important projects
   - Don't overwrite previous versions immediately

3. **Regular Saves**
   - Save every 15-30 minutes during active work
   - Save before trying experimental changes
   - Save after completing each step

4. **Organize Files**
   - Keep project files in a dedicated folder
   - Separate mapping templates from project files
   - Archive completed projects

---

## Tips and Best Practices

### General Workflow

1. **Plan Your Entity Schema First**
   - Research appropriate Entity Schemas before starting
   - Have the Entity ID ready (e.g., E473 for paintings)

2. **Start Small**
   - Test with a small batch first (5-10 items)
   - Run through the entire process with test data
   - Use Wikidata Sandbox for initial tests

3. **Save Frequently**
   - Cannot be stressed enough
   - Save before and after each major step
   - Keep multiple backup versions

4. **Review at Each Step**
   - Don't rush through steps
   - Verify data looks correct before continuing
   - Fix issues early rather than later

### Step-Specific Tips

#### Step 1: Input
- Test API endpoints with small limits first (`?per_page=10`)
- Keep a backup copy of your source JSON
- Verify item count matches expectations

#### Step 2: Mapping
- Select Entity Schema before mapping anything
- Trust the automatic identifier detection but verify
- Save your mapping template for reuse
- Review ignored keys before continuing

#### Step 3: Reconciliation
- Link to existing items to avoid duplicates
- Use specific search terms when finding items
- Double-check language codes
- Take breaks on large datasets

#### Step 4: References
- Don't reference everything automatically
- Use complete references (URL + date + source)
- Verify reference URLs are accessible

#### Step 5: Export
- Always test with Sandbox first
- Review a sample of generated code
- Watch for errors during QuickStatements execution
- Keep the generated code as a record

### Data Quality

1. **Verify Completeness**
   - Check that all essential properties are mapped
   - Ensure required values are present

2. **Validate Formats**
   - URLs should be complete and valid
   - Dates should follow proper formats
   - Language codes should be correct

3. **Check for Duplicates**
   - Search Wikidata before creating new items
   - Link to existing items when possible

4. **Test Thoroughly**
   - Use Sandbox for testing
   - Verify results before large imports
   - Fix issues identified in tests

### Common Pitfalls

1. **Not Saving Work**
   - Always save before closing or navigating away

2. **Skipping Entity Schema**
   - Makes mapping harder and less accurate

3. **Creating Duplicates**
   - Always search for existing items in reconciliation

4. **Ignoring Errors**
   - Address QuickStatements errors rather than ignoring them

5. **Rushing Through Steps**
   - Each step is important for data quality

### Getting Help

If you encounter issues:

1. **Check This Manual**
   - Most common issues are covered here

2. **Review Error Messages**
   - Error messages often explain the problem

3. **Test with Smaller Dataset**
   - Isolate issues by reducing complexity

4. **Save Your Work**
   - Save before experimenting with fixes

5. **Document Issues**
   - Note what you tried and what happened
   - Useful for support requests

---

## Troubleshooting

### Quick Fixes You Can Try

If you encounter problems while using the tool, try these solutions first:

#### 1. Refresh the Page
- Sometimes the tool just needs a fresh start
- **⚠️ Warning**: Make sure to save your project first, or you'll lose your work!
- Click "Save Project" before refreshing

#### 2. Clear Your Browser Cache
- Old cached files can sometimes cause issues
- **How to clear cache:**
  - **Chrome/Edge**: Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
  - **Firefox**: Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
  - **Safari**: Go to Safari menu → Clear History
- Choose "Cached images and files" and clear
- Reload the tool after clearing

#### 3. Try a Different Browser
- If the tool isn't working in your current browser, try:
  - Chrome
  - Firefox
  - Edge
  - Safari
- Desktop browsers only (mobile browsers are not supported)

#### 4. Check Your Internet Connection
- The tool needs internet to:
  - Fetch data from Omeka S
  - Search Wikidata properties and items
  - Export to QuickStatements
- Try loading another website to verify your connection works

#### 5. Save and Reload Your Project
- If something seems stuck or broken:
  1. Click "Save Project" to download your current work
  2. Refresh the page
  3. Click "Load Project" and select the file you just saved
- This often resolves temporary issues

#### 6. Start Fresh (If Nothing Else Works)
- Sometimes a saved project file can become corrupted
- **Signs of a corrupted save file:**
  - Tool crashes when loading your project
  - Strange errors that don't make sense
  - Data appears incomplete or mixed up
  - Tool becomes unresponsive after loading
- **If you suspect corruption:**
  1. Try starting a completely new project from scratch
  2. Re-import your original data from Step 1
  3. If starting fresh works, your save file was likely corrupted
- **We understand this is not optimal**, but corruption can sometimes happen
- **To minimize risk of corruption:**
  - Save regularly (don't wait too long between saves)
  - Don't close the browser while saving
  - Keep backup saves at different stages of your work

### Still Having Problems?

If none of the quick fixes above help, we'd like to know about it! Please report the issue so we can improve the tool.

#### How to Report an Issue

1. **Go to GitHub Issues**
   - Visit: https://github.com/daanvr/omekas-to-wikidata/issues
   - You'll need a free GitHub account (if you don't have one, you can create it in minutes)

2. **Click "New Issue"**
   - Look for the green "New issue" button
   - Click it to start creating a bug report

3. **Describe the Problem**
   - Write a clear title (e.g., "Cannot save project after reconciliation")
   - In the description, explain:
     - What you were trying to do
     - What happened instead
     - What step you were on (Input, Mapping, Reconciliation, etc.)
     - Any error messages you saw

4. **Attach Helpful Files**

   **Please include:**

   a. **Screenshot**
   - Take a screenshot showing the problem
   - On Windows: Press `Windows Key + Shift + S`
   - On Mac: Press `Cmd + Shift + 4`
   - Drag and drop the image into the GitHub issue

   b. **Your Project File** (if possible)
   - Click "Save Project" to download your `.json` file
   - Drag and drop it into the GitHub issue
   - **Note**: This file contains your data. If your data is private or sensitive, you can:
     - Skip this step, or
     - Create a test project with dummy data that reproduces the problem

   c. **Browser Information**
   - Mention which browser you're using (Chrome, Firefox, Safari, Edge)
   - Include the version if you know it

5. **Submit the Issue**
   - Click "Submit new issue"
   - We'll review it and try to help or fix the problem

#### Example Issue Report

```
Title: "Mapping dialog doesn't open when clicking on keys"

Description:
I'm on Step 2 (Mapping) and when I click on any key in the "Non-Linked Keys"
section, nothing happens. The mapping dialog doesn't appear.

I'm using Chrome on Windows 10. I tried refreshing the page and the problem
still occurs.

Screenshots attached showing where I'm clicking.

Project file attached.
```

#### What Happens Next?

- We'll review your issue as soon as possible
- We may ask follow-up questions to better understand the problem
- Once we identify the issue, we'll work on a fix
- You'll receive notifications on GitHub when we respond or fix the issue

#### Privacy Note

- GitHub issues are public, so anyone can see them
- Don't include sensitive personal information in your description
- If your project data is confidential, describe the problem without sharing the file, or create a minimal test case with dummy data

---

## Appendix: Technical Notes

### Browser Compatibility
- Designed for desktop browsers
- Chrome, Firefox, Safari, Edge supported
- No mobile support

### Data Privacy
- All processing happens client-side (in your browser)
- No data is sent to servers except:
  - Omeka S API (for data fetch)
  - Wikidata API (for searches and QuickStatements)
- Saved files are local to your computer

### File Formats

**Project Files (`.json`)**
```json
{
  "version": "1.0",
  "currentStep": 2,
  "data": { ... },
  "mappings": { ... },
  "reconciliation": { ... },
  "references": { ... }
}
```

**Mapping Files (`.json`)**
```json
{
  "version": "1.0",
  "createdAt": "2025-10-15T10:00:00.000Z",
  "entitySchema": "E473",
  "mappings": {
    "mapped": [ ... ],
    "ignored": [ ... ]
  }
}
```

### QuickStatements Format

The tool generates QuickStatements V1 format:
```
Q4115189|P31|Q5
Q4115189|P1476|en:"Example Title"
Q4115189|P854|"https://example.org"|P813|+2025-10-15T00:00:00Z/11
```

---

**[← Back to README](../README.md)** | **[← Back to Technical Documentation](DOCUMENTATION.md)**
