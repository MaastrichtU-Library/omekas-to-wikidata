/**
 * Reference Display Module
 * Renders detected references with counts and example tooltips
 * @module references/ui/display
 */

import { createElement, showMessage } from '../../ui/components.js';
import { getReferenceTypeLabel, getReferenceTypeDescription } from '../core/detector.js';
import { getDisplayBaseUrl } from '../core/custom-references.js';
import { openPropertyReferenceModal } from './property-reference-modal.js';

/**
 * Renders the references section in the UI
 * @param {Object} summary - Reference summary with counts and examples
 * @param {HTMLElement} container - Container element to render into
 * @param {number} totalItems - Total number of items in dataset
 * @param {Object} state - Application state management instance
 */
export function renderReferencesSection(summary, container, totalItems = 0, state = null) {
    if (!container) {
        console.error('No container provided for references section');
        return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Check if there are any auto-detected references
    const hasAutoDetectedReferences = Object.values(summary).some(data => data.count > 0);

    // Check if there are any custom references in state
    const customReferences = state ? state.getCustomReferences() : [];
    const hasCustomReferences = customReferences.length > 0;

    // Calculate total items with at least one reference
    const itemsWithReferences = new Set();
    Object.values(summary).forEach(data => {
        if (data.examples) {
            data.examples.forEach(example => itemsWithReferences.add(example.itemId));
        }
    });

    // Add custom reference items to the count
    customReferences.forEach(customRef => {
        customRef.items.forEach(item => itemsWithReferences.add(item.itemId));
    });

    // Create section (details element)
    const section = createElement('details', {
        className: 'section',
        open: true
    });

    // Create summary (header)
    const summaryElement = createElement('summary', {
        style: {
            textAlign: 'left'
        }
    });

    const titleSpan = createElement('span', {
        className: 'section-title'
    }, 'Available References');

    const countSpan = createElement('span', {
        className: 'section-count'
    }, `(${itemsWithReferences.size}/${totalItems})`);

    summaryElement.appendChild(titleSpan);
    summaryElement.appendChild(countSpan);
    section.appendChild(summaryElement);

    // Add guide text
    const guideText = createElement('p', {
        style: {
            fontSize: '13px',
            color: '#666',
            margin: '8px 0 12px 0',
            padding: '0 12px'
        }
    }, 'Some references are detected automatically from your data. Click "Add custom reference" to add more by hand.');
    section.appendChild(guideText);

    // Create list
    const list = createElement('ul', {
        className: 'key-list'
    });

    // If no auto-detected or custom references, show helpful message
    if (!hasAutoDetectedReferences && !hasCustomReferences) {
        const emptyMessage = createElement('li', {
            className: 'placeholder',
            style: {
                fontStyle: 'italic',
                color: '#666',
                padding: '8px 12px'
            }
        }, 'No references auto-detected. You can add custom references below.');
        list.appendChild(emptyMessage);
    }

    // Build a map of originalType -> custom reference for position preservation
    const customByOriginalType = new Map();
    const customWithoutOriginalType = [];

    if (state) {
        const customReferences = state.getCustomReferences();
        customReferences.forEach(customRef => {
            if (customRef.originalType) {
                customByOriginalType.set(customRef.originalType, customRef);
            } else {
                customWithoutOriginalType.push(customRef);
            }
        });
    }

    // Render references in order, with custom replacements in place of auto-detected
    const referenceTypes = ['omeka-item', 'oclc', 'ark'];

    referenceTypes.forEach(type => {
        const data = summary[type];

        // Check if there's a custom replacement for this auto-detected type
        if (customByOriginalType.has(type)) {
            // Render the custom replacement in this position
            const customRef = customByOriginalType.get(type);
            const customData = {
                count: customRef.count,
                examples: customRef.items.slice(0, 10).map(item => ({
                    itemId: item.itemId,
                    value: item.url
                }))
            };
            const listItem = createCustomReferenceListItem(customRef, customData, totalItems, state);
            list.appendChild(listItem);
        } else if (data && data.count > 0) {
            // Render auto-detected if it has no custom replacement
            const listItem = createReferenceListItem(type, data, totalItems, state);
            list.appendChild(listItem);
        }
    });

    // Add remaining custom references (those without originalType)
    customWithoutOriginalType.forEach(customRef => {
        const data = {
            count: customRef.count,
            examples: customRef.items.slice(0, 10).map(item => ({
                itemId: item.itemId,
                value: item.url
            }))
        };
        const listItem = createCustomReferenceListItem(customRef, data, totalItems, state);
        list.appendChild(listItem);
    });

    // Add "Add custom reference" button as a list item
    const addButton = createAddCustomReferenceButton(state);
    list.appendChild(addButton);

    section.appendChild(list);
    container.appendChild(section);

    // Render properties section after references
    renderPropertiesSection(container, totalItems, state);
}

/**
 * Creates a list item displaying a reference type with count and tooltip
 * @param {string} type - Reference type
 * @param {Object} data - Reference data with count and examples
 * @param {number} totalItems - Total number of items in dataset
 * @param {Object} state - Application state management instance
 * @returns {HTMLElement} List item element
 */
export function createReferenceListItem(type, data, totalItems, state = null) {
    const label = getReferenceTypeLabel(type);
    const description = getReferenceTypeDescription(type, data);

    // Check if this type is selected (default to selected if no state)
    const isSelected = state ? state.isReferenceTypeSelected(type) : true;

    // Create list item (uses same classes as mapping lists)
    const listItem = createElement('li', {
        dataset: {
            action: 'edit-reference',
            referenceType: 'auto-detected',
            referenceId: type
        },
        style: {
            opacity: isSelected ? '1' : '0.5',
            transition: 'opacity 0.2s ease'
        }
    });

    // Create compact key item wrapper
    const keyItemCompact = createElement('div', {
        className: 'key-item-compact',
        style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            cursor: 'pointer'
        }
    });

    // Create left section (text + frequency + info icon)
    const leftSection = createElement('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }
    });

    // Create key name with label and description
    const keyName = createElement('span', {
        className: 'key-name-compact',
        style: {
            textDecoration: isSelected ? 'none' : 'line-through'
        }
    }, `${label} - ${description}`);

    // Create frequency indicator (count display) - moved between text and info icon
    const frequency = createElement('span', {
        className: 'key-frequency',
        style: {
            fontSize: '0.9em',
            color: '#666'
        }
    }, `${data.count}/${totalItems} items`);

    // Create info icon with tooltip
    const infoIcon = createElement('span', {
        className: 'reference-info-icon',
        title: 'Hover for examples',
        style: {
            cursor: 'pointer',
            color: '#0066cc',
            fontSize: '1.1em'
        }
    }, 'ⓘ');

    // Create status indicator on the right
    const status = createElement('span', {
        className: 'reference-status',
        style: {
            fontSize: '0.85em',
            fontWeight: '500',
            color: isSelected ? '#2ecc71' : '#95a5a6',
            cursor: 'pointer',
            userSelect: 'none'
        }
    }, isSelected ? 'Selected' : 'Unselected');

    // Create tooltip element
    const tooltip = createTooltip(data.examples, type);

    // Add tooltip to body for proper positioning
    document.body.appendChild(tooltip);

    // Add hover handlers for tooltip
    let hideTimeout;

    infoIcon.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        tooltip.style.display = 'block';

        // Position tooltip near the icon using fixed positioning
        const iconRect = infoIcon.getBoundingClientRect();
        tooltip.style.left = `${iconRect.right + 10}px`;
        tooltip.style.top = `${iconRect.top}px`;
    });

    infoIcon.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
            tooltip.style.display = 'none';
        }, 200);
    });

    // Keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
    });

    tooltip.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    // Prevent info icon clicks from triggering edit
    infoIcon.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Add click handler to toggle selection state
    if (state) {
        status.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent edit modal from opening
            state.toggleReferenceType(type);
            const newIsSelected = state.isReferenceTypeSelected(type);

            // Update visual state
            listItem.style.opacity = newIsSelected ? '1' : '0.5';
            keyName.style.textDecoration = newIsSelected ? 'none' : 'line-through';
            status.textContent = newIsSelected ? 'Selected' : 'Unselected';
            status.style.color = newIsSelected ? '#2ecc71' : '#95a5a6';
        });

        // Add hover effect to status
        status.addEventListener('mouseenter', () => {
            status.style.textDecoration = 'underline';
        });

        status.addEventListener('mouseleave', () => {
            status.style.textDecoration = 'none';
        });
    }

    // Append all elements in the correct order: text -> frequency -> info icon
    leftSection.appendChild(keyName);
    leftSection.appendChild(frequency);
    leftSection.appendChild(infoIcon);

    // Append left section and status to the wrapper
    keyItemCompact.appendChild(leftSection);
    keyItemCompact.appendChild(status);

    listItem.appendChild(keyItemCompact);

    return listItem;
}

