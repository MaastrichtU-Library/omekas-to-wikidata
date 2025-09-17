/**
 * Enhanced String Reconciliation Modal
 * @module reconciliation/ui/modals/string-modal
 * 
 * Comprehensive modal interface for both regular strings and monolingual text values.
 * Supports advanced validation, language selection, and user-friendly editing.
 * 
 * Features:
 * - Dual support for 'string' and 'monolingualtext' data types
 * - Original value tracking with clickable reset functionality
 * - Wikidata language search and selection for monolingual text
 * - Visual validation feedback with green/red borders
 * - Regex pattern display with Wikidata property links
 * - Persistent language preference storage
 * - User override capability for validation failures
 */

import { 
    extractRegexConstraints, 
    validateStringValue, 
    validateRealTime, 
    getSuggestedFixes,
    createValidationUI,
    setupLiveValidation,
    searchWikidataLanguages,
    getStoredLanguage,
    setStoredLanguage,
    generatePropertyLink
} from '../validation-engine.js';

/**
 * Get confirmed value from application state
 * @param {string} itemId - Item ID
 * @param {string} property - Property name
 * @param {number} valueIndex - Value index
 * @returns {Object|null} Confirmed value data or null
 */
function getConfirmedValue(itemId, property, valueIndex) {
    try {
        // Try multiple ways to access the state system
        const stateManager = window.debugState || window.currentState;
        if (!stateManager) {
            console.warn('No state system available');
            return null;
        }
        
        const state = stateManager.getState();
        const reconciliationData = state.reconciliationData || {};
        
        const itemData = reconciliationData[itemId];
        if (!itemData || !itemData.properties || !itemData.properties[property]) {
            return null;
        }
        
        const propertyData = itemData.properties[property];
        if (!propertyData.reconciled || !propertyData.reconciled[valueIndex]) {
            return null;
        }
        
        const reconciledData = propertyData.reconciled[valueIndex];
        
        // Only return data if it's a confirmed custom value
        if (reconciledData.status === 'reconciled' && 
            reconciledData.selectedMatch && 
            reconciledData.selectedMatch.type === 'custom') {
            return reconciledData.selectedMatch;
        }
        
        return null;
    } catch (error) {
        console.warn('Failed to retrieve confirmed value from state:', error);
        return null;
    }
}

/**
 * Save confirmed value to application state
 * @param {string} itemId - Item ID
 * @param {string} property - Property name
 * @param {number} valueIndex - Value index
 * @param {Object} confirmationData - Data to save
 */
function saveConfirmedValue(itemId, property, valueIndex, confirmationData) {
    try {
        // Try multiple ways to access the state system
        const stateManager = window.debugState || window.currentState;
        if (!stateManager) {
            console.warn('No state system available');
            return false;
        }
        
        const state = stateManager.getState();
        const reconciliationData = { ...state.reconciliationData } || {};
        
        // Ensure the structure exists
        if (!reconciliationData[itemId]) {
            reconciliationData[itemId] = { properties: {} };
        }
        if (!reconciliationData[itemId].properties[property]) {
            reconciliationData[itemId].properties[property] = { reconciled: [] };
        }
        if (!reconciliationData[itemId].properties[property].reconciled[valueIndex]) {
            reconciliationData[itemId].properties[property].reconciled[valueIndex] = {};
        }
        
        // Save the confirmed value with proper structure
        reconciliationData[itemId].properties[property].reconciled[valueIndex] = {
            status: 'reconciled',
            selectedMatch: {
                type: 'custom',
                value: confirmationData.value,
                label: confirmationData.value,
                language: confirmationData.language || null,
                languageLabel: confirmationData.languageLabel || null,
                datatype: confirmationData.datatype || 'string',
                description: 'Custom user value'
            },
            matches: [],
            confidence: 100
        };
        
        // Update the state
        stateManager.updateState('reconciliationData', reconciliationData);
        
        console.log('Value saved to state:', itemId, property, valueIndex, confirmationData);
        return true;
    } catch (error) {
        console.warn('Failed to save confirmed value to state:', error);
        return false;
    }
}

/**
 * Find the source table cell that corresponds to this modal's data
 * @param {string} itemId - Item ID
 * @param {string} property - Property name  
 * @param {number} valueIndex - Value index
 * @returns {HTMLElement|null} The source table cell element or null
 */
