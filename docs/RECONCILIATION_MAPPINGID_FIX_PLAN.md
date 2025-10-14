# Implementation Plan: Fix Multiple Mappings from Same Key

**Status:** Planning
**Created:** 2025-10-14
**Complexity:** High
**Estimated Time:** 4-6 hours
**Files Affected:** ~10 files
**Breaking Change:** Yes (data structure)

## Problem Summary

When two mappings originate from the same Omeka key with different settings (e.g., `schema:publisher` with `@id` and `o:label`), the reconciliation system fails because:

1. **Data structure collision:** Both mappings store data at `properties[keyName]`, causing overwrites
2. **Cell selector ambiguity:** All cells use `data-property="keyName"`, matching multiple columns
3. **Modal confusion:** Modals receive only `keyName`, unable to differentiate mappings
4. **Navigation errors:** "Next" navigation can't distinguish between columns

### Example Scenario
```javascript
// User has two mappings:
Mapping 1: schema:publisher::@id::P123
Mapping 2: schema:publisher::o:label::P123

// Current (BROKEN):
reconciliationData['item-0'].properties['schema:publisher'] = { ... }  // Second overwrites first!

// Fixed (CORRECT):
reconciliationData['item-0'].properties['schema:publisher::@id::P123'] = { ... }
reconciliationData['item-0'].properties['schema:publisher::o:label::P123'] = { ... }
```

## Architecture Analysis

### Current Data Flow
```
Step 2 (Mapping) → generates mappingId for each mapping
                 ↓
Step 3 (Reconciliation) → LOSES mappingId, uses only keyName
                         ↓
                    Data collision occurs
```

### Fixed Data Flow
```
Step 2 (Mapping) → generates mappingId
                 ↓
Step 3 (Reconciliation) → PRESERVES mappingId throughout
                         ↓
                    Each mapping has unique storage
```

## Implementation Phases

### Phase 1: Core Data Structure Changes
**Goal:** Change reconciliation data to use `mappingId` as the primary key

#### 1.1 Update `reconciliation-data.js`

**File:** `src/js/reconciliation/core/reconciliation-data.js`

**Changes:**

**A. Function: `initializeReconciliationDataStructure()` (Line 429-462)**
```javascript
// BEFORE:
mappedKeys.forEach(keyObj => {
    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
    const values = extractPropertyValues(item, keyObj, state);
    reconciliationData[itemId].properties[keyName] = {
        originalValues: values,
        propertyMetadata: typeof keyObj === 'object' ? keyObj : null,
        reconciled: values.map(() => ({ ... }))
    };
});

// AFTER:
mappedKeys.forEach(keyObj => {
    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
    const values = extractPropertyValues(item, keyObj, state);

    // Generate mappingId for unique identification
    let mappingId;
    if (state && typeof keyObj === 'object' && keyObj.property) {
        mappingId = state.generateMappingId(
            keyName,
            keyObj.property.id,
            keyObj.selectedAtField
        );
    } else {
        mappingId = keyName; // Fallback for backward compatibility
    }

    reconciliationData[itemId].properties[mappingId] = {
        originalValues: values,
        propertyMetadata: typeof keyObj === 'object' ? keyObj : null,
        keyName: keyName,  // NEW: Store original key name for reference
        mappingId: mappingId,  // NEW: Store mappingId explicitly
        reconciled: values.map(() => ({ ... }))
    };
});
```