/**
 * Creates a tooltip element with example reference values
 * @param {Array} examples - Array of example objects with itemId and value
 * @param {string} type - Reference type for styling
 * @returns {HTMLElement} Tooltip element
 */
export function createTooltip(examples, type) {
    const tooltip = createElement('div', {
        className: 'reference-tooltip',
        style: {
            display: 'none',
            position: 'fixed',
            zIndex: '1000',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '10px',
            maxWidth: '700px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }
    });

    // Create list of examples (no header, no bullets)
    const list = createElement('ul', {
        className: 'tooltip-examples-list',
        style: {
            margin: '0',
            padding: '0',
            fontSize: '11px',
            listStyle: 'none'
        }
    });

    examples.slice(0, 10).forEach(example => {
        const listItem = createElement('li', {
            style: {
                marginBottom: '4px',
                wordBreak: 'break-all'
            }
        });

        // Create clickable link
        const link = createElement('a', {
            href: example.value,
            target: '_blank',
            rel: 'noopener noreferrer',
            style: {
                color: '#0066cc',
                textDecoration: 'none'
            }
        }, example.value);

        // Add hover effect
        link.addEventListener('mouseenter', () => {
            link.style.textDecoration = 'underline';
        });
        link.addEventListener('mouseleave', () => {
            link.style.textDecoration = 'none';
        });

        listItem.appendChild(link);
        list.appendChild(listItem);
    });

    tooltip.appendChild(list);

    return tooltip;
}

/**
 * Updates the references display with new summary data
 * @param {Object} summary - Updated reference summary
 * @param {HTMLElement} container - Container element
 * @param {number} totalItems - Total number of items in dataset
 * @param {Object} state - Application state management instance
 */
export function updateReferencesDisplay(summary, container, totalItems = 0, state = null) {
    renderReferencesSection(summary, container, totalItems, state);
}

/**
 * Creates a list item for a custom reference
 * @param {Object} customRef - Custom reference object
 * @param {Object} data - Reference data with count and examples
 * @param {number} totalItems - Total number of items in dataset
 * @param {Object} state - Application state management instance
 * @returns {HTMLElement} List item element
 */
export function createCustomReferenceListItem(customRef, data, totalItems, state = null) {
    const label = customRef.name;
    const description = getDisplayBaseUrl(customRef.baseUrl); // Remove https://
    const type = customRef.id;

    // Check if this type is selected (default to selected if no state)
    const isSelected = state ? state.isReferenceTypeSelected(type) : true;

    // Create list item (uses same classes as mapping lists)
    const listItem = createElement('li', {
        dataset: {
            action: 'edit-reference',
            referenceType: 'custom',
            referenceId: customRef.id
        },
        style: {
            opacity: isSelected ? '1' : '0.5',
            transition: 'opacity 0.2s ease'
        }
    });

    // Create compact key item wrapper
    const keyItemCompact = createElement('div', {
        className: 'key-item-compact',
        style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            cursor: 'pointer'
        }
    });

    // Create left section (text + frequency + info icon)
    const leftSection = createElement('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }
    });

    // Create key name with label and description
    const keyName = createElement('span', {
        className: 'key-name-compact',
        style: {
            textDecoration: isSelected ? 'none' : 'line-through'
        }
    }, `${label} - ${description}`);

    // Create frequency indicator (count display)
    const frequency = createElement('span', {
        className: 'key-frequency',
        style: {
            fontSize: '0.9em',
            color: '#666'
        }
    }, `${data.count}/${totalItems} items`);

    // Create info icon with tooltip
    const infoIcon = createElement('span', {
        className: 'reference-info-icon',
        title: 'Hover for examples',
        style: {
            cursor: 'pointer',
            color: '#0066cc',
            fontSize: '1.1em'
        }
    }, 'ⓘ');

    // Create status indicator on the right
    const status = createElement('span', {
        className: 'reference-status',
        style: {
            fontSize: '0.85em',
            fontWeight: '500',
            color: isSelected ? '#2ecc71' : '#95a5a6',
            cursor: 'pointer',
            userSelect: 'none'
        }
    }, isSelected ? 'Selected' : 'Unselected');

    // Create tooltip element
    const tooltip = createTooltip(data.examples, type);

    // Add tooltip to body for proper positioning
    document.body.appendChild(tooltip);

    // Add hover handlers for tooltip
    let hideTimeout;

    infoIcon.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        tooltip.style.display = 'block';

        // Position tooltip near the icon using fixed positioning
        const iconRect = infoIcon.getBoundingClientRect();
        tooltip.style.left = `${iconRect.right + 10}px`;
        tooltip.style.top = `${iconRect.top}px`;
    });

    infoIcon.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
            tooltip.style.display = 'none';
        }, 200);
    });

    // Keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
    });

    tooltip.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    // Prevent info icon clicks from triggering edit
    infoIcon.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Add click handler to toggle selection state
    if (state) {
        status.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent edit modal from opening
            state.toggleReferenceType(type);
            const newIsSelected = state.isReferenceTypeSelected(type);

            // Update visual state
            listItem.style.opacity = newIsSelected ? '1' : '0.5';
            keyName.style.textDecoration = newIsSelected ? 'none' : 'line-through';
            status.textContent = newIsSelected ? 'Selected' : 'Unselected';
            status.style.color = newIsSelected ? '#2ecc71' : '#95a5a6';
        });

        // Add hover effect to status
        status.addEventListener('mouseenter', () => {
            status.style.textDecoration = 'underline';
        });

        status.addEventListener('mouseleave', () => {
            status.style.textDecoration = 'none';
        });
    }

    // Append all elements in the correct order: text -> frequency -> info icon
    leftSection.appendChild(keyName);
    leftSection.appendChild(frequency);
    leftSection.appendChild(infoIcon);

    // Append left section and status to the wrapper
    keyItemCompact.appendChild(leftSection);
    keyItemCompact.appendChild(status);

    listItem.appendChild(keyItemCompact);

    return listItem;
}

