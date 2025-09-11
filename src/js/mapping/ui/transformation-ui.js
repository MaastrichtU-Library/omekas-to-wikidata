/**
 * Transformation UI rendering components
 * Handles UI rendering for transformation blocks and interfaces
 * Separated from business logic for better maintainability
 * @module mapping/ui/transformation-ui
 */

// Import dependencies
import { createElement, createButton } from '../../ui/components.js';
import { BLOCK_TYPES, BLOCK_METADATA, getTransformationPreview, extractAllFields, searchFields, COMMON_REGEX_PATTERNS } from '../../transformations.js';
import { 
    extractAvailableFields,
    getFieldValueFromSample,
    convertSampleValueToString 
} from '../core/data-analyzer.js';
import { 
    refreshTransformationFieldPreview,
    addTransformationBlock,
    updateTransformationPreview,
    refreshTransformationUI
} from '../core/transformation-engine.js';

// Global variable to track the currently dragged element across all blocks
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
    
    try {

    // Property ID for transformation blocks - check multiple sources
    let currentProperty = window.currentMappingSelectedProperty || keyData?.property;
    let propertyId = currentProperty?.id;
    
    // If keyData has property info but global variable doesn't, set it
    if (!window.currentMappingSelectedProperty && keyData?.property) {
        window.currentMappingSelectedProperty = keyData.property;
        currentProperty = keyData.property;
        propertyId = currentProperty.id;
    }
    
    // If we still don't have a property ID, show loading message and set up retry
    if (!propertyId) {
        // Check if we have any indicators that a property should be available
        const hasPropertyIndicators = keyData?.property || 
                                      document.getElementById('selected-property')?.style.display !== 'none' ||
                                      document.querySelector('.property-search-input')?.value?.includes(':');
        
        if (hasPropertyIndicators) {
            // Show loading message and retry
            const placeholder = createElement('div', {
                className: 'transformation-message',
                id: 'transformation-placeholder'
            }, 'Loading value transformation options...');
            container.appendChild(placeholder);
            
            // More robust retry with multiple attempts
            let retryCount = 0;
            const maxRetries = 5;
            
            const retryGetProperty = () => {
                const updatedProperty = window.currentMappingSelectedProperty || keyData?.property;
                if (updatedProperty?.id) {
                    // Replace placeholder with actual transformation UI
                    const actualContainer = renderValueTransformationUI(keyData, state);
                    if (container.parentNode) {
                        container.parentNode.replaceChild(actualContainer, container);
                    }
                } else if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(retryGetProperty, 200 * retryCount); // Increasing delay
                } else {
                    // After max retries, show the "select property" message
                    if (container.parentNode) {
                        const errorContainer = createElement('div');
                        errorContainer.appendChild(createElement('div', {
                            className: 'transformation-message'
                        }, 'Select a property first to configure value transformations'));
                        container.parentNode.replaceChild(errorContainer, container);
                    }
                }
            };
            
            setTimeout(retryGetProperty, 100);
            return container;
        } else {
            // No property indicators, show selection message
            container.appendChild(createElement('div', {
                className: 'transformation-message'
            }, 'Select a property first to configure value transformations'));
            return container;
        }
    }

    // Field selector section
    const rawSampleValue = keyData.sampleValue;
    const availableFields = extractAvailableFields(rawSampleValue);
    
    if (availableFields.length > 1) {
        const fieldSelectorSection = createElement('div', { className: 'field-selector-section' });
        
        const fieldSelectorLabel = createElement('label', {
            htmlFor: `field-selector-${propertyId}`,
            className: 'field-selector-label'
        }, 'Select field to transform:');
        
        const fieldSelector = createElement('select', {
            id: `field-selector-${propertyId}`,
            className: 'field-selector'
        });
        
        // Find field with '+' symbol to pre-select, or default to first field
        const fieldWithPlus = availableFields.findIndex(field => field.key.includes('+'));
        const defaultSelectedIndex = fieldWithPlus !== -1 ? fieldWithPlus : 0;
        
        // Add options for each available field
        availableFields.forEach((field, index) => {
            const option = createElement('option', {
                value: field.key
            }, `${field.label} (${field.sampleValue})`);
            
            // Select field with '+' symbol if found, otherwise first field
            if (index === defaultSelectedIndex) {
                option.selected = true;
            }
            
            fieldSelector.appendChild(option);
        });
        
        // Add change listener to update transformation preview
        fieldSelector.addEventListener('change', () => {
            refreshTransformationFieldPreview(propertyId, state);
        });
        
        fieldSelectorSection.appendChild(fieldSelectorLabel);
        fieldSelectorSection.appendChild(fieldSelector);
        container.appendChild(fieldSelectorSection);
    }

    // Get the sample value to use for transformations
    const selectedField = document.getElementById(`field-selector-${propertyId}`)?.value || (availableFields[0]?.key);
    const sampleValue = selectedField ? getFieldValueFromSample(rawSampleValue, selectedField) : convertSampleValueToString(rawSampleValue);

    // Transformation blocks header
    const transformationHeader = createElement('div', { className: 'transformation-header' });
    const transformationTitle = createElement('h4', {}, 'Value Transformation Pipeline');
    
    // Add transformation block button
    const addBlockBtn = createElement('button', {
        className: 'button button--secondary add-transformation-btn',
        onClick: () => showAddTransformationMenu(propertyId, state, addBlockBtn)
    }, 'Add Transformation');
    
    transformationHeader.appendChild(transformationTitle);
    transformationHeader.appendChild(addBlockBtn);
    container.appendChild(transformationHeader);

    // Transformation blocks container
    const blocksContainer = createElement('div', {
        className: 'transformation-blocks-container',
        id: `transformation-blocks-${propertyId}`,
        dataset: { sampleValue: sampleValue }
    });
    
    // Render existing transformation blocks
    renderTransformationBlocks(propertyId, sampleValue, blocksContainer, state);
    container.appendChild(blocksContainer);

    } catch (error) {
        console.error('Error rendering value transformation UI:', error);
        container.innerHTML = '';
        container.appendChild(createElement('div', {
            className: 'error-message'
        }, 'Error loading transformation options. Please try again.'));
    }
    
    return container;
}

