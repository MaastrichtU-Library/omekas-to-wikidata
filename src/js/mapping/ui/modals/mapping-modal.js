/**
 * Mapping modal functionality for property selection and configuration
 * Handles the main property mapping modal interface
 * @module mapping/ui/modals/mapping-modal
 */

// Import dependencies
import { createElement } from '../../../ui/components.js';
import { setupPropertySearch } from '../../core/property-searcher.js';
import { renderValueTransformationUI } from '../transformation-ui.js';
import { moveKeyToCategory, mapKeyToProperty, moveToNextUnmappedKey } from '../mapping-lists.js';
import { formatSampleValue } from './modal-helpers.js';
import { showMessage } from '../../../ui/components.js';

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
 * Get selected property from modal
 */
export function getSelectedPropertyFromModal() {
    return window.currentMappingSelectedProperty;
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