/**
 * Modal Factory for Reconciliation Data Types
 * @module reconciliation/ui/modals/modal-factory
 * 
 * Central factory for creating and managing reconciliation modals based on data type.
 * Provides consistent interface for all modal types and handles routing to appropriate
 * specialized modal implementations.
 * 
 * Supported modal types:
 * - wikibase-item: Wikidata entity reconciliation
 * - string: Text string validation and editing
 * - time: Date/time reconciliation
 * - monolingualtext: Text with language specification
 * - external-id: External identifier validation
 * - url: URL validation and testing
 * - quantity: Number/quantity reconciliation (future)
 */

import { 
    createWikidataItemModal, 
    initializeWikidataItemModal 
} from './wikidata-item-modal.js';
import { 
    createStringModal, 
    initializeStringModal 
} from './string-modal.js';
import { 
    createTimeModal, 
    initializeTimeModal 
} from './time-modal.js';
import {
    createExternalIdModal,
    initializeExternalIdModal
} from './external-id-modal.js';
import {
    createUrlModal,
    initializeUrlModal
} from './url-modal.js';

/**
 * Registry of modal handlers by data type
 */
const modalRegistry = {
    'wikibase-item': {
        create: createWikidataItemModal,
        initialize: initializeWikidataItemModal,
        name: 'Wikidata Item Reconciliation'
    },
    'string': {
        create: createStringModal,
        initialize: initializeStringModal,
        name: 'String Validation'
    },
    'time': {
        create: createTimeModal,
        initialize: initializeTimeModal,
        name: 'Date/Time Selection'
    },
    'monolingualtext': {
        create: createStringModal, // Reuse string modal with monolingual support
        initialize: initializeStringModal,
        name: 'Monolingual Text Entry'
    },
    'external-id': {
        create: createExternalIdModal,
        initialize: initializeExternalIdModal,
        name: 'External Identifier'
    },
    'url': {
        create: createUrlModal,
        initialize: initializeUrlModal,
        name: 'URL Validation'
    }
    // Future modal types will be registered here:
    // 'quantity': { create: createQuantityModal, initialize: initializeQuantityModal, name: 'Number/Quantity Input' }
};

/**
 * Create reconciliation modal based on data type
 * @param {string} dataType - The data type (wikibase-item, string, time, etc.)
 * @param {string} itemId - Item ID being reconciled
 * @param {string} property - Property name being reconciled
 * @param {number} valueIndex - Index of value within property
 * @param {string} value - The value to reconcile
 * @param {Object} propertyData - Property metadata and constraints
 * @param {Array} existingMatches - Pre-existing matches if available
 * @param {string} mappingId - The mapping ID for this property
 * @returns {HTMLElement} Modal content element
 * @throws {Error} If data type is not supported
 */
export function createReconciliationModalByType(dataType, itemId, property, valueIndex, value, propertyData = null, existingMatches = null, mappingId = null) {
    const modalHandler = modalRegistry[dataType];

    if (!modalHandler) {
        throw new Error(`Unsupported reconciliation modal type: ${dataType}. Supported types: ${Object.keys(modalRegistry).join(', ')}`);
    }
    try {
        const modalElement = modalHandler.create(itemId, property, valueIndex, value, propertyData, existingMatches, mappingId);

        // Add common modal metadata
        modalElement.dataset.modalFactory = 'reconciliation';
        modalElement.dataset.dataType = dataType;
        modalElement.dataset.modalName = modalHandler.name;

        // Add mappingId to modal dataset if provided
        if (mappingId) {
            modalElement.dataset.mappingId = mappingId;
        }

        return modalElement;
    } catch (error) {
        throw new Error(`Failed to create reconciliation modal for type ${dataType}: ${error.message}`);
    }
}

/**
 * Initialize reconciliation modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element to initialize
 * @throws {Error} If modal type cannot be determined or is not supported
 */
export function initializeReconciliationModal(modalElement) {
    if (!modalElement) {
        throw new Error('Modal element is required for initialization');
    }
    
    const dataType = modalElement.dataset.dataType;
    if (!dataType) {
        throw new Error('Modal element missing data-type attribute');
    }
    const modalHandler = modalRegistry[dataType];
    if (!modalHandler) {
        throw new Error(`No modal handler found for data type: ${dataType}`);
    }
    try {
        modalHandler.initialize(modalElement);
    } catch (error) {
        throw new Error(`Failed to initialize reconciliation modal for type ${dataType}: ${error.message}`);
    }
}

/**
 * Get list of supported modal types
 * @returns {Array<string>} Array of supported data type strings
 */
export function getSupportedModalTypes() {
    return Object.keys(modalRegistry);
}

/**
 * Check if a data type is supported
 * @param {string} dataType - Data type to check
 * @returns {boolean} True if supported, false otherwise
 */
export function isModalTypeSupported(dataType) {
    return modalRegistry.hasOwnProperty(dataType);
}

/**
 * Get modal information for a data type
 * @param {string} dataType - Data type to get info for
 * @returns {Object|null} Modal info object or null if not supported
 */
export function getModalTypeInfo(dataType) {
    const modalHandler = modalRegistry[dataType];
    if (!modalHandler) {
        return null;
    }
    
    return {
        dataType: dataType,
        name: modalHandler.name,
        supported: true
    };
}

/**
 * Register a new modal type (for future extensibility)
 * @param {string} dataType - Data type identifier
 * @param {Function} createFunction - Function to create modal
 * @param {Function} initializeFunction - Function to initialize modal
 * @param {string} name - Human-readable name for the modal type
 */
export function registerModalType(dataType, createFunction, initializeFunction, name) {
    if (modalRegistry[dataType]) {
    }
    
    modalRegistry[dataType] = {
        create: createFunction,
        initialize: initializeFunction,
        name: name
    };
    
}

/**
 * Create fallback modal for unsupported types
 * This will be used until specific modal types are implemented
 * @param {string} dataType - The unsupported data type
 * @param {string} value - The value to display
 * @returns {HTMLElement} Fallback modal element
 */
export function createFallbackModal(dataType, value) {
    const modalContent = document.createElement('div');
    modalContent.className = 'fallback-modal';
    modalContent.dataset.modalType = 'fallback';
    modalContent.dataset.dataType = dataType;
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="data-type-indicator">
                <span class="data-type-label">Type:</span>
                <span class="data-type-value">${escapeHtml(dataType)}</span>
            </div>
        </div>

        <div class="value-display">
            <div class="section-title">Value</div>
            <div class="current-value">${escapeHtml(value)}</div>
        </div>

        <div class="fallback-section">
            <div class="fallback-message">
                <h3>Modal Not Yet Implemented</h3>
                <p>A specialized reconciliation interface for <strong>${escapeHtml(dataType)}</strong> values is not yet available.</p>
                <p>For now, you can:</p>
                <ul>
                    <li>Use the current value as-is</li>
                    <li>Skip this reconciliation</li>
                    <li>Manually edit the value</li>
                </ul>
            </div>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeReconciliationModal()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmFallbackValue()">Use Current Value</button>
        </div>
    `;
    
    return modalContent;
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

// Global fallback handler
window.confirmFallbackValue = function() {
    if (typeof window.closeReconciliationModal === 'function') {
        window.closeReconciliationModal();
    }
};