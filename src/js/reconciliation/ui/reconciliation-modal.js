/**
 * Reconciliation Modal Factory Interface
 * @module reconciliation/ui/reconciliation-modal
 * 
 * Main entry point for reconciliation modals that routes to appropriate
 * specialized modal implementations based on data type.
 * 
 * This module serves as a compatibility layer and main interface while
 * delegating actual modal creation to the modal factory system.
 */

import { createElement } from '../../ui/components.js';
import { 
    createReconciliationModalByType,
    initializeReconciliationModal,
    isModalTypeSupported,
    createFallbackModal
} from './modals/modal-factory.js';

/**
 * Create reconciliation modal using factory system
 * This is the main entry point that routes to appropriate specialized modals
 */
export function createReconciliationModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null) {
    console.log('🎯 createReconciliationModal called with:', { itemId, property, valueIndex, value, propertyData, existingMatches });
    
    // Determine data type from property
    const dataType = getDataTypeFromProperty(property, propertyData);
    console.log('📊 Determined dataType:', dataType);
    
    const transformedValue = getTransformedValue(value, property);
    console.log('🔄 Transformed value:', transformedValue);
    
    
    try {
        // Use factory to create type-specific modal
        if (isModalTypeSupported(dataType)) {
            const modalElement = createReconciliationModalByType(
                dataType, 
                itemId, 
                property, 
                valueIndex, 
                transformedValue, 
                propertyData, 
                existingMatches
            );
            
            // Add compatibility wrapper class
            modalElement.classList.add('reconciliation-modal-redesign');
            
            return modalElement;
        } else {
            // Use fallback modal for unsupported types
            console.warn(`Unsupported modal type: ${dataType}. Using fallback modal.`);
            const fallbackModal = createFallbackModal(dataType, transformedValue);
            fallbackModal.classList.add('reconciliation-modal-redesign');
            return fallbackModal;
        }
    } catch (error) {
        console.error('Error creating reconciliation modal:', error);
        
        // Create emergency fallback
        const errorModal = createElement('div', { className: 'reconciliation-modal-redesign error-modal' });
        errorModal.innerHTML = `
            <div class="modal-header">
                <div class="error-indicator">
                    <span class="error-label">Error:</span>
                    <span class="error-message">Failed to create modal</span>
                </div>
            </div>
            <div class="error-content">
                <p>Unable to create reconciliation interface for this data type.</p>
                <p><strong>Error:</strong> ${escapeHtml(error.message)}</p>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeReconciliationModal()">Close</button>
            </div>
        `;
        return errorModal;
    }
}

/**
 * Initialize modal from DOM element
 * Can be called after modal is inserted into DOM
 */
export function initializeReconciliationModalFromDOM() {
    const modalContainer = document.querySelector('.reconciliation-modal-redesign');
    if (modalContainer) {
        try {
            // Use factory initialization if available
            if (modalContainer.dataset.modalFactory === 'reconciliation') {
                initializeReconciliationModal(modalContainer);
            } else {
                // Fallback to legacy initialization
                console.warn('Using legacy modal initialization');
                const dataType = modalContainer.dataset.initDataType || modalContainer.dataset.dataType;
                const value = modalContainer.dataset.initValue || modalContainer.dataset.value;
                const property = modalContainer.dataset.initProperty || modalContainer.dataset.property;
                const propertyData = modalContainer.dataset.initPropertyData ? 
                    JSON.parse(modalContainer.dataset.initPropertyData) : 
                    (modalContainer.dataset.propertyData ? JSON.parse(modalContainer.dataset.propertyData) : null);
                
                if (dataType && value) {
                    initializeModalInteractions(dataType, value, property, propertyData);
                }
            }
        } catch (error) {
            console.error('Error initializing reconciliation modal:', error);
        }
    }
}

/**
 * Legacy modal interactions for backward compatibility
 * @deprecated Use modal factory system instead
 */
