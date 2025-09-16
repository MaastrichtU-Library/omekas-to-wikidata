/**
 * Manual property modal functionality for editing and managing properties
 * Handles manual property editing and unified property interfaces
 * @module mapping/ui/modals/manual-property-modal
 */

// Import dependencies
import { createElement, showMessage } from '../../../ui/components.js';
import { getCompletePropertyData } from '../../../api/wikidata.js';
import { setupUnifiedPropertySearch } from '../../core/property-searcher.js';
import { renderValueTransformationUI, addTransformationBlock } from '../../core/transformation-engine.js';
import { populateLists } from '../mapping-lists.js';
import { addManualPropertyToState } from './add-property-modal.js';
import { BLOCK_TYPES } from '../../../transformations.js';

/**
 * Opens the manual property edit modal
 */
export function openManualPropertyEditModal(manualProp) {
    // Import modal functionality
    import('../../../ui/modal-ui.js').then(({ setupModalUI }) => {
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
                        window.mappingStepState.removeManualProperty(manualProp.property.id);
                        window.mappingStepState.addManualProperty(updatedProp);
                        
                        populateLists(window.mappingStepState);
                        modalUI.closeModal();
                        showMessage(`Updated ${manualProp.property.label}`, 'success', 2000);
                    } else {
                        // For custom properties, check if they selected a different property
                        const selectedProperty = getUnifiedSelectedPropertyFromModal();
                        if (selectedProperty) {
                            // Remove the old property and add the updated one
                            window.mappingStepState.removeManualProperty(manualProp.property.id);
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
            buttons,
            () => {
                // Remove the wide class when modal closes
                const modal = document.querySelector('.modal');
                if (modal) {
                    modal.classList.remove('mapping-modal-wide');
                }
            }
        );
        
        // Add class to modal for wider display after opening
        setTimeout(() => {
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.classList.add('mapping-modal-wide');
            }
        }, 0);
    });
}

/**
 * Creates unified property modal content with two-column layout
 */
