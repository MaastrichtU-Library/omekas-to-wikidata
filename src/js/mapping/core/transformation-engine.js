/**
 * Value transformation engine
 * Handles transformation blocks, UI rendering, and preview functionality  
 * Restored to original working architecture
 * @module mapping/core/transformation-engine
 */

// Import dependencies
import { createElement, createButton } from '../../ui/components.js';
import { BLOCK_TYPES, BLOCK_METADATA, createTransformationBlock, getTransformationPreview, extractAllFields, searchFields, COMMON_REGEX_PATTERNS } from '../../transformations.js';
import { 
    extractAvailableFields,
    getFieldValueFromSample,
    convertSampleValueToString 
} from './data-analyzer.js';

// Global variable to track currently dragged element 
let currentDraggedElement = null;

/**
 * Renders the value transformation UI for Stage 3
 * @param {Object} keyData - The mapped key data
 * @param {Object} state - The application state
 * @returns {HTMLElement} The transformation UI container
 */
export function renderValueTransformationUI(keyData, state) {
    const container = createElement('div', {
        className: 'value-transformation-container',
        id: 'value-transformation-section'
    });

    // Property ID for transformation blocks - simple approach that works
    let currentProperty = window.currentMappingSelectedProperty || keyData?.property;
    let propertyId = currentProperty?.id;
    
    // Simple validation (no complex retry logic)
    if (!propertyId) {
        container.appendChild(createElement('div', {
            className: 'transformation-message'
        }, 'Select a property first to configure value transformations'));
        return container;
    }

    // Field selector section
    const rawSampleValue = keyData.sampleValue;
    const availableFields = extractAvailableFields(rawSampleValue);
    
    if (availableFields.length > 1) {
        const fieldSelectorSection = createElement('div', { className: 'field-selector-section' });
        
        const selectorLabel = createElement('label', { className: 'field-selector-label' }, 
            'Select field to transform:');
        
        const fieldSelect = createElement('select', {
            className: 'field-selector',
            id: `field-selector-${propertyId}`,
            onChange: (e) => {
                refreshTransformationFieldPreview(propertyId, state);
            }
        });
        
        // Find the most logical default field (prefer keys with "@")
        let defaultField = availableFields.find(field => field.key.startsWith('@'));
        if (!defaultField) {
            defaultField = availableFields[0];
        }
        
        // Populate field options
        availableFields.forEach(field => {
            const option = createElement('option', {
                value: field.key,
                selected: field.key === defaultField.key
            }, `${field.key}: ${field.preview || field.sampleValue}`);
            fieldSelect.appendChild(option);
        });
        
        fieldSelectorSection.appendChild(selectorLabel);
        fieldSelectorSection.appendChild(fieldSelect);
        container.appendChild(fieldSelectorSection);
    }

    // Sample value for transformations
    const selectedField = availableFields.length > 1 ? 
        (document.getElementById(`field-selector-${propertyId}`)?.value || availableFields[0]?.key) :
        availableFields[0]?.key;
    
    const sampleValue = selectedField ? 
        getFieldValueFromSample(rawSampleValue, selectedField) :
        convertSampleValueToString(rawSampleValue) || 'Sample Value';

    // Transformation blocks container
    const blocksContainer = createElement('div', {
        className: 'transformation-blocks-container',
        id: `transformation-blocks-${propertyId}`
    });

    // Add transformation section - SIMPLE dropdown approach (original working method)
    const addBlockSection = createElement('div', { className: 'add-block-section' });
    const blockTypeSelect = createElement('select', {
        className: 'block-type-select',
        id: `block-type-select-${propertyId}`
    });

    // Add options for each block type
    Object.entries(BLOCK_METADATA).forEach(([type, metadata]) => {
        const option = createElement('option', {
            value: type,
            disabled: metadata.isPlaceholder
        }, metadata.name);
        blockTypeSelect.appendChild(option);
    });

    // SIMPLE add button - original working approach
    const addBlockBtn = createElement('button', {
        className: 'button button--secondary',
        onClick: () => addTransformationBlock(propertyId, blockTypeSelect.value, state)
    }, '+ Add Transformation');

    addBlockSection.appendChild(blockTypeSelect);
    addBlockSection.appendChild(addBlockBtn);

    // Store sample value for refreshes
    blocksContainer.dataset.sampleValue = sampleValue;

    // Initial render of transformation blocks
    renderTransformationBlocks(propertyId, sampleValue, blocksContainer, state);

    container.appendChild(blocksContainer);
    container.appendChild(addBlockSection);

    return container;
}

