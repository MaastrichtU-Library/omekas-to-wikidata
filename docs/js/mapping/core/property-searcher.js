/**
 * Wikidata property search module
 * Handles property searching, auto-suggestions, and selection logic
 * @module mapping/core/property-searcher
 */

// Import dependencies
import { eventSystem } from '../../events.js';
import { showMessage, createElement, createListItem } from '../../ui/components.js';
import { getCompletePropertyData, getBatchPropertyInfo, getCachedProperty } from '../../api/wikidata.js';
import { refreshStage3TransformationUI as refreshStage3UI } from './transformation-engine.js';
import { updateModalTitle, updateStage2Summary } from '../ui/modals/mapping-modal.js';
import { convertCamelCaseToSpaces } from './data-analyzer.js';
import { displayPropertyConstraints } from './constraint-validator.js';
import { createConstraintsSection } from '../ui/constraint-ui.js';
import { openRawJsonModal } from '../ui/modals/json-modal.js';

function refreshStage3TransformationUI() {
    const keyData = window.currentMappingKeyData || {};
    const state = window.mappingStepState;
    
    // Ensure the keyData includes the currently selected property
    if (window.currentMappingSelectedProperty) {
        keyData.property = window.currentMappingSelectedProperty;
    }
    
    if (keyData && state) {
        refreshStage3UI(keyData, state);
    }
}

/**
 * Format property constraints as HTML for display
 * @param {Object} propertyData - Property data with constraints
 * @returns {string} HTML string for display
 */
function formatPropertyConstraintsHTML(propertyData) {
    if (!propertyData || !propertyData.constraints) {
        return '<div class="no-constraints">No constraints available</div>';
    }
    
    let html = '<div class="property-constraints-display">';
    
    // Show datatype
    html += `<div class="constraint-datatype"><strong>Expected type:</strong> ${propertyData.datatypeLabel || propertyData.datatype || 'Unknown'}</div>`;
    
    // Show format constraints
    if (propertyData.constraints.format && propertyData.constraints.format.length > 0) {
        const formatConstraints = propertyData.constraints.format
            .filter(c => c.rank !== 'deprecated')
            .map(c => c.description)
            .filter(d => d)
            .join('; ');
        
        if (formatConstraints) {
            html += `<div class="constraint-format"><strong>Format:</strong> ${formatConstraints}</div>`;
        }
    }
    
    // Show value type constraints
    if (propertyData.constraints.valueType && propertyData.constraints.valueType.length > 0) {
        const valueTypes = [];
        propertyData.constraints.valueType
            .filter(c => c.rank !== 'deprecated')
            .forEach(constraint => {
                constraint.classes.forEach(classId => {
                    const label = constraint.classLabels?.[classId] || classId;
                    valueTypes.push(label);
                });
            });
        
        if (valueTypes.length > 0) {
            const displayTypes = valueTypes.slice(0, 5);
            let valueTypeText = displayTypes.join(', ');
            if (valueTypes.length > 5) {
                valueTypeText += ` and ${valueTypes.length - 5} more`;
            }
            html += `<div class="constraint-value-type"><strong>Must be:</strong> ${valueTypeText}</div>`;
        }
    }
    
    // Show other constraints count
    if (propertyData.constraints.other && propertyData.constraints.other.length > 0) {
        const otherCount = propertyData.constraints.other.filter(c => c.rank !== 'deprecated').length;
        if (otherCount > 0) {
            html += `<div class="constraint-other"><em>${otherCount} additional constraint${otherCount > 1 ? 's' : ''}</em></div>`;
        }
    }
    
    html += '</div>';
    return html;
}

/**
 * Setup search functionality for unified property modal
 */
export function setupUnifiedPropertySearch() {
    const searchInput = document.getElementById('unified-property-search-input');
    let searchTimeout;
    
    if (!searchInput) return;
    
    window.currentUnifiedPropertySelected = null;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            document.getElementById('unified-property-suggestions').innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchUnifiedWikidataProperties(query, document.getElementById('unified-property-suggestions'));
        }, 300);
    });
}