function findSourceTableCell(itemId, property, valueIndex) {
    try {
        // Look for manual property cells (no value index)
        const manualSelector = `.property-cell[data-item-id="${itemId}"][data-property="${property}"][data-is-manual="true"]`;
        const manualCell = document.querySelector(manualSelector);
        if (manualCell) {
            return manualCell;
        }
        
        // Look for regular property cells with value index
        const regularSelector = `.property-cell[data-item-id="${itemId}"][data-property="${property}"][data-value-index="${valueIndex}"]`;
        const regularCell = document.querySelector(regularSelector);
        if (regularCell) {
            return regularCell;
        }
        
        // Fallback: look for any cell with matching item and property
        const fallbackSelector = `.property-cell[data-item-id="${itemId}"][data-property="${property}"]`;
        const fallbackCell = document.querySelector(fallbackSelector);
        return fallbackCell;
    } catch (error) {
        console.warn('Failed to find source table cell:', error, { itemId, property, valueIndex });
        return null;
    }
}


/**
 * Update the source table cell to reflect the confirmed value
 * @param {HTMLElement} sourceCell - The source table cell element
 * @param {Object} confirmationData - The confirmed value data
 */
function updateSourceTableCell(sourceCell, confirmationData) {
    if (!sourceCell) {
        console.warn('No source cell found to update');
        return;
    }
    
    try {
        // Find the elements within the cell that need updating
        const valueTextSpan = sourceCell.querySelector('.value-text');
        const valueStatusSpan = sourceCell.querySelector('.value-status');
        const propertyValueDiv = sourceCell.querySelector('.property-value');
        
        if (!valueTextSpan) {
            console.warn('Could not find .value-text span in source cell');
            return;
        }
        
        // Prepare the display text
        let displayText = confirmationData.value;
        if (confirmationData.language) {
            displayText += ` (${confirmationData.languageLabel || confirmationData.language})`;
        }
        
        // Update the value text
        valueTextSpan.textContent = displayText;
        
        // Update the status text and styling
        if (valueStatusSpan) {
            valueStatusSpan.textContent = '✓ Custom value';
            valueStatusSpan.classList.add('reconciled');
        }
        
        // Update the property value container
        if (propertyValueDiv) {
            propertyValueDiv.setAttribute('data-status', 'reconciled');
            propertyValueDiv.classList.add('reconciled');
            propertyValueDiv.classList.remove('pending');
        }
        
        // Remove any pending or error styling from the cell
        sourceCell.classList.remove('pending', 'error');
        sourceCell.classList.add('reconciled');
        
        console.log('Updated source table cell:', displayText);
        
    } catch (error) {
        console.error('Failed to update source table cell:', error);
    }
}


/**
 * Create enhanced String/Monolingual reconciliation modal content
 * @param {string} itemId - Item ID being reconciled
 * @param {string} property - Property name being reconciled
 * @param {number} valueIndex - Index of value within property
 * @param {string} value - The value to reconcile
 * @param {Object} propertyData - Property metadata and constraints
 * @param {Array} existingMatches - Not used for string values
 * @returns {HTMLElement} Modal content element
 */
