# User Workflow Documentation

## Overview

The application guides users through a five-step workflow, designed as a checkout-style process with clear progress indicators and the ability to navigate between steps.

## Workflow Navigation

### Step Navigation Bar
```
[1. Input] → [2. Mapping] → [3. Reconciliation] → [4. Designer] → [5. Export]
   ●            ○             ○                ○            ○
```

- **Active step** highlighted with filled circle
- **Completed steps** marked with checkmarks
- **Future steps** shown as empty circles
- **Clickable navigation** allows jumping between completed steps
- **Progress percentage** displayed prominently

### Global Navigation Rules
- Users can move backward to any previously completed step
- Forward navigation only allowed when current step requirements are met
- Unsaved changes warning when attempting to navigate away
- Context preservation when returning to previous steps

## Step 1: Input

### Purpose
Configure data source and preview the structure of items to be processed.

### User Actions

#### API Configuration
1. **Enter Omeka S API URL**
   - Full endpoint URL with collection parameters
   - Optional advanced parameters (pagination, filtering)
   - URL validation and connectivity testing

2. **Preview Data Structure**
   - Fetch sample items from API
   - Display JSON-LD structure with collapsible sections
   - Toggle between formatted view and raw JSON
   - Identify linked data properties vs. custom fields

3. **Select Sample Item**
   - Choose representative item for workflow design
   - Preview how this item will flow through subsequent steps
   - Option to change selection later

#### Completion Criteria
- Valid API URL configured
- Successful data fetch from endpoint
- Sample item selected for workflow

### Data Processing
- **Custom field detection**: Identify non-LOD fields for exclusion
- **Property analysis**: Catalog all properties found in collection
- **Data type inference**: Preliminary analysis of value types
- **Collection size estimation**: For performance planning

## Step 2: Mapping

### Purpose
Map JSON properties from source data to Wikidata properties using Entity Schema guidance.

### User Interface Layout

#### Three Collapsible Sections

##### Non-Linked Keys
- Properties not yet mapped to Wikidata
- Sorted by frequency of occurrence in collection
- Click to open mapping modal for each property

##### Mapped Keys  
- Successfully mapped properties
- Show source property → Wikidata property mapping
- Click to edit or remove existing mappings

##### Ignored Keys
- Custom/non-LOD properties excluded from processing
- Option to move properties between ignored and non-linked
- Hidden by default with count indicator

### Mapping Modal Workflow

#### Modal Opening
- **Context display**: Show example values from source data
- **Property suggestions**: Based on Entity Schema and previous mappings
- **Search interface**: Live search of Wikidata properties

#### Suggestion Sources (Priority Order)
1. **Entity Schema properties**: Required/recommended properties
2. **Previous mappings**: Properties used in current session
3. **Community mappings**: Common patterns from GitHub configurations
4. **SPARQL-based suggestions**: Frequently used properties in similar collections

#### Mapping Actions
- **[C]onfirm**: Accept mapping and proceed to next unmapped property
- **[S]kip**: Temporarily skip this property
- **[I]gnore**: Permanently exclude this property
- **[R]esearch**: Open detailed information about suggested property

#### Auto-progression
- After confirming a mapping, automatically open next unmapped property
- Option to disable auto-progression for manual control
- Clear indication of remaining unmapped properties

### Loading Previous Mappings

When loading a mapping file from a previous session:

#### Automatic Dataset Validation
- **Key validation**: System checks if mapped keys exist in current dataset
- **Visual indication**: Keys not in current dataset appear grayed out
- **Status indicators**: Clear labeling of "(not in current dataset)" for non-existent keys
- **Interaction disabled**: Grayed out keys cannot be edited or modified

#### Dataset Compatibility Behavior
- **Filtered from reconciliation**: Keys not in current dataset are excluded from Step 3
- **Preserved in mapping**: Non-existent keys remain in mapping file for future use
- **Safe reloading**: Mapping files work across different datasets without errors
- **Clear feedback**: User receives count of keys that don't match current dataset

#### Use Cases
- **Reusing mappings**: Apply successful mappings to similar collections
- **Dataset evolution**: Handle cases where source data structure has changed
- **Collaborative work**: Share mapping configurations between different data sources
- **Template approach**: Create reusable mapping templates for common data patterns

### Completion Criteria
- All discoverable properties either mapped or explicitly ignored
- Entity Schema required properties have valid mappings
- User confirmation of mapping completeness

## Step 3: Reconciliation

### Purpose
Match specific values from source data to existing Wikidata entities or prepare them for QuickStatements.

### Interface Design

#### Table Layout
- **Rows**: Individual items from collection
- **Columns**: Mapped properties from Step 2
- **Cells**: Values requiring reconciliation
- **Progressive disclosure**: Focus on one row at a time

#### Cell Types and Behavior

##### QID Cells (Entity References)
- **Automatic suggestions**: Via Wikidata Reconciliation API
- **Confidence scores**: Visual indication of match quality
- **Manual search**: When automatic suggestions insufficient
- **Create new entity**: Link to Wikidata item creation

