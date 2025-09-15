/**
 * Mapping modal functionality for property selection and configuration
 * Handles the main property mapping modal interface
 * @module mapping/ui/modals/mapping-modal
 */

// Import dependencies
import { createElement } from '../../../ui/components.js';
import { setupPropertySearch, extractEntitySchemaProperties, setupEntitySchemaPropertySelection } from '../../core/property-searcher.js';
import { renderValueTransformationUI } from '../../core/transformation-engine.js';
import { moveKeyToCategory, mapKeyToProperty, moveToNextUnmappedKey } from '../mapping-lists.js';
import { formatSampleValue } from './modal-helpers.js';
import { showMessage } from '../../../ui/components.js';
import { extractAtFieldsFromAllItems, extractAllFieldsFromItems } from '../../core/data-analyzer.js';

/**
 * Opens the mapping modal for a key
 */
export function openMappingModal(keyData) {
    // Store keyData globally for modal title updates
    window.currentMappingKeyData = keyData;
    
    // Import modal functionality
    import('../../../ui/modal-ui.js').then(({ setupModalUI }) => {
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
                    moveKeyToCategory(keyData, 'ignored', window.mappingStepState);
                    modalUI.closeModal();
                }
            },
            {
                text: 'Ignore and Next',
                type: 'secondary',
                keyboardShortcut: 'x',
                callback: () => {
                    moveKeyToCategory(keyData, 'ignored', window.mappingStepState);
                    modalUI.closeModal();
                    moveToNextUnmappedKey(window.mappingStepState);
                }
            },
            {
                text: 'Confirm',
                type: 'secondary',
                keyboardShortcut: 'c',
                callback: () => {
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        modalUI.closeModal();
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            },
            {
                text: 'Confirm and Duplicate',
                type: 'secondary',
                keyboardShortcut: 'd',
                callback: () => {
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        // Save the current mapping
                        mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        modalUI.closeModal();
                        
                        // Open a new modal for the same key with reset configuration
                        setTimeout(() => {
                            // Create a fresh keyData object for the duplicate
                            const duplicateKeyData = {
                                ...keyData,
                                selectedAtField: undefined,  // Reset @ field selection
                                selectedTransformationField: undefined,  // Reset transformation
                                isDuplicate: true  // Mark as duplicate
                            };
                            openMappingModal(duplicateKeyData);
                        }, 100);
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
                        mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        modalUI.closeModal();
                        moveToNextUnmappedKey(window.mappingStepState);
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            }
        ];
        
        // Open modal with mapping relationship header
        const modalTitle = createMappingRelationshipTitle(keyData.key, null);
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
 * Creates mapping modal content with two-column layout
 */
export function createMappingModalContent(keyData) {
    const container = createElement('div', {
        className: 'mapping-modal-content two-column-layout'
    });
    
    // Add duplicate notice if this is a duplicate mapping
    if (keyData.isDuplicate) {
        const duplicateNotice = createElement('div', {
            className: 'duplicate-notice'
        });
        duplicateNotice.innerHTML = `
            <div class="duplicate-notice-content">
                <strong>Creating duplicate mapping for:</strong> ${keyData.key}
                <p>Select a different @ field or property to create an additional mapping for this key.</p>
            </div>
        `;
        container.appendChild(duplicateNotice);
    }
    
    // LEFT COLUMN - Omeka S Data
    const leftColumn = createElement('div', {
        className: 'mapping-column left-column'
    });
    
    // Column header
    const leftHeader = createElement('div', {
        className: 'column-header'
    }, 'Omeka S Data');
    leftColumn.appendChild(leftHeader);
    
    // Key information section
    const keyInfo = createElement('div', {
        className: 'key-info'
    });
    
    const keyDisplay = keyData.linkedDataUri 
        ? `<a href="${keyData.linkedDataUri}" target="_blank" class="clickable-key">${keyData.key}</a>`
        : keyData.key;
    
    // Basic key info (always visible)
    const basicInfo = createElement('div', {});
    basicInfo.innerHTML = `
        <h4>Key Information</h4>
        <p><strong>Key:</strong> ${keyDisplay}</p>
        <p><strong>Frequency:</strong> ${keyData.frequency || 1} out of ${keyData.totalItems || 1} items</p>
    `;
    keyInfo.appendChild(basicInfo);
    
    // Field selector section (for JSON-LD fields - both @ fields and regular fields)
    const atFieldSection = createElement('div', {
        className: 'at-field-section'
    });
    
    // Check if this key has fields across all items
    const currentState = window.mappingStepState.getState();
    if (currentState.fetchedData) {
        const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
        const fieldGroups = extractAllFieldsFromItems(keyData.key, items);
        
        if (fieldGroups.length > 0) {
            const atFieldLabel = createElement('label', {
                className: 'at-field-label'
            }, 'Original Key Field:');
            
            const atFieldSelect = createElement('select', {
                className: 'at-field-select',
                id: `at-field-select-${keyData.key.replace(/[^a-zA-Z0-9]/g, '_')}`,
                onChange: (e) => {
                    // Store the selected field in the keyData for later use
                    keyData.selectedAtField = e.target.value;
                    
                    // Update sample values if they're already loaded
                    const samplesContent = document.querySelector('.samples-content');
                    if (samplesContent && samplesContent.hasChildNodes()) {
                        loadSampleValues(samplesContent, keyData, window.mappingStepState);
                    }
                }
            });
            
            // Set default selection to @id if available, then @value, then first option
            let defaultField = null;
            
            // Find default field from all groups
            for (const group of fieldGroups) {
                const idField = group.fields.find(field => field.key === '@id');
                const valueField = group.fields.find(field => field.key === '@value');
                
                if (idField) {
                    defaultField = idField;
                    break;
                } else if (valueField && !defaultField) {
                    defaultField = valueField;
                }
            }
            
            // If no @ fields found, use first field
            if (!defaultField && fieldGroups[0] && fieldGroups[0].fields.length > 0) {
                defaultField = fieldGroups[0].fields[0];
            }
            
            // Store the default selection
            if (defaultField) {
                keyData.selectedAtField = defaultField.key;
            }
            
            // Populate options with optgroups for each object structure
            fieldGroups.forEach((group, groupIndex) => {
                if (group.fields.length === 0) return;
                
                // Create optgroup for this object structure
                const optGroup = createElement('optgroup', {
                    label: fieldGroups.length > 1 ? `Object Type ${groupIndex + 1}` : 'Available Fields'
                });
                
                // Add fields to optgroup
                group.fields.forEach(field => {
                    const option = createElement('option', {
                        value: field.key,
                        selected: defaultField && field.key === defaultField.key
                    }, `${field.key}: ${field.preview}`);
                    optGroup.appendChild(option);
                });
                
                atFieldSelect.appendChild(optGroup);
            });
            
            atFieldSection.appendChild(atFieldLabel);
            atFieldSection.appendChild(atFieldSelect);
            keyInfo.appendChild(atFieldSection);
        }
    }
    
    // Sample values section (collapsible)
    const samplesSection = createElement('div', {
        className: 'samples-section'
    });
    
    // Sample toggle button
    const samplesToggle = createElement('button', {
        className: 'samples-toggle',
        onClick: () => {
            const isExpanded = samplesSection.classList.contains('expanded');
            if (isExpanded) {
                samplesSection.classList.remove('expanded');
                samplesToggle.textContent = '▶ Show Sample Values';
            } else {
                samplesSection.classList.add('expanded');
                samplesToggle.textContent = '▼ Hide Sample Values';
                
                // Load samples if not already loaded
                if (!samplesContent.hasChildNodes()) {
                    loadSampleValues(samplesContent, keyData, window.mappingStepState);
                }
            }
        }
    }, '▶ Show Sample Values');
    
    samplesSection.appendChild(samplesToggle);
    
    // Collapsible samples content
    const samplesContent = createElement('div', {
        className: 'samples-content'
    });
    
    samplesSection.appendChild(samplesContent);
    keyInfo.appendChild(samplesSection);
    leftColumn.appendChild(keyInfo);
    
    // Value transformation section (Stage 3) - Collapsible
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
            }
        }
    }, '▶ Add Transformation');
    
    transformationSection.appendChild(transformationToggle);
    
    // Collapsible content container
    const transformationContent = createElement('div', {
        className: 'transformation-content'
    });
    
    const transformationHeader = createElement('h4', {}, 'Value Transformation');
    transformationContent.appendChild(transformationHeader);
    
    const valueTransformationContainer = renderValueTransformationUI(keyData, window.mappingStepState);
    transformationContent.appendChild(valueTransformationContainer);
    
    transformationSection.appendChild(transformationContent);
    leftColumn.appendChild(transformationSection);
    
    container.appendChild(leftColumn);
    
    // RIGHT COLUMN - Wikidata Property
    const rightColumn = createElement('div', {
        className: 'mapping-column right-column'
    });
    
    // Column header
    const rightHeader = createElement('div', {
        className: 'column-header'
    }, 'Wikidata Property');
    rightColumn.appendChild(rightHeader);
    
    // Property search section
    const searchSection = createElement('div', {
        className: 'property-search'
    });
    
    // Check if entity schema is selected to conditionally add dropdown
    const schemaState = window.mappingStepState?.getState();
    const selectedSchema = schemaState?.selectedEntitySchema;
    const hasEntitySchemaProperties = selectedSchema?.properties && 
        (selectedSchema.properties.required?.length > 0 || selectedSchema.properties.optional?.length > 0);
    
    const entitySchemaDropdownHTML = hasEntitySchemaProperties ? `
        <div class="entity-schema-properties" id="entity-schema-properties">
            <label for="entity-schema-property-select">Properties from Entity Schema:</label>
            <select class="entity-schema-property-select" id="entity-schema-property-select">
                <option value="">Select a property from schema...</option>
            </select>
            <small class="schema-indicator">These properties are recommended by the selected entity schema</small>
        </div>
    ` : '';
    
    searchSection.innerHTML = `
        ${entitySchemaDropdownHTML}
        <h4>Search Properties</h4>
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
    rightColumn.appendChild(searchSection);
    
    // Data type information section (Stage 2 content)
    const dataTypeInfo = createElement('div', {
        className: 'datatype-info',
        id: 'datatype-info-section',
        style: 'margin-top: 20px; display: none;'
    });
    dataTypeInfo.innerHTML = `
        <div class="datatype-display">
            <h4>Expected Value Type</h4>
            <div id="detected-datatype" class="detected-datatype">
                <div class="datatype-loading">Select a property to see expected type...</div>
            </div>
        </div>
    `;
    rightColumn.appendChild(dataTypeInfo);
    
    container.appendChild(rightColumn);
    
    // Setup search functionality and pre-populate if mapped
    setTimeout(() => {
        setupPropertySearch(keyData, window.mappingStepState);
        // Setup entity schema property dropdown if it exists
        setupEntitySchemaPropertySelection(window.mappingStepState);
    }, 100);
    
    return container;
}

/**
 * Load sample values for the collapsible samples section
 */
function loadSampleValues(container, keyData, state) {
    const currentState = state.getState();
    if (!currentState.fetchedData) {
        container.innerHTML = '<div class="no-samples">No sample data available</div>';
        return;
    }
    
    const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
    const samples = [];
    const maxSamples = 5;
    
    // Extract up to 5 sample values for this key
    for (const item of items) {
        if (samples.length >= maxSamples) break;
        if (item[keyData.key] !== undefined) {
            let valueToFormat = item[keyData.key];
            
            // If a specific @ field is selected, extract that field's value
            if (keyData.selectedAtField) {
                const keyValue = item[keyData.key];
                const valuesToProcess = Array.isArray(keyValue) ? keyValue : [keyValue];
                
                // Look for the selected @ field in the first available value
                for (const value of valuesToProcess) {
                    if (value && typeof value === 'object' && value[keyData.selectedAtField] !== undefined) {
                        valueToFormat = value[keyData.selectedAtField];
                        break;
                    }
                }
            }
            
            const sampleHtml = formatSampleValue(valueToFormat, keyData.contextMap || new Map());
            samples.push(sampleHtml);
        }
    }
    
    if (samples.length === 0) {
        container.innerHTML = '<div class="no-samples">No sample values found</div>';
        return;
    }
    
    // Display samples
    const samplesHtml = samples.map((sample, index) => `
        <div class="sample-item">
            <strong>Sample ${index + 1}:</strong> ${sample}
        </div>
    `).join('');
    
    container.innerHTML = samplesHtml;
}

/**
 * Get selected property from modal
 */
export function getSelectedPropertyFromModal() {
    return window.currentMappingSelectedProperty;
}

/**
 * Create mapping relationship title with arrow
 */
function createMappingRelationshipTitle(keyName, property) {
    const sourceSpan = `<span class="mapping-source">${keyName}</span>`;
    const arrow = `<span class="mapping-arrow">→</span>`;
    const targetSpan = property 
        ? `<span class="mapping-target">${property.label} (${property.id})</span>`
        : `<span class="mapping-target unmapped">unmapped</span>`;
    
    return `<div class="mapping-relationship-header">${sourceSpan} ${arrow} ${targetSpan}</div>`;
}

/**
 * Update the modal title to show the mapping relationship
 */
export function updateModalTitle(property) {
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle && window.currentMappingKeyData) {
        const keyName = window.currentMappingKeyData.key || 'Key';
        const titleHtml = createMappingRelationshipTitle(keyName, property);
        modalTitle.innerHTML = titleHtml;
    }
}

/**
 * Update Stage 2 summary to show detected data type
 */
export function updateStage2Summary(property) {
    // In two-column layout, update the datatype section visibility and content
    const datatypeSection = document.getElementById('datatype-info-section');
    const datatypeDisplay = document.getElementById('detected-datatype');
    
    if (datatypeSection && datatypeDisplay && property && property.datatypeLabel) {
        datatypeSection.style.display = 'block';
        datatypeDisplay.innerHTML = `
            <div class="datatype-item">
                <strong>Type:</strong> ${property.datatypeLabel}
            </div>
        `;
    }
}