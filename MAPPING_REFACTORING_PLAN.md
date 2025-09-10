# Mapping.js Refactoring Strategy & Implementation Plan

## 📋 Executive Summary

This document provides a comprehensive, step-by-step plan for refactoring the 3,726-line `mapping.js` file into a maintainable, modular architecture. The strategy focuses on **splitting files without changing existing code logic**, ensuring robustness and minimal risk during the refactoring process.

**Current State:** Single monolithic file with 65+ functions handling multiple concerns
**Target State:** Modular architecture with 7-8 focused modules, each under 500 lines
**Estimated Timeline:** 2-3 weeks for complete refactoring
**Risk Level:** Low (code-preserving approach)

---

## 🎯 Refactoring Objectives

### Primary Goals
- **Maintainability**: Reduce cognitive load from 3,726 lines to manageable modules
- **Testability**: Enable unit testing of individual concerns
- **Collaboration**: Reduce merge conflicts and enable parallel development
- **Performance**: Enable lazy loading and better code splitting
- **Code Reuse**: Extract reusable components for other modules

### Non-Goals (What We WON'T Change)
- ✅ Existing function logic and algorithms
- ✅ Function signatures and APIs
- ✅ State management patterns
- ✅ UI behavior and user experience
- ✅ Integration with other modules

---

## 🔍 Current Architecture Analysis

### Function Inventory (65 functions identified)

| Domain | Function Count | Current Lines | Target Module |
|--------|----------------|---------------|---------------|
| Data Analysis | 8 functions | ~800 lines | `data-analyzer.js` |
| UI List Management | 12 functions | ~600 lines | `mapping-lists.js` |
| Property Search | 10 functions | ~500 lines | `property-searcher.js` |
| Modal Management | 15 functions | ~900 lines | `property-modals.js` |
| Transformation Engine | 20 functions | ~1000 lines | `transformation-engine.js` |
| File Operations | 4 functions | ~200 lines | `mapping-persistence.js` |
| Constraints & Validation | 6 functions | ~300 lines | `constraint-validator.js` |
| **Orchestration** | Remaining | ~400 lines | `mapping.js` (refactored) |

### Dependencies Analysis
```
mapping.js currently depends on:
├── ../events.js
├── ../ui/components.js
├── ../api/wikidata.js
└── ../transformations.js

Target: Each module will have minimal, focused dependencies
```

---

## 🏗️ Target Architecture

### Directory Structure
```
src/js/mapping/
├── core/
│   ├── data-analyzer.js           # Omeka S data analysis
│   ├── property-searcher.js       # Wikidata property search
│   ├── transformation-engine.js   # Value transformation logic
│   ├── mapping-persistence.js     # Save/load functionality
│   └── constraint-validator.js    # Property constraints & validation
├── ui/
│   ├── mapping-lists.js           # Three-column interface management
│   ├── property-modals.js         # Modal creation and management
│   ├── transformation-ui.js       # Transformation interface components
│   └── constraint-ui.js           # Constraint display components
└── index.js                       # Public API exports

src/js/steps/mapping.js             # Slim orchestrator (300-500 lines)
```

### Module Responsibilities

#### Core Modules (Business Logic)

**`data-analyzer.js`** - Pure data processing
- `fetchContextDefinitions(contextUrl)`
- `extractAndAnalyzeKeys(data)`
- `extractSampleValue(value)`
- `convertCamelCaseToSpaces(text)`
- `extractAvailableFields(sampleValue)`
- `getFieldValueFromSample(sampleValue, fieldKey)`

**`property-searcher.js`** - Property search logic
- `setupPropertySearch(keyData)`
- `searchWikidataProperties(query, container)`
- `getAutoSuggestions(query)`
- `displayPropertySuggestions(wikidataResults, autoSuggestions, container)`
- `selectProperty(property)`

**`transformation-engine.js`** - Value transformation logic
- `renderTransformationBlocks(propertyId, sampleValue, container, state)`
- `addTransformationBlock(propertyId, blockType, state)`
- `updateTransformationPreview(propertyId, state)`
- `refreshTransformationUI(propertyId, state)`
- All transformation-related functions (~20 functions)

**`mapping-persistence.js`** - Data persistence
- `generateMappingData(state)`
- `downloadMappingAsJson(mappingData)`
- `loadMappingFromData(mappingData, state)`

**`constraint-validator.js`** - Property constraint handling
- `displayPropertyConstraints(propertyId)`
- `createConstraintsSection(constraints)`
- `formatValueTypeConstraintsCompact(valueTypeConstraints)`

#### UI Modules (Presentation Logic)

**`mapping-lists.js`** - List interface management
- `populateLists()`
- `updateSectionCounts(mappings)`
- `populateKeyList(listElement, keys, type)`
- `populateManualPropertiesList(listElement, manualProperties)`
- `moveKeyToCategory(keyData, category)`

