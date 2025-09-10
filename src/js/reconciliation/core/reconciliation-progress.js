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
        const { itemId, property, valueIndex } = cellInfo;
        
        // Update data structure to store all matches
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex].matches = allMatches;
                propData.reconciled[valueIndex].confidence = bestMatch.score;
            }
        }
        
        // Update UI to show the best match percentage (for table display)
        updateCellDisplayWithMatch(itemId, property, valueIndex, bestMatch);
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    };
}

/**
 * Store empty matches when no reconciliation results found
 */
export function createEmptyMatchesStorer(reconciliationData, state) {
    return function storeEmptyMatches(cellInfo) {
        const { itemId, property, valueIndex } = cellInfo;
        
        // Update data structure to store empty matches array
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
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
export function updateCellQueueStatus(itemId, property, valueIndex, status) {
    const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
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
    
    function markCellAsReconciled(cellInfo, reconciliation) {
        const { itemId, property, valueIndex } = cellInfo;
        
        // Update data structure
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex] = {
                    status: 'reconciled',
                    selectedMatch: reconciliation,
                    matches: [], // Could store all matches for reference
                    confidence: reconciliation.type === 'wikidata' ? 95 : 80
                };
            }
        }
        
        // Update UI
        updateCellDisplay(itemId, property, valueIndex, 'reconciled', reconciliation);
        
        // Update progress
        state.incrementReconciliationCompleted();
        updateProceedButton();
        
        // Store in context suggestions
        if (reconciliation.type === 'wikidata') {
            contextSuggestions.set(property, reconciliation);
        }
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    }
    
    function markCellAsSkipped(cellInfo) {
        const { itemId, property, valueIndex } = cellInfo;
        
        // Update data structure
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex].status = 'skipped';
            }
        }
        
        // Update UI
        updateCellDisplay(itemId, property, valueIndex, 'skipped');
        
        // Update progress
        state.incrementReconciliationSkipped();
        updateProceedButton();
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    }
    
    function markCellAsNoItem(cellInfo) {
        const { itemId, property, valueIndex } = cellInfo;
        
        // Update data structure
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex].status = 'no-item';
                propData.reconciled[valueIndex].selectedMatch = {
                    type: 'no-item',
                    reason: 'No appropriate Wikidata item exists'
                };
            }
        }
        
        // Update UI
        updateCellDisplay(itemId, property, valueIndex, 'no-item');
        
        // Update progress (count as completed since it's a decision)
        state.incrementReconciliationCompleted();
        updateProceedButton();
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    }
    
    function markCellAsString(cellInfo) {
        const { itemId, property, valueIndex, value } = cellInfo;
        
        // Update data structure
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex].status = 'reconciled';
                propData.reconciled[valueIndex].selectedMatch = {
                    type: 'string',
                    value: value,
                    label: value,
                    description: 'Used as string value'
                };
            }
        }
        
        // Update UI
        updateCellDisplay(itemId, property, valueIndex, 'reconciled', {
            type: 'string',
            value: value,
            label: value,
            description: 'Used as string value'
        });
        
        // Update progress (count as completed since it's a decision)
        state.incrementReconciliationCompleted();
        updateProceedButton();
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    }
    
    return {
        markCellAsReconciled,
        markCellAsSkipped,
        markCellAsNoItem,
        markCellAsString
    };
}