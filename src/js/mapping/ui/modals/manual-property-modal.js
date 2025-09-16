/**
 * Manual property modal functionality for editing and managing properties
 * Handles manual property editing and unified property interfaces
 * @module mapping/ui/modals/manual-property-modal
 */

// Import dependencies
import { createElement, showMessage } from '../../../ui/components.js';
import { getCompletePropertyData } from '../../../api/wikidata.js';
import { setupUnifiedPropertySearch } from '../../core/property-searcher.js';
import { renderValueTransformationUI } from '../../core/transformation-engine.js';
import { populateLists } from '../mapping-lists.js';
import { addManualPropertyToState } from './add-property-modal.js';

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
            buttons
        );
    });
}

/**
 * Creates unified property modal content
 */
export function createUnifiedPropertyModalContent(manualProp, keyData = null) {
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
        const valueTransformationContainer = renderValueTransformationUI(transformationKeyData, window.mappingStepState);
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