**B. Function: `mergeReconciliationData()` (Line 474-540)**
```javascript
// BEFORE:
const existingProperties = new Set();
Object.values(mergedData).forEach(itemData => {
    if (itemData.properties) {
        Object.keys(itemData.properties).forEach(prop => existingProperties.add(prop));
    }
});

// Identify new properties
currentMappedKeys.forEach(keyObj => {
    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
    if (!existingProperties.has(keyName)) {
        newProperties.push(keyObj);
    }
});

// AFTER:
const existingMappingIds = new Set();
Object.values(mergedData).forEach(itemData => {
    if (itemData.properties) {
        Object.keys(itemData.properties).forEach(mappingId => {
            existingMappingIds.add(mappingId);
        });
    }
});

// Identify new properties by mappingId
currentMappedKeys.forEach(keyObj => {
    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;

    let mappingId;
    if (state && typeof keyObj === 'object' && keyObj.property) {
        mappingId = state.generateMappingId(
            keyName,
            keyObj.property.id,
            keyObj.selectedAtField
        );
    } else {
        mappingId = keyName;
    }

    if (!existingMappingIds.has(mappingId)) {
        newProperties.push({ keyObj, mappingId });
    }
});

// Update property addition to use mappingId
newProperties.forEach(({ keyObj, mappingId }) => {
    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
    const values = extractPropertyValues(item, keyObj, state);

    mergedData[itemId].properties[mappingId] = {
        originalValues: values,
        propertyMetadata: typeof keyObj === 'object' ? keyObj : null,
        keyName: keyName,  // Store original key name
        mappingId: mappingId,  // Store mappingId
        reconciled: values.map(() => ({ ... }))
    };
});
```

**C. Function: `calculateTotalReconciliableCells()` (Line 20-31)**
- No changes needed - this function works on `mappedKeys` array, not reconciliation data

**D. Update JSDoc comments**
- Update documentation to reflect that properties are now keyed by `mappingId`
- Add notes about backward compatibility

**Testing checkpoint:** After Phase 1, verify data structure creates unique entries for duplicate keys

---

### Phase 2: Table Cell Identification Updates
**Goal:** Update all cells to use `mappingId` for unique identification

#### 2.1 Update `reconciliation-table.js`

**File:** `src/js/reconciliation/ui/reconciliation-table.js`

**Changes:**

**A. Function: `createPropertyCellFactory()` (Line 307-323)**
```javascript
// BEFORE:
export function createPropertyCellFactory(openReconciliationModal) {
    return function createPropertyCell(itemId, property, valueIndex, value) {
        const td = createElement('td', {
            className: 'property-cell single-value-cell',
            dataset: {
                itemId: itemId,
                property: property,
                valueIndex: valueIndex
            }
        });
        // ...
    };
}

// AFTER:
export function createPropertyCellFactory(openReconciliationModal) {
    return function createPropertyCell(itemId, property, valueIndex, value, keyObj) {
        // Calculate mappingId from keyObj
        const mappingId = keyObj.mappingId || property; // Fallback to property for compatibility

        const td = createElement('td', {
            className: 'property-cell single-value-cell',
            dataset: {
                itemId: itemId,
                property: property,  // Keep for backward compatibility
                mappingId: mappingId,  // NEW: Unique identifier
                valueIndex: valueIndex
            }
        });
        // ...
    };
}
```

**B. Function: `createValueElement()` (Line 328-353)**
```javascript
// Update signature to accept keyObj
// Pass mappingId to click handler
function createValueElement(itemId, property, valueIndex, value, openReconciliationModal, keyObj) {
    const valueDiv = createElement('div', {
        className: 'property-value',
        dataset: {
            status: 'pending',
            mappingId: keyObj.mappingId || property  // NEW
        }
    });

    // Update click handler to pass keyObj
    const clickHandler = () => {
        openReconciliationModal(itemId, property, valueIndex, value, keyObj);
    };

    valueDiv.addEventListener('click', clickHandler);
    return valueDiv;
}
```

**C. Function: `createManualPropertyCellFactory()` (Line 358-397)**
```javascript
// Similar updates as createPropertyCellFactory
// Add mappingId to dataset
// Pass manualProp object to modal
```

**D. Function: `createReconciliationTableFactory()` (Line 402-714)**

Major changes in the table generation loop:

```javascript
// Line ~664: Single value cell creation
const td = createPropertyCell(itemId, keyName, 0, values[0], keyObj);  // Pass keyObj

// Line ~677: Multiple values cell creation
const valueDiv = createValueElement(itemId, keyName, valueIndex, value, openReconciliationModal, keyObj);  // Pass keyObj

// Line ~530: Header dataset update
const th = createElement('th', {
    className: 'property-header clickable-header',
    dataset: {
        property: keyName,
        mappingId: keyObj.mappingId || keyName  // NEW
    },
    // ...
});
```

