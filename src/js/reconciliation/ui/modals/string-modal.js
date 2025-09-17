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
 * Get saved value for a specific item/property/valueIndex combination
 * @param {string} itemId - Item ID
 * @param {string} property - Property name
 * @param {number} valueIndex - Value index
 * @returns {Object|null} Saved confirmation data or null
 */
function getSavedValue(itemId, property, valueIndex) {
    try {
        const key = `reconciliation_${itemId}_${property}_${valueIndex}`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    } catch (error) {
        console.warn('Failed to retrieve saved value:', error);
        return null;
    }
}

/**
 * Save value for a specific item/property/valueIndex combination
 * @param {string} itemId - Item ID
 * @param {string} property - Property name
 * @param {number} valueIndex - Value index
 * @param {Object} confirmationData - Data to save
 */
function saveValue(itemId, property, valueIndex, confirmationData) {
    try {
        const key = `reconciliation_${itemId}_${property}_${valueIndex}`;
        localStorage.setItem(key, JSON.stringify({
            ...confirmationData,
            savedAt: new Date().toISOString()
        }));
        console.log('Value saved to localStorage:', key, confirmationData);
    } catch (error) {
        console.warn('Failed to save value:', error);
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
    
    // Check for previously saved value
    const savedData = getSavedValue(itemId, property, valueIndex);
    const displayValue = savedData ? savedData.value : value;
    const hasSavedValue = savedData !== null;
    
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
    modalContent.dataset.hasSavedValue = hasSavedValue.toString();
    if (propertyData) {
        modalContent.dataset.propertyData = JSON.stringify(propertyData);
    }
    if (savedData) {
        modalContent.dataset.savedData = JSON.stringify(savedData);
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
            <div class="original-value">${escapeHtml(value)}</div>
            ${hasSavedValue ? `
                <div class="saved-value-indicator">
                    <div class="section-title">Previously Saved Value</div>
                    <div class="saved-value">${escapeHtml(displayValue)}</div>
                </div>
            ` : ''}
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
                        <span class="original-label">${hasSavedValue ? 'Reset to saved:' : 'Original:'}</span>
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
    const hasSavedValue = modalElement.dataset.hasSavedValue === 'true';
    const propertyData = modalElement.dataset.propertyData ? 
        JSON.parse(modalElement.dataset.propertyData) : null;
    const savedData = modalElement.dataset.savedData ? 
        JSON.parse(modalElement.dataset.savedData) : null;
    
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
        hasBeenEdited: hasSavedValue, // If we have a saved value, consider it edited
        hasSavedValue: hasSavedValue,
        savedData: savedData,
        selectedLanguage: null
    };
    
    // Set up string editor with enhanced functionality
    const stringEditor = document.getElementById('string-editor');
    if (stringEditor) {
        setupStringEditor(stringEditor, property, propertyData);
    }
    
    // Set up language selection for monolingual text
    if (isMonolingual) {
        setupLanguageSelection();
        
        // Restore saved language if available
        if (savedData && savedData.language) {
            window.currentModalContext.selectedLanguage = {
                code: savedData.language,
                label: savedData.languageLabel || savedData.language
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
    
    // Set default language from storage or saved data
    const storedLanguage = getStoredLanguage();
    const savedLanguage = window.currentModalContext.selectedLanguage;
    const defaultLanguage = savedLanguage || storedLanguage;
    
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
    
    // Save the value to persistence layer (localStorage for now)
    saveValue(
        window.currentModalContext.itemId,
        window.currentModalContext.property,
        window.currentModalContext.valueIndex,
        confirmationData
    );
    
    // Try multiple approaches to save the value
    let saved = false;
    
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