**`property-modals.js`** - Modal management
- `openMappingModal(keyData)`
- `createMappingModalContent(keyData)`
- `openManualPropertyModal()`
- `openAddManualPropertyModal()`
- All modal-related functions (~15 functions)

---

## 🚀 Implementation Plan

### Phase 1: Foundation Setup (Day 1)
**Goal:** Establish module structure and tooling
**Time:** 2-4 hours

#### Step 1.1: Create Directory Structure
```bash
mkdir -p src/js/mapping/core
mkdir -p src/js/mapping/ui
touch src/js/mapping/core/data-analyzer.js
touch src/js/mapping/core/property-searcher.js
touch src/js/mapping/core/transformation-engine.js
touch src/js/mapping/core/mapping-persistence.js
touch src/js/mapping/core/constraint-validator.js
touch src/js/mapping/ui/mapping-lists.js
touch src/js/mapping/ui/property-modals.js
touch src/js/mapping/ui/transformation-ui.js
touch src/js/mapping/ui/constraint-ui.js
touch src/js/mapping/index.js
```

#### Step 1.2: Create Module Templates
Each module should start with this template:
```javascript
/**
 * [Module Description]
 * @module mapping/[module-name]
 */

// Import dependencies (minimal)
import { ... } from '../../...';

// Export functions (maintain exact signatures)
export function functionName(...args) {
    // Moved implementation from mapping.js
    // NO LOGIC CHANGES - pure copy/paste
}
```

### Phase 2: Extract Pure Business Logic (Days 2-4)
**Goal:** Move side-effect-free functions first (lowest risk)
**Time:** 8-12 hours

#### Step 2.1: Extract `data-analyzer.js` (Safest First)
**Functions to move:**
```javascript
export async function fetchContextDefinitions(contextUrl) { /* copy from mapping.js */ }
export async function extractAndAnalyzeKeys(data) { /* copy from mapping.js */ }
export function extractSampleValue(value) { /* copy from mapping.js */ }
export function convertCamelCaseToSpaces(text) { /* copy from mapping.js */ }
export function extractAvailableFields(sampleValue) { /* copy from mapping.js */ }
export function getFieldValueFromSample(sampleValue, fieldKey) { /* copy from mapping.js */ }
```

**Migration Process:**
1. Copy functions to `data-analyzer.js` (exact copy, no changes)
2. Add imports to `mapping.js`: `import { extractSampleValue, ... } from './mapping/core/data-analyzer.js';`
3. Test thoroughly - all functionality should work identically
4. Once confirmed working, delete original functions from `mapping.js`

#### Step 2.2: Extract `mapping-persistence.js`
**Functions to move:**
```javascript
export function generateMappingData(state) { /* copy from mapping.js */ }
export function downloadMappingAsJson(mappingData) { /* copy from mapping.js */ }
export async function loadMappingFromData(mappingData, state) { /* copy from mapping.js */ }
```

#### Step 2.3: Extract `constraint-validator.js`
**Functions to move:**
```javascript
export async function displayPropertyConstraints(propertyId) { /* copy from mapping.js */ }
export function createConstraintsSection(constraints) { /* copy from mapping.js */ }
export function createCompactConstraint(title, explanation, details) { /* copy from mapping.js */ }
export function formatValueTypeConstraintsCompact(valueTypeConstraints) { /* copy from mapping.js */ }
export function formatFormatConstraintsCompact(formatConstraints) { /* copy from mapping.js */ }
export function formatOtherConstraintsCompact(otherConstraints) { /* copy from mapping.js */ }
```

### Phase 3: Extract Search Logic (Days 5-7)
**Goal:** Move property search functionality
**Time:** 8-10 hours

#### Step 3.1: Extract `property-searcher.js`
**Functions to move:**
```javascript
export function setupPropertySearch(keyData) { /* copy from mapping.js */ }
export async function searchWikidataProperties(query, container) { /* copy from mapping.js */ }
export function getAutoSuggestions(query) { /* copy from mapping.js */ }
export function displayPropertySuggestions(wikidataResults, autoSuggestions, container) { /* copy from mapping.js */ }
export function createPropertySuggestionItem(property, isPrevious) { /* copy from mapping.js */ }
export async function selectProperty(property) { /* copy from mapping.js */ }
export async function transitionToDataTypeConfiguration(property) { /* copy from mapping.js */ }
export async function displayDataTypeConfiguration(property) { /* copy from mapping.js */ }
export function setupManualPropertySearch(existingProperty) { /* copy from mapping.js */ }
export async function searchManualPropertyWikidataProperties(query, container) { /* copy from mapping.js */ }
```

### Phase 4: Extract Transformation Engine (Days 8-10)
**Goal:** Move complex transformation logic
**Time:** 12-16 hours (largest module)

