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
import { extractAllFields } from '../../../transformations.js';

/**
 * Opens the mapping modal for a key
 */
export function openMappingModal(keyData) {
    // Store keyData globally for modal title updates
    window.currentMappingKeyData = keyData;
    
    // Extract fields once for the entire modal session to optimize performance
    if (keyData && keyData.sampleValue && window.mappingStepState) {
        const currentState = window.mappingStepState.getState();
        
        if (currentState.fetchedData) {
            const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
            
            // Use first item that has any meaningful data (not looking for specific key)
            let fullItemData = items.find(item => {
                return typeof item === 'object' && item !== null && Object.keys(item).length > 0;
            });
            
            if (fullItemData) {
                keyData.extractedFields = extractAllFields(fullItemData);
            }
        }
    }
    
    // Import modal functionality
    import('../../../ui/modal-ui.js').then(({ setupModalUI }) => {
        const modalUI = setupModalUI();
        
        // Create modal content
        const modalContent = createMappingModalContent(keyData);
        
        // Create buttons based on whether this is an empty key or not
        const isEmptyKey = !keyData.key || keyData.key.trim() === '';
        const buttons = isEmptyKey ? [
            // For empty keys (Add Wikidata Property), only show confirm button
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
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        // For empty keys, create a synthetic key data using compose transformation
                        const syntheticKeyData = {
                            ...keyData,
                            key: `custom_${selectedProperty.id}`, // Create a unique key name
                            type: 'custom',
                            frequency: 1,
                            totalItems: 1,
                            isCustomProperty: true
                        };
                        mapKeyToProperty(syntheticKeyData, selectedProperty, window.mappingStepState);
                        modalUI.closeModal();
                        showMessage('Custom property added successfully', 'success', 3000);
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            }
        ] : [
            // Original buttons for normal keys
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
        const modalTitle = isEmptyKey ? 'Add Custom Wikidata Property' : createMappingRelationshipTitle(keyData.key, null);
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
    // Check if this is a metadata property (labels, descriptions, aliases)
    const isMetadata = keyData.isMetadata || ['label', 'description', 'aliases'].includes(keyData.key?.toLowerCase());
    
    // Check if this is an empty key (Add Wikidata Property button)
    const isEmptyKey = !keyData.key || keyData.key.trim() === '';
    
    const container = createElement('div', {
        className: isEmptyKey ? 'mapping-modal-content single-column-layout' : 'mapping-modal-content two-column-layout'
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
    
    // For empty keys, show only compose transformation section
    if (isEmptyKey) {
        // Create standalone transformation section for empty keys
        const standaloneTransformation = createElement('div', {
            className: 'standalone-transformation-section'
        });
        
        const transformationHeader = createElement('h3', {}, 'Value Composition');
        standaloneTransformation.appendChild(transformationHeader);
        
        const transformationDescription = createElement('p', {
            className: 'transformation-description'
        }, 'Use the compose block to create custom property values by combining static text and data from your items.');
        standaloneTransformation.appendChild(transformationDescription);
        
        const valueTransformationContainer = renderValueTransformationUI(keyData, window.mappingStepState, true); // Force compose mode
        standaloneTransformation.appendChild(valueTransformationContainer);
        
        container.appendChild(standaloneTransformation);
        
        // Skip to property search section for empty keys
    } else {
        // LEFT COLUMN - Omeka S Data (only for non-empty keys)
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
                
                // For metadata fields, ensure compose transformation is added by default
                if (isMetadata) {
                    const composeContainer = document.querySelector('.transformation-blocks');
                    if (composeContainer && !composeContainer.hasChildNodes()) {
                        // Add a default compose block for metadata
                        const addComposeBtn = document.querySelector('.add-compose-btn');
                        if (addComposeBtn) {
                            addComposeBtn.click();
                        }
                    }
                }
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
    }
    
    // RIGHT COLUMN - Wikidata Property
    const rightColumn = createElement('div', {
        className: isEmptyKey ? 'mapping-column full-column' : 'mapping-column right-column'
    });
    
    // Column header with link to Wikidata help page
    const rightHeaderText = isMetadata ? 
        `<a href="https://www.wikidata.org/wiki/Help:Label" target="_blank" rel="noopener">Wikidata ${keyData.key || 'Property'}</a>` : 
        'Wikidata Property';
    const rightHeader = createElement('div', {
        className: 'column-header'
    });
    rightHeader.innerHTML = rightHeaderText;
    rightColumn.appendChild(rightHeader);
    
    // Property search section or metadata information
    const searchSection = createElement('div', {
        className: 'property-search'
    });
    
    if (isMetadata) {
        // For metadata properties, show information instead of search
        const metadataType = keyData.key?.toLowerCase();
        let helpUrl, helpText, description;
        
        switch(metadataType) {
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
                    <strong>Note:</strong> ${helpText} are language-specific monolingual text values. You can map your Omeka S data to provide ${metadataType} values for Wikidata entities.
                </div>
            </div>
        `;
    } else {
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
    }
    rightColumn.appendChild(searchSection);
    
    // Data type information section (Stage 2 content)
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
    
    // Setup search functionality and pre-populate if mapped (only for non-metadata)
    if (!isMetadata) {
        setTimeout(() => {
            setupPropertySearch(keyData, window.mappingStepState);
            // Setup entity schema property dropdown if it exists
            setupEntitySchemaPropertySelection(window.mappingStepState);
        }, 100);
    } else {
        // For metadata properties, store them as selected automatically
        window.currentMappingSelectedProperty = {
            id: keyData.key?.toLowerCase(),
            label: keyData.key,
            description: `${keyData.key} for Wikidata entities`,
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text',
            isMetadata: true
        };
    }
    
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
    // For metadata properties, ensure the property is properly formatted
    const property = window.currentMappingSelectedProperty;
    if (property && property.isMetadata) {
        // Ensure metadata properties have the correct structure
        return {
            ...property,
            id: property.id || property.label?.toLowerCase(),
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text'
        };
    }
    return property;
}

/**
 * Create mapping relationship title with arrow
 */
function createMappingRelationshipTitle(keyName, property) {
    const sourceSpan = `<span class="mapping-source">${keyName}</span>`;
    const arrow = `<span class="mapping-arrow">→</span>`;
    const targetSpan = property 
        ? `<span class="mapping-target clickable" data-property-id="${property.id}" title="View on Wikidata" style="cursor: pointer; text-decoration: underline;">${property.label} (${property.id})</span>`
        : `<span class="mapping-target unmapped">unmapped</span>`;
    
    return `<div class="mapping-relationship-header">${sourceSpan}${arrow}${targetSpan}</div>`;
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
        
        // Make the target property clickable
        const targetSpan = modalTitle.querySelector('.mapping-target.clickable');
        if (targetSpan) {
            targetSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                const propertyId = targetSpan.dataset.propertyId;
                if (propertyId) {
                    window.open(`https://www.wikidata.org/wiki/Property:${propertyId}`, '_blank');
                }
            });
        }
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