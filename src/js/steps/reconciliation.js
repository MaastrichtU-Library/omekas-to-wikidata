/**
 * Handles the Reconciliation step functionality
 * Manages the process of reconciling Omeka S values with Wikidata entities
 * Implements OpenRefine-style reconciliation interface with modal-based workflow
 */

import { setupModalUI } from '../ui/modal-ui.js';
import { detectPropertyType, getInputFieldConfig, createInputHTML, validateInput, getSuggestedEntityTypes, setupDynamicDatePrecision, standardizeDateInput } from '../utils/property-types.js';
import { eventSystem } from '../events.js';
import { getMockItemsData, getMockMappingData } from '../data/mock-data.js';

export function setupReconciliationStep(state) {
    console.log('🔧 Setting up ReconciliationStep module');
    
    // Initialize modal UI
    const modalUI = setupModalUI();
    
    // Listen for STEP_CHANGED events to initialize reconciliation when entering step 3
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        console.log('🎯 STEP_CHANGED event received:', data);
        if (data.newStep === 3) {
            console.log('🎯 Entering step 3 - calling initializeReconciliation()');
            setTimeout(() => {
                initializeReconciliation();
            }, 100); // Small delay to ensure DOM is updated
        }
    });
    
    // Initialize DOM elements
    const propertyHeaders = document.getElementById('property-headers');
    const reconciliationRows = document.getElementById('reconciliation-rows');
    const reconciliationProgress = document.getElementById('reconciliation-progress');
    const reconcileNextBtn = document.getElementById('reconcile-next');
    const proceedToDesignerBtn = document.getElementById('proceed-to-designer');
    const testReconciliationModelBtn = document.getElementById('test-reconciliation-model');
    
    // Debug DOM element initialization
    console.log('🔧 ReconciliationStep DOM elements initialized:');
    console.log('  - propertyHeaders:', !!propertyHeaders, propertyHeaders);
    console.log('  - reconciliationRows:', !!reconciliationRows, reconciliationRows);
    console.log('  - reconciliationProgress:', !!reconciliationProgress, reconciliationProgress);
    console.log('  - reconcileNextBtn:', !!reconcileNextBtn, reconcileNextBtn);
    console.log('  - proceedToDesignerBtn:', !!proceedToDesignerBtn, proceedToDesignerBtn);
    console.log('  - testReconciliationModelBtn:', !!testReconciliationModelBtn, testReconciliationModelBtn);
    
    // Reconciliation state management
    let reconciliationData = {};
    let currentReconciliationCell = null;
    let contextSuggestions = new Map(); // Store previously selected values for suggestions
    let autoAdvanceSetting = true; // Default to auto-advance enabled
    
    // Initialize reconciliation data when entering this step
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🎯 ReconciliationStep: DOM loaded, setting up event listeners');
        
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            console.log(`🎯 Adding click listener to step ${step.dataset.step}`);
            step.addEventListener('click', () => {
                const stepNumber = parseInt(step.dataset.step);
                console.log(`🎯 Step ${stepNumber} clicked`);
                if (stepNumber === 3) {
                    console.log('🎯 Step 3 clicked - calling initializeReconciliation()');
                    initializeReconciliation();
                }
            });
        });
        
        // Also listen for the navigation button
        const proceedBtn = document.getElementById('proceed-to-reconciliation');
        if (proceedBtn) {
            console.log('🎯 Found proceed-to-reconciliation button, adding listener');
            proceedBtn.addEventListener('click', () => {
                console.log('🎯 proceed-to-reconciliation button clicked - calling initializeReconciliation()');
                initializeReconciliation();
            });
        } else {
            console.warn('🎯 proceed-to-reconciliation button not found!');
        }
    });
    
    // Reconcile next item button - now processes next unreconciled cell
    if (reconcileNextBtn) {
        reconcileNextBtn.addEventListener('click', () => {
            reconcileNextUnprocessedCell();
        });
    }
    
    // Test reconciliation model button for debugging
    if (testReconciliationModelBtn) {
        testReconciliationModelBtn.addEventListener('click', () => {
            console.log('🧪 Test reconciliation button clicked - loading mock data');
            loadMockDataForTesting();
        });
    }
    
    /**
     * Initialize reconciliation interface based on fetched data and mappings
     */
    async function initializeReconciliation() {
        console.log('🚀 initializeReconciliation() called');
        const currentState = state.getState();
        console.log('🚀 Current state:', currentState);
        
        if (!currentState.mappings || !currentState.mappings.mappedKeys || !currentState.mappings.mappedKeys.length) {
            console.warn('❌ No mapped keys available for reconciliation');
            console.warn('❌ Current mappings:', currentState.mappings);
            return;
        }
        
        // Pre-filter check: ensure we have keys that exist in the current dataset
        const availableMappedKeys = currentState.mappings.mappedKeys.filter(keyObj => !keyObj.notInCurrentDataset);
        if (availableMappedKeys.length === 0) {
            console.warn('❌ No mapped keys are available in the current dataset for reconciliation');
            console.warn('❌ All mapped keys are from a different dataset or not present in current data');
            return;
        }
        
        if (!currentState.fetchedData) {
            console.warn('❌ No fetched data available for reconciliation');
            console.warn('❌ Current fetchedData:', currentState.fetchedData);
            return;
        }
        
        console.log('✅ Validation passed - proceeding with reconciliation initialization');
        console.log('✅ Mapped keys:', currentState.mappings.mappedKeys);
        console.log('✅ Fetched data type:', typeof currentState.fetchedData);
        console.log('✅ Fetched data structure:', currentState.fetchedData);
        
        // Filter out keys that are not in the current dataset
        const mappedKeys = currentState.mappings.mappedKeys.filter(keyObj => !keyObj.notInCurrentDataset);
        console.log('✅ Filtered mapped keys (excluding not in current dataset):', mappedKeys);
        
        const data = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
        console.log('✅ Data array:', data);
        console.log('✅ Data length:', data.length);
        
        // Check if we already have reconciliation data from a previous session
        let isReturningToStep = false;
        if (currentState.reconciliationData && Object.keys(currentState.reconciliationData).length > 0) {
            console.log('🔄 Found existing reconciliation data - restoring previous state');
            reconciliationData = currentState.reconciliationData;
            isReturningToStep = true;
        } else {
            console.log('🆕 No existing reconciliation data - initializing fresh');
            
            // Initialize reconciliation progress
            const totalCells = calculateTotalReconciliableCells(data, mappedKeys);
            console.log('✅ Total reconcilable cells:', totalCells);
            state.updateState('reconciliationProgress', {
                total: totalCells,
                completed: 0,
                skipped: 0
            });
            
            // Initialize reconciliation data structure
            reconciliationData = {};
            data.forEach((item, index) => {
                const itemId = `item-${index}`;
                reconciliationData[itemId] = {
                    originalData: item,
                    properties: {}
                };
                
                // Initialize each mapped property
                mappedKeys.forEach(keyObj => {
                    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                    const values = extractPropertyValues(item, keyName);
                    reconciliationData[itemId].properties[keyName] = {
                        originalValues: values,
                        reconciled: values.map(() => ({
                            status: 'pending', // pending, reconciled, skipped, failed
                            matches: [],
                            selectedMatch: null,
                            manualValue: null,
                            qualifiers: {},
                            confidence: 0
                        }))
                    };
                });
            });
        }
        
        // Update progress display
        updateProgressDisplay();
        
        // Create reconciliation table
        console.log('✅ Creating reconciliation table...');
        await createReconciliationTable(data, mappedKeys, isReturningToStep);
        
        // Update state
        console.log('✅ Updating state with reconciliation data...');
        state.updateState('reconciliationData', reconciliationData);
        
        // Enable/disable proceed button
        console.log('✅ Updating proceed button...');
        updateProceedButton();
        
        console.log('🎉 Reconciliation initialization completed successfully!');
    }
    
    /**
     * Load mock data for testing purposes
     */
    function loadMockDataForTesting() {
        console.log('🧪 Loading mock data for testing reconciliation...');
        
        const mockItems = getMockItemsData();
        const mockMapping = getMockMappingData();
        
        // Update state with mock data
        state.updateState('fetchedData', mockItems.items);
        state.updateState('mappings.mappedKeys', mockMapping.mappings.mappedKeys);
        state.updateState('mappings.nonLinkedKeys', mockMapping.mappings.nonLinkedKeys);
        state.updateState('mappings.ignoredKeys', mockMapping.mappings.ignoredKeys);
        
        console.log('🧪 Mock data loaded, calling initializeReconciliation()');
        
        // Initialize reconciliation with mock data
        setTimeout(() => {
            initializeReconciliation();
        }, 100);
    }
    
    /**
     * Calculate total number of reconcilable cells
     */
    function calculateTotalReconciliableCells(data, mappedKeys) {
        let total = 0;
        data.forEach(item => {
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const values = extractPropertyValues(item, keyName);
                total += values.length;
            });
        });
        return total;
    }
    
    /**
     * Extract property values from an item, handling multiple values
     */
    function extractPropertyValues(item, key) {
        const value = item[key];
        if (!value) return [];
        
        // Handle different data structures
        if (Array.isArray(value)) {
            return value.map(v => {
                if (typeof v === 'object' && v['o:label']) {
                    return v['o:label'];
                } else if (typeof v === 'object' && v['@value']) {
                    return v['@value'];
                } else if (typeof v === 'string') {
                    return v;
                } else {
                    return String(v);
                }
            });
        } else if (typeof value === 'object' && value['o:label']) {
            return [value['o:label']];
        } else if (typeof value === 'object' && value['@value']) {
            return [value['@value']];
        } else {
            return [String(value)];
        }
    }
    
    /**
     * Create the reconciliation table interface
     */
    async function createReconciliationTable(data, mappedKeys, isReturningToStep = false) {
        console.log('🔨 Creating reconciliation table with data:', data.length, 'items and', mappedKeys.length, 'mapped keys');
        console.log('🔨 Is returning to step:', isReturningToStep);
        console.log('🔨 Property headers element:', propertyHeaders);
        console.log('🔨 Reconciliation rows element:', reconciliationRows);
        
        // Clear existing content
        if (propertyHeaders) {
            console.log('🔨 Clearing property headers');
            propertyHeaders.innerHTML = '';
            
            // Add item header
            const itemHeader = document.createElement('th');
            itemHeader.textContent = 'Item';
            itemHeader.className = 'item-header';
            propertyHeaders.appendChild(itemHeader);
            
            // Add property headers
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const th = document.createElement('th');
                th.textContent = keyName;
                th.className = 'property-header';
                th.dataset.property = keyName;
                propertyHeaders.appendChild(th);
            });
        }
        
        // Create item rows
        if (reconciliationRows) {
            console.log('🔨 Clearing and creating reconciliation rows');
            reconciliationRows.innerHTML = '';
            
            data.forEach((item, index) => {
                const itemId = `item-${index}`;
                const tr = document.createElement('tr');
                tr.id = `row-${itemId}`;
                tr.className = 'reconciliation-row';
                
                // Add item cell
                const itemCell = document.createElement('td');
                itemCell.className = 'item-cell';
                const itemTitle = item['o:title'] || item['title'] || `Item ${index + 1}`;
                itemCell.textContent = itemTitle;
                tr.appendChild(itemCell);
                
                // Add property cells
                mappedKeys.forEach(keyObj => {
                    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                    const values = extractPropertyValues(item, keyName);
                    
                    if (values.length === 0) {
                        // Empty cell
                        const td = document.createElement('td');
                        td.className = 'property-cell empty-cell';
                        td.textContent = '—';
                        tr.appendChild(td);
                    } else if (values.length === 1) {
                        // Single value cell
                        const td = createPropertyCell(itemId, keyName, 0, values[0]);
                        tr.appendChild(td);
                    } else {
                        // Multiple values cell
                        const td = document.createElement('td');
                        td.className = 'property-cell multi-value-cell';
                        td.dataset.itemId = itemId;
                        td.dataset.property = keyName;
                        
                        values.forEach((value, valueIndex) => {
                            const valueDiv = createValueElement(itemId, keyName, valueIndex, value);
                            td.appendChild(valueDiv);
                        });
                        
                        tr.appendChild(td);
                    }
                });
                
                reconciliationRows.appendChild(tr);
            });
            console.log('🔨 Added', data.length, 'rows to reconciliation table');
            
            // Only perform batch auto-acceptance for fresh initialization, not when returning to step
            if (!isReturningToStep) {
                console.log('🤖 Starting batch auto-acceptance...');
                await performBatchAutoAcceptance(data, mappedKeys);
            } else {
                console.log('🔄 Returning to step - restoring existing reconciliation states');
                restoreReconciliationDisplay(data, mappedKeys);
            }
            
        } else {
            console.error('🔨 reconciliationRows element not found!');
        }
    }
    
    /**
     * Perform batch auto-acceptance for all values in the table
     */
    async function performBatchAutoAcceptance(data, mappedKeys) {
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
        
        console.log(`🤖 Processing ${batchJobs.length} values for auto-acceptance...`);
        
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
        
        // Auto-accept all date values immediately
        dateValues.forEach(({ itemId, property, valueIndex, autoAcceptResult }) => {
            markCellAsReconciled({ itemId, property, valueIndex }, autoAcceptResult);
            autoAcceptedCount++;
        });
        
        // Process API-requiring properties in batches
        for (const [property, jobs] of batchByProperty.entries()) {
            console.log(`🤖 Batch processing ${jobs.length} values for property: ${property}`);
            
            // Mark all jobs as queued first
            jobs.forEach(job => {
                updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'queued');
            });
            
            // Batch reconciliation calls for this property
            const batchPromises = jobs.map(async (job) => {                
                try {
                    // Try reconciliation API first
                    let matches = await tryReconciliationApi(job.value, job.property);
                    
                    // If no matches from reconciliation API, try direct search
                    if (!matches || matches.length === 0) {
                        matches = await tryDirectWikidataSearch(job.value);
                    }
                    
                    // Check for matches
                    if (matches && matches.length > 0) {
                        const bestMatch = matches[0]; // First match is usually the best
                        
                        // Auto-accept 100% matches
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
                                        reason: '100% reconciliation match',
                                        score: bestMatch.score
                                    }
                                }
                            };
                        } else {
                            // Store all matches for display (but don't auto-accept)
                            return {
                                ...job,
                                allMatches: matches.map(match => ({
                                    type: 'wikidata',
                                    id: match.id,
                                    label: match.name,
                                    description: match.description,
                                    score: match.score
                                })),
                                bestMatch: {
                                    type: 'wikidata',
                                    id: bestMatch.id,
                                    label: bestMatch.name,
                                    description: bestMatch.description,
                                    score: bestMatch.score
                                }
                            };
                        }
                    }
                } catch (error) {
                    console.warn(`🤖 Error checking reconciliation for ${job.value}:`, error);
                    // Update cell to show error state
                    updateCellQueueStatus(job.itemId, job.property, job.valueIndex, 'error');
                    updateCellLoadingState(job.itemId, job.property, job.valueIndex, false);
                    
                    // Add error information to the cell
                    const cellId = `${job.itemId}-${job.property}-${job.valueIndex}`;
                    const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
                    if (cell) {
                        cell.classList.add('reconciliation-error');
                        cell.setAttribute('data-error-message', 'Reconciliation service unavailable');
                        cell.setAttribute('title', `Error: ${error.message}`);
                    }
                    
                    // Update reconciliation data with error status
                    if (!reconciliationData[job.itemId]) {
                        reconciliationData[job.itemId] = { properties: {} };
                    }
                    if (!reconciliationData[job.itemId].properties[job.property]) {
                        reconciliationData[job.itemId].properties[job.property] = { reconciled: [] };
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
                
                // Update progress to show current processing batch
                updateProgressWithCurrentBatch(property, i, batchJobSlice.length, jobs.length);
                
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
                            // No matches found - set to pending
                            updateCellDisplayAsNoMatches(job.itemId, job.property, job.valueIndex);
                        }
                    } else {
                        // Result was null - set to pending
                        updateCellDisplayAsNoMatches(job.itemId, job.property, job.valueIndex);
                    }
                });
                
                // Small delay between batches to be respectful to APIs
                if (i + batchSize < batchPromises.length) {
                    await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay
                }
            }
        }
        
        console.log(`🎉 Batch auto-acceptance completed! Auto-accepted ${autoAcceptedCount} values.`);
        
        // Update progress display (removes current activity indicator)
        updateProgressDisplay();
    }
    
    /**
     * Store all matches for a cell (without auto-accepting)
     */
    function storeAllMatches(cellInfo, allMatches, bestMatch) {
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
    }
    
    /**
     * Update cell queue status
     */
    function updateCellQueueStatus(itemId, property, valueIndex, status) {
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
     * Update cell loading state
     */
    function updateCellLoadingState(itemId, property, valueIndex, isLoading) {
        const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
        const cell = document.querySelector(cellSelector);
        
        if (cell) {
            // For multiple values, always use indexed selection; for single values, use the first element
            const allValueElements = cell.querySelectorAll('.property-value');
            const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
            
            if (valueElement) {
                if (isLoading) {
                    valueElement.classList.add('checking');
                } else {
                    valueElement.classList.remove('checking');
                }
            }
        }
    }
    
    /**
     * Update cell display when no matches are found
     */
    function updateCellDisplayAsNoMatches(itemId, property, valueIndex) {
        const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
        const cell = document.querySelector(cellSelector);
        
        if (cell) {
            // For multiple values, always use indexed selection; for single values, use the first element
            const allValueElements = cell.querySelectorAll('.property-value');
            const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
            
            if (valueElement) {
                const statusSpan = valueElement.querySelector('.value-status');
                if (statusSpan) {
                    statusSpan.textContent = 'Click to reconcile';
                    statusSpan.className = 'value-status no-matches';
                    valueElement.classList.remove('checking');
                }
            }
        }
    }

    /**
     * Update cell display to show best match percentage
     */
    function updateCellDisplayWithMatch(itemId, property, valueIndex, bestMatch) {
        // Find the cell element
        const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
        const cell = document.querySelector(cellSelector);
        
        if (cell) {
            // For multiple values, always use indexed selection; for single values, use the first element
            const allValueElements = cell.querySelectorAll('.property-value');
            const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
            
            if (valueElement) {
                const statusSpan = valueElement.querySelector('.value-status');
                if (statusSpan) {
                    // Just show percentage, not the specific match details
                    statusSpan.textContent = `${bestMatch.score.toFixed(1)}% match`;
                    statusSpan.className = 'value-status with-match';
                    
                    // Ensure we have a label for the tooltip
                    const matchLabel = bestMatch.label || bestMatch.name || 'Unlabeled item';
                    statusSpan.title = `Best match: ${matchLabel} (${bestMatch.score.toFixed(1)}%)`;
                }
                
                // Add a visual indicator for good matches - use yellow for partial matches
                valueElement.classList.remove('checking'); // Remove loading state
                if (bestMatch.score >= 85) {
                    valueElement.classList.add('high-confidence-match');
                } else if (bestMatch.score >= 50) {
                    valueElement.classList.add('partial-match'); // Yellow for partial matches
                } else {
                    valueElement.classList.add('low-confidence-match');
                }
            }
        }
    }
    
    /**
     * Create a property cell for the reconciliation table
     */
    function createPropertyCell(itemId, property, valueIndex, value) {
        const td = document.createElement('td');
        td.className = 'property-cell single-value-cell';
        td.dataset.itemId = itemId;
        td.dataset.property = property;
        td.dataset.valueIndex = valueIndex;
        
        const valueDiv = createValueElement(itemId, property, valueIndex, value);
        td.appendChild(valueDiv);
        
        return td;
    }
    
    /**
     * Create a value element within a property cell
     */
    function createValueElement(itemId, property, valueIndex, value) {
        const valueDiv = document.createElement('div');
        valueDiv.className = 'property-value';
        valueDiv.dataset.status = 'pending';
        
        // Check if this is a date property
        const propertyType = detectPropertyType(property);
        const isDate = propertyType === 'time' || isDateValue(value);
        
        if (isDate) {
            // Create date input field instead of reconciliation interface
            valueDiv.classList.add('date-property');
            
            const inputConfig = getInputFieldConfig('time');
            const dateInputHTML = createInputHTML('time', value);
            valueDiv.innerHTML = dateInputHTML;
            
            // Setup date precision detection
            const dateInput = valueDiv.querySelector('.flexible-date-input');
            if (dateInput) {
                setupDynamicDatePrecision(dateInput);
                
                // Auto-accept the date value when changed
                dateInput.addEventListener('input', () => {
                    const standardized = standardizeDateInput(dateInput.value);
                    markCellAsReconciled(
                        { itemId, property, valueIndex },
                        {
                            type: 'custom',
                            value: standardized.date || dateInput.value,
                            datatype: 'time',
                            qualifiers: {
                                autoAccepted: true,
                                reason: 'date value',
                                precision: standardized.precision,
                                displayValue: standardized.displayValue
                            }
                        }
                    );
                });
            }
            
            valueDiv.dataset.status = 'date-input';
        } else {
            // Create reconciliation interface for non-date properties
            const textSpan = document.createElement('span');
            textSpan.className = 'value-text';
            textSpan.textContent = value || 'Empty value';
            
            const statusSpan = document.createElement('span');
            statusSpan.className = 'value-status';
            statusSpan.textContent = 'Click to reconcile';
            
            valueDiv.appendChild(textSpan);
            valueDiv.appendChild(statusSpan);
            
            // Add click handler 
            const clickHandler = () => {
                // Check if this cell is already processed
                if (valueDiv.dataset.status === 'reconciled' || 
                    valueDiv.dataset.status === 'skipped' || 
                    valueDiv.dataset.status === 'no-item') {
                    console.log('🔧 Cell already processed, not opening modal');
                    return;
                }
                openReconciliationModal(itemId, property, valueIndex, value);
            };
            
            valueDiv.addEventListener('click', clickHandler);
        }
        
        return valueDiv;
    }
    
    /**
     * Update progress with current batch information
     */
    function updateProgressWithCurrentBatch(property, batchIndex, batchSize, totalJobs) {
        if (reconciliationProgress) {
            const currentState = state.getState();
            let progress = currentState.reconciliationProgress;
            if (reconciliationData && Object.keys(reconciliationData).length > 0) {
                progress = calculateCurrentProgress();
            }
            
            const { total, completed, skipped } = progress;
            const remaining = total - completed - skipped;
            const currentBatchStart = batchIndex + 1;
            const currentBatchEnd = Math.min(batchIndex + batchSize, totalJobs);
            
            reconciliationProgress.innerHTML = `
                <div class="progress-stats">
                    <span class="stat completed">${completed} completed</span>
                    <span class="stat skipped">${skipped} skipped</span>
                    <span class="stat remaining">${remaining} remaining</span>
                    <span class="stat total">of ${total} total</span>
                </div>
                <div class="progress-current-activity">
                    Processing ${property}: items ${currentBatchStart}-${currentBatchEnd} of ${totalJobs}
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${total > 0 ? ((completed + skipped) / total * 100) : 0}%"></div>
                </div>
            `;
        }
    }

    /**
     * Update progress display
     */
    function updateProgressDisplay() {
        if (reconciliationProgress) {
            const currentState = state.getState();
            
            // Calculate progress from actual reconciliation data if available
            let progress = currentState.reconciliationProgress;
            if (reconciliationData && Object.keys(reconciliationData).length > 0) {
                progress = calculateCurrentProgress();
            }
            
            const { total, completed, skipped, errors = 0 } = progress;
            const remaining = total - completed - skipped - errors;
            
            // Check if there are errors to show a warning
            const errorMessage = errors > 0 ? `
                <div class="reconciliation-service-warning">
                    ⚠️ Reconciliation service temporarily unavailable for ${errors} item${errors > 1 ? 's' : ''}. 
                    You can still proceed manually or try again later.
                </div>
            ` : '';
            
            reconciliationProgress.innerHTML = `
                ${errorMessage}
                <div class="progress-stats">
                    <span class="stat completed">${completed} completed</span>
                    <span class="stat skipped">${skipped} skipped</span>
                    ${errors > 0 ? `<span class="stat errors">${errors} errors</span>` : ''}
                    <span class="stat remaining">${remaining} remaining</span>
                    <span class="stat total">of ${total} total</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${total > 0 ? ((completed + skipped) / total * 100) : 0}%"></div>
                </div>
            `;
            
            // Update state with current progress
            state.updateState('reconciliationProgress', progress);
        }
        
        updateProceedButton();
    }
    
    /**
     * Calculate current progress from reconciliation data
     */
    function calculateCurrentProgress() {
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
    }
    
    /**
     * Update proceed button state
     */
    function updateProceedButton() {
        if (proceedToDesignerBtn) {
            const currentState = state.getState();
            const canProceed = currentState.reconciliationProgress.completed + currentState.reconciliationProgress.skipped >= currentState.reconciliationProgress.total && 
                              currentState.reconciliationProgress.total > 0;
            proceedToDesignerBtn.disabled = !canProceed;
        }
    }
    
    /**
     * Find and reconcile next unprocessed cell
     */
    function reconcileNextUnprocessedCell() {
        // Find first pending cell
        const pendingCell = document.querySelector('.property-value[data-status="pending"]');
        if (pendingCell) {
            pendingCell.click();
        } else {
            alert('No more items to reconcile. You can proceed to the next step.');
        }
    }
    
    
    /**
     * Check if a value appears to be a date
     * @param {string} value - The value to check
     * @returns {boolean} True if the value appears to be a date
     */
    function isDateValue(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }
        
        const trimmedValue = value.trim();
        
        // Common date patterns
        const datePatterns = [
            /^\d{4}$/,                              // Year only (e.g., "2023")
            /^\d{4}-\d{2}$/,                        // Year-month (e.g., "2023-06") 
            /^\d{4}-\d{2}-\d{2}$/,                  // ISO date (e.g., "2023-06-15")
            /^\d{1,2}\/\d{1,2}\/\d{4}$/,           // US format (e.g., "6/15/2023")
            /^\d{1,2}-\d{1,2}-\d{4}$/,             // Dash format (e.g., "15-6-2023")
            /^\d{1,2}\.\d{1,2}\.\d{4}$/,           // Dot format (e.g., "15.6.2023")
            /^\d{4}s$/,                             // Decade (e.g., "1990s")
            /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i, // "June 15, 2023"
            /^\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i, // "15 June 2023"
            /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i, // "Jun 15, 2023"
            /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i, // "15 Jun 2023"
            /^(early|mid|late)\s+\d{4}s?$/i,        // "early 2000s", "mid 1990s"
            /^c\.\s*\d{4}$/i,                       // "c. 2000" (circa)
            /^circa\s+\d{4}$/i,                     // "circa 2000"
            /^\d{4}-\d{4}$/,                        // Date range (e.g., "1990-1995")
            /^\d{4}\/\d{4}$/,                       // Date range with slash (e.g., "1990/1995")
        ];
        
        // Test against patterns
        for (const pattern of datePatterns) {
            if (pattern.test(trimmedValue)) {
                return true;
            }
        }
        
        // Try parsing with Date constructor as fallback
        const parsed = new Date(trimmedValue);
        return !isNaN(parsed.getTime()) && trimmedValue.length > 3; // Avoid matching single numbers
    }
    
    /**
     * Open reconciliation modal for a specific property value
     */
    async function openReconciliationModal(itemId, property, valueIndex, value) {
        console.log('🔧 Opening reconciliation modal for:', { itemId, property, valueIndex, value });
        currentReconciliationCell = { itemId, property, valueIndex, value };
        
        // Create modal content (now async)
        const modalContent = await createReconciliationModalContent(itemId, property, valueIndex, value);
        
        // Open modal
        modalUI.openModal('Reconcile Value', modalContent, [], () => {
            currentReconciliationCell = null;
        });
        
        // Setup modal after DOM is rendered
        setTimeout(() => {
            const modalElement = document.querySelector('#modal-content');
            if (modalElement) {
                console.log('🔧 Setting up compact modal functionality');
                setupDynamicDatePrecision(modalElement);
                setupAutoAdvanceToggle();
            } else {
                console.warn('⚠️ Modal content element not found for setup');
            }
        }, 100);
        
        // Start automatic reconciliation (but use existing matches if available)
        await performAutomaticReconciliation(value, property, itemId, valueIndex);
    }
    
    /**
     * Create modal content for reconciliation with simplified design based on Q&A requirements
     */
    async function createReconciliationModalContent(itemId, property, valueIndex, value) {
        // Detect property type for dynamic input fields
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        
        // Get property information for display (now async)
        const propertyInfo = await getPropertyDisplayInfo(property);
        const originalKeyInfo = getOriginalKeyInfo(itemId, property);
        const itemTitle = reconciliationData[itemId]?.originalData?.['o:title'] || `Item ${itemId.replace('item-', '')}`;
        
        // Determine why Wikidata item is required (Entity Schema vs property constraint)
        const requirementReason = getReconciliationRequirementReason(property);
        
        return `
            <div class="reconciliation-modal-compact">
                <!-- Compact Property Display with Original Value -->
                <div class="property-section">
                    <div class="property-header">
                        <a href="${propertyInfo.wikidataUrl}" target="_blank" class="property-link">
                            ${propertyInfo.label} (${propertyInfo.pid})
                            ${propertyInfo.isMock ? ' <span class="mock-indicator">[estimated]</span>' : ''}
                        </a>
                    </div>
                    <p class="property-description">${propertyInfo.description}</p>
                    
                    <div class="original-info">
                        <span class="original-label">Original key:</span>
                        <a href="${originalKeyInfo.lodUri}" target="_blank" class="original-link">
                            ${originalKeyInfo.keyName}
                        </a>
                    </div>
                    <div class="value-context">
                        <strong>"${value}"</strong> from ${itemTitle}
                    </div>
                </div>
                
                <!-- Reconciliation Results -->
                <div class="reconciliation-results">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Finding matches...</p>
                    </div>
                    <div class="matches-display" style="display: none;">
                        <!-- Results will be populated here -->
                    </div>
                    <div class="primary-recommendations" style="display: none;">
                        <!-- Primary recommendations will be populated here -->
                    </div>
                </div>
                
                <!-- Fallback Options (Manual Search) -->
                <div class="fallback-options" style="display: none;">
                    <div class="search-wikidata">
                        <input type="text" class="search-input" placeholder="Search Wikidata..." value="">
                        <button class="btn primary search-btn">Search</button>
                    </div>
                    <button class="btn create-new-item" onclick="createNewWikidataItem()">
                        ➕ Create New Wikidata Item
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Get property display information including Wikidata PID and clickable link
     */
    async function getPropertyDisplayInfo(property) {
        // Try to get real property information from the current mappings state
        const currentState = state.getState();
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        // Check if we have mapping information for this property
        const mappingInfo = mappedKeys.find(keyObj => 
            (typeof keyObj === 'string' ? keyObj : keyObj.key) === property
        );
        
        if (mappingInfo && typeof mappingInfo === 'object' && mappingInfo.property) {
            // We have real Wikidata property information
            const wikidataProperty = mappingInfo.property;
            return {
                label: wikidataProperty.label || property,
                pid: wikidataProperty.id,
                description: wikidataProperty.description || getPropertyDescription(property),
                wikidataUrl: `https://www.wikidata.org/wiki/Property:${wikidataProperty.id}`,
                isMock: false
            };
        }
        
        // Fallback: Try to fetch property information from Wikidata API
        try {
            const realPropertyInfo = await fetchWikidataPropertyInfo(property);
            if (realPropertyInfo) {
                return realPropertyInfo;
            }
        } catch (error) {
            console.warn('Could not fetch Wikidata property info:', error);
        }
        
        // Final fallback: create a mock PID and use property name as label
        const mockPid = generateMockPid(property);
        
        return {
            label: property.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            pid: mockPid,
            description: getPropertyDescription(property),
            wikidataUrl: `https://www.wikidata.org/wiki/Property:${mockPid}`,
            isMock: true
        };
    }
    
    /**
     * Fetch real property information from Wikidata
     */
    async function fetchWikidataPropertyInfo(propertyKeyword) {
        try {
            // Search for properties using the keyword
            const apiUrl = 'https://www.wikidata.org/w/api.php';
            const params = new URLSearchParams({
                action: 'wbsearchentities',
                search: propertyKeyword,
                language: 'en',
                format: 'json',
                origin: '*',
                type: 'property',
                limit: 1
            });
            
            const response = await fetch(`${apiUrl}?${params.toString()}`);
            if (!response.ok) return null;
            
            const data = await response.json();
            if (data.search && data.search.length > 0) {
                const prop = data.search[0];
                return {
                    label: prop.label || propertyKeyword,
                    pid: prop.id,
                    description: prop.description || getPropertyDescription(propertyKeyword),
                    wikidataUrl: `https://www.wikidata.org/wiki/Property:${prop.id}`
                };
            }
        } catch (error) {
            console.warn('Error fetching Wikidata property info:', error);
        }
        return null;
    }
    
    /**
     * Generate a mock PID for demonstration (in real implementation, this would come from mappings)
     */
    function generateMockPid(property) {
        // Create a deterministic but realistic-looking PID based on property name
        const hash = property.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        const pidNumber = Math.abs(hash) % 9000 + 1000; // Generate P1000-P9999
        return `P${pidNumber}`;
    }
    
    /**
     * Get property description based on common property patterns
     */
    function getPropertyDescription(property) {
        const descriptions = {
            'author': 'creator of a creative work or other object',
            'creator': 'maker of this creative work or other object',
            'title': 'published name of a work',
            'date': 'point in time',
            'subject': 'primary topic of a work',
            'publisher': 'organization or person responsible for publishing',
            'language': 'language of work or name',
            'format': 'file format, physical medium, or dimensions',
            'identifier': 'identifier for this item',
            'rights': 'copyright and other rights information',
            'coverage': 'spatial or temporal topic of the resource',
            'description': 'textual description of the entity',
            'contributor': 'person or organization that contributed to the subject',
            'relation': 'related resource',
            'source': 'work from which this work is derived',
            'type': 'nature or genre of the resource'
        };
        
        // Try to match property name to description
        for (const [key, desc] of Object.entries(descriptions)) {
            if (property.toLowerCase().includes(key)) {
                return desc;
            }
        }
        
        return `Property describing ${property.replace(/[_-]/g, ' ')}`;
    }
    
    /**
     * Get original key information including LOD URI
     */
    function getOriginalKeyInfo(itemId, property) {
        // Get the original key name from the source data
        const originalData = reconciliationData[itemId]?.originalData;
        
        // Try to get the correct linked data URI from mapping information
        const currentState = state.getState();
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const mappingInfo = mappedKeys.find(keyObj => 
            (typeof keyObj === 'string' ? keyObj : keyObj.key) === property
        );
        
        let lodUri;
        if (mappingInfo && mappingInfo.linkedDataUri) {
            // Use the correct linked data URI from the mapping
            lodUri = mappingInfo.linkedDataUri;
        } else {
            // Fallback: try to extract from original data or generate generic URI
            lodUri = generateLodUri(property, originalData);
        }
        
        return {
            keyName: property,
            lodUri: lodUri
        };
    }
    
    /**
     * Generate a LOD URI for the original key
     */
    function generateLodUri(property, originalData) {
        // Try to extract URI from the original data structure
        if (originalData && originalData[property]) {
            const value = originalData[property];
            
            // Check if it's an Omeka S structure with URI
            if (Array.isArray(value) && value[0] && value[0]['@id']) {
                return value[0]['@id'];
            } else if (typeof value === 'object' && value['@id']) {
                return value['@id'];
            }
        }
        
        // Fallback: create a generic ontology URI
        return `http://purl.org/dc/terms/${property}`;
    }
    
    /**
     * Determine why Wikidata item is required for this reconciliation
     */
    function getReconciliationRequirementReason(property) {
        // Check if requirement comes from Entity Schema vs property constraint
        const currentState = state.getState();
        const entitySchemas = currentState.mappings?.entitySchemas || [];
        
        let reason = {
            explanation: "This property requires a Wikidata item to maintain linked data integrity.",
            links: []
        };
        
        // Check if this property is part of an Entity Schema
        if (entitySchemas.length > 0) {
            reason.explanation = "This property is required by the selected Entity Schema to be a Wikidata item.";
            reason.links.push(
                ...entitySchemas.map(schema => ({
                    label: `Entity Schema: ${schema.label || schema.id}`,
                    url: `https://www.wikidata.org/wiki/EntitySchema:${schema.id}`
                }))
            );
        }
        
        // Add property-specific investigation link
        const propertyInfo = getPropertyDisplayInfo(property);
        reason.links.push({
            label: `Property: ${propertyInfo.label} (${propertyInfo.pid})`,
            url: propertyInfo.wikidataUrl
        });
        
        return reason;
    }
    
    /**
     * Get auto-advance setting from user preference or state
     */
    function getAutoAdvanceSetting() {
        return autoAdvanceSetting;
    }
    
    /**
     * Display reconciliation results with new confidence logic from Q&A requirements
     */
    async function displayReconciliationResults(matches, propertyType, value) {
        const loadingState = document.querySelector('.loading-state');
        const matchesDisplay = document.querySelector('.matches-display');
        
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        if (!matchesDisplay) return;
        
        // Handle non-Wikidata properties
        if (propertyType !== 'wikibase-item') {
            matchesDisplay.innerHTML = '<p>Non-Wikidata property - use manual input section below.</p>';
            matchesDisplay.style.display = 'block';
            return;
        }
        
        if (!matches || matches.length === 0) {
            matchesDisplay.innerHTML = '<p class="no-matches">No automatic matches found. Try manual search below.</p>';
            matchesDisplay.style.display = 'block';
            
            // Show fallback options for manual search
            displayFallbackOptions(value, []);
            return;
        }
        
        // New confidence logic from Q&A requirements:
        // - Show ALL suggestions with 80%+ confidence if multiple matches exist at that level
        // - If no suggestions above 80%, display the top 3 best matches
        
        const highConfidenceMatches = matches.filter(m => m.score >= 80);
        let displayMatches = [];
        
        if (highConfidenceMatches.length > 0) {
            // Show ALL matches above 80%
            displayMatches = highConfidenceMatches;
        } else {
            // Show top 3 best matches
            displayMatches = matches.slice(0, 3);
        }
        
        // Debug logging to identify undefined labels
        console.log('🔍 Debug: displayMatches in reconciliation modal:', displayMatches);
        displayMatches.forEach((match, index) => {
            console.log(`🔍 Debug: Match ${index}:`, {
                id: match.id,
                name: match.name,
                description: match.description,
                score: match.score,
                rawMatch: match
            });
        });

        matchesDisplay.innerHTML = `
            <div class="matches-header">
                <h5>Reconciliation Suggestions</h5>
                ${highConfidenceMatches.length > 0 ? 
                    `<p class="confidence-note">All matches above 80% confidence:</p>` : 
                    `<p class="confidence-note">Top ${displayMatches.length} matches (no high-confidence matches found):</p>`
                }
            </div>
            <div class="matches-list">
                ${displayMatches.map((match, index) => {
                    // Ensure we have fallback values for undefined labels
                    const matchName = match.name || match.label || 'Unnamed item';
                    const matchDescription = match.description || match.desc || 'No description available';
                    const safeMatchName = escapeHtml(matchName);
                    const safeMatchDescription = escapeHtml(matchDescription);
                    
                    return `
                    <div class="match-item-simplified" data-match-id="${match.id}" onclick="selectMatch('${match.id}', '${safeMatchName}', '${safeMatchDescription}')">
                        <div class="match-score">${match.score.toFixed(1)}%</div>
                        <div class="match-content">
                            <div class="match-name">${matchName}</div>
                            <div class="match-description">${matchDescription}</div>
                            <div class="match-id">
                                <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank" onclick="event.stopPropagation()">
                                    ${match.id}
                                </a>
                            </div>
                        </div>
                        <div class="match-select">
                            <button class="btn small primary" onclick="event.stopPropagation(); selectMatch('${match.id}', '${safeMatchName}', '${safeMatchDescription}')">
                                Select
                            </button>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            ${matches.length > displayMatches.length ? `
                <div class="view-all-matches">
                    <button class="btn secondary" onclick="showAllMatches()">
                        View all ${matches.length} matches
                    </button>
                </div>
            ` : ''}
        `;
        
        matchesDisplay.style.display = 'block';
        
        // Show fallback options if there are no high-confidence matches
        if (highConfidenceMatches.length === 0) {
            displayFallbackOptions(value, matches);
        }
        
        // Store all matches for "View all" functionality
        window.allReconciliationMatches = matches;
    }
    
    /**
     * Escape HTML to prevent XSS in match data
     */
    function escapeHtml(text) {
        if (text === undefined || text === null) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
    
    /**
     * Display high confidence matches in a horizontal scrollable container
     */
    function displayHighConfidenceMatches(matches) {
        const container = document.querySelector('.high-confidence-matches');
        if (!container) return;
        
        container.innerHTML = `
            <h5 class="matches-title">High Confidence Matches (≥80%)</h5>
            <div class="matches-scroll-container">
                ${matches.map((match, index) => {
                    const matchName = match.name || match.label || 'Unnamed item';
                    const matchDescription = match.description || match.desc || 'No description available';
                    return `
                    <div class="confidence-match-card ${index === 0 ? 'best-match' : ''}" data-match-id="${match.id}">
                        <div class="match-confidence">${match.score.toFixed(1)}% confidence</div>
                        <div class="match-name">${matchName}</div>
                        <div class="match-description">${matchDescription}</div>
                        <div class="match-id">
                            <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                        </div>
                        <button class="btn small primary select-match-btn" onclick="selectMatchAndAdvance('${match.id}')">
                            ${index === 0 ? '🎯 Select Best Match' : 'Select'}
                        </button>
                    </div>
                    `;
                }).join('')}
            </div>
            <p class="scroll-hint">← Scroll for more high-confidence matches →</p>
        `;
    }
    
    /**
     * Display fallback options for low/no confidence scenarios
     */
    function displayFallbackOptions(value, matches) {
        const container = document.querySelector('.fallback-options');
        if (!container) return;
        
        // Show the fallback options container
        container.style.display = 'block';
        
        // Populate the search input with the original value
        const searchInput = container.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = value || '';
        }
        
        // Setup manual search functionality
        setTimeout(() => {
            setupManualSearchInFallback();
        }, 100);
    }
    
    /**
     * Show custom input interface for non-Wikidata properties
     */
    function showCustomInputInterface(propertyType, value) {
        const container = document.querySelector('.primary-recommendations');
        if (!container) return;
        
        const inputConfig = getInputFieldConfig(propertyType);
        const customInputHTML = createInputHTML(propertyType, value);
        
        container.innerHTML = `
            <div class="non-wikidata-input">
                <h5>Enter ${inputConfig.description}</h5>
                <div class="custom-input-container">
                    ${customInputHTML}
                </div>
                <div class="input-actions">
                    <button class="btn primary" onclick="confirmCustomValue()">Confirm Value</button>
                </div>
            </div>
        `;
    }
    
    /**
     * Setup manual search functionality in fallback options
     */
    function setupManualSearchInFallback() {
        const searchBtn = document.querySelector('.search-btn');
        const searchInput = document.querySelector('.search-input');
        
        if (searchBtn && searchInput) {
            const performSearch = async () => {
                const query = searchInput.value.trim();
                if (!query) return;
                
                try {
                    const matches = await tryDirectWikidataSearch(query);
                    displayFallbackSearchResults(matches);
                } catch (error) {
                    console.error('Search error:', error);
                    displayFallbackSearchResults([]);
                }
            };
            
            searchBtn.onclick = performSearch;
        }
    }
    
    /**
     * Display search results in fallback options
     */
    function displayFallbackSearchResults(matches) {
        const fallbackContainer = document.querySelector('.fallback-options');
        if (!fallbackContainer) return;
        
        const existingResults = fallbackContainer.querySelector('.fallback-search-results');
        if (existingResults) {
            existingResults.remove();
        }
        
        if (matches.length > 0) {
            const resultsHTML = `
                <div class="fallback-search-results">
                    <h6>Search Results</h6>
                    ${matches.map(match => `
                        <div class="fallback-result-item" data-match-id="${match.id}">
                            <div class="result-info">
                                <div class="result-name">${match.name}</div>
                                <div class="result-description">${match.description}</div>
                                <div class="result-id">
                                    <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                                </div>
                            </div>
                            <button class="btn small primary" onclick="selectMatchAndAdvance('${match.id}')">Select</button>
                        </div>
                    `).join('')}
                </div>
            `;
            fallbackContainer.insertAdjacentHTML('beforeend', resultsHTML);
        } else {
            fallbackContainer.insertAdjacentHTML('beforeend', `
                <div class="fallback-search-results">
                    <p>No results found.</p>
                </div>
            `);
        }
    }
    
    /**
     * Perform automatic reconciliation using Wikidata APIs with progressive disclosure
     */
    async function performAutomaticReconciliation(value, property, itemId, valueIndex) {
        // Check if this property type requires reconciliation
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        
        try {
            let matches = [];
            
            // Check if we already have matches from batch reconciliation
            if (itemId && valueIndex !== undefined && reconciliationData[itemId]) {
                const propData = reconciliationData[itemId].properties[property];
                if (propData && propData.reconciled[valueIndex] && propData.reconciled[valueIndex].matches) {
                    // Use existing matches from batch reconciliation (all matches, not just best)
                    matches = propData.reconciled[valueIndex].matches;
                    console.log('🔄 Using existing matches from batch reconciliation:', matches.length, 'matches');
                }
            }
            
            // If no existing matches, fetch new ones
            if (!matches || matches.length === 0) {
                // Try reconciliation API first
                matches = await tryReconciliationApi(value, property);
                
                // If no good matches, try direct Wikidata search
                if (!matches || matches.length === 0) {
                    matches = await tryDirectWikidataSearch(value);
                }
            }
            
            // Check for 100% confidence auto-selection (Q&A requirement)
            if (matches && matches.length > 0 && matches[0].score >= 100) {
                console.log('🎯 Auto-selecting 100% confidence match:', matches[0]);
                
                // Auto-select 100% confidence match
                const perfectMatch = matches[0];
                markCellAsReconciled(currentReconciliationCell, {
                    type: 'wikidata',
                    id: perfectMatch.id,
                    label: perfectMatch.name,
                    description: perfectMatch.description,
                    qualifiers: {
                        autoAccepted: true,
                        reason: '100% confidence match',
                        score: perfectMatch.score
                    }
                });
                
                modalUI.closeModal();
                
                // Auto-advance if enabled
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
                return;
            }
            
            // Display results using new simplified display logic
            await displayReconciliationResults(matches, propertyType, value);
            
        } catch (error) {
            console.error('Error during automatic reconciliation:', error);
            displayReconciliationError(error);
        }
    }
    
    /**
     * Try Wikidata Reconciliation API with fallback handling
     */
    async function tryReconciliationApi(value, property) {
        // Primary endpoint - wikidata.reconci.link
        const primaryApiUrl = 'https://wikidata.reconci.link/en/api';
        // Fallback endpoint - tools.wmflabs.org
        const fallbackApiUrl = 'https://tools.wmflabs.org/openrefine-wikidata/en/api';
        
        // Get suggested entity types based on property
        const entityTypes = getSuggestedEntityTypes(property);
        
        const query = {
            queries: {
                q1: {
                    query: value,
                    type: entityTypes,
                    properties: []
                }
            }
        };
        
        const requestBody = "queries=" + encodeURIComponent(JSON.stringify(query.queries));
        
        // Try primary endpoint first
        try {
            console.log(`🔍 Trying primary reconciliation API for "${value}"`);
            const response = await fetch(primaryApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: requestBody,
                mode: 'cors'
            });
            
            if (!response.ok) {
                throw new Error(`Primary API error: ${response.status} ${response.statusText}`);
            }
            
            console.log(`✅ Primary API successful for "${value}"`);
            const data = await response.json();
            return parseReconciliationResults(data, value);
            
        } catch (primaryError) {
            console.warn(`⚠️ Primary reconciliation API failed for "${value}":`, primaryError.message);
            
            // Try fallback endpoint
            try {
                console.log(`🔍 Trying fallback reconciliation API for "${value}"`);
                const response = await fetch(fallbackApiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: requestBody,
                    mode: 'cors'
                });
                
                if (!response.ok) {
                    throw new Error(`Fallback API error: ${response.status} ${response.statusText}`);
                }
                
                console.log(`✅ Fallback API successful for "${value}"`);
                const data = await response.json();
                return parseReconciliationResults(data, value);
                
            } catch (fallbackError) {
                console.error(`❌ Both reconciliation APIs failed for "${value}"`);
                console.error('Primary error:', primaryError.message);
                console.error('Fallback error:', fallbackError.message);
                
                // Throw a more informative error
                throw new Error(`Reconciliation services unavailable. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
            }
        }
    }
    
    /**
     * Parse reconciliation API results
     */
    function parseReconciliationResults(data, value) {
        if (data.q1 && data.q1.result) {
            return data.q1.result.map(match => {
                console.log('🔍 Reconciliation API match:', match);
                return {
                    id: match.id,
                    name: match.name || match.label || 'Unnamed item',
                    description: match.description || match.desc || 'No description available',
                    score: match.score || 0,
                    type: match.type || [],
                    source: 'reconciliation'
                };
            });
        }
        
        return [];
    }
    
    /**
     * Try direct Wikidata search API
     */
    async function tryDirectWikidataSearch(value) {
        const apiUrl = 'https://www.wikidata.org/w/api.php';
        
        const params = new URLSearchParams({
            action: 'wbsearchentities',
            search: value,
            language: 'en',
            format: 'json',
            origin: '*',
            type: 'item',
            limit: 10
        });
        
        const response = await fetch(`${apiUrl}?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`Wikidata API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.search) {
            return data.search.map(item => {
                console.log('🔍 Wikidata search item:', item);
                return {
                    id: item.id,
                    name: item.label || item.name || 'Unnamed item',
                    description: item.description || item.desc || 'No description available',
                    score: 50, // Approximate score for direct search
                    type: [],
                    source: 'direct'
                };
            });
        }
        
        return [];
    }
    
    /**
     * Display automatic matches in the modal
     */
    function displayAutomaticMatches(matches) {
        const loadingIndicator = document.querySelector('.loading-indicator');
        const matchesContainer = document.querySelector('.matches-container');
        const noMatches = document.querySelector('.no-matches');
        const matchesList = document.querySelector('.matches-list');
        
        loadingIndicator.style.display = 'none';
        
        if (matches && matches.length > 0) {
            matchesContainer.style.display = 'block';
            noMatches.style.display = 'none';
            
            matchesList.innerHTML = matches.map((match, index) => `
                <div class="match-item ${index === 0 ? 'recommended' : ''}" data-match-id="${match.id}">
                    <div class="match-score">${match.score.toFixed(1)}%</div>
                    <div class="match-info">
                        <div class="match-name">${match.name}</div>
                        <div class="match-description">${match.description}</div>
                        <div class="match-id">
                            <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                            <span class="match-source">(${match.source})</span>
                        </div>
                    </div>
                    <div class="match-actions">
                        <button class="btn small primary" onclick="selectMatch('${match.id}')">Select</button>
                    </div>
                </div>
            `).join('');
            
            // Enable confirm button if we have matches
            const confirmBtn = document.querySelector('.reconciliation-actions .btn.primary');
            if (confirmBtn && matches.length > 0) {
                confirmBtn.disabled = false;
            }
            
        } else {
            matchesContainer.style.display = 'none';
            noMatches.style.display = 'block';
        }
    }
    
    /**
     * Display reconciliation error
     */
    function displayReconciliationError(error) {
        const loadingIndicator = document.querySelector('.loading-indicator');
        const matchesContainer = document.querySelector('.matches-container');
        const noMatches = document.querySelector('.no-matches');
        
        loadingIndicator.style.display = 'none';
        matchesContainer.style.display = 'none';
        noMatches.style.display = 'block';
        noMatches.innerHTML = `
            <p>Error during reconciliation: ${error.message}</p>
            <button class="btn secondary" onclick="switchTab('manual')">Try Manual Search</button>
        `;
    }
    
    /**
     * Restore reconciliation display states when returning to the step
     */
    function restoreReconciliationDisplay(data, mappedKeys) {
        console.log('🔄 Restoring reconciliation display states...');
        
        data.forEach((item, index) => {
            const itemId = `item-${index}`;
            
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const propData = reconciliationData[itemId]?.properties[keyName];
                
                if (propData && propData.reconciled) {
                    propData.reconciled.forEach((reconciledItem, valueIndex) => {
                        const cellInfo = { itemId, property: keyName, valueIndex };
                        
                        if (reconciledItem.status === 'reconciled' && reconciledItem.selectedMatch) {
                            // Restore reconciled state
                            updateCellDisplay(itemId, keyName, valueIndex, 'reconciled', reconciledItem.selectedMatch);
                        } else if (reconciledItem.status === 'skipped') {
                            // Restore skipped state
                            updateCellDisplay(itemId, keyName, valueIndex, 'skipped');
                        } else if (reconciledItem.status === 'no-item') {
                            // Restore no-item state
                            updateCellDisplay(itemId, keyName, valueIndex, 'no-item');
                        } else if (reconciledItem.matches && reconciledItem.matches.length > 0) {
                            // Restore match percentage display for non-reconciled items with matches
                            const bestMatch = reconciledItem.matches[0];
                            updateCellDisplayWithMatch(itemId, keyName, valueIndex, bestMatch);
                        }
                    });
                }
            });
        });
        
        console.log('✅ Reconciliation display states restored');
    }
    
    // Tab functionality removed - now using progressive disclosure design
    
    // Global functions for new progressive disclosure modal interactions
    window.toggleMoreOptions = function() {
        const expandedOptions = document.querySelector('.expanded-options');
        const button = document.querySelector('.expand-options');
        
        if (!expandedOptions || !button) return;
        
        const isExpanded = expandedOptions.style.display === 'block';
        
        if (isExpanded) {
            expandedOptions.style.display = 'none';
            button.textContent = '▼ More Options';
        } else {
            expandedOptions.style.display = 'block';
            button.textContent = '▲ Hide Options';
            
            // Setup expanded search functionality
            setTimeout(() => {
                setupExpandedSearch();
            }, 100);
        }
    };
    
    window.selectMatchAndAdvance = function(matchId) {
        if (!currentReconciliationCell) return;
        
        // Find the match details
        const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
        if (!matchCard) return;
        
        const matchName = matchCard.querySelector('.match-name, .result-name')?.textContent || 'Unknown';
        const matchDescription = matchCard.querySelector('.match-description, .result-description')?.textContent || 'No description';
        
        // Mark as reconciled
        markCellAsReconciled(currentReconciliationCell, {
            type: 'wikidata',
            id: matchId,
            label: matchName,
            description: matchDescription
        });
        
        modalUI.closeModal();
        
        // Auto-advance if enabled
        if (getAutoAdvanceSetting()) {
            setTimeout(() => {
                reconcileNextUnprocessedCell();
            }, 300); // Brief delay for visual feedback
        }
    };
    
    window.confirmCustomValue = function() {
        if (!currentReconciliationCell) return;
        
        const { property } = currentReconciliationCell;
        const propertyType = detectPropertyType(property);
        
        const inputContainer = document.querySelector('.custom-input-container') || document.querySelector('.custom-input-primary');
        let customValue = null;
        let qualifiers = {};
        
        // Extract value based on input type
        if (inputContainer) {
            const textInput = inputContainer.querySelector('.text-input, .qid-input');
            const numberInput = inputContainer.querySelector('.number-input');
            const dateInput = inputContainer.querySelector('.date-input');
            const urlInput = inputContainer.querySelector('.url-input');
            const coordinatesInput = inputContainer.querySelector('.coordinates-input');
            
            if (textInput) {
                customValue = textInput.value;
                
                // Check for language qualifier
                const languageSelect = inputContainer.querySelector('.language-select');
                if (languageSelect && languageSelect.value) {
                    qualifiers.language = languageSelect.value;
                }
            } else if (numberInput) {
                customValue = numberInput.value;
                
                // Check for unit qualifier
                const unitSelect = inputContainer.querySelector('.unit-select');
                if (unitSelect && unitSelect.value) {
                    qualifiers.unit = unitSelect.value;
                }
            } else if (dateInput) {
                // Standardize the date input and get precision
                const standardized = standardizeDateInput(dateInput.value);
                customValue = standardized.date;
                
                // Use detected precision if not manually overridden
                const precisionSelect = inputContainer.querySelector('.precision-select');
                const calendarSelect = inputContainer.querySelector('.calendar-select');
                
                if (precisionSelect && precisionSelect.value) {
                    qualifiers.precision = precisionSelect.value;
                } else if (standardized.precision) {
                    // Use automatically detected precision
                    qualifiers.precision = standardized.precision;
                }
                
                if (calendarSelect && calendarSelect.value) {
                    qualifiers.calendar = calendarSelect.value;
                }
                
                // Store the display value for reference
                if (standardized.displayValue) {
                    qualifiers.displayValue = standardized.displayValue;
                }
            } else if (urlInput) {
                customValue = urlInput.value;
            } else if (coordinatesInput) {
                customValue = coordinatesInput.value;
            }
        }
        
        // Validate the input
        if (customValue) {
            const validation = validateInput(customValue, propertyType);
            
            if (!validation.isValid) {
                // Show validation error
                const validationMessage = document.querySelector('.validation-message');
                if (validationMessage) {
                    validationMessage.textContent = validation.message;
                    validationMessage.style.display = 'block';
                    validationMessage.style.color = 'red';
                } else {
                    alert(validation.message);
                }
                return;
            }
            
            markCellAsReconciled(currentReconciliationCell, {
                type: 'custom',
                value: customValue,
                datatype: propertyType,
                qualifiers: qualifiers
            });
            
            modalUI.closeModal();
            
            // Auto-advance if enabled
            if (getAutoAdvanceSetting()) {
                setTimeout(() => {
                    reconcileNextUnprocessedCell();
                }, 300);
            }
        } else {
            alert('Please enter a value.');
        }
    };
    
    /**
     * Setup expanded search functionality in progressive disclosure
     */
    function setupExpandedSearch() {
        const searchBtn = document.querySelector('.search-btn-expanded');
        const searchInput = document.querySelector('.search-input-expanded');
        const resultsContainer = document.querySelector('.search-results-expanded');
        
        if (searchBtn && searchInput && resultsContainer) {
            const performSearch = async () => {
                const query = searchInput.value.trim();
                if (!query) return;
                
                resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
                
                try {
                    const matches = await tryDirectWikidataSearch(query);
                    
                    if (matches.length > 0) {
                        resultsContainer.innerHTML = matches.map(match => `
                            <div class="expanded-result-item" data-match-id="${match.id}">
                                <div class="result-info">
                                    <div class="result-name">${match.name}</div>
                                    <div class="result-description">${match.description}</div>
                                    <div class="result-id">
                                        <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                                    </div>
                                </div>
                                <button class="btn small primary" onclick="selectMatchAndAdvance('${match.id}')">Select</button>
                            </div>
                        `).join('');
                    } else {
                        resultsContainer.innerHTML = '<div class="no-results">No results found.</div>';
                    }
                } catch (error) {
                    resultsContainer.innerHTML = `<div class="error">Search error: ${error.message}</div>`;
                }
            };
            
            searchBtn.onclick = performSearch;
        }
    }
    
    /**
     * Setup auto-advance toggle functionality
     */
    function setupAutoAdvanceToggle() {
        const autoAdvanceCheckbox = document.getElementById('auto-advance');
        if (autoAdvanceCheckbox) {
            autoAdvanceCheckbox.addEventListener('change', (e) => {
                autoAdvanceSetting = e.target.checked;
                console.log('🔄 Auto-advance setting changed to:', autoAdvanceSetting);
            });
        }
    }
    
    // Tab functionality removed - progressive disclosure design handles this
    
    window.selectMatch = function(matchId) {
        // Mark match as selected
        document.querySelectorAll('.match-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-match-id="${matchId}"]`).classList.add('selected');
        
        // Enable confirm button
        const confirmBtn = document.querySelector('.reconciliation-actions .btn.primary');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    };
    
    window.skipReconciliation = function() {
        if (currentReconciliationCell) {
            markCellAsSkipped(currentReconciliationCell);
            modalUI.closeModal();
            
            // Auto-open next pending cell
            setTimeout(() => {
                reconcileNextUnprocessedCell();
            }, 100);
        }
    };
    
    window.markAsNoWikidataItem = function() {
        if (currentReconciliationCell) {
            markCellAsNoItem(currentReconciliationCell);
            modalUI.closeModal();
            
            // Auto-advance if enabled
            if (getAutoAdvanceSetting()) {
                setTimeout(() => {
                    reconcileNextUnprocessedCell();
                }, 300);
            }
        }
    };
    
    window.createNewWikidataItem = function() {
        const value = currentReconciliationCell?.value;
        if (value) {
            const url = `https://www.wikidata.org/wiki/Special:NewItem?label=${encodeURIComponent(value)}`;
            window.open(url, '_blank');
        }
    };
    
    // ============================================================================
    // New Global Functions for Simplified Modal Interface
    // ============================================================================
    
    /**
     * Select a match from reconciliation results
     */
    window.selectMatch = function(matchId, matchName, matchDescription) {
        if (!currentReconciliationCell) return;
        
        console.log('🎯 Selecting match:', matchId, matchName);
        
        // Mark as reconciled
        markCellAsReconciled(currentReconciliationCell, {
            type: 'wikidata',
            id: matchId,
            label: matchName,
            description: matchDescription
        });
        
        modalUI.closeModal();
        
        // Auto-advance if enabled
        if (getAutoAdvanceSetting()) {
            setTimeout(() => {
                reconcileNextUnprocessedCell();
            }, 300);
        }
    };
    
    /**
     * Show all matches when user clicks "View all matches"
     */
    window.showAllMatches = function() {
        const matchesDisplay = document.querySelector('.matches-display');
        if (!matchesDisplay || !window.allReconciliationMatches) return;
        
        const allMatches = window.allReconciliationMatches;
        
        matchesDisplay.innerHTML = `
            <div class="matches-header">
                <h5>All Reconciliation Matches</h5>
                <p class="confidence-note">Showing all ${allMatches.length} matches:</p>
                <button class="btn small secondary" onclick="showTopMatches()">Show top matches only</button>
            </div>
            <div class="matches-list">
                ${allMatches.map((match, index) => {
                    const matchName = match.name || match.label || 'Unnamed item';
                    const matchDescription = match.description || match.desc || 'No description available';
                    const safeMatchName = escapeHtml(matchName);
                    const safeMatchDescription = escapeHtml(matchDescription);
                    
                    return `
                    <div class="match-item-simplified" data-match-id="${match.id}" onclick="selectMatch('${match.id}', '${safeMatchName}', '${safeMatchDescription}')">
                        <div class="match-score">${match.score.toFixed(1)}%</div>
                        <div class="match-content">
                            <div class="match-name">${matchName}</div>
                            <div class="match-description">${matchDescription}</div>
                            <div class="match-id">
                                <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank" onclick="event.stopPropagation()">
                                    ${match.id}
                                </a>
                            </div>
                        </div>
                        <div class="match-select">
                            <button class="btn small primary" onclick="event.stopPropagation(); selectMatch('${match.id}', '${safeMatchName}', '${safeMatchDescription}')">
                                Select
                            </button>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    };
    
    /**
     * Return to showing only top matches
     */
    window.showTopMatches = function() {
        if (!currentReconciliationCell || !window.allReconciliationMatches) return;
        
        const { property } = currentReconciliationCell;
        const propertyType = detectPropertyType(property);
        
        // Re-display with original logic
        displayReconciliationResults(window.allReconciliationMatches, propertyType, currentReconciliationCell.value);
    };
    
    // Removed manual search and ignore functions for compact design
    
    // Legacy confirmReconciliation function - now redirects to progressive disclosure functions
    window.confirmReconciliation = function() {
        // In progressive disclosure design, use specific functions instead:
        // - selectMatchAndAdvance() for Wikidata matches
        // - confirmCustomValue() for custom inputs
        // This function is kept for backward compatibility but should not be used
        console.warn('confirmReconciliation() is deprecated - use selectMatchAndAdvance() or confirmCustomValue() instead');
        
        if (currentReconciliationCell) {
            // Try to find selected match first
            const selectedMatch = document.querySelector('.match-item.selected');
            if (selectedMatch) {
                const matchId = selectedMatch.dataset.matchId;
                window.selectMatchAndAdvance(matchId);
                return;
            }
            
            // Fall back to custom value confirmation
            window.confirmCustomValue();
        }
    };
    
    /**
     * Setup manual search functionality
     */
    function setupManualSearch() {
        const searchBtn = document.querySelector('.search-btn');
        const searchInput = document.querySelector('.search-input');
        const searchResults = document.querySelector('.search-results');
        
        const performSearch = async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            
            searchResults.innerHTML = '<div class="loading">Searching...</div>';
            
            try {
                const matches = await tryDirectWikidataSearch(query);
                
                if (matches.length > 0) {
                    searchResults.innerHTML = matches.map(match => `
                        <div class="search-result-item" data-match-id="${match.id}">
                            <div class="result-info">
                                <div class="result-name">${match.name}</div>
                                <div class="result-description">${match.description}</div>
                                <div class="result-id">
                                    <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                                </div>
                            </div>
                            <div class="result-actions">
                                <button class="btn small primary" onclick="selectManualMatch('${match.id}')">Select</button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    searchResults.innerHTML = '<div class="no-results">No results found.</div>';
                }
            } catch (error) {
                searchResults.innerHTML = `<div class="error">Search error: ${error.message}</div>`;
            }
        };
        
        searchBtn.onclick = performSearch;
    }
    
    window.selectManualMatch = function(matchId) {
        // Mark as selected and enable confirm
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-match-id="${matchId}"]`).classList.add('selected');
        
        const confirmBtn = document.querySelector('.reconciliation-actions .btn.primary');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    };
    
    /**
     * Mark a cell as reconciled
     */
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
        const currentState = state.getState();
        state.updateState('reconciliationProgress.completed', currentState.reconciliationProgress.completed + 1);
        updateProgressDisplay();
        
        // Store in context suggestions
        if (reconciliation.type === 'wikidata') {
            contextSuggestions.set(property, reconciliation);
        }
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    }
    
    /**
     * Mark a cell as skipped
     */
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
        const currentState = state.getState();
        state.updateState('reconciliationProgress.skipped', currentState.reconciliationProgress.skipped + 1);
        updateProgressDisplay();
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    }
    
    /**
     * Mark a cell as having no Wikidata item
     */
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
        const currentState = state.getState();
        state.updateState('reconciliationProgress.completed', currentState.reconciliationProgress.completed + 1);
        updateProgressDisplay();
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    }
    
    /**
     * Update cell display based on reconciliation status
     */
    function updateCellDisplay(itemId, property, valueIndex, status, reconciliation = null) {
        // Find the cell element
        const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
        const cell = document.querySelector(cellSelector);
        
        if (cell) {
            // For multiple values, always use indexed selection; for single values, use the first element
            const allValueElements = cell.querySelectorAll('.property-value');
            const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
            
            if (valueElement) {
                valueElement.dataset.status = status;
                
                const statusSpan = valueElement.querySelector('.value-status');
                if (statusSpan) {
                    if (status === 'reconciled' && reconciliation) {
                        if (reconciliation.type === 'wikidata') {
                            const autoAcceptedText = reconciliation.qualifiers?.autoAccepted ? ' (auto)' : '';
                            statusSpan.innerHTML = `✓ <a href="https://www.wikidata.org/wiki/${reconciliation.id}" target="_blank">${reconciliation.id}</a>${autoAcceptedText}`;
                        } else {
                            const autoAcceptedText = reconciliation.qualifiers?.autoAccepted ? ' (auto)' : '';
                            let customText = `✓ Custom value${autoAcceptedText}`;
                            
                            // Show date precision for date values
                            if (reconciliation.datatype === 'time' && reconciliation.qualifiers?.precision) {
                                const precisionLabels = {
                                    'day': 'Day precision',
                                    'month': 'Month precision', 
                                    'year': 'Year precision',
                                    'decade': 'Decade precision',
                                    'century': 'Century precision',
                                    'millennium': 'Millennium precision'
                                };
                                const precisionLabel = precisionLabels[reconciliation.qualifiers.precision] || reconciliation.qualifiers.precision;
                                customText = `✓ Date (${precisionLabel})${autoAcceptedText}`;
                            }
                            
                            statusSpan.textContent = customText;
                        }
                        statusSpan.className = 'value-status reconciled';
                        
                        // Add auto-accepted styling if applicable
                        if (reconciliation.qualifiers?.autoAccepted) {
                            statusSpan.classList.add('auto-accepted');
                            let tooltipText = `Auto-accepted: ${reconciliation.qualifiers.reason}`;
                            
                            // Add precision info to tooltip for dates
                            if (reconciliation.datatype === 'time' && reconciliation.qualifiers?.precision) {
                                tooltipText += ` (${reconciliation.qualifiers.precision} precision)`;
                            }
                            
                            statusSpan.title = tooltipText;
                        }
                    } else if (status === 'skipped') {
                        statusSpan.textContent = 'Skipped';
                        statusSpan.className = 'value-status skipped';
                    } else if (status === 'no-item') {
                        statusSpan.textContent = '✕ No item';
                        statusSpan.className = 'value-status no-item';
                        statusSpan.title = 'Marked as having no appropriate Wikidata item';
                    }
                }
                
                // Remove all status classes and add the current one
                valueElement.classList.remove('high-confidence-match', 'partial-match', 'low-confidence-match', 'checking');
                
                if (status === 'reconciled') {
                    // Turn green when reconciled manually or automatically
                    valueElement.classList.add('reconciled');
                } else if (status === 'no-item') {
                    // Gray out items with no Wikidata item
                    valueElement.classList.add('no-item');
                }
                
                // Keep click handlers for all items except no-item (users should be able to edit auto-accepted items)
                // Only remove for no-item status that shouldn't be changed
                if (status === 'no-item') {
                    valueElement.style.cursor = 'default';
                    valueElement.onclick = null;
                }
            }
        }
    }
    
    /**
     * Debug function to check reconciliation step state
     * Can be called from browser console: window.debugReconciliation()
     */
    function debugReconciliationStep() {
        console.log('🔍=== RECONCILIATION DEBUG REPORT ===');
        
        // Check DOM elements
        console.log('🔍 DOM Elements:');
        console.log('  - propertyHeaders:', propertyHeaders);
        console.log('  - reconciliationRows:', reconciliationRows);
        console.log('  - reconciliationProgress:', reconciliationProgress);
        console.log('  - reconcileNextBtn:', reconcileNextBtn);
        console.log('  - proceedToDesignerBtn:', proceedToDesignerBtn);
        console.log('  - testReconciliationModelBtn:', testReconciliationModelBtn);
        
        // Check state
        const currentState = state.getState();
        console.log('🔍 State:');
        console.log('  - Current step:', currentState.currentStep);
        console.log('  - Has fetchedData:', !!currentState.fetchedData);
        console.log('  - fetchedData type:', typeof currentState.fetchedData);
        console.log('  - fetchedData length:', Array.isArray(currentState.fetchedData) ? currentState.fetchedData.length : 'not array');
        console.log('  - Has mappings:', !!currentState.mappings);
        console.log('  - mappedKeys count:', currentState.mappings?.mappedKeys?.length || 0);
        console.log('  - mappedKeys:', currentState.mappings?.mappedKeys);
        console.log('  - Test mode:', currentState.testMode);
        
        // Check reconciliation data
        console.log('🔍 Reconciliation Data:');
        console.log('  - reconciliationData object keys:', Object.keys(reconciliationData));
        console.log('  - reconciliationData:', reconciliationData);
        
        console.log('🔍=== END DEBUG REPORT ===');
        
        return {
            domElements: {
                propertyHeaders,
                reconciliationRows,
                reconciliationProgress,
                reconcileNextBtn,
                proceedToDesignerBtn
            },
            state: currentState,
            reconciliationData
        };
    }
    
    // Expose debug function globally for console access
    window.debugReconciliation = debugReconciliationStep;
    window.loadMockReconciliationData = loadMockDataForTesting;
    window.initializeReconciliationManually = initializeReconciliation;
    
    // Type override function for progressive disclosure design
    window.applyTypeOverride = function() {
        const select = document.querySelector('.type-override-select');
        
        if (!select || !select.value) {
            alert('Please select a property type.');
            return;
        }
        
        const newType = select.value;
        console.log('🔄 Applying type override:', newType);
        
        // Get current property and value from the modal context
        if (!currentReconciliationCell) return;
        
        const { property, value } = currentReconciliationCell;
        const inputConfig = getInputFieldConfig(newType);
        
        // Helper function for user-friendly type names
        const getUserFriendlyTypeName = (type) => {
            const typeNames = {
                'wikibase-item': 'Wikidata item',
                'string': 'Text string',
                'external-id': 'External identifier',
                'url': 'URL',
                'quantity': 'Number',
                'time': 'Date/Time',
                'monolingualtext': 'Text with language',
                'globe-coordinate': 'Coordinates'
            };
            return typeNames[type] || type;
        };
        
        // Update the expected type display in header
        const expectedTypeElement = document.querySelector('.expected-type');
        if (expectedTypeElement) {
            expectedTypeElement.textContent = `Expected: ${getUserFriendlyTypeName(newType)}`;
        }
        
        // Update primary recommendations section based on new type
        const primaryRecommendations = document.querySelector('.primary-recommendations');
        if (primaryRecommendations) {
            if (newType === 'wikibase-item') {
                // For Wikidata items, show reconciliation interface
                primaryRecommendations.innerHTML = `
                    <div class="loading-state">Finding matches...</div>
                    <div class="high-confidence-matches" style="display: none;"></div>
                    <div class="fallback-options" style="display: none;">
                        <div class="search-wikidata">
                            <input type="text" class="search-input" placeholder="Search Wikidata..." value="${value}">
                            <button class="btn primary search-btn">Search</button>
                        </div>
                        <button class="btn create-new-item" onclick="createNewWikidataItem()">
                            ➕ Create New Wikidata Item
                        </button>
                    </div>
                `;
                
                // Re-perform reconciliation with new type
                setTimeout(async () => {
                    await performAutomaticReconciliation(value, property);
                    setupManualSearchInFallback();
                }, 100);
            } else {
                // For non-Wikidata properties, show custom input directly
                const customInputHTML = createInputHTML(newType, value, property);
                primaryRecommendations.innerHTML = `
                    <div class="non-wikidata-input">
                        <h5>Enter ${inputConfig.description}</h5>
                        <div class="custom-input-container">
                            ${customInputHTML}
                        </div>
                        <div class="input-actions">
                            <button class="btn primary" onclick="confirmCustomValue()">Confirm Value</button>
                        </div>
                    </div>
                `;
                
                // Setup dynamic date precision if needed
                setTimeout(() => {
                    setupDynamicDatePrecision(primaryRecommendations);
                }, 100);
            }
        }
        
        // Update the type description in expanded options
        const typeSettingsDesc = document.querySelector('.option-section p strong');
        if (typeSettingsDesc) {
            typeSettingsDesc.textContent = getUserFriendlyTypeName(newType);
        }
        
        console.log('✅ Type override applied successfully with progressive disclosure');
    };
    
    // Return public API if needed
    return {
        debugReconciliationStep,
        loadMockDataForTesting,
        initializeReconciliation
    };
}