**Testing checkpoint:** Verify table cells have unique `data-mapping-id` attributes

---

### Phase 3: Cell Selector Updates
**Goal:** Update all cell selectors to use `mappingId` instead of `property`

#### 3.1 Update Cell Selector Functions in `reconciliation-table.js`

**Changes in multiple functions:**

**A. `updateCellDisplayWithError()` (Line 94-123)**
```javascript
// BEFORE:
const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;

// AFTER:
const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
```

**B. `updateCellLoadingState()` (Line 128-145)**
```javascript
// BEFORE:
const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;

// AFTER:
const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
```

**C. `updateCellDisplayAsNoMatches()` (Line 150-168)**
```javascript
// BEFORE:
const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;

// AFTER:
const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
```

**D. `updateCellDisplayWithMatch()` (Line 173-212)**
```javascript
// BEFORE:
const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;

// AFTER:
const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
```

**E. `updateCellDisplay()` (Line 217-302)**
```javascript
// BEFORE:
const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;

// AFTER:
const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
```

**Strategy:** Create a helper function to reduce duplication:
```javascript
/**
 * Get cell selector using mappingId for unique identification
 */
function getCellSelector(itemId, mappingId, property = null) {
    // Try mappingId first, fall back to property for backward compatibility
    if (mappingId) {
        return `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
    }
    return `[data-item-id="${itemId}"][data-property="${property}"]`;
}
```

**Testing checkpoint:** Verify selectors only match intended cells

---

### Phase 4: Modal Integration Updates
**Goal:** Update modal opening and interaction to work with `mappingId`

#### 4.1 Update Modal Opening Functions

**File:** `src/js/reconciliation/ui/reconciliation-modal.js`

**Changes:**

**A. Function: `createOpenReconciliationModalFactory()`**

Update signature and implementation:
```javascript
// BEFORE:
export function createOpenReconciliationModalFactory(dependencies) {
    return function openReconciliationModal(itemId, property, valueIndex, value, manualProp) {
        currentReconciliationCell.current = { itemId, property, valueIndex };
        // ...
    };
}

// AFTER:
export function createOpenReconciliationModalFactory(dependencies) {
    return function openReconciliationModal(itemId, property, valueIndex, value, keyObjOrManualProp) {
        // Extract mappingId from keyObj
        const mappingId = keyObjOrManualProp?.mappingId ||
                         keyObjOrManualProp?.property?.id ||
                         property;  // Fallback

        currentReconciliationCell.current = {
            itemId,
            property,  // Keep for backward compatibility
            mappingId,  // NEW: Use for data access
            valueIndex,
            keyObj: keyObjOrManualProp  // Store full object
        };
        // ...
    };
}
```

**B. Update all modal data access**

Throughout the modal code, replace:
```javascript
// BEFORE:
const propertyData = reconciliationData[itemId].properties[property];

// AFTER:
const mappingId = currentReconciliationCell.current.mappingId;
const propertyData = reconciliationData[itemId].properties[mappingId];
```

#### 4.2 Update Modal Type-Specific Files

**Files to update:**
- `src/js/reconciliation/ui/modals/wikidata-item-modal.js`
- `src/js/reconciliation/ui/modals/string-modal.js`
- `src/js/reconciliation/ui/modals/time-modal.js`
- `src/js/reconciliation/ui/modals/external-id-modal.js`
- `src/js/reconciliation/ui/modals/url-modal.js`

**Pattern for all modal types:**
```javascript
// Each modal initialization function receives mappingId
export function initializeXXXModal(containerElement, reconciliationData, itemId, mappingId, valueIndex) {
    // Use mappingId to access data
    const propertyData = reconciliationData[itemId].properties[mappingId];
    // ...
}
```

**Testing checkpoint:** Verify modals access correct data for each mapping

---

### Phase 5: Batch Processing Updates
**Goal:** Update batch operations to use `mappingId`

#### 5.1 Update `batch-processor.js`

**File:** `src/js/reconciliation/core/batch-processor.js`

**Changes:**

**A. Function: `createBatchAutoAcceptanceProcessor()`**

Update all property iteration:
```javascript
// BEFORE:
Object.entries(itemData.properties).forEach(([property, propertyData]) => {
    // ...
});

