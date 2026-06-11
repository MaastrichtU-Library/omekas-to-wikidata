/**
 * Reconciliation Progress Management Module
 * Handles progress tracking, cell state management, and status updates
 * @module reconciliation/core/reconciliation-progress
 */

/**
 * Calculate current reconciliation progress from reconciliation data
 */
export function createProgressCalculator(reconciliationData) {
    return function calculateCurrentProgress() {
        let total = 0;
        let completed = 0;
        let skipped = 0;
        let errors = 0;
        
        Object.values(reconciliationData).forEach(itemData => {
            Object.values(itemData.properties).forEach(propData => {
                propData.reconciled.forEach(reconciledItem => {
                    total++;
                    if (reconciledItem.status === 'reconciled' || reconciledItem.status === 'no-item') {
                        completed++;
                    } else if (reconciledItem.status === 'skipped') {
                        skipped++;
                    } else if (reconciledItem.status === 'error') {
                        errors++;
                    }
                });
            });
        });
        
        return { total, completed, skipped, errors };
    };
}

/**
 * Create proceed button state updater
 */
export function createProceedButtonUpdater(proceedToDesignerBtn, state) {
    return function updateProceedButton() {
        if (proceedToDesignerBtn) {
            const currentState = state.getState();
            const canProceed = currentState.reconciliationProgress.completed + currentState.reconciliationProgress.skipped >= currentState.reconciliationProgress.total && 
                              currentState.reconciliationProgress.total > 0;
            proceedToDesignerBtn.disabled = !canProceed;
        }
    };
}

/**
 * Store all matches for a reconciliation cell
 */
export function createMatchesStorer(reconciliationData, state, updateCellDisplayWithMatch) {
    return function storeAllMatches(cellInfo, allMatches, bestMatch) {
        const { itemId, mappingId, valueIndex } = cellInfo;

        // Update data structure to store all matches
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[mappingId]) {
            const propData = reconciliationData[itemId].properties[mappingId];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex].matches = allMatches;
                propData.reconciled[valueIndex].confidence = bestMatch.score;
            }
        }

        // Update UI to show the best match percentage (for table display)
        updateCellDisplayWithMatch(itemId, mappingId, valueIndex, bestMatch);

        // Update state
        state.updateState('reconciliationData', reconciliationData);
    };
}

/**
 * Store empty matches when no reconciliation results found
 */
export function createEmptyMatchesStorer(reconciliationData, state) {
    return function storeEmptyMatches(cellInfo) {
        const { itemId, mappingId, valueIndex } = cellInfo;

        // Update data structure to store empty matches array
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[mappingId]) {
            const propData = reconciliationData[itemId].properties[mappingId];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex].matches = [];
                propData.reconciled[valueIndex].confidence = 0;
            }
        }

        // Update state
        state.updateState('reconciliationData', reconciliationData);
    };
}

/**
 * Update cell queue status in the UI
 */
export function updateCellQueueStatus(itemId, mappingId, valueIndex, status) {
    const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
    const cell = document.querySelector(cellSelector);
    
    if (cell) {
        // For multiple values, always use indexed selection; for single values, use the first element
        const allValueElements = cell.querySelectorAll('.property-value');
        const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
        
        if (valueElement) {
            // Remove all queue-related classes
            valueElement.classList.remove('queued', 'processing', 'checking');
            
            // Add appropriate class based on status
            if (status === 'queued') {
                valueElement.classList.add('queued');
                const statusSpan = valueElement.querySelector('.value-status');
                if (statusSpan && statusSpan.textContent === 'Click to reconcile') {
                    statusSpan.textContent = 'Queued...';
                    statusSpan.className = 'value-status queued';
                }
            } else if (status === 'processing') {
                valueElement.classList.add('processing');
                // Don't change text during processing - the spinner shows activity
            } else if (status === 'clear') {
                // Clear queue status and revert to normal
                const statusSpan = valueElement.querySelector('.value-status');
                if (statusSpan && statusSpan.className.includes('queued')) {
                    statusSpan.textContent = 'Click to reconcile';
                    statusSpan.className = 'value-status';
                }
            }
        }
    }
}

/**
 * Create cell marking functions factory
 */