export function createStringModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null) {
    const dataType = propertyData?.datatype || 'string';
    const isMonolingual = dataType === 'monolingualtext';
    
    // Check for previously confirmed value
    const confirmedData = getConfirmedValue(itemId, property, valueIndex);
    const displayValue = confirmedData ? confirmedData.value : value;
    const hasConfirmedValue = confirmedData !== null;
    
    const regexConstraints = extractRegexConstraints(property, propertyData);
    const validationResult = validateStringValue(displayValue, regexConstraints);
    const propertyLink = generatePropertyLink(property, propertyData);
    
    const modalContent = document.createElement('div');
    modalContent.className = isMonolingual ? 'monolingual-modal' : 'string-modal';
    
    // Store context for modal interactions
    modalContent.dataset.modalType = dataType;
    modalContent.dataset.itemId = itemId;
    modalContent.dataset.property = property;
    modalContent.dataset.valueIndex = valueIndex;
    modalContent.dataset.originalValue = value; // Always keep the original Omeka value
    modalContent.dataset.currentValue = displayValue; // Use saved value if available
    modalContent.dataset.isMonolingual = isMonolingual.toString();
    modalContent.dataset.hasConfirmedValue = hasConfirmedValue.toString();
    if (propertyData) {
        modalContent.dataset.propertyData = JSON.stringify(propertyData);
    }
    if (confirmedData) {
        modalContent.dataset.confirmedData = JSON.stringify(confirmedData);
    }
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="data-type-indicator">
                <span class="data-type-label">Expected:</span>
                <span class="data-type-value">${isMonolingual ? 'Monolingual Text' : 'Text String'}</span>
            </div>
        </div>

        <div class="value-display">
            <div class="section-title">Omeka S Value</div>
            <div class="original-value" id="omeka-original-value">${escapeHtml(value)}</div>
            <div class="saved-value-indicator ${hasConfirmedValue ? '' : 'hidden'}" id="saved-value-indicator">
                <div class="section-title">Previously Confirmed Value</div>
                <div class="saved-value" id="saved-value-display">${escapeHtml(displayValue)}</div>
            </div>
        </div>

        <div class="string-section">
            <!-- String Editor -->
            <div class="string-editor">
                <div class="section-title">Edit Value</div>
                <div class="input-container">
                    <textarea id="string-editor" 
                             class="string-input ${validationResult?.isValid === false ? 'validation-error' : (validationResult?.isValid === true ? 'validation-success' : '')}" 
                             placeholder="${isMonolingual ? 'Enter text in selected language...' : 'Edit the string value...'}">${escapeHtml(displayValue)}</textarea>
                    
                    <!-- Original Value Display (hidden initially) -->
                    <div class="original-value-hint hidden" id="original-value-hint">
                        <span class="original-label">${hasConfirmedValue ? 'Reset to confirmed:' : 'Original:'}</span>
                        <span class="original-text clickable" onclick="resetToOriginalValue()">${escapeHtml(displayValue)}</span>
                    </div>
                    
                    <!-- Validation Pattern Display -->
                    ${regexConstraints ? `
                        <div class="validation-pattern">
                            <span class="pattern-text">Must match pattern: </span>
                            <code class="pattern-code">${escapeHtml(regexConstraints.pattern)}</code>
                            ${propertyLink ? `<a href="${propertyLink}" target="_blank" class="property-link">ⓘ</a>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Language Selection (monolingual only) -->
            ${isMonolingual ? `
                <div class="language-selection">
                    <div class="section-title">Language <span class="required">*</span></div>
                    <div class="language-container">
                        <input type="text" 
                               id="language-search" 
                               class="language-input" 
                               placeholder="Search for language..." 
                               autocomplete="off">
                        <div class="language-dropdown hidden" id="language-dropdown"></div>
                        <input type="hidden" id="selected-language-code" value="">
                    </div>
                </div>
            ` : ''}
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="cancelStringModal()">Cancel</button>
            <button class="btn btn-outline" onclick="resetStringModal()">Reset</button>
            <button class="btn btn-primary" id="confirm-btn" onclick="confirmStringValue()">Confirm</button>
        </div>
    `;

    return modalContent;
}

/**
 * Initialize enhanced String/Monolingual modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element
 */
export function initializeStringModal(modalElement) {
    const originalValue = modalElement.dataset.originalValue;
    const currentValue = modalElement.dataset.currentValue;
    const property = modalElement.dataset.property;
    const isMonolingual = modalElement.dataset.isMonolingual === 'true';
    const hasConfirmedValue = modalElement.dataset.hasConfirmedValue === 'true';
    const propertyData = modalElement.dataset.propertyData ? 
        JSON.parse(modalElement.dataset.propertyData) : null;
    const confirmedData = modalElement.dataset.confirmedData ? 
        JSON.parse(modalElement.dataset.confirmedData) : null;
    
    // Find the source table cell that opened this modal
    const sourceCell = findSourceTableCell(modalElement.dataset.itemId, property, parseInt(modalElement.dataset.valueIndex));
    
    // Store modal context globally for interaction handlers
    window.currentModalContext = {
        itemId: modalElement.dataset.itemId,
        property: property,
        valueIndex: parseInt(modalElement.dataset.valueIndex),
        originalValue: originalValue,
        currentValue: currentValue,
        propertyData: propertyData,
        dataType: modalElement.dataset.modalType,
        modalType: modalElement.dataset.modalType,
        isMonolingual: isMonolingual,
        hasBeenEdited: hasConfirmedValue, // If we have a confirmed value, consider it edited
        hasConfirmedValue: hasConfirmedValue,
        confirmedData: confirmedData,
        selectedLanguage: null,
        sourceCell: sourceCell // Reference to the original table cell
    };
    
    // Set up string editor with enhanced functionality
    const stringEditor = document.getElementById('string-editor');
    if (stringEditor) {
        setupStringEditor(stringEditor, property, propertyData);
    }
    
    // Set up language selection for monolingual text
    if (isMonolingual) {
        setupLanguageSelection();
        
        // Restore confirmed language if available
        if (confirmedData && confirmedData.language) {
            window.currentModalContext.selectedLanguage = {
                code: confirmedData.language,
                label: confirmedData.languageLabel || confirmedData.language
            };
        }
    }
    
    // Initial validation and UI state
    updateValidationState();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Set up string editor with enhanced functionality
 * @param {HTMLElement} editor - The text editor element
 * @param {string} property - Property name
 * @param {Object} propertyData - Property metadata
 */
function setupStringEditor(editor, property, propertyData) {
    let isFirstEdit = true;
    
    // Set up input event for original value display and validation
    editor.addEventListener('input', function() {
        const currentValue = editor.value;
        
        // Show original value hint on first edit
        if (isFirstEdit && currentValue !== window.currentModalContext.originalValue) {
            showOriginalValueHint();
            window.currentModalContext.hasBeenEdited = true;
            isFirstEdit = false;
        }
        
        // Update current value in context
        window.currentModalContext.currentValue = currentValue;
        
        // Update validation
        updateValidationState();
    });
    
    // Set up blur event for final validation
    editor.addEventListener('blur', function() {
        updateValidationState();
    });
}

/**
 * Set up language selection functionality for monolingual text
 */
function setupLanguageSelection() {
    const languageSearch = document.getElementById('language-search');
    const languageDropdown = document.getElementById('language-dropdown');
    const selectedLanguageCode = document.getElementById('selected-language-code');
    
    if (!languageSearch || !languageDropdown) return;
    
    // Set default language from storage or confirmed data
    const storedLanguage = getStoredLanguage();
    const confirmedLanguage = window.currentModalContext.selectedLanguage;
    const defaultLanguage = confirmedLanguage || storedLanguage;
    
    if (defaultLanguage) {
        languageSearch.value = defaultLanguage.label;
        selectedLanguageCode.value = defaultLanguage.code;
        window.currentModalContext.selectedLanguage = defaultLanguage;
    }
    
    let searchTimeout;
    
    // Search languages as user types
    languageSearch.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            languageDropdown.classList.add('hidden');
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const languages = await searchWikidataLanguages(query);
                displayLanguageResults(languages);
            } catch (error) {
                console.error('Language search failed:', error);
            }
        }, 300);
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.language-container')) {
            languageDropdown.classList.add('hidden');
        }
    });
}

/**
 * Display language search results
 * @param {Array} languages - Array of language objects
 */
function displayLanguageResults(languages) {
    const languageDropdown = document.getElementById('language-dropdown');
    
    if (languages.length === 0) {
        languageDropdown.innerHTML = '<div class="no-results">No languages found</div>';
    } else {
        languageDropdown.innerHTML = languages.map(lang => `
            <div class="language-option" onclick="selectLanguage('${escapeHtml(lang.code)}', '${escapeHtml(lang.label)}')">
                <span class="language-label">${escapeHtml(lang.label)}</span>
                <span class="language-code">${escapeHtml(lang.code)}</span>
            </div>
        `).join('');
    }
    
    languageDropdown.classList.remove('hidden');
}

/**
 * Select a language from the dropdown
 * @param {string} code - Language code
 * @param {string} label - Language label
 */
window.selectLanguage = function(code, label) {
    const languageSearch = document.getElementById('language-search');
    const selectedLanguageCode = document.getElementById('selected-language-code');
    const languageDropdown = document.getElementById('language-dropdown');
    
    if (languageSearch && selectedLanguageCode) {
        languageSearch.value = label;
        selectedLanguageCode.value = code;
        
        const selectedLanguage = { code, label };
        window.currentModalContext.selectedLanguage = selectedLanguage;
        setStoredLanguage(selectedLanguage);
        
        languageDropdown.classList.add('hidden');
        
        // Update confirmation button state
        updateConfirmButtonState();
    }
};

/**
 * Show the original value hint below the input
 */
function showOriginalValueHint() {
    const originalValueHint = document.getElementById('original-value-hint');
    if (originalValueHint) {
        originalValueHint.classList.remove('hidden');
    }
}

/**
 * Update validation state and visual feedback
 */
function updateValidationState() {
    const editor = document.getElementById('string-editor');
    const currentValue = window.currentModalContext?.currentValue || '';
    const property = window.currentModalContext?.property;
    const propertyData = window.currentModalContext?.propertyData;
    
    if (!editor || !property) return;
    
    // Get validation result
    const constraints = extractRegexConstraints(property, propertyData);
    const validationResult = validateStringValue(currentValue, constraints);
    
    // Update input styling
    editor.className = editor.className.replace(/validation-(success|error)/g, '');
    if (validationResult) {
        if (validationResult.isValid) {
            editor.classList.add('validation-success');
        } else {
            editor.classList.add('validation-error');
        }
    }
    
    // Update confirm button state
    updateConfirmButtonState();
}

/**
 * Update the value displays to show the newly confirmed value
 * @param {Object} confirmationData - The confirmed value data
 */
function updateValueDisplays(confirmationData) {
    // Update the saved value indicator
    const savedValueIndicator = document.getElementById('saved-value-indicator');
    const savedValueDisplay = document.getElementById('saved-value-display');
    
    if (savedValueIndicator && savedValueDisplay) {
        // Show the saved value indicator if it was hidden
        savedValueIndicator.classList.remove('hidden');
        
        // Update the saved value text
        let displayText = confirmationData.value;
        if (confirmationData.language) {
            displayText += ` (${confirmationData.languageLabel || confirmationData.language})`;
        }
        
        savedValueDisplay.textContent = displayText;
        
        // Update the modal context to reflect the new confirmed state
        if (window.currentModalContext) {
            window.currentModalContext.hasConfirmedValue = true;
            window.currentModalContext.confirmedData = confirmationData;
            window.currentModalContext.hasBeenEdited = true;
        }
        
        console.log('Updated value displays with:', displayText);
    }
}

/**
 * Update confirm button enabled/disabled state
 */
function updateConfirmButtonState() {
    const confirmBtn = document.getElementById('confirm-btn');
    const currentValue = window.currentModalContext?.currentValue || '';
    const isMonolingual = window.currentModalContext?.isMonolingual;
    const selectedLanguage = window.currentModalContext?.selectedLanguage;
    
    if (!confirmBtn) return;
    
    let canConfirm = true;
    
    // Check if value is not empty
    if (!currentValue.trim()) {
        canConfirm = false;
    }
    
    // For monolingual text, require language selection
    if (isMonolingual && !selectedLanguage) {
        canConfirm = false;
    }
    
    // Note: Allow confirmation even with regex validation failures (user override)
    confirmBtn.disabled = !canConfirm;
}

// Global interaction handlers for enhanced String modal
window.resetToOriginalValue = function() {
    const editor = document.getElementById('string-editor');
    const originalValueHint = document.getElementById('original-value-hint');
    
    if (!editor || !window.currentModalContext) return;
    
    // Reset to original value
    editor.value = window.currentModalContext.originalValue;
    window.currentModalContext.currentValue = window.currentModalContext.originalValue;
    window.currentModalContext.hasBeenEdited = false;
    
    // Hide original value hint
    if (originalValueHint) {
        originalValueHint.classList.add('hidden');
    }
    
    // Update validation
    updateValidationState();
};

window.cancelStringModal = function() {
    if (typeof window.closeReconciliationModal === 'function') {
        window.closeReconciliationModal();
    }
};

window.resetStringModal = function() {
    window.resetToOriginalValue();
};

window.confirmStringValue = function() {
    if (!window.currentModalContext) {
        console.error('No modal context available for string confirmation');
        return;
    }
    
    // Get the actual current value from the input field (most reliable)
    const stringEditor = document.getElementById('string-editor');
    const currentValue = stringEditor ? stringEditor.value : (window.currentModalContext.currentValue || window.currentModalContext.originalValue);
    
    // Update context with the actual current value
    if (stringEditor) {
        window.currentModalContext.currentValue = stringEditor.value;
    }
    
    const isMonolingual = window.currentModalContext.isMonolingual;
    
    // Get the actual selected language from DOM elements (most reliable)
    let selectedLanguage = window.currentModalContext.selectedLanguage;
    if (isMonolingual) {
        const languageSearch = document.getElementById('language-search');
        const selectedLanguageCode = document.getElementById('selected-language-code');
        
        if (languageSearch && selectedLanguageCode && selectedLanguageCode.value) {
            selectedLanguage = {
                code: selectedLanguageCode.value,
                label: languageSearch.value
            };
            // Update context with actual values
            window.currentModalContext.selectedLanguage = selectedLanguage;
        }
    }
    
    // Validate required fields
    if (!currentValue.trim()) {
        alert('Please enter a value before confirming.');
        return;
    }
    
    if (isMonolingual && !selectedLanguage) {
        alert('Please select a language for monolingual text.');
        return;
    }
    
    // Prepare confirmation data
    let confirmationData = {
        type: 'custom',
        value: currentValue.trim(),
        datatype: window.currentModalContext.dataType
    };
    
    // Add language for monolingual text
    if (isMonolingual && selectedLanguage) {
        confirmationData.language = selectedLanguage.code;
        confirmationData.languageLabel = selectedLanguage.label;
    }
    
    console.log('Confirm string/monolingual value:', confirmationData);
    console.log('Original value was:', window.currentModalContext.originalValue);
    console.log('Current input field value:', currentValue);
    
    // Store confirmation data in context for handlers
    window.currentModalContext.confirmationData = confirmationData;
    
    // Save to application state system first
    const savedToState = saveConfirmedValue(
        window.currentModalContext.itemId,
        window.currentModalContext.property,
        window.currentModalContext.valueIndex,
        confirmationData
    );
    
    // Try multiple approaches to save the value
    let saved = savedToState; // Start with state save result
    
    // First, try the proper modal interaction handler
    if (typeof window.confirmCustomValue === 'function') {
        window.confirmCustomValue();
        saved = true;
    } 
    // Try the factory-based interaction handlers
    else if (window.modalInteractionHandlers && typeof window.modalInteractionHandlers.confirmCustomValue === 'function') {
        window.modalInteractionHandlers.confirmCustomValue();
        saved = true;
    }
    // Try direct reconciliation marking
    else if (typeof window.markCellAsReconciled === 'function') {
        window.markCellAsReconciled(window.currentModalContext, confirmationData);
        saved = true;
        if (typeof window.closeReconciliationModal === 'function') {
            window.closeReconciliationModal();
        }
    }
    // Fallback: dispatch a custom event that other parts of the system can listen to
    else {
        const event = new CustomEvent('stringValueConfirmed', {
            detail: {
                context: window.currentModalContext,
                confirmationData: confirmationData
            }
        });
        document.dispatchEvent(event);
        saved = true;
        
        // Close modal if possible
        if (typeof window.closeReconciliationModal === 'function') {
            window.closeReconciliationModal();
        }
    }
    
    if (saved) {
        // Update the displayed values immediately
        updateValueDisplays(confirmationData);
        
        // Update the source table cell if available
        if (window.currentModalContext && window.currentModalContext.sourceCell) {
            updateSourceTableCell(window.currentModalContext.sourceCell, confirmationData);
        }
        
        // Show success feedback
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            const originalText = confirmBtn.textContent;
            confirmBtn.textContent = 'Saved!';
            confirmBtn.style.background = '#28a745';
            setTimeout(() => {
                confirmBtn.textContent = originalText;
                confirmBtn.style.background = '';
            }, 1000);
        }
    } else {
        console.warn('No save handler found - value may not be persisted');
    }
};

