/**
 * Property Reference Modal UI Module
 * Handles the modal interface for assigning references to properties
 * @module references/ui/property-reference-modal
 */

import { createElement, createButton } from '../../ui/components.js';
import { getReferenceTypeLabel, getReferenceTypeDescription } from '../core/detector.js';
import { getDisplayBaseUrl } from '../core/custom-references.js';

/**
 * Opens a modal to manage reference assignments for a property
 * @param {string} propertyId - Wikidata property ID (e.g., 'P1476')
 * @param {string} propertyLabel - Human-readable property label
 * @param {Object} state - Application state management instance
 * @param {Function} onUpdate - Callback to re-render property list
 */
export function openPropertyReferenceModal(propertyId, propertyLabel, state, onUpdate) {
    const currentState = state.getState();

    // Get all available references
    const availableReferences = getAllAvailableReferences(state);

    // Get currently assigned references
    const assignedReferences = state.getPropertyReferences(propertyId);

    // Create modal overlay
    const overlay = createElement('div', {
        className: 'modal-overlay',
        style: {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '1000'
        }
    });

    // Create modal container
    const modal = createElement('div', {
        className: 'modal property-reference-modal',
        style: {
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }
    });

    // Create modal header
    const header = createElement('div', {
        className: 'modal-header',
        style: {
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }
    });

    const title = createElement('h3', {
        style: { margin: '0' }
    }, `Assign References to ${propertyLabel}`);

    const closeButton = createButton('×', {
        className: 'close-button',
        style: {
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0',
            width: '32px',
            height: '32px'
        },
        onClick: () => {
            document.body.removeChild(overlay);
        }
    });

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create modal body
    const body = createElement('div', {
        className: 'modal-body'
    });

    // Description
    const description = createElement('p', {
        style: {
            marginBottom: '16px',
            color: '#666',
            fontSize: '14px'
        }
    }, 'Select which references should be used for this property.');

    body.appendChild(description);

    // Create reference list
    const referenceList = createElement('div', {
        className: 'reference-list',
        style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }
    });

    // Track current selections
    let currentAssignedReferences = [...assignedReferences];

    // Render each available reference
    availableReferences.forEach(ref => {
        const isAssigned = currentAssignedReferences.includes(ref.id);
        const referenceItem = createReferenceListItem(ref, isAssigned, (checked) => {
            // Update current selections
            if (checked) {
                if (!currentAssignedReferences.includes(ref.id)) {
                    currentAssignedReferences.push(ref.id);
                }
            } else {
                currentAssignedReferences = currentAssignedReferences.filter(id => id !== ref.id);
            }

            // Update state immediately
            state.assignReferencesToProperty(propertyId, currentAssignedReferences);

            // Trigger re-render of property list
            if (onUpdate) {
                onUpdate();
            }
        });

        referenceList.appendChild(referenceItem);
    });

    body.appendChild(referenceList);

    // Create footer with close button
    const footer = createElement('div', {
        className: 'modal-footer',
        style: {
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'flex-end'
        }
    });

    const doneButton = createButton('Done', {
        className: 'button button--primary',
        onClick: () => {
            document.body.removeChild(overlay);
        }
    });

    footer.appendChild(doneButton);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });

    // Add to document
    document.body.appendChild(overlay);
}

/**
 * Gets all available references (auto-detected + custom)
 * @param {Object} state - Application state management instance
 * @returns {Array} Array of reference objects with {id, name, baseUrl}
 */
function getAllAvailableReferences(state) {
    const currentState = state.getState();
    const references = [];

    // Get auto-detected reference types
    const summary = currentState.references?.summary || {};
    const autoDetectedTypes = ['omeka-item', 'oclc', 'ark'];

    autoDetectedTypes.forEach(type => {
        const data = summary[type];
        if (data && data.count > 0) {
            references.push({
                id: type,
                name: getReferenceTypeLabel(type),
                baseUrl: getReferenceTypeDescription(type, data),
                type: 'auto-detected'
            });
        }
    });

    // Get custom references
    const customReferences = state.getCustomReferences() || [];
    customReferences.forEach(customRef => {
        references.push({
            id: customRef.id,
            name: customRef.name,
            baseUrl: getDisplayBaseUrl(customRef.baseUrl),
            type: 'custom'
        });
    });

    return references;
}

/**
 * Creates a list item for a reference with checkbox
 * @param {Object} reference - Reference object with {id, name, baseUrl}
 * @param {boolean} isChecked - Whether the checkbox should be checked
 * @param {Function} onChange - Callback when checkbox changes
 * @returns {HTMLElement} Reference list item
 */
function createReferenceListItem(reference, isChecked, onChange) {
    const item = createElement('div', {
        className: 'reference-item',
        style: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9'
        }
    });

    // Create checkbox
    const checkbox = createElement('input', {
        type: 'checkbox',
        checked: isChecked,
        style: {
            marginTop: '2px',
            cursor: 'pointer'
        }
    });

    // Handle checkbox change
    checkbox.addEventListener('change', (e) => {
        onChange(e.target.checked);
    });

    // Create content section
    const content = createElement('div', {
        style: {
            flex: '1',
            cursor: 'pointer'
        }
    });

    // Make content clickable to toggle checkbox
    content.addEventListener('click', () => {
        checkbox.checked = !checkbox.checked;
        onChange(checkbox.checked);
    });

    // Reference name
    const name = createElement('div', {
        style: {
            fontWeight: '500',
            marginBottom: '4px'
        }
    }, reference.name);

    // Reference base URL
    const baseUrl = createElement('div', {
        style: {
            fontSize: '12px',
            color: '#666'
        }
    }, reference.baseUrl);

    content.appendChild(name);
    content.appendChild(baseUrl);

    item.appendChild(checkbox);
    item.appendChild(content);

    return item;
}
