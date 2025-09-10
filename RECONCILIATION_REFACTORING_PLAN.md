# Reconciliation.js Refactoring Strategy & Implementation Plan

## 📋 Executive Summary

This document provides a comprehensive, step-by-step plan for refactoring the 3,147-line `reconciliation.js` file into a maintainable, modular architecture. The strategy focuses on **splitting files without changing existing code logic**, ensuring robustness and minimal risk during the refactoring process.

**Current State:** Single monolithic file with 50+ functions handling multiple concerns
**Target State:** Modular architecture with 6-7 focused modules, each under 500 lines
**Estimated Timeline:** 2-3 weeks for complete refactoring
**Risk Level:** Low (code-preserving approach)

---

## 🎯 Refactoring Objectives

### Primary Goals
- **Maintainability**: Reduce cognitive load from 3,147 lines to manageable modules
- **Testability**: Enable unit testing of individual reconciliation concerns
- **Collaboration**: Reduce merge conflicts and enable parallel development
- **Performance**: Enable lazy loading and better code splitting
- **Code Reuse**: Extract reusable reconciliation components for other modules

### Non-Goals (What We WON'T Change)
- ✅ Existing function logic and reconciliation algorithms
- ✅ Function signatures and APIs
- ✅ State management patterns and reconciliation data structures
- ✅ UI behavior and modal interfaces
- ✅ Integration with constraint validation and property types
- ✅ OpenRefine-inspired reconciliation workflow

---

## 🔍 Current Architecture Analysis

### Function Inventory (50+ functions identified)

| Domain | Function Count | Current Lines | Target Module |
|--------|----------------|---------------|---------------|
| Data Processing & Analysis | 8 functions | ~500 lines | `reconciliation-data.js` |
| Table Generation & UI | 12 functions | ~800 lines | `reconciliation-table.js` |
| Modal Interface | 15 functions | ~900 lines | `reconciliation-modal.js` |
| Entity Matching Engine | 10 functions | ~600 lines | `entity-matcher.js` |
| Progress & State Management | 8 functions | ~400 lines | `reconciliation-progress.js` |
| Batch Processing | 7 functions | ~500 lines | `batch-processor.js` |
| **Orchestration** | Remaining | ~400 lines | `reconciliation.js` (refactored) |

### Dependencies Analysis
```
reconciliation.js currently depends on:
├── ../ui/modal-ui.js
├── ../utils/property-types.js  
├── ../utils/constraint-helpers.js
├── ../events.js
├── ../data/mock-data.js
└── ../ui/components.js

Target: Each module will have minimal, focused dependencies
```

---

## 🏗️ Target Architecture

### Directory Structure
```
src/js/reconciliation/
├── core/
│   ├── reconciliation-data.js      # Data structures and initialization
│   ├── entity-matcher.js           # Matching algorithms and API calls
│   ├── batch-processor.js          # Batch processing and auto-acceptance
│   └── reconciliation-progress.js  # Progress tracking and state management
├── ui/
│   ├── reconciliation-table.js     # Table generation and cell management
│   ├── reconciliation-modal.js     # Modal interface and user interactions
│   └── reconciliation-display.js   # Display helpers and UI utilities
└── index.js                        # Public API exports

src/js/steps/reconciliation.js       # Slim orchestrator (300-500 lines)
```

### Module Responsibilities

#### Core Modules (Business Logic)

**`reconciliation-data.js`** - Data processing and structures
- `initializeReconciliation()`
- `calculateTotalReconciliableCells(data, mappedKeys, manualProperties)`
- `extractPropertyValues(item, key)`
- `combineAndSortProperties(mappedKeys, manualProperties)`
- `loadMockDataForTesting()`
- `getOriginalKeyInfo(itemId, property)`
- `generateLodUri(property, originalData)`
- `getReconciliationRequirementReason(property)`