/**
 * Search Wikidata properties for unified modal
 */
export async function searchUnifiedWikidataProperties(query, container) {
    try {
        container.innerHTML = '<div class="loading">Searching...</div>';
        
        // Wikidata API search
        const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=property&format=json&origin=*`;
        
        const response = await fetch(wikidataUrl);
        const data = await response.json();
        
        displayUnifiedPropertySuggestions(data.search || [], container);
    } catch (error) {
        console.error('Error searching Wikidata properties:', error);
        container.innerHTML = '<div class="error">Error searching properties. Please try again.</div>';
    }
}

/**
 * Display property suggestions for unified modal
 */
export function displayUnifiedPropertySuggestions(suggestions, container) {
    if (suggestions.length === 0) {
        container.innerHTML = '<div class="no-results">No properties found. Try different search terms.</div>';
        return;
    }
    
    container.innerHTML = '';
    
    suggestions.forEach(prop => {
        const suggestionElement = createElement('div', {
            className: 'property-suggestion clickable',
            onClick: () => selectUnifiedProperty(prop)
        });
        
        suggestionElement.innerHTML = `
            <strong>${prop.id}</strong> - ${prop.label}
            <div class="property-description">${prop.description || 'No description available'}</div>
        `;
        
        container.appendChild(suggestionElement);
    });
}

/**
 * Select a property in unified modal
 */
export async function selectUnifiedProperty(property) {
    window.currentUnifiedPropertySelected = property;
    
    const selectedPropertyDiv = document.getElementById('unified-selected-property');
    const detailsDiv = document.getElementById('unified-selected-property-details');
    const constraintsDiv = document.getElementById('unified-property-constraints');
    
    if (!selectedPropertyDiv || !detailsDiv) return;
    
    // Show selected property
    selectedPropertyDiv.style.display = 'block';
    detailsDiv.innerHTML = `
        <div class="selected-property-info">
            <p><strong>ID:</strong> ${property.id}</p>
            <p><strong>Label:</strong> ${property.label}</p>
            <p><strong>Description:</strong> ${property.description || 'No description available'}</p>
        </div>
    `;
    
    // Clear suggestions
    document.getElementById('unified-property-suggestions').innerHTML = '';
    
    // Update search input
    const searchInput = document.getElementById('unified-property-search-input');
    if (searchInput) {
        searchInput.value = `${property.id}: ${property.label}`;
    }
    
    // Load constraints and data type info
    if (constraintsDiv) {
        const loadingDiv = constraintsDiv.querySelector('.constraint-loading');
        const contentDiv = constraintsDiv.querySelector('.constraint-content');
        
        if (loadingDiv && contentDiv) {
            loadingDiv.style.display = 'block';
            constraintsDiv.style.display = 'block';
            
            try {
                const propertyData = await getCompletePropertyData(property.id);
                
                // Log property data to console for developer inspection
                
                // Update Stage 2 with actual data type
                updateUnifiedStage2DataType(propertyData);
                
                // Show constraints with proper formatting
                const constraintsHTML = formatPropertyConstraintsHTML(propertyData);
                contentDiv.innerHTML = constraintsHTML;
                loadingDiv.style.display = 'none';
            } catch (error) {
                console.error('Error loading property data:', error);
                contentDiv.innerHTML = '<div class="error">Error loading property information.</div>';
                loadingDiv.style.display = 'none';
            }
        }
    }
}

/**
 * Update Stage 2 data type information for unified modal
 */
function updateUnifiedStage2DataType(propertyData) {
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
 * Extract properties from selected entity schema
 * @param {Object} state - Application state
 * @returns {Array} Array of property IDs from the entity schema
 */
export function extractEntitySchemaProperties(state) {
    const currentState = state.getState();
    const selectedSchema = currentState.selectedEntitySchema;
    
    if (!selectedSchema || !selectedSchema.properties) {
        return [];
    }
    
    const properties = [];
    
    // Add required properties first (prioritized)
    if (selectedSchema.properties.required) {
        selectedSchema.properties.required.forEach(prop => {
            properties.push({
                id: prop.id,
                cardinality: prop.cardinality,
                constraint: prop.constraint,
                required: true
            });
        });
    }
    
    // Add optional properties second
    if (selectedSchema.properties.optional) {
        selectedSchema.properties.optional.forEach(prop => {
            properties.push({
                id: prop.id,
                cardinality: prop.cardinality,
                constraint: prop.constraint,
                required: false
            });
        });
    }
    
    return properties;
}

/**
 * Setup entity schema property selection dropdown with optimized batch loading
 * @param {Object} state - Application state
 */
export async function setupEntitySchemaPropertySelection(state) {
    const dropdown = document.getElementById('entity-schema-property-select');
    if (!dropdown) return;
    
    const schemaProperties = extractEntitySchemaProperties(state);
    if (schemaProperties.length === 0) return;
    
    // Progressive enhancement: First show property IDs immediately for instant UI
    const propertyOptions = new Map();
    
    // Phase 1: Create basic options with IDs instantly (no API calls)
    schemaProperties.forEach(schemaProp => {
        const option = createElement('option', {
            value: schemaProp.id
        });
        
        const requiredIndicator = schemaProp.required ? ' (required)' : ' (optional)';
        option.textContent = `${schemaProp.id}${requiredIndicator} - Loading...`;
        
        // Store minimal property data for immediate selection capability
        option.dataset.propertyData = JSON.stringify({
            id: schemaProp.id,
            label: schemaProp.id,
            description: 'Property from entity schema'
        });
        
        dropdown.appendChild(option);
        propertyOptions.set(schemaProp.id, { option, schemaProp });
    });
    
    // Phase 2: Batch fetch all property data in background and enhance options
    try {
        const propertyIds = schemaProperties.map(prop => prop.id);
        
        // Check cache status to provide accurate logging
        const cachedIds = [];
        const uncachedIds = [];
        
        for (const propertyId of propertyIds) {
            const cached = getCachedProperty(propertyId, 'info');
            if (cached) {
                cachedIds.push(propertyId);
            } else {
                uncachedIds.push(propertyId);
            }
        }
        
        // Only log batch loading when actual API calls will be made
        if (uncachedIds.length > 0) {
        }
        
        // Show cache hit info for debugging if any properties are cached
        if (cachedIds.length > 0) {
        }
        
        // Single batch API call instead of sequential calls!
        const batchResults = await getBatchPropertyInfo(propertyIds);
        
        // Phase 3: Enhance dropdown options with fetched data
        for (const [propertyId, propertyData] of Object.entries(batchResults)) {
            const optionData = propertyOptions.get(propertyId);
            if (optionData) {
                const { option, schemaProp } = optionData;
                
                // Update option text with rich information
                const datatype = propertyData.datatype || 'unknown';
                const requiredIndicator = schemaProp.required ? ' (required)' : ' (optional)';
                option.textContent = `${propertyId}: ${propertyData.label || propertyId}${requiredIndicator} - ${datatype}`;
                
                // Update stored property data
                option.dataset.propertyData = JSON.stringify({
                    id: propertyId,
                    label: propertyData.label,
                    description: propertyData.description || 'Property from entity schema'
                });
            }
        }
        
        // Show completion message based on what actually happened
        if (uncachedIds.length > 0) {
        }
        
    } catch (error) {
        console.error('Failed to batch load entity schema properties:', error);
        // Options remain with basic IDs - still functional
    }
    
    // Handle dropdown selection (only set up once)
    dropdown.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        if (selectedValue) {
            const selectedOption = e.target.querySelector(`option[value="${selectedValue}"]`);
            if (selectedOption && selectedOption.dataset.propertyData) {
                try {
                    const propertyData = JSON.parse(selectedOption.dataset.propertyData);
                    selectProperty(propertyData, state);
                } catch (error) {
                    console.error('Failed to parse property data:', error);
                }
            }
        }
    });
}

/**
 * Setup property search functionality
 * 
 * @param {Object} keyData - Data about the metadata key being mapped
 * @param {string} keyData.key - The metadata key name
 * @param {any} keyData.sampleValue - Sample value to guide property suggestions
 * 
 * @description
 * Search behavior:
 * - Minimum 2 characters before triggering search (prevents excessive API calls)
 * - 300ms debounce delay to wait for user to finish typing
 * - Automatic restoration of previous mappings for edit scenarios
 * - Context-aware suggestions based on sample data analysis
 */
export function setupPropertySearch(keyData, state) {
    const searchInput = document.getElementById('property-search-input');
    const suggestionsContainer = document.getElementById('property-suggestions');
    let searchTimeout;
    let selectedProperty = null;
    
    if (!searchInput) return;
    
    // Pre-populate if this key is already mapped
    if (keyData && keyData.property) {
        window.currentMappingSelectedProperty = keyData.property;
        selectProperty(keyData.property, state);
        searchInput.value = `${keyData.property.id}: ${keyData.property.label}`;
        
        // Also trigger immediate Stage 3 refresh for robustness
        setTimeout(() => refreshStage3TransformationUI(), 50);
    } else {
        window.currentMappingSelectedProperty = null;
        
        // Pre-fill search with key name (without schema prefix) and auto-search
        if (keyData && keyData.key) {
            let searchTerm = keyData.key;
            
            // Remove schema prefix if present (everything before and including ':')
            if (searchTerm.includes(':')) {
                searchTerm = searchTerm.split(':').pop();
            }
            
            // Convert camelCase to spaced words
            searchTerm = convertCamelCaseToSpaces(searchTerm);
            
            // Set the search input value
            searchInput.value = searchTerm;
            
            // Automatically perform the search if the term is meaningful
            if (searchTerm.trim().length >= 2) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    searchWikidataProperties(searchTerm.trim(), suggestionsContainer, state);
                }, 100);
            }
        }
    }
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            suggestionsContainer.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchWikidataProperties(query, suggestionsContainer, state);
        }, 300);
    });
}

/**
 * Searches Wikidata for properties matching the user query
 * 
 * This function handles the core integration with Wikidata's search API to find
 * relevant properties. It implements intelligent result processing including:
 * - Multi-source result aggregation (API search + auto-suggestions)
 * - Result deduplication and ranking
 * - Previous selection highlighting for user convenience
 * - Error handling with graceful degradation
 * 
 * @param {string} query - User search query (minimum 2 characters)
 * @param {HTMLElement} container - DOM container for displaying results
 * @param {Object} state - Application state object
 * 
 * @throws {Error} When Wikidata API is unavailable or returns invalid data
 * 
 * @description
 * Search strategy:
 * 1. Calls Wikidata API with query string
 * 2. Supplements API results with context-based auto-suggestions
 * 3. Combines and deduplicates results by property ID
 * 4. Ranks results by relevance (exact matches first, then partial matches)
 * 5. Highlights previously selected properties for user reference
 * 
 * Rate limiting: API calls are naturally rate-limited by the 300ms debounce
 * in setupPropertySearch(). No additional throttling is implemented.
 */
export async function searchWikidataProperties(query, container, state) {
    try {
        container.innerHTML = '<div class="loading">Searching...</div>';
        
        // Check autosuggest first
        const autoSuggestions = getAutoSuggestions(query, state);
        
        // Wikidata API search
        const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=property&format=json&origin=*`;
        
        const response = await fetch(wikidataUrl);
        const data = await response.json();
        
        displayPropertySuggestions(data.search || [], autoSuggestions, container, state);
    } catch (error) {
        console.error('Error searching Wikidata properties:', error);
        container.innerHTML = '<div class="error">Error searching properties. Please try again.</div>';
    }
}