/**
 * Creates the "Add custom reference" button as a list item
 * @param {Object} state - Application state management instance
 * @returns {HTMLElement} Button list item element
 */
export function createAddCustomReferenceButton(state) {
    const listItem = createElement('li', {
        className: 'add-custom-reference-button',
        style: {
            cursor: 'pointer',
            padding: '8px 12px'
        }
    });

    const content = createElement('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }
    });

    const plusIcon = createElement('span', {
        style: {
            fontWeight: 'bold'
        }
    }, '+');

    const text = createElement('span', {}, 'Add custom reference');

    content.appendChild(plusIcon);
    content.appendChild(text);
    listItem.appendChild(content);

    // Add hover effect
    listItem.addEventListener('mouseenter', () => {
        listItem.style.backgroundColor = '#f5f5f5';
    });

    listItem.addEventListener('mouseleave', () => {
        listItem.style.backgroundColor = 'transparent';
    });

    // Store click handler data attribute for step4.js to attach handler
    listItem.dataset.action = 'add-custom-reference';

    return listItem;
}

/**
 * Renders the properties section showing mapped and manual properties from step 2
 * @param {HTMLElement} container - Container element to render into
 * @param {number} totalItems - Total number of items in dataset
 * @param {Object} state - Application state management instance
 */
export function renderPropertiesSection(container, totalItems, state) {
    if (!state) {
        return;
    }

    const currentState = state.getState();
    const mappedKeys = currentState.mappings?.mappedKeys || [];
    const manualProperties = currentState.mappings?.manualProperties || [];

    // Combine all properties
    const allProperties = [...mappedKeys, ...manualProperties];

    if (allProperties.length === 0) {
        return;
    }

    // Create section (details element)
    const section = createElement('details', {
        className: 'section',
        open: true
    });

    // Create summary (header)
    const summaryElement = createElement('summary', {
        style: {
            textAlign: 'left'
        }
    });

    const titleSpan = createElement('span', {
        className: 'section-title'
    }, 'Properties Available for References');

    const countSpan = createElement('span', {
        className: 'section-count'
    }, `(${allProperties.length})`);

    summaryElement.appendChild(titleSpan);
    summaryElement.appendChild(countSpan);
    section.appendChild(summaryElement);

    // Add guide text
    const guideText = createElement('p', {
        style: {
            fontSize: '13px',
            color: '#666',
            margin: '8px 0 12px 0',
            padding: '0 12px'
        }
    }, 'Click a property to assign selected references. Click the reference counter of a property to customize which references are assigned.');
    section.appendChild(guideText);

    // Create list
    const list = createElement('ul', {
        className: 'key-list'
    });

    // Create re-render callback
    const onReferenceAssignment = () => {
        // Re-render the entire properties section
        // First, find and remove the existing section
        const existingSections = container.querySelectorAll('details.section');
        existingSections.forEach(section => {
            // Check if this is the properties section by looking for the title
            const titleElement = section.querySelector('.section-title');
            if (titleElement && titleElement.textContent === 'Properties Available for References') {
                section.remove();
            }
        });

        // Re-render the section
        renderPropertiesSection(container, totalItems, state);
    };

    // Render each property (mapped and manual)
    allProperties.forEach(propertyItem => {
        const listItem = createPropertyListItem(propertyItem, totalItems, state, onReferenceAssignment);
        list.appendChild(listItem);
    });

    section.appendChild(list);
    container.appendChild(section);
}