/**
 * Refreshes the transformation field preview when field selection changes
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function refreshTransformationFieldPreview(propertyId, state) {
    const fieldSelector = document.getElementById(`field-selector-${propertyId}`);
    const container = document.getElementById(`transformation-blocks-${propertyId}`);
    
    if (!fieldSelector || !container) return;

    const keyData = window.currentMappingKeyData;
    if (!keyData) return;

    const selectedField = fieldSelector.value;
    const newSampleValue = getFieldValueFromSample(keyData.sampleValue, selectedField);
    
    // Update stored sample value
    container.dataset.sampleValue = newSampleValue;
    
    // Update the preview
    updateTransformationPreview(propertyId, state);
}

/**
 * Adds a new transformation block to a property
 * @param {string} propertyId - The property ID
 * @param {string} blockType - The type of block to add
 * @param {Object} state - Application state
 */
export function addTransformationBlock(propertyId, blockType, state) {
    const newBlock = createTransformationBlock(blockType);
    state.addTransformationBlock(propertyId, newBlock);
    refreshTransformationUI(propertyId, state);
}

/**
 * Updates only the transformation preview values without re-rendering the entire UI
 * This prevents input fields from losing focus on every keystroke
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function updateTransformationPreview(propertyId, state) {
    const container = document.getElementById(`transformation-blocks-${propertyId}`);
    if (!container || !container.dataset.sampleValue) return;

    const sampleValue = container.dataset.sampleValue;
    const blocks = state.getTransformationBlocks(propertyId);
    const preview = getTransformationPreview(sampleValue, blocks);

    // Update each value state display
    const valueStates = container.querySelectorAll('.transformation-value-state');
    preview.steps.forEach((step, index) => {
        if (valueStates[index]) {
            const valueContent = valueStates[index].querySelector('.value-content');
            if (valueContent) {
                valueContent.textContent = step.value || '(empty)';
            }
        }
    });
}

/**
 * Refreshes the transformation UI for a property (full re-render)
 * Use sparingly as this will cause input fields to lose focus
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function refreshTransformationUI(propertyId, state) {
    const container = document.getElementById(`transformation-blocks-${propertyId}`);
    if (container && container.dataset.sampleValue) {
        renderTransformationBlocks(propertyId, container.dataset.sampleValue, container, state);
    }
}

/**
 * Refreshes the Stage 3 transformation UI when keyData changes
 * @param {Object} keyData - The key data
 * @param {Object} state - Application state
 */
export function refreshStage3TransformationUI(keyData, state) {
    const stage3Container = document.getElementById('stage-3-value-transformation');
    if (stage3Container) {
        const transformationContainer = stage3Container.querySelector('.stage-content');
        if (transformationContainer) {
            transformationContainer.innerHTML = '';
            const newUI = renderValueTransformationUI(keyData, state);
            transformationContainer.appendChild(newUI);
        }
    }
}

/**
 * Renders the list of transformation blocks for a property
 * @param {string} propertyId - The property ID
 * @param {string} sampleValue - Sample value for preview
 * @param {HTMLElement} container - Container to render into
 * @param {Object} state - Application state
 */
