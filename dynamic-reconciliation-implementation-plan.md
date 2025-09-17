# Dynamic Column-Specific Reconciliation Implementation Plan

## Overview

Transform the current one-time bulk reconciliation system into a dynamic, user-controlled approach where users can reconcile individual columns on-demand through header buttons.

## Current Architecture Analysis

### Current Behavior
- **One-time reconciliation**: `performBatchAutoAcceptance()` runs automatically when table is created
- **All columns processed**: Every mapped property gets reconciled regardless of datatype
- **No re-reconciliation**: Users can't re-run reconciliation after making changes

### Current Code Locations
- **Column headers**: `reconciliation-table.js` lines 352-482
- **Bulk reconciliation**: `reconciliation-table.js` line 555-556 calls `performBatchAutoAcceptance()`
- **Batch processor**: `reconciliation/core/batch-processor.js` handles all reconciliation logic

## New Dynamic Reconciliation Design

### New Behavior
- **No automatic reconciliation** when table loads
- **Reconciliation buttons** appear only on `wikibase-item` column headers
- **Column-specific reconciliation** triggered by user clicking header button
- **Re-reconciliation enabled** - users can reconcile columns multiple times
- **Progress feedback** for each column reconciliation operation

## Implementation Strategy

### 1. Modify Column Header Creation
**Location**: `src/js/reconciliation/ui/reconciliation-table.js` (lines 352-482)

**Changes:**
- Add datatype detection logic to identify `wikibase-item` columns
- Create reconciliation button element for eligible columns
- Add button styling and click handlers

**Code Pattern:**
```javascript
// Inside the header creation loop (around line 363)
if (keyObj.property && keyObj.property.datatype === 'wikibase-item') {
    // Add reconciliation button to header
    const reconcileBtn = createElement('button', {
        className: 'reconcile-column-btn',
        title: 'Reconcile all values in this column',
        onClick: () => reconcileColumn(keyName, keyObj)
    }, '🔄 Reconcile');
    
    headerContent.appendChild(reconcileBtn);
}
```

### 2. Create Column-Specific Reconciliation Function
**Location**: `src/js/reconciliation/core/batch-processor.js`

**Changes:**
- Extract column-filtering logic from `performBatchAutoAcceptance()`
- Create new `reconcileColumn()` function that processes single column
- Add progress tracking per column
- Enable re-reconciliation by resetting cell states

**Function Signature:**
```javascript
export function createColumnReconciliationProcessor(dependencies) {
    return async function reconcileColumn(property, keyObj, data) {
        // Filter jobs for this column only
        // Add progress feedback
        // Reset existing reconciliation states 
        // Process reconciliation for all values in column
    }
}
```

### 3. Remove Automatic Bulk Reconciliation
**Location**: `src/js/reconciliation/ui/reconciliation-table.js` (lines 554-560)

**Changes:**
- Remove `performBatchAutoAcceptance()` call from table creation
- Keep `restoreReconciliationDisplay()` for returning to step
- Show empty table with reconciliation buttons ready

### 4. Add UI State Management
**New Features:**
- Button loading states during reconciliation
- Progress indicators per column
- Success/completion feedback
- Error handling for individual columns

### 5. Update Dependencies and Exports
**Locations**: Multiple files need import/export updates
- Add column reconciliation to reconciliation index exports
- Import column reconciliation in reconciliation step
- Wire up new button handlers

## User Experience Design

### Column Header Appearance
```
Creator (P170) [🔄 Reconcile]     Title (P1476)     Date (P577)
     ↑                                ↑                 ↑
wikibase-item                    string             time
(gets button)                 (no button)      (no button)
```

### Reconciliation Flow
1. **Initial state**: Table shows values, buttons ready
2. **User clicks button**: Button shows loading spinner
3. **Processing**: Column values show "Checking..." states
4. **Completion**: Button returns to normal, cells show results
5. **Re-reconciliation**: User can click button again anytime

### Button States
- **Ready**: `🔄 Reconcile`
- **Processing**: `⏳ Processing...` (disabled)
- **Completed**: `✅ Reconciled` (briefly, then back to ready)
- **Error**: `❌ Retry` (for failed reconciliations)

