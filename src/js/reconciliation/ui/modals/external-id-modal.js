/**
 * External-ID Reconciliation Modal
 * @module reconciliation/ui/modals/external-id-modal
 * 
 * Specialized modal interface for external identifier values with regex validation.
 * Provides real-time validation feedback, regex pattern display, and user override capability.
 * 
 * Features:
 * - Real-time keystroke validation with visual feedback
 * - Prominent regex pattern display with explanation
 * - User override capability for validation failures
 * - Property link generation to Wikidata properties
 * - Persistent value storage and retrieval
 */

import { 
    extractRegexConstraints, 
    validateStringValue, 
    validateRealTime, 
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
                datatype: 'external-id',
                description: 'Custom external identifier value'
            },
            matches: [],
            confidence: 100
        };
        
        // Update the state
        stateManager.updateState('reconciliationData', reconciliationData);
        
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
        
        // Update the value text
        valueTextSpan.textContent = confirmationData.value;
        
        // Update the status text and styling
        if (valueStatusSpan) {
            valueStatusSpan.textContent = '✓ External ID';
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
        
    } catch (error) {
        console.error('Failed to update source table cell:', error);
    }
}

/**
 * Create External-ID reconciliation modal content
 * @param {string} itemId - Item ID being reconciled
 * @param {string} property - Property name being reconciled
 * @param {number} valueIndex - Index of value within property
 * @param {string} value - The value to reconcile
 * @param {Object} propertyData - Property metadata and constraints
 * @param {Array} existingMatches - Not used for external-id values
 * @returns {HTMLElement} Modal content element
 */
