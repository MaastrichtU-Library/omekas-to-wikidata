/**
 * Entity Schema Selector Component
 * Handles the dropdown and modal for Entity Schema selection
 * @module entity-schemas/entity-schema-selector
 */

import { createElement, createButton, createModal, showMessage } from '../ui/components.js';
import { DEFAULT_SCHEMAS, searchEntitySchemas, getEntitySchema } from './entity-schema-core.js';
import { eventSystem } from '../events.js';

/**
 * Create the Entity Schema selector dropdown component
 * @param {Object} options - Configuration options
 * @param {string} options.selectedSchemaId - Currently selected schema ID
 * @param {Function} options.onSchemaSelect - Callback when schema is selected
 * @returns {HTMLElement} The dropdown container element
 */
export function createEntitySchemaSelector(options = {}) {
    const { selectedSchemaId = '', onSchemaSelect = () => {} } = options;
    
    const container = createElement('div', { 
        className: 'entity-schema-selector' 
    });
    
    // Create label
    const label = createElement('label', {
        htmlFor: 'entity-schema-select',
        className: 'entity-schema-selector__label'
    }, 'Entity Schema:');
    
    // Create select dropdown
    const select = createElement('select', {
        id: 'entity-schema-select',
        className: 'entity-schema-selector__select'
    });
    
    // Add default option
    select.appendChild(createElement('option', {
        value: '',
        disabled: true,
        selected: !selectedSchemaId
    }, 'Select Entity Schema'));
    
    // Add default schemas
    DEFAULT_SCHEMAS.forEach(schema => {
        select.appendChild(createElement('option', {
            value: schema.id,
            selected: selectedSchemaId === schema.id
        }, `${schema.id}: ${schema.label}`));
    });
    
    // Add "Custom/Other" option
    select.appendChild(createElement('option', {
        value: 'custom'
    }, 'Custom/Other...'));
    
    // Create external link button
    const linkButton = createElement('button', {
        type: 'button',
        className: 'entity-schema-selector__link-button',
        title: 'View Entity Schema on Wikidata',
        disabled: !selectedSchemaId,
        onClick: () => {
            if (selectedSchemaId && selectedSchemaId !== 'custom') {
                window.open(`https://www.wikidata.org/wiki/EntitySchema:${selectedSchemaId}`, '_blank');
            }
        }
    }, '🔗');
    
    // Handle select changes
    select.addEventListener('change', async (e) => {
        const selectedValue = e.target.value;
        
        if (selectedValue === 'custom') {
            // Reset select to previous value temporarily
            e.target.value = selectedSchemaId || '';
            // Open custom schema search modal
            openEntitySchemaSearchModal({
                onSchemaSelect: (schema) => {
                    onSchemaSelect(schema);
                    updateSelectorDisplay(container, schema);
                }
            });
        } else if (selectedValue) {
            // Load default schema
            try {
                const schema = await getEntitySchema(selectedValue);
                if (schema) {
                    onSchemaSelect(schema);
                    updateSelectorDisplay(container, schema);
                } else {
                    showMessage('Failed to load Entity Schema', 'error');
                    e.target.value = selectedSchemaId || '';
                }
            } catch (error) {
                console.error('Error loading schema:', error);
                showMessage('Error loading Entity Schema', 'error');
                e.target.value = selectedSchemaId || '';
            }
        }
    });
    
    // Assemble container
    container.appendChild(label);
    container.appendChild(select);
    container.appendChild(linkButton);
    
    // Store references for later updates
    container._select = select;
    container._linkButton = linkButton;
    
    return container;
}

/**
 * Update the selector display with new schema
 * @param {HTMLElement} container - Selector container
 * @param {Object} schema - Selected schema
 */
function updateSelectorDisplay(container, schema) {
    const select = container._select;
    const linkButton = container._linkButton;
    
    // Check if this is a custom schema not in the default list
    const isCustomSchema = !DEFAULT_SCHEMAS.find(s => s.id === schema.id);
    
    if (isCustomSchema) {
        // Add custom option if not already present
        let customOption = select.querySelector(`option[value="${schema.id}"]`);
        if (!customOption) {
            customOption = createElement('option', {
                value: schema.id
            }, `${schema.id}: ${schema.label}`);
            // Insert before "Custom/Other" option
            const customOptionElement = select.querySelector('option[value="custom"]');
            select.insertBefore(customOption, customOptionElement);
        }
    }
    
    // Set selected value
    select.value = schema.id;
    
    // Enable/update link button
    linkButton.disabled = false;
    linkButton.title = `View ${schema.id} on Wikidata`;
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
    
    // Create modal using existing modal system
    const modal = createModal({
        title: 'Select Entity Schema',
        content: modalContent,
        size: 'large',
        buttons: [
            {
                text: 'Cancel',
                className: 'button button--secondary',
                onClick: () => {
                    document.getElementById('modal-container').style.display = 'none';
                }
            }
        ]
    });
    
    // Show modal
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = '';
    modalContainer.appendChild(modal);
    modalContainer.style.display = 'flex';
    
    // Focus on search input after modal is shown
    setTimeout(() => {
        const searchInput = modal.querySelector('.entity-schema-search__input');
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
    
    // Suggested schemas section
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
        const schemaCard = createEntitySchemaCard(schema, onSchemaSelect);
        suggestedGrid.appendChild(schemaCard);
    });
    
    suggestedSection.appendChild(suggestedTitle);
    suggestedSection.appendChild(suggestedGrid);
    
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
                displaySearchResults(results, searchStatus, searchResults, onSchemaSelect);
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
    container.appendChild(suggestedSection);
    container.appendChild(searchSection);
    
    return container;
}

/**
 * Create an Entity Schema card component
 * @param {Object} schema - Schema object
 * @param {Function} onSelect - Selection callback
 * @returns {HTMLElement} Schema card element
 */
function createEntitySchemaCard(schema, onSelect) {
    const card = createElement('div', {
        className: 'entity-schema-card',
        onClick: () => {
            onSelect(schema);
            // Close modal
            document.getElementById('modal-container').style.display = 'none';
        }
    });
    
    const schemaId = createElement('div', {
        className: 'entity-schema-card__id',
        onClick: (e) => {
            e.stopPropagation();
            window.open(schema.url, '_blank');
        }
    }, schema.id);
    
    const schemaLabel = createElement('div', {
        className: 'entity-schema-card__label'
    }, schema.label);
    
    const schemaDescription = createElement('div', {
        className: 'entity-schema-card__description'
    }, schema.description);
    
    card.appendChild(schemaId);
    card.appendChild(schemaLabel);
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
                    // Close modal
                    document.getElementById('modal-container').style.display = 'none';
                } catch (error) {
                    console.error('Error selecting schema:', error);
                    showMessage('Error loading selected schema', 'error');
                }
            }
        });
        
        const resultId = createElement('div', {
            className: 'entity-schema-search__result-id',
            onClick: (e) => {
                e.stopPropagation();
                window.open(result.url, '_blank');
            }
        }, result.id);
        
        const resultLabel = createElement('div', {
            className: 'entity-schema-search__result-label'
        }, result.label || 'No label');
        
        const resultDescription = createElement('div', {
            className: 'entity-schema-search__result-description'
        }, result.description || 'No description available');
        
        resultCard.appendChild(resultId);
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
            eventSystem.emit('entitySchemaSelected', { schema });
            
            // Mark changes as unsaved
            state.markChangesUnsaved();
            
            showMessage(`Selected Entity Schema: ${schema.id}`, 'success', 3000);
        }
    });
    
    return selector;
}