/**
 * Get autosuggest based on previously mapped keys
 */
export function getAutoSuggestions(query, state) {
    const suggestions = [];
    const currentState = state.getState();
    
    // Get previously mapped properties from state
    if (currentState.mappings && currentState.mappings.mappedKeys) {
        currentState.mappings.mappedKeys.forEach(mappedKey => {
            if (mappedKey.property && 
                (mappedKey.property.label.toLowerCase().includes(query.toLowerCase()) ||
                 mappedKey.property.id.toLowerCase().includes(query.toLowerCase()))) {
                suggestions.push({
                    ...mappedKey.property,
                    isPrevious: true
                });
            }
        });
    }
    
    return suggestions;
}

/**
 * Display property suggestions
 */
export function displayPropertySuggestions(wikidataResults, autoSuggestions, container, state) {
    container.innerHTML = '';
    
    // Show autosuggest results first
    if (autoSuggestions.length > 0) {
        const autoSection = createElement('div', {
            className: 'suggestion-section'
        });
        autoSection.innerHTML = '<h5>Previously Used</h5>';
        
        autoSuggestions.forEach(property => {
            const item = createPropertySuggestionItem(property, true, state);
            autoSection.appendChild(item);
        });
        
        container.appendChild(autoSection);
    }
    
    // Show Wikidata results
    if (wikidataResults.length > 0) {
        const wikidataSection = createElement('div', {
            className: 'suggestion-section'
        });
        wikidataSection.innerHTML = '<h5>Select a Wikidata property</h5>';
        
        wikidataResults.forEach(property => {
            const formattedProperty = {
                id: property.id,
                label: property.label,
                description: property.description || 'No description available'
            };
            const item = createPropertySuggestionItem(formattedProperty, false, state);
            wikidataSection.appendChild(item);
        });
        
        container.appendChild(wikidataSection);
    }
    
    if (autoSuggestions.length === 0 && wikidataResults.length === 0) {
        container.innerHTML = '<div class="no-results">No properties found</div>';
    }
}