export function renderTransformationBlocks(propertyId, sampleValue, container, state) {
    // Clear existing content
    container.innerHTML = '';

    const blocks = state.getTransformationBlocks(propertyId);
    
    if (blocks.length === 0) {
        container.appendChild(createElement('div', {
            className: 'no-transformations-message'
        }, 'No transformations configured. Add a transformation to modify values before reconciliation.'));
        return;
    }

    // Get transformation preview with all steps
    const preview = getTransformationPreview(sampleValue, blocks);

    // Create transformation flow visualization
    const flowContainer = createElement('div', { className: 'transformation-flow' });
    
    preview.steps.forEach((step, index) => {
        // Value state display
        const valueDisplay = createElement('div', { 
            className: `transformation-value-state ${index === 0 ? 'initial' : index === preview.steps.length - 1 ? 'final' : 'intermediate'}`
        });
        
        valueDisplay.appendChild(createElement('div', { className: 'value-label' },
            index === 0 ? 'Original Value:' : 
            index === preview.steps.length - 1 ? 'Final Value:' : 
            `After Step ${index}:`));
        
        valueDisplay.appendChild(createElement('div', { className: 'value-content' }, 
            step.value || '(empty)'));

        flowContainer.appendChild(valueDisplay);

        // Add transformation block (except after the last step)
        if (index < preview.steps.length - 1) {
            const block = blocks.find(b => b.id === preview.steps[index + 1].blockId);
            if (block) {
                const blockUI = renderTransformationBlockUI(propertyId, block, state);
                flowContainer.appendChild(blockUI);
            }
        }
    });

    container.appendChild(flowContainer);
}

/**
 * Renders a single transformation block UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @returns {HTMLElement} Block UI element
 */
export function renderTransformationBlockUI(propertyId, block, state) {
    const metadata = BLOCK_METADATA[block.type];
    const blockElement = createElement('div', {
        className: `transformation-block transformation-block--${block.type}`,
        dataset: { blockId: block.id }
    });

    // Block header with drag handle and controls
    const blockHeader = createElement('div', { 
        className: 'block-header',
        draggable: 'true'
    });
    
    const dragHandle = createElement('div', { 
        className: 'drag-handle',
        title: 'Drag to reorder'
    }, '⋮⋮');
    
    const blockInfo = createElement('div', { className: 'block-info' });
    blockInfo.appendChild(createElement('span', { className: 'block-icon' }, metadata.icon));
    blockInfo.appendChild(createElement('span', { className: 'block-name' }, metadata.name));

    const blockControls = createElement('div', { className: 'block-controls' });
    const removeBtn = createElement('button', {
        className: 'remove-block-btn',
        title: 'Remove transformation',
        onClick: () => {
            state.removeTransformationBlock(propertyId, block.id);
            refreshTransformationUI(propertyId, state);
        }
    }, '×');
    
    blockControls.appendChild(removeBtn);
    
    blockHeader.appendChild(dragHandle);
    blockHeader.appendChild(blockInfo);
    blockHeader.appendChild(blockControls);

    // Block configuration
    const blockConfig = createElement('div', { className: 'block-config' });
    blockConfig.appendChild(renderBlockConfigUI(propertyId, block, state));

    blockElement.appendChild(blockHeader);
    blockElement.appendChild(blockConfig);

    // Add drag and drop handlers
    addDragHandlers(blockElement, blockHeader, propertyId, state);

    return blockElement;
}

/**
 * Renders the configuration UI for a specific block type
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @returns {HTMLElement} Configuration UI
 */
export function renderBlockConfigUI(propertyId, block, state) {
    const configContainer = createElement('div', { className: 'block-config-content' });
    
    switch (block.type) {
        case BLOCK_TYPES.PREFIX:
            return renderPrefixSuffixConfigUI(propertyId, block, state, 'Prefix text:');
        
        case BLOCK_TYPES.SUFFIX:
            return renderPrefixSuffixConfigUI(propertyId, block, state, 'Suffix text:');
            
        case BLOCK_TYPES.FIND_REPLACE:
            return renderFindReplaceConfigUI(propertyId, block, state);
            
        case BLOCK_TYPES.COMPOSE:
            return renderComposeConfigUI(propertyId, block, state);
            
        case BLOCK_TYPES.REGEX:
            return renderRegexConfigUI(propertyId, block, state);
            
        default:
            return createElement('div', {}, 'Unknown block type');
    }
}

/**
 * Renders prefix/suffix configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @param {string} label - Label for the input field
 * @returns {HTMLElement} Configuration UI
 */