##### String Cells (Literals)
- **Language tag validation**: When required by property
- **Format validation**: Based on property constraints
- **Direct input**: No reconciliation required

##### Numeric Cells
- **Unit suggestions**: Based on property and context
- **Precision handling**: Appropriate for data type
- **Range validation**: Within property constraints

##### Date Cells
- **Calendar selection**: Gregorian (default) or other calendars
- **Precision options**: Year, month, day, hour, etc.
- **Format standardization**: ISO 8601 compliance

### Reconciliation Modal Workflow

#### Opening Context
- **Current item**: Clear identification of which item is being processed
- **Property context**: Show property definition and constraints
- **Value preview**: Original value from source data

#### Suggestion Interface
- **Top suggestion**: Highest confidence match prominently displayed
- **Alternative suggestions**: Ranked list with confidence scores
- **Search functionality**: Manual query with autocomplete
- **Entity details**: Preview of suggested entities

#### Decision Actions
- **[A]ccept**: Use suggested entity
- **[S]earch**: Manual search for alternative
- **[C]reate**: Flag for new entity creation
- **[L]ater**: Skip for now, return in review phase
- **[N]one**: Leave empty (if property allows)

#### Value Reuse
- **Smart suggestions**: Reuse values from other items where appropriate
- **Bulk application**: Apply decision to multiple similar values
- **Pattern recognition**: Suggest mappings based on previous decisions

### Completion Criteria
- All QID fields resolved or explicitly deferred
- Required properties have valid values
- Data type validation passes for all values

## Step 4: Wikidata Designer

### Purpose
Construct complete Wikidata items with proper sources, qualifiers, and validation.

### Item Construction Interface

#### Item Overview
- **Visual preview**: Wikidata-style display of constructed item
- **Property list**: All properties collapsed except active one
- **Completion indicator**: Progress through required properties

#### Property Editing
- **Main value**: Core property value (from reconciliation)
- **Qualifiers**: Additional context and specificity
- **References**: Source citations and evidence
- **Rank**: Normal, preferred, or deprecated status

#### Source Management
- **Reference templates**: Reusable citation patterns
- **Bulk source application**: Apply same reference to multiple statements
- **Required sources**: Entity Schema enforcement of citation requirements
- **Source validation**: Ensure proper reference structure

#### Quality Assurance
- **Entity Schema validation**: Real-time checking against schema requirements
- **Property constraints**: Validation against Wikidata property rules
- **Completeness checking**: Identification of missing required properties
- **Conflict detection**: Identification of potentially contradictory statements

### Design Workflow

#### Source Definition Phase
1. **Define reusable sources**: Create reference templates for the collection
2. **Source priority**: Establish primary vs. secondary sources
3. **Batch assignment**: Apply sources to appropriate statement types

#### Statement Construction Phase
1. **Property-by-property review**: Systematic completion of all properties
2. **Qualifier addition**: Add appropriate qualifiers based on context
3. **Reference assignment**: Attach appropriate sources to statements
4. **Validation checking**: Real-time validation feedback

#### Preview and Validation Phase
1. **Complete item preview**: See how item will appear on Wikidata
2. **Schema compliance check**: Final validation against Entity Schema
3. **Export readiness**: Confirmation that item is ready for QuickStatements

### Completion Criteria
- All Entity Schema required properties completed
- Proper source citations attached
- No validation errors or warnings
- User confirmation of item completeness

## Step 5: Export

### Purpose
Generate QuickStatements code and provide guidance for Wikidata contribution.

### Export Interface

#### QuickStatements Generation
- **Complete syntax**: Properly formatted QuickStatements for all items
- **Syntax validation**: Verification of QuickStatements format
- **Preview options**: Review before copying
- **Batch organization**: Logical grouping of statements

#### User Guidance
- **QuickStatements introduction**: Brief explanation of the tool
- **Account requirements**: Information about needed permissions
- **Best practices**: Guidelines for bulk contribution etiquette
- **Troubleshooting**: Common issues and solutions

#### Export Actions
- **Copy to clipboard**: One-click copying of generated statements
- **Download as file**: Save QuickStatements as .txt file
- **Save session**: Export complete workflow state as JSON
- **Load session**: Import previous workflow for continuation

### Completion Criteria
- Valid QuickStatements generated
- User understands next steps
- Session optionally saved for future reference

## Global Workflow Features

### Keyboard Navigation
- **Step navigation**: Tab through major interface elements
- **Modal controls**: Dedicated shortcuts for common actions
- **Quick actions**: Single-key shortcuts for frequent operations
- **Focus management**: Clear visual indication of current focus

### Progress Tracking
- **Step completion**: Visual indicators of completed steps
- **Item progress**: Count of processed vs. remaining items
- **Quality metrics**: Validation status and confidence indicators
- **Time estimation**: Approximate time remaining based on current pace

### Error Recovery
- **Undo functionality**: Reverse recent decisions
- **Step restart**: Reset individual steps while preserving others
- **Session recovery**: Restore from auto-saved state
- **Data validation**: Prevent progression with invalid data

This workflow balances efficiency for experienced users with guidance for newcomers, ensuring high-quality data preparation for Wikidata contribution.