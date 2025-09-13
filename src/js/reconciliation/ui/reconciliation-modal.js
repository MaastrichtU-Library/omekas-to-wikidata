/**
 * Simplified Reconciliation Modal Interface
 * @module reconciliation/ui/reconciliation-modal
 * 
 * Clean, focused reconciliation interface that handles:
 * - Wikidata Items: existing matches, reconciliation options, manual search
 * - Strings: transformation output, regex validation, inline editing
 */

import { createElement } from '../../ui/components.js';
import { tryDirectWikidataSearch } from '../core/entity-matcher.js';
import { 
    extractRegexConstraints, 
    validateStringValue, 
    validateRealTime, 
    getSuggestedFixes,
    createValidationUI,
    setupLiveValidation
} from './validation-engine.js';

/**
 * Create the simplified reconciliation modal content
 */
export function createReconciliationModal(itemId, property, valueIndex, value, propertyData = null) {
    // Placeholder entity schema information
    const entitySchema = {
        id: 'E473',
        label: 'edition or translation of a written work, Maastricht University Library',
        url: 'https://www.wikidata.org/wiki/EntitySchema:E473'
    };
    
    // Determine data type from property
    const dataType = getDataTypeFromProperty(property, propertyData);
    const transformedValue = getTransformedValue(value, property);
    
    // Set up modal context for validation and interactions
    window.currentModalContext = {
        itemId,
        property,
        valueIndex,
        originalValue: value,
        transformedValue,
        currentValue: transformedValue,
        propertyData,
        dataType,
        entitySchema
    };
    
    const modalContent = createElement('div', { className: 'reconciliation-modal-redesign' }, `
        <!-- Header Section -->
        <div class="modal-header">
            <div class="data-type-indicator">
                <span class="data-type-label">Expected:</span>
                <span class="data-type-value">${getDataTypeDisplayName(dataType)}</span>
            </div>
            <div class="entity-schema-info">
                <span class="schema-label">Schema:</span>
                <a href="${entitySchema.url}" target="_blank" class="schema-link">${entitySchema.id}</a>
            </div>
        </div>

        <!-- Transformation Result -->
        <div class="transformation-result">
            <div class="section-title">Transformation Result</div>
            <div class="transformed-value">${escapeHtml(transformedValue)}</div>
            <div class="original-context">
                <span class="original-label">Original:</span>
                <span class="original-value">${escapeHtml(value)}</span>
            </div>
        </div>

        <!-- Content Section (Data Type Specific) -->
        <div class="content-section" id="content-section">
            ${dataType === 'wikibase-item' ? createWikidataItemSection(transformedValue) : createStringSection(transformedValue, property, propertyData)}
        </div>

        <!-- Action Buttons -->
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeReconciliationModal()">Cancel</button>
            <button class="btn btn-primary" id="confirm-btn" onclick="confirmReconciliation()" disabled>Confirm</button>
        </div>
    `);

    // Initialize the modal after DOM insertion
    setTimeout(() => {
        initializeModalInteractions(dataType, transformedValue, property, propertyData);
    }, 100);

    return modalContent;
}

/**
 * Initialize modal interactions after DOM insertion
 */
function initializeModalInteractions(dataType, value, property, propertyData) {
    if (dataType === 'wikibase-item') {
        // Load existing matches for Wikidata items
        loadExistingMatches(value);
    } else if (dataType === 'string') {
        // Set up live validation for string inputs
        const stringEditor = document.getElementById('string-editor');
        const validationContainer = document.getElementById('editor-validation');
        
        if (stringEditor && validationContainer) {
            const constraints = extractRegexConstraints(property, propertyData);
            if (constraints) {
                setupLiveValidation(stringEditor, constraints, validationContainer);
            }
        }
        
        // Initial validation state check
        const constraints = extractRegexConstraints(property, propertyData);
        const validation = validateStringValue(value, constraints);
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = !validation.isValid;
        }
    }
}

/**
 * Create Wikidata Item reconciliation section
 */
function createWikidataItemSection(value) {
    return `
        <div class="wikidata-item-section">
            <!-- Existing Matches -->
            <div class="existing-matches" id="existing-matches">
                <div class="section-title">Existing Matches</div>
                <div class="loading-indicator">Finding matches...</div>
            </div>

            <!-- Manual Search -->
            <div class="manual-search">
                <div class="section-title">Search Wikidata</div>
                <div class="search-container">
                    <input type="text" id="wikidata-search" class="search-input" 
                           placeholder="Search for a different item..." value="${escapeHtml(value)}">
                    <button class="btn btn-primary" onclick="performWikidataSearch()">Search</button>
                </div>
                <div class="search-results" id="search-results"></div>
            </div>

            <!-- Alternative Actions -->
            <div class="alternative-actions">
                <button class="btn btn-outline" onclick="useAsString()">Use as String Instead</button>
                <button class="btn btn-outline" onclick="createNewWikidataItem()">Create New Item</button>
            </div>
        </div>
    `;
}