export function renderPrefixSuffixConfigUI(propertyId, block, state, label) {
    const container = createElement('div', { className: 'config-field' });
    
    const labelElement = createElement('label', {}, label);
    const input = createElement('input', {
        type: 'text',
        value: block.config.text || '',
        placeholder: `Enter ${block.type} text...`,
        onInput: (e) => {
            state.updateTransformationBlock(propertyId, block.id, { text: e.target.value });
            updateTransformationPreview(propertyId, state);
        }
    });
    
    container.appendChild(labelElement);
    container.appendChild(input);
    return container;
}

/**
 * Renders find/replace configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @returns {HTMLElement} Configuration UI
 */
export function renderFindReplaceConfigUI(propertyId, block, state) {
    const container = createElement('div', { className: 'config-fields' });
    
    // Find field
    const findField = createElement('div', { className: 'config-field' });
    findField.appendChild(createElement('label', {}, 'Find:'));
    const findInput = createElement('input', {
        type: 'text',
        value: block.config.find || '',
        placeholder: 'Text to find...',
        onInput: (e) => {
            state.updateTransformationBlock(propertyId, block.id, { find: e.target.value });
            updateTransformationPreview(propertyId, state);
        }
    });
    findField.appendChild(findInput);
    
    // Replace field
    const replaceField = createElement('div', { className: 'config-field' });
    replaceField.appendChild(createElement('label', {}, 'Replace with:'));
    const replaceInput = createElement('input', {
        type: 'text',
        value: block.config.replace || '',
        placeholder: 'Replacement text...',
        onInput: (e) => {
            state.updateTransformationBlock(propertyId, block.id, { replace: e.target.value });
            updateTransformationPreview(propertyId, state);
        }
    });
    replaceField.appendChild(replaceInput);
    
    // Options
    const optionsField = createElement('div', { className: 'config-options' });
    
    const caseSensitiveCheck = createElement('input', {
        type: 'checkbox',
        id: `case-sensitive-${block.id}`,
        checked: block.config.caseSensitive || false,
        onChange: (e) => {
            state.updateTransformationBlock(propertyId, block.id, { caseSensitive: e.target.checked });
            updateTransformationPreview(propertyId, state);
        }
    });
    
    const caseSensitiveLabel = createElement('label', {
        htmlFor: `case-sensitive-${block.id}`
    }, 'Case sensitive');
    
    optionsField.appendChild(caseSensitiveCheck);
    optionsField.appendChild(caseSensitiveLabel);
    
    container.appendChild(findField);
    container.appendChild(replaceField);
    container.appendChild(optionsField);
    
    return container;
}

/**
 * Renders compose configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @returns {HTMLElement} Configuration UI
 */
export function renderComposeConfigUI(propertyId, block, state) {
    const container = createElement('div', { className: 'config-fields' });
    
    // Pattern field
    const patternField = createElement('div', { className: 'config-field' });
    patternField.appendChild(createElement('label', {}, 'Pattern:'));
    
    // Ensure pattern has a value, default to {{value}} if empty
    const currentPattern = (block.config.pattern && block.config.pattern.trim()) || '{{value}}';
    
    const patternTextarea = createElement('textarea', {
        rows: 3,
        placeholder: 'Write your sentence and use {{value}} for current value or {{field:path}} for other fields...',
        className: 'pattern-input',
        onInput: (e) => {
            state.updateTransformationBlock(propertyId, block.id, { pattern: e.target.value });
            updateTransformationPreview(propertyId, state);
        }
    }, currentPattern);
    patternField.appendChild(patternTextarea);
    
    // Help text
    const helpText = createElement('div', { 
        className: 'help-text' 
    }, '💡 Use {{value}} for the current value and {{field:path}} to insert other fields from this item');
    patternField.appendChild(helpText);
    
    // Field search and insertion
    const fieldSearchSection = createElement('div', { className: 'field-search-section' });
    const fieldSearchLabel = createElement('label', {}, 'Insert Field:');
    fieldSearchSection.appendChild(fieldSearchLabel);
    
    const fieldSearchInput = createElement('input', {
        type: 'text',
        placeholder: 'Search fields to insert...',
        className: 'field-search-input',
        onInput: (e) => updateFieldSearchResults(e.target.value, propertyId, block, fieldResultsContainer)
    });
    fieldSearchSection.appendChild(fieldSearchInput);
    
    const fieldResultsContainer = createElement('div', { className: 'field-results' });
    fieldSearchSection.appendChild(fieldResultsContainer);
    
    // Initialize with empty search to show all fields
    setTimeout(() => updateFieldSearchResults('', propertyId, block, fieldResultsContainer), 100);
    
    container.appendChild(patternField);
    container.appendChild(fieldSearchSection);
    return container;
}

