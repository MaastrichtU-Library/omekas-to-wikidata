/**
 * Transformation UI utility functions
 * Contains only pure UI utilities that can be safely separated
 * Main transformation logic remains in transformation-engine.js 
 * @module mapping/ui/transformation-ui
 */

// Import dependencies
import { createElement } from '../../ui/components.js';

/**
 * CSS class constants for transformation UI
 */
export const TRANSFORMATION_CSS_CLASSES = {
    CONTAINER: 'value-transformation-container',
    BLOCK: 'transformation-block',
    HEADER: 'block-header',
    CONFIG: 'block-config',
    DRAG_HANDLE: 'drag-handle',
    FLOW: 'transformation-flow',
    VALUE_STATE: 'transformation-value-state'
};

/**
 * Creates a simple notification element
 * @param {string} message - The message to display
 * @param {string} type - The type of message (info, warning, error)
 * @returns {HTMLElement} Notification element
 */
export function createTransformationMessage(message, type = 'info') {
    return createElement('div', {
        className: `transformation-message transformation-message--${type}`
    }, message);
}

/**
 * Formats a value for display in the transformation preview
 * @param {*} value - The value to format
 * @returns {string} Formatted value
 */
export function formatPreviewValue(value) {
    if (value === null || value === undefined) {
        return '(empty)';
    }
    if (typeof value === 'string' && value.trim() === '') {
        return '(empty string)';
    }
    return String(value).substring(0, 100); // Truncate long values
}

/**
 * Creates a standardized configuration field container
 * @param {string} label - The field label
 * @param {HTMLElement} input - The input element
 * @returns {HTMLElement} Field container
 */
export function createConfigField(label, input) {
    const container = createElement('div', { className: 'config-field' });
    
    if (label) {
        container.appendChild(createElement('label', {}, label));
    }
    
    container.appendChild(input);
    return container;
}

/**
 * Creates a help text element
 * @param {string} text - The help text
 * @returns {HTMLElement} Help text element
 */
export function createHelpText(text) {
    return createElement('div', {
        className: 'help-text'
    }, text);
}