/**
 * Create String validation section  
 */
function createStringSection(value, property, propertyData) {
    const regexConstraints = extractRegexConstraints(property, propertyData);
    const validationResult = validateStringValue(value, regexConstraints);

    return `
        <div class="string-section">
            <!-- String Value Display -->
            <div class="string-value-display">
                <div class="section-title">String Value</div>
                <div class="current-value" id="current-value">${escapeHtml(value)}</div>
                ${validationResult ? `
                    <div class="validation-status ${validationResult.isValid ? 'valid' : 'invalid'}">
                        <span class="status-icon">${validationResult.isValid ? '✓' : '✗'}</span>
                        <span class="status-text">${validationResult.message}</span>
                    </div>
                ` : ''}
            </div>

            <!-- String Editor (shown if validation fails) -->
            ${!validationResult?.isValid ? `
                <div class="string-editor">
                    <div class="section-title">Edit Value</div>
                    <textarea id="string-editor" class="string-input" placeholder="Edit the value to make it comply...">${escapeHtml(value)}</textarea>
                    <div class="editor-validation" id="editor-validation"></div>
                    <button class="btn btn-primary" onclick="updateStringValue()">Update Value</button>
                </div>
            ` : ''}

            <!-- Constraint Information -->
            ${regexConstraints ? `
                <div class="constraint-info">
                    <div class="section-title">Validation Rules</div>
                    <div class="constraint-details">
                        <div class="constraint-pattern">
                            <span class="constraint-label">Pattern:</span>
                            <code class="constraint-regex">${escapeHtml(regexConstraints.pattern)}</code>
                        </div>
                        ${regexConstraints.description ? `
                            <div class="constraint-description">${escapeHtml(regexConstraints.description)}</div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Determine data type from property information
 */
function getDataTypeFromProperty(property, propertyData) {
    // Check if we have explicit property data
    if (propertyData && propertyData.datatype) {
        return propertyData.datatype;
    }
    
    // Common property patterns for auto-detection
    const itemPatterns = ['creator', 'author', 'publisher', 'place', 'person', 'organization'];
    const stringPatterns = ['title', 'description', 'note', 'text', 'label'];
    
    const lowerProperty = property.toLowerCase();
    
    if (itemPatterns.some(pattern => lowerProperty.includes(pattern))) {
        return 'wikibase-item';
    }
    
    if (stringPatterns.some(pattern => lowerProperty.includes(pattern))) {
        return 'string';
    }
    
    // Default to string for unknown properties
    return 'string';
}

/**
 * Get display name for data type
 */
function getDataTypeDisplayName(dataType) {
    const displayNames = {
        'wikibase-item': 'Wikidata Item',
        'string': 'Text String',
        'external-id': 'External ID',
        'url': 'URL',
        'quantity': 'Number',
        'time': 'Date/Time',
        'monolingualtext': 'Text with Language',
        'globe-coordinate': 'Coordinates'
    };
    
    return displayNames[dataType] || dataType;
}

/**
 * Get transformed value (placeholder - in real implementation this would come from transformation stage)
 */
function getTransformedValue(value, property) {
    // Placeholder transformation logic
    // In real implementation, this would get the result from the transformation stage
    return value.trim();
}


/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Load existing matches for Wikidata items
 */
export async function loadExistingMatches(value) {
    const matchesContainer = document.getElementById('existing-matches');
    if (!matchesContainer) return;
    
    try {
        const matches = await tryDirectWikidataSearch(value);
        
        if (matches && matches.length > 0) {
            const topMatches = matches.slice(0, 3); // Show top 3 matches
            
            matchesContainer.innerHTML = `
                <div class="section-title">Existing Matches</div>
                <div class="matches-list">
                    ${topMatches.map(match => createMatchItem(match)).join('')}
                </div>
                ${matches.length > 3 ? `
                    <button class="btn btn-link" onclick="showAllMatches()">Show all ${matches.length} matches</button>
                ` : ''}
            `;
        } else {
            matchesContainer.innerHTML = `
                <div class="section-title">Existing Matches</div>
                <div class="no-matches">No automatic matches found</div>
            `;
        }
    } catch (error) {
        console.error('Error loading matches:', error);
        matchesContainer.innerHTML = `
            <div class="section-title">Existing Matches</div>
            <div class="error-message">Error loading matches</div>
        `;
    }
}

/**
 * Create match item HTML
 */
function createMatchItem(match) {
    return `
        <div class="match-item" data-match-id="${match.id}" onclick="selectMatch('${match.id}')">
            <div class="match-content">
                <div class="match-name">${escapeHtml(match.name || match.label || 'Unnamed')}</div>
                <div class="match-description">${escapeHtml(match.description || 'No description')}</div>
                <div class="match-id">${match.id}</div>
            </div>
            <div class="match-confidence">${match.score ? Math.round(match.score) + '%' : ''}</div>
        </div>
    `;
}

// Global functions for modal interactions
window.closeReconciliationModal = function() {
    // Implementation will be provided by the modal system
    console.log('Close modal');
};

window.confirmReconciliation = function() {
    // Implementation will be provided by the modal system
    console.log('Confirm reconciliation');
};

window.performWikidataSearch = async function() {
    const searchInput = document.getElementById('wikidata-search');
    const resultsContainer = document.getElementById('search-results');
    
    if (!searchInput || !resultsContainer) return;
    
    const query = searchInput.value.trim();
    if (!query) return;
    
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const matches = await tryDirectWikidataSearch(query);
        
        if (matches && matches.length > 0) {
            resultsContainer.innerHTML = `
                <div class="search-matches">
                    ${matches.slice(0, 5).map(match => createMatchItem(match)).join('')}
                </div>
            `;
        } else {
            resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div class="error">Search failed</div>';
    }
};

window.selectMatch = function(matchId) {
    // Remove previous selections
    document.querySelectorAll('.match-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Select current match
    const matchElement = document.querySelector(`[data-match-id="${matchId}"]`);
    if (matchElement) {
        matchElement.classList.add('selected');
        
        // Enable confirm button
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
        
        // Store selected match for confirmation
        window.selectedMatch = {
            id: matchId,
            name: matchElement.querySelector('.match-name')?.textContent,
            description: matchElement.querySelector('.match-description')?.textContent
        };
    }
};

window.useAsString = function() {
    // Convert the current reconciliation to string type
    console.log('Convert to string');
};

window.createNewWikidataItem = function() {
    const value = document.querySelector('.transformed-value')?.textContent;
    if (value) {
        const url = `https://www.wikidata.org/wiki/Special:NewItem?label=${encodeURIComponent(value)}`;
        window.open(url, '_blank');
    }
};