function initializeModalInteractions(dataType, value, property, propertyData) {
    // Get additional context from modal container if available
    const modalContainer = document.querySelector('.reconciliation-modal-redesign');
    let itemId = null;
    let valueIndex = null;
    
    if (modalContainer) {
        itemId = modalContainer.dataset.itemId;
        valueIndex = modalContainer.dataset.valueIndex;
    }
    
    // Set up comprehensive modal context for backward compatibility
    window.currentModalContext = {
        itemId: itemId,
        property: property,
        valueIndex: valueIndex ? parseInt(valueIndex) : 0,
        originalValue: value,
        currentValue: value,
        propertyData: propertyData,
        dataType: dataType,
        modalType: dataType // For compatibility
    };
    
    // Basic compatibility layer - most functionality now handled by specific modal types
    if (dataType === 'wikibase-item') {
        // For Wikidata items, also load matches if not already done
        const existingMatchesContainer = document.getElementById('existing-matches');
        if (existingMatchesContainer && existingMatchesContainer.innerHTML.includes('Finding matches...')) {
            loadExistingMatches(value);
        }
    }
}

/**
 * Legacy modal section functions have been moved to dedicated modal modules:
 * - createWikidataItemSection -> wikidata-item-modal.js
 * - createStringSection -> string-modal.js
 * 
 * These functions are now handled by the modal factory system.
 */

/**
 * Determine data type from property information
 */