export function createExternalIdModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null) {
    // Check for previously confirmed value
    const confirmedData = getConfirmedValue(itemId, property, valueIndex);
    const displayValue = confirmedData ? confirmedData.value : value;
    const hasConfirmedValue = confirmedData !== null;
    
    const regexConstraints = extractRegexConstraints(property, propertyData);
    const validationResult = validateStringValue(displayValue, regexConstraints);
    const propertyLink = generatePropertyLink(property, propertyData);
    
    const modalContent = document.createElement('div');
    modalContent.className = 'external-id-modal';
    
    // Store context for modal interactions
    modalContent.dataset.modalType = 'external-id';
    modalContent.dataset.itemId = itemId;
    modalContent.dataset.property = property;
    modalContent.dataset.valueIndex = valueIndex;
    modalContent.dataset.originalValue = value; // Always keep the original Omeka value
    modalContent.dataset.currentValue = displayValue; // Use saved value if available
    modalContent.dataset.hasConfirmedValue = hasConfirmedValue.toString();
    if (propertyData) {
        modalContent.dataset.propertyData = JSON.stringify(propertyData);
    }
    if (confirmedData) {
        modalContent.dataset.confirmedData = JSON.stringify(confirmedData);
    }
    
    modalContent.innerHTML = `
        <div class="data-type-indicator">
            <span class="data-type-label">Expecting:</span>
            <span class="data-type-value">External Identifier</span>
        </div>

        <div class="value-display">
            <div class="section-title">Omeka S Value</div>
            <div class="original-value" id="omeka-original-value">${escapeHtml(value)}</div>
            <div class="saved-value-indicator ${hasConfirmedValue ? '' : 'hidden'}" id="saved-value-indicator">
                <div class="section-title">Previously Confirmed Value</div>
                <div class="saved-value" id="saved-value-display">${escapeHtml(displayValue)}</div>
            </div>
        </div>

        <div class="external-id-section">
            <!-- External ID Editor -->
            <div class="external-id-editor">
                <div class="section-title">Edit External Identifier</div>
                <div class="input-container">
                    <input type="text" 
                           id="external-id-input" 
                           class="external-id-input ${validationResult?.isValid === false ? 'validation-error' : (validationResult?.isValid === true ? 'validation-success' : '')}" 
                           placeholder="Enter external identifier value..."
                           value="${escapeHtml(displayValue)}">
                    
                    <!-- Original Value Display (hidden initially) -->
                    <div class="original-value-hint hidden" id="original-value-hint">
                        <span class="original-label">${hasConfirmedValue ? 'Reset to confirmed:' : 'Original:'}</span>
                        <span class="original-text clickable" onclick="resetToOriginalValue()">${escapeHtml(displayValue)}</span>
                    </div>
                    
                    <!-- Validation Pattern Display -->
                    ${regexConstraints ? `
                        <div class="validation-pattern">
                            <div class="pattern-info">
                                <span class="pattern-label">Required format:</span>
                                ${propertyLink ? `<a href="${propertyLink}" target="_blank" class="property-link">ⓘ</a>` : ''}
                            </div>
                            <code class="pattern-code">${escapeHtml(regexConstraints.pattern)}</code>
                            ${regexConstraints.description ? `
                                <div class="pattern-description">${escapeHtml(regexConstraints.description)}</div>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="validation-pattern">
                            <div class="pattern-info">
                                <span class="pattern-label">No validation pattern available</span>
                                ${propertyLink ? `<a href="${propertyLink}" target="_blank" class="property-link">ⓘ View Property</a>` : ''}
                            </div>
                            <div class="pattern-description">This external identifier property has no format constraints defined.</div>
                        </div>
                    `}
                    
                    <!-- Real-time Validation Feedback -->
                    <div class="validation-feedback" id="validation-feedback"></div>
                </div>
            </div>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="cancelExternalIdModal()">Cancel</button>
            <button class="btn btn-outline" onclick="resetExternalIdModal()">Reset</button>
            <button class="btn btn-outline" onclick="skipReconciliation()">Skip</button>
            <button class="btn btn-primary" id="confirm-btn" onclick="confirmExternalIdValue()">Confirm</button>
        </div>
    `;

    return modalContent;
}

/**
 * Initialize External-ID modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element
 */
export function initializeExternalIdModal(modalElement) {
    const originalValue = modalElement.dataset.originalValue;
    const currentValue = modalElement.dataset.currentValue;
    const property = modalElement.dataset.property;
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
        dataType: 'external-id',
        modalType: 'external-id',
        hasBeenEdited: hasConfirmedValue, // If we have a confirmed value, consider it edited
        hasConfirmedValue: hasConfirmedValue,
        confirmedData: confirmedData,
        sourceCell: sourceCell // Reference to the original table cell
    };
    
    // Set up external-id input with enhanced functionality
    const externalIdInput = document.getElementById('external-id-input');
    if (externalIdInput) {
        setupExternalIdInput(externalIdInput, property, propertyData);
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
 * Set up external-id input with real-time validation
 * @param {HTMLElement} input - The input element
 * @param {string} property - Property name
 * @param {Object} propertyData - Property metadata
 */
function setupExternalIdInput(input, property, propertyData) {
    let isFirstEdit = true;
    
    // Set up input event for original value display and validation
    input.addEventListener('input', function() {
        const currentValue = input.value;
        
        // Show original value hint on first edit
        if (isFirstEdit && currentValue !== window.currentModalContext.originalValue) {
            showOriginalValueHint();
            window.currentModalContext.hasBeenEdited = true;
            isFirstEdit = false;
        }
        
        // Update current value in context
        window.currentModalContext.currentValue = currentValue;
        
        // Update validation in real-time
        updateValidationState();
    });
    
    // Set up blur event for final validation
    input.addEventListener('blur', function() {
        updateValidationState();
    });
    
    // Set up keypress event for immediate feedback
    input.addEventListener('keyup', function() {
        // Debounce validation for better performance
        clearTimeout(window.validationTimeout);
        window.validationTimeout = setTimeout(() => {
            updateValidationState();
        }, 200);
    });
}

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
    const input = document.getElementById('external-id-input');
    const currentValue = window.currentModalContext?.currentValue || '';
    const property = window.currentModalContext?.property;
    const propertyData = window.currentModalContext?.propertyData;
    const feedbackContainer = document.getElementById('validation-feedback');
    
    if (!input || !property) return;
    
    // Get validation result
    const constraints = extractRegexConstraints(property, propertyData);
    const validationResult = constraints ? validateRealTime(currentValue, constraints) : null;
    
    // Update input styling
    input.className = input.className.replace(/validation-(success|error|warning)/g, '');
    if (validationResult) {
        if (validationResult.isValid) {
            input.classList.add('validation-success');
        } else if (validationResult.level === 'warning') {
            input.classList.add('validation-warning');
        } else {
            input.classList.add('validation-error');
        }
    }
    
    // Update validation feedback
    if (feedbackContainer && validationResult && validationResult.message) {
        const icon = getValidationIcon(validationResult);
        feedbackContainer.innerHTML = `
            <div class="validation-message ${validationResult.level || (validationResult.isValid ? 'success' : 'error')}">
                <span class="validation-icon">${icon}</span>
                <span class="validation-text">${escapeHtml(validationResult.message)}</span>
            </div>
        `;
    } else if (feedbackContainer) {
        feedbackContainer.innerHTML = '';
    }
    
    // Update confirm button state
    updateConfirmButtonState();
}

/**
 * Get validation icon for feedback display
 * @param {Object} validationResult - Validation result object
 * @returns {string} Icon character
 */
function getValidationIcon(validationResult) {
    if (validationResult.isValid) return '✓';
    if (validationResult.level === 'warning') return '⚠';
    return '✗';
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
        savedValueDisplay.textContent = confirmationData.value;
        
        // Update the modal context to reflect the new confirmed state
        if (window.currentModalContext) {
            window.currentModalContext.hasConfirmedValue = true;
            window.currentModalContext.confirmedData = confirmationData;
            window.currentModalContext.hasBeenEdited = true;
        }
    }
}

/**
 * Update confirm button enabled/disabled state
 */
function updateConfirmButtonState() {
    const confirmBtn = document.getElementById('confirm-btn');
    const currentValue = window.currentModalContext?.currentValue || '';
    
    if (!confirmBtn) return;
    
    // Allow confirmation as long as there's a value (user can override validation)
    const canConfirm = currentValue.trim().length > 0;
    confirmBtn.disabled = !canConfirm;
}

// Global interaction handlers for External-ID modal
window.resetToOriginalValue = function() {
    const input = document.getElementById('external-id-input');
    const originalValueHint = document.getElementById('original-value-hint');
    
    if (!input || !window.currentModalContext) return;
    
    // Reset to original value
    input.value = window.currentModalContext.originalValue;
    window.currentModalContext.currentValue = window.currentModalContext.originalValue;
    window.currentModalContext.hasBeenEdited = false;
    
    // Hide original value hint
    if (originalValueHint) {
        originalValueHint.classList.add('hidden');
    }
    
    // Update validation
    updateValidationState();
};

window.cancelExternalIdModal = function() {
    if (typeof window.closeReconciliationModal === 'function') {
        window.closeReconciliationModal();
    }
};

window.resetExternalIdModal = function() {
    window.resetToOriginalValue();
};

window.confirmExternalIdValue = function() {
    if (!window.currentModalContext) {
        console.error('No modal context available for external-id confirmation');
        return;
    }
    
    // Get the actual current value from the input field (most reliable)
    const externalIdInput = document.getElementById('external-id-input');
    const currentValue = externalIdInput ? externalIdInput.value : (window.currentModalContext.currentValue || window.currentModalContext.originalValue);
    
    // Update context with the actual current value
    if (externalIdInput) {
        window.currentModalContext.currentValue = externalIdInput.value;
    }
    
    // Validate required fields
    if (!currentValue.trim()) {
        alert('Please enter an external identifier value before confirming.');
        return;
    }
    
    // Check validation but allow override
    const property = window.currentModalContext.property;
    const propertyData = window.currentModalContext.propertyData;
    const constraints = extractRegexConstraints(property, propertyData);
    
    if (constraints) {
        const validationResult = validateStringValue(currentValue, constraints);
        if (!validationResult.isValid) {
            const confirmOverride = confirm(
                `Warning: The value "${currentValue}" does not match the required format.\n\n` +
                `Expected pattern: ${constraints.pattern}\n\n` +
                `Do you want to use this value anyway?`
            );
            if (!confirmOverride) {
                return;
            }
        }
    }
    
    // Prepare confirmation data
    const confirmationData = {
        type: 'custom',
        value: currentValue.trim(),
        datatype: 'external-id'
    };
    
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
        const event = new CustomEvent('externalIdValueConfirmed', {
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