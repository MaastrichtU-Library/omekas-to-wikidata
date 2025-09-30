# JavaScript Module Map

## Quick Reference

| Need to... | Look in... |
|------------|------------|
| Load/save application state | `state.js` |
| Handle workflow navigation | `navigation.js` |
| Import Omeka S data | `steps/input.js` |
| Map fields to Wikidata properties | `steps/mapping.js`, `mapping/` |
| Search Wikidata properties | `mapping/core/property-searcher.js` |
| Transform field values | `transformations.js` |
| Reconcile entities with Wikidata | `steps/reconciliation.js`, `reconciliation/` |
| Detect and display reference links | `steps/step4.js`, `references/` |
| Call Wikidata API | `api/wikidata.js` |
| Create UI elements | `ui/components.js` |
| Handle modals | `modals.js` |
| Manage events between modules | `events.js` |
| Export to QuickStatements | `steps/export.js` |
| Handle CORS issues | `utils/cors-proxy.js` |
| Validate property constraints | `mapping/core/constraint-validator.js` |

## Architecture Overview

The application follows a **modular, event-driven architecture**:
- **State Management**: Centralized in `state.js` with event notifications
- **Module Communication**: Through `events.js` event system
- **Feature Organization**: Domain-based folders (`mapping/`, `reconciliation/`)
- **Layer Separation**: `core/` (business logic) vs `ui/` (interface)
- **Workflow Steps**: Sequential processing through 5 main steps

## Core Infrastructure

### **app.js**
- Purpose: Application entry point, initializes all modules
- Key exports: `initializeApp()`
- Dependencies: All step modules, state, navigation, events

### **state.js**
- Purpose: Centralized state management with persistence
- Key exports: `setupState()`, convenience methods like `updateMappings()`, `incrementReconciliationCompleted()`, `linkItemToWikidata()`, `unlinkItem()`, `getLinkedItem()`
- Dependencies: events.js

### **events.js**
- Purpose: Inter-module communication via events
- Key exports: `eventSystem` (emit, on, off methods)
- Dependencies: None (foundational)

### **navigation.js**
- Purpose: Controls workflow step progression and validation
- Key exports: `setupNavigation()`, step validation logic
- Dependencies: state.js, events.js

### **modals.js**
- Purpose: Global modal management and display
- Key exports: `setupModals()`, `openModal()`, `closeModal()`
- Dependencies: state.js, ui/modal-ui.js

## Workflow Steps (`steps/`)

### **input.js**
- Purpose: Step 1 - Import data from Omeka S API
- Key features: API authentication, data fetching, sample display
- Dependencies: utils/cors-proxy.js, data/mock-data.js

