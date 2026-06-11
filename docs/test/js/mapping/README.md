# Mapping Module Architecture

**[← Back to Technical Documentation](../../../docs/DOCUMENTATION.md)**

## Overview
The mapping module handles the complex process of mapping Omeka S metadata fields to Wikidata properties. It's organized into core business logic and UI presentation layers for better maintainability and testability.

## Module Structure

### Core Modules (Business Logic)
Located in `/core/`:

- **data-analyzer.js** (444 lines)
  - Analyzes Omeka S data structures and extracts metadata
  - Processes context definitions and sample values
  - Pure data processing with no UI dependencies
  - Functions: `fetchContextDefinitions()`, `extractAndAnalyzeKeys()`, `extractSampleValue()`, etc.

- **property-searcher.js** (658 lines)
  - Wikidata property search logic and API integration
  - Auto-suggestion algorithms and property selection
  - Search result processing and filtering
  - Functions: `setupPropertySearch()`, `searchWikidataProperties()`, `getAutoSuggestions()`, etc.

- **transformation-engine.js** (111 lines after refactor)
  - Transformation pipeline management and orchestration
  - Block execution logic and state coordination
  - Business logic only - UI moved to transformation-ui.js
  - Functions: `addTransformationBlock()`, `updateTransformationPreview()`, `refreshTransformationUI()`

- **mapping-persistence.js** (151 lines)
  - Save/load mapping configurations to/from JSON
  - Data serialization and deserialization
  - File generation and import handling
  - Functions: `generateMappingData()`, `downloadMappingAsJson()`, `loadMappingFromData()`

- **constraint-validator.js** (86 lines after refactor)
  - Property constraint validation and data fetching
  - Constraint checking logic coordination
  - Business logic only - UI moved to constraint-ui.js
  - Functions: `displayPropertyConstraints()`

### UI Modules (Presentation Layer)
Located in `/ui/`:

- **mapping-lists.js** (530 lines)
  - Three-column list interface management
  - Drag-and-drop functionality and list operations
  - Category management (mapped, unmapped, ignored)
  - Functions: `populateLists()`, `updateSectionCounts()`, `moveKeyToCategory()`, etc.

