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
    moveKeyToCategory,
    mapKeyToProperty,
    moveToNextUnmappedKey 
} from '../mapping/ui/mapping-lists.js';
import { 
    openMappingModal,
    createMappingModalContent,
    openRawJsonModal 
} from '../mapping/ui/property-modals.js';
import { initializeEntitySchemaSelector } from '../entity-schemas/entity-schema-selector.js';
import { initializeSchemaOverview } from '../entity-schemas/entity-schema-overview.js';

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

    // Initialize Entity Schema Overview
    const overviewContainer = document.getElementById('entity-schema-overview-container');
    if (overviewContainer) {
        const overview = initializeSchemaOverview(state);
        overviewContainer.appendChild(overview);
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
    
    // Add Wikidata property functionality
    const addWikidataPropertyBtn = document.getElementById('add-wikidata-property');
    if (addWikidataPropertyBtn) {
        addWikidataPropertyBtn.addEventListener('click', () => {
            // Create empty key data for the modal
            const emptyKeyData = {
                key: '',
                type: 'unknown',
                frequency: 0,
                totalItems: 0,
                sampleValue: ''
            };

            // Open the mapping modal with empty data
            openMappingModal(emptyKeyData);
        });
    }

    // Add Label functionality
    const addLabelBtn = document.getElementById('add-label');
    if (addLabelBtn) {
        addLabelBtn.addEventListener('click', () => {
            // Create empty key data for the modal
            const emptyKeyData = {
                key: '',
                type: 'unknown',
                frequency: 0,
                totalItems: 0,
                sampleValue: ''
            };

            // Open the mapping modal with empty data
            openMappingModal(emptyKeyData);

            // Wait 150ms for setupPropertySearch to finish (it runs at 100ms),
            // then set the label property
            setTimeout(() => {
                const labelProperty = {
                    id: 'label',
                    label: 'Labels',
                    description: 'Main name for entities',
                    datatype: 'monolingualtext',
                    datatypeLabel: 'Monolingual text',
                    isMetadata: true,
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Label'
                };

                // Set the selected property
                window.currentMappingSelectedProperty = labelProperty;

                // Update UI to show selection
                const selectedSection = document.getElementById('selected-property');
                const selectedDetails = document.getElementById('selected-property-details');

                if (selectedSection && selectedDetails) {
                    selectedSection.style.display = 'block';
                    selectedDetails.innerHTML = `
                        <div class="property-info metadata-property-info">
                            <h3>🏷️ ${labelProperty.label}</h3>
                            <p class="property-id">Metadata Field</p>
                            <p>${labelProperty.description}</p>
                            <a href="${labelProperty.helpUrl}" target="_blank" rel="noopener">
                                Learn more about ${labelProperty.label} →
                            </a>
                            <div class="metadata-notice" style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                                <strong>Note:</strong> This is a metadata field for Wikidata entities.
                                Values will be treated as language-specific text.
                            </div>
                        </div>
                    `;
                }

                // Update datatype display
                const datatypeDisplay = document.getElementById('detected-datatype');
                if (datatypeDisplay) {
                    datatypeDisplay.innerHTML = `
                        <span class="datatype-label">Monolingual text</span>
                    `;
                }

                // Show datatype section
                const datatypeSection = document.getElementById('datatype-info-section');
                if (datatypeSection) {
                    datatypeSection.style.display = 'block';
                }

                // Highlight the Labels button if it exists
                const labelsButton = Array.from(document.querySelectorAll('.metadata-select-button'))
                    .find(btn => btn.textContent.includes('Labels'));
                if (labelsButton) {
                    // Remove selected class from all buttons
                    document.querySelectorAll('.metadata-select-button').forEach(btn => {
                        btn.classList.remove('selected');
                        btn.style.borderColor = '#ddd';
                        btn.style.background = 'white';
                    });
                    // Add selected class to Labels button
                    labelsButton.classList.add('selected');
                    labelsButton.style.borderColor = '#3366cc';
                    labelsButton.style.background = '#e6f0ff';
                }
            }, 150);
        });
    }

    // Add Description functionality
    const addDescriptionBtn = document.getElementById('add-description');
    if (addDescriptionBtn) {
        addDescriptionBtn.addEventListener('click', () => {
            // Create empty key data for the modal
            const emptyKeyData = {
                key: '',
                type: 'unknown',
                frequency: 0,
                totalItems: 0,
                sampleValue: ''
            };

            // Open the mapping modal with empty data
            openMappingModal(emptyKeyData);

            // Wait 150ms for setupPropertySearch to finish (it runs at 100ms),
            // then set the description property
            setTimeout(() => {
                const descriptionProperty = {
                    id: 'description',
                    label: 'Descriptions',
                    description: 'Short disambiguating phrases',
                    datatype: 'monolingualtext',
                    datatypeLabel: 'Monolingual text',
                    isMetadata: true,
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Description'
                };

                // Set the selected property
                window.currentMappingSelectedProperty = descriptionProperty;

                // Update UI to show selection
                const selectedSection = document.getElementById('selected-property');
                const selectedDetails = document.getElementById('selected-property-details');

                if (selectedSection && selectedDetails) {
                    selectedSection.style.display = 'block';
                    selectedDetails.innerHTML = `
                        <div class="property-info metadata-property-info">
                            <h3>📝 ${descriptionProperty.label}</h3>
                            <p class="property-id">Metadata Field</p>
                            <p>${descriptionProperty.description}</p>
                            <a href="${descriptionProperty.helpUrl}" target="_blank" rel="noopener">
                                Learn more about ${descriptionProperty.label} →
                            </a>
                            <div class="metadata-notice" style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                                <strong>Note:</strong> This is a metadata field for Wikidata entities.
                                Values will be treated as language-specific text.
                            </div>
                        </div>
                    `;
                }

                // Update datatype display
                const datatypeDisplay = document.getElementById('detected-datatype');
                if (datatypeDisplay) {
                    datatypeDisplay.innerHTML = `
                        <span class="datatype-label">Monolingual text</span>
                    `;
                }

                // Show datatype section
                const datatypeSection = document.getElementById('datatype-info-section');
                if (datatypeSection) {
                    datatypeSection.style.display = 'block';
                }

                // Highlight the Descriptions button if it exists
                const descriptionsButton = Array.from(document.querySelectorAll('.metadata-select-button'))
                    .find(btn => btn.textContent.includes('Descriptions'));
                if (descriptionsButton) {
                    // Remove selected class from all buttons
                    document.querySelectorAll('.metadata-select-button').forEach(btn => {
                        btn.classList.remove('selected');
                        btn.style.borderColor = '#ddd';
                        btn.style.background = 'white';
                    });
                    // Add selected class to Descriptions button
                    descriptionsButton.classList.add('selected');
                    descriptionsButton.style.borderColor = '#3366cc';
                    descriptionsButton.style.background = '#e6f0ff';
                }
            }, 150);
        });
    }

    // Add Aliases functionality
    const addAliasesBtn = document.getElementById('add-aliases');
    if (addAliasesBtn) {
        addAliasesBtn.addEventListener('click', () => {
            // Create empty key data for the modal
            const emptyKeyData = {
                key: '',
                type: 'unknown',
                frequency: 0,
                totalItems: 0,
                sampleValue: ''
            };

            // Open the mapping modal with empty data
            openMappingModal(emptyKeyData);

            // Wait 150ms for setupPropertySearch to finish (it runs at 100ms),
            // then set the aliases property
            setTimeout(() => {
                const aliasesProperty = {
                    id: 'aliases',
                    label: 'Aliases',
                    description: 'Alternative names',
                    datatype: 'monolingualtext',
                    datatypeLabel: 'Monolingual text',
                    isMetadata: true,
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Aliases'
                };

                // Set the selected property
                window.currentMappingSelectedProperty = aliasesProperty;

                // Update UI to show selection
                const selectedSection = document.getElementById('selected-property');
                const selectedDetails = document.getElementById('selected-property-details');

                if (selectedSection && selectedDetails) {
                    selectedSection.style.display = 'block';
                    selectedDetails.innerHTML = `
                        <div class="property-info metadata-property-info">
                            <h3>🔄 ${aliasesProperty.label}</h3>
                            <p class="property-id">Metadata Field</p>
                            <p>${aliasesProperty.description}</p>
                            <a href="${aliasesProperty.helpUrl}" target="_blank" rel="noopener">
                                Learn more about ${aliasesProperty.label} →
                            </a>
                            <div class="metadata-notice" style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                                <strong>Note:</strong> This is a metadata field for Wikidata entities.
                                Values will be treated as language-specific text.
                            </div>
                        </div>
                    `;
                }

                // Update datatype display
                const datatypeDisplay = document.getElementById('detected-datatype');
                if (datatypeDisplay) {
                    datatypeDisplay.innerHTML = `
                        <span class="datatype-label">Monolingual text</span>
                    `;
                }

                // Show datatype section
                const datatypeSection = document.getElementById('datatype-info-section');
                if (datatypeSection) {
                    datatypeSection.style.display = 'block';
                }

                // Highlight the Aliases button if it exists
                const aliasesButton = Array.from(document.querySelectorAll('.metadata-select-button'))
                    .find(btn => btn.textContent.includes('Aliases'));
                if (aliasesButton) {
                    // Remove selected class from all buttons
                    document.querySelectorAll('.metadata-select-button').forEach(btn => {
                        btn.classList.remove('selected');
                        btn.style.borderColor = '#ddd';
                        btn.style.background = 'white';
                    });
                    // Add selected class to Aliases button
                    aliasesButton.classList.add('selected');
                    aliasesButton.style.borderColor = '#3366cc';
                    aliasesButton.style.background = '#e6f0ff';
                }
            }, 150);
        });
    }

    // Add Instance of functionality
    const addInstanceOfBtn = document.getElementById('add-instance-of');
    if (addInstanceOfBtn) {
        addInstanceOfBtn.addEventListener('click', () => {
            // Create empty key data for the modal
            const emptyKeyData = {
                key: '',
                type: 'unknown',
                frequency: 0,
                totalItems: 0,
                sampleValue: ''
            };

            // Open the mapping modal with empty data
            openMappingModal(emptyKeyData);

            // Wait 150ms for setupPropertySearch to finish (it runs at 100ms),
            // then set the instance of property
            setTimeout(() => {
                const instanceOfProperty = {
                    id: 'P31',
                    label: 'instance of',
                    description: 'that class of which this subject is a particular example',
                    datatype: 'wikibase-item',
                    datatypeLabel: 'Item',
                    url: 'https://www.wikidata.org/wiki/Property:P31'
                };

                // Set the selected property
                window.currentMappingSelectedProperty = instanceOfProperty;

                // Update UI to show selection
                const selectedSection = document.getElementById('selected-property');
                const selectedDetails = document.getElementById('selected-property-details');

                if (selectedSection && selectedDetails) {
                    selectedSection.style.display = 'block';
                    selectedDetails.innerHTML = `
                        <div class="property-info">
                            <h3>${instanceOfProperty.label}</h3>
                            <p class="property-id">${instanceOfProperty.id}</p>
                            <p>${instanceOfProperty.description}</p>
                            <a href="${instanceOfProperty.url}" target="_blank" rel="noopener">
                                View on Wikidata →
                            </a>
                        </div>
                    `;
                }

                // Update datatype display
                const datatypeDisplay = document.getElementById('detected-datatype');
                if (datatypeDisplay) {
                    datatypeDisplay.innerHTML = `
                        <span class="datatype-label">Item</span>
                    `;
                }

                // Show datatype section
                const datatypeSection = document.getElementById('datatype-info-section');
                if (datatypeSection) {
                    datatypeSection.style.display = 'block';
                }

                // Note: No metadata button to highlight since P31 is a regular property
            }, 150);
        });
    }

    // Export functions globally for use by other modules
    window.openMappingModal = openMappingModal;
}