/**
 * String Reconciliation Modal
 * @module reconciliation/ui/modals/string-modal
 * 
 * Specialized modal interface for string value validation and editing.
 * Handles constraint validation, real-time feedback, and suggested corrections.
 * 
 * Features:
 * - Constraint-based validation using Wikidata property patterns
 * - Real-time validation feedback as user types
 * - Suggested fixes for common format issues
 * - Interactive editing with constraint examples
 * - Format pattern display and explanation
 */

import { 
    extractRegexConstraints, 
    validateStringValue, 
    validateRealTime, 
    getSuggestedFixes,
    createValidationUI,
    setupLiveValidation
} from '../validation-engine.js';

/**
 * Create String reconciliation modal content
 * @param {string} itemId - Item ID being reconciled
 * @param {string} property - Property name being reconciled
 * @param {number} valueIndex - Index of value within property
 * @param {string} value - The value to reconcile
 * @param {Object} propertyData - Property metadata and constraints
 * @param {Array} existingMatches - Not used for string values
 * @returns {HTMLElement} Modal content element
 */
export function createStringModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null) {
    const regexConstraints = extractRegexConstraints(property, propertyData);
    const validationResult = validateStringValue(value, regexConstraints);
    
    const modalContent = document.createElement('div');
    modalContent.className = 'string-modal';
    
    // Store context for modal interactions
    modalContent.dataset.modalType = 'string';
    modalContent.dataset.itemId = itemId;
    modalContent.dataset.property = property;
    modalContent.dataset.valueIndex = valueIndex;
    modalContent.dataset.value = value;
    if (propertyData) {
        modalContent.dataset.propertyData = JSON.stringify(propertyData);
    }
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="data-type-indicator">
                <span class="data-type-label">Expected:</span>
                <span class="data-type-value">Text String</span>
            </div>
        </div>

        <div class="value-display">
            <div class="section-title">Omeka S Value</div>
            <div class="original-value">${escapeHtml(value)}</div>
        </div>

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

            <!-- String Editor (always available) -->
            <div class="string-editor">
                <div class="section-title">Edit Value</div>
                <textarea id="string-editor" class="string-input" placeholder="Edit the string value...">${escapeHtml(value)}</textarea>
                <div class="editor-validation" id="editor-validation"></div>
                <button class="btn btn-primary" onclick="updateStringValue()">Update Value</button>
            </div>

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

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeReconciliationModal()">Cancel</button>
            <button class="btn btn-primary" id="confirm-btn" onclick="confirmStringValue()" ${validationResult && !validationResult.isValid ? 'disabled' : ''}>Confirm</button>
        </div>
    `;

    return modalContent;
}

/**
 * Initialize String modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element
 */
export function initializeStringModal(modalElement) {
    const value = modalElement.dataset.value;
    const property = modalElement.dataset.property;
    const propertyData = modalElement.dataset.propertyData ? 
        JSON.parse(modalElement.dataset.propertyData) : null;
    
    // Store modal context globally for interaction handlers
    window.currentModalContext = {
        itemId: modalElement.dataset.itemId,
        property: property,
        valueIndex: parseInt(modalElement.dataset.valueIndex),
        originalValue: value,
        currentValue: value,
        propertyData: propertyData,
        dataType: 'string',
        modalType: 'string'
    };
    
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

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global interaction handlers for String modal
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
    
    // Update validation status display
    const validationStatus = document.querySelector('.validation-status');
    if (validationStatus) {
        validationStatus.className = `validation-status ${validationResult.isValid ? 'valid' : 'invalid'}`;
        validationStatus.innerHTML = `
            <span class="status-icon">${validationResult.isValid ? '✓' : '✗'}</span>
            <span class="status-text">${validationResult.message}</span>
        `;
    }
    
    // Store updated value in modal context
    if (window.currentModalContext) {
        window.currentModalContext.currentValue = newValue;
    }
};

window.confirmStringValue = function() {
    if (!window.currentModalContext) {
        console.error('No modal context available for string confirmation');
        return;
    }
    
    const currentValue = window.currentModalContext.currentValue || window.currentModalContext.originalValue;
    
    // Validate before confirming
    const property = window.currentModalContext.property;
    const propertyData = window.currentModalContext.propertyData;
    const constraints = extractRegexConstraints(property, propertyData);
    const validation = validateStringValue(currentValue, constraints);
    
    if (!validation.isValid) {
        console.warn('Attempting to confirm invalid string value:', currentValue);
        return;
    }
    
    console.log('Confirm string value:', currentValue);
    
    // Call appropriate confirmation handler
    if (typeof window.confirmCustomValue === 'function') {
        window.confirmCustomValue();
    } else if (typeof window.closeReconciliationModal === 'function') {
        window.closeReconciliationModal();
    }
};