#### Step 4.1: Extract `transformation-engine.js`
**Functions to move (20+ functions):**
```javascript
export function renderValueTransformationUI(keyData, state) { /* copy from mapping.js */ }
export function renderTransformationBlocks(propertyId, sampleValue, container, state) { /* copy from mapping.js */ }
export function renderTransformationBlockUI(propertyId, block, state) { /* copy from mapping.js */ }
export function renderBlockConfigUI(propertyId, block, state) { /* copy from mapping.js */ }
// ... all transformation-related functions
export function addTransformationBlock(propertyId, blockType, state) { /* copy from mapping.js */ }
export function updateTransformationPreview(propertyId, state) { /* copy from mapping.js */ }
export function refreshTransformationUI(propertyId, state) { /* copy from mapping.js */ }
```

**Note:** This is the most complex module - take extra care with testing.

### Phase 5: Extract UI Components (Days 11-13)
**Goal:** Move UI management functions
**Time:** 10-12 hours

#### Step 5.1: Extract `mapping-lists.js`
**Functions to move:**
```javascript
export async function populateLists() { /* copy from mapping.js */ }
export function updateSectionCounts(mappings) { /* copy from mapping.js */ }
export function populateKeyList(listElement, keys, type) { /* copy from mapping.js */ }
export function populateManualPropertiesList(listElement, manualProperties) { /* copy from mapping.js */ }
export function moveKeyToCategory(keyData, category) { /* copy from mapping.js */ }
export function mapKeyToProperty(keyData, property) { /* copy from mapping.js */ }
export function moveToNextUnmappedKey() { /* copy from mapping.js */ }
```

#### Step 5.2: Extract `property-modals.js`
**Functions to move:**
```javascript
export function openMappingModal(keyData) { /* copy from mapping.js */ }
export function createMappingModalContent(keyData) { /* copy from mapping.js */ }
export function openManualPropertyEditModal(manualProp) { /* copy from mapping.js */ }
export function createConsolidatedMetadataModalContent(manualProp) { /* copy from mapping.js */ }
export function openAddManualPropertyModal() { /* copy from mapping.js */ }
export function createAddManualPropertyModalContent(existingProperty) { /* copy from mapping.js */ }
export function openRawJsonModal(propertyData) { /* copy from mapping.js */ }
```

### Phase 6: Create Public API (Day 14)
**Goal:** Establish clean public interface
**Time:** 2-4 hours

#### Step 6.1: Create `mapping/index.js`
```javascript
/**
 * Public API for mapping functionality
 * @module mapping
 */

// Re-export all public functions
export * from './core/data-analyzer.js';
export * from './core/property-searcher.js';
export * from './core/transformation-engine.js';
export * from './core/mapping-persistence.js';
export * from './core/constraint-validator.js';
export * from './ui/mapping-lists.js';
export * from './ui/property-modals.js';
```

#### Step 6.2: Refactor `mapping.js` to Orchestrator
**Target size:** 300-500 lines
**Responsibilities:**
- Event system integration
- DOM element initialization
- State management coordination
- Module orchestration
- Error handling and logging

```javascript
/**
 * Mapping step orchestrator - coordinates all mapping functionality
 * @module steps/mapping
 */

import { 
    extractAndAnalyzeKeys,
    populateLists,
    openMappingModal,
    generateMappingData,
    // ... other functions
} from '../mapping/index.js';

export function setupMappingStep(state) {
    // Slim orchestration logic only
    // All heavy lifting delegated to modules
}
```

---

## 🧪 Testing Strategy

### Per-Module Testing
Each extracted module should be independently testable:

```javascript
// Example: data-analyzer.test.js
import { extractSampleValue, convertCamelCaseToSpaces } from '../src/js/mapping/core/data-analyzer.js';

describe('Data Analyzer', () => {
    test('extractSampleValue handles arrays', () => {
        const input = [{"@value": "Test"}];
        const result = extractSampleValue(input);
        expect(result).toEqual({"@value": "Test"});
    });
    
    test('convertCamelCaseToSpaces formats correctly', () => {
        expect(convertCamelCaseToSpaces('dctermsCreated')).toBe('dcterms Created');
    });
});
```

### Integration Testing
Ensure the orchestrator works with all modules:

```javascript
// mapping-integration.test.js
import { setupMappingStep } from '../src/js/steps/mapping.js';

describe('Mapping Integration', () => {
    test('setupMappingStep initializes all modules', () => {
        // Test full workflow
    });
});
```

### Manual Testing Checklist
After each phase, verify:
- [ ] All existing functionality works identically
- [ ] No regression in user experience
- [ ] Performance is maintained or improved
- [ ] Browser dev tools show no new errors
- [ ] State management continues working
- [ ] File import/export still functional

---

## ⚠️ Risk Mitigation

