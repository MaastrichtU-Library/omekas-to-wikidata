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
    // Core data processing
    calculateTotalReconciliableCells, 
    extractPropertyValues, 
    combineAndSortProperties,
    createMockDataLoader,
    createOriginalKeyInfoGetter,
    generateLodUri,
    createReconciliationRequirementReasonGetter,
    validateReconciliationRequirements,
    initializeReconciliationDataStructure,
    
    // Progress tracking
    createProgressCalculator,
    createProceedButtonUpdater,
    createMatchesStorer,
    createEmptyMatchesStorer,
    updateCellQueueStatus,
    createCellMarkers,
    
    // Entity matching
    isDateValue,
    escapeHtml,
    createAutomaticReconciliation,
    tryReconciliationApi,
    parseReconciliationResults,
    tryDirectWikidataSearch,
    
    // Batch processing
    createBatchAutoAcceptanceProcessor,
    createNextUnprocessedCellReconciler,
    createAutoAdvanceSettingGetter,
    createAutoAdvanceToggleSetup,
    
    // Table UI
    updateCellLoadingState,
    updateCellDisplayAsNoMatches,
    updateCellDisplayWithMatch,
    updateCellDisplay,
    createPropertyCellFactory,
    createManualPropertyCellFactory,
    createReconciliationTableFactory,
    createRestoreReconciliationDisplayFactory,
    
    // Modal UI
    displayReconciliationResults,
    displayHighConfidenceMatches,
    displayFallbackOptions,
    showCustomInputInterface,
    setupManualSearchInFallback,
    displayFallbackSearchResults,
    setupExpandedSearch,
    setupManualSearch,
    createOpenReconciliationModalFactory,
    createReconciliationModalContentFactory,
    createModalInteractionHandlers,
    
    // Display utilities
    createGetPropertyDisplayInfoFactory,
    fetchWikidataPropertyInfo,
    generateMockPid,
    getPropertyDescription,
    getWikidataUrlForProperty,
    displayAutomaticMatches,
    displayReconciliationError
} from '../reconciliation/index.js';

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
    
    // Initialize all reconciliation modules (consolidated initialization)
    const modules = initializeAllReconciliationModules();
    
    function initializeAllReconciliationModules() {
        // Data processing functions
        const loadMockDataForTesting = createMockDataLoader(state, initializeReconciliation);
        const getPropertyDisplayInfo = createGetPropertyDisplayInfoFactory(state);
        const getOriginalKeyInfo = createOriginalKeyInfoGetter(reconciliationData, state);
        const getReconciliationRequirementReason = createReconciliationRequirementReasonGetter(state, getPropertyDisplayInfo);
        
        // Entity matching functions
        const performAutomaticReconciliation = createAutomaticReconciliation({
            reconciliationData,
            state,
            storeAllMatches: null, // Will be set after progress functions
            storeEmptyMatches: null, // Will be set after progress functions
            displayReconciliationResults,
            displayReconciliationError,
            markCellAsReconciled: null, // Will be set after progress functions
            modalUI,
            currentReconciliationCell,
            getAutoAdvanceSetting: () => autoAdvanceSetting,
            reconcileNextUnprocessedCell: null // Will be set later
        });
        
        // Progress and state management functions
        const calculateCurrentProgress = createProgressCalculator(reconciliationData);
        const updateProceedButton = createProceedButtonUpdater(proceedToDesignerBtn, state);
        const storeAllMatches = createMatchesStorer(reconciliationData, state, updateCellDisplayWithMatch);
        const storeEmptyMatches = createEmptyMatchesStorer(reconciliationData, state);
        const cellMarkers = createCellMarkers(reconciliationData, state, updateCellDisplay, updateProceedButton, contextSuggestions);
        
        // Batch processing functions
        const performBatchAutoAcceptance = createBatchAutoAcceptanceProcessor({
            extractPropertyValues,
            markCellAsReconciled: cellMarkers.markCellAsReconciled,
            storeAllMatches,
            storeEmptyMatches,
            updateCellQueueStatus,
            updateCellLoadingState,
            updateCellDisplayAsNoMatches,
            updateProceedButton,
            reconciliationData,
            state
        });
        
        const reconcileNextUnprocessedCell = createNextUnprocessedCellReconciler({
            calculateCurrentProgress,
            state,
            updateProceedButton,
            reconciliationData
        });
        
        // Modal functions
        const createReconciliationModalContent = createReconciliationModalContentFactory({
            reconciliationData,
            getPropertyDisplayInfo,
            getOriginalKeyInfo,
            getReconciliationRequirementReason,
            getConstraintSummary
        });
        
        const openReconciliationModal = createOpenReconciliationModalFactory({
            modalUI,
            performAutomaticReconciliation,
            setupDynamicDatePrecision,
            setupAutoAdvanceToggle: () => setupAutoAdvanceToggle(),
            createReconciliationModalContent
        });
        
        // Table UI functions
        const restoreReconciliationDisplay = createRestoreReconciliationDisplayFactory(reconciliationData);
        const createReconciliationTable = createReconciliationTableFactory({
            propertyHeaders,
            reconciliationRows,
            getWikidataUrlForProperty,
            performBatchAutoAcceptance,
            restoreReconciliationDisplay,
            openReconciliationModal
        });
        
        const createPropertyCell = createPropertyCellFactory(openReconciliationModal);
        const createManualPropertyCell = createManualPropertyCellFactory(openReconciliationModal);
        
        // Update cross-references
        performAutomaticReconciliation.storeAllMatches = storeAllMatches;
        performAutomaticReconciliation.storeEmptyMatches = storeEmptyMatches;
        performAutomaticReconciliation.markCellAsReconciled = cellMarkers.markCellAsReconciled;
        performAutomaticReconciliation.reconcileNextUnprocessedCell = reconcileNextUnprocessedCell;
        
        return {
            // Data processing
            loadMockDataForTesting,
            getPropertyDisplayInfo,
            getOriginalKeyInfo,
            getReconciliationRequirementReason,
            validateReconciliationRequirements,
            initializeReconciliationDataStructure,
            
            // Progress and state
            calculateCurrentProgress,
            updateProceedButton,
            storeAllMatches,
            storeEmptyMatches,
            markCellAsReconciled: cellMarkers.markCellAsReconciled,
            markCellAsSkipped: cellMarkers.markCellAsSkipped,
            markCellAsNoItem: cellMarkers.markCellAsNoItem,
            markCellAsString: cellMarkers.markCellAsString,
            
            // Entity matching
            performAutomaticReconciliation,
            
            // Batch processing
            performBatchAutoAcceptance,
            reconcileNextUnprocessedCell,
            getAutoAdvanceSetting: () => autoAdvanceSetting,
            setupAutoAdvanceToggle: () => setupAutoAdvanceToggle(),
            
            // Modal UI
            openReconciliationModal,
            createReconciliationModalContent,
            
            // Table UI
            createReconciliationTable,
            createPropertyCell,
            createManualPropertyCell,
            restoreReconciliationDisplay
        };
    }
    
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
            modules.reconcileNextUnprocessedCell();
        });
    }
    
    // Test reconciliation model button for debugging
    if (testReconciliationModelBtn) {
        testReconciliationModelBtn.addEventListener('click', () => {
            modules.loadMockDataForTesting();
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
        
        // Validate reconciliation requirements
        const validation = modules.validateReconciliationRequirements(currentState);
        if (!validation.isValid) {
            console.warn(`❌ ${validation.error}`);
            if (validation.details) {
                console.warn('❌ Details:', validation.details);
            }
            return;
        }
        
        
        
        // Extract data for processing
        const mappedKeys = validation.availableMappedKeys;
        const manualProperties = currentState.mappings.manualProperties || [];
        const data = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
        
        // Check if we already have reconciliation data from a previous session
        let isReturningToStep = false;
        if (currentState.reconciliationData && Object.keys(currentState.reconciliationData).length > 0) {
            // Clear existing data and copy from state (mutate, don't reassign)
            Object.keys(reconciliationData).forEach(key => delete reconciliationData[key]);
            Object.assign(reconciliationData, currentState.reconciliationData);
            isReturningToStep = true;
        } else {
            // Initialize reconciliation progress
            const totalCells = calculateTotalReconciliableCells(data, mappedKeys, manualProperties);
            state.setReconciliationProgress(0, totalCells);
            
            // Initialize reconciliation data structure using extracted function
            const newData = modules.initializeReconciliationDataStructure(data, mappedKeys, manualProperties);
            // Clear existing data and copy new data (mutate, don't reassign)
            Object.keys(reconciliationData).forEach(key => delete reconciliationData[key]);
            Object.assign(reconciliationData, newData);
        }
        
        // Update proceed button
        modules.updateProceedButton();
        
        // Create reconciliation table
        await modules.createReconciliationTable(data, mappedKeys, manualProperties, isReturningToStep);
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
        
        // Calculate and update progress from actual reconciliation data
        if (reconciliationData && Object.keys(reconciliationData).length > 0) {
            const progress = modules.calculateCurrentProgress();
            state.updateState('reconciliationProgress', progress);
        }
        
        // Enable/disable proceed button
        modules.updateProceedButton();
        
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
     * Calculate current progress from reconciliation data
     */
    
    
    
    
    
    
    
    
    // Factory functions are initialized in consolidated modules object
    
    
    
    
    
    
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
    // All factory functions available via modules object
    
    // Set up modal interaction handlers
    const currentReconciliationCellRef = { current: null };
    
    // Update references to use the new ref pattern
    const originalSetCurrentReconciliationCell = (cell) => {
        currentReconciliationCellRef.current = cell;
        currentReconciliationCell = cell;
    };
    
    const modalInteractionHandlers = createModalInteractionHandlers({
        currentReconciliationCell: currentReconciliationCellRef,
        modalUI,
        markCellAsReconciled: modules.markCellAsReconciled,
        markCellAsSkipped: modules.markCellAsSkipped,
        markCellAsNoItem: modules.markCellAsNoItem,
        markCellAsString: modules.markCellAsString,
        getAutoAdvanceSetting: modules.getAutoAdvanceSetting,
        reconcileNextUnprocessedCell: modules.reconcileNextUnprocessedCell,
        setupExpandedSearch
    });
    
    // Expose modal interaction handlers to global scope for HTML onclick handlers
    window.toggleMoreOptions = modalInteractionHandlers.toggleMoreOptions;
    window.selectMatchAndAdvance = modalInteractionHandlers.selectMatchAndAdvance;
    window.confirmCustomValue = modalInteractionHandlers.confirmCustomValue;
    window.skipReconciliation = modalInteractionHandlers.skipReconciliation;
    window.markAsNoWikidataItem = modalInteractionHandlers.markAsNoWikidataItem;
    window.ignoreCurrentValue = modalInteractionHandlers.ignoreCurrentValue;
    window.useCurrentValueAsString = modalInteractionHandlers.useCurrentValueAsString;
    window.createNewWikidataItem = modalInteractionHandlers.createNewWikidataItem;
    window.selectMatch = modalInteractionHandlers.selectMatch;
    window.showAllMatches = modalInteractionHandlers.showAllMatches;
    window.showTopMatches = modalInteractionHandlers.showTopMatches;
    window.selectManualMatch = modalInteractionHandlers.selectManualMatch;
    window.applyTypeOverride = modalInteractionHandlers.applyTypeOverride;
    window.confirmReconciliation = modalInteractionHandlers.confirmReconciliation; // Legacy
    
    
    
    /**
     * Setup expanded search functionality in progressive disclosure
     */
    
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
    
    
    
    
    
    
    
    // ============================================================================
    // New Global Functions for Simplified Modal Interface
    // ============================================================================
    
    
    
    
    
    
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
    
    // Expose debug functions globally for console access
    window.debugReconciliation = debugReconciliationStep;
    window.loadMockReconciliationData = modules.loadMockDataForTesting;
    window.initializeReconciliationManually = initializeReconciliation;
    
    
    // Return public API if needed
    return {
        debugReconciliationStep,
        loadMockDataForTesting: modules.loadMockDataForTesting,
        initializeReconciliation
    };
}