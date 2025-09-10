/**
 * Property modals UI module
 * Handles modal creation, management, and interaction for property mapping
 * @module mapping/ui/property-modals
 */

// Import dependencies
import { eventSystem } from '../../events.js';
import { createElement, createButton, createModal, showMessage } from '../../ui/components.js';
import { getCompletePropertyData } from '../../api/wikidata.js';
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
} from '../core/property-searcher.js';
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
} from '../core/transformation-engine.js';
import { populateLists, moveKeyToCategory, mapKeyToProperty, moveToNextUnmappedKey } from './mapping-lists.js';

/**
 * Opens the mapping modal for a key
 */
export function openMappingModal(keyData) {
    // Store keyData globally for modal title updates
    window.currentMappingKeyData = keyData;
    
    // Import modal functionality
    import('../../ui/modal-ui.js').then(({ setupModalUI }) => {
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
        
        // Open modal
        modalUI.openModal(
            `Map Key: ${keyData.key}`,
            modalContent,
            buttons
        );
    });
}

/**
 * Opens the manual property edit modal
 */
export function openManualPropertyEditModal(manualProp) {
    // Import modal functionality
    import('../../ui/modal-ui.js').then(({ setupModalUI }) => {
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
 * Opens the add manual property modal
 */
export function openAddManualPropertyModal() {
    // Import modal functionality
    import('../../ui/modal-ui.js').then(({ setupModalUI }) => {
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

/**
 * Creates mapping modal content
 */
export function createMappingModalContent(keyData) {
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
    const valueTransformationContainer = renderValueTransformationUI(keyData, window.mappingStepState);
    stage3Content.appendChild(valueTransformationContainer);
    stage3Section.appendChild(stage3Content);
    container.appendChild(stage3Section);
    
    // Setup search functionality and pre-populate if mapped
    setTimeout(() => setupPropertySearch(keyData, window.mappingStepState), 100);
    
    return container;
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
 * Opens raw JSON modal
 */
export function openRawJsonModal(propertyData) {
    import('../../ui/modal-ui.js').then(({ setupModalUI }) => {
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

// Additional helper functions for modal functionality

/**
 * Format sample value for display
 */
export function formatSampleValue(value, contextMap = new Map()) {
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

/**
 * Helper function to make JSON keys clickable
 */
export function makeJsonKeysClickable(jsonStr, contextMap) {
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

/**
 * Helper function to generate URI for a key
 */
export function generateUriForKey(key, contextMap) {
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

/**
 * Update the modal title to show the mapping relationship
 */
export function updateModalTitle(property) {
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle && window.currentMappingKeyData) {
        const keyName = window.currentMappingKeyData.key || 'Key';
        modalTitle.textContent = `${keyName} → ${property.label} (${property.id})`;
    }
}

/**
 * Update Stage 2 summary to show detected data type
 */
export function updateStage2Summary(property) {
    const stage2Summary = document.getElementById('stage-2-summary');
    if (stage2Summary && property && property.datatypeLabel) {
        stage2Summary.textContent = `Stage 2: Value type is ${property.datatypeLabel}`;
    }
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
 * Get selected property from unified modal
 */
export function getUnifiedSelectedPropertyFromModal() {
    return window.currentUnifiedPropertySelected || null;
}

/**
 * Remove manual property from UI and state
 */
export function removeManualPropertyFromUI(propertyId) {
    // Check if this property can be removed
    const currentState = window.mappingStepState.getState();
    const property = currentState.mappings.manualProperties.find(p => p.property.id === propertyId);
    
    if (property && property.cannotRemove) {
        showMessage('This property cannot be removed', 'warning', 2000);
        return;
    }
    
    window.mappingStepState.removeManualProperty(propertyId);
    populateLists(window.mappingStepState);
    showMessage('Additional property removed', 'success', 2000);
}

/**
 * Get selected property from modal
 */
export function getSelectedPropertyFromModal() {
    return window.currentMappingSelectedProperty;
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

/**
 * Add manual property to state
 */
export function addManualPropertyToState(property, defaultValue, isRequired) {
    const manualProperty = {
        property,
        defaultValue,
        isRequired
    };
    
    window.mappingStepState.addManualProperty(manualProperty);
    
    // Refresh the UI
    populateLists(window.mappingStepState);
    
    showMessage(`Added additional property: ${property.label} (${property.id})`, 'success', 3000);
}