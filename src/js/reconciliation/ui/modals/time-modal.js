/**
 * Point-in-Time Reconciliation Modal
 * @module reconciliation/ui/modals/time-modal
 * 
 * Specialized modal interface for date/time value reconciliation.
 * Supports automatic precision detection and various date formats.
 * 
 * Features:
 * - Flexible date input supporting multiple formats
 * - Automatic precision detection (year, month, day, decade)
 * - Manual precision override capability
 * - Original value tracking with clickable reset functionality
 * - Real-time validation with visual feedback
 * - Standardized date formatting for Wikidata
 * - Persistent confirmed value storage
 */

import {
    detectDatePrecision,
    standardizeDateInput,
    setupDynamicDatePrecision
} from '../../../utils/property-types.js';

/**
 * Get confirmed value from application state
 * @param {string} itemId - Item ID
 * @param {string} property - Property name
 * @param {number} valueIndex - Value index
 * @returns {Object|null} Confirmed value data or null
 */
function getConfirmedValue(itemId, property, valueIndex) {
    try {
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
                label: confirmationData.displayValue || confirmationData.value,
                standardizedDate: confirmationData.standardizedDate,
                precision: confirmationData.precision,
                datatype: 'time',
                description: `Custom time value (${confirmationData.precision} precision)`
            },
            matches: [],
            confidence: 100
        };
        
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
        const valueTextSpan = sourceCell.querySelector('.value-text');
        const valueStatusSpan = sourceCell.querySelector('.value-status');
        const propertyValueDiv = sourceCell.querySelector('.property-value');
        
        if (!valueTextSpan) {
            console.warn('Could not find .value-text span in source cell');
            return;
        }
        
        // Prepare the display text with precision indicator
        const displayText = `${confirmationData.displayValue || confirmationData.value} (${confirmationData.precision})`;
        
        // Update the value text
        valueTextSpan.textContent = displayText;
        
        // Update the status text and styling
        if (valueStatusSpan) {
            valueStatusSpan.textContent = '✓ Custom date';
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
 * Create Point-in-Time reconciliation modal content
 * @param {string} itemId - Item ID being reconciled
 * @param {string} property - Property name being reconciled
 * @param {number} valueIndex - Index of value within property
 * @param {string} value - The value to reconcile
 * @param {Object} propertyData - Property metadata and constraints
 * @param {Array} existingMatches - Not used for time values
 * @returns {HTMLElement} Modal content element
 */
export function createTimeModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null) {
    // Check for previously confirmed value
    const confirmedData = getConfirmedValue(itemId, property, valueIndex);
    const displayValue = confirmedData ? confirmedData.value : value;
    const hasConfirmedValue = confirmedData !== null;
    
    // Detect precision and standardize the current value
    const detectedPrecision = detectDatePrecision(displayValue);
    const standardizedResult = standardizeDateInput(displayValue);
    
    const modalContent = document.createElement('div');
    modalContent.className = 'time-modal';
    
    // Store context for modal interactions
    modalContent.dataset.modalType = 'time';
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
            <span class="data-type-value">Point in Time (Date)</span>
        </div>

        <div class="value-display">
            <div class="section-title">Omeka S Value</div>
            <div class="original-value" id="omeka-original-value">${escapeHtml(value)}</div>
            <div class="saved-value-indicator ${hasConfirmedValue ? '' : 'hidden'}" id="saved-value-indicator">
                <div class="section-title">Previously Confirmed Value</div>
                <div class="saved-value" id="saved-value-display">${escapeHtml(displayValue)}</div>
            </div>
        </div>

        <div class="time-section">
            <!-- Date Input -->
            <div class="date-editor">
                <div class="section-title">Edit Date Value</div>
                <div class="input-container">
                    <input type="text" 
                           id="date-editor" 
                           class="date-input flexible-date-input" 
                           placeholder="Enter date (e.g., 2023, 2023-06, 2023-06-15, 1990s)"
                           value="${escapeHtml(displayValue)}"
                           data-auto-precision="true">
                    
                    <!-- Original Value Display (hidden initially) -->
                    <div class="original-value-hint hidden" id="original-value-hint">
                        <span class="original-label">${hasConfirmedValue ? 'Reset to confirmed:' : 'Original:'}</span>
                        <span class="original-text clickable" onclick="resetToOriginalValue()">${escapeHtml(displayValue)}</span>
                    </div>
                    
                    <!-- Format Hint -->
                    <div class="date-format-hint" id="date-format-hint">
                        Supports: Year (2023), Month (2023-06), Day (2023-06-15), Decade (1990s)
                    </div>
                </div>
            </div>

            <!-- Precision Selection -->
            <div class="precision-selection">
                <div class="section-title">Date Precision</div>
                <div class="precision-container">
                    <select id="precision-select" class="precision-select">
                        <option value="day" ${detectedPrecision === 'day' ? 'selected' : ''}>Day precision</option>
                        <option value="month" ${detectedPrecision === 'month' ? 'selected' : ''}>Month precision</option>
                        <option value="year" ${detectedPrecision === 'year' ? 'selected' : ''}>Year precision</option>
                        <option value="decade" ${detectedPrecision === 'decade' ? 'selected' : ''}>Decade precision</option>
                    </select>
                    <div class="precision-description" id="precision-description">
                        Automatically detected precision: <strong>${detectedPrecision}</strong>
                    </div>
                </div>
            </div>

            <!-- Standardized Preview -->
            <div class="standardized-preview">
                <div class="section-title">Standardized Format</div>
                <div class="preview-value" id="preview-value">${escapeHtml(standardizedResult.displayValue || displayValue)}</div>
                <div class="preview-description">This is how the date will be stored in Wikidata</div>
            </div>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="cancelTimeModal()">Cancel</button>
            <button class="btn btn-outline" onclick="resetTimeModal()">Reset</button>
            <button class="btn btn-outline" onclick="skipReconciliation()">Skip</button>
            <button class="btn btn-primary" id="confirm-btn" onclick="confirmTimeValue()">Confirm</button>
        </div>
    `;

    return modalContent;
}

/**
 * Initialize Point-in-Time modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element
 */
export function initializeTimeModal(modalElement) {
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
        dataType: 'time',
        modalType: 'time',
        hasBeenEdited: hasConfirmedValue,
        hasConfirmedValue: hasConfirmedValue,
        confirmedData: confirmedData,
        detectedPrecision: detectDatePrecision(currentValue),
        sourceCell: sourceCell
    };
    
    // Set up date editor with enhanced functionality
    const dateEditor = document.getElementById('date-editor');
    if (dateEditor) {
        setupDateEditor(dateEditor);
    }
    
    // Set up precision selector
    const precisionSelect = document.getElementById('precision-select');
    if (precisionSelect) {
        setupPrecisionSelector(precisionSelect);
    }
    
    // Set up dynamic date precision detection
    const container = modalElement.querySelector('.time-section');
    if (container) {
        setupDynamicDatePrecision(container);
    }
    
    // Initial validation and UI state
    updateValidationState();
    updateStandardizedPreview();
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
 * Set up date editor with enhanced functionality
 * @param {HTMLElement} editor - The date editor element
 */
function setupDateEditor(editor) {
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
        
        // Update detected precision
        window.currentModalContext.detectedPrecision = detectDatePrecision(currentValue);
        
        // Update precision selector to match detected precision
        const precisionSelect = document.getElementById('precision-select');
        if (precisionSelect) {
            precisionSelect.value = window.currentModalContext.detectedPrecision;
            updatePrecisionDescription();
        }
        
        // Update validation and preview
        updateValidationState();
        updateStandardizedPreview();
    });
    
    // Set up blur event for final validation
    editor.addEventListener('blur', function() {
        updateValidationState();
    });
}

/**
 * Set up precision selector functionality
 * @param {HTMLElement} selector - The precision selector element
 */
function setupPrecisionSelector(selector) {
    selector.addEventListener('change', function() {
        // Update context with manually selected precision
        window.currentModalContext.manualPrecision = this.value;
        updatePrecisionDescription();
        updateStandardizedPreview();
        updateConfirmButtonState();
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
 * Update precision description text
 */
function updatePrecisionDescription() {
    const precisionDescription = document.getElementById('precision-description');
    const precisionSelect = document.getElementById('precision-select');
    
    if (!precisionDescription || !precisionSelect) return;
    
    const detectedPrecision = window.currentModalContext?.detectedPrecision;
    const selectedPrecision = precisionSelect.value;
    
    if (detectedPrecision === selectedPrecision) {
        precisionDescription.innerHTML = `Automatically detected precision: <strong>${detectedPrecision}</strong>`;
    } else {
        precisionDescription.innerHTML = `Detected: <strong>${detectedPrecision}</strong>, Manual override: <strong>${selectedPrecision}</strong>`;
    }
}

/**
 * Update validation state and visual feedback
 */
function updateValidationState() {
    const editor = document.getElementById('date-editor');
    const currentValue = window.currentModalContext?.currentValue || '';
    
    if (!editor) return;
    
    // Remove existing validation classes
    editor.className = editor.className.replace(/validation-(success|error)/g, '');
    
    // Validate the date input
    const isValid = validateDateInput(currentValue);
    
    if (isValid) {
        editor.classList.add('validation-success');
    } else {
        editor.classList.add('validation-error');
    }
    
    // Update confirm button state
    updateConfirmButtonState();
}

/**
 * Update the standardized preview
 */
function updateStandardizedPreview() {
    const previewValue = document.getElementById('preview-value');
    const currentValue = window.currentModalContext?.currentValue || '';
    const precisionSelect = document.getElementById('precision-select');
    
    if (!previewValue) return;
    
    if (currentValue.trim()) {
        const selectedPrecision = precisionSelect ? precisionSelect.value : detectDatePrecision(currentValue);
        const standardized = standardizeDateInput(currentValue);
        
        // Use the selected precision if different from detected
        let displayText = standardized.displayValue || currentValue;
        if (selectedPrecision !== standardized.precision) {
            // Reprocess with manual precision
            displayText = formatDateWithPrecision(currentValue, selectedPrecision);
        }
        
        previewValue.textContent = displayText;
    } else {
        previewValue.textContent = '';
    }
}

/**
 * Format date with specific precision
 * @param {string} dateInput - Input date string
 * @param {string} precision - Desired precision
 * @returns {string} Formatted date string
 */
function formatDateWithPrecision(dateInput, precision) {
    const standardized = standardizeDateInput(dateInput);
    
    switch (precision) {
        case 'year':
            return standardized.date.substring(0, 4);
        case 'month':
            return standardized.date.substring(0, 7);
        case 'day':
            return standardized.date;
        case 'decade':
            const year = parseInt(standardized.date.substring(0, 4));
            const decade = Math.floor(year / 10) * 10;
            return `${decade}s`;
        default:
            return standardized.displayValue || dateInput;
    }
}

/**
 * Validate date input
 * @param {string} value - Date value to validate
 * @returns {boolean} True if valid
 */
function validateDateInput(value) {
    if (!value || value.trim() === '') {
        return false;
    }
    
    // Use the existing standardization function to validate
    try {
        const result = standardizeDateInput(value);
        return result && result.date && result.precision;
    } catch (error) {
        return false;
    }
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
        
        const displayText = `${confirmationData.displayValue || confirmationData.value} (${confirmationData.precision})`;
        savedValueDisplay.textContent = displayText;
        
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
    
    const isValid = validateDateInput(currentValue);
    confirmBtn.disabled = !isValid;
}

// Global interaction handlers for Time modal
window.resetToOriginalValue = function() {
    const editor = document.getElementById('date-editor');
    const originalValueHint = document.getElementById('original-value-hint');
    const precisionSelect = document.getElementById('precision-select');
    
    if (!editor || !window.currentModalContext) return;
    
    // Reset to original value
    editor.value = window.currentModalContext.originalValue;
    window.currentModalContext.currentValue = window.currentModalContext.originalValue;
    window.currentModalContext.hasBeenEdited = false;
    
    // Reset precision to detected precision
    const detectedPrecision = detectDatePrecision(window.currentModalContext.originalValue);
    window.currentModalContext.detectedPrecision = detectedPrecision;
    if (precisionSelect) {
        precisionSelect.value = detectedPrecision;
    }
    
    // Hide original value hint
    if (originalValueHint) {
        originalValueHint.classList.add('hidden');
    }
    
    // Update UI
    updatePrecisionDescription();
    updateValidationState();
    updateStandardizedPreview();
};

window.cancelTimeModal = function() {
    if (typeof window.closeReconciliationModal === 'function') {
        window.closeReconciliationModal();
    }
};

window.resetTimeModal = function() {
    window.resetToOriginalValue();
};

window.confirmTimeValue = function() {
    if (!window.currentModalContext) {
        console.error('No modal context available for time confirmation');
        return;
    }
    
    // Get the actual current value from the input field
    const dateEditor = document.getElementById('date-editor');
    const precisionSelect = document.getElementById('precision-select');
    const currentValue = dateEditor ? dateEditor.value : window.currentModalContext.currentValue;
    const selectedPrecision = precisionSelect ? precisionSelect.value : window.currentModalContext.detectedPrecision;
    
    // Update context with the actual current value
    if (dateEditor) {
        window.currentModalContext.currentValue = dateEditor.value;
    }
    
    // Validate required fields
    if (!currentValue.trim()) {
        alert('Please enter a date value before confirming.');
        return;
    }
    
    if (!validateDateInput(currentValue)) {
        alert('Please enter a valid date format.');
        return;
    }
    
    // Standardize the date with the selected precision
    const standardized = standardizeDateInput(currentValue);
    const displayValue = formatDateWithPrecision(currentValue, selectedPrecision);
    
    // Prepare confirmation data
    const confirmationData = {
        type: 'custom',
        value: currentValue.trim(),
        displayValue: displayValue,
        standardizedDate: standardized.date,
        precision: selectedPrecision,
        datatype: 'time'
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
    let saved = savedToState;
    
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
    // Fallback: dispatch a custom event
    else {
        const event = new CustomEvent('timeValueConfirmed', {
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