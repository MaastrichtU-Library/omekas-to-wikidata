# Omeka S to Wikidata Tool - Complete User Story

**[← Back to Technical Documentation](DOCUMENTATION.md)**

## Overview
The Omeka S to Wikidata tool is a web-based application that guides users through the process of importing linked data from Omeka S systems into Wikidata. It was developed as part of the 2025 "Open Topstukken" (Open Collection Highlights) project by Maastricht University Library and Radboud University Library.

## Core Purpose
This tool bridges the gap between cultural heritage collections managed in Omeka S and the global knowledge base of Wikidata, enabling institutions to contribute their collection data to the semantic web while maintaining proper attribution and data quality standards.

## Target Users
- **Primary Users**: Librarians, archivists, and collection managers at cultural heritage institutions
- **Secondary Users**: Digital humanities researchers and data curators
- **Technical Level**: Users with basic understanding of metadata and web interfaces, but no programming skills required

## User Journey

### Starting the Tool
1. User navigates to the web application (no login required - it's a public tool)
2. They see a warning that all work is temporary and will be lost on page refresh
3. They can choose to:
   - Start a new project
   - Load a previously saved project file
   - Restore a previous session (if auto-saved in browser)

### Step 1: Input - Getting Data from Omeka S

**Goal**: Import collection data from an Omeka S API endpoint

**User Actions**:
1. User enters the API URL of their Omeka S collection
   - Example: `https://digitalcollections.library.maastrichtuniversity.nl/api/items?page=5&per_page=2`
2. Clicks "Fetch Data" to retrieve the JSON data
3. Views a summary of the imported data:
   - Number of items imported
   - Data structure preview
   - Option to view raw JSON
4. Selects which items to process (or processes all)
5. Proceeds to the mapping step

**What Happens Behind the Scenes**:
- The tool fetches JSON-LD data from the Omeka S API
- Parses and analyzes the data structure
- Identifies all unique property keys across items
- Prepares the data for mapping

### Step 2: Mapping - Connecting Omeka Fields to Wikidata Properties

**Goal**: Map Omeka S metadata fields to corresponding Wikidata properties

**User Actions**:
1. Views three categories of fields:
   - **Non-linked Keys**: Fields not yet mapped
   - **Mapped Keys**: Fields already connected to Wikidata properties
   - **Ignored Keys**: Fields marked as not relevant for Wikidata

2. For each unmapped field, user clicks to open a mapping modal where they:
   - See sample values from the data
   - Search for appropriate Wikidata properties
   - View property descriptions and constraints
   - Choose to:
     - **Map** to a Wikidata property
     - **Ignore** if not relevant
     - **Skip** to decide later

3. Can save/load mapping configurations for reuse with similar datasets

**Example Mapping**:
- `dc:title` → `P1476` (title)
- `dc:creator` → `P170` (creator)
- `dc:date` → `P571` (inception)

### Step 3: Reconciliation - Matching Values to Wikidata Entities

**Goal**: Match data values to existing Wikidata entities or prepare them as new values

**User Interface**:
- Table view with items as rows and properties as columns
- Each cell shows the value to be reconciled

**User Actions**:
1. Processes items one by one (or by property column)
2. For each value, a reconciliation modal opens showing:
   - The original value
   - Suggested Wikidata matches with confidence scores
   - Option to search manually
   - Option to use as string/literal value

3. Different actions based on value type:
   - **For entities** (people, places, organizations):
     - Select from suggested matches
     - Search for the correct entity
     - Mark to create as new Wikidata item
   - **For strings** (titles, descriptions):
     - Specify language
     - Keep as literal value
   - **For dates**:
     - Set precision (year, month, day)
     - Choose calendar model
   - **For quantities**:
     - Add units if applicable
     - Set precision

**Example Reconciliation**:
- "Maastricht University" → `Q1137652` (Maastricht University)
- "Johannes Vermeer" → `Q41264` (Johannes Vermeer)
- "17th century painting" → Keep as string with language tag "en"

### Step 4: Wikidata Designer - Creating Complete Items

**Goal**: Design complete Wikidata items with all necessary metadata

**User Actions**:
1. **Adds References** (sources):
   - Auto-detects references from Omeka S URLs
   - Can add manual references
   - Each statement will include these references

2. **Configures Item Structure**:
   - **Labels**: Item names in multiple languages
   - **Descriptions**: Short descriptions in multiple languages
   - **Aliases**: Alternative names
   - **Statements**: All the mapped properties with their values

3. **Reviews Item Design**:
   - Sees preview in Wikidata-style format
   - Can add additional statements
   - Ensures all required properties are included
   - Adds qualifiers where needed (e.g., "applies to part" for partial dates)

4. **Handles Multiple Items**:
   - Can view design for all items at once
   - Or focus on individual items
   - Unavailable properties for specific items are clearly marked

### Step 5: Export - Generating QuickStatements

**Goal**: Export the data in a format ready for import to Wikidata

**User Actions**:
1. Reviews the generated QuickStatements code
2. Sees any validation warnings or issues
3. Can:
   - Copy the code to clipboard
   - Download as a .txt file
   - Open directly in QuickStatements tool

4. Follows the provided instructions to:
   - Ensure they have proper Wikidata editing rights
   - Understand the QuickStatements process
   - Execute the import

**QuickStatements Format Example**:
```
CREATE
LAST|Len|"Painting by Vermeer"
LAST|P31|Q3305213
LAST|P170|Q41264|S854|"https://omeka.example.org/item/123"|S813|+2025-07-16T00:00:00Z/11
```

## Key Features Throughout the Process

### Data Persistence
- **No automatic saving** - users must explicitly save their work
- **Project files** can be saved/loaded at any time
- **Session recovery** available if browser supports it
- Clear warnings about data loss on page refresh

### User Guidance
- **Progress bar** shows current step and overall progress
- **Tooltips** explain each field and option
- **Contextual help** available throughout
- **Validation** ensures data quality before export

### Flexibility
- **Non-linear navigation** - can go back to previous steps
- **Partial completion** - can skip items or properties
- **Bulk operations** - can apply settings to multiple items
- **Customization** - can override automatic suggestions

## Success Metrics
A successful session results in:
1. All relevant Omeka S fields mapped to Wikidata properties
2. All values either matched to existing entities or prepared as new data
3. Complete items with proper references and structure
4. Valid QuickStatements code ready for import
5. User understanding of what will be created in Wikidata

## Common Use Cases

### Use Case 1: University Special Collections
A university library wants to add their collection of historical manuscripts to Wikidata:
- Imports 50 manuscript records from Omeka S
- Maps fields like title, author, date, material, dimensions
- Reconciles authors to existing Wikidata entries
- Creates new items for manuscripts not yet in Wikidata
- Exports with references back to the library catalog

### Use Case 2: Museum Artwork Collection
A museum contributes their painting collection:
- Imports artwork data including artists, dates, techniques
- Maps museum-specific fields to Wikidata properties
- Reconciles artists, locations, and techniques
- Adds multilingual labels (Dutch and English)
- Includes museum catalog URLs as references

### Use Case 3: Digital Archive Migration
An archive migrating historical photographs:
- Processes hundreds of items in batches
- Maps photographer, date, location, subject fields
- Creates new entries for local photographers
- Preserves archive identifiers as external IDs
- Maintains link to digital images

## Technical Constraints
- **Frontend-only**: No server-side processing or data storage
- **Browser-based**: All processing happens in the user's browser
- **API dependent**: Requires accessible Omeka S API endpoint
- **Manual export**: Users must manually copy/save results

## Benefits for Institutions
1. **Visibility**: Collections become discoverable through Wikidata
2. **Standardization**: Data mapped to global standards
3. **Attribution**: Clear references back to source institution
4. **Efficiency**: Batch processing instead of manual entry
5. **Reusability**: Mapping configurations can be shared

## Future Enhancements (Post-MVP)
- Advanced keyboard navigation
- Column-based reconciliation workflow
- Entity schema validation
- Community-shared mapping templates
- Integration with additional Wikidata tools
- Automated quality checks
- Multi-language interface

This tool represents a significant step forward in making cultural heritage collections more accessible and interconnected through the semantic web, while maintaining high data quality standards and proper attribution to source institutions.