/**
 * Updates field search results for compose transformation UI
 * @param {string} searchTerm - The search term
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {HTMLElement} resultsContainer - Container for search results
 */
export function updateFieldSearchResults(searchTerm, propertyId, block, resultsContainer) {
    resultsContainer.innerHTML = '';
    
    // Get the original item data for this property
    const keyData = window.currentMappingKeyData;
    if (!keyData || !keyData.sampleValue) {
        resultsContainer.appendChild(createElement('div', { 
            className: 'no-fields-message' 
        }, 'No field data available'));
        return;
    }
    
    // Get the full item data from state to extract all fields
    const state = window.mappingStepState;
    const currentState = state.getState();
    let fullItemData = null;
    
    if (currentState.fetchedData) {
        const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
        
        // Find the item that contains this property value
        // We'll match based on the key and sampleValue
        fullItemData = items.find(item => {
            if (typeof item === 'object' && item !== null && item[keyData.key] !== undefined) {
                return true;
            }
            return false;
        });
        
        // If we couldn't find a specific item, use the first item as fallback
        if (!fullItemData && items.length > 0) {
            fullItemData = items[0];
        }
    }
    
    if (!fullItemData) {
        resultsContainer.appendChild(createElement('div', { 
            className: 'no-fields-message' 
        }, 'No full item data available'));
        return;
    }
    
    // Extract all fields from the full item data instead of just the property value
    const allFields = extractAllFields(fullItemData);
    const filteredFields = searchFields(allFields, searchTerm);
    
    if (filteredFields.length === 0) {
        resultsContainer.appendChild(createElement('div', { 
            className: 'no-fields-message' 
        }, 'No matching fields found'));
        return;
    }
    
    // Show all results - container will be scrollable
    filteredFields.forEach(field => {
        const fieldItem = createElement('div', {
            className: 'field-result-item',
            onClick: () => {
                // Insert the field path into the pattern at cursor position
                const patternTextarea = document.querySelector(`textarea.pattern-input`);
                if (patternTextarea) {
                    const fieldPlaceholder = `{{field:${field.path}}}`;
                    const start = patternTextarea.selectionStart;
                    const end = patternTextarea.selectionEnd;
                    const currentPattern = patternTextarea.value;
                    const newPattern = currentPattern.substring(0, start) + fieldPlaceholder + currentPattern.substring(end);
                    patternTextarea.value = newPattern;
                    
                    // Update the state and preview
                    const state = window.mappingStepState;
                    state.updateTransformationBlock(propertyId, block.id, { 
                        pattern: newPattern,
                        sourceData: fullItemData 
                    });
                    updateTransformationPreview(propertyId, state);
                    
                    // Focus back to textarea and position cursor
                    patternTextarea.focus();
                    patternTextarea.setSelectionRange(start + fieldPlaceholder.length, start + fieldPlaceholder.length);
                }
            }
        });
        
        const pathElement = createElement('div', { className: 'field-path' }, field.path);
        const previewElement = createElement('div', { className: 'field-preview' }, field.preview);
        
        fieldItem.appendChild(pathElement);
        fieldItem.appendChild(previewElement);
        resultsContainer.appendChild(fieldItem);
    });
}

/**
 * Renders regex configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @returns {HTMLElement} Configuration UI
 */
