/**
 * Entity Schema Selector Component
 * Handles the dropdown and modal for Entity Schema selection
 * @module entity-schemas/entity-schema-selector
 */

import { createElement, createButton, createModal, showMessage } from '../ui/components.js';
import { DEFAULT_SCHEMAS, searchEntitySchemas, getEntitySchema } from './entity-schema-core.js';
import { eventSystem } from '../events.js';

/**
 * Create the Entity Schema selector custom dropdown component
 * @param {Object} options - Configuration options
 * @param {string} options.selectedSchemaId - Currently selected schema ID
 * @param {Function} options.onSchemaSelect - Callback when schema is selected
 * @returns {HTMLElement} The dropdown container element
 */
export function createEntitySchemaSelector(options = {}) {
    const { selectedSchemaId = '', onSchemaSelect = () => {} } = options;
    
    const container = createElement('div', { 
        className: 'entity-schema-selector-custom' 
    });
    
    // Create dropdown button
    const dropdownButton = createElement('button', {
        type: 'button',
        className: 'entity-schema-selector-custom__button'
    });
    
    // Create dropdown content
    const dropdownContent = createElement('div', {
        className: 'entity-schema-selector-custom__content'
    });
    
    let isOpen = false;
    let currentSchema = selectedSchemaId ? DEFAULT_SCHEMAS.find(s => s.id === selectedSchemaId) : null;
    
    // Update button text
    function updateButtonText() {
        if (currentSchema) {
            dropdownButton.textContent = `${currentSchema.id}: ${currentSchema.label}`;
        } else {
            dropdownButton.textContent = 'Select Entity Schema';
        }
    }
    
    updateButtonText();
    
    // Toggle dropdown
    function toggleDropdown() {
        isOpen = !isOpen;
        dropdownContent.style.display = isOpen ? 'block' : 'none';
        dropdownButton.setAttribute('aria-expanded', isOpen);
    }
    
    // Close dropdown when clicking outside
    function handleOutsideClick(e) {
        if (!container.contains(e.target)) {
            if (isOpen) {
                toggleDropdown();
            }
        }
    }
    
    dropdownButton.addEventListener('click', toggleDropdown);
    document.addEventListener('click', handleOutsideClick);
    
    // Create dropdown options
    function createDropdownOptions() {
        dropdownContent.innerHTML = '';
        
        // Add default schemas
        DEFAULT_SCHEMAS.forEach(schema => {
            const option = createElement('div', {
                className: 'entity-schema-selector-custom__option'
            });

            const optionContent = createElement('div', {
                className: 'entity-schema-selector-custom__option-content'
            });

            // Create clickable label (for selection)
            const optionLabel = createElement('span', {
                className: 'entity-schema-selector-custom__option-label',
                onClick: async () => {
                    try {
                        const fullSchema = await getEntitySchema(schema.id);
                        if (fullSchema) {
                            currentSchema = fullSchema;
                            updateButtonText();
                            onSchemaSelect(fullSchema);
                            toggleDropdown();
                        } else {
                            showMessage('Failed to load Entity Schema', 'error');
                        }
                    } catch (error) {
                        console.error('Error loading schema:', error);
                        showMessage('Error loading Entity Schema', 'error');
                    }
                }
            }, `${schema.label}`);

            // Create clickable E-number link
            const optionLink = createElement('span', {
                className: 'entity-schema-selector-custom__option-link',
                onClick: (e) => {
                    e.stopPropagation();
                    window.open(`https://www.wikidata.org/wiki/EntitySchema:${schema.id}`, '_blank');
                }
            }, schema.id);

            optionContent.appendChild(optionLabel);
            optionContent.appendChild(optionLink);
            option.appendChild(optionContent);
            
            dropdownContent.appendChild(option);
        });
        
        // Add Custom/Other option
        const customOption = createElement('div', {
            className: 'entity-schema-selector-custom__option entity-schema-selector-custom__option--custom',
            onClick: () => {
                toggleDropdown();
                openEntitySchemaSearchModal({
                    onSchemaSelect: (schema) => {
                        currentSchema = schema;
                        updateButtonText();
                        onSchemaSelect(schema);
                    }
                });
            }
        }, 'Custom/Other...');
        
        dropdownContent.appendChild(customOption);
    }
    
    createDropdownOptions();
    
    // Assemble container
    container.appendChild(dropdownButton);
    container.appendChild(dropdownContent);
    
    // Store references for cleanup
    container._cleanup = () => {
        document.removeEventListener('click', handleOutsideClick);
    };
    
    // Store current schema for updates
    container._currentSchema = currentSchema;
    container._updateSchema = (schema) => {
        currentSchema = schema;
        updateButtonText();
    };
    
    return container;
}

