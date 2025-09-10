/**
 * Handles the Reconciliation step functionality
 * Manages the process of reconciling Omeka S values with Wikidata entities
 * Implements OpenRefine-style reconciliation interface with modal-based workflow
 */

import { setupModalUI } from '../ui/modal-ui.js';
import { detectPropertyType, getInputFieldConfig, createInputHTML, validateInput, getSuggestedEntityTypes, setupDynamicDatePrecision, standardizeDateInput } from '../utils/property-types.js';
import { getConstraintBasedTypes, buildContextualProperties, validateAgainstFormatConstraints, scoreMatchWithConstraints, getConstraintSummary } from '../utils/constraint-helpers.js';
import { eventSystem } from '../events.js';
import { getMockItemsData, getMockMappingData } from '../data/mock-data.js';
import { createElement } from '../ui/components.js';

export function setupReconciliationStep(state) {
    
    // Initialize modal UI
    const modalUI = setupModalUI();
    
    // Listen for STEP_CHANGED events to initialize reconciliation when entering step 3
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 3) {
            setTimeout(() => {
                initializeReconciliation();
            }, 100); // Small delay to ensure DOM is updated
        }
    });
    
    // Initialize DOM elements
    const propertyHeaders = document.getElementById('property-headers');
    const reconciliationRows = document.getElementById('reconciliation-rows');
    const reconcileNextBtn = document.getElementById('reconcile-next');
    const proceedToDesignerBtn = document.getElementById('proceed-to-designer');
    const testReconciliationModelBtn = document.getElementById('test-reconciliation-model');
    
    // Debug DOM element initialization
    
    // Reconciliation state management
    let reconciliationData = {};
    let currentReconciliationCell = null;
    let contextSuggestions = new Map(); // Store previously selected values for suggestions
    let autoAdvanceSetting = true; // Default to auto-advance enabled
    
    // Add click handler for proceed to designer button
    if (proceedToDesignerBtn) {
        proceedToDesignerBtn.addEventListener('click', () => {
            
            // Log detailed reconciliation data
            Object.entries(reconciliationData).forEach(([itemId, itemData]) => {
                Object.entries(itemData.properties).forEach(([property, propData]) => {
                    propData.reconciled.forEach((reconciled, index) => {
                    });
                });
            });
            
            // Check state
            const currentState = state.getState();
            
            // Navigate to designer step
            state.setCurrentStep(4);
        });
    }
    
    // Initialize reconciliation data when entering this step
    document.addEventListener('DOMContentLoaded', () => {
        
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                const stepNumber = parseInt(step.dataset.step);
                if (stepNumber === 3) {
                    initializeReconciliation();
                }
            });
        });
        
        // Also listen for the navigation button
        const proceedBtn = document.getElementById('proceed-to-reconciliation');
        if (proceedBtn) {
            proceedBtn.addEventListener('click', () => {
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
            loadMockDataForTesting();
        });
    }
    
    /**
     * Initialize reconciliation interface based on fetched data and mappings
     */
    async function initializeReconciliation() {
        const currentState = state.getState();
        
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
        
        
        // Filter out keys that are not in the current dataset
        const mappedKeys = currentState.mappings.mappedKeys.filter(keyObj => !keyObj.notInCurrentDataset);
        
        // Get manual properties
        const manualProperties = currentState.mappings.manualProperties || [];
        
        const data = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
        
        // Check if we already have reconciliation data from a previous session
        let isReturningToStep = false;
        if (currentState.reconciliationData && Object.keys(currentState.reconciliationData).length > 0) {
            reconciliationData = currentState.reconciliationData;
            isReturningToStep = true;
        } else {
            
            // Initialize reconciliation progress
            const totalCells = calculateTotalReconciliableCells(data, mappedKeys, manualProperties);
            state.setReconciliationProgress(0, totalCells);
            
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
                        references: [], // References specific to this property
                        propertyMetadata: typeof keyObj === 'object' ? keyObj : null, // Store full property object with constraints
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
                
                // Initialize each manual property with default values
                manualProperties.forEach(manualProp => {
                    const propertyId = manualProp.property.id;
                    const defaultValue = manualProp.defaultValue;
                    
                    // Create default values array - manual properties get one value per item
                    const values = defaultValue ? [defaultValue] : [''];
                    
                    reconciliationData[itemId].properties[propertyId] = {
                        originalValues: values,
                        references: [], // References specific to this property
                        isManualProperty: true, // Mark as manual property
                        manualPropertyData: manualProp, // Store complete manual property data
                        reconciled: values.map(() => ({
                            status: 'pending', // pending, reconciled, skipped, failed
                            matches: [],
                            selectedMatch: null,
                            manualValue: defaultValue || null,
                            qualifiers: {},
                            confidence: 0
                        }))
                    };
                });
            });
        }
        
        // Update proceed button
        updateProceedButton();
        
        // Create reconciliation table
        await createReconciliationTable(data, mappedKeys, manualProperties, isReturningToStep);
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
        
        // Calculate and update progress from actual reconciliation data
        if (reconciliationData && Object.keys(reconciliationData).length > 0) {
            const progress = calculateCurrentProgress();
            state.updateState('reconciliationProgress', progress);
        }
        
        // Enable/disable proceed button
        updateProceedButton();
        
    }
    
    /**
     * Load mock data for testing purposes
     */
    function loadMockDataForTesting() {
        
        const mockItems = getMockItemsData();
        const mockMapping = getMockMappingData();
        
        // Update state with mock data
        state.loadMockData(mockItems, mockMapping);
        
        
        // Initialize reconciliation with mock data
        setTimeout(() => {
            initializeReconciliation();
        }, 100);
    }
    
    /**
     * Calculate total number of reconcilable cells
     */
    function calculateTotalReconciliableCells(data, mappedKeys, manualProperties = []) {
        let total = 0;
        data.forEach(item => {
            // Count mapped property cells
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const values = extractPropertyValues(item, keyName);
                total += values.length;
            });
            
            // Count manual property cells (each manual property counts as 1 cell per item)
            total += manualProperties.length;
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
     * Combine and sort all properties (mapped and manual) to prioritize label, description, aliases, and instance of
     */
    function combineAndSortProperties(mappedKeys, manualProperties) {
        // Create a unified array with both mapped and manual properties
        const allProperties = [];
        
        // Add mapped properties with a type indicator
        mappedKeys.forEach((keyObj, index) => {
            allProperties.push({
                type: 'mapped',
                data: keyObj,
                originalIndex: index
            });
        });
        
        // Add manual properties with a type indicator  
        manualProperties.forEach((manualProp, index) => {
            allProperties.push({
                type: 'manual',
                data: manualProp,
                originalIndex: index + mappedKeys.length // Offset by mapped keys length
            });
        });
        
        // Sort the combined array
        return allProperties.sort((a, b) => {
            const getPriority = (item) => {
                let label = '';
                let id = '';
                
                if (item.type === 'mapped') {
                    const property = typeof item.data === 'string' ? null : item.data.property;
                    if (!property) return 100;
                    label = property.label ? property.label.toLowerCase() : '';
                    id = property.id || '';
                } else if (item.type === 'manual') {
                    label = item.data.property.label ? item.data.property.label.toLowerCase() : '';
                    id = item.data.property.id || '';
                }
                
                // Priority order: label, description, aliases, instance of (P31), then everything else
                if (label === 'label') return 1;
                if (label === 'description') return 2;
                if (label === 'aliases' || label === 'alias') return 3;
                if (id === 'P31' || label === 'instance of') return 4;
                
                return 50; // All other properties maintain relative order
            };
            
            const aPriority = getPriority(a);
            const bPriority = getPriority(b);
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            // If same priority, maintain original order
            return a.originalIndex - b.originalIndex;
        });
    }
    
    /**
     * Create the reconciliation table interface
     */
    async function createReconciliationTable(data, mappedKeys, manualProperties = [], isReturningToStep = false) {
        
        // Combine and sort all properties for display priority
        const sortedProperties = combineAndSortProperties(mappedKeys, manualProperties);
        
        // Clear existing content
        if (propertyHeaders) {
            propertyHeaders.innerHTML = '';
            
            // Add item header
            const itemHeader = createElement('th', {
                className: 'item-header'
            }, 'Item');
            propertyHeaders.appendChild(itemHeader);
            
            // Add property headers for all properties in sorted order
            sortedProperties.forEach(propItem => {
                if (propItem.type === 'mapped') {
                    // Handle mapped property
                    const keyObj = propItem.data;
                    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                    
                    // Create header content with property label and clickable QID
                    let headerContent;
                    let clickHandler = null;
                    
                    if (keyObj.property && keyObj.property.label && keyObj.property.id) {
                        // Create header with property label and clickable QID
                        headerContent = createElement('div', { 
                            className: 'property-header-content' 
                        });
                        
                        // Property label (clickable span - will be handled by header click)
                        const labelSpan = createElement('span', {
                            className: 'property-label'
                        }, keyObj.property.label);
                        headerContent.appendChild(labelSpan);
                        
                        // Space and opening bracket
                        headerContent.appendChild(document.createTextNode(' ('));
                        
                        // Clickable QID link - smart routing based on property type
                        const wikidataUrl = getWikidataUrlForProperty(keyObj.property);
                        const qidLink = createElement('a', {
                            className: 'property-qid-link',
                            href: wikidataUrl,
                            target: '_blank',
                            onClick: (e) => e.stopPropagation() // Prevent header click when clicking QID
                        }, keyObj.property.id);
                        headerContent.appendChild(qidLink);
                        
                        // Closing bracket
                        headerContent.appendChild(document.createTextNode(')'));
                        
                        // Set click handler to open mapping modal
                        clickHandler = () => {
                            if (window.openMappingModal) {
                                window.openMappingModal(keyObj);
                            }
                        };
                    } else {
                        // Fallback to original key name if no property info available
                        headerContent = keyName;
                        clickHandler = () => {
                            if (window.openMappingModal) {
                                window.openMappingModal(keyObj);
                            }
                        };
                    }
                    
                    const th = createElement('th', {
                        className: 'property-header clickable-header',
                        dataset: { property: keyName },
                        onClick: clickHandler,
                        style: { cursor: 'pointer' },
                        title: 'Click to modify mapping'
                    }, headerContent);
                    
                    propertyHeaders.appendChild(th);
                } else if (propItem.type === 'manual') {
                    // Handle manual property
                    const manualProp = propItem.data;
                    
                    // Create header content with property label and clickable QID
                    const headerContent = createElement('div', { 
                        className: 'property-header-content' 
                    });
                    
                    // Property label (clickable span - will be handled by header click)
                    const labelSpan = createElement('span', {
                        className: 'property-label'
                    }, manualProp.property.label);
                    headerContent.appendChild(labelSpan);
                    
                    // Space and opening bracket
                    headerContent.appendChild(document.createTextNode(' ('));
                    
                    // Clickable QID link - smart routing based on property type
                    const wikidataUrl = getWikidataUrlForProperty(manualProp.property);
                    const qidLink = createElement('a', {
                        className: 'property-qid-link',
                        href: wikidataUrl,
                        target: '_blank',
                        onClick: (e) => e.stopPropagation() // Prevent header click when clicking QID
                    }, manualProp.property.id);
                    headerContent.appendChild(qidLink);
                    
                    // Closing bracket
                    headerContent.appendChild(document.createTextNode(')'));
                    
                    // Add required indicator if applicable
                    if (manualProp.isRequired) {
                        const requiredIndicator = createElement('span', {
                            className: 'required-indicator-header'
                        }, ' *');
                        headerContent.appendChild(requiredIndicator);
                    }
                    
                    const th = createElement('th', {
                        className: 'property-header manual-property-header clickable-header',
                        dataset: { 
                            property: manualProp.property.id,
                            isManual: 'true'
                        },
                        title: `${manualProp.property.description}\nClick to modify property settings`,
                        onClick: () => {
                            // Open the manual property edit modal
                            if (window.openManualPropertyEditModal) {
                                window.openManualPropertyEditModal(manualProp);
                            }
                        },
                        style: { cursor: 'pointer' }
                    }, headerContent);
                    
                    propertyHeaders.appendChild(th);
                }
            });
        }
        
        // Create item rows
        if (reconciliationRows) {
            reconciliationRows.innerHTML = '';
            
            data.forEach((item, index) => {
                const itemId = `item-${index}`;
                const tr = createElement('tr', {
                    id: `row-${itemId}`,
                    className: 'reconciliation-row'
                });
                
                // Add item cell
                const itemTitle = item['o:title'] || item['title'] || `Item ${index + 1}`;
                const itemCell = createElement('td', {
                    className: 'item-cell'
                }, itemTitle);
                tr.appendChild(itemCell);
                
                // Add property cells (using sorted order to match headers)
                sortedProperties.forEach(propItem => {
                    if (propItem.type === 'mapped') {
                        // Handle mapped property cell
                        const keyObj = propItem.data;
                        const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                        const values = extractPropertyValues(item, keyName);
                        
                        if (values.length === 0) {
                            // Empty cell
                            const td = createElement('td', {
                                className: 'property-cell empty-cell'
                            }, '—');
                            tr.appendChild(td);
                        } else if (values.length === 1) {
                            // Single value cell
                            const td = createPropertyCell(itemId, keyName, 0, values[0]);
                            tr.appendChild(td);
                        } else {
                            // Multiple values cell
                            const td = createElement('td', {
                                className: 'property-cell multi-value-cell',
                                dataset: {
                                    itemId: itemId,
                                    property: keyName
                                }
                            });
                            
                            values.forEach((value, valueIndex) => {
                                const valueDiv = createValueElement(itemId, keyName, valueIndex, value);
                                td.appendChild(valueDiv);
                            });
                            
                            tr.appendChild(td);
                        }
                    } else if (propItem.type === 'manual') {
                        // Handle manual property cell
                        const manualProp = propItem.data;
                        const propertyId = manualProp.property.id;
                        const defaultValue = manualProp.defaultValue || '';
                        
                        // Create a cell for the manual property with the default value
                        const td = createManualPropertyCell(itemId, propertyId, defaultValue, manualProp);
                        tr.appendChild(td);
                    }
                });
                
                reconciliationRows.appendChild(tr);
            });
            
            // Only perform batch auto-acceptance for fresh initialization, not when returning to step
            if (!isReturningToStep) {
                await performBatchAutoAcceptance(data, mappedKeys, manualProperties);
            } else {
                restoreReconciliationDisplay(data, mappedKeys, manualProperties);
            }
            
        } else {
            console.error('🔨 reconciliationRows element not found!');
        }
    }
    
    /**
     * Perform batch auto-acceptance for all values in the table
     */
    async function performBatchAutoAcceptance(data, mappedKeys, manualProperties = []) {
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
        
        // Auto-accept all date values immediately
        dateValues.forEach(({ itemId, property, valueIndex, autoAcceptResult }) => {
            markCellAsReconciled({ itemId, property, valueIndex }, autoAcceptResult);
            autoAcceptedCount++;
        });
        
        // Process API-requiring properties in batches
        for (const [property, jobs] of batchByProperty.entries()) {
            
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
                        reconciliationData[job.itemId].properties[job.property] = { 
                            reconciled: [],
                            references: [] // References specific to this property
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
     * Store empty matches when no reconciliation results found
     * This ensures the system knows reconciliation was attempted
     */
    function storeEmptyMatches(cellInfo) {
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
        const td = createElement('td', {
            className: 'property-cell single-value-cell',
            dataset: {
                itemId: itemId,
                property: property,
                valueIndex: valueIndex
            }
        });
        
        const valueDiv = createValueElement(itemId, property, valueIndex, value);
        td.appendChild(valueDiv);
        
        return td;
    }
    
    /**
     * Create a value element within a property cell
     */
    function createValueElement(itemId, property, valueIndex, value) {
        const valueDiv = createElement('div', {
            className: 'property-value',
            dataset: { status: 'pending' }
        });
        
        const textSpan = createElement('span', {
            className: 'value-text'
        }, value || 'Empty value');
        
        const statusSpan = createElement('span', {
            className: 'value-status'
        }, 'Click to reconcile');
        
        valueDiv.appendChild(textSpan);
        valueDiv.appendChild(statusSpan);
        
        // Add click handler 
        const clickHandler = () => {
            openReconciliationModal(itemId, property, valueIndex, value);
        };
        
        valueDiv.addEventListener('click', clickHandler);
        
        
        return valueDiv;
    }
    
    /**
     * Create a property cell for manual properties
     */
    function createManualPropertyCell(itemId, propertyId, defaultValue, manualProp) {
        const td = createElement('td', {
            className: 'property-cell manual-property-cell',
            dataset: {
                itemId: itemId,
                property: propertyId,
                isManual: 'true'
            }
        });
        
        // Create a value element for the manual property
        const valueDiv = createElement('div', {
            className: 'property-value manual-property-value',
            dataset: { status: 'pending' }
        });
        
        const textSpan = createElement('span', {
            className: 'value-text'
        }, defaultValue || 'Click to set value');
        
        const statusSpan = createElement('span', {
            className: 'value-status'
        }, manualProp.isRequired ? 'Required - click to set' : 'Click to reconcile');
        
        valueDiv.appendChild(textSpan);
        valueDiv.appendChild(statusSpan);
        
        // Add click handler for manual property reconciliation
        const clickHandler = () => {
            openReconciliationModal(itemId, propertyId, 0, defaultValue, manualProp);
        };
        
        valueDiv.addEventListener('click', clickHandler);
        
        td.appendChild(valueDiv);
        
        return td;
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
            // Reconciliation complete - no alert needed
            // Calculate current progress from actual reconciliation data and update state
            if (reconciliationData && Object.keys(reconciliationData).length > 0) {
                const progress = calculateCurrentProgress();
                state.updateState('reconciliationProgress', progress);
            }
            updateProceedButton();
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
     * Enhanced with constraint information display
     */
    async function createReconciliationModalContent(itemId, property, valueIndex, value) {
        // Get property metadata from reconciliation data if available
        let propertyObj = null;
        if (itemId && reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            
            // Get property object from stored metadata
            if (propData.propertyMetadata) {
                propertyObj = propData.propertyMetadata;
            } else if (propData.manualPropertyData) {
                // For manual properties, use the property data
                propertyObj = propData.manualPropertyData.property;
            }
        }
        
        // Detect property type for dynamic input fields
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        
        // Get property information for display (now async)
        const propertyInfo = await getPropertyDisplayInfo(property);
        const originalKeyInfo = getOriginalKeyInfo(itemId, property);
        const itemTitle = reconciliationData[itemId]?.originalData?.['o:title'] || `Item ${itemId.replace('item-', '')}`;
        
        // Get constraint information for display
        const constraintInfo = propertyObj ? getConstraintSummary(propertyObj) : null;
        
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
                    <p class="property-description">
                        ${propertyInfo.description}
                        <a href="https://www.wikidata.org/wiki/Help:Description" target="_blank" class="help-link" title="Learn about Wikidata descriptions">
                            <span class="help-icon">ⓘ</span>
                        </a>
                    </p>
                    
                    ${constraintInfo && constraintInfo.hasConstraints ? `
                    <!-- Property Constraints Information -->
                    <div class="property-constraints">
                        <div class="constraint-info-notice">
                            Property constraints from Wikidata:
                        </div>
                        ${constraintInfo.datatype ? `
                        <div class="constraint-datatype">
                            <strong>Expects:</strong> ${constraintInfo.datatype}
                        </div>
                        ` : ''}
                        ${constraintInfo.valueTypes.length > 0 ? `
                        <div class="constraint-value-types">
                            <strong>Must be:</strong> ${constraintInfo.valueTypes.join(', ')}
                        </div>
                        ` : ''}
                        ${constraintInfo.formatRequirements.length > 0 ? `
                        <div class="constraint-format">
                            <strong>Format:</strong> ${constraintInfo.formatRequirements.join('; ')}
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                    
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
                
                <!-- Use as String Option -->
                <div class="use-as-string-option" style="margin-top: 20px; text-align: center;">
                    <button class="btn primary" onclick="useCurrentValueAsString()" style="background-color: #4CAF50; color: white;">
                        📝 Use as String
                    </button>
                    <p style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        Use the original value as a string instead of linking to Wikidata
                    </p>
                </div>
                
                <!-- Ignore Option -->
                <div class="ignore-option" style="margin-top: 20px; text-align: center;">
                    <button class="btn secondary" onclick="ignoreCurrentValue()" style="background-color: #f44336; color: white;">
                        🚫 Ignore This Value
                    </button>
                    <p style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        This value will be skipped and not included in the final mapping
                    </p>
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
     * Get the correct Wikidata URL for a property based on its type
     */
    function getWikidataUrlForProperty(property) {
        const label = property.label?.toLowerCase();
        
        // Special cases for core Wikidata concepts
        if (label === 'label') {
            return 'https://www.wikidata.org/wiki/Help:Label';
        }
        if (label === 'description') {
            return 'https://www.wikidata.org/wiki/Help:Description';
        }
        if (label === 'aliases' || label === 'alias') {
            return 'https://www.wikidata.org/wiki/Help:Aliases';
        }
        
        // For regular properties, use the property page
        return `https://www.wikidata.org/wiki/Property:${property.id}`;
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
            if (propertyType === 'time' || isDateValue(value)) {
                // For date properties, show date input interface directly
                matchesDisplay.innerHTML = '<p>Date/time property - use the date input below.</p>';
                matchesDisplay.style.display = 'block';
                showCustomInputInterface(propertyType, value);
            } else {
                matchesDisplay.innerHTML = '<p>Non-Wikidata property - use manual input section below.</p>';
                matchesDisplay.style.display = 'block';
            }
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
        displayMatches.forEach((match, index) => {
            console.log('Match data:', {
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
        const div = createElement('div');
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
        
        // Show the container
        container.style.display = 'block';
        
        // Setup date precision for date inputs
        if (propertyType === 'time') {
            setTimeout(() => {
                const dateInput = container.querySelector('.flexible-date-input');
                if (dateInput) {
                    setupDynamicDatePrecision(dateInput);
                }
            }, 100);
        }
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
     * Enhanced with constraint-based validation and property metadata
     */
    async function performAutomaticReconciliation(value, property, itemId, valueIndex) {
        // Get property metadata from reconciliation data if available
        let propertyObj = null;
        let propData = null;
        
        if (itemId && reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            propData = reconciliationData[itemId].properties[property];
            
            // Get property object from stored metadata
            if (propData.propertyMetadata) {
                propertyObj = propData.propertyMetadata;
            } else if (propData.manualPropertyData) {
                // For manual properties, use the property data
                propertyObj = propData.manualPropertyData.property;
            }
        }
        
        // Check if this property type requires reconciliation
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        
        // For date properties, skip reconciliation and show date input directly
        if (propertyType === 'time' || isDateValue(value)) {
            displayReconciliationResults([], propertyType, value);
            return;
        }
        
        try {
            let matches = [];
            let hasBeenReconciled = false;
            
            // Check if we already have reconciliation data from batch reconciliation
            if (propData && propData.reconciled[valueIndex]) {
                const reconciledData = propData.reconciled[valueIndex];
                
                // Check if reconciliation has been attempted (regardless of results)
                if (reconciledData.matches !== undefined) {
                    hasBeenReconciled = true;
                    matches = reconciledData.matches || [];
                }
            }
            
            // Only fetch new matches if reconciliation has never been attempted
            if (!hasBeenReconciled) {
                
                // Validate against format constraints before making API calls
                if (propertyObj) {
                    const formatValidation = validateAgainstFormatConstraints(value, propertyObj);
                    if (!formatValidation.isValid) {
                        console.warn(`⚠️ Format constraint violation for ${propertyObj.id}:`, formatValidation.violations);
                        // Still proceed with reconciliation but log the issue
                    }
                }
                
                // Get all mapped keys for contextual property building
                const currentState = state.getState();
                const allMappings = currentState.mappings?.mappedKeys || [];
                
                // Try reconciliation API first with property object and context
                matches = await tryReconciliationApi(value, propertyObj || property, allMappings);
                
                // If no good matches, try direct Wikidata search
                if (!matches || matches.length === 0) {
                    matches = await tryDirectWikidataSearch(value);
                }
                
                // Store matches (even if empty) to track that reconciliation was attempted
                if (itemId && valueIndex !== undefined) {
                    if (matches && matches.length > 0) {
                        storeAllMatches({ itemId, property, valueIndex }, matches, matches[0]);
                    } else {
                        storeEmptyMatches({ itemId, property, valueIndex });
                    }
                }
            } else {
            }
            
            // Check for 100% confidence auto-selection (Q&A requirement)
            if (matches && matches.length > 0 && matches[0].score >= 100) {
                
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
     * Enhanced with constraint-based type filtering and contextual properties
     */
    async function tryReconciliationApi(value, propertyObj, allMappings = []) {
        // Primary endpoint - wikidata.reconci.link
        const primaryApiUrl = 'https://wikidata.reconci.link/en/api';
        // Fallback endpoint - tools.wmflabs.org
        const fallbackApiUrl = 'https://tools.wmflabs.org/openrefine-wikidata/en/api';
        
        // Get constraint-based entity types (falls back to heuristic if no constraints)
        const entityTypes = getConstraintBasedTypes(propertyObj);
        
        // Build contextual properties for better disambiguation
        const contextualProperties = buildContextualProperties(propertyObj, allMappings);
        
        const query = {
            queries: {
                q1: {
                    query: value,
                    type: entityTypes,
                    properties: contextualProperties
                }
            }
        };
        
        const requestBody = "queries=" + encodeURIComponent(JSON.stringify(query.queries));
        
        // Try primary endpoint first
        try {
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
            
            const data = await response.json();
            return parseReconciliationResults(data, value, propertyObj);
            
        } catch (primaryError) {
            console.warn(`⚠️ Primary reconciliation API failed for "${value}":`, primaryError.message);
            
            // Try fallback endpoint
            try {
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
                
                const data = await response.json();
                return parseReconciliationResults(data, value, propertyObj);
                
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
     * Parse reconciliation API results with constraint-based scoring
     */
    function parseReconciliationResults(data, value, propertyObj) {
        if (data.q1 && data.q1.result) {
            return data.q1.result.map(match => {
                // Create base match object
                const baseMatch = {
                    id: match.id,
                    name: match.name || match.label || 'Unnamed item',
                    description: match.description || match.desc || 'No description available',
                    score: match.score || 0,
                    type: match.type || [],
                    source: 'reconciliation'
                };
                
                // Apply constraint-based scoring if property object available
                if (propertyObj) {
                    return scoreMatchWithConstraints(baseMatch, propertyObj, value);
                }
                
                return baseMatch;
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
    function restoreReconciliationDisplay(data, mappedKeys, manualProperties = []) {
        
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
    
    window.ignoreCurrentValue = function() {
        if (currentReconciliationCell) {
            markCellAsSkipped(currentReconciliationCell);
            modalUI.closeModal();
            
            // Auto-advance if enabled
            if (getAutoAdvanceSetting()) {
                setTimeout(() => {
                    reconcileNextUnprocessedCell();
                }, 300);
            }
        }
    };
    
    window.useCurrentValueAsString = function() {
        if (currentReconciliationCell) {
            markCellAsString(currentReconciliationCell);
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
        state.incrementReconciliationCompleted();
        updateProceedButton();
        
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
        state.incrementReconciliationSkipped();
        updateProceedButton();
        
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
        state.incrementReconciliationCompleted();
        updateProceedButton();
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
    }
    
    /**
     * Mark a cell as using the original value as a string
     */
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
                        } else if (reconciliation.type === 'string') {
                            statusSpan.textContent = '✓ String value';
                            statusSpan.title = `Using original value as string: "${reconciliation.value}"`;
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
        
        // Check DOM elements
        
        // Check state
        const currentState = state.getState();
        
        // Check reconciliation data
        
        
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
        
    };
    
    // Return public API if needed
    return {
        debugReconciliationStep,
        loadMockDataForTesting,
        initializeReconciliation
    };
}