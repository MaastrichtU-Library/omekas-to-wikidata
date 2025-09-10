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

    // Property ID for transformation blocks - check multiple sources
    let currentProperty = window.currentMappingSelectedProperty || keyData?.property;
    let propertyId = currentProperty?.id;
    
    // For already-mapped keys, if we don't have the property yet, show placeholder and retry
    if (!propertyId && keyData) {
        // Check if this appears to be a mapped key based on the modal title or other indicators
        const modalTitle = document.querySelector('.modal-title');
        if (modalTitle && modalTitle.textContent.includes('→')) {
            // This is likely a mapped key - create placeholder and set up retry mechanism
            const placeholder = createElement('div', {
                className: 'transformation-message',
                id: 'transformation-placeholder'
            }, 'Loading value transformation options...');
            container.appendChild(placeholder);
            
            // Retry getting the property after a short delay to allow setup to complete
            setTimeout(() => {
                const updatedProperty = window.currentMappingSelectedProperty || keyData?.property;
                if (updatedProperty?.id) {
                    // Replace placeholder with actual transformation UI
                    const actualContainer = renderValueTransformationUI(keyData, state);
                    if (container.parentNode) {
                        container.parentNode.replaceChild(actualContainer, container);
                    }
                }
            }, 200);
            
            return container;
        }
    }
    
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
        
        const fieldSelectorLabel = createElement('label', {
            htmlFor: `field-selector-${propertyId}`,
            className: 'field-selector-label'
        }, 'Select field to transform:');
        
        const fieldSelector = createElement('select', {
            id: `field-selector-${propertyId}`,
            className: 'field-selector'
        });
        
        // Add options for each available field
        availableFields.forEach((field, index) => {
            const option = createElement('option', {
                value: field.key
            }, `${field.label} (${field.sampleValue})`);
            
            // Select first field by default
            if (index === 0) {
                option.selected = true;
            }
            
            fieldSelector.appendChild(option);
        });
        
        // Add change listener to update transformation preview
        fieldSelector.addEventListener('change', () => {
            // Import from transformation-engine to avoid circular dependency
            import('../core/transformation-engine.js').then(({ refreshTransformationFieldPreview }) => {
                refreshTransformationFieldPreview(propertyId, state);
            });
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
    const addBlockBtn = createButton('Add Transformation', {
        className: 'add-transformation-btn',
        onClick: () => showAddTransformationMenu(propertyId, state)
    });
    
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
            // Import refreshTransformationUI to avoid circular dependency
            import('../core/transformation-engine.js').then(({ refreshTransformationUI }) => {
                refreshTransformationUI(propertyId, state);
            });
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
            // Import to avoid circular dependency
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
        }
    });
    caseSensitiveLabel.appendChild(caseSensitiveCheckbox);
    caseSensitiveLabel.appendChild(document.createTextNode(' Case sensitive'));

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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
        }
    });
    replaceAllLabel.appendChild(replaceAllCheckbox);
    replaceAllLabel.appendChild(document.createTextNode(' Replace all occurrences'));

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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
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
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
        }
    });
    globalLabel.appendChild(globalCheckbox);
    globalLabel.appendChild(document.createTextNode(' Global (g)'));

    // Case insensitive flag
    const caseInsensitiveLabel = createElement('label', { className: 'checkbox-label' });
    const caseInsensitiveCheckbox = createElement('input', {
        type: 'checkbox',
        checked: block.config.ignoreCase || false,
        onChange: (e) => {
            block.config.ignoreCase = e.target.checked;
            state.updateTransformationBlock(propertyId, block.id, block);
            import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                updateTransformationPreview(propertyId, state);
            });
        }
    });
    caseInsensitiveLabel.appendChild(caseInsensitiveCheckbox);
    caseInsensitiveLabel.appendChild(document.createTextNode(' Ignore case (i)'));

    flagsContainer.appendChild(globalLabel);
    flagsContainer.appendChild(caseInsensitiveLabel);

    // Common patterns helper
    const patternsContainer = createElement('div', { className: 'regex-patterns-helper' });
    const patternsLabel = createElement('label', {}, 'Common patterns:');
    const patternsSelect = createElement('select', {
        onChange: (e) => {
            if (e.target.value) {
                patternInput.value = e.target.value;
                block.config.pattern = e.target.value;
                state.updateTransformationBlock(propertyId, block.id, block);
                import('../core/transformation-engine.js').then(({ updateTransformationPreview }) => {
                    updateTransformationPreview(propertyId, state);
                });
                e.target.value = ''; // Reset select
            }
        }
    });

    // Add default option
    patternsSelect.appendChild(createElement('option', { value: '' }, 'Choose a pattern...'));

    // Add common regex patterns
    Object.entries(COMMON_REGEX_PATTERNS).forEach(([key, pattern]) => {
        patternsSelect.appendChild(createElement('option', { value: pattern.pattern }, pattern.name));
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
                    const fieldPlaceholder = `{${field.key}}`;
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
        }, `{${field.key}}`);
        
        // Add tooltip with sample value
        fieldButton.title = `Sample value: ${field.sampleValue}`;
        
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
            
            // Reorder blocks in state
            state.reorderTransformationBlocks(propertyId, draggedBlockId, targetBlockId, insertBefore);
            
            // Refresh the transformation UI
            import('../core/transformation-engine.js').then(({ refreshTransformationUI }) => {
                refreshTransformationUI(propertyId, state);
            });
        }
        
        // Clean up drag indicators
        blockElement.classList.remove('drag-over-top', 'drag-over-bottom');
    });
}

// Helper function to show add transformation menu
function showAddTransformationMenu(propertyId, state) {
    // Create a simple dropdown menu
    const menu = createElement('div', { 
        className: 'add-transformation-menu',
        style: 'position: absolute; z-index: 1000; background: white; border: 1px solid #ccc; border-radius: 4px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);'
    });

    Object.entries(BLOCK_TYPES).forEach(([key, type]) => {
        const metadata = BLOCK_METADATA[type];
        const menuItem = createElement('button', {
            className: 'menu-item',
            style: 'display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer;',
            onClick: () => {
                // Import addTransformationBlock to avoid circular dependency
                import('../core/transformation-engine.js').then(({ addTransformationBlock }) => {
                    addTransformationBlock(propertyId, type, state);
                });
                document.body.removeChild(menu);
            },
            onMouseOver: (e) => e.target.style.backgroundColor = '#f0f0f0',
            onMouseOut: (e) => e.target.style.backgroundColor = 'transparent'
        }, `${metadata.icon} ${metadata.name}`);
        
        menu.appendChild(menuItem);
    });

    // Position and show menu
    const addBtn = document.querySelector('.add-transformation-btn');
    const rect = addBtn.getBoundingClientRect();
    menu.style.top = (rect.bottom + window.scrollY) + 'px';
    menu.style.left = rect.left + 'px';
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== addBtn) {
            document.body.removeChild(menu);
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}