export function createUnifiedPropertyModalContent(manualProp, keyData = null) {
    // Determine if this is a metadata property
    const property = manualProp?.property || keyData?.property;
    const isMetadata = property?.isMetadata;
    
    const container = createElement('div', {
        className: 'mapping-modal-content two-column-layout'
    });
    
    // LEFT COLUMN - Omeka S Data (or Default Value for metadata)
    const leftColumn = createElement('div', {
        className: 'mapping-column left-column'
    });
    
    // Column header
    const leftHeader = createElement('div', {
        className: 'column-header'
    }, isMetadata ? 'Value Configuration' : 'Omeka S Data');
    leftColumn.appendChild(leftHeader);
    
    // Value transformation section (with default compose block for metadata)
    const transformationSection = createElement('div', {
        className: 'transformation-section',
        style: 'margin-top: 20px;'
    });
    
    // Toggle button for transformation section
    const transformationToggle = createElement('button', {
        className: 'transformation-toggle',
        onClick: () => {
            const isExpanded = transformationSection.classList.contains('expanded');
            if (isExpanded) {
                transformationSection.classList.remove('expanded');
                transformationToggle.textContent = '▶ Add Transformation';
            } else {
                transformationSection.classList.add('expanded');
                transformationToggle.textContent = '▼ Hide Transformations';
                
                // For metadata fields, ensure compose transformation is added by default
                if (isMetadata) {
                    const composeContainer = document.querySelector('.transformation-blocks');
                    if (composeContainer && !composeContainer.hasChildNodes()) {
                        // Add a default compose block for metadata
                        const addComposeBtn = document.querySelector('.add-compose-btn');
                        if (addComposeBtn) {
                            setTimeout(() => addComposeBtn.click(), 100);
                        }
                    }
                }
            }
        }
    }, isMetadata ? '▶ Value Transformation' : '▶ Add Transformation');
    
    transformationSection.appendChild(transformationToggle);
    
    // Collapsible content container
    const transformationContent = createElement('div', {
        className: 'transformation-content'
    });
    
    const transformationHeader = createElement('h4', {}, 'Value Transformation');
    transformationContent.appendChild(transformationHeader);
    
    // For metadata properties, show empty input field first
    if (isMetadata) {
        const emptyInput = createElement('input', {
            type: 'text',
            className: 'empty-transformation-input',
            placeholder: 'Leave empty to use original value',
            style: 'width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid var(--border-color); border-radius: 4px;'
        });
        transformationContent.appendChild(emptyInput);
    }
    
    const transformationKeyData = keyData || {
        key: property?.label || 'property',
        sampleValue: 'Sample value for transformation',
        property: property
    };
    const valueTransformationContainer = renderValueTransformationUI(transformationKeyData, window.mappingStepState);
    transformationContent.appendChild(valueTransformationContainer);
    
    transformationSection.appendChild(transformationContent);
    leftColumn.appendChild(transformationSection);
    
    // Expand transformation section by default for metadata and setup special handling
    if (isMetadata) {
        setTimeout(() => {
            // Expand the transformation section
            transformationSection.classList.add('expanded');
            
            // Add metadata-specific class for targeting
            transformationSection.classList.add('metadata-transformation');
            
            // Hide the elements we don't need for metadata
            transformationToggle.style.setProperty('display', 'none', 'important');
            
            const emptyInput = transformationSection.querySelector('.empty-transformation-input');
            if (emptyInput) {
                emptyInput.style.setProperty('display', 'none', 'important');
            }
            
            // Setup metadata transformation with compose block
            setupMetadataTransformation(property, transformationKeyData, window.mappingStepState);
        }, 100);
    }
    
    container.appendChild(leftColumn);
    
    // RIGHT COLUMN - Wikidata Property
    const rightColumn = createElement('div', {
        className: 'mapping-column right-column'
    });
    
    // Column header with link for metadata
    const rightHeaderContent = isMetadata ? 
        (() => {
            let helpUrl, helpText;
            switch(property?.id) {
                case 'label':
                    helpUrl = 'https://www.wikidata.org/wiki/Help:Label';
                    helpText = 'Wikidata Labels';
                    break;
                case 'description':
                    helpUrl = 'https://www.wikidata.org/wiki/Help:Description';
                    helpText = 'Wikidata Descriptions';
                    break;
                case 'aliases':
                    helpUrl = 'https://www.wikidata.org/wiki/Help:Aliases';
                    helpText = 'Wikidata Aliases';
                    break;
                default:
                    helpUrl = 'https://www.wikidata.org/wiki/Help:Label';
                    helpText = 'Wikidata Metadata';
            }
            return `<a href="${helpUrl}" target="_blank" rel="noopener">${helpText}</a>`;
        })() : 
        'Wikidata Property';
    
    const rightHeader = createElement('div', {
        className: 'column-header'
    });
    rightHeader.innerHTML = rightHeaderContent;
    rightColumn.appendChild(rightHeader);
    
    // Property information or search section
    const searchSection = createElement('div', {
        className: 'property-search'
    });
    
    if (isMetadata) {
        // For metadata properties, show information instead of search
        let helpUrl, helpText, description;
        
        switch(property?.id) {
            case 'label':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Label';
                helpText = 'Labels';
                description = 'Labels are the main name given to identify an entity. They do not need to be unique. In Wikidata, labels are language-specific.';
                break;
            case 'description':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Description';
                helpText = 'Descriptions';
                description = 'Descriptions are short phrases that disambiguate items with similar labels. They are language-specific and should be lowercase except for proper nouns.';
                break;
            case 'aliases':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Aliases';
                helpText = 'Aliases';
                description = 'Aliases are alternative names for an entity. They help people find items even if they search for a name that is different from the label.';
                break;
            default:
                helpUrl = 'https://www.wikidata.org/wiki/Help:Label';
                helpText = 'Metadata';
                description = 'This is a metadata field for Wikidata entities.';
        }
        
        searchSection.innerHTML = `
            <div class="metadata-info">
                <h4>${helpText} Information</h4>
                <p>${description}</p>
                <p><a href="${helpUrl}" target="_blank" rel="noopener">Learn more about ${helpText} on Wikidata →</a></p>
                <div class="metadata-notice">
                    <strong>Note:</strong> ${helpText} are language-specific monolingual text values. You can map your Omeka S data to provide ${property?.label || 'metadata'} values for Wikidata entities.
                </div>
            </div>
        `;
    } else if (property) {
        // For existing custom properties, show property info
        const propertyInfo = createElement('div', {
            className: 'property-info'
        });
        const propertyDisplayText = `${property.label} (${property.id})`;
        
        propertyInfo.innerHTML = `
            <h4>Selected Property</h4>
            <p><strong>Property:</strong> ${propertyDisplayText}</p>
            <p><strong>Description:</strong> ${property.description}</p>
            <p><strong>ID:</strong> ${property.id}</p>
        `;
        searchSection.appendChild(propertyInfo);
    } else {
        // Property search for new custom properties
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
    }
    rightColumn.appendChild(searchSection);
    
    // Data type information section
    const dataTypeInfo = createElement('div', {
        className: 'datatype-info',
        id: 'datatype-info-section',
        style: isMetadata ? 'margin-top: 20px;' : 'margin-top: 20px; display: none;'
    });
    
    if (isMetadata) {
        // For metadata, always show monolingual text type
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Expected Value Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <span class="datatype-label">Monolingual text</span>
                </div>
                <div class="datatype-description">
                    <p>This field expects language-specific text values. Each value should be associated with a language code (e.g., "en" for English, "fr" for French).</p>
                </div>
            </div>
        `;
    } else if (property) {
        // Show property datatype
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Expected Value Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <span class="datatype-label">${property.datatypeLabel || property.datatype || 'Unknown'}</span>
                </div>
            </div>
        `;
        dataTypeInfo.style.display = 'block';
    } else {
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Expected Value Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <div class="datatype-loading">Select a property to see expected type...</div>
                </div>
            </div>
        `;
    }
    rightColumn.appendChild(dataTypeInfo);
    
    container.appendChild(rightColumn);
    
    // Setup search functionality for new properties (only for non-metadata)
    if (!isMetadata && !property) {
        setTimeout(() => setupUnifiedPropertySearch(), 100);
    } else if (isMetadata) {
        // Store metadata property as selected automatically
        window.currentUnifiedPropertySelected = {
            ...property,
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text'
        };
    }
    
    return container;
}

/**
 * Get selected property from unified modal
 */
export function getUnifiedSelectedPropertyFromModal() {
    return window.currentUnifiedPropertySelected || null;
}

/**
 * Update Stage 2 data type information for unified modal
 */
export function updateUnifiedStage2DataType(propertyData) {
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

/**
 * Select a property in manual property modal
 */
export async function selectManualProperty(property) {
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

/**
 * Display property constraints for manual property modal
 */
export async function displayManualPropertyConstraints(propertyId) {
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

/**
 * Update default value input based on property datatype
 */
export function updateDefaultValueInputForDatatype(propertyData) {
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

/**
 * Setup metadata transformation with automatic compose block
 */
function setupMetadataTransformation(property, keyData, state) {
    if (!property || !property.isMetadata || !state) return;
    
    // Generate mapping ID for this metadata property
    const mappingId = state.generateMappingId(
        property.label || property.id,
        property.id,
        undefined
    );
    
    // Check if transformation blocks already exist
    const existingBlocks = state.getTransformationBlocks(mappingId);
    
    if (existingBlocks.length === 0) {
        // Add a compose block automatically
        addTransformationBlock(mappingId, BLOCK_TYPES.COMPOSE, state);
    }
    
    // Hide the original value display after blocks are rendered
    setTimeout(() => {
        const originalValueDisplay = document.querySelector('.transformation-value-state.initial');
        if (originalValueDisplay) {
            originalValueDisplay.style.setProperty('display', 'none', 'important');
        }
    }, 200);
}

/**
 * Get manual property data from modal
 */
export function getManualPropertyFromModal() {
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