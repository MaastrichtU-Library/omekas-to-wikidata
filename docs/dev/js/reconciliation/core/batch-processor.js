/**
 * Batch Processing Module
 * Handles batch reconciliation, auto-acceptance, and processing automation
 * @module reconciliation/core/batch-processor
 */

import { detectPropertyType, getInputFieldConfig, standardizeDateInput } from '../../utils/property-types.js';
import { isDateValue, tryReconciliationApi, tryDirectWikidataSearch } from './entity-matcher.js';

/**
 * Create batch auto-acceptance processor
 */
export function createBatchAutoAcceptanceProcessor(dependencies) {
    const {
        extractPropertyValues,
        markCellAsReconciled,
        storeAllMatches,
        storeEmptyMatches,
        updateCellQueueStatus,
        updateCellLoadingState,
        updateCellDisplayAsNoMatches,
        updateProceedButton,
        reconciliationData,
        state
    } = dependencies;

    return async function performBatchAutoAcceptance(data, mappedKeys, manualProperties = []) {
        const batchJobs = [];
        let autoAcceptedCount = 0;
        
        // Collect all values that need checking
        data.forEach((item, index) => {
            const itemId = `item-${index}`;
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const values = extractPropertyValues(item, keyName);
                
                values.forEach((value, valueIndex) => {
                    batchJobs.push({
                        itemId,
                        property: keyName,
                        valueIndex,
                        value
                    });
                });
            });
        });
        
        // Group by property to batch API calls efficiently
        const batchByProperty = new Map();
        const dateValues = [];
        
        batchJobs.forEach(job => {
            const propertyType = detectPropertyType(job.property);
            const inputConfig = getInputFieldConfig(propertyType);
            
            // Handle dates immediately (no API call needed)
            if (propertyType === 'time' || isDateValue(job.value)) {
                // Standardize the date and detect precision
                const standardized = standardizeDateInput(job.value);
                
                dateValues.push({
                    ...job,
                    autoAcceptResult: {
                        type: 'custom',
                        value: standardized.date || job.value,
                        datatype: 'time',
                        qualifiers: {
                            autoAccepted: true,
                            reason: 'date value',
                            precision: standardized.precision,
                            displayValue: standardized.displayValue
                        }
                    }
                });
            } 
            // Group API-requiring properties
            else if (inputConfig.requiresReconciliation) {
                if (!batchByProperty.has(job.property)) {
                    batchByProperty.set(job.property, []);
                }
                batchByProperty.get(job.property).push(job);
            }
        });
        
        // Auto-accept all date values first
        dateValues.forEach(job => {
            updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'processing');
            markCellAsReconciled(
                { itemId: job.itemId, property: job.property, valueIndex: job.valueIndex },
                job.autoAcceptResult
            );
            autoAcceptedCount++;
        });
        
        // Process each property group with batch reconciliation
        for (const [property, jobs] of batchByProperty) {
            // Create batch promises for all jobs in this property
            const batchPromises = jobs.map(async (job) => {
                try {
                    updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'queued');
                    
                    // Try reconciliation API
                    let matches = await tryReconciliationApi(job.value, job.property, []);
                    
                    // If no good matches from API, try direct search
                    if (!matches || matches.length === 0) {
                        matches = await tryDirectWikidataSearch(job.value);
                    }
                    
                    if (matches && matches.length > 0) {
                        const bestMatch = matches[0];
                        
                        // Auto-accept 100% confidence matches
                        if (bestMatch.score >= 100) {
                            return {
                                ...job,
                                autoAcceptResult: {
                                    type: 'wikidata',
                                    id: bestMatch.id,
                                    label: bestMatch.name,
                                    description: bestMatch.description,
                                    qualifiers: {
                                        autoAccepted: true,
                                        reason: '100% confidence match',
                                        score: bestMatch.score
                                    }
                                }
                            };
                        } else {
                            // Store matches for manual review
                            return {
                                ...job,
                                allMatches: matches,
                                bestMatch: bestMatch
                            };
                        }
                    }
                    
                    return null; // No matches found
                    
                } catch (error) {
                    console.error(`Batch reconciliation error for "${job.value}":`, error);
                    
                    // Store error in reconciliation data
                    if (!reconciliationData[job.itemId]) {
                        reconciliationData[job.itemId] = { properties: {} };
                    }
                    if (!reconciliationData[job.itemId].properties[job.property]) {
                        reconciliationData[job.itemId].properties[job.property] = { 
                            reconciled: [],
                            references: []
                        };
                    }
                    if (!reconciliationData[job.itemId].properties[job.property].reconciled[job.valueIndex]) {
                        reconciliationData[job.itemId].properties[job.property].reconciled[job.valueIndex] = {};
                    }
                    
                    reconciliationData[job.itemId].properties[job.property].reconciled[job.valueIndex] = {
                        status: 'error',
                        value: job.value,
                        error: error.message
                    };
                }
                return null;
            });
            
            // Wait for all reconciliation calls for this property with controlled concurrency
            const batchSize = 5; // Limit concurrent API calls
            for (let i = 0; i < batchPromises.length; i += batchSize) {
                const batchPromiseSlice = batchPromises.slice(i, i + batchSize);
                const batchJobSlice = jobs.slice(i, i + batchSize);
                
                // Mark current batch as processing
                batchJobSlice.forEach(job => {
                    updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'processing');
                    updateCellLoadingState(job.itemId, job.property, job.valueIndex, true);
                });
                
                const results = await Promise.all(batchPromiseSlice);
                
                // Process results
                results.forEach((result, index) => {
                    const job = batchJobSlice[index];
                    
                    // Always clear loading and queue state first
                    updateCellLoadingState(job.itemId, job.property, job.valueIndex, false);
                    updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'clear');
                    
                    if (result) {
                        if (result.autoAcceptResult) {
                            // Auto-accept 100% matches
                            markCellAsReconciled(
                                { itemId: result.itemId, property: result.property, valueIndex: result.valueIndex },
                                result.autoAcceptResult
                            );
                            autoAcceptedCount++;
                        } else if (result.allMatches) {
                            // Store all matches for display
                            storeAllMatches(
                                { itemId: result.itemId, property: result.property, valueIndex: result.valueIndex },
                                result.allMatches,
                                result.bestMatch
                            );
                        } else {
                            // No matches found - store empty matches array and set to pending
                            storeEmptyMatches({ itemId: job.itemId, property: job.property, valueIndex: job.valueIndex });
                            updateCellDisplayAsNoMatches(job.itemId, job.property, job.valueIndex);
                        }
                    } else {
                        // Result was null - store empty matches array and set to pending
                        storeEmptyMatches({ itemId: job.itemId, property: job.property, valueIndex: job.valueIndex });
                        updateCellDisplayAsNoMatches(job.itemId, job.property, job.valueIndex);
                    }
                });
                
                // Small delay between batches to be respectful to APIs
                if (i + batchSize < batchPromises.length) {
                    await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay
                }
            }
        }
        
        // Update proceed button
        updateProceedButton();
    };
}