**`entity-matcher.js`** - Core matching algorithms
- `performAutomaticReconciliation(value, property, itemId, valueIndex)`
- `tryReconciliationApi(value, propertyObj, allMappings)`
- `parseReconciliationResults(data, value, propertyObj)`
- `tryDirectWikidataSearch(value)`
- `isDateValue(value)`
- `escapeHtml(text)`

**`batch-processor.js`** - Batch processing logic
- `performBatchAutoAcceptance(data, mappedKeys, manualProperties)`
- `reconcileNextUnprocessedCell()`
- `getAutoAdvanceSetting()`
- `setupAutoAdvanceToggle()`

**`reconciliation-progress.js`** - Progress and state management
- `calculateCurrentProgress()`
- `updateProceedButton()`
- `storeAllMatches(cellInfo, allMatches, bestMatch)`
- `storeEmptyMatches(cellInfo)`
- `updateCellQueueStatus(itemId, property, valueIndex, status)`
- `markCellAsReconciled(cellInfo, reconciliation)`
- `markCellAsSkipped(cellInfo)`
- `markCellAsNoItem(cellInfo)`
- `markCellAsString(cellInfo)`

#### UI Modules (Presentation Logic)

**`reconciliation-table.js`** - Table interface management
- `createReconciliationTable(data, mappedKeys, manualProperties, isReturningToStep)`
- `createPropertyCell(itemId, property, valueIndex, value)`
- `createValueElement(itemId, property, valueIndex, value)`
- `createManualPropertyCell(itemId, propertyId, defaultValue, manualProp)`
- `updateCellLoadingState(itemId, property, valueIndex, isLoading)`
- `updateCellDisplayAsNoMatches(itemId, property, valueIndex)`
- `updateCellDisplayWithMatch(itemId, property, valueIndex, bestMatch)`
- `updateCellDisplay(itemId, property, valueIndex, status, reconciliation)`
- `restoreReconciliationDisplay(data, mappedKeys, manualProperties)`

**`reconciliation-modal.js`** - Modal management and interactions
- `openReconciliationModal(itemId, property, valueIndex, value)`
- `createReconciliationModalContent(itemId, property, valueIndex, value)`
- `displayReconciliationResults(matches, propertyType, value)`
- `displayHighConfidenceMatches(matches)`
- `displayFallbackOptions(value, matches)`
- `showCustomInputInterface(propertyType, value)`
- `setupManualSearchInFallback()`
- `displayFallbackSearchResults(matches)`
- `setupExpandedSearch()`
- `setupManualSearch()`

**`reconciliation-display.js`** - Display utilities and helpers
- `getPropertyDisplayInfo(property)`
- `fetchWikidataPropertyInfo(propertyKeyword)`
- `generateMockPid(property)`
- `getPropertyDescription(property)`
- `getWikidataUrlForProperty(property)`
- `displayAutomaticMatches(matches)`
- `displayReconciliationError(error)`

---

## 🚀 Implementation Plan

### Phase 1: Foundation Setup (Day 1)
**Goal:** Establish module structure and tooling
**Time:** 2-4 hours

#### Step 1.1: Create Directory Structure
```bash
mkdir -p src/js/reconciliation/core
mkdir -p src/js/reconciliation/ui
touch src/js/reconciliation/core/reconciliation-data.js
touch src/js/reconciliation/core/entity-matcher.js
touch src/js/reconciliation/core/batch-processor.js
touch src/js/reconciliation/core/reconciliation-progress.js
touch src/js/reconciliation/ui/reconciliation-table.js
touch src/js/reconciliation/ui/reconciliation-modal.js
touch src/js/reconciliation/ui/reconciliation-display.js
touch src/js/reconciliation/index.js
```

#### Step 1.2: Create Module Templates
Each module should start with this template:
```javascript
/**
 * [Module Description]
 * @module reconciliation/[module-name]
 */

// Import dependencies (minimal)
import { ... } from '../../...';

// Export functions (maintain exact signatures)
export async function functionName(...args) {
    // Moved implementation from reconciliation.js
    // NO LOGIC CHANGES - pure copy/paste
}
```