// AFTER:
Object.entries(itemData.properties).forEach(([mappingId, propertyData]) => {
    const property = propertyData.keyName || mappingId;  // Get original key name
    // ...
    // Use mappingId for cell updates:
    updateCellLoadingState(itemId, mappingId, valueIndex, true);
});
```

**B. Function: `createColumnReconciliationProcessor()`**

Update to accept and use mappingId:
```javascript
// BEFORE:
export function createColumnReconciliationProcessor(dependencies) {
    return async function reconcileColumn(property, keyObj, data) {
        // ...
    };
}

// AFTER:
export function createColumnReconciliationProcessor(dependencies) {
    return async function reconcileColumn(property, keyObj, data) {
        const mappingId = keyObj.mappingId || property;

        // Use mappingId for all data access and cell updates
        data.forEach((item, index) => {
            const itemId = `item-${index}`;
            const propertyData = reconciliationData[itemId].properties[mappingId];
            // ...
        });
    };
}
```

**Testing checkpoint:** Verify batch operations affect only intended columns

---

### Phase 6: Progress Tracking Updates
**Goal:** Update progress calculation to work with `mappingId`

#### 6.1 Update `reconciliation-progress.js`

**File:** `src/js/reconciliation/core/reconciliation-progress.js`

**Changes:**

**A. Function: `createProgressCalculator()`**

Update property iteration:
```javascript
// BEFORE:
Object.entries(itemData.properties).forEach(([property, propertyData]) => {
    // ...
});

// AFTER:
Object.entries(itemData.properties).forEach(([mappingId, propertyData]) => {
    // mappingId is now the key, use it directly
    // ...
});
```

**B. Function: `createCellMarkers()`**

Update all marker functions to use mappingId:
```javascript
function markCellAsReconciled(itemId, property, valueIndex, reconciliation) {
    // Need to get mappingId - this might require passing keyObj or looking it up
    const mappingId = getPropertyMappingId(itemId, property, valueIndex);

    if (reconciliationData[itemId] && reconciliationData[itemId].properties[mappingId]) {
        const propertyData = reconciliationData[itemId].properties[mappingId];
        // ...
    }
}
```

**Note:** Might need to add a lookup helper:
```javascript
function getPropertyMappingId(itemId, property, valueIndex = 0) {
    // Find the mappingId for a given property
    const itemData = reconciliationData[itemId];
    if (!itemData) return property;

    // Look through all properties to find one that matches the keyName
    for (const [mappingId, propertyData] of Object.entries(itemData.properties)) {
        if (propertyData.keyName === property) {
            // If there are multiple, we might need additional context
            // For now, return the first match
            return mappingId;
        }
    }

    return property;  // Fallback
}
```

**Testing checkpoint:** Verify progress tracking counts all columns separately

---

### Phase 7: Entity Matching Updates
**Goal:** Update entity matching to use `mappingId`

#### 7.1 Update `entity-matcher.js`

**File:** `src/js/reconciliation/core/entity-matcher.js`

**Changes:**

**A. Function: `createAutomaticReconciliation()`**

Update to use mappingId for data access:
```javascript
// Ensure all property data access uses mappingId
const propertyData = reconciliationData[itemId].properties[mappingId];
```

**B. Update all storeMatches calls**

Ensure `storeAllMatches` and `storeEmptyMatches` receive and use `mappingId`

**Testing checkpoint:** Verify entity matching stores results in correct columns

---

### Phase 8: Step Integration Updates
**Goal:** Update main reconciliation step to pass `mappingId` throughout

#### 8.1 Update `reconciliation.js`

**File:** `src/js/steps/reconciliation.js`

**Changes:**

**A. Function: `updateTableForMappingChange()`** (Line 550-592)

Update to use mappingId:
```javascript
// Update reconciliation data using mappingId
Object.keys(updatedState.reconciliationData).forEach(itemId => {
    const itemData = updatedState.reconciliationData[itemId];

    // Find property by mappingId, not keyName
    Object.entries(itemData.properties).forEach(([mappingId, propData]) => {
        if (propData.keyName === keyName) {
            // Reset this specific mapping
            propData.reconciled = propData.reconciled.map(reconciledItem => ({
                ...reconciledItem,
                status: 'pending',
                matches: [],
                selectedMatch: null
            }));
        }
    });
});
```

**B. Function: `updatePropertyColumn()` (Line 659-706)

Ensure keyObj is passed to cell creation functions

**C. Function: `createValueElement()` (Line 711-736)

Ensure keyObj is passed through

**Testing checkpoint:** Verify table updates affect only intended columns

---

### Phase 9: Backward Compatibility Layer
**Goal:** Ensure old saved states still work

#### 9.1 Add Migration Function

**File:** `src/js/reconciliation/core/reconciliation-data.js`

**Add new function:**
```javascript
/**
 * Migrates old reconciliation data to new mappingId-based structure
 * @param {Object} oldData - Reconciliation data using keyName as key
 * @param {Object} state - State object for generating mappingIds
 * @param {Array} mappedKeys - Current mapped keys
 * @returns {Object} Migrated data using mappingId as key
 */
