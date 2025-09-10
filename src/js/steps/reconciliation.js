/**
 * Handles the Reconciliation step functionality - the core entity matching engine
 * 
 * This module implements sophisticated algorithms for matching Omeka S property values
 * to appropriate Wikidata entities. The reconciliation process is critical because it
 * determines the quality and accuracy of the final Wikidata import.
 * 
 * The system implements an OpenRefine-inspired reconciliation workflow with:
 * - Automatic entity matching using multiple scoring algorithms
 * - Constraint-based validation against Wikidata property requirements  
 * - Interactive modal interface for manual review and selection
 * - Context-aware suggestions based on related properties and values
 * - Batch processing with auto-acceptance for high-confidence matches
 * 
 * Reconciliation Quality Factors:
 * - Label similarity scoring (fuzzy matching, alias matching)
 * - Type constraint validation (must match expected entity types)
 * - Description relevance (semantic similarity)
 * - Contextual consistency (matches related properties)
 * 
 * The reconciliation data structure stores match results, confidence scores,
 * and user decisions to support both automatic processing and manual review.
 * 
 * @module reconciliation
 */

import { setupModalUI } from '../ui/modal-ui.js';
import { detectPropertyType, getInputFieldConfig, createInputHTML, validateInput, getSuggestedEntityTypes, setupDynamicDatePrecision, standardizeDateInput } from '../utils/property-types.js';
import { getConstraintBasedTypes, buildContextualProperties, validateAgainstFormatConstraints, scoreMatchWithConstraints, getConstraintSummary } from '../utils/constraint-helpers.js';
import { eventSystem } from '../events.js';
import { getMockItemsData, getMockMappingData } from '../data/mock-data.js';
import { createElement } from '../ui/components.js';
import { 
    calculateTotalReconciliableCells, 
    extractPropertyValues, 
    combineAndSortProperties,
    createMockDataLoader,
    createOriginalKeyInfoGetter,
    generateLodUri,
    createReconciliationRequirementReasonGetter
} from '../reconciliation/core/reconciliation-data.js';
import {
    createProgressCalculator,
    createProceedButtonUpdater,
    createMatchesStorer,
    createEmptyMatchesStorer,
    updateCellQueueStatus,
    createCellMarkers
} from '../reconciliation/core/reconciliation-progress.js';
import {
    isDateValue,
    escapeHtml,
    createAutomaticReconciliation,
    tryReconciliationApi,
    parseReconciliationResults,
    tryDirectWikidataSearch
} from '../reconciliation/core/entity-matcher.js';
import {
    createBatchAutoAcceptanceProcessor,
    createNextUnprocessedCellReconciler,
    createAutoAdvanceSettingGetter,
    createAutoAdvanceToggleSetup
} from '../reconciliation/core/batch-processor.js';
import {
    updateCellLoadingState,
    updateCellDisplayAsNoMatches,
    updateCellDisplayWithMatch,
    updateCellDisplay,
    createPropertyCellFactory,
    createManualPropertyCellFactory,
    createReconciliationTableFactory,
    createRestoreReconciliationDisplayFactory
} from '../reconciliation/ui/reconciliation-table.js';