## File Modifications Required

### 1. `reconciliation-table.js`
- Add button creation logic in header generation
- Remove automatic `performBatchAutoAcceptance()` call
- Add column reconciliation handler

### 2. `batch-processor.js`
- Extract `reconcileColumn()` function from bulk processor
- Add single-column filtering logic
- Maintain existing reconciliation algorithms

### 3. `reconciliation/index.js`
- Export new column reconciliation function
- Maintain existing exports for compatibility

### 4. `steps/reconciliation.js`
- Import column reconciliation functionality
- Wire up to table factory
- Remove bulk reconciliation initialization

## Technical Benefits

1. **Performance**: Only reconcile what users need, when they need it
2. **User Control**: Users decide which columns to reconcile and when
3. **Re-reconciliation**: Users can retry after making changes or mapping adjustments
4. **Selective Processing**: Skip non-entity columns automatically
5. **Resource Efficiency**: Reduce API calls by only processing relevant columns
6. **Progress Clarity**: Users see exactly which column is being processed

## Backward Compatibility

- **State restoration**: Existing reconciliation data still loads correctly
- **Modal interactions**: Individual cell reconciliation continues to work
- **Export functionality**: No changes needed to export logic
- **Data structures**: All existing reconciliation data formats preserved

## Implementation Phases

1. **Phase 1**: Modify header generation to add buttons for wikibase-item columns
2. **Phase 2**: Create column-specific reconciliation function
3. **Phase 3**: Remove automatic bulk reconciliation
4. **Phase 4**: Add button state management and progress feedback
5. **Phase 5**: Testing and refinement

## Detailed Implementation Tasks

### Phase 1: Header Button Integration

#### Task 1.1: Modify Header Creation
**File**: `src/js/reconciliation/ui/reconciliation-table.js`
**Location**: Lines 352-482 (property header creation loop)

```javascript
// Add after existing header content creation
if (keyObj.property && keyObj.property.datatype === 'wikibase-item') {
    const buttonContainer = createElement('div', {
        className: 'reconcile-button-container'
    });
    
    const reconcileBtn = createElement('button', {
        className: 'reconcile-column-btn',
        title: `Reconcile all ${keyObj.property.label} values`,
        dataset: { 
            property: keyName,
            status: 'ready'
        }
    });
    
    const buttonText = createElement('span', {}, '🔄 Reconcile');
    reconcileBtn.appendChild(buttonText);
    
    buttonContainer.appendChild(reconcileBtn);
    headerContent.appendChild(buttonContainer);
}
```

#### Task 1.2: Add Button Styling
**File**: Add CSS classes for reconciliation buttons
```css
.reconcile-button-container {
    margin-top: 4px;
}

.reconcile-column-btn {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
}

.reconcile-column-btn[data-status="processing"] {
    background: #FF9800;
    cursor: not-allowed;
}

.reconcile-column-btn[data-status="completed"] {
    background: #2196F3;
}
```

### Phase 2: Column Reconciliation Function

#### Task 2.1: Create Column Reconciliation Processor
**File**: `src/js/reconciliation/core/batch-processor.js`

```javascript
/**
 * Create column-specific reconciliation processor
 */
export function createColumnReconciliationProcessor(dependencies) {
    return async function reconcileColumn(property, keyObj, data) {
        const button = document.querySelector(`[data-property="${property}"] .reconcile-column-btn`);
        
        // Update button state
        updateButtonState(button, 'processing');
        
        try {
            // Filter jobs for this column only
            const columnJobs = [];
            data.forEach((item, index) => {
                const itemId = `item-${index}`;
                const values = extractPropertyValues(item, keyObj);
                
                values.forEach((value, valueIndex) => {
                    if (value && value.trim()) {
                        columnJobs.push({
                            itemId,
                            property,
                            valueIndex,
                            value,
                            keyObj
                        });
                    }
                });
            });
            
            // Process reconciliation for column
            await processColumnJobs(columnJobs, dependencies);
            
            updateButtonState(button, 'completed');
            
        } catch (error) {
            console.error(`Error reconciling column ${property}:`, error);
            updateButtonState(button, 'error');
        }
    };
}

function updateButtonState(button, state) {
    if (!button) return;
    
    button.dataset.status = state;
    const textSpan = button.querySelector('span');
    
    switch (state) {
        case 'processing':
            textSpan.textContent = '⏳ Processing...';
            button.disabled = true;
            break;
        case 'completed':
            textSpan.textContent = '✅ Reconciled';
            button.disabled = false;
            setTimeout(() => {
                textSpan.textContent = '🔄 Reconcile';
                button.dataset.status = 'ready';
            }, 2000);
            break;
        case 'error':
            textSpan.textContent = '❌ Retry';
            button.disabled = false;
            break;
        case 'ready':
        default:
            textSpan.textContent = '🔄 Reconcile';
            button.disabled = false;
            break;
    }
}
```