/**
 * Creates a list item for a mapped property
 * @param {Object} mappedKey - Mapped key object with property information
 * @param {number} totalItems - Total number of items in dataset
 * @param {Object} state - Application state management instance
 * @param {Function} onReferenceAssignment - Callback to re-render the section
 * @returns {HTMLElement} List item element
 */
function createPropertyListItem(mappedKey, totalItems, state, onReferenceAssignment) {
    const property = mappedKey.property;

    // Check if this is a manual property that cannot accept references
    const cannotAcceptReferences = ['label', 'description', 'aliases'].includes(property.id);

    // Get current reference count for this property
    const assignedReferences = state ? state.getPropertyReferences(property.id) : [];

    // Calculate total count of reference URLs (not just types)
    let referenceCount = 0;
    if (state && assignedReferences.length > 0) {
        const currentState = state.getState();
        const summary = currentState.references?.summary || {};
        const customReferences = currentState.references?.customReferences || [];

        assignedReferences.forEach(refType => {
            // Check if it's an auto-detected reference
            if (summary[refType]) {
                referenceCount += summary[refType].count || 0;
            } else {
                // Check if it's a custom reference
                const customRef = customReferences.find(ref => ref.id === refType);
                if (customRef) {
                    referenceCount += customRef.count || 0;
                }
            }
        });
    }

    // Create list item
    const listItem = createElement('li', {
        style: {
            opacity: cannotAcceptReferences ? '0.6' : '1',
            cursor: cannotAcceptReferences ? 'default' : 'pointer'
        }
    });

    // Create compact key item wrapper
    const keyItemCompact = createElement('div', {
        className: 'key-item-compact',
        style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%'
        }
    });

    // Create left section
    const leftSection = createElement('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        }
    });

    // Create property label text
    const labelText = createElement('span', {
        className: 'key-name-compact'
    }, property.label);

    // Create opening parenthesis
    const openParen = createElement('span', {
        className: 'key-name-compact'
    }, ' (');

    // Check if this is a real Wikidata property (starts with P) or a manual property (label, description, alias)
    const isWikidataProperty = property.id.startsWith('P');

    let propertyIdElement;
    if (isWikidataProperty) {
        // Create clickable property ID link for Wikidata properties
        propertyIdElement = createElement('a', {
            href: `https://www.wikidata.org/wiki/Property:${property.id}`,
            target: '_blank',
            rel: 'noopener noreferrer',
            style: {
                color: '#0066cc',
                textDecoration: 'none'
            }
        }, property.id);

        // Add hover effect to link
        propertyIdElement.addEventListener('mouseenter', () => {
            propertyIdElement.style.textDecoration = 'underline';
        });
        propertyIdElement.addEventListener('mouseleave', () => {
            propertyIdElement.style.textDecoration = 'none';
        });

        // Prevent link clicks from triggering list item click
        propertyIdElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    } else {
        // For manual properties (label, description, alias), just show as plain text
        propertyIdElement = createElement('span', {
            className: 'key-name-compact',
            style: {
                color: '#666'
            }
        }, property.id);
    }

    // Create closing parenthesis
    const closeParen = createElement('span', {
        className: 'key-name-compact'
    }, ')');

    // Append all elements to left section
    leftSection.appendChild(labelText);
    leftSection.appendChild(openParen);
    leftSection.appendChild(propertyIdElement);
    leftSection.appendChild(closeParen);

    // Create reference count indicator on the right
    const referenceCountText = referenceCount === 1 ? '1 reference' : `${referenceCount} references`;
    const referenceCountSpan = createElement('span', {
        className: 'reference-count',
        style: {
            fontSize: '0.85em',
            fontWeight: '500',
            color: cannotAcceptReferences ? '#95a5a6' : (referenceCount > 0 ? '#2ecc71' : '#95a5a6'),
            cursor: cannotAcceptReferences ? 'default' : 'pointer',
            userSelect: 'none'
        }
    }, cannotAcceptReferences ? 'No reference accepted' : (referenceCount > 0 ? referenceCountText : 'No references'));

    // Add click handler to reference count to open modal (only if references are allowed)
    if (state && !cannotAcceptReferences) {
        referenceCountSpan.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent list item click
            openPropertyReferenceModal(
                property.id,
                property.label,
                state,
                onReferenceAssignment
            );
        });

        // Add hover effect to reference count
        referenceCountSpan.addEventListener('mouseenter', () => {
            referenceCountSpan.style.textDecoration = 'underline';
        });

        referenceCountSpan.addEventListener('mouseleave', () => {
            referenceCountSpan.style.textDecoration = 'none';
        });
    }

    // Append left section and count to wrapper
    keyItemCompact.appendChild(leftSection);
    keyItemCompact.appendChild(referenceCountSpan);

    listItem.appendChild(keyItemCompact);

    // Add click handler for quick-assign (clicking anywhere on list item) - only if references are allowed
    if (state && !cannotAcceptReferences) {
        listItem.addEventListener('click', () => {
            // Get currently selected reference types
            const selectedReferenceTypes = state.getSelectedReferenceTypes();

            // If no references are selected, remove all references from this property
            // Otherwise, assign the selected references
            state.assignReferencesToProperty(property.id, selectedReferenceTypes);

            // Trigger re-render
            if (onReferenceAssignment) {
                onReferenceAssignment();
            }
        });

        // Add hover effect
        listItem.addEventListener('mouseenter', () => {
            listItem.style.backgroundColor = '#f5f5f5';
        });

        listItem.addEventListener('mouseleave', () => {
            listItem.style.backgroundColor = 'transparent';
        });
    }

    return listItem;
}
