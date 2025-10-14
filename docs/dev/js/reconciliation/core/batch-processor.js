/**
 * Batch Processing Module
 * Handles batch reconciliation, auto-acceptance, and processing automation
 * @module reconciliation/core/batch-processor
 */

import { detectPropertyType, getInputFieldConfig, standardizeDateInput } from '../../utils/property-types.js';
import { isDateValue, tryReconciliationApi, tryDirectWikidataSearch } from './entity-matcher.js';

/**
 * Check if an error is retryable based on error message patterns
 * Determines whether a failed reconciliation operation should be retried
 * @param {Error} error - The error object to analyze
 * @returns {boolean} True if the error indicates a retryable condition (network, timeout, etc.)
 */
function isRetryableError(error) {
    const retryableMessages = [
        'timeout',
        'rate limited',
        'server error',
        'fetch',
        'network',
        'temporarily disabled'
    ];
    
    return retryableMessages.some(msg => 
        error.message.toLowerCase().includes(msg)
    );
}

/**
 * Store reconciliation error with enhanced metadata in the reconciliation data structure
 * Ensures proper data structure initialization and stores detailed error information
 * @param {Object} job - Reconciliation job object containing itemId, property, valueIndex, value
 * @param {Object} errorInfo - Error information with message, attempts, and retry status
 * @param {Object} reconciliationData - Main reconciliation data storage object
 */
function storeReconciliationError(job, errorInfo, reconciliationData) {

    const mappingId = job.mappingId || job.property; // Use mappingId from job

    // Ensure data structure exists
    if (!reconciliationData[job.itemId]) {
        reconciliationData[job.itemId] = { properties: {} };
    }
    if (!reconciliationData[job.itemId].properties[mappingId]) {
        reconciliationData[job.itemId].properties[mappingId] = {
            reconciled: [],
            references: []
        };
    }
    if (!reconciliationData[job.itemId].properties[mappingId].reconciled[job.valueIndex]) {
        reconciliationData[job.itemId].properties[mappingId].reconciled[job.valueIndex] = {};
    }

    // Store enhanced error information
    reconciliationData[job.itemId].properties[mappingId].reconciled[job.valueIndex] = {
        status: 'error',
        value: job.value,
        error: errorInfo.message,
        timestamp: errorInfo.timestamp,
        retryable: errorInfo.retryable,
        matches: [] // Empty matches array to indicate error state
    };
}

/**
 * Update cell display to show error state with appropriate visual indicators
 * Updates the UI to reflect reconciliation errors and retry options
 * @param {string} itemId - ID of the item containing the errored cell
 * @param {string} property - Property name that encountered the error
 * @param {number} valueIndex - Index of the specific value that errored
 * @param {Object} errorInfo - Error information object with message and retry status
 */
function updateCellDisplayWithError(itemId, mappingId, valueIndex, errorInfo) {
    const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
    const cell = document.querySelector(cellSelector);
    
    if (cell) {
        const allValueElements = cell.querySelectorAll('.property-value');
        const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
        
        if (valueElement) {
            valueElement.dataset.status = 'error';
            
            const statusSpan = valueElement.querySelector('.value-status');
            if (statusSpan) {
                if (errorInfo.retryable) {
                    statusSpan.textContent = '⚠️ Error - Click to retry';
                    statusSpan.className = 'value-status error retryable';
                    statusSpan.title = `Retryable error: ${errorInfo.message}`;
                } else {
                    statusSpan.textContent = '❌ Error - Click to reconcile';
                    statusSpan.className = 'value-status error';
                    statusSpan.title = `Error: ${errorInfo.message}`;
                }
            }
            
            // Add error styling
            valueElement.classList.remove('checking', 'high-confidence-match', 'partial-match', 'low-confidence-match');
            valueElement.classList.add('reconciliation-error');
        }
    }
}

