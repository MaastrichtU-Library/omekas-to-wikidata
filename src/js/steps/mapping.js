/**
 * Handles the Mapping step functionality - the core property mapping interface
 * 
 * This module provides the interactive UI for mapping Omeka S metadata fields
 * to equivalent Wikidata properties. It serves as a slim orchestrator that
 * coordinates all mapping functionality through modular components.
 * 
 * @module mapping
 */
import { eventSystem } from '../events.js';
import { showMessage, createElement, createListItem, createDownloadLink } from '../ui/components.js';
import { getCompletePropertyData } from '../api/wikidata.js';
import { BLOCK_TYPES, BLOCK_METADATA, createTransformationBlock, getTransformationPreview, extractAllFields, searchFields, COMMON_REGEX_PATTERNS } from '../transformations.js';
import { 
    fetchContextDefinitions, 
    convertCamelCaseToSpaces, 
    extractSampleValue, 
    extractAndAnalyzeKeys,
    extractAvailableFields,
    getFieldValueFromSample,
    convertSampleValueToString 
} from '../mapping/core/data-analyzer.js';
import { 
    generateMappingData,
    downloadMappingAsJson,
    loadMappingFromData 
} from '../mapping/core/mapping-persistence.js';
import { 
    displayPropertyConstraints,
    createConstraintsSection,
    createCompactConstraint,
    formatValueTypeConstraintsCompact,
    formatFormatConstraintsCompact,
    formatOtherConstraintsCompact 
} from '../mapping/core/constraint-validator.js';
import { 
    setupUnifiedPropertySearch,
    searchUnifiedWikidataProperties,
    displayUnifiedPropertySuggestions,
    selectUnifiedProperty,
    setupPropertySearch,
    searchWikidataProperties,
    getAutoSuggestions,
    displayPropertySuggestions,
    createPropertySuggestionItem,
    selectProperty,
    transitionToDataTypeConfiguration,
    displayDataTypeConfiguration 
} from '../mapping/core/property-searcher.js';
import { 
    refreshTransformationFieldPreview,
    renderValueTransformationUI,
    renderTransformationBlocks,
    renderTransformationBlockUI,
    renderBlockConfigUI,
    renderPrefixSuffixConfigUI,
    renderFindReplaceConfigUI,
    renderComposeConfigUI,
    renderRegexConfigUI,
    updateFieldSearchResults,
    addTransformationBlock,
    updateTransformationPreview,
    refreshTransformationUI,
    addDragHandlers,
    refreshStage3TransformationUI 
} from '../mapping/core/transformation-engine.js';
import { 
    populateLists,
    updateSectionCounts,
    populateKeyList,
    populateManualPropertiesList,
    moveKeyToCategory,
    mapKeyToProperty,
    moveToNextUnmappedKey 
} from '../mapping/ui/mapping-lists.js';
import { 
    openMappingModal,
    openManualPropertyEditModal,
    openAddManualPropertyModal,
    createMappingModalContent,
    createUnifiedPropertyModalContent,
    openRawJsonModal 
} from '../mapping/ui/property-modals.js';
import { initializeEntitySchemaSelector } from '../entity-schemas/entity-schema-selector.js';

/**
 * Initializes the mapping step interface and sets up all event handlers
 * 
 * This is the main entry point for the mapping functionality. It coordinates:
 * - DOM element initialization and event binding
 * - State synchronization when navigating to this step
 * - File import/export functionality for mapping configurations
 * - Integration with the broader application workflow
 * 
 * @param {Object} state - Application state management instance
 * @param {Function} state.updateState - Updates application state
 * @param {Function} state.getState - Retrieves current state
 * @param {Function} state.markChangesUnsaved - Marks changes as unsaved
 * 
 * @description
 * The mapping step appears as step 2 in the workflow and requires:
 * - Valid Omeka S data from step 1 (input validation)
 * - User selection of a Wikidata entity schema (Q-identifier)
 * - Interactive mapping of all discovered properties to Wikidata equivalents
 */
export function setupMappingStep(state) {
    // Store state globally for access in modal functions
    window.mappingStepState = state;
    
    // Initialize DOM elements
    const addManualPropertyBtn = document.getElementById('add-manual-property');
    const loadMappingBtn = document.getElementById('load-mapping');
    const saveMappingBtn = document.getElementById('save-mapping');
    const loadMappingFileInput = document.getElementById('load-mapping-file');
    
    // Initialize Entity Schema selector
    const selectorContainer = document.getElementById('entity-schema-selector-container');
    if (selectorContainer) {
        const selector = initializeEntitySchemaSelector(state);
        selectorContainer.appendChild(selector);
        
        // Listen for Entity Schema selection events
        eventSystem.subscribe('entitySchemaSelected', (data) => {
            console.log('Entity Schema selected:', data.schema);
            // Additional logic can be added here when schema is selected
        });
    }
    
    // Listen for step changes via event system
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 2) {
            setTimeout(() => populateLists(state), 100);
        }
    });
    
    // When we enter this step, populate the lists
    document.addEventListener('DOMContentLoaded', () => {
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 2) {
                    setTimeout(() => populateLists(state), 100);
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-mapping')?.addEventListener('click', () => {
            setTimeout(() => populateLists(state), 100);
        });
        
        // Check if we're already on step 2 and have data
        if (state.getCurrentStep && state.getCurrentStep() === 2) {
            setTimeout(() => populateLists(state), 100);
        }
    });
    
    // Load mapping functionality
    if (loadMappingBtn && loadMappingFileInput) {
        loadMappingBtn.addEventListener('click', () => {
            loadMappingFileInput.click();
        });
        
        loadMappingFileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const mappingData = JSON.parse(text);
                
                await loadMappingFromData(mappingData, state);
                showMessage('Mapping loaded successfully', 'success', 3000);
                
                // Reset the file input
                event.target.value = '';
                
            } catch (error) {
                console.error('Error loading mapping file:', error);
                showMessage('Error loading mapping file: ' + error.message, 'error', 5000);
            }
        });
    }
    
    // Save mapping functionality
    if (saveMappingBtn) {
        saveMappingBtn.addEventListener('click', () => {
            const mappingData = generateMappingData(state);
            downloadMappingAsJson(mappingData);
            showMessage('Mapping file downloaded', 'success', 3000);
        });
    }
    
    // Add manual property functionality
    if (addManualPropertyBtn) {
        addManualPropertyBtn.addEventListener('click', () => {
            openAddManualPropertyModal();
        });
    }
    
    // Export functions globally for use by other modules
    window.openMappingModal = openMappingModal;
    window.openManualPropertyEditModal = openManualPropertyEditModal;
}