/**
 * Initializes the reconciliation step interface and processing engine
 * 
 * This is the main orchestrator for the reconciliation workflow. It sets up:
 * - Event handlers for step navigation and UI interactions
 * - Modal interface for detailed entity selection and review
 * - Batch processing controls and progress tracking
 * - Integration with constraint validation and type detection systems
 * 
 * The reconciliation step appears as step 3 in the workflow and requires:
 * - Completed property mappings from step 2
 * - Valid Wikidata property constraints and type information
 * - Omeka S data with values ready for entity matching
 * 
 * @param {Object} state - Application state management instance
 * @param {Function} state.getState - Retrieves current application state
 * @param {Function} state.setCurrentStep - Changes active workflow step
 * @param {Object} state.reconciliationData - Stores match results and decisions
 * 
 * @description
 * Reconciliation workflow stages:
 * 1. Initialize reconciliation data structures from mapped properties
 * 2. Calculate total reconciliable cells for progress tracking
 * 3. Process cells in batches with automatic matching and scoring
 * 4. Present ambiguous matches to user for manual resolution
 * 5. Apply constraint validation to ensure Wikidata compliance
 * 6. Prepare final reconciliation data for export step
 */
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
    // Core data structures that drive the reconciliation process
    let reconciliationData = {};  // Stores match results by item ID and property
    let currentReconciliationCell = null;  // Tracks which cell is being processed
    
    // Context-aware suggestion system
    // Learns from user selections to improve future suggestions
    let contextSuggestions = new Map(); // Maps property values to previously accepted entities
    
    // Auto-advance setting for batch processing efficiency
    // When enabled, high-confidence matches proceed automatically without user review
    let autoAdvanceSetting = true; // Default to auto-advance enabled
    
    // Set up factory functions for data processing functions that need access to local variables
    const loadMockDataForTesting = createMockDataLoader(state, initializeReconciliation);
    let getOriginalKeyInfo; // Will be initialized after getPropertyDisplayInfo is defined
    let getReconciliationRequirementReason; // Will be initialized after getPropertyDisplayInfo is defined
    
    // Set up progress factory functions
    let calculateCurrentProgress;
    let updateProceedButton;
    let storeAllMatches;
    let storeEmptyMatches;
    let markCellAsReconciled;
    let markCellAsSkipped;
    let markCellAsNoItem;
    let markCellAsString;
    
    // Set up entity matcher factory functions
    let performAutomaticReconciliation;
    
    // Set up batch processor factory functions
    let performBatchAutoAcceptance;
    let reconcileNextUnprocessedCell;
    let getAutoAdvanceSetting;
    let setupAutoAdvanceToggle;
    
    // Set up table UI factory functions
    let createReconciliationTable;
    let createPropertyCell;
    let createManualPropertyCell;
    let restoreReconciliationDisplay;
    
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
     * Initializes the reconciliation interface and processes all reconcilable data
     * 
     * This is the main orchestration function that sets up the complete reconciliation
     * workflow. It analyzes the current application state, processes mapped properties,
     * and creates the interactive table interface for entity matching.
     * 
     * The function handles complex data preparation including:
     * - Validation of mapping completeness and data availability
     * - Calculation of total reconciliable cells for progress tracking
     * - Integration of manual properties with mapped properties
     * - Generation of the reconciliation table with interactive controls
     * 
     * @returns {Promise<void>} Resolves when reconciliation interface is fully initialized
     * 
     * @throws {Error} When required data or mappings are missing or invalid
     * 
     * @description
     * Initialization sequence:
     * 1. Validates current state has required data and mappings
     * 2. Merges mapped properties from step 2 with manual properties
     * 3. Calculates total reconciliable cells for progress tracking
     * 4. Creates interactive reconciliation table with all property columns
     * 5. Initializes progress tracking and status indicators
     * 6. Sets up event handlers for batch processing and navigation
     * 
     * The function gracefully handles edge cases like missing data or empty mappings
     * by displaying appropriate user guidance and preventing erroneous processing.
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
     * Calculates total reconciliable cells for accurate progress tracking
     * 
     * This function performs sophisticated analysis of the data structure to determine
     * exactly how many individual property values need reconciliation. The calculation
     * is critical for:
     * - Accurate progress reporting during batch processing
     * - Resource planning and performance estimation
     * - User expectation management for large datasets
     * 
     * The counting logic handles complex Omeka S data structures including:
     * - Multi-value properties (arrays of values)
     * - Nested object structures with different value representations
     * - Manual properties that apply to every item
     * - Empty or missing values that should be skipped
     * 
     * @param {Array} data - Array of Omeka S items to process
     * @param {Array} mappedKeys - Properties mapped to Wikidata in step 2
     * @param {Array} manualProperties - Additional properties added manually
     * @returns {number} Total number of individual cells requiring reconciliation
     * 
     * @example
     * // For 10 items with 3 mapped properties (2 single-value, 1 multi-value avg 3 values)
     * // Plus 2 manual properties:
     * // Total = 10 * (1 + 1 + 3 + 2) = 70 reconciliable cells
     * 
     * @description
     * Counting methodology:
     * - Each single property value = 1 reconciliable cell
     * - Multi-value properties contribute multiple cells per item
     * - Manual properties contribute 1 cell per item (regardless of current values)
     * - Missing or empty values are excluded from the count
     */
    
    
    
    /**
     * Create the reconciliation table interface
     */
    // [REMOVED] Moved to reconciliation-table.js module
    
    /**
     * Perform batch auto-acceptance for all values in the table
     */
    // [REMOVED] Moved to batch-processor.js module
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

    

    /**
     * Update cell loading state
     */
    // [REMOVED] Moved to reconciliation-table.js module
    
    // [REMOVED] Moved to reconciliation-table.js module

    // [REMOVED] Moved to reconciliation-table.js module
    
    // [REMOVED] Moved to reconciliation-table.js module
    
    // [REMOVED] Moved to reconciliation-table.js module
    
    // [REMOVED] Moved to reconciliation-table.js module

    /**
     * Calculate current progress from reconciliation data
     */
    
    
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
    
    // Initialize factory functions that depend on getPropertyDisplayInfo
    getOriginalKeyInfo = createOriginalKeyInfoGetter(reconciliationData, state);
    getReconciliationRequirementReason = createReconciliationRequirementReasonGetter(state, getPropertyDisplayInfo);
    
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
    
    /**
     * [REMOVED] Moved to entity-matcher.js module
     */
    
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
    
    // Initialize entity matcher factory function after all dependencies are defined
    performAutomaticReconciliation = createAutomaticReconciliation({
        reconciliationData,
        state,
        storeAllMatches,
        storeEmptyMatches,
        displayReconciliationResults,
        displayReconciliationError,
        markCellAsReconciled,
        modalUI,
        currentReconciliationCell,
        getAutoAdvanceSetting,
        reconcileNextUnprocessedCell
    });
    
    // Initialize batch processor factory functions
    performBatchAutoAcceptance = createBatchAutoAcceptanceProcessor({
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
    });
    
    reconcileNextUnprocessedCell = createNextUnprocessedCellReconciler({
        calculateCurrentProgress,
        state,
        updateProceedButton,
        reconciliationData
    });
    
    getAutoAdvanceSetting = createAutoAdvanceSettingGetter(autoAdvanceSetting);
    setupAutoAdvanceToggle = createAutoAdvanceToggleSetup(autoAdvanceSetting);
    
    // Initialize table UI factory functions
    restoreReconciliationDisplay = createRestoreReconciliationDisplayFactory(reconciliationData);
    
    createReconciliationTable = createReconciliationTableFactory({
        propertyHeaders,
        reconciliationRows,
        getWikidataUrlForProperty,
        performBatchAutoAcceptance,
        restoreReconciliationDisplay,
        openReconciliationModal
    });
    
    createPropertyCell = createPropertyCellFactory(openReconciliationModal);
    createManualPropertyCell = createManualPropertyCellFactory(openReconciliationModal);
    
    /**
     * Restore reconciliation display states when returning to the step
     */
    // [REMOVED] Moved to reconciliation-table.js module
    
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
    
    /**
     * Update cell display based on reconciliation status
     */
    // [REMOVED] Moved to reconciliation-table.js module
    
    // Initialize progress factory functions after updateCellDisplay is defined
    calculateCurrentProgress = createProgressCalculator(reconciliationData);
    updateProceedButton = createProceedButtonUpdater(proceedToDesignerBtn, state);
    storeAllMatches = createMatchesStorer(reconciliationData, state, updateCellDisplayWithMatch);
    storeEmptyMatches = createEmptyMatchesStorer(reconciliationData, state);
    const cellMarkers = createCellMarkers(reconciliationData, state, updateCellDisplay, updateProceedButton, contextSuggestions);
    markCellAsReconciled = cellMarkers.markCellAsReconciled;
    markCellAsSkipped = cellMarkers.markCellAsSkipped;
    markCellAsNoItem = cellMarkers.markCellAsNoItem;
    markCellAsString = cellMarkers.markCellAsString;
    
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