/**
 * Create a property suggestion item
 */
export function createPropertySuggestionItem(property, isPrevious, state) {
    const item = createElement('div', {
        className: `property-suggestion-item ${isPrevious ? 'previous' : ''}`,
        onClick: () => selectProperty(property, state)
    });
    
    item.innerHTML = `
        <div class="property-main">
            <span class="property-id clickable" title="View on Wikidata">${property.id}</span>
            <span class="property-label">${property.label}</span>
        </div>
        <div class="property-description">${property.description}</div>
    `;
    
    // Make property ID clickable
    const propertyIdSpan = item.querySelector('.property-id');
    if (propertyIdSpan) {
        propertyIdSpan.style.cursor = 'pointer';
        propertyIdSpan.style.textDecoration = 'underline';
        propertyIdSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(`https://www.wikidata.org/wiki/Property:${property.id}`, '_blank');
        });
    }
    
    return item;
}

/**
 * Selects a Wikidata property and initiates the data type configuration process
 * 
 * This is a critical function that handles the transition from property selection
 * to data type analysis and constraint validation. It orchestrates:
 * - Property selection UI updates and state management
 * - Automatic data type detection based on Omeka S sample values
 * - Wikidata constraint fetching for validation and guidance
 * - Multi-stage modal workflow progression
 * 
 * The data type detection is crucial because it determines how values will be
 * formatted for Wikidata import and what validation rules apply.
 * 
 * @param {Object} property - Selected Wikidata property object
 * @param {string} property.id - Wikidata property ID (e.g., "P31")
 * @param {string} property.label - Human-readable property name
 * @param {string} property.description - Property description from Wikidata
 * @param {string} property.datatype - Wikidata datatype (item, string, time, etc.)
 * @param {Object} state - Application state object
 * 
 * @returns {Promise<void>} Resolves when selection process is complete
 * 
 * @description
 * Selection workflow:
 * 1. Updates UI to show selected property with visual feedback
 * 2. Stores selection in global state for modal workflow
 * 3. Fetches detailed property constraints from Wikidata
 * 4. Triggers automatic data type detection based on sample values
 * 5. Expands stage 2 of modal to show data type configuration
 * 6. Prepares interface for user confirmation or adjustment
 */