export function renderRegexConfigUI(propertyId, block, state) {
    const container = createElement('div', { className: 'config-fields' });
    
    // Pattern field
    const patternField = createElement('div', { className: 'config-field' });
    patternField.appendChild(createElement('label', {}, 'Regex Pattern:'));
    const patternInput = createElement('input', {
        type: 'text',
        value: block.config.pattern || '',
        placeholder: 'Regular expression pattern...',
        className: 'regex-pattern-input',
        onInput: (e) => {
            state.updateTransformationBlock(propertyId, block.id, { pattern: e.target.value });
            updateTransformationPreview(propertyId, state);
        }
    });
    patternField.appendChild(patternInput);
    
    // Replacement field
    const replacementField = createElement('div', { className: 'config-field' });
    replacementField.appendChild(createElement('label', {}, 'Replacement:'));
    const replacementInput = createElement('input', {
        type: 'text',
        value: block.config.replacement || '',
        placeholder: 'Replacement pattern (use $1, $2 for capture groups)...',
        onInput: (e) => {
            state.updateTransformationBlock(propertyId, block.id, { replacement: e.target.value });
            updateTransformationPreview(propertyId, state);
        }
    });
    replacementField.appendChild(replacementInput);
    
    // Common patterns section
    const patternsSection = createElement('div', { className: 'config-field' });
    patternsSection.appendChild(createElement('label', {}, 'Common Patterns:'));
    
    const patternSelect = createElement('select', {
        className: 'pattern-select',
        onChange: (e) => {
            if (e.target.value && COMMON_REGEX_PATTERNS[e.target.value]) {
                const pattern = COMMON_REGEX_PATTERNS[e.target.value];
                state.updateTransformationBlock(propertyId, block.id, {
                    pattern: pattern.pattern,
                    replacement: pattern.replacement
                });
                updateTransformationPreview(propertyId, state);
                
                // Update the input field values to reflect the selected pattern
                patternInput.value = pattern.pattern;
                replacementInput.value = pattern.replacement;
            }
        }
    });
    
    // Add empty option
    patternSelect.appendChild(createElement('option', { value: '' }, 'Select a common pattern...'));
    
    // Add common patterns
    Object.entries(COMMON_REGEX_PATTERNS).forEach(([name, pattern]) => {
        const option = createElement('option', { value: name }, `${name} - ${pattern.description}`);
        patternSelect.appendChild(option);
    });
    
    patternsSection.appendChild(patternSelect);
    
    container.appendChild(patternField);
    container.appendChild(replacementField);
    container.appendChild(patternsSection);
    return container;
}

/**
 * Adds drag and drop handlers to a block element
 * @param {HTMLElement} blockElement - The block element
 * @param {HTMLElement} dragHandle - The drag handle element
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function addDragHandlers(blockElement, dragHandle, propertyId, state) {
    dragHandle.addEventListener('dragstart', (e) => {
        currentDraggedElement = blockElement;
        blockElement.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', blockElement.dataset.blockId);
    });

    dragHandle.addEventListener('dragend', () => {
        if (currentDraggedElement) {
            currentDraggedElement.classList.remove('dragging');
            currentDraggedElement = null;
        }
        // Remove drop target indicators from all blocks
        const blocks = Array.from(blockElement.parentElement.querySelectorAll('.transformation-block'));
        blocks.forEach(block => block.classList.remove('drop-target'));
    });

    blockElement.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (currentDraggedElement && currentDraggedElement !== blockElement) {
            blockElement.classList.add('drop-target');
        }
    });

    blockElement.addEventListener('dragleave', (e) => {
        if (!blockElement.contains(e.relatedTarget)) {
            blockElement.classList.remove('drop-target');
        }
    });

    blockElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (currentDraggedElement && currentDraggedElement !== blockElement) {
            e.dataTransfer.dropEffect = 'move';
        }
    });

    blockElement.addEventListener('drop', (e) => {
        e.preventDefault();
        blockElement.classList.remove('drop-target');
        
        if (currentDraggedElement && currentDraggedElement !== blockElement) {
            // Reorder blocks
            const blocks = Array.from(blockElement.parentElement.querySelectorAll('.transformation-block'));
            const draggedIndex = blocks.indexOf(currentDraggedElement);
            const targetIndex = blocks.indexOf(blockElement);
            
            if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
                const blockIds = blocks.map(el => el.dataset.blockId);
                const draggedId = blockIds.splice(draggedIndex, 1)[0];
                blockIds.splice(targetIndex, 0, draggedId);
                
                state.reorderTransformationBlocks(propertyId, blockIds);
                refreshTransformationUI(propertyId, state);
            }
        }
    });
}