function getDataTypeFromProperty(property, propertyData) {
    console.log('🔍 getDataTypeFromProperty called with:', { property, propertyData });
    
    // Check if we have explicit property data
    if (propertyData && propertyData.datatype) {
        console.log('✅ Found explicit datatype in propertyData:', propertyData.datatype);
        return propertyData.datatype;
    }
    
    console.log('⚠️ No explicit propertyData.datatype found, using pattern matching');
    
    // Common property patterns for auto-detection
    const itemPatterns = ['creator', 'author', 'publisher', 'place', 'person', 'organization'];
    const stringPatterns = ['title', 'description', 'note', 'text', 'label'];
    
    const lowerProperty = property.toLowerCase();
    console.log('🔍 Checking property patterns for:', lowerProperty);
    
    if (itemPatterns.some(pattern => lowerProperty.includes(pattern))) {
        console.log('✅ Property matched item patterns, returning wikibase-item');
        return 'wikibase-item';
    }
    
    if (stringPatterns.some(pattern => lowerProperty.includes(pattern))) {
        console.log('✅ Property matched string patterns, returning string');
        return 'string';
    }
    
    // Default to string for unknown properties
    console.log('⚠️ Property did not match any patterns, defaulting to string');
    console.log('💡 Property patterns checked:', { itemPatterns, stringPatterns });
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

/**
 * Emergency context reconstruction if context is missing
 */
function ensureModalContext() {
    if (!window.currentModalContext) {
        // Try to reconstruct context from modal DOM
        const modalContainer = document.querySelector('.reconciliation-modal-redesign') ||
                             document.querySelector('.wikidata-item-modal') ||
                             document.querySelector('[data-modal-type]');
        
        if (modalContainer && modalContainer.dataset) {
            const dataset = modalContainer.dataset;
            window.currentModalContext = {
                itemId: dataset.itemId,
                property: dataset.property,
                valueIndex: dataset.valueIndex ? parseInt(dataset.valueIndex) : 0,
                originalValue: dataset.value,
                currentValue: dataset.value,
                propertyData: dataset.propertyData ? JSON.parse(dataset.propertyData) : null,
                dataType: dataset.dataType || dataset.modalType || 'wikibase-item',
                modalType: dataset.modalType || dataset.dataType || 'wikibase-item'
            };
            return true;
        } else {
            return false;
        }
    }
    return true; // Context already exists
}

// Apply a match directly without needing confirmation
window.applyMatchDirectly = function(matchId) {
    // Ensure context is available
    if (!ensureModalContext()) {
        return;
    }
    
    // Get match details from DOM
    const escapedId = CSS.escape ? CSS.escape(matchId) : matchId.replace(/(["\\\n\r\t])/g, '\\$1');
    const matchElement = document.querySelector(`[data-match-id="${escapedId}"]`);
    
    if (!matchElement) {
        return;
    }
    
    // Try both class selectors for compatibility between existing matches and search results
    const matchLabelElement = matchElement.querySelector('.match-label') || matchElement.querySelector('.match-name');
    const matchDescriptionElement = matchElement.querySelector('.match-description');
    
    const matchLabel = matchLabelElement?.textContent || 'Unknown';
    const matchDescription = matchDescriptionElement?.textContent || 'No description';
    
    // Use the proper reconciliation handler
    if (typeof window.selectMatchAndAdvance === 'function') {
        window.selectMatchAndAdvance(matchId);
    } else if (typeof window.markCellAsReconciled === 'function' && window.currentModalContext) {
        window.markCellAsReconciled(window.currentModalContext, {
            type: 'wikidata',
            id: matchId,
            label: matchLabel,
            description: matchDescription
        });
        window.closeReconciliationModal();
    } else {
        // Fallback: store selection and confirm
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
        
        // Set up context immediately before any async operations
        const dataType = getDataTypeFromProperty(property, manualProp?.property);
        window.currentModalContext = {
            itemId: itemId,
            property: property,
            valueIndex: parseInt(valueIndex),
            originalValue: value,
            currentValue: value,
            propertyData: manualProp?.property || null,
            dataType: dataType,
            modalType: dataType,
            existingMatches: null
        };
        
        // Get existing matches from reconciliation data if available
        let existingMatches = null;
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliation?.data || {};
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property] && 
            reconciliationData[itemId].properties[property].reconciled[valueIndex]) {
            existingMatches = reconciliationData[itemId].properties[property].reconciled[valueIndex].matches;
            window.currentModalContext.existingMatches = existingMatches;
        }
        
        // Create modal content
        const modalElement = createReconciliationModal(itemId, property, valueIndex, value, manualProp?.property, existingMatches);
        
        // Open modal using the modal UI system
        modalUI.openModal('Reconcile Value', modalElement.innerHTML, [], () => {
            currentReconciliationCell = null;
            window.currentModalContext = null;
        });
        
        // Verify context is available immediately after modal opens
        setTimeout(() => {
            if (!window.currentModalContext) {
                // Emergency context restoration
                window.currentModalContext = {
                    itemId: itemId,
                    property: property,
                    valueIndex: parseInt(valueIndex),
                    originalValue: value,
                    currentValue: value,
                    propertyData: manualProp?.property || null,
                    dataType: dataType,
                    modalType: dataType,
                    existingMatches: existingMatches
                };
            }
        }, 10);
        
        // Preserve dataset attributes after modal is inserted into DOM
        setTimeout(() => {
            const insertedModalContainer = document.querySelector('.reconciliation-modal-redesign');
            if (insertedModalContainer && modalElement.dataset) {
                // Copy all dataset attributes from original element to inserted element
                Object.keys(modalElement.dataset).forEach(key => {
                    insertedModalContainer.dataset[key] = modalElement.dataset[key];
                });
            }
        }, 50); // Small delay to ensure modal is in DOM
        
        // Setup modal functionality after DOM is rendered
        setTimeout(() => {
            // Try multiple possible selectors for modal content
            const modalContent = document.querySelector('#modal-content') || 
                               document.querySelector('.modal-content') ||
                               document.querySelector('#modal-container .modal-content');
            
            if (modalContent) {
                setupDynamicDatePrecision(modalContent);
                setupAutoAdvanceToggle();
            }
            
            // Initialize modal using the factory system
            const modalContainer = document.querySelector('.reconciliation-modal-redesign') ||
                                 document.querySelector('.wikidata-item-modal') ||
                                 document.querySelector('[data-modal-type]');
            
            if (modalContainer) {
                try {
                    // Use the proper factory initialization
                    initializeReconciliationModal(modalContainer);
                } catch (error) {
                    // Fallback to deprecated system
                    const dataType = modalContainer.dataset.initDataType || 
                                   modalContainer.dataset.dataType || 
                                   window.currentModalContext?.dataType;
                    const value = modalContainer.dataset.initValue || 
                                modalContainer.dataset.value || 
                                window.currentModalContext?.originalValue;
                    const property = modalContainer.dataset.initProperty || 
                                   modalContainer.dataset.property || 
                                   window.currentModalContext?.property;
                    const propertyData = modalContainer.dataset.initPropertyData ? 
                        JSON.parse(modalContainer.dataset.initPropertyData) : 
                        (modalContainer.dataset.propertyData ? JSON.parse(modalContainer.dataset.propertyData) : 
                         window.currentModalContext?.propertyData);
                    
                    if (dataType && value) {
                        initializeModalInteractions(dataType, value, property, propertyData);
                    }
                }
            }
        }, 100);
        
        // Start automatic reconciliation for Wikidata items
        // Note: dataType already declared above, reusing it
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
            if (!window.currentModalContext) {
                return;
            }
            
            // Find the match details
            const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
            if (!matchCard) {
                return;
            }
            
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