### Phase 3: Remove Automatic Reconciliation

#### Task 3.1: Modify Table Creation
**File**: `src/js/reconciliation/ui/reconciliation-table.js`
**Location**: Lines 554-560

```javascript
// REMOVE this block:
// if (!isReturningToStep) {
//     await performBatchAutoAcceptance(data, mappedKeys, manualProperties);
// } else {
//     restoreReconciliationDisplay(data, mappedKeys, manualProperties);
// }

// REPLACE with:
if (isReturningToStep) {
    restoreReconciliationDisplay(data, mappedKeys, manualProperties);
}
// Note: No automatic reconciliation for fresh tables
```

### Phase 4: Wire Up Button Handlers

#### Task 4.1: Add Button Click Handlers
**File**: `src/js/reconciliation/ui/reconciliation-table.js`

```javascript
// Add to table factory dependencies
const reconcileColumn = createColumnReconciliationProcessor({
    extractPropertyValues,
    markCellAsReconciled,
    storeAllMatches,
    storeEmptyMatches,
    updateCellLoadingState,
    updateCellDisplayAsNoMatches,
    updateCellDisplayWithMatch,
    reconciliationData,
    state
});

// Add button click handler in header creation
reconcileBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent header click
    await reconcileColumn(keyName, keyObj, data);
});
```

### Phase 5: Export Integration

#### Task 5.1: Update Module Exports
**File**: `src/js/reconciliation/index.js`

```javascript
// Add to exports
export {
    // ... existing exports
    createColumnReconciliationProcessor
} from './core/batch-processor.js';
```

#### Task 5.2: Update Step Integration
**File**: `src/js/steps/reconciliation.js`

```javascript
// Add to imports
import {
    // ... existing imports
    createColumnReconciliationProcessor
} from '../reconciliation/index.js';

// Add to modules initialization
const reconcileColumn = createColumnReconciliationProcessor({
    // ... dependencies
});

// Pass to table factory
const createReconciliationTable = createReconciliationTableFactory({
    // ... existing dependencies
    reconcileColumn
});
```

## Testing Plan

### Manual Testing Scenarios
1. **Fresh Table Load**: Verify no automatic reconciliation occurs
2. **Button Appearance**: Confirm buttons only appear on wikibase-item columns
3. **Column Reconciliation**: Test reconciling individual columns
4. **Re-reconciliation**: Verify users can reconcile same column multiple times
5. **State Restoration**: Ensure returning to step shows existing reconciliation results
6. **Mixed Datatypes**: Test table with wikibase-item, string, and time columns

### Edge Cases
1. **Empty Values**: Columns with no values to reconcile
2. **Error Handling**: API failures during column reconciliation
3. **Concurrent Operations**: Multiple column reconciliations
4. **Large Datasets**: Performance with many items/columns

## Success Criteria

1. ✅ No automatic reconciliation on table load
2. ✅ Reconciliation buttons appear only on wikibase-item columns
3. ✅ Column reconciliation works for individual properties
4. ✅ Re-reconciliation enabled for all columns
5. ✅ Button states provide clear user feedback
6. ✅ Existing reconciliation data loads correctly
7. ✅ Individual cell reconciliation still works
8. ✅ Performance acceptable for typical datasets

---

**This plan transforms the reconciliation step from a "set it and forget it" bulk operation into a dynamic, user-controlled workflow that gives users much more flexibility and control over their data processing.**