### Phase 2: Extract Data Processing Logic (Days 2-3)
**Goal:** Move data structures and initialization (lowest risk)
**Time:** 6-8 hours

#### Step 2.1: Extract `reconciliation-data.js` (Safest First)
**Functions to move:**
```javascript
export function calculateTotalReconciliableCells(data, mappedKeys, manualProperties) { /* copy from reconciliation.js */ }
export function extractPropertyValues(item, key) { /* copy from reconciliation.js */ }
export function combineAndSortProperties(mappedKeys, manualProperties) { /* copy from reconciliation.js */ }
export function loadMockDataForTesting() { /* copy from reconciliation.js */ }
export function getOriginalKeyInfo(itemId, property) { /* copy from reconciliation.js */ }
export function generateLodUri(property, originalData) { /* copy from reconciliation.js */ }
export function getReconciliationRequirementReason(property) { /* copy from reconciliation.js */ }
```

**Migration Process:**
1. Copy functions to `reconciliation-data.js` (exact copy, no changes)
2. Add imports to `reconciliation.js`: `import { extractPropertyValues, ... } from './reconciliation/core/reconciliation-data.js';`
3. Test thoroughly - all functionality should work identically
4. Once confirmed working, delete original functions from `reconciliation.js`

#### Step 2.2: Extract `reconciliation-progress.js`
**Functions to move:**
```javascript
export function calculateCurrentProgress() { /* copy from reconciliation.js */ }
export function updateProceedButton() { /* copy from reconciliation.js */ }
export function storeAllMatches(cellInfo, allMatches, bestMatch) { /* copy from reconciliation.js */ }
export function storeEmptyMatches(cellInfo) { /* copy from reconciliation.js */ }
export function updateCellQueueStatus(itemId, property, valueIndex, status) { /* copy from reconciliation.js */ }
export function markCellAsReconciled(cellInfo, reconciliation) { /* copy from reconciliation.js */ }
export function markCellAsSkipped(cellInfo) { /* copy from reconciliation.js */ }
export function markCellAsNoItem(cellInfo) { /* copy from reconciliation.js */ }
export function markCellAsString(cellInfo) { /* copy from reconciliation.js */ }
```

### Phase 3: Extract Entity Matching Engine (Days 4-6)
**Goal:** Move core reconciliation algorithms
**Time:** 8-10 hours

#### Step 3.1: Extract `entity-matcher.js`
**Functions to move:**
```javascript
export async function performAutomaticReconciliation(value, property, itemId, valueIndex) { /* copy from reconciliation.js */ }
export async function tryReconciliationApi(value, propertyObj, allMappings) { /* copy from reconciliation.js */ }
export function parseReconciliationResults(data, value, propertyObj) { /* copy from reconciliation.js */ }
export async function tryDirectWikidataSearch(value) { /* copy from reconciliation.js */ }
export function isDateValue(value) { /* copy from reconciliation.js */ }
export function escapeHtml(text) { /* copy from reconciliation.js */ }
```

### Phase 4: Extract Batch Processing (Days 7-8)
**Goal:** Move batch processing and automation logic
**Time:** 6-8 hours

#### Step 4.1: Extract `batch-processor.js`
**Functions to move:**
```javascript
export async function performBatchAutoAcceptance(data, mappedKeys, manualProperties) { /* copy from reconciliation.js */ }
export function reconcileNextUnprocessedCell() { /* copy from reconciliation.js */ }
export function getAutoAdvanceSetting() { /* copy from reconciliation.js */ }
export function setupAutoAdvanceToggle() { /* copy from reconciliation.js */ }
```

### Phase 5: Extract Table UI Components (Days 9-11)
**Goal:** Move table generation and cell management
**Time:** 10-12 hours