/**
 * Create batch auto-acceptance processor for high-confidence reconciliation matches
 * Factory function that creates a processor capable of automatically accepting matches
 * that meet specified confidence thresholds, reducing manual review workload
 * @param {Object} dependencies - Dependency injection object containing required functions
 * @param {Function} dependencies.extractPropertyValues - Function to extract values from items
 * @param {Function} dependencies.markCellAsReconciled - Function to mark cells as reconciled
 * @param {Function} dependencies.storeAllMatches - Function to store reconciliation matches
 * @param {Function} dependencies.storeEmptyMatches - Function to store empty match results
 * @returns {Function} Batch processor function for auto-accepting high-confidence matches
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

    return async function performBatchAutoAcceptance(data, mappedKeys) {
        const batchJobs = [];
        let autoAcceptedCount = 0;
        
        // Collect all values that need checking
        data.forEach((item, index) => {
            const itemId = `item-${index}`;
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const mappingId = keyObj?.mappingId || keyName;
                // Pass the full keyObj and state to extractPropertyValues to apply transformations and handle @ field selection
                const values = extractPropertyValues(item, keyObj, state);

                values.forEach((value, valueIndex) => {
                    batchJobs.push({
                        itemId,
                        property: keyName,
                        mappingId,  // NEW: Add mappingId to job
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
            updateCellQueueStatus(job.itemId, job.mappingId, job.valueIndex, 'processing');
            markCellAsReconciled(
                { itemId: job.itemId, property: job.property, mappingId: job.mappingId, valueIndex: job.valueIndex },
                job.autoAcceptResult
            );
            autoAcceptedCount++;
        });
        
        // Process each property group with enhanced error recovery and rate limiting
        let propertyIndex = 0;
        const totalProperties = batchByProperty.size;
        
        for (const [property, jobs] of batchByProperty) {
            propertyIndex++;
            
            // Add inter-property delay to prevent API rate limiting
            if (propertyIndex > 1) {
                const interPropertyDelay = Math.min(500 + (propertyIndex * 100), 2000); // Progressive delay, max 2s
                await new Promise(resolve => setTimeout(resolve, interPropertyDelay));
            }
            
            // Create batch promises for all jobs in this property
            const batchPromises = jobs.map(async (job) => {
                try {
                    updateCellQueueStatus(job.itemId, job.mappingId, job.valueIndex, 'queued');
                    
                    // Try reconciliation API with enhanced error recovery
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
                    
                    return { ...job, noMatches: true }; // No matches found
                    
                } catch (error) {
                    console.error(`❌ Batch reconciliation error for "${job.value}" in property ${property}:`, error);
                    
                    // Enhanced error storage with retry capability
                    return {
                        ...job,
                        error: {
                            message: error.message,
                            timestamp: new Date().toISOString(),
                            retryable: isRetryableError(error)
                        }
                    };
                }
            });
            
            // Wait for all reconciliation calls for this property with controlled concurrency
            const batchSize = 3; // Reduced batch size for better stability
            const propertySuccessCount = { success: 0, error: 0, noMatches: 0 };
            
            for (let i = 0; i < batchPromises.length; i += batchSize) {
                const batchPromiseSlice = batchPromises.slice(i, i + batchSize);
                const batchJobSlice = jobs.slice(i, i + batchSize);
                
                // Mark current batch as processing
                batchJobSlice.forEach(job => {
                    updateCellQueueStatus(job.itemId, job.mappingId, job.valueIndex, 'processing');
                    updateCellLoadingState(job.itemId, job.mappingId, job.valueIndex, true);
                });

                const results = await Promise.all(batchPromiseSlice);

                // Process results with enhanced error handling
                results.forEach((result, index) => {
                    const job = batchJobSlice[index];

                    // Always clear loading and queue state first
                    updateCellLoadingState(job.itemId, job.mappingId, job.valueIndex, false);
                    updateCellQueueStatus(job.itemId, job.mappingId, job.valueIndex, 'clear');

                    if (result.error) {
                        // Handle errors with improved state management
                        propertySuccessCount.error++;
                        storeReconciliationError(job, result.error, reconciliationData);
                        updateCellDisplayWithError(job.itemId, job.mappingId, job.valueIndex, result.error);
                    } else if (result.autoAcceptResult) {
                        // Auto-accept 100% matches
                        propertySuccessCount.success++;
                        markCellAsReconciled(
                            { itemId: result.itemId, property: result.property, mappingId: result.mappingId, valueIndex: result.valueIndex },
                            result.autoAcceptResult
                        );
                        autoAcceptedCount++;
                    } else if (result.allMatches) {
                        // Store all matches for display
                        propertySuccessCount.success++;
                        storeAllMatches(
                            { itemId: result.itemId, property: result.property, mappingId: result.mappingId, valueIndex: result.valueIndex },
                            result.allMatches,
                            result.bestMatch
                        );
                    } else {
                        // No matches found - store empty matches array and set to pending
                        propertySuccessCount.noMatches++;
                        storeEmptyMatches({ itemId: job.itemId, property: job.property, mappingId: job.mappingId, valueIndex: job.valueIndex });
                        updateCellDisplayAsNoMatches(job.itemId, job.mappingId, job.valueIndex);
                    }
                });
                
                // Progressive delay between batches based on error rate
                if (i + batchSize < batchPromises.length) {
                    const errorRate = propertySuccessCount.error / (propertySuccessCount.success + propertySuccessCount.error + propertySuccessCount.noMatches);
                    const delay = errorRate > 0.5 ? 200 : 100; // Longer delay if high error rate
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            // Log property completion stats
        }
        
        // Update proceed button
        updateProceedButton();
    };
}

/**
 * Update button state with visual feedback
 */
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

/**
 * Create column-specific reconciliation processor
 * Factory function that creates a processor for reconciling all values in a single column
 * @param {Object} dependencies - Dependency injection object containing required functions
 * @returns {Function} Column reconciliation processor function
 */