export async function selectProperty(property, state) {
    // Remove selection from other items
    document.querySelectorAll('.property-suggestion-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to clicked item if event exists
    if (typeof event !== 'undefined' && event.target) {
        const targetItem = event.target.closest('.property-suggestion-item');
        if (targetItem) {
            targetItem.classList.add('selected');
        }
    }
    
    // Store selected property
    window.currentMappingSelectedProperty = property;

    // Transfer transformations from temporary mapping ID to final mapping ID
    const keyData = window.currentMappingKeyData;
    if (keyData && keyData.key && state) {
        const tempMappingId = `temp_${keyData.key}`;
        const finalMappingId = state.generateMappingId(keyData.key, property.id, keyData.selectedAtField);

        // Check if there are transformations stored under the temporary ID
        const currentState = state.getState();
        const tempBlocks = currentState.mappings?.transformationBlocks?.[tempMappingId] || [];

        if (tempBlocks.length > 0) {
            // Transfer all transformation blocks from temporary to final mapping ID
            tempBlocks.forEach(block => {
                state.addTransformationBlock(finalMappingId, block);
            });

            // Clean up the temporary mapping ID
            if (currentState.mappings?.transformationBlocks) {
                delete currentState.mappings.transformationBlocks[tempMappingId];
            }
        }
    }

    // Update search input with selected property label
    const searchInput = document.getElementById('property-search-input');
    if (searchInput) {
        searchInput.value = `${property.id}: ${property.label}`;
    }
    
    // Clear suggestions container
    const suggestionsContainer = document.getElementById('property-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
    }
    
    // Show selected property details
    const selectedContainer = document.getElementById('selected-property');
    const detailsContainer = document.getElementById('selected-property-details');
    
    if (selectedContainer && detailsContainer) {
        detailsContainer.innerHTML = `
            <div class="selected-property-info">
                <span class="property-id clickable" title="View on Wikidata" style="cursor: pointer; text-decoration: underline;">${property.id}</span>
                <span class="property-label">${property.label}</span>
                <div class="property-description">${property.description}</div>
            </div>
        `;
        
        // Make property ID clickable
        const propertyIdSpan = detailsContainer.querySelector('.property-id');
        if (propertyIdSpan) {
            propertyIdSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(`https://www.wikidata.org/wiki/Property:${property.id}`, '_blank');
            });
        }
        selectedContainer.style.display = 'block';
    }
    
    // Fetch and display constraints (existing flow)
    await displayPropertyConstraints(property.id);
    
    // NEW: Transition to Stage 2 after property selection
    await transitionToDataTypeConfiguration(property);
}