#### Step 5.1: Extract `reconciliation-table.js`
**Functions to move:**
```javascript
export async function createReconciliationTable(data, mappedKeys, manualProperties, isReturningToStep) { /* copy from reconciliation.js */ }
export function createPropertyCell(itemId, property, valueIndex, value) { /* copy from reconciliation.js */ }
export function createValueElement(itemId, property, valueIndex, value) { /* copy from reconciliation.js */ }
export function createManualPropertyCell(itemId, propertyId, defaultValue, manualProp) { /* copy from reconciliation.js */ }
export function updateCellLoadingState(itemId, property, valueIndex, isLoading) { /* copy from reconciliation.js */ }
export function updateCellDisplayAsNoMatches(itemId, property, valueIndex) { /* copy from reconciliation.js */ }
export function updateCellDisplayWithMatch(itemId, property, valueIndex, bestMatch) { /* copy from reconciliation.js */ }
export function updateCellDisplay(itemId, property, valueIndex, status, reconciliation) { /* copy from reconciliation.js */ }
export function restoreReconciliationDisplay(data, mappedKeys, manualProperties) { /* copy from reconciliation.js */ }
```

### Phase 6: Extract Modal Interface (Days 12-14)
**Goal:** Move modal management and user interactions
**Time:** 10-12 hours (largest UI module)

#### Step 6.1: Extract `reconciliation-modal.js`
**Functions to move (15+ functions):**
```javascript
export async function openReconciliationModal(itemId, property, valueIndex, value) { /* copy from reconciliation.js */ }
export async function createReconciliationModalContent(itemId, property, valueIndex, value) { /* copy from reconciliation.js */ }
export async function displayReconciliationResults(matches, propertyType, value) { /* copy from reconciliation.js */ }
export function displayHighConfidenceMatches(matches) { /* copy from reconciliation.js */ }
export function displayFallbackOptions(value, matches) { /* copy from reconciliation.js */ }
export function showCustomInputInterface(propertyType, value) { /* copy from reconciliation.js */ }
export function setupManualSearchInFallback() { /* copy from reconciliation.js */ }
export function displayFallbackSearchResults(matches) { /* copy from reconciliation.js */ }
export function setupExpandedSearch() { /* copy from reconciliation.js */ }
export function setupManualSearch() { /* copy from reconciliation.js */ }
```

#### Step 6.2: Extract `reconciliation-display.js`
**Functions to move:**
```javascript
export async function getPropertyDisplayInfo(property) { /* copy from reconciliation.js */ }
export async function fetchWikidataPropertyInfo(propertyKeyword) { /* copy from reconciliation.js */ }
export function generateMockPid(property) { /* copy from reconciliation.js */ }
export function getPropertyDescription(property) { /* copy from reconciliation.js */ }
export function getWikidataUrlForProperty(property) { /* copy from reconciliation.js */ }
export function displayAutomaticMatches(matches) { /* copy from reconciliation.js */ }
export function displayReconciliationError(error) { /* copy from reconciliation.js */ }
```

### Phase 7: Create Public API & Finalization (Day 15)
**Goal:** Establish clean public interface and complete refactoring
**Time:** 4-6 hours

#### Step 7.1: Create `reconciliation/index.js`
```javascript
/**
 * Public API for reconciliation functionality
 * @module reconciliation
 */

// Re-export all public functions
export * from './core/reconciliation-data.js';
export * from './core/entity-matcher.js';
export * from './core/batch-processor.js';
export * from './core/reconciliation-progress.js';
export * from './ui/reconciliation-table.js';
export * from './ui/reconciliation-modal.js';
export * from './ui/reconciliation-display.js';
```

#### Step 7.2: Refactor `reconciliation.js` to Orchestrator
**Target size:** 300-500 lines
**Responsibilities:**
- Event system integration
- DOM element initialization
- State management coordination
- Module orchestration
- Error handling and logging