export function createColumnReconciliationProcessor(dependencies) {
    const {
        extractPropertyValues,
        markCellAsReconciled,
        storeAllMatches,
        storeEmptyMatches,
        updateCellLoadingState,
        updateCellDisplayAsNoMatches,
        updateCellDisplayWithMatch,
        updateProceedButton,
        reconciliationData,
        state
    } = dependencies;

    return async function reconcileColumn(property, keyObj, data) {
        const mappingId = keyObj?.mappingId || property;
        const button = document.querySelector(`[data-mapping-id="${mappingId}"] .reconcile-column-btn`);

        // Update button state to processing
        updateButtonState(button, 'processing');

        try {

            // Filter jobs for this column only
            const columnJobs = [];
            data.forEach((item, index) => {
                const itemId = `item-${index}`;
                // Pass the full keyObj and state to extractPropertyValues to handle transformations and @ field selection
                const values = extractPropertyValues(item, keyObj, state);

                values.forEach((value, valueIndex) => {
                    if (value && value.trim()) {
                        columnJobs.push({
                            itemId,
                            property,
                            mappingId,  // NEW: Add mappingId to job
                            valueIndex,
                            value,
                            keyObj
                        });
                    }
                });
            });
            
            
            if (columnJobs.length === 0) {
                updateButtonState(button, 'completed');
                return;
            }
            
            // Process reconciliation for column with progress feedback
            let processedCount = 0;
            let autoAcceptedCount = 0;
            let errorCount = 0;
            
            // Process jobs in smaller batches to provide better progress feedback
            const batchSize = 5;
            for (let i = 0; i < columnJobs.length; i += batchSize) {
                const batch = columnJobs.slice(i, Math.min(i + batchSize, columnJobs.length));
                
                const batchPromises = batch.map(async (job) => {
                    try {
                        // Set loading state
                        updateCellLoadingState(job.itemId, job.mappingId, job.valueIndex, true);

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
                                const autoAcceptResult = {
                                    type: 'wikidata',
                                    id: bestMatch.id,
                                    label: bestMatch.name,
                                    description: bestMatch.description,
                                    qualifiers: {
                                        autoAccepted: true,
                                        reason: '100% confidence match',
                                        score: bestMatch.score
                                    }
                                };
                                
                                markCellAsReconciled(
                                    { itemId: job.itemId, property: job.property, mappingId: job.mappingId, valueIndex: job.valueIndex },
                                    autoAcceptResult
                                );
                                autoAcceptedCount++;
                            } else {
                                // Store matches for manual review
                                storeAllMatches(
                                    { itemId: job.itemId, property: job.property, mappingId: job.mappingId, valueIndex: job.valueIndex },
                                    matches,
                                    bestMatch
                                );
                                updateCellDisplayWithMatch(job.itemId, job.mappingId, job.valueIndex, bestMatch);
                            }
                        } else {
                            // No matches found
                            storeEmptyMatches({ itemId: job.itemId, property: job.property, mappingId: job.mappingId, valueIndex: job.valueIndex });
                            updateCellDisplayAsNoMatches(job.itemId, job.mappingId, job.valueIndex);
                        }

                        processedCount++;

                    } catch (error) {
                        console.error(`Error reconciling ${job.property} value "${job.value}":`, error);

                        // Store error information
                        const errorInfo = {
                            message: error.message,
                            timestamp: new Date().toISOString(),
                            retryable: isRetryableError(error)
                        };

                        storeReconciliationError(job, errorInfo, reconciliationData);
                        updateCellDisplayWithError(job.itemId, job.mappingId, job.valueIndex, errorInfo);
                        errorCount++;
                    } finally {
                        // Remove loading state
                        updateCellLoadingState(job.itemId, job.mappingId, job.valueIndex, false);
                    }
                });
                
                // Wait for batch to complete
                await Promise.all(batchPromises);
                
                // Add delay between batches to prevent API rate limiting
                if (i + batchSize < columnJobs.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Log completion stats
            
            // Update button state to completed
            updateButtonState(button, 'completed');
            
            // Update proceed button state
            updateProceedButton();
            
        } catch (error) {
            console.error(`Fatal error reconciling column ${property}:`, error);
            updateButtonState(button, 'error');
        }
    };
}

/**
 * Create next unprocessed cell reconciler with enhanced error handling
 */
export function createNextUnprocessedCellReconciler(dependencies) {
    const { calculateCurrentProgress, state, updateProceedButton, reconciliationData } = dependencies;

    return function reconcileNextUnprocessedCell() {
        // Find first pending or error cell (prioritize pending, then retryable errors)
        let nextCell = document.querySelector('.property-value[data-status="pending"]');
        
        if (!nextCell) {
            // Look for retryable errors if no pending cells
            nextCell = document.querySelector('.property-value[data-status="error"] .value-status.retryable');
            if (nextCell) {
                nextCell = nextCell.closest('.property-value');
            }
        }
        
        if (!nextCell) {
            // Look for any error cells if no retryable errors
            nextCell = document.querySelector('.property-value[data-status="error"]');
        }
        
        if (nextCell) {
            nextCell.click();
        } else {
            // All cells processed - calculate progress and update state
            
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