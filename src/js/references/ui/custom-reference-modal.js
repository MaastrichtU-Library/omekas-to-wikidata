/**
 * Custom Reference Modal UI Module
 * Handles the modal interface for adding custom references
 * @module references/ui/custom-reference-modal
 */

import { createElement, createButton, createInput } from '../../ui/components.js';
import { createCustomReference, validateCustomReference } from '../core/custom-references.js';

/**
 * Gets the display name for an item based on reconciliation status
 * @param {Object} item - The Omeka item
 * @param {number} index - Item index
 * @param {Object} reconciliationData - Reconciliation data from state
 * @returns {string} Display name for the item
 */
function getItemDisplayName(item, index, reconciliationData) {
    const itemId = `item-${index}`;
    const itemData = reconciliationData?.[itemId];

    // Check if item has a linked Wikidata QID
    if (itemData && itemData.properties) {
        // Look through properties to find a reconciled Wikidata item
        for (const propertyKey in itemData.properties) {
            const propertyData = itemData.properties[propertyKey];
            if (propertyData.reconciled && Array.isArray(propertyData.reconciled)) {
                for (const reconciledItem of propertyData.reconciled) {
                    if (reconciledItem.selectedMatch && reconciledItem.selectedMatch.type === 'wikidata') {
                        return `Linked QID: ${reconciledItem.selectedMatch.id}`;
                    }
                }
            }
        }
    }

    // No linked QID found, show as new item
    return `New item ${index + 1}`;
}

/**
 * Creates and opens the custom reference modal
 * @param {Object} state - Application state management instance
 * @param {Function} onSubmit - Callback function when reference is added/updated
 * @param {Object} options - Modal options {isEdit: boolean, existingReference: object}
 */
export function openCustomReferenceModal(state, onSubmit, options = {}) {
    const { isEdit = false, existingReference = null } = options;
    const currentState = state.getState();
    const items = currentState.fetchedData || [];
    const reconciliationData = currentState.reconciliationData || {};

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
        className: 'modal custom-reference-modal',
        style: {
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '600px',
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
    }, isEdit ? 'Edit Reference' : 'Custom Reference');

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

    // Reference name input
    const nameLabel = createElement('label', {
        style: {
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500'
        }
    }, 'Reference Name');

    const nameInput = createInput('text', {
        placeholder: 'custom reference',
        value: isEdit && existingReference ? existingReference.name : '',
        style: {
            width: '100%',
            padding: '8px',
            marginBottom: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px'
        }
    });

    // Description
    const description = createElement('p', {
        style: {
            marginBottom: '16px',
            color: '#666',
            fontSize: '14px'
        }
    }, 'Add a reference URL for each item. Leave empty if no reference exists for that item.');

    // Items container
    const itemsContainer = createElement('div', {
        className: 'items-container',
        style: {
            marginTop: '16px'
        }
    });

    // Create mapping of existing URLs for pre-filling in edit mode
    const existingUrlsMap = new Map();
    if (isEdit && existingReference && existingReference.items) {
        existingReference.items.forEach(item => {
            existingUrlsMap.set(item.itemId, item.url);
        });
    }

    // Create input field for each item
    const itemInputs = [];
    items.forEach((item, index) => {
        // Use same itemId format as detector: @id or id or fallback to item-${index}
        const itemId = item['@id'] || item.id || `item-${index}`;
        const displayName = getItemDisplayName(item, index, reconciliationData);

        const itemRow = createElement('div', {
            className: 'item-row',
            style: {
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }
        });

        const itemLabel = createElement('label', {
            style: {
                minWidth: '150px',
                fontSize: '14px',
                fontWeight: '500'
            }
        }, displayName);

        // Pre-fill value from existing reference if in edit mode
        const existingUrl = existingUrlsMap.get(itemId) || '';

        const itemInput = createInput('text', {
            placeholder: 'https://example.com/reference',
            value: existingUrl,
            dataset: { itemId },
            style: {
                flex: '1',
                padding: '6px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
            }
        });

        itemInputs.push({ itemId, input: itemInput });

        itemRow.appendChild(itemLabel);
        itemRow.appendChild(itemInput);
        itemsContainer.appendChild(itemRow);
    });

    // Error message container
    const errorContainer = createElement('div', {
        className: 'error-container',
        style: {
            marginTop: '12px',
            color: '#f44336',
            fontSize: '14px',
            display: 'none'
        }
    });

    // Create modal footer with buttons
    const footer = createElement('div', {
        className: 'modal-footer',
        style: {
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
        }
    });

    const cancelButton = createButton('Cancel', {
        className: 'button button--secondary',
        onClick: () => {
            document.body.removeChild(overlay);
        }
    });

    const addButton = createButton(isEdit ? 'Save Changes' : 'Add Reference', {
        className: 'button button--primary',
        onClick: () => {
            // Gather input values
            const name = nameInput.value.trim() || 'Custom reference';
            const itemReferences = itemInputs
                .map(({ itemId, input }) => ({
                    itemId,
                    url: input.value.trim()
                }));

            // Validate (allow empty URLs now - they'll be filtered)
            const validation = validateCustomReference(name, itemReferences);
            if (!validation.isValid) {
                errorContainer.textContent = validation.errors.join('. ');
                errorContainer.style.display = 'block';
                return;
            }

            // Create or update reference - ALWAYS use createCustomReference for complete objects
            try {
                let customRef;

                if (isEdit && existingReference) {
                    // Preserve existing metadata when editing
                    const options = {
                        id: existingReference.id,
                        createdAt: existingReference.createdAt
                    };

                    // If this was originally an auto-detected reference, preserve that info
                    if (existingReference.originalType) {
                        options.originalType = existingReference.originalType;
                    } else if (existingReference.isAutoDetected) {
                        // First time converting from auto-detected
                        options.originalType = existingReference.type;
                    }

                    customRef = createCustomReference(name, itemReferences, options);
                } else {
                    // Create brand new custom reference
                    customRef = createCustomReference(name, itemReferences);
                }

                // Close modal
                document.body.removeChild(overlay);

                // Call onSubmit callback with complete reference object
                if (onSubmit) {
                    onSubmit(customRef);
                }
            } catch (error) {
                errorContainer.textContent = error.message;
                errorContainer.style.display = 'block';
            }
        }
    });

    footer.appendChild(cancelButton);
    footer.appendChild(addButton);

    // Assemble modal
    body.appendChild(nameLabel);
    body.appendChild(nameInput);
    body.appendChild(description);
    body.appendChild(itemsContainer);
    body.appendChild(errorContainer);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);

    overlay.appendChild(modal);

    // Add to document
    document.body.appendChild(overlay);

    // Focus on name input
    setTimeout(() => nameInput.focus(), 100);

    // Close on overlay click
    // Track mousedown to distinguish between clicks and drag-end events
    let mouseDownOnOverlay = false;

    overlay.addEventListener('mousedown', (e) => {
        mouseDownOnOverlay = (e.target === overlay);
    });

    overlay.addEventListener('click', (e) => {
        // Only close if both mousedown and mouseup (click) happened on the overlay
        // This prevents text selection drags from closing the modal
        if (e.target === overlay && mouseDownOnOverlay) {
            document.body.removeChild(overlay);
        }
        mouseDownOnOverlay = false;
    });

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}