export function migrateReconciliationData(oldData, state, mappedKeys) {
    const migratedData = {};

    Object.entries(oldData).forEach(([itemId, itemData]) => {
        migratedData[itemId] = {
            originalData: itemData.originalData,
            properties: {}
        };

        // Migrate each property
        Object.entries(itemData.properties).forEach(([keyName, propertyData]) => {
            // Find the corresponding keyObj in mappedKeys
            const keyObj = mappedKeys.find(k =>
                (typeof k === 'string' && k === keyName) ||
                (k.key === keyName)
            );

            if (keyObj && typeof keyObj === 'object' && keyObj.property) {
                // Generate proper mappingId
                const mappingId = state.generateMappingId(
                    keyName,
                    keyObj.property.id,
                    keyObj.selectedAtField
                );

                // Copy data to new location with metadata
                migratedData[itemId].properties[mappingId] = {
                    ...propertyData,
                    keyName: keyName,
                    mappingId: mappingId
                };
            } else {
                // No keyObj found, use keyName as mappingId
                migratedData[itemId].properties[keyName] = {
                    ...propertyData,
                    keyName: keyName,
                    mappingId: keyName
                };
            }
        });
    });

    return migratedData;
}

/**
 * Detects if reconciliation data needs migration
 */
export function needsMigration(reconciliationData, mappedKeys) {
    if (!reconciliationData || Object.keys(reconciliationData).length === 0) {
        return false;
    }

    // Check first item's first property
    const firstItem = Object.values(reconciliationData)[0];
    if (!firstItem || !firstItem.properties) return false;

    const firstProp = Object.values(firstItem.properties)[0];

    // Old format won't have mappingId field
    return !firstProp.mappingId;
}
```

#### 9.2 Add Migration Call

**File:** `src/js/steps/reconciliation.js`

**In `initializeReconciliation()` function:**
```javascript
async function initializeReconciliation() {
    const currentState = state.getState();

    // ... validation code ...

    // Check if existing data needs migration
    if (currentState.reconciliationData && Object.keys(currentState.reconciliationData).length > 0) {
        if (needsMigration(currentState.reconciliationData, mappedKeys)) {
            console.log('🔄 Migrating reconciliation data to new format...');
            const migratedData = migrateReconciliationData(
                currentState.reconciliationData,
                state,
                mappedKeys
            );
            finalReconciliationData = migratedData;
            console.log('✅ Migration complete');
        } else {
            // Use merging logic for new format
            finalReconciliationData = mergeReconciliationData(
                currentState.reconciliationData,
                data,
                mappedKeys,
                state
            );
        }
    } else {
        // Initialize fresh data
        finalReconciliationData = initializeReconciliationDataStructure(data, mappedKeys, state);
    }

    // ... rest of initialization ...
}
```

**Testing checkpoint:** Verify old saved projects still load correctly

---

## Testing Strategy

### Unit Tests (If applicable)
1. Test `initializeReconciliationDataStructure` with duplicate keys
2. Test `mergeReconciliationData` preserves mappingId
3. Test `migrateReconciliationData` converts old to new format
4. Test cell selectors match only intended cells

### Integration Tests
1. **Test Case 1: Single Mapping**
   - Create one mapping from `schema:publisher`
   - Verify reconciliation works as before
   - Check backward compatibility

2. **Test Case 2: Duplicate Mappings - Different @fields**
   - Create `schema:publisher` with `@id` → P123
   - Create `schema:publisher` with `o:label` → P123
   - Verify two separate columns appear
   - Reconcile column 1, verify column 2 unaffected
   - Reconcile column 2, verify column 1 unaffected
   - Click "next" in modal, verify navigation stays within same column

3. **Test Case 3: Duplicate Mappings - Different Properties**
   - Create `schema:publisher` with `@id` → P123
   - Create `schema:publisher` with `@id` → P9999
   - Verify two separate columns appear
   - Test reconciliation independence

4. **Test Case 4: Migration**
   - Load project saved with old format
   - Verify automatic migration occurs
   - Verify all data preserved
   - Verify reconciliation works

5. **Test Case 5: Batch Operations**
   - With duplicate mappings, click "Reconcile" on column 1
   - Verify only column 1 processes
   - Verify column 2 unaffected

### Manual Testing Checklist
- [ ] Table columns display correctly with duplicate key indicators
- [ ] Cell click opens modal for correct column
- [ ] Modal displays correct data for selected cell
- [ ] Confirming value updates correct cell only
- [ ] "Next" navigation stays within current column
- [ ] Batch reconciliation affects only target column
- [ ] Progress tracking counts cells separately
- [ ] Export includes both columns correctly
- [ ] Save/load preserves column independence
- [ ] Old projects migrate successfully

---

## Rollback Plan

### If Critical Issues Found

**Step 1: Identify Issue Scope**
- Is it affecting all projects or only some?
- Is it a data corruption issue or just UI?

**Step 2: Immediate Mitigation**
```bash
# Revert all commits related to this fix
git log --oneline --all --grep="mappingId" -n 10
git revert <commit-hash-1> <commit-hash-2> ...
```

**Step 3: User Communication**
- Notify users via README or documentation
- Provide manual recovery steps if needed

**Step 4: Data Recovery (if needed)**
```javascript
// Add emergency migration-reversal function
export function revertMigration(newData) {
    const revertedData = {};
    Object.entries(newData).forEach(([itemId, itemData]) => {
        revertedData[itemId] = {
            originalData: itemData.originalData,
            properties: {}
        };

        Object.entries(itemData.properties).forEach(([mappingId, propertyData]) => {
            const keyName = propertyData.keyName || mappingId;
            // For colliding keys, keep only first occurrence
            if (!revertedData[itemId].properties[keyName]) {
                revertedData[itemId].properties[keyName] = propertyData;
            }
        });
    });
    return revertedData;
}
```

---

## Implementation Order

### Recommended Sequence

**Session 1: Core Changes (2-3 hours)**
1. Phase 1: Data structure (reconciliation-data.js)
2. Phase 9: Backward compatibility
3. Test data structure with console logging

**Session 2: Table Updates (1-2 hours)**
4. Phase 2: Cell identification (reconciliation-table.js)
5. Phase 3: Cell selectors (reconciliation-table.js)
6. Test table rendering and cell selection

**Session 3: Modal & Operations (1-2 hours)**
7. Phase 4: Modal integration
8. Phase 5: Batch processing
9. Phase 6: Progress tracking
10. Phase 7: Entity matching
11. Phase 8: Step integration

**Session 4: Testing & Polish (1 hour)**
12. Comprehensive testing
13. Documentation updates
14. Code cleanup

### Git Commit Strategy

Each phase should be a separate commit:
```bash
# Phase 1
git add src/js/reconciliation/core/reconciliation-data.js
git commit -m "Phase 1: Update reconciliation data structure to use mappingId