/**
 * Transition to Stage 3 (skip Stage 2) after property selection
 */
export async function transitionToDataTypeConfiguration(property) {
    // Update modal title to show the mapping relationship
    updateModalTitle(property);
    
    // Get all stages
    const stage1 = document.getElementById('stage-1-property-selection');
    const stage2 = document.getElementById('stage-2-value-type-detection');
    const stage3 = document.getElementById('stage-3-value-transformation');
    
    if (stage1 && stage2 && stage3) {
        // Mark stages 1 and 2 as completed
        stage1.classList.add('stage-completed');
        stage2.classList.add('stage-completed');
        
        // Collapse stages 1 and 2
        stage1.open = false;
        stage2.open = false;
        
        // Open stage 3 after a brief delay for better UX
        setTimeout(() => {
            stage3.open = true;
            // Refresh Stage 3 transformation UI with the selected property
            refreshStage3TransformationUI();
        }, 300);
    }
    
    // Still process data type information silently (for internal use)
    await displayDataTypeConfiguration(property);
}

// updateModalTitle and updateStage2Summary are now imported from mapping-modal.js

/**
 * Display data type configuration in Stage 2
 */
export async function displayDataTypeConfiguration(property) {
    const datatypeContainer = document.getElementById('detected-datatype');
    const descriptionContainer = document.getElementById('datatype-description');
    
    if (!datatypeContainer) return;
    
    // Show loading state
    datatypeContainer.innerHTML = '<div class="datatype-loading">Loading data type information...</div>';
    
    try {
        // Fetch complete property data
        const propertyData = await getCompletePropertyData(property.id);
        
        // Log property data for developer inspection
        
        // Update the stored property with complete data
        window.currentMappingSelectedProperty = propertyData;
        
        // Create the main data type display
        const datatypeDisplay = createElement('div', {
            className: 'datatype-result'
        });
        
        // Main data type information
        const mainInfo = createElement('div', {
            className: 'datatype-main-info'
        });
        mainInfo.innerHTML = `
            <div class="datatype-header">
                <span class="datatype-name">${propertyData.datatypeLabel}</span>
                <span class="datatype-code">(${propertyData.datatype})</span>
            </div>
            <div class="datatype-summary">${getDataTypeSummary(propertyData.datatype)}</div>
        `;
        datatypeDisplay.appendChild(mainInfo);
        
        // Constraints section
        const constraintsSection = createConstraintsSection(propertyData.constraints);
        if (constraintsSection) {
            datatypeDisplay.appendChild(constraintsSection);
        }
        
        // Technical details button
        const technicalSection = createElement('div', {
            className: 'technical-details-section'
        });
        
        const rawJsonBtn = createElement('button', {
            className: 'raw-json-btn',
            onClick: () => openRawJsonModal(propertyData)
        }, '{ } View Raw JSON');
        
        technicalSection.appendChild(rawJsonBtn);
        datatypeDisplay.appendChild(technicalSection);
        
        // Replace loading with content
        datatypeContainer.innerHTML = '';
        datatypeContainer.appendChild(datatypeDisplay);
        
        // Update Stage 2 summary with detected data type
        updateStage2Summary(propertyData);
        
        // Hide the redundant description section
        if (descriptionContainer) {
            descriptionContainer.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error displaying data type configuration:', error);
        datatypeContainer.innerHTML = `
            <div class="datatype-error">
                <span class="error-message">Unable to load data type information</span>
                <div class="error-details">${error.message}</div>
            </div>
        `;
    }
}

/**
 * Get a clear summary of what the data type means
 */
function getDataTypeSummary(datatype) {
    const summaries = {
        'wikibase-item': 'Values must be links to other Wikidata items (Q-numbers)',
        'string': 'Values are text strings with no language or translation needed',
        'external-id': 'Values are identifiers from external systems (IDs, codes)',
        'time': 'Values are dates or points in time',
        'quantity': 'Values are numbers with optional units of measurement', 
        'url': 'Values are web addresses (URLs)',
        'commonsMedia': 'Values are filenames of media files on Wikimedia Commons',
        'monolingualtext': 'Values are text in a specific language',
        'globe-coordinate': 'Values are geographical coordinates (latitude/longitude)',
        'wikibase-property': 'Values are links to Wikidata properties (P-numbers)',
        'math': 'Values are mathematical expressions',
        'geo-shape': 'Values are geographic shapes or regions',
        'musical-notation': 'Values are musical notation',
        'tabular-data': 'Values are structured tabular data',
        'wikibase-lexeme': 'Values are links to lexemes',
        'wikibase-form': 'Values are links to word forms',
        'wikibase-sense': 'Values are links to word senses'
    };
    
    return summaries[datatype] || 'Values follow Wikidata specifications for this data type';
}