- **property-modals.js** (13 lines after refactor)
  - Modal orchestrator that re-exports all modal modules
  - Maintains 100% backward compatibility
  - Delegates to specialized modal modules
  - Re-exports: All functions from modals/* modules

- **transformation-ui.js** (792 lines after refactor)
  - Transformation block rendering and visual pipeline
  - Drag-and-drop UI for transformation blocks
  - All transformation rendering logic
  - Functions: `renderValueTransformationUI()`, `renderTransformationBlocks()`, etc.

- **constraint-ui.js** (160 lines after refactor)
  - Constraint display formatting and visualization
  - Compact constraint indicators and expandable details
  - Visual constraint representation
  - Functions: `createConstraintsSection()`, `formatValueTypeConstraintsCompact()`, etc.

### Modal Modules (Specialized UI)
Located in `/ui/modals/`:

- **mapping-modal.js** (150 lines)
  - Main property mapping modal interface
  - Three-stage property mapping workflow
  - Functions: `openMappingModal()`, `createMappingModalContent()`, `updateModalTitle()`

- **manual-property-modal.js** (230 lines)
  - Manual property editing and management
  - Unified property modal content creation
  - Functions: `openManualPropertyEditModal()`, `createUnifiedPropertyModalContent()`, `selectManualProperty()`

- **add-property-modal.js** (50 lines)
  - Adding new manual properties interface
  - Property addition workflow management
  - Functions: `openAddManualPropertyModal()`, `addManualPropertyToState()`

- **json-modal.js** (40 lines)
  - Raw JSON property data viewer
  - Property data inspection and copying
  - Functions: `openRawJsonModal()`

- **modal-helpers.js** (120 lines)
  - Shared modal utility functions
  - Sample value formatting and URI generation
  - Functions: `formatSampleValue()`, `makeJsonKeysClickable()`, `generateUriForKey()`

## API Reference

### Public Exports
All functions remain available through their original import paths for 100% backward compatibility:

```javascript
// Original imports still work exactly as before:
import { openMappingModal } from '../mapping/ui/property-modals.js';
import { addTransformationBlock } from '../mapping/core/transformation-engine.js';

// New modular imports also available for more specific usage:
import { openMappingModal } from '../mapping/ui/modals/mapping-modal.js';
import { renderTransformationBlocks } from '../mapping/ui/transformation-ui.js';
```

### Main Orchestrator
Located at `/steps/mapping.js` (198 lines after refactor):

```javascript
import { setupMappingStep } from './steps/mapping.js';

// Coordinates all mapping functionality
setupMappingStep(state);
```

The orchestrator handles:
- DOM element initialization and event binding
- State synchronization when navigating to mapping step
- File import/export functionality
- Integration with broader application workflow

### State Management
All modules rely on the global application state passed through function parameters. No internal state is maintained within mapping modules.

Key state operations:
- `state.updateState(path, value)` - Update state values
- `state.getState()` - Retrieve current state
- `state.markChangesUnsaved()` - Mark changes as unsaved
- `state.addTransformationBlock(propertyId, block)` - Add transformation
- `state.getTransformationBlocks(propertyId)` - Get transformations

### Event System Integration
Modules publish events through the global event system:
- Property selection changes
- Transformation updates
- Mapping category changes
- Progress updates

## File Size Improvements

### Before Refactor:
- `property-modals.js`: 1,060 lines
- `transformation-engine.js`: 879 lines  
- `constraint-validator.js`: 234 lines
- `mapping.js`: 3,726 lines → 198 lines

### After Refactor:
- `property-modals.js`: 13 lines (orchestrator)
- `transformation-engine.js`: 111 lines (business logic only)
- `constraint-validator.js`: 86 lines (business logic only)
- All new modal modules: ~200-250 lines each
- Enhanced transformation-ui.js: 792 lines
- Enhanced constraint-ui.js: 160 lines

**Total reduction**: From single 3,726-line file to distributed architecture with largest module being 792 lines.

## Benefits Achieved

### ✅ Better Maintainability
- Smaller, focused modules (largest is now 792 lines vs 3,726)
- Clear separation of concerns (UI vs business logic)
- Easier code navigation and understanding

### ✅ 100% Backward Compatibility  
- All existing import paths continue to work
- No breaking changes to any consumer code
- Gradual adoption of new modular imports possible

### ✅ Enhanced Developer Experience
- Better IDE performance and IntelliSense
- Easier debugging with isolated concerns
- Clearer code organization and module boundaries

### ✅ Improved Testability
- Each module can be tested independently
- Business logic separated from UI rendering
- Easier to mock dependencies in tests

### ✅ Better Code Reusability
- UI components can be reused across different contexts
- Business logic modules can be used independently
- Shared utilities properly organized

## Testing

### Unit Testing Strategy
Each module can now be independently tested:

```javascript
// Test business logic
import { addTransformationBlock } from './core/transformation-engine.js';
import { extractSampleValue } from './core/data-analyzer.js';

// Test UI rendering
import { renderTransformationBlockUI } from './ui/transformation-ui.js';
import { createConstraintsSection } from './ui/constraint-ui.js';

// Test modal functionality  
import { createMappingModalContent } from './ui/modals/mapping-modal.js';
```

### Integration Testing
Verify that the orchestrator properly coordinates all modules:

```javascript
import { setupMappingStep } from './steps/mapping.js';

// Test that all modules work together seamlessly
```

### Manual Testing Checklist
✅ All existing functionality works identically
✅ No regression in user experience  
✅ Performance maintained or improved
✅ Browser dev tools show no new errors
✅ State management continues working correctly
✅ File import/export remains functional

## Architecture Patterns

### Re-export Pattern
Used extensively to maintain backward compatibility:

```javascript
// transformation-engine.js
export * from '../ui/transformation-ui.js';  // Re-export UI functions
// Local business logic functions also exported
```

### Module Orchestration
Clear separation between orchestrators and implementors:

```javascript
// property-modals.js (orchestrator)
export * from './modals/mapping-modal.js';
export * from './modals/manual-property-modal.js';
// etc.
```

### Circular Dependency Avoidance
Dynamic imports used to prevent circular dependencies:

```javascript
// transformation-ui.js
import('../core/transformation-engine.js').then(({ refreshTransformationUI }) => {
    refreshTransformationUI(propertyId, state);
});
```

---

*This modular architecture transforms a 3,726-line monolithic file into a maintainable, testable system while preserving complete backward compatibility and enhancing developer experience.*

**Last Updated**: 2025-01-09
**Architecture Version**: 2.0  
**Backward Compatibility**: 100%
**Performance Impact**: Neutral to positive