```javascript
/**
 * Reconciliation step orchestrator - coordinates all reconciliation functionality
 * @module steps/reconciliation
 */

import { 
    calculateTotalReconciliableCells,
    createReconciliationTable,
    openReconciliationModal,
    performBatchAutoAcceptance,
    calculateCurrentProgress,
    // ... other functions
} from '../reconciliation/index.js';

export function setupReconciliationStep(state) {
    // Slim orchestration logic only
    // All heavy lifting delegated to modules
    
    // Initialize modal UI
    const modalUI = setupModalUI();
    
    // Main initialization function - delegates to modules
    async function initializeReconciliation() {
        // Coordination and error handling only
        // All processing delegated to reconciliation-data.js
    }
}
```

---

## 🧪 Testing Strategy

### Per-Module Testing
Each extracted module should be independently testable:

```javascript
// Example: reconciliation-data.test.js
import { extractPropertyValues, calculateTotalReconciliableCells } from '../src/js/reconciliation/core/reconciliation-data.js';

describe('Reconciliation Data', () => {
    test('extractPropertyValues handles arrays', () => {
        const item = { 'dcterms:title': [{"@value": "Test Title"}] };
        const result = extractPropertyValues(item, 'dcterms:title');
        expect(result).toEqual([{"@value": "Test Title"}]);
    });
    
    test('calculateTotalReconciliableCells counts correctly', () => {
        const data = [/* mock data */];
        const mappedKeys = [/* mock mappings */];
        const total = calculateTotalReconciliableCells(data, mappedKeys);
        expect(typeof total).toBe('number');
    });
});
```

### Integration Testing
Ensure the orchestrator works with all modules:

```javascript
// reconciliation-integration.test.js
import { setupReconciliationStep } from '../src/js/steps/reconciliation.js';

describe('Reconciliation Integration', () => {
    test('setupReconciliationStep initializes all modules', () => {
        // Test full reconciliation workflow
    });
    
    test('modal interface integrates with matching engine', () => {
        // Test modal → matching → progress flow
    });
});
```

### Manual Testing Checklist
After each phase, verify:
- [ ] All existing reconciliation functionality works identically
- [ ] No regression in matching accuracy or performance
- [ ] Modal interface behaves correctly
- [ ] Progress tracking works properly
- [ ] Batch processing operates as expected
- [ ] Entity matching produces same results
- [ ] State management continues working
- [ ] Auto-advance and manual selection still functional

---

## ⚠️ Risk Mitigation

### Low-Risk Approach
1. **Copy First, Delete Later**: Never modify and move simultaneously
2. **Test After Each Module**: Confirm functionality before proceeding
3. **Maintain API Contracts**: Keep exact function signatures
4. **Use Git Branches**: Each phase in a separate branch
5. **Preserve Reconciliation Logic**: Critical matching algorithms unchanged

### Critical Areas Requiring Extra Care
- **Entity Matching Engine**: Core reconciliation algorithms - test thoroughly
- **Modal Interface**: Complex user interactions - verify all paths work
- **Progress State Management**: Ensure progress tracking remains accurate
- **Batch Processing**: Auto-acceptance logic must work identically
- **Constraint Integration**: Preserve constraint validation behavior

### Rollback Strategy
If any phase introduces reconciliation bugs:
1. Revert to previous working commit
2. Identify the problematic function(s)
3. Move smaller subset of functions
4. Test reconciliation accuracy more thoroughly before proceeding

---

## 📊 Success Metrics

### Code Quality Metrics
- **File Size**: reconciliation.js reduced from 3,147 to <500 lines
- **Function Count**: No single module >15 functions
- **Cyclomatic Complexity**: Each module <10 average complexity
- **Test Coverage**: >80% coverage for each extracted module

### Reconciliation Quality Metrics
- **Matching Accuracy**: No regression in entity matching quality
- **Performance**: No degradation in reconciliation speed
- **User Experience**: Modal interface remains responsive and intuitive
- **Batch Processing**: Auto-acceptance works at same efficiency

