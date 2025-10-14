/**
 * URL Reconciliation Modal
 * @module reconciliation/ui/modals/url-modal
 *
 * Specialized modal interface for URL values with validation and testing.
 * Provides real-time validation feedback, URL pattern display, and test functionality.
 *
 * Features:
 * - Real-time URL validation with visual feedback
 * - Test URL button to open URL in new tab
 * - Prominent URL pattern display with explanation
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
 * @param {string} mappingId - Mapping ID
 * @param {number} valueIndex - Value index
 * @returns {Object|null} Confirmed value data or null
 */
function getConfirmedValue(itemId, mappingId, valueIndex) {
    try {
        const stateManager = window.debugState || window.currentState;
        if (!stateManager) {
            return null;
        }

        const state = stateManager.getState();
        const reconciliationData = state.reconciliationData || {};

        const itemData = reconciliationData[itemId];
        if (!itemData || !itemData.properties || !itemData.properties[mappingId]) {
            return null;
        }

        const propertyData = itemData.properties[mappingId];
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
        return null;
    }
}

/**
 * Save confirmed value to application state
 * @param {string} itemId - Item ID
 * @param {string} mappingId - Mapping ID
 * @param {number} valueIndex - Value index
 * @param {Object} confirmationData - Data to save
 */
function saveConfirmedValue(itemId, mappingId, valueIndex, confirmationData) {
    try {
        const stateManager = window.debugState || window.currentState;
        if (!stateManager) {
            return false;
        }

        const state = stateManager.getState();
        const reconciliationData = { ...state.reconciliationData } || {};

        // Ensure the structure exists
        if (!reconciliationData[itemId]) {
            reconciliationData[itemId] = { properties: {} };
        }
        if (!reconciliationData[itemId].properties[mappingId]) {
            reconciliationData[itemId].properties[mappingId] = { reconciled: [] };
        }
        if (!reconciliationData[itemId].properties[mappingId].reconciled[valueIndex]) {
            reconciliationData[itemId].properties[mappingId].reconciled[valueIndex] = {};
        }

        // Save the confirmed value with proper structure
        reconciliationData[itemId].properties[mappingId].reconciled[valueIndex] = {
            status: 'reconciled',
            selectedMatch: {
                type: 'custom',
                value: confirmationData.value,
                label: confirmationData.value,
                datatype: 'url',
                description: 'Custom URL value'
            },
            matches: [],
            confidence: 100
        };

        // Update the state
        stateManager.updateState('reconciliationData', reconciliationData);

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Find the source table cell that corresponds to this modal's data
 * @param {string} itemId - Item ID
 * @param {string} mappingId - Mapping ID
 * @param {number} valueIndex - Value index
 * @returns {HTMLElement|null} The source table cell element or null
 */
function findSourceTableCell(itemId, mappingId, valueIndex) {
    try {
        // Look for manual property cells (no value index)
        const manualSelector = `.property-cell[data-item-id="${itemId}"][data-mapping-id="${mappingId}"][data-is-manual="true"]`;
        const manualCell = document.querySelector(manualSelector);
        if (manualCell) {
            return manualCell;
        }

        // Look for regular property cells with value index
        const regularSelector = `.property-cell[data-item-id="${itemId}"][data-mapping-id="${mappingId}"][data-value-index="${valueIndex}"]`;
        const regularCell = document.querySelector(regularSelector);
        if (regularCell) {
            return regularCell;
        }

        // Fallback: look for any cell with matching item and mapping
        const fallbackSelector = `.property-cell[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
        const fallbackCell = document.querySelector(fallbackSelector);
        return fallbackCell;
    } catch (error) {
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
        return;
    }

    try {
        // Find the elements within the cell that need updating
        const valueTextSpan = sourceCell.querySelector('.value-text');
        const valueStatusSpan = sourceCell.querySelector('.value-status');
        const propertyValueDiv = sourceCell.querySelector('.property-value');

        if (!valueTextSpan) {
            return;
        }

        // Update the value text
        valueTextSpan.textContent = confirmationData.value;

        // Update the status text and styling
        if (valueStatusSpan) {
            valueStatusSpan.textContent = '✓ URL';
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
        // Silent fail
    }
}

/**
 * Create URL reconciliation modal content
 * @param {string} itemId - Item ID being reconciled
 * @param {string} property - Property name being reconciled
 * @param {number} valueIndex - Index of value within property
 * @param {string} value - The value to reconcile
 * @param {Object} propertyData - Property metadata and constraints
 * @param {Array} existingMatches - Not used for URL values
 * @returns {HTMLElement} Modal content element
 */
export function createUrlModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null) {
    const mappingId = window.currentModalContext?.mappingId || property;

    // Check for previously confirmed value
    const confirmedData = getConfirmedValue(itemId, mappingId, valueIndex);
    const displayValue = confirmedData ? confirmedData.value : value;
    const hasConfirmedValue = confirmedData !== null;

    const regexConstraints = extractRegexConstraints('url', propertyData);
    const validationResult = regexConstraints ? validateStringValue(displayValue, regexConstraints) : null;
    const propertyLink = generatePropertyLink(property, propertyData);

    const modalContent = document.createElement('div');
    modalContent.className = 'url-modal';

    // Store context for modal interactions
    modalContent.dataset.modalType = 'url';
    modalContent.dataset.itemId = itemId;
    modalContent.dataset.property = property;
    modalContent.dataset.valueIndex = valueIndex;
    modalContent.dataset.originalValue = value;
    modalContent.dataset.currentValue = displayValue;
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
            <span class="data-type-value">URL</span>
        </div>

        <div class="value-display">
            <div class="section-title">Omeka S Value</div>
            <div class="original-value" id="omeka-original-value">${escapeHtml(value)}</div>
            <div class="saved-value-indicator ${hasConfirmedValue ? '' : 'hidden'}" id="saved-value-indicator">
                <div class="section-title">Previously Confirmed Value</div>
                <div class="saved-value" id="saved-value-display">${escapeHtml(displayValue)}</div>
            </div>
        </div>

        <div class="url-section">
            <!-- URL Editor -->
            <div class="url-editor">
                <div class="section-title">Edit URL</div>
                <div class="input-container">
                    <input type="text"
                           id="url-input"
                           class="url-input ${regexConstraints && validationResult ? (validationResult.isValid === false ? 'validation-error' : (validationResult.isValid === true ? 'validation-success' : '')) : ''}"
                           placeholder="Enter URL (http:// or https://)..."
                           value="${escapeHtml(displayValue)}">

                    <!-- Original Value Display (hidden initially) -->
                    <div class="original-value-hint hidden" id="original-value-hint">
                        <span class="original-label">${hasConfirmedValue ? 'Reset to confirmed:' : 'Original:'}</span>
                        <span class="original-text clickable" onclick="resetToOriginalValue()">${escapeHtml(displayValue)}</span>
                    </div>

                    <!-- Test URL Button -->
                    <div class="url-test-section">
                        <button class="btn btn-outline" id="test-url-btn" onclick="testUrl()" disabled>
                            🔗 Test URL
                        </button>
                        <span class="url-test-hint">Opens URL in new tab</span>
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
                                <span class="pattern-label">Expected format: HTTP or HTTPS URL</span>
                                ${propertyLink ? `<a href="${propertyLink}" target="_blank" class="property-link">ⓘ View Property</a>` : ''}
                            </div>
                            <div class="pattern-description">URL should start with http:// or https://</div>
                        </div>
                    `}

                    <!-- Real-time Validation Feedback -->
                    <div class="validation-feedback" id="validation-feedback"></div>
                </div>
            </div>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="cancelUrlModal()">Cancel</button>
            <button class="btn btn-outline" onclick="resetUrlModal()">Reset</button>
            <button class="btn btn-outline" onclick="skipReconciliation()">Skip</button>
            <button class="btn btn-primary" id="confirm-btn" onclick="confirmUrlValue()">Confirm</button>
        </div>
    `;

    return modalContent;
}

/**
 * Initialize URL modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element
 */
export function initializeUrlModal(modalElement) {
    const originalValue = modalElement.dataset.originalValue;
    const currentValue = modalElement.dataset.currentValue;
    const property = modalElement.dataset.property;
    const hasConfirmedValue = modalElement.dataset.hasConfirmedValue === 'true';
    const propertyData = modalElement.dataset.propertyData ?
        JSON.parse(modalElement.dataset.propertyData) : null;
    const confirmedData = modalElement.dataset.confirmedData ?
        JSON.parse(modalElement.dataset.confirmedData) : null;

    const mappingId = window.currentModalContext?.mappingId || modalElement.dataset.mappingId || property;

    const sourceCell = findSourceTableCell(modalElement.dataset.itemId, mappingId, parseInt(modalElement.dataset.valueIndex));

    // Store modal context globally for interaction handlers
    window.currentModalContext = {
        itemId: modalElement.dataset.itemId,
        property: property,
        mappingId: mappingId, // NEW: Add mappingId to context
        valueIndex: parseInt(modalElement.dataset.valueIndex),
        originalValue: originalValue,
        currentValue: currentValue,
        propertyData: propertyData,
        dataType: 'url',
        modalType: 'url',
        hasBeenEdited: hasConfirmedValue,
        hasConfirmedValue: hasConfirmedValue,
        confirmedData: confirmedData,
        sourceCell: sourceCell
    };

    // Set up URL input with enhanced functionality
    const urlInput = document.getElementById('url-input');
    if (urlInput) {
        setupUrlInput(urlInput, property, propertyData);
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
 * Set up URL input with real-time validation
 * @param {HTMLElement} input - The input element
 * @param {string} property - Property name
 * @param {Object} propertyData - Property metadata
 */
function setupUrlInput(input, property, propertyData) {
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

        // Update validation
        updateValidationState();
    });

    // Set up keyup for additional feedback
    input.addEventListener('keyup', function() {
        const currentValue = input.value;
        window.currentModalContext.currentValue = currentValue;
        updateValidationState();
    });

    // Set up blur event for final validation
    input.addEventListener('blur', function() {
        updateValidationState();
    });

    // Set up paste event for validation after paste
    input.addEventListener('paste', function() {
        setTimeout(() => {
            const currentValue = input.value;
            window.currentModalContext.currentValue = currentValue;
            updateValidationState();
        }, 10);
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
    const input = document.getElementById('url-input');
    if (!input) {
        return;
    }

    const currentValue = input.value;
    const propertyData = window.currentModalContext?.propertyData;
    const feedbackContainer = document.getElementById('validation-feedback');
    const testUrlBtn = document.getElementById('test-url-btn');

    // Update context with current value from input
    if (window.currentModalContext) {
        window.currentModalContext.currentValue = currentValue;
    }

    // Get constraints
    const constraints = extractRegexConstraints('url', propertyData);

    // Clear all validation classes first
    input.classList.remove('validation-success', 'validation-error', 'validation-warning');

    // Validate if we have constraints or use basic URL validation
    let validationResult = null;
    if (constraints) {
        validationResult = validateRealTime(currentValue, constraints);
    } else {
        // Basic URL validation
        const urlPattern = /^https?:\/\/[^\s]+$/;
        const isValid = urlPattern.test(currentValue.trim());
        validationResult = {
            isValid: isValid,
            message: isValid ? 'Valid URL format' : 'URL must start with http:// or https://',
            level: isValid ? 'success' : 'error'
        };
    }

    // Apply validation styling
    if (validationResult) {
        if (validationResult.isValid === true) {
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
        const feedbackHTML = `
            <div class="validation-message ${validationResult.level || (validationResult.isValid ? 'success' : 'error')}">
                <span class="validation-icon">${icon}</span>
                <span class="validation-text">${escapeHtml(validationResult.message)}</span>
            </div>
        `;
        feedbackContainer.innerHTML = feedbackHTML;
    } else if (feedbackContainer) {
        feedbackContainer.innerHTML = '';
    }

    // Enable/disable test URL button based on validation
    if (testUrlBtn) {
        testUrlBtn.disabled = !validationResult?.isValid;
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
    const savedValueIndicator = document.getElementById('saved-value-indicator');
    const savedValueDisplay = document.getElementById('saved-value-display');

    if (savedValueIndicator && savedValueDisplay) {
        savedValueIndicator.classList.remove('hidden');
        savedValueDisplay.textContent = confirmationData.value;

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

// Global interaction handlers for URL modal
window.resetToOriginalValue = function() {
    const input = document.getElementById('url-input');
    const originalValueHint = document.getElementById('original-value-hint');

    if (!input || !window.currentModalContext) return;

    input.value = window.currentModalContext.originalValue;
    window.currentModalContext.currentValue = window.currentModalContext.originalValue;
    window.currentModalContext.hasBeenEdited = false;

    if (originalValueHint) {
        originalValueHint.classList.add('hidden');
    }

    updateValidationState();
};

window.cancelUrlModal = function() {
    if (typeof window.closeReconciliationModal === 'function') {
        window.closeReconciliationModal();
    }
};

window.resetUrlModal = function() {
    window.resetToOriginalValue();
};

window.testUrl = function() {
    if (!window.currentModalContext) return;

    const urlInput = document.getElementById('url-input');
    const currentValue = urlInput ? urlInput.value : window.currentModalContext.currentValue;

    if (!currentValue || !currentValue.trim()) {
        alert('Please enter a URL first.');
        return;
    }

    // Validate URL format
    const constraints = extractRegexConstraints('url', window.currentModalContext.propertyData);
    const urlPattern = /^https?:\/\/[^\s]+$/;
    const isValid = constraints ?
        validateStringValue(currentValue, constraints).isValid :
        urlPattern.test(currentValue.trim());

    if (!isValid) {
        const proceed = confirm(
            'The URL format appears to be invalid.\n\n' +
            `URL: ${currentValue}\n\n` +
            'Do you want to try opening it anyway?'
        );
        if (!proceed) return;
    }

    // Open URL in new tab
    try {
        window.open(currentValue.trim(), '_blank', 'noopener,noreferrer');
    } catch (error) {
        alert(`Failed to open URL: ${error.message}`);
    }
};

window.confirmUrlValue = function() {
    if (!window.currentModalContext) {
        return;
    }

    const urlInput = document.getElementById('url-input');
    const currentValue = urlInput ? urlInput.value : (window.currentModalContext.currentValue || window.currentModalContext.originalValue);

    // Update context with the actual current value
    if (urlInput) {
        window.currentModalContext.currentValue = urlInput.value;
    }

    // Validate required fields
    if (!currentValue.trim()) {
        alert('Please enter a URL before confirming.');
        return;
    }

    // Check validation but allow override
    const propertyData = window.currentModalContext.propertyData;
    const constraints = extractRegexConstraints('url', propertyData);
    const urlPattern = /^https?:\/\/[^\s]+$/;

    const validationResult = constraints ?
        validateStringValue(currentValue, constraints) :
        { isValid: urlPattern.test(currentValue.trim()) };

    if (!validationResult.isValid) {
        const confirmOverride = confirm(
            `Warning: The URL "${currentValue}" may not be in the correct format.\n\n` +
            `Expected: URL starting with http:// or https://\n\n` +
            `Do you want to use this value anyway?`
        );
        if (!confirmOverride) {
            return;
        }
    }

    // Prepare confirmation data
    const confirmationData = {
        type: 'custom',
        value: currentValue.trim(),
        datatype: 'url'
    };

    // Store confirmation data in context
    window.currentModalContext.confirmationData = confirmationData;

    // Save to application state
    const savedToState = saveConfirmedValue(
        window.currentModalContext.itemId,
        window.currentModalContext.mappingId,
        window.currentModalContext.valueIndex,
        confirmationData
    );

    // Try multiple approaches to save the value
    let saved = savedToState;

    if (typeof window.confirmCustomValue === 'function') {
        window.confirmCustomValue();
        saved = true;
    }
    else if (window.modalInteractionHandlers && typeof window.modalInteractionHandlers.confirmCustomValue === 'function') {
        window.modalInteractionHandlers.confirmCustomValue();
        saved = true;
    }
    else if (typeof window.markCellAsReconciled === 'function') {
        window.markCellAsReconciled(window.currentModalContext, confirmationData);
        saved = true;
        if (typeof window.closeReconciliationModal === 'function') {
            window.closeReconciliationModal();
        }
    }
    else {
        const event = new CustomEvent('urlValueConfirmed', {
            detail: {
                context: window.currentModalContext,
                confirmationData: confirmationData
            }
        });
        document.dispatchEvent(event);
        saved = true;

        if (typeof window.closeReconciliationModal === 'function') {
            window.closeReconciliationModal();
        }
    }

    if (saved) {
        updateValueDisplays(confirmationData);

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
    }
};