export function createCellMarkers(reconciliationData, state, updateCellDisplay, updateProceedButton, contextSuggestions) {
    function cloneReconciliationPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return payload;
        }

        return JSON.parse(JSON.stringify(payload));
    }

    function normalizeComparableValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value).trim();
    }

    function calculateProgressSnapshot() {
        let total = 0;
        let completed = 0;
        let skipped = 0;
        let errors = 0;

        Object.values(reconciliationData).forEach(itemData => {
            Object.values(itemData.properties || {}).forEach(propData => {
                (propData.reconciled || []).forEach(reconciledItem => {
                    total++;

                    if (reconciledItem.status === 'reconciled' || reconciledItem.status === 'no-item') {
                        completed++;
                    } else if (reconciledItem.status === 'skipped') {
                        skipped++;
                    } else if (reconciledItem.status === 'error') {
                        errors++;
                    }
                });
            });
        });

        return { total, completed, skipped, errors };
    }

    function syncProgressState() {
        const progress = calculateProgressSnapshot();
        state.updateState('reconciliationProgress', progress);
        updateProceedButton();
        return progress;
    }

    function getCellEntry(cellInfo) {
        const { itemId, mappingId, valueIndex } = cellInfo;
        const propData = reconciliationData[itemId]?.properties?.[mappingId];
        const reconciledEntry = propData?.reconciled?.[valueIndex];

        return { propData, reconciledEntry };
    }

    function getMatchingCells(cellInfo) {
        const normalizedValue = normalizeComparableValue(
            reconciliationData[cellInfo.itemId]?.properties?.[cellInfo.mappingId]?.originalValues?.[cellInfo.valueIndex] ?? cellInfo.value
        );

        if (!cellInfo.applyToIdenticalValues || !normalizedValue) {
            return [cellInfo];
        }

        const matchingCells = [];

        Object.entries(reconciliationData).forEach(([itemId, itemData]) => {
            const propData = itemData.properties?.[cellInfo.mappingId];
            if (!propData || !Array.isArray(propData.originalValues)) {
                return;
            }

            propData.originalValues.forEach((originalValue, valueIndex) => {
                if (normalizeComparableValue(originalValue) !== normalizedValue) {
                    return;
                }

                matchingCells.push({
                    ...cellInfo,
                    itemId,
                    valueIndex,
                    value: originalValue
                });
            });
        });

        return matchingCells.length > 0 ? matchingCells : [cellInfo];
    }

    function markCellAsReconciled(cellInfo, reconciliation) {
        const targetCells = getMatchingCells(cellInfo);

        targetCells.forEach(targetCell => {
            const { itemId, property, mappingId, valueIndex } = targetCell;
            const { propData, reconciledEntry } = getCellEntry(targetCell);

            if (propData && reconciledEntry) {
                propData.reconciled[valueIndex] = {
                    ...reconciledEntry,
                    status: 'reconciled',
                    selectedMatch: cloneReconciliationPayload(reconciliation),
                    matches: [],
                    confidence: reconciliation.type === 'wikidata' ? 95 : 80
                };
            }

            updateCellDisplay(itemId, mappingId, valueIndex, 'reconciled', reconciliation);

            if (reconciliation.type === 'wikidata') {
                contextSuggestions.set(property, reconciliation);
            }
        });

        syncProgressState();
        state.updateState('reconciliationData', reconciliationData);
    }
    
    function markCellAsSkipped(cellInfo) {
        const targetCells = getMatchingCells(cellInfo);

        targetCells.forEach(targetCell => {
            const { itemId, mappingId, valueIndex } = targetCell;
            const { propData, reconciledEntry } = getCellEntry(targetCell);

            if (propData && reconciledEntry) {
                propData.reconciled[valueIndex] = {
                    ...reconciledEntry,
                    status: 'skipped',
                    selectedMatch: null,
                    confidence: 0
                };
            }

            updateCellDisplay(itemId, mappingId, valueIndex, 'skipped');
        });

        syncProgressState();
        state.updateState('reconciliationData', reconciliationData);
    }
    
    function markCellAsNoItem(cellInfo) {
        const targetCells = getMatchingCells(cellInfo);

        targetCells.forEach(targetCell => {
            const { itemId, mappingId, valueIndex } = targetCell;
            const { propData, reconciledEntry } = getCellEntry(targetCell);

            if (propData && reconciledEntry) {
                propData.reconciled[valueIndex] = {
                    ...reconciledEntry,
                    status: 'no-item',
                    selectedMatch: {
                        type: 'no-item',
                        reason: 'No appropriate Wikidata item exists'
                    },
                    confidence: 0
                };
            }

            updateCellDisplay(itemId, mappingId, valueIndex, 'no-item');
        });

        syncProgressState();
        state.updateState('reconciliationData', reconciliationData);
    }
    
    function markCellAsString(cellInfo) {
        const targetCells = getMatchingCells(cellInfo);

        targetCells.forEach(targetCell => {
            const { itemId, mappingId, valueIndex, value } = targetCell;
            const { propData, reconciledEntry } = getCellEntry(targetCell);
            const stringSelection = {
                type: 'string',
                value,
                label: value,
                description: 'Used as string value'
            };

            if (propData && reconciledEntry) {
                propData.reconciled[valueIndex] = {
                    ...reconciledEntry,
                    status: 'reconciled',
                    selectedMatch: stringSelection,
                    matches: [],
                    confidence: 80
                };
            }

            updateCellDisplay(itemId, mappingId, valueIndex, 'reconciled', stringSelection);
        });

        syncProgressState();
        state.updateState('reconciliationData', reconciliationData);
    }

    function markCellAsPending(cellInfo) {
        const { itemId, mappingId, valueIndex } = cellInfo;
        const { propData, reconciledEntry } = getCellEntry(cellInfo);

        if (propData && reconciledEntry) {
            propData.reconciled[valueIndex] = {
                ...reconciledEntry,
                status: 'pending',
                selectedMatch: null,
                confidence: 0
            };
        }

        updateCellDisplay(itemId, mappingId, valueIndex, 'pending');
        syncProgressState();
        state.updateState('reconciliationData', reconciliationData);
    }
    
    return {
        markCellAsReconciled,
        markCellAsSkipped,
        markCellAsNoItem,
        markCellAsString,
        markCellAsPending
    };
}