/**
 * Create next unprocessed cell reconciler
 */
export function createNextUnprocessedCellReconciler(dependencies) {
    const { calculateCurrentProgress, state, updateProceedButton, reconciliationData } = dependencies;

    return function reconcileNextUnprocessedCell() {
        // Find first pending cell
        const pendingCell = document.querySelector('.property-value[data-status="pending"]');
        if (pendingCell) {
            pendingCell.click();
        } else {
            // Reconciliation complete - no alert needed
            // Calculate current progress from actual reconciliation data and update state
            if (reconciliationData && Object.keys(reconciliationData).length > 0) {
                const progress = calculateCurrentProgress();
                state.updateState('reconciliationProgress', progress);
            }
            updateProceedButton();
        }
    };
}

/**
 * Simple getter for auto-advance setting
 */
export function createAutoAdvanceSettingGetter(autoAdvanceSetting) {
    return function getAutoAdvanceSetting() {
        return autoAdvanceSetting;
    };
}

/**
 * Set up auto-advance toggle UI
 */
export function createAutoAdvanceToggleSetup(autoAdvanceSetting) {
    return function setupAutoAdvanceToggle() {
        const autoAdvanceCheckbox = document.getElementById('auto-advance');
        if (autoAdvanceCheckbox) {
            autoAdvanceCheckbox.addEventListener('change', (e) => {
                autoAdvanceSetting = e.target.checked;
            });
        }
    };
}