window.updateStringValue = function() {
    const editor = document.getElementById('string-editor');
    const currentValueDisplay = document.getElementById('current-value');
    const validationContainer = document.getElementById('editor-validation');
    
    if (!editor || !currentValueDisplay) return;
    
    const newValue = editor.value.trim();
    if (!newValue) return;
    
    // Update display
    currentValueDisplay.textContent = newValue;
    
    // Get constraints from current modal context
    const property = window.currentModalContext?.property || 'unknown';
    const propertyData = window.currentModalContext?.propertyData;
    const constraints = extractRegexConstraints(property, propertyData);
    const validationResult = validateStringValue(newValue, constraints);
    
    // Show enhanced validation result with suggestions
    if (validationContainer) {
        createValidationUI(validationContainer, newValue, constraints, (suggestedValue) => {
            editor.value = suggestedValue;
            window.updateStringValue(); // Re-validate with new value
        });
    }
    
    // Enable/disable confirm button based on validation
    const confirmBtn = document.getElementById('confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = !validationResult.isValid;
    }
    
    // Hide editor if value is now valid, but show success message
    if (validationResult.isValid) {
        const editorSection = editor.closest('.string-editor');
        if (editorSection) {
            // Add success indicator before hiding
            const successMessage = document.createElement('div');
            successMessage.className = 'validation-success';
            successMessage.innerHTML = `
                <span class="status-icon">✓</span>
                <span class="status-text">Value is now valid and ready to confirm</span>
                <button class="btn btn-link" onclick="showEditor()">Edit Again</button>
            `;
            editorSection.parentNode.insertBefore(successMessage, editorSection);
            editorSection.style.display = 'none';
        }
    }
    
    // Store updated value in modal context
    if (window.currentModalContext) {
        window.currentModalContext.currentValue = newValue;
    }
};

window.showEditor = function() {
    const editorSection = document.querySelector('.string-editor');
    const successMessage = document.querySelector('.validation-success');
    
    if (editorSection) {
        editorSection.style.display = 'block';
    }
    if (successMessage) {
        successMessage.remove();
    }
};