### **mapping.js**
- Purpose: Step 2 - Map Omeka fields to Wikidata properties
- Key features: Field analysis, property search, transformation setup
- Dependencies: mapping/*, transformations.js, api/wikidata.js

### **reconciliation.js**
- Purpose: Step 3 - Match entities with Wikidata items
- Key features: Batch processing, entity matching, progress tracking
- Dependencies: reconciliation/*, api/wikidata.js

### **step4.js**
- Purpose: Step 4 - Detect and display reference links
- Key features: Automatic reference detection, display with counts and examples
- Dependencies: references/core/detector.js, references/ui/display.js, events.js

### **export.js**
- Purpose: Step 5 - Generate QuickStatements for Wikidata import
- Key features: QuickStatements generation, batch export
- Dependencies: state.js, reconciliation data

## Feature Modules

### Mapping Module (`mapping/`)

#### Core (`mapping/core/`)

**data-analyzer.js**
- Purpose: Analyze Omeka data structure and extract fields
- Key exports: `extractAndAnalyzeKeys()`, `extractAvailableFields()`, `extractSampleValue()`

**property-searcher.js**
- Purpose: Search and suggest Wikidata properties
- Key exports: `searchWikidataProperties()`, `getAutoSuggestions()`, `selectProperty()`

**constraint-validator.js**
- Purpose: Validate and display property constraints
- Key exports: `displayPropertyConstraints()`, `createConstraintsSection()`

**transformation-engine.js**
- Purpose: Execute value transformations
- Key exports: `applyTransformations()`, `createTransformationPipeline()`

**mapping-persistence.js**
- Purpose: Save/load mapping configurations
- Key exports: `generateMappingData()`, `downloadMappingAsJson()`, `loadMappingFromData()`

#### UI (`mapping/ui/`)

**mapping-lists.js**
- Purpose: Manage mapping UI lists (non-linked, mapped, ignored)
- Key exports: `populateLists()`, `moveKeyToCategory()`, `mapKeyToProperty()`

**transformation-ui.js**
- Purpose: UI for transformation configuration
- Key exports: `renderTransformationBlocks()`, `updateTransformationPreview()`

**property-modals.js**
- Purpose: Property configuration modals
- Key exports: `openPropertyModal()`, `updatePropertyConfiguration()`

**constraint-ui.js**
- Purpose: Display constraint information in UI
- Key exports: `renderConstraints()`, `formatConstraintDisplay()`

#### Modals (`mapping/ui/modals/`)
- `mapping-modal.js` - Main mapping configuration modal
- `add-property-modal.js` - Add manual properties
- `manual-property-modal.js` - Configure manual property values
- `json-modal.js` - Import/export JSON configurations
- `modal-helpers.js` - Shared modal utilities

### Reconciliation Module (`reconciliation/`)

#### Core (`reconciliation/core/`)

**entity-matcher.js**
- Purpose: Match items with Wikidata entities
- Key exports: `reconcileEntity()`, `searchWikidataEntities()`, `scoreMatch()`

**batch-processor.js**
- Purpose: Process reconciliation in batches
- Key exports: `processBatch()`, `createBatchQueue()`, `updateBatchProgress()`

**reconciliation-data.js**
- Purpose: Manage reconciliation data and results
- Key exports: `storeReconciliationResult()`, `getReconciliationStatus()`

**reconciliation-progress.js**
- Purpose: Track reconciliation progress
- Key exports: `updateProgress()`, `calculateCompletion()`, `getProgressStats()`

#### UI (`reconciliation/ui/`)

**reconciliation-table.js**
- Purpose: Display reconciliation results in table
- Key exports: `renderReconciliationTable()`, `updateTableRow()`, `updateItemCellDisplay()`
- Features: Item cell with link button to link items to existing Wikidata items

**reconciliation-modal.js**
- Purpose: Reconciliation configuration and details modal
- Key exports: `openReconciliationModal()`, `displayMatchDetails()`

**reconciliation-display.js**
- Purpose: Format and display reconciliation information
- Key exports: `formatReconciliationStatus()`, `displayMatchScore()`

**validation-engine.js**
- Purpose: Enhanced validation system for string properties and external identifiers
- Key exports: `extractRegexConstraints()`, `validateStringValue()`, `validateRealTime()`, `searchWikidataLanguages()`
#### Modals (`reconciliation/ui/modals/`)

**modal-factory.js**
- Purpose: Central factory for creating reconciliation modals by data type
- Key exports: `createReconciliationModalByType()`, `initializeReconciliationModal()`, `isModalTypeSupported()`
- Supported types: wikibase-item, string, time, monolingualtext, external-id

**wikidata-item-modal.js**
- Purpose: Wikidata entity reconciliation modal interface
- Key exports: `createWikidataItemModal()`, `initializeWikidataItemModal()`

**string-modal.js**
- Purpose: String and monolingual text reconciliation modal interface
- Key exports: `createStringModal()`, `initializeStringModal()`

**time-modal.js**
- Purpose: Point-in-time (date) reconciliation modal with precision detection
- Key exports: `createTimeModal()`, `initializeTimeModal()`

**external-id-modal.js**
- Purpose: External identifier validation modal with regex constraints
- Key exports: `createExternalIdModal()`, `initializeExternalIdModal()`
- Features: Real-time regex validation, user override capability, property constraint display

**link-item-modal.js**
- Purpose: Link items to existing Wikidata items instead of creating new ones
- Key exports: `createLinkItemModal()`, `initializeLinkItemModal()`
- Features: Search Wikidata items, display results with label/QID/description, select to link
- Impact: Linked items generate UPDATE statements instead of CREATE in export

### References Module (`references/`)

#### Core (`references/core/`)

**detector.js**
- Purpose: Detect reference links from Omeka S API data
- Key exports: `detectReferences()`, `detectOmekaItemLink()`, `detectOCLCLinks()`, `detectARKIdentifiers()`, `getReferenceTypeLabel()`, `getReferenceTypeDescription()`
- Reference types: Omeka API Item links, OCLC WorldCat links, ARK identifiers
- Returns: Item-specific references with summary statistics and base URLs

**custom-references.js**
- Purpose: Manage user-created custom references
- Key exports: `createCustomReference()`, `validateCustomReference()`, `convertAutoDetectedToEditable()`, `getDisplayBaseUrl()`
- Features: Create and validate custom references, convert auto-detected to editable format

#### UI (`references/ui/`)

**display.js**
- Purpose: Render reference detection results with counts, tooltips, and editing capabilities
- Key exports: `renderReferencesSection()`, `createReferenceListItem()`, `createCustomReferenceListItem()`, `createTooltip()`
- Features: Reference list with selection/ignore toggle, position-preserved custom replacements, base URL display

**custom-reference-modal.js**
- Purpose: Modal interface for adding and editing custom references
- Key exports: `openCustomReferenceModal()`
- Features: Item-specific URL inputs, pre-filled editing, complete data preservation

### Index Files
- `mapping/index.js` - Re-exports all mapping module functions
- `reconciliation/index.js` - Re-exports all reconciliation functions

## Utilities & Helpers

### **transformations.js**
- Purpose: Data transformation engine
- Key exports: `BLOCK_TYPES`, `applyTransformation()`, `applyTransformationChain()`, `createTransformationBlock()`
- Features: Regex, find/replace, prefix/suffix, compose, split/join

### **api/wikidata.js**
- Purpose: Wikidata API interface with caching
- Key exports: `getPropertyInfo()`, `getPropertyConstraints()`, `fetchEntityLabels()`, `getCompletePropertyData()`
- Features: Request caching, batch fetching, error handling

### **utils/cors-proxy.js**
- Purpose: Handle CORS issues with external APIs
- Key exports: `fetchWithCorsProxy()`, `getCorsExplanation()`, `generateCorsConfig()`

### **utils/property-types.js**
- Purpose: Property type detection and input handling
- Key exports: `detectPropertyType()`, `createInputHTML()`, `validateInput()`, `detectDatePrecision()`

### **utils/constraint-helpers.js**
- Purpose: Property constraint analysis
- Key exports: `getConstraintBasedTypes()`, `validateAgainstFormatConstraints()`, `scoreMatchWithConstraints()`

## UI Components (`ui/`)

### **components.js**
- Purpose: Factory functions for creating DOM elements
- Key exports: `createElement()`, `createButton()`, `createInput()`, `createModal()`, `showMessage()`
- Note: ALWAYS use these instead of `document.createElement()`

### **modal-ui.js**
- Purpose: Modal window management
- Key exports: `createModalContainer()`, `showModal()`, `closeModal()`

### **modal-content.js**
- Purpose: Generate modal content
- Key exports: `getMappingModalContent()`, `getReconciliationModalContent()`

### **navigation-ui.js**
- Purpose: Navigation interface elements
- Key exports: `setupNavigationUI()`, `updateStepIndicator()`

### **project-modal-content.js**
- Purpose: Project save/load modal content
- Key exports: `getSaveProjectModalContent()`, `getLoadProjectModalContent()`

## Data & Mock (`data/`)

### **mock-data.js**
- Purpose: Test data for development
- Key exports: `getMockItemsData()`, `getMockMappingData()`, `getMockReconciliationData()`

## Prototypes (`prototypes/`)
Experimental features and standalone utilities:
- `api/fetch.js` - API fetching experiments
- `ui/` - UI component prototypes
- `utils/` - Utility function experiments
- Note: Not part of main application flow

## Common Tasks

### Adding a New Transformation Type
1. Add type to `BLOCK_TYPES` in `transformations.js`
2. Add metadata to `BLOCK_METADATA`
3. Implement transformation logic in `applyTransformation()`
4. Add UI rendering in `mapping/ui/transformation-ui.js`

### Modifying Wikidata API Calls
1. Edit `api/wikidata.js`
2. Update caching logic if needed
3. Handle errors consistently with existing patterns

### Adding a New Workflow Step
1. Create new file in `steps/`
2. Export `setup[StepName]Step(state)` function
3. Import and initialize in `app.js`
4. Add navigation logic in `navigation.js`
5. Update step count in navigation UI

### Creating a New Modal
1. Create content generator in appropriate `ui/` file
2. Register modal handler in `modals.js`
3. Emit event to open: `eventSystem.emit('modal:open', {...})`

### Adding State Properties
1. Add to `initialState` in `state.js`
2. Create convenience methods if needed
3. Emit appropriate events on changes
4. Update persistence logic if needed

## Module Dependencies Graph
```
app.js
├── state.js ←── events.js
├── navigation.js
├── modals.js
└── steps/
    ├── input.js ←── utils/cors-proxy.js
    ├── mapping.js ←── mapping/* + transformations.js
    ├── reconciliation.js ←── reconciliation/*
    ├── step4.js ←── references/*
    └── export.js

api/wikidata.js ← used by mapping & reconciliation
ui/components.js ← used by all UI modules
```

## File Size Guidelines
- Maximum 1000 lines per JavaScript file
- Split large modules into `core/` and `ui/` subdirectories
- Use index.js files to re-export public APIs