- Change properties key from keyName to mappingId
- Update initializeReconciliationDataStructure()
- Update mergeReconciliationData()
- Store both keyName and mappingId in property metadata"

# Phase 2
git commit -m "Phase 2: Add mappingId to table cell data attributes"

# ... and so on
```

---

## Success Criteria

### Definition of Done
- [ ] All 10 files modified and tested
- [ ] All cell selectors use mappingId
- [ ] Modals correctly identify target column
- [ ] Navigation stays within column context
- [ ] Batch operations affect only target column
- [ ] Progress tracking separates columns
- [ ] Old projects migrate successfully
- [ ] All test cases pass
- [ ] Documentation updated
- [ ] Code review completed

### Performance Checks
- [ ] No significant slowdown in table rendering
- [ ] Modal opening time unchanged
- [ ] Batch reconciliation speed maintained
- [ ] State save/load time acceptable

### Edge Cases Verified
- [ ] Three or more mappings from same key
- [ ] Mixed duplicate and unique keys
- [ ] Manual properties still work
- [ ] Custom properties still work
- [ ] Empty mappings handled
- [ ] Undefined/null values handled

---

## Documentation Updates Required

### Files to Update
1. `README.md` - Note the breaking change
2. `docs/JS_MODULE_MAP.md` - Update reconciliation module description
3. `CHANGELOG.md` - Add entry for this fix
4. Add migration notes to project loading documentation

### User-Facing Documentation
```markdown
## Breaking Change: Reconciliation Data Structure