/**
 * Update the selector display with new schema
 * @param {HTMLElement} container - Selector container
 * @param {Object} schema - Selected schema
 */
function updateSelectorDisplay(container, schema) {
    if (container._updateSchema) {
        container._updateSchema(schema);
    }
}

/**
 * Open the Entity Schema search modal
 * @param {Object} options - Modal options
 * @param {Function} options.onSchemaSelect - Callback when schema is selected
 */
export function openEntitySchemaSearchModal(options = {}) {
    const { onSchemaSelect = () => {} } = options;
    
    // Create modal content
    const modalContent = createEntitySchemaSearchContent(onSchemaSelect);
    
    // Use the existing modal system structure
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalContentEl = document.getElementById('modal-content');
    const modalFooter = document.getElementById('modal-footer');
    
    if (!modalContainer || !modalTitle || !modalContentEl) {
        console.error('Modal system not available');
        return;
    }
    
    // Set modal content manually using the existing modal structure
    modalTitle.textContent = 'Select Entity Schema';
    modalContentEl.innerHTML = '';
    modalContentEl.appendChild(modalContent);
    
    // Set up cancel button
    if (modalFooter) {
        modalFooter.innerHTML = '';
        const cancelButton = createElement('button', {
            className: 'button button--secondary',
            onClick: () => {
                modalContainer.style.display = 'none';
            }
        }, 'Cancel');
        modalFooter.appendChild(cancelButton);
    }
    
    // Show modal
    modalContainer.style.display = 'flex';
    
    // Focus on search input after modal is shown
    setTimeout(() => {
        const searchInput = modalContent.querySelector('.entity-schema-search__input');
        if (searchInput) {
            searchInput.focus();
        }
    }, 100);
}

/**
 * Create the Entity Schema search modal content
 * @param {Function} onSchemaSelect - Callback when schema is selected
 * @returns {HTMLElement} Modal content element
 */
function createEntitySchemaSearchContent(onSchemaSelect) {
    const container = createElement('div', {
        className: 'entity-schema-search'
    });
    
    
    // Search section
    const searchSection = createElement('div', {
        className: 'entity-schema-search__section'
    });
    
    const searchTitle = createElement('h4', {
        className: 'entity-schema-search__section-title'
    }, 'Search Entity Schemas');
    
    const searchInput = createElement('input', {
        type: 'text',
        className: 'entity-schema-search__input',
        placeholder: 'Search for entity schemas (e.g., E471, book, person)...'
    });
    
    const searchStatus = createElement('div', {
        className: 'entity-schema-search__status'
    });
    
    const searchResults = createElement('div', {
        className: 'entity-schema-search__results',
        style: { display: 'none' }
    });
    
    // Suggested schemas section (shown below search results)
    const suggestedSection = createElement('div', {
        className: 'entity-schema-search__suggested'
    });
    
    const suggestedTitle = createElement('h4', {
        className: 'entity-schema-search__section-title'
    }, 'Suggested Entity Schemas');
    
    const suggestedGrid = createElement('div', {
        className: 'entity-schema-search__grid'
    });
    
    // Add default schemas as suggestions
    DEFAULT_SCHEMAS.forEach(schema => {
        const schemaCard = createEntitySchemaCard(schema, (selectedSchema) => {
            onSchemaSelect(selectedSchema);
            // Close modal
            const modalContainer = document.getElementById('modal-container');
            if (modalContainer) {
                modalContainer.style.display = 'none';
            }
        });
        suggestedGrid.appendChild(schemaCard);
    });
    
    suggestedSection.appendChild(suggestedTitle);
    suggestedSection.appendChild(suggestedGrid);
    
    // Search functionality
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchStatus.textContent = '';
            searchResults.style.display = 'none';
            return;
        }
        
        searchStatus.textContent = 'Searching...';
        
        searchTimeout = setTimeout(async () => {
            try {
                const results = await searchEntitySchemas(query);
                displaySearchResults(results, searchStatus, searchResults, (selectedSchema) => {
                    onSchemaSelect(selectedSchema);
                    // Close modal
                    const modalContainer = document.getElementById('modal-container');
                    if (modalContainer) {
                        modalContainer.style.display = 'none';
                    }
                });
            } catch (error) {
                console.error('Search error:', error);
                searchStatus.textContent = `Search failed: ${error.message}`;
                searchResults.style.display = 'none';
            }
        }, 300);
    });
    
    searchSection.appendChild(searchTitle);
    searchSection.appendChild(searchInput);
    searchSection.appendChild(searchStatus);
    searchSection.appendChild(searchResults);
    
    // Assemble container
    container.appendChild(searchSection);
    container.appendChild(suggestedSection);
    
    return container;
}

