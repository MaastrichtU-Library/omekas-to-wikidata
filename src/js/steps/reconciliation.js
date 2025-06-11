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
        
        if (!currentState.fetchedData) {
            console.warn('❌ No fetched data available for reconciliation');
            console.warn('❌ Current fetchedData:', currentState.fetchedData);
            return;
        }
        
        console.log('✅ Validation passed - proceeding with reconciliation initialization');
        console.log('✅ Mapped keys:', currentState.mappings.mappedKeys);
        console.log('✅ Fetched data type:', typeof currentState.fetchedData);
        console.log('✅ Fetched data structure:', currentState.fetchedData);
        
        const mappedKeys = currentState.mappings.mappedKeys;
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
                }
                return null;
            });
            
            // Wait for all reconciliation calls for this property with controlled concurrency
            const batchSize = 5; // Limit concurrent API calls
            for (let i = 0; i < batchPromises.length; i += batchSize) {
                const batch = batchPromises.slice(i, i + batchSize);
                const results = await Promise.all(batch);
                
                // Process results
                results.forEach(result => {
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
                        }
                    }
                });
                
                // Small delay between batches to be respectful to APIs
                if (i + batchSize < batchPromises.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }
        
        console.log(`🎉 Batch auto-acceptance completed! Auto-accepted ${autoAcceptedCount} values.`);
        
        // Update progress display
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
     * Update cell display to show best match percentage
     */
    function updateCellDisplayWithMatch(itemId, property, valueIndex, bestMatch) {
        // Find the cell element
        const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
        const cell = document.querySelector(cellSelector);
        
        if (cell) {
            const valueElement = cell.querySelector('.property-value') || 
                               cell.querySelectorAll('.property-value')[valueIndex];
            
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
                
                // Add a visual indicator for good matches - use orange/yellow for medium confidence
                if (bestMatch.score >= 80) {
                    valueElement.classList.add('high-confidence-match');
                } else if (bestMatch.score >= 60) {
                    valueElement.classList.add('medium-confidence-match');
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
            openReconciliationModal(itemId, property, valueIndex, value);
        };
        
        valueDiv.addEventListener('click', clickHandler);
        
        // Add keyboard support
        valueDiv.setAttribute('tabindex', '0');
        valueDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clickHandler();
            }
        });
        
        return valueDiv;
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
            
            const { total, completed, skipped } = progress;
            const remaining = total - completed - skipped;
            reconciliationProgress.innerHTML = `
                <div class="progress-stats">
                    <span class="stat completed">${completed} completed</span>
                    <span class="stat skipped">${skipped} skipped</span>
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
        
        Object.values(reconciliationData).forEach(itemData => {
            Object.values(itemData.properties).forEach(propData => {
                propData.reconciled.forEach(reconciledItem => {
                    total++;
                    if (reconciledItem.status === 'reconciled') {
                        completed++;
                    } else if (reconciledItem.status === 'skipped') {
                        skipped++;
                    }
                });
            });
        });
        
        return { total, completed, skipped };
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
        currentReconciliationCell = { itemId, property, valueIndex, value };
        
        // Create modal content
        const modalContent = createReconciliationModalContent(itemId, property, valueIndex, value);
        
        // Open modal
        modalUI.openModal('Reconcile Value', modalContent, [], () => {
            currentReconciliationCell = null;
        });
        
        // Setup modal after DOM is rendered
        setTimeout(() => {
            const modalElement = document.querySelector('#modal-content');
            if (modalElement) {
                console.log('🔧 Setting up modal functionality');
                setupDynamicDatePrecision(modalElement);
                setupTabEventListeners();
                setupAutoAdvanceToggle();
            } else {
                console.warn('⚠️ Modal content element not found for setup');
            }
        }, 100);
        
        // Start automatic reconciliation (but use existing matches if available)
        await performAutomaticReconciliation(value, property, itemId, valueIndex);
    }
    
    /**
     * Create modal content for reconciliation with progressive disclosure design
     */
    function createReconciliationModalContent(itemId, property, valueIndex, value) {
        // Detect property type for dynamic input fields
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        const customInputHTML = createInputHTML(propertyType, value, property);
        
        // Get friendly type name
        function getUserFriendlyTypeName(type) {
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
        }
        
        const itemTitle = reconciliationData[itemId]?.originalData?.['o:title'] || `Item ${itemId.replace('item-', '')}`;
        
        return `
            <div class="reconciliation-modal-v2">
                <div class="reconciliation-header">
                    <h4>Reconcile: ${property}</h4>
                    <p class="original-value">Value: <strong>"${value}"</strong></p>
                    <p class="item-context">From: ${itemTitle}</p>
                    <p class="expected-type">Expected: ${getUserFriendlyTypeName(propertyType)}</p>
                </div>
                
                <div class="primary-recommendations">
                    <div class="loading-state">Finding matches...</div>
                    <div class="high-confidence-matches" style="display: none;"></div>
                    <div class="fallback-options" style="display: none;">
                        ${propertyType === 'wikibase-item' ? `
                            <div class="search-wikidata">
                                <input type="text" class="search-input" placeholder="Search Wikidata..." value="${value}">
                                <button class="btn primary search-btn">Search</button>
                            </div>
                            <button class="btn create-new-item" onclick="createNewWikidataItem()">
                                ➕ Create New Wikidata Item
                            </button>
                        ` : `
                            <div class="custom-input-primary">
                                ${customInputHTML}
                            </div>
                        `}
                    </div>
                </div>
                
                <div class="progressive-disclosure">
                    <button class="expand-options" onclick="toggleMoreOptions()">
                        ▼ More Options
                    </button>
                    <div class="expanded-options" style="display: none;">
                        ${propertyType === 'wikibase-item' ? `
                            <div class="option-section">
                                <h5>Manual Search</h5>
                                <div class="manual-search-expanded">
                                    <input type="text" class="search-input-expanded" placeholder="Search Wikidata..." value="${value}">
                                    <button class="btn secondary search-btn-expanded">Search</button>
                                    <div class="search-results-expanded"></div>
                                </div>
                            </div>
                            <div class="option-section">
                                <h5>Custom Value</h5>
                                <div class="custom-value-expanded">
                                    <p>Enter a custom value if no Wikidata match is appropriate:</p>
                                    ${customInputHTML}
                                    <p class="note">This will be used as a literal value without Wikidata linking.</p>
                                </div>
                            </div>
                        ` : ''}
                        <div class="option-section">
                            <h5>Property Type Settings</h5>
                            <p>Current property type: <strong>${getUserFriendlyTypeName(propertyType)}</strong></p>
                            <p>If this seems incorrect, you can override the property type:</p>
                            <div class="type-override-controls">
                                <label for="type-override-select">Choose property type:</label>
                                <select class="type-override-select" id="type-override-select">
                                    <option value="wikibase-item" ${propertyType === 'wikibase-item' ? 'selected' : ''}>Wikidata item</option>
                                    <option value="string" ${propertyType === 'string' ? 'selected' : ''}>Text string</option>
                                    <option value="external-id" ${propertyType === 'external-id' ? 'selected' : ''}>External identifier</option>
                                    <option value="url" ${propertyType === 'url' ? 'selected' : ''}>URL</option>
                                    <option value="quantity" ${propertyType === 'quantity' ? 'selected' : ''}>Number</option>
                                    <option value="time" ${propertyType === 'time' ? 'selected' : ''}>Date/Time</option>
                                    <option value="monolingualtext" ${propertyType === 'monolingualtext' ? 'selected' : ''}>Text with language</option>
                                    <option value="globe-coordinate" ${propertyType === 'globe-coordinate' ? 'selected' : ''}>Coordinates</option>
                                </select>
                                <button class="btn small primary apply-type-btn" onclick="applyTypeOverride()">Apply Type Change</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="reconciliation-actions">
                    <button class="btn secondary" onclick="skipReconciliation()">Skip for Later</button>
                    <div class="auto-advance-toggle">
                        <label>
                            <input type="checkbox" id="auto-advance" ${getAutoAdvanceSetting() ? 'checked' : ''}>
                            Auto-advance to next
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Get auto-advance setting from user preference or state
     */
    function getAutoAdvanceSetting() {
        return autoAdvanceSetting;
    }
    
    /**
     * Display smart recommendations based on match confidence
     */
    async function displaySmartRecommendations(matches, propertyType, value) {
        const loadingState = document.querySelector('.loading-state');
        const highConfidenceContainer = document.querySelector('.high-confidence-matches');
        const fallbackContainer = document.querySelector('.fallback-options');
        
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        if (propertyType !== 'wikibase-item') {
            // Non-Wikidata properties: show custom input directly
            showCustomInputInterface(propertyType, value);
            return;
        }
        
        const highConfidenceMatches = matches?.filter(m => m.score >= 80) || [];
        
        if (highConfidenceMatches.length > 0) {
            displayHighConfidenceMatches(highConfidenceMatches);
            if (highConfidenceContainer) {
                highConfidenceContainer.style.display = 'block';
            }
        } else {
            displayFallbackOptions(value, matches);
            if (fallbackContainer) {
                fallbackContainer.style.display = 'block';
            }
        }
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
                ${matches.map((match, index) => `
                    <div class="confidence-match-card ${index === 0 ? 'best-match' : ''}" data-match-id="${match.id}">
                        <div class="match-confidence">${match.score.toFixed(1)}% confidence</div>
                        <div class="match-name">${match.name}</div>
                        <div class="match-description">${match.description}</div>
                        <div class="match-id">
                            <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                        </div>
                        <button class="btn small primary select-match-btn" onclick="selectMatchAndAdvance('${match.id}')">
                            ${index === 0 ? '🎯 Select Best Match' : 'Select'}
                        </button>
                    </div>
                `).join('')}
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
            searchInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            };
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
            
            // Display results using new progressive disclosure logic
            await displaySmartRecommendations(matches, propertyType, value);
            
        } catch (error) {
            console.error('Error during automatic reconciliation:', error);
            displayReconciliationError(error);
        }
    }
    
    /**
     * Try Wikidata Reconciliation API
     */
    async function tryReconciliationApi(value, property) {
        const reconApiUrl = 'https://wikidata.reconci.link/en/api';
        
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
        
        const response = await fetch(reconApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: requestBody
        });
        
        if (!response.ok) {
            throw new Error(`Reconciliation API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.q1 && data.q1.result) {
            return data.q1.result.map(match => ({
                id: match.id,
                name: match.name,
                description: match.description || 'No description available',
                score: match.score,
                type: match.type || [],
                source: 'reconciliation'
            }));
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
            return data.search.map(item => ({
                id: item.id,
                name: item.label,
                description: item.description || 'No description available',
                score: 50, // Approximate score for direct search
                type: [],
                source: 'direct'
            }));
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
    
    /**
     * Setup event listeners for tab buttons in the modal
     */
    function setupTabEventListeners() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const tabName = this.getAttribute('data-tab');
                
                if (tabName) {
                    console.log('🔄 Switching to tab:', tabName);
                    switchTab(tabName);
                }
            });
        });
        
        console.log('✅ Tab event listeners setup for', tabButtons.length, 'buttons');
    }
    
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
            searchInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            };
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
    
    // Global functions for modal interactions (attached to window for onclick handlers)
    window.switchTab = function(tabName) {
        // Switch tab logic
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // If switching to manual tab, set up search
        if (tabName === 'manual') {
            setupManualSearch();
        }
    };
    
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
    
    window.createNewWikidataItem = function() {
        const value = currentReconciliationCell?.value;
        if (value) {
            const url = `https://www.wikidata.org/wiki/Special:NewItem?label=${encodeURIComponent(value)}`;
            window.open(url, '_blank');
        }
    };
    
    window.confirmReconciliation = function() {
        if (currentReconciliationCell) {
            const { property } = currentReconciliationCell;
            const propertyType = detectPropertyType(property);
            const selectedMatch = document.querySelector('.match-item.selected');
            
            // Handle Wikidata entity selection
            if (selectedMatch) {
                const matchId = selectedMatch.dataset.matchId;
                markCellAsReconciled(currentReconciliationCell, {
                    type: 'wikidata',
                    id: matchId,
                    label: selectedMatch.querySelector('.match-name').textContent,
                    description: selectedMatch.querySelector('.match-description').textContent
                });
                
                modalUI.closeModal();
                setTimeout(() => reconcileNextUnprocessedCell(), 100);
                return;
            }
            
            // Handle custom value input from dynamic fields
            if (document.getElementById('custom-tab').classList.contains('active')) {
                const inputContainer = document.querySelector('.dynamic-input-container');
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
                
                // Fallback to old custom input for backward compatibility
                if (!customValue) {
                    const customInput = document.querySelector('.custom-input');
                    if (customInput) {
                        customValue = customInput.value;
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
                    setTimeout(() => reconcileNextUnprocessedCell(), 100);
                } else {
                    alert('Please enter a value or select a match.');
                }
            }
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
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        };
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
     * Update cell display based on reconciliation status
     */
    function updateCellDisplay(itemId, property, valueIndex, status, reconciliation = null) {
        // Find the cell element
        const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
        const cell = document.querySelector(cellSelector);
        
        if (cell) {
            const valueElement = cell.querySelector('.property-value') || 
                               cell.querySelectorAll('.property-value')[valueIndex];
            
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
                    }
                }
                
                // Keep click handlers for all items (users should be able to edit auto-accepted items)
                // Only remove for skipped items that are explicitly meant to be skipped
                if (status === 'skipped') {
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
    
    // Type override function
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
        
        // Update the property type info display
        const typeValueSpan = document.querySelector('.property-type-value');
        const inputConfig = getInputFieldConfig(newType);
        if (typeValueSpan) {
            typeValueSpan.textContent = inputConfig.description;
        }
        
        // Update the settings tab description
        const settingsDescription = document.querySelector('#settings-tab p strong');
        if (settingsDescription) {
            settingsDescription.textContent = inputConfig.description;
        }
        
        // Recreate the tabs and content with the new type
        const newTabsHTML = `
            <div class="option-tabs">
                ${inputConfig.requiresReconciliation ? 
                    '<button class="tab-btn active" data-tab="automatic">Automatic Matches</button>' : 
                    ''
                }
                ${inputConfig.requiresReconciliation ? 
                    '<button class="tab-btn" data-tab="manual">Manual Search</button>' : 
                    ''
                }
                ${!inputConfig.requiresReconciliation || newType !== 'wikibase-item' ? 
                    `<button class="tab-btn ${!inputConfig.requiresReconciliation ? 'active' : ''}" data-tab="custom">${inputConfig.requiresReconciliation ? 'Custom Value' : 'Enter Value'}</button>` : 
                    ''
                }
                <button class="tab-btn settings-tab" data-tab="settings">⚙️ Settings</button>
            </div>
            
            ${inputConfig.requiresReconciliation ? `
                <div class="tab-content active" id="automatic-tab">
                    <div class="loading-indicator">
                        <p>Searching for matches...</p>
                        <div class="spinner"></div>
                    </div>
                    <div class="matches-container" style="display: none;">
                        <div class="matches-list"></div>
                    </div>
                    <div class="no-matches" style="display: none;">
                        <p>No automatic matches found.</p>
                        <button class="btn secondary" onclick="switchTab('manual')">Try Manual Search</button>
                    </div>
                </div>
                
                <div class="tab-content" id="manual-tab">
                    <div class="manual-search">
                        <div class="search-controls">
                            <input type="text" class="search-input" placeholder="Search Wikidata..." value="${value}">
                            <button class="btn primary search-btn">Search</button>
                        </div>
                        <div class="search-results"></div>
                    </div>
                </div>
            ` : ''}
            
            ${!inputConfig.requiresReconciliation || newType !== 'wikibase-item' ? `
                <div class="tab-content ${!inputConfig.requiresReconciliation ? 'active' : ''}" id="custom-tab">
                    <div class="custom-value">
                        ${inputConfig.requiresReconciliation ? 
                            '<p>Enter a custom value if no Wikidata match is appropriate:</p>' : 
                            '<p>Enter the value for this property:</p>'
                        }
                        ${createInputHTML(newType, value, property)}
                        ${inputConfig.requiresReconciliation ? 
                            '<p class="note">This will be used as a literal value without Wikidata linking.</p>' : 
                            ''
                        }
                    </div>
                </div>
            ` : ''}
            
            <div class="tab-content" id="settings-tab">
                <div class="settings-section">
                    <h5>Property Type Settings</h5>
                    <p>Current property type: <strong>${inputConfig.description}</strong></p>
                    <p>If this seems incorrect, you can override the property type:</p>
                    
                    <div class="type-override-controls">
                        <label for="type-override-select">Choose property type:</label>
                        <select class="type-override-select" id="type-override-select">
                            <option value="wikibase-item" ${newType === 'wikibase-item' ? 'selected' : ''}>Wikidata Item (Q-ID)</option>
                            <option value="string" ${newType === 'string' ? 'selected' : ''}>Text String</option>
                            <option value="external-id" ${newType === 'external-id' ? 'selected' : ''}>External Identifier</option>
                            <option value="url" ${newType === 'url' ? 'selected' : ''}>URL</option>
                            <option value="quantity" ${newType === 'quantity' ? 'selected' : ''}>Number/Quantity</option>
                            <option value="time" ${newType === 'time' ? 'selected' : ''}>Date/Time</option>
                            <option value="monolingualtext" ${newType === 'monolingualtext' ? 'selected' : ''}>Text with Language</option>
                            <option value="globe-coordinate" ${newType === 'globe-coordinate' ? 'selected' : ''}>Coordinates</option>
                        </select>
                        <button class="btn small primary apply-type-btn" onclick="applyTypeOverride()">Apply Type Change</button>
                    </div>
                    
                    <div class="settings-note">
                        <p><strong>Note:</strong> Changing the property type will update the input fields and reconciliation options to match the new type.</p>
                    </div>
                </div>
            </div>
        `;
        
        // Update the options container
        const optionsContainer = document.querySelector('.reconciliation-options');
        if (optionsContainer) {
            optionsContainer.innerHTML = newTabsHTML;
            
            // Re-setup tab event listeners for the new buttons
            setTimeout(() => {
                setupTabEventListeners();
                setupDynamicDatePrecision(optionsContainer);
                
                // Switch to the first appropriate tab after type change
                if (inputConfig.requiresReconciliation) {
                    switchTab('automatic');
                    performAutomaticReconciliation(value, property);
                } else {
                    switchTab('custom');
                }
            }, 100);
        }
        
        console.log('✅ Type override applied successfully');
    };
    
    // Return public API if needed
    return {
        debugReconciliationStep,
        loadMockDataForTesting,
        initializeReconciliation
    };
}