/**
 * Simplified Reconciliation Modal Interface
 * @module reconciliation/ui/reconciliation-modal
 * 
 * Clean, focused reconciliation interface that handles:
 * - Wikidata Items: existing matches, reconciliation options, manual search
 * - Strings: transformation output, regex validation, inline editing
 */

import { createElement } from '../../ui/components.js';
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
export function createReconciliationModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null) {
    // Determine data type from property
    const dataType = getDataTypeFromProperty(property, propertyData);
    const transformedValue = getTransformedValue(value, property);
    
    // Check if transformation actually changed the value
    const wasTransformed = value !== transformedValue;
    
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
        existingMatches
    };
    
    const modalContent = createElement('div', { className: 'reconciliation-modal-redesign' });
    modalContent.innerHTML = `
        <!-- Header Section -->
        <div class="modal-header">
            <div class="data-type-indicator">
                <span class="data-type-label">Expected:</span>
                <span class="data-type-value">${getDataTypeDisplayName(dataType)}</span>
            </div>
        </div>

        <!-- Value Display Section -->
        <div class="transformation-result">
            ${wasTransformed ? 
                `<div class="section-title">Transformation Result</div>
                 <div class="transformed-value">${escapeHtml(transformedValue)}</div>
                 <div class="original-context">
                     <span class="original-label">Original:</span>
                     <span class="original-value">${escapeHtml(value)}</span>
                 </div>` 
                :
                `<div class="section-title">Omeka S API Value</div>
                 <div class="transformed-value">${escapeHtml(value)}</div>`
            }
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
    `;

    // Store initialization data on the element for later use
    modalContent.dataset.initDataType = dataType;
    modalContent.dataset.initValue = transformedValue;
    modalContent.dataset.initProperty = property;
    if (propertyData) {
        modalContent.dataset.initPropertyData = JSON.stringify(propertyData);
    }

    return modalContent;
}

/**
 * Initialize modal from stored data attributes
 * Can be called after modal is inserted into DOM
 */
export function initializeReconciliationModal() {
    const modalContainer = document.querySelector('.reconciliation-modal-redesign');
    if (modalContainer) {
        const dataType = modalContainer.dataset.initDataType;
        const value = modalContainer.dataset.initValue;
        const property = modalContainer.dataset.initProperty;
        const propertyData = modalContainer.dataset.initPropertyData ? 
            JSON.parse(modalContainer.dataset.initPropertyData) : null;
        
        if (dataType && value) {
            initializeModalInteractions(dataType, value, property, propertyData);
        }
    }
}

/**
 * Initialize modal interactions after DOM insertion
 */