### Low-Risk Approach
1. **Copy First, Delete Later**: Never modify and move simultaneously
2. **Test After Each Module**: Confirm functionality before proceeding
3. **Maintain API Contracts**: Keep exact function signatures
4. **Use Git Branches**: Each phase in a separate branch
5. **Rollback Plan**: Keep working version always accessible

### Common Pitfalls to Avoid
- ❌ **Don't refactor logic while moving**: Pure copy/paste only
- ❌ **Don't change function signatures**: Maintain exact APIs  
- ❌ **Don't move too many functions at once**: Small, testable chunks
- ❌ **Don't skip testing phases**: Each module must work in isolation
- ❌ **Don't break state management**: Preserve state patterns

### Rollback Strategy
If any phase introduces bugs:
1. Revert to previous working commit
2. Identify the problematic function(s)
3. Move smaller subset of functions
4. Test more thoroughly before proceeding

---

## 📊 Success Metrics

### Code Quality Metrics
- **File Size**: mapping.js reduced from 3,726 to <500 lines
- **Function Count**: No single module >15 functions
- **Cyclomatic Complexity**: Each module <10 average complexity
- **Test Coverage**: >80% coverage for each extracted module

### Developer Experience Metrics
- **Build Time**: No regression in build performance
- **IDE Performance**: Better IntelliSense and navigation
- **Merge Conflicts**: Reduced conflicts in mapping-related changes
- **Onboarding Time**: New developers can understand individual modules

### Maintenance Metrics
- **Bug Localization**: Issues isolated to specific modules
- **Feature Addition**: New features require changes to fewer files
- **Code Reuse**: Transformation engine reused in other modules

---

## 🔄 Long-term Benefits

### Immediate Benefits (Week 1)
- Reduced cognitive load when working on mapping features
- Easier debugging with smaller, focused modules
- Improved IDE performance and navigation

### Medium-term Benefits (Month 1)
- Independent testing of each concern
- Parallel development on different aspects
- Easier code reviews with focused changes

### Long-term Benefits (Quarter 1)
- Reusable transformation engine for other steps
- Plugin architecture for custom transformations  
- Better performance with lazy loading
- Foundation for micro-frontend architecture

---

## 📝 Implementation Checklist

### Pre-Refactoring Setup
- [ ] Create feature branch: `refactor/mapping-modularization`
- [ ] Backup current working state
- [ ] Set up testing framework for new modules
- [ ] Document current API surface for regression testing

### Phase 1 - Foundation (Day 1)
- [ ] Create directory structure
- [ ] Set up module templates
- [ ] Configure import/export patterns
- [ ] Test basic import structure

### Phase 2 - Business Logic (Days 2-4)
- [ ] Extract `data-analyzer.js`
- [ ] Extract `mapping-persistence.js`
- [ ] Extract `constraint-validator.js`
- [ ] Test each module independently
- [ ] Integration test with main mapping.js

### Phase 3 - Search Logic (Days 5-7)
- [ ] Extract `property-searcher.js`
- [ ] Test search functionality
- [ ] Verify autocomplete still works
- [ ] Check property selection flow

### Phase 4 - Transformation Engine (Days 8-10)
- [ ] Extract `transformation-engine.js`
- [ ] Test all transformation types
- [ ] Verify preview functionality
- [ ] Check drag-and-drop behavior

### Phase 5 - UI Components (Days 11-13)
- [ ] Extract `mapping-lists.js`
- [ ] Extract `property-modals.js`
- [ ] Test list updates and modal behavior
- [ ] Verify state synchronization

### Phase 6 - Finalization (Day 14)
- [ ] Create public API in `index.js`
- [ ] Refactor `mapping.js` to orchestrator
- [ ] Final integration testing
- [ ] Performance verification
- [ ] Documentation updates

### Post-Refactoring
- [ ] Comprehensive regression testing
- [ ] Code review with team
- [ ] Update documentation
- [ ] Merge to main branch
- [ ] Monitor for issues in production

---

## 🔗 References

### Related Documentation
- [CLAUDE.md](./CLAUDE.md) - Project conventions
- [02-architecture.md](./specs/02-architecture.md) - System architecture
- [JavaScript Module Patterns](https://addyosmani.com/resources/essentialjsdesignpatterns/) - Design patterns reference

### Tools and Resources  
- **ESLint**: Ensure consistent code style across modules
- **Jest**: Testing framework for module testing
- **JSDoc**: Documentation generation for new modules
- **Import/Export Analyzer**: Visualize module dependencies

---

*This refactoring plan transforms a 3,726-line monolith into a maintainable, modular architecture while preserving all existing functionality. The strategy prioritizes safety, testability, and developer experience.*

**Last Updated**: 2025-09-10
**Document Version**: 1.0
**Estimated Implementation Time**: 2-3 weeks
**Risk Level**: Low (code-preserving approach)