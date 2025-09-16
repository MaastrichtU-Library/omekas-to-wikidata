/**
 * Batch Processing Module
 * Handles batch reconciliation, auto-acceptance, and processing automation
 * @module reconciliation/core/batch-processor
 */

import { detectPropertyType, getInputFieldConfig, standardizeDateInput } from '../../utils/property-types.js';
import { isDateValue, tryReconciliationApi, tryDirectWikidataSearch } from './entity-matcher.js';

/**
 * Check if an error is retryable
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
 * Store reconciliation error with enhanced metadata
 */
function storeReconciliationError(job, errorInfo, reconciliationData) {
    
    // Ensure data structure exists
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
    
    // Store enhanced error information
    reconciliationData[job.itemId].properties[job.property].reconciled[job.valueIndex] = {
        status: 'error',
        value: job.value,
        error: errorInfo.message,
        timestamp: errorInfo.timestamp,
        retryable: errorInfo.retryable,
        matches: [] // Empty matches array to indicate error state
    };
}

/**
 * Update cell display to show error state
 */
function updateCellDisplayWithError(itemId, property, valueIndex, errorInfo) {
    const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
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
                // Pass the full keyObj and state to extractPropertyValues to apply transformations and handle @ field selection
                const values = extractPropertyValues(item, keyObj, state);
                
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
        
        // Process each property group with enhanced error recovery and rate limiting
        let propertyIndex = 0;
        const totalProperties = batchByProperty.size;
        
        for (const [property, jobs] of batchByProperty) {
            propertyIndex++;
            console.log(`🔄 Processing property ${propertyIndex}/${totalProperties}: ${property} (${jobs.length} values)`);
            
            // Add inter-property delay to prevent API rate limiting
            if (propertyIndex > 1) {
                const interPropertyDelay = Math.min(500 + (propertyIndex * 100), 2000); // Progressive delay, max 2s
                console.log(`⏳ Inter-property delay: ${interPropertyDelay}ms`);
                await new Promise(resolve => setTimeout(resolve, interPropertyDelay));
            }
            
            // Create batch promises for all jobs in this property
            const batchPromises = jobs.map(async (job) => {
                try {
                    updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'queued');
                    
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
                    updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'processing');
                    updateCellLoadingState(job.itemId, job.property, job.valueIndex, true);
                });
                
                const results = await Promise.all(batchPromiseSlice);
                
                // Process results with enhanced error handling
                results.forEach((result, index) => {
                    const job = batchJobSlice[index];
                    
                    // Always clear loading and queue state first
                    updateCellLoadingState(job.itemId, job.property, job.valueIndex, false);
                    updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'clear');
                    
                    if (result.error) {
                        // Handle errors with improved state management
                        propertySuccessCount.error++;
                        storeReconciliationError(job, result.error, reconciliationData);
                        updateCellDisplayWithError(job.itemId, job.property, job.valueIndex, result.error);
                    } else if (result.autoAcceptResult) {
                        // Auto-accept 100% matches
                        propertySuccessCount.success++;
                        markCellAsReconciled(
                            { itemId: result.itemId, property: result.property, valueIndex: result.valueIndex },
                            result.autoAcceptResult
                        );
                        autoAcceptedCount++;
                    } else if (result.allMatches) {
                        // Store all matches for display
                        propertySuccessCount.success++;
                        storeAllMatches(
                            { itemId: result.itemId, property: result.property, valueIndex: result.valueIndex },
                            result.allMatches,
                            result.bestMatch
                        );
                    } else {
                        // No matches found - store empty matches array and set to pending
                        propertySuccessCount.noMatches++;
                        storeEmptyMatches({ itemId: job.itemId, property: job.property, valueIndex: job.valueIndex });
                        updateCellDisplayAsNoMatches(job.itemId, job.property, job.valueIndex);
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
            console.log(`✅ Property ${property} completed:`, {
                successful: propertySuccessCount.success,
                errors: propertySuccessCount.error,
                noMatches: propertySuccessCount.noMatches
            });
        }
        
        // Update proceed button
        updateProceedButton();
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
            console.log('🎯 Found next unprocessed cell:', {
                status: nextCell.dataset.status,
                itemId: nextCell.closest('[data-item-id]')?.dataset.itemId,
                property: nextCell.closest('[data-property]')?.dataset.property
            });
            nextCell.click();
        } else {
            // All cells processed - calculate progress and update state
            console.log('✅ All reconciliation cells processed');
            
            if (reconciliationData && Object.keys(reconciliationData).length > 0) {
                const progress = calculateCurrentProgress();
                state.updateState('reconciliationProgress', progress);
                
                console.log('📊 Final reconciliation progress:', progress);
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