function initializeModalInteractions(dataType, value, property, propertyData) {
    if (dataType === 'wikibase-item') {
        // Load existing matches for Wikidata items
        const existingMatches = window.currentModalContext?.existingMatches;
        loadExistingMatches(value, existingMatches);
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
 * Get transformed value with proper handling of both strings and Omeka S value objects
 */
function getTransformedValue(value, property) {
    // Handle string values
    if (typeof value === 'string') {
        return value.trim();
    }
    
    // Handle Omeka S value objects (like OCLC identifiers)
    if (value && typeof value === 'object') {
        // Extract string value from various Omeka S formats
        if (value['@value']) return String(value['@value']).trim();
        if (value['o:label']) return String(value['o:label']).trim();
        if (value['@id']) return String(value['@id']).trim();
        if (value.value) return String(value.value).trim();
        
        // For URI type objects
        if (value.type === 'uri' && value['@id']) {
            return String(value['@id']).trim();
        }
    }
    
    // Fallback: convert to string and trim
    return String(value).trim();
}

/**
 * Simple Wikidata search without artificial scoring or complex metadata
 */
async function searchWikidataItems(query) {
    try {
        const apiUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&type=item&limit=10`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Wikidata API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.search || data.search.length === 0) {
            return [];
        }
        
        // Return simple format: id, label, description
        return data.search.map(result => ({
            id: result.id,
            label: result.label || result.id,
            description: result.description || ''
        }));
        
    } catch (error) {
        console.error('Wikidata search failed:', error);
        return [];
    }
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
export async function loadExistingMatches(value, existingMatches = null) {
    const matchesContainer = document.getElementById('existing-matches');
    if (!matchesContainer) return;
    
    try {
        let matches = existingMatches;
        
        // If no existing matches provided, search for new ones
        if (!matches || matches.length === 0) {
            matches = await searchWikidataItems(value);
        }
        
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
            
            // Auto-select high-confidence matches (≥90%)
            const highConfidenceMatch = matches.find(match => match.score >= 90);
            if (highConfidenceMatch) {
                setTimeout(() => {
                    applyMatchDirectly(highConfidenceMatch.id);
                }, 100);
            }
            
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
    // Escape match.id for safe use in HTML attributes
    const safeMatchId = escapeHtml(match.id);
    // Escape match.id for safe use in JavaScript string literals
    const jsEscapedId = match.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    return `
        <div class="match-item" data-match-id="${safeMatchId}" onclick="applyMatchDirectly('${jsEscapedId}')">
            <div class="match-content">
                <div class="match-label">${escapeHtml(match.label || 'Unnamed')}</div>
                <div class="match-id">
                    <a href="https://www.wikidata.org/wiki/${safeMatchId}" target="_blank" onclick="event.stopPropagation()">${safeMatchId}</a>
                </div>
                <div class="match-description">${escapeHtml(match.description || 'No description')}</div>
            </div>
        </div>
    `;
}

// Global functions for modal interactions
window.closeReconciliationModal = function() {
    // Try multiple methods to close the modal
    if (typeof window.modalUI?.closeModal === 'function') {
        window.modalUI.closeModal();
    } else if (document.querySelector('.modal-overlay')) {
        // Fallback: remove modal elements directly
        document.querySelector('.modal-overlay')?.remove();
        document.querySelector('#modal-container')?.remove();
    } else {
        console.error('Unable to close modal - no modal UI system found');
    }
};

window.confirmReconciliation = function() {
    if (!window.currentModalContext) {
        console.error('No modal context available');
        return;
    }
    
    // Check if a match was selected
    if (window.selectedMatch && window.selectedMatch.id) {
        // Call the global selectMatchAndAdvance function that should be set up by the reconciliation system
        if (typeof window.selectMatchAndAdvance === 'function') {
            window.selectMatchAndAdvance(window.selectedMatch.id);
        } else {
            // Fallback: manually trigger the reconciliation logic
            console.log('Confirm selected match:', window.selectedMatch);
            // Try to find and call the modal close and reconciliation logic
            if (typeof window.closeModal === 'function') {
                window.closeModal();
            } else if (typeof window.closeReconciliationModal === 'function') {
                window.closeReconciliationModal();
            }
        }
    } else {
        // Use current value as custom value
        if (typeof window.confirmCustomValue === 'function') {
            window.confirmCustomValue();
        } else {
            console.log('Confirm custom value:', window.currentModalContext.currentValue || window.currentModalContext.transformedValue);
            // Try to find and call the modal close logic
            if (typeof window.closeModal === 'function') {
                window.closeModal();
            } else if (typeof window.closeReconciliationModal === 'function') {
                window.closeReconciliationModal();
            }
        }
    }
};

window.performWikidataSearch = async function() {
    const searchInput = document.getElementById('wikidata-search');
    const resultsContainer = document.getElementById('search-results');
    
    if (!searchInput || !resultsContainer) return;
    
    const query = searchInput.value.trim();
    if (!query) return;
    
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const matches = await searchWikidataItems(query);
        
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
    // Directly apply the match instead of just selecting it
    applyMatchDirectly(matchId);
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

window.showAllMatches = async function() {
    const value = document.querySelector('.transformed-value')?.textContent;
    if (!value) return;
    
    const matchesContainer = document.getElementById('existing-matches');
    if (!matchesContainer) return;
    
    try {
        let matches = window.currentModalContext?.existingMatches;
        
        // If no existing matches, search for new ones
        if (!matches || matches.length === 0) {
            matches = await searchWikidataItems(value);
        }
        
        if (matches && matches.length > 0) {
            matchesContainer.innerHTML = `
                <div class="section-title">All Matches</div>
                <div class="matches-list">
                    ${matches.map(match => createMatchItem(match)).join('')}
                </div>
                <button class="btn btn-link" onclick="showTopMatches()">Show fewer matches</button>
            `;
        }
    } catch (error) {
        console.error('Error showing all matches:', error);
    }
};

window.showTopMatches = function() {
    const value = document.querySelector('.transformed-value')?.textContent;
    if (value) {
        const existingMatches = window.currentModalContext?.existingMatches;
        loadExistingMatches(value, existingMatches);
    }
};

// New function to directly apply a match without needing confirmation
window.applyMatchDirectly = function(matchId) {
    // Get match details first
    const escapedId = CSS.escape ? CSS.escape(matchId) : matchId.replace(/(["\\\n\r\t])/g, '\\$1');
    const matchElement = document.querySelector(`[data-match-id="${escapedId}"]`);
    
    if (!matchElement) {
        console.error('Match element not found for ID:', matchId);
        return;
    }
    
    const matchLabel = matchElement.querySelector('.match-label')?.textContent || 'Unknown';
    const matchDescription = matchElement.querySelector('.match-description')?.textContent || 'No description';
    
    // Check if we have the proper handler functions available
    if (typeof window.selectMatchAndAdvance === 'function') {
        // Use the proper handler that applies reconciliation and closes modal
        window.selectMatchAndAdvance(matchId);
    } else if (typeof window.markCellAsReconciled === 'function' && window.currentModalContext) {
        // Direct reconciliation if we have the function and context
        window.markCellAsReconciled(window.currentModalContext, {
            type: 'wikidata',
            id: matchId,
            label: matchLabel,
            description: matchDescription
        });
        window.closeReconciliationModal();
    } else {
        // Last resort: store selection and try to confirm
        console.warn('No proper reconciliation handlers available, attempting fallback');
        window.selectedMatch = {
            id: matchId,
            name: matchLabel,
            label: matchLabel,
            description: matchDescription
        };
        window.confirmReconciliation();
    }
};

/**
 * Factory function for creating modal content (backward compatibility)
 * @param {Object} dependencies - Dependencies for the modal content factory
 * @returns {Function} Function that creates modal content
 */
export function createReconciliationModalContentFactory(dependencies) {
    const {
        reconciliationData,
        getPropertyDisplayInfo,
        getOriginalKeyInfo,
        getReconciliationRequirementReason,
        getConstraintSummary
    } = dependencies;
    
    return async function createReconciliationModalContent(itemId, property, valueIndex, value, manualProp = null) {
        // Extract property data from dependencies or manual prop
        let propertyData = null;
        if (manualProp) {
            propertyData = manualProp.property;
        } else if (itemId && reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            propertyData = propData.propertyMetadata || propData.manualPropertyData?.property;
        }
        
        // Use the main createReconciliationModal function
        const modalElement = createReconciliationModal(itemId, property, valueIndex, value, propertyData);
        
        // Return just the innerHTML content for compatibility
        return modalElement.innerHTML;
    };
}

/**
 * Factory function for opening reconciliation modal (backward compatibility)
 * @param {Object} dependencies - Dependencies for the modal opening factory
 * @returns {Function} Function that opens the modal
 */
export function createOpenReconciliationModalFactory(dependencies) {
    const {
        modalUI,
        performAutomaticReconciliation,
        setupDynamicDatePrecision,
        setupAutoAdvanceToggle,
        createReconciliationModalContent,
        state
    } = dependencies;

    let currentReconciliationCell = null;
    
    return async function openReconciliationModal(itemId, property, valueIndex, value, manualProp = null) {
        currentReconciliationCell = { itemId, property, valueIndex, value, manualProp };
        
        // Get existing matches from reconciliation data if available
        let existingMatches = null;
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliation?.data || {};
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property] && 
            reconciliationData[itemId].properties[property].reconciled[valueIndex]) {
            existingMatches = reconciliationData[itemId].properties[property].reconciled[valueIndex].matches;
        }
        
        // Create modal content using the new function
        const modalElement = createReconciliationModal(itemId, property, valueIndex, value, manualProp?.property, existingMatches);
        
        // Open modal using the modal UI system
        modalUI.openModal('Reconcile Value', modalElement.innerHTML, [], () => {
            currentReconciliationCell = null;
            window.currentModalContext = null;
        });
        
        // Setup modal functionality after DOM is rendered
        setTimeout(() => {
            const modalContent = document.querySelector('#modal-content');
            if (modalContent) {
                setupDynamicDatePrecision(modalContent);
                setupAutoAdvanceToggle();
                
                // Initialize modal interactions using stored data
                const modalContainer = document.querySelector('.reconciliation-modal-redesign');
                if (modalContainer) {
                    const dataType = modalContainer.dataset.initDataType;
                    const value = modalContainer.dataset.initValue;
                    const property = modalContainer.dataset.initProperty;
                    const propertyData = modalContainer.dataset.initPropertyData ? 
                        JSON.parse(modalContainer.dataset.initPropertyData) : null;
                    
                    if (dataType && value) {
                        initializeModalInteractions(dataType, value, property, propertyData);
                    }
                }
            }
        }, 100);
        
        // Start automatic reconciliation for Wikidata items
        const dataType = getDataTypeFromProperty(property, manualProp?.property);
        if (dataType === 'wikibase-item') {
            await performAutomaticReconciliation(value, property, itemId, valueIndex);
        }
    };
}

/**
 * Factory function for modal interaction handlers (backward compatibility)
 * @param {Object} dependencies - Dependencies for the interaction handlers
 * @returns {Object} Object with interaction handler functions
 */
export function createModalInteractionHandlers(dependencies) {
    const {
        currentReconciliationCell,
        modalUI,
        markCellAsReconciled,
        markCellAsSkipped,
        markCellAsNoItem,
        markCellAsString,
        getAutoAdvanceSetting,
        reconcileNextUnprocessedCell,
        setupExpandedSearch
    } = dependencies;

    return {
        selectMatchAndAdvance(matchId) {
            if (!window.currentModalContext) return;
            
            // Find the match details
            const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
            if (!matchCard) return;
            
            const matchName = matchCard.querySelector('.match-label, .result-name')?.textContent || 'Unknown';
            const matchDescription = matchCard.querySelector('.match-description, .result-description')?.textContent || 'No description';
            
            // Mark as reconciled
            markCellAsReconciled(window.currentModalContext, {
                type: 'wikidata',
                id: matchId,
                label: matchName,
                description: matchDescription
            });
            
            modalUI.closeModal();
            
            // Auto-advance if enabled
            if (getAutoAdvanceSetting()) {
                setTimeout(() => {
                    reconcileNextUnprocessedCell();
                }, 300);
            }
        },

        confirmCustomValue() {
            if (!window.currentModalContext) return;
            
            const currentValue = window.currentModalContext.currentValue || window.currentModalContext.transformedValue;
            
            markCellAsReconciled(window.currentModalContext, {
                type: 'custom',
                value: currentValue,
                datatype: window.currentModalContext.dataType
            });
            
            modalUI.closeModal();
            
            // Auto-advance if enabled
            if (getAutoAdvanceSetting()) {
                setTimeout(() => {
                    reconcileNextUnprocessedCell();
                }, 300);
            }
        },

        skipReconciliation() {
            if (window.currentModalContext) {
                markCellAsSkipped(window.currentModalContext);
                modalUI.closeModal();
                
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            }
        },

        markAsNoWikidataItem() {
            if (window.currentModalContext) {
                markCellAsNoItem(window.currentModalContext);
                modalUI.closeModal();
                
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            }
        },

        ignoreCurrentValue() {
            if (window.currentModalContext) {
                markCellAsSkipped(window.currentModalContext);
                modalUI.closeModal();
                
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            }
        },

        useCurrentValueAsString() {
            if (window.currentModalContext) {
                markCellAsString(window.currentModalContext);
                modalUI.closeModal();
                
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            }
        },

        createNewWikidataItem() {
            const value = window.currentModalContext?.transformedValue;
            if (value) {
                const url = `https://www.wikidata.org/wiki/Special:NewItem?label=${encodeURIComponent(value)}`;
                window.open(url, '_blank');
            }
        }
    };
}