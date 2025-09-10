/**
 * Handles the Mapping step functionality - the core property mapping interface
 * 
 * This module provides the interactive UI for mapping Omeka S metadata fields
 * to equivalent Wikidata properties. It handles the complex process of:
 * - Analyzing Omeka S JSON-LD data structures and extracting property keys
 * - Resolving JSON-LD context definitions to understand semantic meanings
 * - Providing intelligent property suggestions based on data types and values
 * - Managing the three-category mapping system: non-linked, mapped, and ignored
 * - Supporting manual property additions for comprehensive data modeling
 * 
 * The mapping process is critical because it determines how Omeka S metadata
 * will be represented in Wikidata's semantic structure. Poor mappings result
 * in data loss or semantic inconsistency.
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
    const entitySchemaInput = document.getElementById('entity-schema');
    const nonLinkedKeysList = document.getElementById('non-linked-keys');
    const mappedKeysList = document.getElementById('mapped-keys');
    const ignoredKeysList = document.getElementById('ignored-keys');
    const manualPropertiesList = document.getElementById('manual-properties');
    const addManualPropertyBtn = document.getElementById('add-manual-property');
    const proceedToReconciliationBtn = document.getElementById('proceed-to-reconciliation');
    const testMappingModelBtn = document.getElementById('test-mapping-model');
    const loadMappingBtn = document.getElementById('load-mapping');
    const saveMappingBtn = document.getElementById('save-mapping');
    const loadMappingFileInput = document.getElementById('load-mapping-file');
    
    // Don't set a default entity schema - leave it empty
    // The user should explicitly choose a valid Wikidata Q-identifier
    
    // Listen for step changes via event system
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 2) {
            // Small delay to ensure DOM is ready
            setTimeout(() => populateLists(), 100);
        }
    });
    
    // When we enter this step, populate the lists
    document.addEventListener('DOMContentLoaded', () => {
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 2) {
                    setTimeout(() => populateLists(), 100);
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-mapping')?.addEventListener('click', () => {
            setTimeout(() => populateLists(), 100);
        });
        
        // Check if we're already on step 2 and have data
        if (state.getCurrentStep && state.getCurrentStep() === 2) {
            setTimeout(() => populateLists(), 100);
        }
        
        // Event listener for test modal button is now handled in modals.js
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
                
                // Clear the file input for future use
                event.target.value = '';
                
                // Show success message
                showMessage('Mapping loaded successfully! Restored ' + mappingData.mappings.mapped.length + ' mapped keys and ' + mappingData.mappings.ignored.length + ' ignored keys.', 'success', 5000);
            } catch (error) {
                console.error('Error loading mapping file:', error);
                showMessage('Error loading mapping file. Please check the file format.', 'error', 5000);
            }
        });
    }
    
    // Save mapping functionality
    if (saveMappingBtn) {
        saveMappingBtn.addEventListener('click', () => {
            const mappingData = generateMappingData(state);
            downloadMappingAsJson(mappingData);
        });
    }
    
    // Add manual property functionality
    if (addManualPropertyBtn) {
        addManualPropertyBtn.addEventListener('click', () => {
            openAddManualPropertyModal();
        });
    }
    
    
    
    
    

    /**
     * Populates all mapping interface lists with analyzed property data
     * 
     * This is the main orchestration function that coordinates the entire mapping
     * interface display. It processes the raw Omeka S data and organizes properties
     * into the three-category system that drives the mapping workflow:
     * 
     * Categories:
     * - Non-linked keys: Properties not yet mapped to Wikidata (require user action)
     * - Mapped keys: Properties with confirmed Wikidata mappings (ready for reconciliation)
     * - Ignored keys: Properties excluded from Wikidata export (user decision)
     * 
     * The function also handles automatic property suggestions based on common
     * patterns and previously saved mapping configurations.
     * 
     * @returns {Promise<void>} Resolves when all lists are populated
     * 
     * @description
     * Processing sequence:
     * 1. Retrieves and analyzes raw Omeka S data from application state
     * 2. Extracts all property keys with frequency and context analysis
     * 3. Applies smart categorization based on patterns and user preferences
     * 4. Automatically adds common metadata fields (instance of, labels, descriptions)
     * 5. Updates UI lists with interactive elements for property management
     * 6. Refreshes section counts and navigation state
     * 
     * This function is called whenever:
     * - User navigates to the mapping step
     * - Raw data is updated from input step
     * - Mapping configuration is loaded from file
     */
    async function populateLists() {
        const currentState = state.getState();
        
        if (!currentState.fetchedData) {
            return;
        }
        
        // Analyze all keys from the complete dataset
        const keyAnalysis = await extractAndAnalyzeKeys(currentState.fetchedData);
        
        // Initialize arrays if they don't exist in state
        state.ensureMappingArrays();
        
        // Get updated state after initialization
        const updatedState = state.getState();
        
        // Filter keys that haven't been processed yet
        const processedKeys = new Set([
            ...updatedState.mappings.mappedKeys.map(k => k.key || k),
            ...updatedState.mappings.ignoredKeys.map(k => k.key || k)
        ]);
        
        const newKeys = keyAnalysis.filter(keyObj => !processedKeys.has(keyObj.key));
        
        // Load ignore settings
        let ignorePatterns = ['o:'];
        try {
            const response = await fetch('./config/ignore-keys.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const settings = await response.json();
            ignorePatterns = settings.ignoredKeyPatterns || ['o:'];
        } catch (error) {
        }
        
        // Function to check if key should be ignored
        /**
         * Determines if a property key should be automatically ignored
         * 
         * This function implements business rules for automatic property filtering.
         * Certain technical or system properties are not suitable for Wikidata mapping
         * and should be filtered out to reduce interface complexity.
         * 
         * @param {string} key - Property key to evaluate
         * @returns {boolean} True if key should be automatically ignored
         * 
         * @description
         * Auto-ignore criteria:
         * - JSON-LD system properties (@context, @id, @type)
         * - Omeka system properties (o:id, o:resource_class, etc.)
         * - Internal technical fields not relevant to content description
         */
        const shouldIgnoreKey = (key) => {
            return ignorePatterns.some(pattern => {
                if (pattern.endsWith(':')) {
                    return key.startsWith(pattern);
                } else {
                    return key === pattern;
                }
            });
        };
        
        // Separate keys by type - ignored keys and regular keys
        const ignoredKeys = newKeys.filter(k => shouldIgnoreKey(k.key));
        const regularKeys = newKeys.filter(k => !shouldIgnoreKey(k.key));
        
        // Add ignored keys to ignored list
        const currentIgnoredKeys = [...updatedState.mappings.ignoredKeys, ...ignoredKeys];
        
        // Add regular keys to non-linked keys
        const currentNonLinkedKeys = updatedState.mappings.nonLinkedKeys.filter(k => 
            !keyAnalysis.find(ka => ka.key === (k.key || k))
        );
        const allNonLinkedKeys = [...currentNonLinkedKeys, ...regularKeys];
        
        // Update all mappings atomically
        state.updateMappings(allNonLinkedKeys, updatedState.mappings.mappedKeys, currentIgnoredKeys);
        
        // Get final state for UI update
        const finalState = state.getState();
        
        // Populate the UI lists
        populateKeyList(nonLinkedKeysList, finalState.mappings.nonLinkedKeys, 'non-linked');
        populateKeyList(mappedKeysList, finalState.mappings.mappedKeys, 'mapped');
        populateKeyList(ignoredKeysList, finalState.mappings.ignoredKeys, 'ignored');
        populateManualPropertiesList(manualPropertiesList, finalState.mappings.manualProperties);
        
        // Update section counts
        updateSectionCounts(finalState.mappings);
        
        // Auto-add metadata fields and P31 (instance of) if not already mapped or present as manual property
        autoAddMetadataFields(finalState);
        autoAddInstanceOfProperty(finalState);
        
        // Auto-open mapped keys section if there are mapped keys
        if (finalState.mappings.mappedKeys.length > 0) {
            const mappedKeysList = document.getElementById('mapped-keys');
            if (mappedKeysList) {
                const mappedSection = mappedKeysList.closest('details');
                if (mappedSection) {
                    mappedSection.open = true;
                }
            }
        }
        
        // Always auto-open Extra Wikidata properties and metadata section
        const manualPropertiesListElement = document.getElementById('manual-properties');
        if (manualPropertiesListElement) {
            const manualPropertiesSection = manualPropertiesListElement.closest('details');
            if (manualPropertiesSection) {
                manualPropertiesSection.open = true;
            }
        }
        
        // Enable continue button if there are mapped keys
        if (proceedToReconciliationBtn) {
            proceedToReconciliationBtn.disabled = !finalState.mappings.mappedKeys.length;
        }
    }
    
    // Auto-add metadata fields (label, description, aliases) if not already present
    async function autoAddMetadataFields(currentState) {
        const metadataFields = [
            {
                id: 'label',
                label: 'label',
                description: 'Human-readable name of the item',
                datatype: 'monolingualtext',
                datatypeLabel: 'Monolingual text',
                isMetadata: true
            },
            {
                id: 'description',
                label: 'description',
                description: 'Short description of the item',
                datatype: 'monolingualtext',
                datatypeLabel: 'Monolingual text',
                isMetadata: true
            },
            {
                id: 'aliases',
                label: 'aliases',
                description: 'Alternative names for the item',
                datatype: 'monolingualtext',
                datatypeLabel: 'Monolingual text',
                isMetadata: true
            }
        ];
        
        for (const field of metadataFields) {
            // Check if this metadata field is already in manual properties
            const hasField = currentState.mappings.manualProperties.some(prop => 
                prop.property.id === field.id && prop.property.isMetadata
            );
            
            if (!hasField) {
                const metadataProperty = {
                    property: field,
                    defaultValue: '',
                    isRequired: false,
                    isMetadata: true,
                    cannotRemove: true // Make it non-removable like P31
                };
                
                state.addManualProperty(metadataProperty);
            }
        }
        
        // Refresh the manual properties display
        const manualPropertiesList = document.getElementById('manual-properties');
        if (manualPropertiesList) {
            populateManualPropertiesList(manualPropertiesList, state.getState().mappings.manualProperties);
            updateSectionCounts(state.getState().mappings);
        }
    }
    
    // Auto-add P31 (instance of) if not already mapped or present as manual property
    async function autoAddInstanceOfProperty(currentState) {
        // Check if P31 or P279 is already mapped
        const hasP31Mapped = currentState.mappings.mappedKeys.some(key => 
            key.property && (key.property.id === 'P31' || key.property.id === 'P279')
        );
        
        // Check if P31 or P279 is already in manual properties
        const hasP31Manual = currentState.mappings.manualProperties.some(prop => 
            prop.property.id === 'P31' || prop.property.id === 'P279'
        );
        
        // If neither P31 nor P279 is mapped or manual, auto-add P31
        if (!hasP31Mapped && !hasP31Manual) {
            try {
                // Get complete property data for P31
                const propertyData = await getCompletePropertyData('P31');
                
                const p31Property = {
                    property: {
                        id: 'P31',
                        label: 'instance of',
                        description: 'that class of which this subject is a particular example and member',
                        datatype: 'wikibase-item',
                        datatypeLabel: 'Item',
                        isMetadata: true,
                        ...propertyData
                    },
                    defaultValue: '', // User needs to provide a value
                    isRequired: true,
                    cannotRemove: true // Make it non-removable
                };
                
                state.addManualProperty(p31Property);
                
                // Refresh the manual properties display
                populateManualPropertiesList(manualPropertiesList, state.getState().mappings.manualProperties);
                updateSectionCounts(state.getState().mappings);
                
                // Show message to user
                showMessage('Added required property: instance of (P31). Please set a default value.', 'info', 5000);
                
            } catch (error) {
                console.error('Error auto-adding P31:', error);
                // Fallback to basic P31 without constraints
                const p31Property = {
                    property: {
                        id: 'P31',
                        label: 'instance of',
                        description: 'that class of which this subject is a particular example and member',
                        datatype: 'wikibase-item',
                        datatypeLabel: 'Item',
                        isMetadata: true
                    },
                    defaultValue: '',
                    isRequired: true,
                    cannotRemove: true
                };
                
                state.addManualProperty(p31Property);
                populateManualPropertiesList(manualPropertiesList, state.getState().mappings.manualProperties);
                updateSectionCounts(state.getState().mappings);
                showMessage('Added required property: instance of (P31). Please set a default value.', 'info', 5000);
            }
        }
    }
    
    // Helper function to update section counts in summary headers
    function updateSectionCounts(mappings) {
        const totalKeys = mappings.nonLinkedKeys.length + mappings.mappedKeys.length + mappings.ignoredKeys.length;
        const manualPropertiesCount = mappings.manualProperties?.length || 0;
        
        // Update Manual Properties section (now first)
        const manualPropertiesSection = document.querySelector('.key-sections .section:nth-child(1) summary');
        if (manualPropertiesSection) {
            manualPropertiesSection.innerHTML = `<span class="section-title">Extra Wikidata properties and metadata</span><span class="section-count">(${manualPropertiesCount})</span>`;
        }
        
        // Update Non-linked Keys section (now second)
        const nonLinkedSection = document.querySelector('.key-sections .section:nth-child(2) summary');
        if (nonLinkedSection) {
            nonLinkedSection.innerHTML = `<span class="section-title">Non-linked Keys</span><span class="section-count">(${mappings.nonLinkedKeys.length}/${totalKeys})</span>`;
        }
        
        // Update Mapped Keys section (now third)
        const mappedSection = document.querySelector('.key-sections .section:nth-child(3) summary');
        if (mappedSection) {
            mappedSection.innerHTML = `<span class="section-title">Mapped Keys</span><span class="section-count">(${mappings.mappedKeys.length}/${totalKeys})</span>`;
        }
        
        // Update Ignored Keys section (now fourth)
        const ignoredSection = document.querySelector('.key-sections .section:nth-child(4) summary');
        if (ignoredSection) {
            ignoredSection.innerHTML = `<span class="section-title">Ignored Keys</span><span class="section-count">(${mappings.ignoredKeys.length}/${totalKeys})</span>`;
        }
    }
    
    // Helper function to populate a key list
    function populateKeyList(listElement, keys, type) {
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (!keys.length) {
            const placeholderText = type === 'non-linked'
                ? 'All keys have been processed'
                : type === 'mapped'
                    ? 'No mapped keys yet'
                    : 'No ignored keys';
            const placeholder = createListItem(placeholderText, { isPlaceholder: true });
            listElement.appendChild(placeholder);
            return;
        }
        
        keys.forEach(keyObj => {
            // Handle both string keys (legacy) and key objects
            const keyData = typeof keyObj === 'string' 
                ? { key: keyObj, type: 'unknown', frequency: 1, totalItems: 1 }
                : keyObj;
            
            // Create compact key display
            const keyDisplay = createElement('div', {
                className: keyData.notInCurrentDataset 
                    ? 'key-item-compact not-in-current-dataset'
                    : 'key-item-compact'
            });
            
            const keyName = createElement('span', {
                className: 'key-name-compact'
            }, keyData.key);
            keyDisplay.appendChild(keyName);
            
            // Show property info for mapped keys immediately after key name
            if (type === 'mapped' && keyData.property) {
                const propertyInfo = createElement('span', {
                    className: 'property-info'
                }, ` → ${keyData.property.id}: ${keyData.property.label}`);
                keyDisplay.appendChild(propertyInfo);
            }
            
            // Show frequency information at the end
            if (keyData.frequency && keyData.totalItems) {
                const frequencyIndicator = createElement('span', {
                    className: 'key-frequency'
                }, `(${keyData.frequency}/${keyData.totalItems})`);
                keyDisplay.appendChild(frequencyIndicator);
            } else if (keyData.notInCurrentDataset) {
                // Show indicator for keys not in current dataset
                const notInDatasetIndicator = createElement('span', {
                    className: 'not-in-dataset-indicator'
                }, '(not in current dataset)');
                keyDisplay.appendChild(notInDatasetIndicator);
            }
            
            // Create list item with appropriate options
            const liOptions = {
                className: keyData.notInCurrentDataset 
                    ? 'clickable key-item-clickable-compact not-in-current-dataset disabled'
                    : 'clickable key-item-clickable-compact',
                onClick: !keyData.notInCurrentDataset ? () => openMappingModal(keyData) : null,
                dataset: { key: keyData.key }
            };
            
            if (keyData.notInCurrentDataset) {
                liOptions.title = 'This key is not present in the current dataset';
            }
            
            const li = createListItem(keyDisplay, liOptions);
            
            listElement.appendChild(li);
            
            // Add animation if this is a newly moved item
            if (keyData.isNewlyMoved) {
                li.classList.add('newly-moved');
                setTimeout(() => {
                    li.classList.remove('newly-moved');
                }, 2000);
            }
        });
    }
    
    // Helper function to populate manual properties list
    function populateManualPropertiesList(listElement, manualProperties) {
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (!manualProperties.length) {
            const placeholder = createListItem('No additional properties added yet', { isPlaceholder: true });
            listElement.appendChild(placeholder);
            return;
        }
        
        manualProperties.forEach(manualProp => {
            // Create the main display content using the same pattern as other key lists
            const keyDisplay = createElement('div', {
                className: 'key-item-compact'
            });
            
            // Property name and ID
            const propertyDisplayText = manualProp.property.isMetadata 
                ? `${manualProp.property.label} (metadata)`
                : `${manualProp.property.label} (${manualProp.property.id})`;
            const propertyName = createElement('span', {
                className: 'key-name-compact'
            }, propertyDisplayText);
            keyDisplay.appendChild(propertyName);
            
            // Property info section showing required status
            let infoText = '';
            if (manualProp.isRequired) {
                infoText = 'Required';
            }
            
            const propertyInfo = createElement('span', {
                className: 'property-info'
            }, infoText);
            keyDisplay.appendChild(propertyInfo);
            
            // Remove button styled like frequency badges (only if removable)
            if (!manualProp.cannotRemove) {
                const removeBtn = createElement('button', {
                    className: 'key-frequency remove-manual-property-btn',
                    onClick: (e) => {
                        e.stopPropagation();
                        removeManualPropertyFromUI(manualProp.property.id);
                    },
                    title: 'Remove this additional property'
                }, '×');
                keyDisplay.appendChild(removeBtn);
            }
            
            // Create list item with standard styling and behavior
            const li = createListItem(keyDisplay, {
                className: 'clickable key-item-clickable-compact',
                onClick: () => openManualPropertyEditModal(manualProp),
                title: 'Click to edit this additional property'
            });
            
            listElement.appendChild(li);
        });
    }
    
    // Function to open edit modal for manual property
    function openManualPropertyEditModal(manualProp) {
        // Import modal functionality
        import('../ui/modal-ui.js').then(({ setupModalUI }) => {
            const modalUI = setupModalUI();
            
            // Use unified modal content for all property types
            const modalContent = createUnifiedPropertyModalContent(manualProp);
            
            // Create unified buttons
            const buttons = [
                {
                    text: 'Cancel',
                    type: 'secondary',
                    keyboardShortcut: 'Escape',
                    callback: () => {
                        modalUI.closeModal();
                    }
                },
                {
                    text: manualProp.property.isMetadata ? 'Update' : 'Update Property',
                    type: 'primary',
                    keyboardShortcut: 'Enter',
                    callback: () => {
                        if (manualProp.property.isMetadata) {
                            // Update the metadata property
                            const updatedProp = {
                                ...manualProp,
                                defaultValue: null
                            };
                            
                            // Remove and re-add to update
                            state.removeManualProperty(manualProp.property.id);
                            state.addManualProperty(updatedProp);
                            
                            populateLists();
                            modalUI.closeModal();
                            showMessage(`Updated ${manualProp.property.label}`, 'success', 2000);
                        } else {
                            // For custom properties, check if they selected a different property
                            const selectedProperty = getUnifiedSelectedPropertyFromModal();
                            if (selectedProperty) {
                                // Remove the old property and add the updated one
                                state.removeManualProperty(manualProp.property.id);
                                addManualPropertyToState(selectedProperty, null, manualProp.isRequired);
                                modalUI.closeModal();
                            } else {
                                // Keep the existing property if none selected
                                modalUI.closeModal();
                                showMessage('Property unchanged', 'info', 2000);
                            }
                        }
                    }
                }
            ];
            
            // Determine modal title
            const modalTitle = manualProp.property.isMetadata 
                ? manualProp.property.label.charAt(0).toUpperCase() + manualProp.property.label.slice(1)
                : 'Edit Additional Custom Wikidata Property';
            
            // Open unified modal
            modalUI.openModal(
                modalTitle,
                modalContent,
                buttons
            );
        });
    }
    
    // Create unified modal content for all property types (metadata and custom properties)
    function createUnifiedPropertyModalContent(manualProp, keyData = null) {
        const container = createElement('div', {
            className: 'unified-property-modal-content'
        });
        
        // Determine if this is a pre-selected property (metadata or existing custom property)
        const isPreSelected = Boolean(manualProp);
        const property = manualProp?.property || keyData?.property;
        
        // Stage 1: Property Selection/Information (Collapsible, closed by default for pre-selected)
        const stage1Section = createElement('details', {
            className: 'mapping-stage',
            id: 'unified-stage-1-property-selection',
            ...(isPreSelected ? {} : { open: true }) // Open by default only for new properties
        });
        
        const stage1Summary = createElement('summary', {
            className: 'stage-summary'
        }, 'Stage 1: Property Selection');
        stage1Section.appendChild(stage1Summary);
        
        const stage1Content = createElement('div', {
            className: 'stage-content'
        });
        
        if (isPreSelected && property) {
            // Show property as read-only for pre-selected properties
            const propertyInfo = createElement('div', {
                className: 'property-info'
            });
            const propertyDisplayText = property.isMetadata 
                ? `${property.label} (metadata)`
                : `${property.label} (${property.id})`;
            
            propertyInfo.innerHTML = `
                <h4>Selected Property</h4>
                <p><strong>Property:</strong> ${propertyDisplayText}</p>
                <p><strong>Description:</strong> ${property.description}</p>
                ${property.id ? `<p><strong>ID:</strong> ${property.id}</p>` : ''}
            `;
            stage1Content.appendChild(propertyInfo);
        } else {
            // Property search section for new custom properties
            const searchSection = createElement('div', {
                className: 'property-search'
            });
            searchSection.innerHTML = `
                <h4>Search Wikidata Properties</h4>
                <input type="text" id="unified-property-search-input" placeholder="Type to search for Wikidata properties..." class="property-search-input">
                <div id="unified-property-suggestions" class="property-suggestions"></div>
                <div id="unified-selected-property" class="selected-property" style="display: none;">
                    <h4>Selected Property</h4>
                    <div id="unified-selected-property-details"></div>
                    <div id="unified-property-constraints" class="property-constraints" style="display: none;">
                        <div class="constraint-loading" style="display: none;">Loading constraint information...</div>
                        <div class="constraint-content"></div>
                        <div class="constraint-info-notice">
                            This information is automatically retrieved from Wikidata and cannot be changed.
                        </div>
                    </div>
                </div>
            `;
            stage1Content.appendChild(searchSection);
        }
        
        stage1Section.appendChild(stage1Content);
        container.appendChild(stage1Section);
        
        // Stage 2: Value Type Detection (Collapsible, open by default)
        const stage2Section = createElement('details', {
            className: 'mapping-stage',
            id: 'unified-stage-2-value-type-detection',
            open: true
        });
        
        // Determine data type and display text
        let detectedDataType, dataTypeLabel, dataTypeDescription;
        
        if (property) {
            if (property.id === 'P31') {
                detectedDataType = 'wikibase-item';
                dataTypeLabel = 'Item';
                dataTypeDescription = 'Values will link to Wikidata items representing the type or class of each item.';
            } else if (property.isMetadata) {
                if (property.id === 'description') {
                    detectedDataType = 'monolingualtext';
                    dataTypeLabel = 'Monolingual text';
                    dataTypeDescription = 'Expecting a language-specific string value. Descriptions are always specific to each language and cannot have a default value for all languages.';
                } else {
                    detectedDataType = 'monolingualtext';
                    dataTypeLabel = 'Monolingual text';
                    dataTypeDescription = 'Expecting a string value. Labels and aliases can have a default value for all languages, with optional language-specific overrides. <a href="https://www.wikidata.org/wiki/Help:Default_values_for_labels_and_aliases" target="_blank" rel="noopener">Learn more about default values</a>.';
                }
            } else {
                // Use actual Wikidata data type for custom properties
                detectedDataType = property.datatype || 'unknown';
                dataTypeLabel = property.datatypeLabel || 'Unknown';
                dataTypeDescription = `This property expects values of type "${dataTypeLabel}".`;
            }
        } else {
            detectedDataType = 'unknown';
            dataTypeLabel = 'Select a property first';
            dataTypeDescription = 'Data type will be detected once you select a property.';
        }
        
        const stage2Summary = createElement('summary', {
            className: 'stage-summary',
            id: 'unified-stage-2-summary'
        }, `Stage 2: Value type is ${dataTypeLabel}`);
        stage2Section.appendChild(stage2Summary);
        
        const stage2Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Data type information section
        const dataTypeInfo = createElement('div', {
            className: 'datatype-info',
            id: 'unified-datatype-info-section'
        });
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Detected Data Type</h4>
                <div id="unified-detected-datatype" class="detected-datatype">
                    <span class="datatype-label">${dataTypeLabel}</span>
                </div>
            </div>
            <div class="datatype-description" id="unified-datatype-description">
                <p>${dataTypeDescription}</p>
            </div>
        `;
        stage2Content.appendChild(dataTypeInfo);
        stage2Section.appendChild(stage2Content);
        container.appendChild(stage2Section);
        
        // Stage 3: Value Transformation (Initially hidden)
        const stage3Section = createElement('details', {
            className: 'mapping-stage',
            id: 'unified-stage-3-value-transformation'
        });
        
        const stage3Summary = createElement('summary', {
            className: 'stage-summary'
        }, 'Stage 3: Value Transformation');
        stage3Section.appendChild(stage3Summary);
        
        const stage3Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Value transformation section
        if (property || keyData) {
            const transformationKeyData = keyData || {
                key: property?.label || 'property',
                sampleValue: 'Sample value for transformation',
                property: property
            };
            const valueTransformationContainer = renderValueTransformationUI(transformationKeyData, state);
            stage3Content.appendChild(valueTransformationContainer);
        } else {
            stage3Content.appendChild(createElement('div', {
                className: 'transformation-message'
            }, 'Select a property first to configure value transformations'));
        }
        
        stage3Section.appendChild(stage3Content);
        container.appendChild(stage3Section);
        
        // Setup search functionality for new properties
        if (!isPreSelected) {
            setTimeout(() => setupUnifiedPropertySearch(), 100);
        }
        
        return container;
    }
    
    
    
    
    
    // Update Stage 2 data type information for unified modal
    function updateUnifiedStage2DataType(propertyData) {
        const stage2Summary = document.getElementById('unified-stage-2-summary');
        const datatypeLabel = document.querySelector('#unified-detected-datatype .datatype-label');
        const datatypeDescription = document.getElementById('unified-datatype-description');
        
        if (stage2Summary) {
            stage2Summary.textContent = `Stage 2: Value type is ${propertyData.datatypeLabel || propertyData.datatype || 'Unknown'}`;
        }
        
        if (datatypeLabel) {
            datatypeLabel.textContent = propertyData.datatypeLabel || propertyData.datatype || 'Unknown';
        }
        
        if (datatypeDescription) {
            datatypeDescription.innerHTML = `<p>This property expects values of type "${propertyData.datatypeLabel || propertyData.datatype || 'Unknown'}".</p>`;
        }
    }
    
    // Get selected property from unified modal
    function getUnifiedSelectedPropertyFromModal() {
        return window.currentUnifiedPropertySelected || null;
    }
    
    // Remove manual property from UI and state
    function removeManualPropertyFromUI(propertyId) {
        // Check if this property can be removed
        const currentState = state.getState();
        const property = currentState.mappings.manualProperties.find(p => p.property.id === propertyId);
        
        if (property && property.cannotRemove) {
            showMessage('This property cannot be removed', 'warning', 2000);
            return;
        }
        
        state.removeManualProperty(propertyId);
        populateLists();
        showMessage('Additional property removed', 'success', 2000);
    }
    
    // Function to open a mapping modal for a key
    function openMappingModal(keyData) {
        // Store keyData globally for modal title updates
        window.currentMappingKeyData = keyData;
        
        // Import modal functionality
        import('../ui/modal-ui.js').then(({ setupModalUI }) => {
            const modalUI = setupModalUI();
            
            // Create modal content
            const modalContent = createMappingModalContent(keyData);
            
            // Create buttons
            const buttons = [
                {
                    text: 'Ignore',
                    type: 'secondary',
                    keyboardShortcut: 'i',
                    callback: () => {
                        moveKeyToCategory(keyData, 'ignored');
                        modalUI.closeModal();
                    }
                },
                {
                    text: 'Ignore and Next',
                    type: 'secondary',
                    keyboardShortcut: 'x',
                    callback: () => {
                        moveKeyToCategory(keyData, 'ignored');
                        modalUI.closeModal();
                        moveToNextUnmappedKey();
                    }
                },
                {
                    text: 'Confirm',
                    type: 'secondary',
                    keyboardShortcut: 'c',
                    callback: () => {
                        const selectedProperty = getSelectedPropertyFromModal();
                        if (selectedProperty) {
                            mapKeyToProperty(keyData, selectedProperty);
                            modalUI.closeModal();
                        } else {
                            showMessage('Please select a Wikidata property first.', 'warning', 3000);
                        }
                    }
                },
                {
                    text: 'Confirm and Next',
                    type: 'primary',
                    keyboardShortcut: 'n',
                    callback: () => {
                        const selectedProperty = getSelectedPropertyFromModal();
                        if (selectedProperty) {
                            mapKeyToProperty(keyData, selectedProperty);
                            modalUI.closeModal();
                            moveToNextUnmappedKey();
                        } else {
                            showMessage('Please select a Wikidata property first.', 'warning', 3000);
                        }
                    }
                }
            ];
            
            // Open modal
            modalUI.openModal(
                `Map Key: ${keyData.key}`,
                modalContent,
                buttons
            );
        });
    }
    
    // Create the content for the mapping modal
    function createMappingModalContent(keyData) {
        const container = createElement('div', {
            className: 'mapping-modal-content'
        });
        
        // Stage 1: Key Information and Property Selection (Collapsible)
        const stage1Section = createElement('details', {
            className: 'mapping-stage',
            id: 'stage-1-property-selection',
            open: true // Open by default
        });
        
        const stage1Summary = createElement('summary', {
            className: 'stage-summary'
        }, 'Stage 1: Property Selection');
        stage1Section.appendChild(stage1Summary);
        
        const stage1Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Key information section
        const keyInfo = createElement('div', {
            className: 'key-info'
        });
        
        const sampleValueHtml = formatSampleValue(keyData.sampleValue, keyData.contextMap || new Map());
        
        const keyDisplay = keyData.linkedDataUri 
            ? `<a href="${keyData.linkedDataUri}" target="_blank" class="clickable-key">${keyData.key}</a>`
            : keyData.key;
        
        keyInfo.innerHTML = `
            <h4>Key Information</h4>
            <p><strong>Key:</strong> ${keyDisplay}</p>
            <p><strong>Frequency:</strong> ${keyData.frequency || 1} out of ${keyData.totalItems || 1} items</p>
            <div><strong>Sample Value:</strong> ${sampleValueHtml}</div>
        `;
        stage1Content.appendChild(keyInfo);
        
        // Property search section
        const searchSection = createElement('div', {
            className: 'property-search'
        });
        searchSection.innerHTML = `
            <h4>Search Wikidata Properties</h4>
            <input type="text" id="property-search-input" placeholder="Type to search for Wikidata properties..." class="property-search-input">
            <div id="property-suggestions" class="property-suggestions"></div>
            <div id="selected-property" class="selected-property" style="display: none;">
                <h4>Selected Property</h4>
                <div id="selected-property-details"></div>
                <div id="property-constraints" class="property-constraints" style="display: none;">
                    <div class="constraint-loading" style="display: none;">Loading constraint information...</div>
                    <div class="constraint-content"></div>
                    <div class="constraint-info-notice">
                        This information is automatically retrieved from Wikidata and cannot be changed.
                    </div>
                </div>
            </div>
        `;
        stage1Content.appendChild(searchSection);
        stage1Section.appendChild(stage1Content);
        container.appendChild(stage1Section);
        
        // Stage 2: Value Type Detection (Initially hidden)
        const stage2Section = createElement('details', {
            className: 'mapping-stage',
            id: 'stage-2-value-type-detection'
        });
        
        const stage2Summary = createElement('summary', {
            className: 'stage-summary',
            id: 'stage-2-summary'
        }, 'Stage 2: Value Type Detection');
        stage2Section.appendChild(stage2Summary);
        
        const stage2Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Data type information section
        const dataTypeInfo = createElement('div', {
            className: 'datatype-info',
            id: 'datatype-info-section'
        });
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Detected Data Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <div class="datatype-loading">Select a property to detect data type...</div>
                </div>
            </div>
            <div class="datatype-description" id="datatype-description" style="display: none;">
                <p>Additional configuration options will be available here in future versions.</p>
            </div>
        `;
        stage2Content.appendChild(dataTypeInfo);
        stage2Section.appendChild(stage2Content);
        container.appendChild(stage2Section);
        
        // Stage 3: Value Transformation (Initially hidden)
        const stage3Section = createElement('details', {
            className: 'mapping-stage',
            id: 'stage-3-value-transformation'
        });
        
        const stage3Summary = createElement('summary', {
            className: 'stage-summary'
        }, 'Stage 3: Value Transformation');
        stage3Section.appendChild(stage3Summary);
        
        const stage3Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Value transformation section
        const valueTransformationContainer = renderValueTransformationUI(keyData, state);
        stage3Content.appendChild(valueTransformationContainer);
        stage3Section.appendChild(stage3Content);
        container.appendChild(stage3Section);
        
        // Setup search functionality and pre-populate if mapped
        setTimeout(() => setupPropertySearch(keyData), 100);
        
        return container;
    }
    
    // Format sample value for display
    function formatSampleValue(value, contextMap = new Map()) {
        if (value === null || value === undefined) {
            return '<pre class="sample-value">N/A</pre>';
        }
        
        if (typeof value === 'object') {
            try {
                // Reset the seen set for each call
                const seenObjects = new WeakSet();
                
                // Use a replacer function to handle circular references and non-serializable objects
                const jsonStr = JSON.stringify(value, (key, val) => {
                    // Handle circular references
                    if (typeof val === 'object' && val !== null) {
                        if (seenObjects.has(val)) {
                            return '[Circular Reference]';
                        }
                        seenObjects.add(val);
                    }
                    // Handle functions
                    if (typeof val === 'function') {
                        return '[Function]';
                    }
                    // Handle undefined
                    if (val === undefined) {
                        return '[Undefined]';
                    }
                    return val;
                }, 2);
                
                // Validate that we got a proper JSON string
                if (!jsonStr || jsonStr === 'undefined' || jsonStr === 'null') {
                    throw new Error('Invalid JSON result');
                }
                
                // Make JSON keys clickable by replacing them with links
                const clickableJsonStr = makeJsonKeysClickable(jsonStr, contextMap);
                // Create a scrollable container for JSON
                return `<div class="sample-json-container">
                    <pre class="sample-json">${clickableJsonStr}</pre>
                </div>`;
            } catch (e) {
                console.error('JSON stringify error:', e, 'Value:', value);
                // Enhanced fallback that shows more useful information
                try {
                    if (Array.isArray(value)) {
                        // Try to show full JSON for arrays, but limit to first few items if too large
                        const maxItems = 3;
                        const displayArray = value.length > maxItems ? value.slice(0, maxItems) : value;
                        const truncatedArray = value.length > maxItems ? [...displayArray, '...'] : displayArray;
                        
                        const jsonStr = JSON.stringify(truncatedArray, null, 2);
                        const clickableJsonStr = makeJsonKeysClickable(jsonStr, contextMap);
                        
                        return `<div class="sample-json-container">
                            <div class="array-info">Array with ${value.length} item${value.length !== 1 ? 's' : ''}</div>
                            <pre class="sample-json">${clickableJsonStr}</pre>
                        </div>`;
                    } else if (value && typeof value === 'object') {
                        // Try to create a partial JSON representation
                        const partialObject = {};
                        const keys = Object.keys(value).slice(0, 5);
                        keys.forEach(key => {
                            try {
                                partialObject[key] = value[key];
                            } catch (e) {
                                partialObject[key] = '[Error accessing property]';
                            }
                        });
                        if (Object.keys(value).length > 5) {
                            partialObject['...'] = `(${Object.keys(value).length - 5} more properties)`;
                        }
                        
                        const jsonStr = JSON.stringify(partialObject, null, 2);
                        const clickableJsonStr = makeJsonKeysClickable(jsonStr, contextMap);
                        return `<div class="sample-json-container">
                            <pre class="sample-json">${clickableJsonStr}</pre>
                        </div>`;
                    } else {
                        return `<pre class="sample-value">${Object.prototype.toString.call(value)}</pre>`;
                    }
                } catch (e2) {
                    return '<pre class="sample-value">[object - display error]</pre>';
                }
            }
        }
        
        // For non-object values, show them in a pre element with proper formatting
        const str = String(value);
        const displayStr = str.length > 200 ? str.slice(0, 200) + '...' : str;
        return `<pre class="sample-value">${displayStr}</pre>`;
    }
    
    // Helper function to make JSON keys clickable
    function makeJsonKeysClickable(jsonStr, contextMap) {
        // Ensure contextMap is a Map
        if (!contextMap || typeof contextMap.get !== 'function') {
            contextMap = new Map();
        }
        
        // Pattern to match JSON keys (quoted strings followed by colon)
        return jsonStr.replace(/"([^"]+)"(\s*:)/g, (match, key, colon) => {
            // Skip system keys and values (not keys)
            if (key.startsWith('@') || key.match(/^\d+$/)) {
                return match;
            }
            
            // Generate URI for this key
            const uri = generateUriForKey(key, contextMap);
            if (uri) {
                return `"<a href="${uri}" target="_blank" class="clickable-json-key">${key}</a>"${colon}`;
            }
            return match;
        });
    }
    
    // Helper function to generate URI for a key
    function generateUriForKey(key, contextMap) {
        // Ensure contextMap is a Map
        if (!contextMap || typeof contextMap.get !== 'function') {
            contextMap = new Map();
        }
        
        if (key.includes(':')) {
            const [prefix, localName] = key.split(':', 2);
            const baseUri = contextMap.get(prefix);
            if (baseUri) {
                // Handle different URI patterns
                if (baseUri.endsWith('/') || baseUri.endsWith('#')) {
                    return baseUri + localName;
                } else {
                    return baseUri + '/' + localName;
                }
            }
        } else {
            // Check for common prefixes even without explicit context
            const commonPrefixes = {
                'schema': 'https://schema.org/',
                'dc': 'http://purl.org/dc/terms/',
                'dcterms': 'http://purl.org/dc/terms/',
                'foaf': 'http://xmlns.com/foaf/0.1/',
                'skos': 'http://www.w3.org/2004/02/skos/core#'
            };
            
            // Try to match common patterns
            for (const [prefix, uri] of Object.entries(commonPrefixes)) {
                if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
                    const localName = key.substring(prefix.length);
                    return uri + localName;
                }
            }
            
            // Check if there's a default namespace
            const defaultNs = contextMap.get('');
            if (defaultNs) {
                return defaultNs + key;
            }
        }
        return null;
    }
    
    
    
    
    
    
    
    
    // Update the modal title to show the mapping relationship
    function updateModalTitle(property) {
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle && window.currentMappingKeyData) {
            const keyName = window.currentMappingKeyData.key || 'Key';
            modalTitle.textContent = `${keyName} → ${property.label} (${property.id})`;
        }
    }
    
    // Update Stage 2 summary to show detected data type
    function updateStage2Summary(property) {
        const stage2Summary = document.getElementById('stage-2-summary');
        if (stage2Summary && property && property.datatypeLabel) {
            stage2Summary.textContent = `Stage 2: Value type is ${property.datatypeLabel}`;
        }
    }
    
    
    
    
    
    
    
    // Open modal with raw JSON data
    function openRawJsonModal(propertyData) {
        import('../ui/modal-ui.js').then(({ setupModalUI }) => {
            const modalUI = setupModalUI();
            
            // Create JSON viewer content
            const jsonContent = createElement('div', {
                className: 'raw-json-viewer'
            });
            
            const jsonPre = createElement('pre', {
                className: 'json-display'
            }, JSON.stringify(propertyData, null, 2));
            
            jsonContent.appendChild(jsonPre);
            
            // Add copy button
            const copyBtn = createElement('button', {
                className: 'copy-json-btn',
                onClick: () => {
                    navigator.clipboard.writeText(JSON.stringify(propertyData, null, 2));
                    copyBtn.textContent = '✓ Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy to Clipboard';
                    }, 2000);
                }
            }, 'Copy to Clipboard');
            
            jsonContent.insertBefore(copyBtn, jsonPre);
            
            const buttons = [
                {
                    text: 'Close',
                    type: 'primary',
                    callback: () => modalUI.closeModal()
                }
            ];
            
            modalUI.openModal(
                `Raw JSON Data - ${propertyData.id}`,
                jsonContent,
                buttons
            );
        });
    }
    
    
    // Get selected property from modal
    function getSelectedPropertyFromModal() {
        return window.currentMappingSelectedProperty;
    }
    
    // Move key to a specific category
    function moveKeyToCategory(keyData, category) {
        const currentState = state.getState();
        const targetKey = typeof keyData === 'string' ? keyData : keyData.key;
        
        // Remove from ALL existing categories first
        const updatedNonLinkedKeys = currentState.mappings.nonLinkedKeys.filter(k => {
            const keyToCompare = typeof k === 'string' ? k : k.key;
            return keyToCompare !== targetKey;
        });
        
        const updatedMappedKeys = currentState.mappings.mappedKeys.filter(k => {
            const keyToCompare = typeof k === 'string' ? k : k.key;
            return keyToCompare !== targetKey;
        });
        
        const updatedIgnoredKeys = currentState.mappings.ignoredKeys.filter(k => {
            const keyToCompare = typeof k === 'string' ? k : k.key;
            return keyToCompare !== targetKey;
        });
        
        // Update all categories
        state.updateMappings(updatedNonLinkedKeys, updatedMappedKeys, updatedIgnoredKeys);
        
        // Clear isNewlyMoved flag from all existing items to prevent old animations
        const clearAnimationFlag = (items) => items.map(item => {
            const { isNewlyMoved, ...cleanItem } = item;
            return cleanItem;
        });
        
        const cleanedNonLinkedKeys = clearAnimationFlag(updatedNonLinkedKeys);
        const cleanedMappedKeys = clearAnimationFlag(updatedMappedKeys);
        const cleanedIgnoredKeys = clearAnimationFlag(updatedIgnoredKeys);
        
        // Add to target category with animation marker (only for the current item)
        const keyDataWithAnimation = { ...keyData, isNewlyMoved: true };
        
        if (category === 'ignored') {
            const finalIgnoredKeys = [...cleanedIgnoredKeys, keyDataWithAnimation];
            state.updateMappings(cleanedNonLinkedKeys, cleanedMappedKeys, finalIgnoredKeys);
        } else if (category === 'mapped') {
            const finalMappedKeys = [...cleanedMappedKeys, keyDataWithAnimation];
            state.updateMappings(cleanedNonLinkedKeys, finalMappedKeys, cleanedIgnoredKeys);
        } else if (category === 'non-linked') {
            const finalNonLinkedKeys = [...cleanedNonLinkedKeys, keyDataWithAnimation];
            state.updateMappings(finalNonLinkedKeys, cleanedMappedKeys, cleanedIgnoredKeys);
        }
        
        // Update UI
        populateLists();
        state.markChangesUnsaved();
    }
    
    // Map key to property
    function mapKeyToProperty(keyData, property) {
        // Create enhanced key data with property information
        const mappedKey = {
            ...keyData,
            property: property,
            mappedAt: new Date().toISOString()
        };
        
        // Use moveKeyToCategory to handle the movement properly
        moveKeyToCategory(mappedKey, 'mapped');
    }
    
    // Move to next unmapped key
    function moveToNextUnmappedKey() {
        const currentState = state.getState();
        if (currentState.mappings.nonLinkedKeys.length > 0) {
            // Small delay to let UI update, then open next key
            setTimeout(() => {
                const nextKey = currentState.mappings.nonLinkedKeys[0];
                openMappingModal(nextKey);
            }, 200);
        }
    }
    
    // Function to open manual property modal
    function openAddManualPropertyModal() {
        // Import modal functionality
        import('../ui/modal-ui.js').then(({ setupModalUI }) => {
            const modalUI = setupModalUI();
            
            // Create unified modal content for new properties (no preselected property)
            const modalContent = createUnifiedPropertyModalContent(null);
            
            // Create buttons
            const buttons = [
                {
                    text: 'Cancel',
                    type: 'secondary',
                    keyboardShortcut: 'Escape',
                    callback: () => {
                        modalUI.closeModal();
                    }
                },
                {
                    text: 'Add Property',
                    type: 'primary',
                    keyboardShortcut: 'Enter',
                    callback: () => {
                        const selectedProperty = getUnifiedSelectedPropertyFromModal();
                        if (selectedProperty) {
                            addManualPropertyToState(selectedProperty, null, false);
                            modalUI.closeModal();
                        } else {
                            showMessage('Please select a Wikidata property first.', 'warning', 3000);
                        }
                    }
                }
            ];
            
            // Open modal
            modalUI.openModal(
                'Add Additional Custom Wikidata Property',
                modalContent,
                buttons
            );
        });
    }
    
    // Select a property in manual property modal
    async function selectManualProperty(property) {
        // Remove selection from other items
        document.querySelectorAll('.property-suggestion-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to clicked item
        if (typeof event !== 'undefined' && event.target) {
            const targetItem = event.target.closest('.property-suggestion-item');
            if (targetItem) {
                targetItem.classList.add('selected');
            }
        }
        
        // Store selected property
        window.currentManualPropertySelected = property;
        
        // Update search input with selected property label
        const searchInput = document.getElementById('manual-property-search-input');
        if (searchInput) {
            searchInput.value = `${property.id}: ${property.label}`;
        }
        
        
        // Show selected property details
        const selectedContainer = document.getElementById('manual-selected-property');
        const detailsContainer = document.getElementById('manual-selected-property-details');
        
        if (selectedContainer && detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="selected-property-info">
                    <span class="property-id">${property.id}</span>
                    <span class="property-label">${property.label}</span>
                    <div class="property-description">${property.description}</div>
                </div>
            `;
            selectedContainer.style.display = 'block';
        }
        
        // Show classification toggle if this is P31 or P279
        const classificationSection = document.querySelector('.classification-toggle-section');
        if (classificationSection) {
            if (property.id === 'P31' || property.id === 'P279') {
                classificationSection.style.display = 'block';
                // Set the appropriate radio button
                const radio = document.querySelector(`input[name="classification-type"][value="${property.id}"]`);
                if (radio) radio.checked = true;
            } else {
                classificationSection.style.display = 'none';
            }
        }
        
        // Fetch and display constraints
        await displayManualPropertyConstraints(property.id);
        
        // Update default value input based on datatype
        updateDefaultValueInputForDatatype(property);
    }
    
    // Display property constraints for manual property modal
    async function displayManualPropertyConstraints(propertyId) {
        const constraintsContainer = document.getElementById('manual-property-constraints');
        const loadingDiv = constraintsContainer?.querySelector('.constraint-loading');
        const contentDiv = constraintsContainer?.querySelector('.constraint-content');
        
        if (!constraintsContainer || !loadingDiv || !contentDiv) return;
        
        // Show container and loading state
        constraintsContainer.style.display = 'block';
        loadingDiv.style.display = 'block';
        contentDiv.innerHTML = '';
        
        try {
            // Fetch complete property data with constraints
            const propertyData = await getCompletePropertyData(propertyId);
            
            // Update the selected property with complete data
            window.currentManualPropertySelected = {
                ...window.currentManualPropertySelected,
                ...propertyData
            };
            
            // Hide loading
            loadingDiv.style.display = 'none';
            
            // Build constraint display
            let constraintHtml = '';
            
            // Always show datatype
            constraintHtml += `<div class="constraint-datatype"><strong>Wikidata expects:</strong> ${propertyData.datatypeLabel}</div>`;
            
            // Show format constraints if any
            if (propertyData.constraints.format.length > 0) {
                const formatDescriptions = propertyData.constraints.format
                    .filter(c => c.rank !== 'deprecated')
                    .map(c => c.description)
                    .join('; ');
                
                if (formatDescriptions) {
                    constraintHtml += `<div class="constraint-format"><strong>Format requirements:</strong> ${formatDescriptions}</div>`;
                }
            }
            
            // Show value type constraints if any
            if (propertyData.constraints.valueType.length > 0) {
                const valueTypeDescriptions = propertyData.constraints.valueType
                    .filter(c => c.rank !== 'deprecated')
                    .map(constraint => {
                        // Convert Q-numbers to human-readable labels
                        const classLabels = constraint.classes.map(qId => {
                            return constraint.classLabels[qId] || qId;
                        });
                        return classLabels.join(', ');
                    })
                    .join('; ');
                
                if (valueTypeDescriptions) {
                    constraintHtml += `<div class="constraint-value-types"><strong>Must be:</strong> ${valueTypeDescriptions}</div>`;
                }
            }
            
            contentDiv.innerHTML = constraintHtml;
            
            // Update default value input based on complete property data
            updateDefaultValueInputForDatatype(propertyData);
            
        } catch (error) {
            console.error('Error fetching property constraints:', error);
            loadingDiv.style.display = 'none';
            contentDiv.innerHTML = '<div class="constraint-error">Unable to load constraint information</div>';
        }
    }
    
    // Update default value input based on property datatype
    function updateDefaultValueInputForDatatype(propertyData) {
        const inputContainer = document.getElementById('default-value-input-container');
        if (!inputContainer) return;
        
        const datatype = propertyData.datatype;
        let inputHtml = '';
        
        switch (datatype) {
            case 'wikibase-item':
                inputHtml = `
                    <input type="text" id="default-value-input" placeholder="Search for a Wikidata item..." class="default-value-input item-search-input">
                    <div id="default-value-suggestions" class="property-suggestions"></div>
                `;
                break;
            case 'time':
                inputHtml = `
                    <input type="date" id="default-value-input" class="default-value-input">
                    <div class="input-help">Enter a date value</div>
                `;
                break;
            case 'quantity':
                inputHtml = `
                    <input type="number" id="default-value-input" placeholder="Enter a number..." class="default-value-input">
                    <div class="input-help">Enter a numeric value</div>
                `;
                break;
            case 'string':
            case 'monolingualtext':
            default:
                inputHtml = `
                    <input type="text" id="default-value-input" placeholder="Enter a text value..." class="default-value-input">
                    <div class="input-help">Enter a text value</div>
                `;
                break;
        }
        
        inputContainer.innerHTML = inputHtml;
    }
    
    // Get manual property data from modal
    function getManualPropertyFromModal() {
        const selectedProperty = window.currentManualPropertySelected;
        const classificationRadio = document.querySelector('input[name="classification-type"]:checked');
        
        let defaultValue = null;
        let isRequired = false;
        
        // Handle classification properties
        if (selectedProperty && (selectedProperty.id === 'P31' || selectedProperty.id === 'P279')) {
            isRequired = true;
            // Update the property ID based on the radio selection
            if (classificationRadio && classificationRadio.value !== selectedProperty.id) {
                selectedProperty.id = classificationRadio.value;
                selectedProperty.label = classificationRadio.value === 'P31' ? 'instance of' : 'subclass of';
            }
        }
        
        return {
            selectedProperty,
            defaultValue,
            isRequired
        };
    }
    
    // Add manual property to state
    function addManualPropertyToState(property, defaultValue, isRequired) {
        const manualProperty = {
            property,
            defaultValue,
            isRequired
        };
        
        state.addManualProperty(manualProperty);
        
        // Refresh the UI
        populateLists();
        
        showMessage(`Added additional property: ${property.label} (${property.id})`, 'success', 3000);
    }
    













    




    
    // Export functions globally for use by other modules
    window.openMappingModal = openMappingModal;
    window.openManualPropertyEditModal = openManualPropertyEditModal;
    
}