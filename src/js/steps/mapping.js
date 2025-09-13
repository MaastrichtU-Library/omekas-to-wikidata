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
import { 
    createEntitySchemaManager 
} from '../mapping/core/entity-schema.js';

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
    
    // Initialize Entity Schema Manager
    const entitySchemaManager = createEntitySchemaManager(state);
    
    // Initialize DOM elements
    const entitySchemaInput = document.getElementById('entity-schema');
    const entitySchemaSelector = document.querySelector('.entity-schema-selector');
    const addManualPropertyBtn = document.getElementById('add-manual-property');
    const loadMappingBtn = document.getElementById('load-mapping');
    const saveMappingBtn = document.getElementById('save-mapping');
    const loadMappingFileInput = document.getElementById('load-mapping-file');
    
    // Initialize Entity Schema interface
    if (entitySchemaSelector) {
        entitySchemaManager.renderSchemaSelector(entitySchemaSelector);
    }
    
    // Listen for Entity Schema selection events
    eventSystem.subscribe('ENTITY_SCHEMA_SELECTED', (data) => {
        const { schema, properties } = data;
        
        // Update manual properties suggestions based on schema
        updateSchemaPropertySuggestions(schema, properties, state);
        
        // Update property search to prioritize schema properties
        updatePropertySearchWithSchema(schema, properties);
        
        showMessage(`Entity Schema ${schema.id} selected. ${properties.length} properties loaded.`, 'success');
    });
    
    eventSystem.subscribe('ENTITY_SCHEMA_CLEARED', (data) => {
        clearSchemaPropertySuggestions();
        clearPropertySearchSchema();
        showMessage('Entity Schema cleared', 'info');
    });
    
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
    
    // Entity schema input
    if (entitySchemaInput) {
        entitySchemaInput.addEventListener('change', () => {
            state.updateState('entitySchema', entitySchemaInput.value);
            state.markChangesUnsaved();
        });
    }
    
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

/**
 * Update property suggestions based on selected Entity Schema
 */
function updateSchemaPropertySuggestions(schema, properties, state) {
    // Add suggested properties section to manual properties area
    const manualPropertiesSection = document.querySelector('#manual-properties').parentElement;
    
    // Remove existing suggestions
    const existingSuggestions = manualPropertiesSection.querySelector('.schema-property-suggestions');
    if (existingSuggestions) {
        existingSuggestions.remove();
    }
    
    if (properties.length > 0) {
        const suggestionsSection = createElement('div', { className: 'schema-property-suggestions' });
        
        const suggestionsHeader = createElement('div', { className: 'suggestions-header' }, `
            <h4>Entity Schema Properties (${schema.id})</h4>
            <p>Properties from the selected Entity Schema. Click to add to your mapping:</p>
        `);
        suggestionsSection.appendChild(suggestionsHeader);
        
        const suggestionsGrid = createElement('div', { className: 'suggestions-grid' });
        
        // Group properties by required/optional
        const requiredProperties = properties.filter(p => p.required);
        const optionalProperties = properties.filter(p => !p.required);
        
        // Add required properties first
        if (requiredProperties.length > 0) {
            const requiredHeader = createElement('div', { className: 'property-group-header required' }, 'Required Properties');
            suggestionsGrid.appendChild(requiredHeader);
            
            requiredProperties.forEach(property => {
                const suggestion = createPropertySuggestion(property, 'required', state);
                suggestionsGrid.appendChild(suggestion);
            });
        }
        
        // Add optional properties
        if (optionalProperties.length > 0) {
            const optionalHeader = createElement('div', { className: 'property-group-header optional' }, 'Optional Properties');
            suggestionsGrid.appendChild(optionalHeader);
            
            optionalProperties.forEach(property => {
                const suggestion = createPropertySuggestion(property, 'optional', state);
                suggestionsGrid.appendChild(suggestion);
            });
        }
        
        suggestionsSection.appendChild(suggestionsGrid);
        
        // Insert before the manual properties actions
        const actionsDiv = manualPropertiesSection.querySelector('.manual-properties-actions');
        manualPropertiesSection.insertBefore(suggestionsSection, actionsDiv);
    }
}

/**
 * Create a property suggestion element
 */
function createPropertySuggestion(property, type, state) {
    const suggestion = createElement('div', { className: `property-suggestion ${type}` });
    
    // Create elements using createElement instead of innerHTML
    const propertyInfo = createElement('div', { className: 'property-info' });
    const propertyId = createElement('span', { className: 'property-id' }, property.id);
    const propertyStatus = createElement('span', { className: `property-status ${type}` }, type);
    propertyInfo.appendChild(propertyId);
    propertyInfo.appendChild(propertyStatus);
    
    const propertyActions = createElement('div', { className: 'property-actions' });
    const addPropertyBtn = createElement('button', {
        className: 'add-property-btn',
        'data-property-id': property.id,
        'data-type': type
    }, 'Add Property');
    propertyActions.appendChild(addPropertyBtn);
    
    suggestion.appendChild(propertyInfo);
    suggestion.appendChild(propertyActions);
    
    // Add click handler (using variable reference)
    const addBtn = addPropertyBtn;
    addBtn.addEventListener('click', async () => {
        try {
            addBtn.disabled = true;
            addBtn.textContent = 'Adding...';
            
            // Fetch complete property data
            const propertyData = await getCompletePropertyData(property.id);
            
            if (propertyData) {
                // Create manual property object
                const manualProperty = {
                    property: propertyData,
                    defaultValue: '',
                    isRequired: type === 'required',
                    source: 'entity-schema'
                };
                
                // Add to state
                state.addManualProperty(manualProperty);
                
                // Remove suggestion from UI
                suggestion.remove();
                
                showMessage(`Property ${property.id} added from Entity Schema`, 'success');
            } else {
                throw new Error('Failed to fetch property details');
            }
        } catch (error) {
            console.error('Error adding schema property:', error);
            showMessage(`Failed to add property ${property.id}`, 'error');
            addBtn.disabled = false;
            addBtn.textContent = 'Add Property';
        }
    });
    
    return suggestion;
}

/**
 * Clear schema property suggestions
 */
function clearSchemaPropertySuggestions() {
    const suggestions = document.querySelector('.schema-property-suggestions');
    if (suggestions) {
        suggestions.remove();
    }
}

/**
 * Update property search to prioritize schema properties
 */
function updatePropertySearchWithSchema(schema, properties) {
    // Store schema properties globally for property search prioritization
    window.selectedSchemaProperties = properties.map(p => p.id);
    window.selectedSchemaId = schema.id;
}

/**
 * Clear property search schema prioritization
 */
function clearPropertySearchSchema() {
    window.selectedSchemaProperties = null;
    window.selectedSchemaId = null;
}