**Version:** [Next Version]

### What Changed
The reconciliation data structure now uses `mappingId` instead of key names
to support multiple mappings from the same Omeka key.

### Impact
- Projects saved with the old format will be automatically migrated on load
- No action required from users
- Duplicate key mappings now work correctly

### Technical Details
See `docs/RECONCILIATION_MAPPINGID_FIX_PLAN.md` for full implementation details.
```

---

## Risk Assessment

### High Risk Areas
1. **Data Structure Change** - Could corrupt saved projects
   - **Mitigation:** Comprehensive migration logic + testing

2. **Cell Selector Changes** - Could break cell interactions
   - **Mitigation:** Gradual rollout, extensive testing

3. **Modal Integration** - Could cause navigation issues
   - **Mitigation:** Test all modal types thoroughly

### Medium Risk Areas
1. **Batch Processing** - Could process wrong columns
   - **Mitigation:** Clear visual feedback during testing

2. **Progress Tracking** - Could report incorrect progress
   - **Mitigation:** Add validation logging

### Low Risk Areas
1. **UI Display** - Visual issues only, no data corruption
2. **Performance** - Minimal impact expected

---

## Questions & Decisions

### Open Questions
1. **Q:** Should we support rollback to old format?
   - **A:** Yes, add `revertMigration()` function for emergencies

2. **Q:** How to handle ambiguous lookups (when only keyName is available)?
   - **A:** Add helper function that returns first matching mappingId with warning log

3. **Q:** Should old format support be permanent?
   - **A:** Keep for at least 2 major versions, then deprecate

### Design Decisions
1. ✅ Use `mappingId` as primary key (not a compound key)
2. ✅ Store both `keyName` and `mappingId` in property metadata
3. ✅ Keep `data-property` attribute for backward compatibility
4. ✅ Add automatic migration on project load
5. ✅ Prefer explicit `mappingId` parameter over implicit lookups

---

## Notes

### Implementation Tips
- Start with console logging to verify data structure before UI changes
- Test each phase independently before moving to next
- Keep browser DevTools open to catch selector issues
- Use meaningful commit messages for easy rollback
- Add TODO comments for any temporary workarounds

### Known Limitations
- Migration assumes single property match for ambiguous cases
- Performance might degrade with 10+ mappings from same key (edge case)
- Cell selector fallback might match wrong cell in edge cases

### Future Improvements
- Consider adding visual indicators for duplicate key mappings in table headers
- Optimize cell lookups if performance becomes an issue
- Add data structure validation on project load
- Consider warning user about excessive duplicate mappings

---

**End of Implementation Plan**