/**
 * Renders transformation blocks for a property
 * @param {string} propertyId - The property ID
 * @param {string} sampleValue - Sample value for preview
 * @param {HTMLElement} container - Container to render into
 * @param {Object} state - Application state
 */
export function renderTransformationBlocks(propertyId, sampleValue, container, state) {
    try {
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
    } catch (error) {
        console.error('Error rendering transformation blocks:', error);
        container.innerHTML = '';
        container.appendChild(createElement('div', {
            className: 'error-message'
        }, 'Error rendering transformation blocks.'));
    }
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
        className: 'block-header'
    });
    
    const dragHandle = createElement('div', { 
        className: 'drag-handle',
        title: 'Drag to reorder',
        draggable: 'true'
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
    renderBlockConfigUI(propertyId, block, state, blockConfig);

    blockElement.appendChild(blockHeader);
    blockElement.appendChild(blockConfig);

    // Add drag handlers
    addDragHandlers(blockElement, dragHandle, propertyId, state);

    return blockElement;
}

/**
 * Renders block configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @param {HTMLElement} container - Container to render into (optional)
 */
export function renderBlockConfigUI(propertyId, block, state, container = null) {
    const configContainer = container || createElement('div', { className: 'block-config' });
    
    // Clear existing content
    configContainer.innerHTML = '';

    switch (block.type) {
        case BLOCK_TYPES.PREFIX_SUFFIX:
            renderPrefixSuffixConfigUI(propertyId, block, state, 'Prefix/Suffix', configContainer);
            break;
        case BLOCK_TYPES.FIND_REPLACE:
            renderFindReplaceConfigUI(propertyId, block, state, configContainer);
            break;
        case BLOCK_TYPES.COMPOSE:
            renderComposeConfigUI(propertyId, block, state, configContainer);
            break;
        case BLOCK_TYPES.REGEX:
            renderRegexConfigUI(propertyId, block, state, configContainer);
            break;
        default:
            configContainer.appendChild(createElement('div', {
                className: 'config-placeholder'
            }, 'Configuration options will be available here.'));
            break;
    }

    return configContainer;
}

/**
 * Renders prefix/suffix configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @param {string} label - Configuration label
 * @param {HTMLElement} container - Container to render into (optional)
 */
export function renderPrefixSuffixConfigUI(propertyId, block, state, label, container = null) {
    const configContainer = container || createElement('div');
    
    const prefixInput = createElement('input', {
        type: 'text',
        placeholder: 'Text to add at beginning',
        value: block.config.prefix || '',
        className: 'config-input prefix-input',
        onInput: (e) => {
            block.config.prefix = e.target.value;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });

    const suffixInput = createElement('input', {
        type: 'text',
        placeholder: 'Text to add at end',
        value: block.config.suffix || '',
        className: 'config-input suffix-input',
        onInput: (e) => {
            block.config.suffix = e.target.value;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });

    configContainer.appendChild(createElement('label', {}, 'Prefix:'));
    configContainer.appendChild(prefixInput);
    configContainer.appendChild(createElement('label', {}, 'Suffix:'));
    configContainer.appendChild(suffixInput);

    return configContainer;
}

/**
 * Renders find/replace configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @param {HTMLElement} container - Container to render into (optional)
 */
export function renderFindReplaceConfigUI(propertyId, block, state, container = null) {
    const configContainer = container || createElement('div');
    
    const findInput = createElement('input', {
        type: 'text',
        placeholder: 'Text to find',
        value: block.config.find || '',
        className: 'config-input find-input',
        onInput: (e) => {
            block.config.find = e.target.value;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });

    const replaceInput = createElement('input', {
        type: 'text',
        placeholder: 'Replace with',
        value: block.config.replace || '',
        className: 'config-input replace-input',
        onInput: (e) => {
            block.config.replace = e.target.value;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });

    // Case sensitivity toggle
    const caseSensitiveLabel = createElement('label', {
        className: 'checkbox-label'
    });
    const caseSensitiveCheckbox = createElement('input', {
        type: 'checkbox',
        checked: block.config.caseSensitive !== false, // Default to true
        onChange: (e) => {
            block.config.caseSensitive = e.target.checked;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });
    caseSensitiveLabel.appendChild(caseSensitiveCheckbox);
    caseSensitiveLabel.appendChild(createElement('span', {}, ' Case sensitive'));

    // Replace all toggle
    const replaceAllLabel = createElement('label', {
        className: 'checkbox-label'
    });
    const replaceAllCheckbox = createElement('input', {
        type: 'checkbox',
        checked: block.config.replaceAll !== false, // Default to true
        onChange: (e) => {
            block.config.replaceAll = e.target.checked;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });
    replaceAllLabel.appendChild(replaceAllCheckbox);
    replaceAllLabel.appendChild(createElement('span', {}, ' Replace all occurrences'));

    const optionsContainer = createElement('div', { className: 'find-replace-options' });
    optionsContainer.appendChild(caseSensitiveLabel);
    optionsContainer.appendChild(replaceAllLabel);

    configContainer.appendChild(createElement('label', {}, 'Find:'));
    configContainer.appendChild(findInput);
    configContainer.appendChild(createElement('label', {}, 'Replace with:'));
    configContainer.appendChild(replaceInput);
    configContainer.appendChild(optionsContainer);

    return configContainer;
}

/**
 * Renders compose configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @param {HTMLElement} container - Container to render into (optional)
 */
export function renderComposeConfigUI(propertyId, block, state, container = null) {
    const configContainer = container || createElement('div');
    
    const templateInput = createElement('textarea', {
        placeholder: 'Enter template with field placeholders like {field_name}',
        value: block.config.template || '',
        className: 'config-textarea template-input',
        rows: 3,
        onInput: (e) => {
            block.config.template = e.target.value;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
            // Update field search results
            updateFieldSearchResults(e.target.value, propertyId, block, fieldsContainer.querySelector('.field-search-results'));
        }
    });

    // Field selection helper
    const fieldsContainer = createElement('div', { className: 'compose-fields-container' });
    const fieldsLabel = createElement('label', {}, 'Available fields:');
    const fieldSearchInput = createElement('input', {
        type: 'text',
        placeholder: 'Search fields...',
        className: 'field-search-input',
        onInput: (e) => {
            updateFieldSearchResults(e.target.value, propertyId, block, resultsContainer);
        }
    });

    const resultsContainer = createElement('div', { className: 'field-search-results' });
    
    fieldsContainer.appendChild(fieldsLabel);
    fieldsContainer.appendChild(fieldSearchInput);
    fieldsContainer.appendChild(resultsContainer);

    // Initialize with all fields
    updateFieldSearchResults('', propertyId, block, resultsContainer);

    configContainer.appendChild(createElement('label', {}, 'Template:'));
    configContainer.appendChild(templateInput);
    configContainer.appendChild(fieldsContainer);

    return configContainer;
}

/**
 * Renders regex configuration UI
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {Object} state - Application state
 * @param {HTMLElement} container - Container to render into (optional)
 */
export function renderRegexConfigUI(propertyId, block, state, container = null) {
    const configContainer = container || createElement('div');
    
    // Pattern input
    const patternInput = createElement('input', {
        type: 'text',
        placeholder: 'Regular expression pattern',
        value: block.config.pattern || '',
        className: 'config-input regex-pattern-input',
        onInput: (e) => {
            block.config.pattern = e.target.value;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });

    // Replacement input
    const replacementInput = createElement('input', {
        type: 'text',
        placeholder: 'Replacement (use $1, $2 for capture groups)',
        value: block.config.replacement || '',
        className: 'config-input regex-replacement-input',
        onInput: (e) => {
            block.config.replacement = e.target.value;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });

    // Flags
    const flagsContainer = createElement('div', { className: 'regex-flags' });
    
    // Global flag
    const globalLabel = createElement('label', { className: 'checkbox-label' });
    const globalCheckbox = createElement('input', {
        type: 'checkbox',
        checked: block.config.global !== false, // Default to true
        onChange: (e) => {
            block.config.global = e.target.checked;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });
    globalLabel.appendChild(globalCheckbox);
    globalLabel.appendChild(createElement('span', {}, ' Global (g)'));

    // Case insensitive flag
    const caseInsensitiveLabel = createElement('label', { className: 'checkbox-label' });
    const caseInsensitiveCheckbox = createElement('input', {
        type: 'checkbox',
        checked: block.config.ignoreCase || false,
        onChange: (e) => {
            block.config.ignoreCase = e.target.checked;
            state.updateTransformationBlock(propertyId, block.id, block);
            updateTransformationPreview(propertyId, state);
        }
    });
    caseInsensitiveLabel.appendChild(caseInsensitiveCheckbox);
    caseInsensitiveLabel.appendChild(createElement('span', {}, ' Ignore case (i)'));

    flagsContainer.appendChild(globalLabel);
    flagsContainer.appendChild(caseInsensitiveLabel);

    // Common patterns helper
    const patternsContainer = createElement('div', { className: 'regex-patterns-helper' });
    const patternsLabel = createElement('label', {}, 'Common patterns:');
    const patternsSelect = createElement('select', {
        onChange: (e) => {
            const selectedKey = e.target.value;
            if (selectedKey && COMMON_REGEX_PATTERNS[selectedKey]) {
                const selectedPattern = COMMON_REGEX_PATTERNS[selectedKey];
                patternInput.value = selectedPattern.pattern;
                replacementInput.value = selectedPattern.replacement || '';
                block.config.pattern = selectedPattern.pattern;
                block.config.replacement = selectedPattern.replacement || '';
                state.updateTransformationBlock(propertyId, block.id, block);
                updateTransformationPreview(propertyId, state);
            }
        }
    });

    // Add default option
    patternsSelect.appendChild(createElement('option', { value: '' }, 'Choose a pattern...'));

    // Add common regex patterns - use key as value for proper selection
    Object.entries(COMMON_REGEX_PATTERNS).forEach(([key, pattern]) => {
        patternsSelect.appendChild(createElement('option', { value: key }, key));
    });

    patternsContainer.appendChild(patternsLabel);
    patternsContainer.appendChild(patternsSelect);

    configContainer.appendChild(createElement('label', {}, 'Pattern:'));
    configContainer.appendChild(patternInput);
    configContainer.appendChild(createElement('label', {}, 'Replacement:'));
    configContainer.appendChild(replacementInput);
    configContainer.appendChild(flagsContainer);
    configContainer.appendChild(patternsContainer);

    return configContainer;
}

/**
 * Updates field search results for compose blocks
 * @param {string} searchTerm - The search term
 * @param {string} propertyId - The property ID
 * @param {Object} block - The transformation block
 * @param {HTMLElement} resultsContainer - Container for results
 */
export function updateFieldSearchResults(searchTerm, propertyId, block, resultsContainer) {
    if (!resultsContainer) return;
    
    // Get key data from global state
    const keyData = window.currentMappingKeyData;
    if (!keyData) {
        resultsContainer.innerHTML = '<div class="no-fields-message">No field data available</div>';
        return;
    }

    // Extract all available fields from the sample value
    const allFields = extractAllFields(keyData.sampleValue);
    
    // Filter fields based on search term
    const filteredFields = searchFields(allFields, searchTerm);
    
    // Clear existing results
    resultsContainer.innerHTML = '';
    
    if (filteredFields.length === 0) {
        resultsContainer.appendChild(createElement('div', { 
            className: 'no-results-message' 
        }, searchTerm ? 'No matching fields found' : 'No fields available'));
        return;
    }

    // Create field buttons
    filteredFields.slice(0, 10).forEach(field => { // Limit to 10 results
        const fieldButton = createElement('button', {
            className: 'field-result-btn',
            onClick: () => {
                // Insert field placeholder into template
                const templateInput = document.querySelector(`.transformation-block[data-block-id="${block.id}"] .template-input`);
                if (templateInput) {
                    const cursorPos = templateInput.selectionStart;
                    const fieldPlaceholder = `{${field.path}}`;
                    const newValue = templateInput.value.substring(0, cursorPos) + 
                                   fieldPlaceholder + 
                                   templateInput.value.substring(templateInput.selectionEnd);
                    
                    templateInput.value = newValue;
                    templateInput.focus();
                    templateInput.setSelectionRange(cursorPos + fieldPlaceholder.length, cursorPos + fieldPlaceholder.length);
                    
                    // Trigger input event to update the block
                    const inputEvent = new Event('input', { bubbles: true });
                    templateInput.dispatchEvent(inputEvent);
                }
            }
        }, `{${field.path}}`);
        
        // Add tooltip with sample value
        fieldButton.title = `Sample value: ${field.preview || field.value}`;
        
        resultsContainer.appendChild(fieldButton);
    });
}

/**
 * Adds drag and drop handlers to a block element
 * @param {HTMLElement} blockElement - The block element
 * @param {HTMLElement} dragHandle - The drag handle element
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function addDragHandlers(blockElement, dragHandle, propertyId, state) {
    // Drag start
    dragHandle.addEventListener('dragstart', (e) => {
        currentDraggedElement = blockElement;
        blockElement.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ''); // Required for Firefox
    });

    // Drag end
    dragHandle.addEventListener('dragend', (e) => {
        blockElement.classList.remove('dragging');
        currentDraggedElement = null;
        
        // Remove all drag indicators
        document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    });

    // Drag over
    blockElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (currentDraggedElement && currentDraggedElement !== blockElement) {
            const rect = blockElement.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            
            // Clear existing drag indicators
            blockElement.classList.remove('drag-over-top', 'drag-over-bottom');
            
            if (e.clientY < midY) {
                blockElement.classList.add('drag-over-top');
            } else {
                blockElement.classList.add('drag-over-bottom');
            }
        }
    });

    // Drag leave
    blockElement.addEventListener('dragleave', (e) => {
        // Only remove if we're actually leaving the element (not just a child)
        if (!blockElement.contains(e.relatedTarget)) {
            blockElement.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    });

    // Drop
    blockElement.addEventListener('drop', (e) => {
        e.preventDefault();
        
        if (currentDraggedElement && currentDraggedElement !== blockElement) {
            const draggedBlockId = currentDraggedElement.dataset.blockId;
            const targetBlockId = blockElement.dataset.blockId;
            
            const rect = blockElement.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midY;
            
            // Get current blocks order
            const blocks = state.getTransformationBlocks(propertyId);
            const blockIds = blocks.map(b => b.id);
            
            // Remove dragged block from its current position
            const draggedIndex = blockIds.indexOf(draggedBlockId);
            if (draggedIndex !== -1) {
                blockIds.splice(draggedIndex, 1);
            }
            
            // Find target position and insert
            const targetIndex = blockIds.indexOf(targetBlockId);
            if (targetIndex !== -1) {
                const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
                blockIds.splice(insertIndex, 0, draggedBlockId);
            }
            
            // Reorder blocks in state with new order array
            state.reorderTransformationBlocks(propertyId, blockIds);
            
            // Refresh the transformation UI
            refreshTransformationUI(propertyId, state);
        }
        
        // Clean up drag indicators
        blockElement.classList.remove('drag-over-top', 'drag-over-bottom');
    });
}

// Helper function to show add transformation menu
function showAddTransformationMenu(propertyId, state, addBtn) {
    // Remove any existing menu first
    const existingMenu = document.querySelector('.add-transformation-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create a simple dropdown menu
    const menu = createElement('div', { 
        className: 'add-transformation-menu',
        style: 'position: absolute; z-index: 1000; background: white; border: 1px solid #ccc; border-radius: 4px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);'
    });
    
    // Close menu function needs to be defined before menu items
    const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== addBtn) {
            // Only remove if menu is still a child of document.body
            if (menu.parentNode === document.body) {
                document.body.removeChild(menu);
            }
            document.removeEventListener('click', closeMenu);
        }
    };

    Object.entries(BLOCK_TYPES).forEach(([key, type]) => {
        const metadata = BLOCK_METADATA[type];
        if (!metadata) {
            return; // Skip if no metadata found
        }
        
        const menuItem = createElement('button', {
            className: 'menu-item',
            style: 'display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer;',
            onClick: (e) => {
                // Prevent event bubbling
                e.stopPropagation();
                e.preventDefault();
                
                // Remove menu first
                if (menu.parentNode === document.body) {
                    document.body.removeChild(menu);
                }
                
                // Remove the close menu listener
                document.removeEventListener('click', closeMenu);
                
                // Add the transformation block
                addTransformationBlock(propertyId, type, state);
            },
            onMouseOver: (e) => e.target.style.backgroundColor = '#f0f0f0',
            onMouseOut: (e) => e.target.style.backgroundColor = 'transparent'
        }, `${metadata.icon} ${metadata.name}`);
        
        menu.appendChild(menuItem);
    });

    // Position and show menu with viewport boundary checks
    const rect = addBtn.getBoundingClientRect();
    const menuWidth = 200; // Approximate width
    const menuHeight = Object.keys(BLOCK_TYPES).length * 40; // Approximate height
    
    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;
    
    // Check if menu would go off the right edge
    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
    }
    
    // Check if menu would go off the bottom edge
    if (top + menuHeight > window.innerHeight + window.scrollY) {
        // Position above the button instead
        top = rect.top + window.scrollY - menuHeight - 5;
    }
    
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    
    document.body.appendChild(menu);
    
    // Add close menu listener after a delay to prevent immediate closing
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Set up event listeners for transformation engine events
document.addEventListener('refresh-transformation-ui', (event) => {
    const { propertyId, state, sampleValue } = event.detail;
    const container = event.target;
    if (container) {
        renderTransformationBlocks(propertyId, sampleValue, container, state);
    }
});

document.addEventListener('refresh-stage3-ui', (event) => {
    const { keyData, state, container } = event.detail;
    if (container && keyData) {
        // Update the global property reference
        if (keyData.property) {
            window.currentMappingSelectedProperty = keyData.property;
        }
        const newUI = renderValueTransformationUI(keyData, state);
        container.appendChild(newUI);
    }
});