### Developer Experience Metrics
- **Build Time**: No regression in build performance
- **IDE Performance**: Better IntelliSense for reconciliation functions
- **Merge Conflicts**: Reduced conflicts in reconciliation-related changes
- **Debugging**: Issues isolated to specific reconciliation modules

---

## 🔄 Long-term Benefits

### Immediate Benefits (Week 1)
- Reduced cognitive load when working on reconciliation features
- Easier debugging of specific reconciliation issues
- Improved IDE performance with smaller files

### Medium-term Benefits (Month 1)
- Independent testing of reconciliation concerns
- Parallel development on different reconciliation aspects
- Easier code reviews with focused reconciliation changes

### Long-term Benefits (Quarter 1)
- Reusable entity matching engine for other modules
- Plugin architecture for custom reconciliation algorithms
- Better performance with lazy loading of reconciliation components
- Foundation for advanced reconciliation features

---

## 📝 Implementation Checklist

### Pre-Refactoring Setup
- [ ] Create feature branch: `refactor/reconciliation-modularization`
- [ ] Backup current working reconciliation state
- [ ] Set up testing framework for new reconciliation modules
- [ ] Document current reconciliation API surface for regression testing

### Phase 1 - Foundation (Day 1)
- [ ] Create directory structure
- [ ] Set up module templates
- [ ] Configure import/export patterns
- [ ] Test basic import structure

### Phase 2 - Data Processing (Days 2-3)
- [ ] Extract `reconciliation-data.js`
- [ ] Extract `reconciliation-progress.js`
- [ ] Test each module independently
- [ ] Integration test with main reconciliation.js

### Phase 3 - Entity Matching (Days 4-6)
- [ ] Extract `entity-matcher.js`
- [ ] Test matching algorithms
- [ ] Verify API integration still works
- [ ] Check reconciliation accuracy

### Phase 4 - Batch Processing (Days 7-8)
- [ ] Extract `batch-processor.js`
- [ ] Test auto-acceptance functionality
- [ ] Verify progress tracking
- [ ] Check batch performance

### Phase 5 - Table UI (Days 9-11)
- [ ] Extract `reconciliation-table.js`
- [ ] Test table generation and updates
- [ ] Verify cell state management
- [ ] Check UI responsiveness

### Phase 6 - Modal Interface (Days 12-14)
- [ ] Extract `reconciliation-modal.js`
- [ ] Extract `reconciliation-display.js`
- [ ] Test modal behavior and interactions
- [ ] Verify search and selection flows

### Phase 7 - Finalization (Day 15)
- [ ] Create public API in `index.js`
- [ ] Refactor `reconciliation.js` to orchestrator
- [ ] Final integration testing
- [ ] Performance verification
- [ ] Documentation updates

### Post-Refactoring
- [ ] Comprehensive reconciliation regression testing
- [ ] Code review with team
- [ ] Update reconciliation documentation
- [ ] Merge to main branch
- [ ] Monitor for reconciliation issues in production

---

## 🔗 References

### Related Documentation
- [CLAUDE.md](./CLAUDE.md) - Project conventions
- [02-architecture.md](./specs/02-architecture.md) - System architecture
- [OpenRefine Reconciliation API](https://reconciliation-api.github.io/specs/latest/) - Reconciliation standards reference

### Tools and Resources  
- **ESLint**: Ensure consistent code style across reconciliation modules
- **Jest**: Testing framework for reconciliation module testing
- **JSDoc**: Documentation generation for new reconciliation modules
- **Import/Export Analyzer**: Visualize reconciliation module dependencies

---

*This refactoring plan transforms a 3,147-line reconciliation monolith into a maintainable, modular architecture while preserving all existing reconciliation functionality and matching quality. The strategy prioritizes safety, testability, and developer experience.*

**Last Updated**: 2025-09-10
**Document Version**: 1.0
**Estimated Implementation Time**: 2-3 weeks
**Risk Level**: Low (code-preserving approach)