/**
 * Create an Entity Schema card component with new formatting
 * @param {Object} schema - Schema object
 * @param {Function} onSelect - Selection callback
 * @returns {HTMLElement} Schema card element
 */
function createEntitySchemaCard(schema, onSelect) {
    const card = createElement('div', {
        className: 'entity-schema-card',
        onClick: () => {
            onSelect(schema);
        }
    });
    
    // Create label (title) and E-number combination
    const labelText = createElement('span', {
        className: 'entity-schema-card__label-text'
    }, schema.label);
    
    const schemaId = createElement('span', {
        className: 'entity-schema-card__id-link',
        onClick: (e) => {
            e.stopPropagation();
            window.open(schema.url, '_blank');
        }
    }, `(${schema.id})`);
    
    const labelContainer = createElement('div', {
        className: 'entity-schema-card__label'
    });
    labelContainer.appendChild(labelText);
    labelContainer.appendChild(document.createTextNode(' '));
    labelContainer.appendChild(schemaId);
    
    const schemaDescription = createElement('div', {
        className: 'entity-schema-card__description'
    }, schema.description);
    
    card.appendChild(labelContainer);
    card.appendChild(schemaDescription);
    
    return card;
}

/**
 * Display search results in the modal
 * @param {Array} results - Search results
 * @param {HTMLElement} statusElement - Status display element
 * @param {HTMLElement} resultsElement - Results container element
 * @param {Function} onSchemaSelect - Selection callback
 */
function displaySearchResults(results, statusElement, resultsElement, onSchemaSelect) {
    if (results.length === 0) {
        statusElement.textContent = 'No entity schemas found.';
        resultsElement.style.display = 'none';
        return;
    }
    
    statusElement.textContent = `Found ${results.length} entity schema${results.length !== 1 ? 's' : ''}`;
    resultsElement.innerHTML = '';
    resultsElement.style.display = 'block';
    
    results.forEach(result => {
        const resultCard = createElement('div', {
            className: 'entity-schema-search__result',
            onClick: async () => {
                try {
                    // Get full schema details
                    const fullSchema = await getEntitySchema(result.id);
                    if (fullSchema) {
                        onSchemaSelect(fullSchema);
                    } else {
                        onSchemaSelect(result);
                    }
                } catch (error) {
                    console.error('Error selecting schema:', error);
                    showMessage('Error loading selected schema', 'error');
                }
            }
        });
        
        // Create label (title) and E-number combination
        const resultLabelText = createElement('span', {
            className: 'entity-schema-search__result-label-text'
        }, result.label || 'No label');
        
        const resultId = createElement('span', {
            className: 'entity-schema-search__result-id',
            onClick: (e) => {
                e.stopPropagation();
                window.open(result.url, '_blank');
            }
        }, `(${result.id})`);
        
        const resultLabel = createElement('div', {
            className: 'entity-schema-search__result-label'
        });
        resultLabel.appendChild(resultLabelText);
        resultLabel.appendChild(document.createTextNode(' '));
        resultLabel.appendChild(resultId);
        
        const resultDescription = createElement('div', {
            className: 'entity-schema-search__result-description'
        }, result.description || 'No description available');
        
        resultCard.appendChild(resultLabel);
        resultCard.appendChild(resultDescription);
        
        resultsElement.appendChild(resultCard);
    });
}

/**
 * Initialize Entity Schema selector in the mapping step
 * @param {Object} state - Application state
 * @returns {HTMLElement} The selector element
 */
export function initializeEntitySchemaSelector(state) {
    const currentState = state.getState();
    const selectedSchema = currentState.selectedEntitySchema;
    
    const selector = createEntitySchemaSelector({
        selectedSchemaId: selectedSchema?.id || '',
        onSchemaSelect: (schema) => {
            // Update state
            state.updateState('selectedEntitySchema', schema);
            
            // Emit event for other components to react
            eventSystem.publish('entitySchemaSelected', { schema });
            
            // Mark changes as unsaved
            state.markChangesUnsaved();
            
            showMessage(`Selected Entity Schema: ${schema.id}`, 'success', 3000);
        }
    });
    
    return selector;
}