/**
 * Reference Display Module
 * Renders detected references with counts and example tooltips
 * @module references/ui/display
 */

import { createElement } from '../../ui/components.js';
import { getReferenceTypeLabel, getReferenceTypeDescription } from '../core/detector.js';
import { getDisplayBaseUrl } from '../core/custom-references.js';

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

    // Check if there are any references
    const hasReferences = Object.values(summary).some(data => data.count > 0);

    if (!hasReferences) {
        const emptyMessage = createElement('p', {
            className: 'placeholder'
        }, 'No references detected in the API data.');
        container.appendChild(emptyMessage);
        return;
    }

    // Calculate total items with at least one reference
    const itemsWithReferences = new Set();
    Object.values(summary).forEach(data => {
        if (data.examples) {
            data.examples.forEach(example => itemsWithReferences.add(example.itemId));
        }
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

    // Create list
    const list = createElement('ul', {
        className: 'key-list'
    });

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
            // Only render auto-detected if it's not ignored and has no custom replacement
            const isSelected = state ? state.isReferenceTypeSelected(type) : true;
            if (isSelected) {
                const listItem = createReferenceListItem(type, data, totalItems, state);
                list.appendChild(listItem);
            }
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
    }, isSelected ? 'Selected' : 'Ignored');

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
            status.textContent = newIsSelected ? 'Selected' : 'Ignored';
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
    }, isSelected ? 'Selected' : 'Ignored');

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
            status.textContent = newIsSelected ? 'Selected' : 'Ignored';
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
 * Renders the properties section showing mapped properties from step 2
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

    if (mappedKeys.length === 0) {
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
    }, `(${mappedKeys.length})`);

    summaryElement.appendChild(titleSpan);
    summaryElement.appendChild(countSpan);
    section.appendChild(summaryElement);

    // Create list
    const list = createElement('ul', {
        className: 'key-list'
    });

    // Render each mapped property
    mappedKeys.forEach(mappedKey => {
        const listItem = createPropertyListItem(mappedKey, totalItems);
        list.appendChild(listItem);
    });

    section.appendChild(list);
    container.appendChild(section);
}

/**
 * Creates a list item for a mapped property
 * @param {Object} mappedKey - Mapped key object with property information
 * @param {number} totalItems - Total number of items in dataset
 * @returns {HTMLElement} List item element
 */
function createPropertyListItem(mappedKey, totalItems) {
    const property = mappedKey.property;

    // Create list item
    const listItem = createElement('li', {
        style: {
            opacity: '1'
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

    // Create clickable property ID link
    const propertyLink = createElement('a', {
        href: `https://www.wikidata.org/wiki/Property:${property.id}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: {
            color: '#0066cc',
            textDecoration: 'none'
        }
    }, property.id);

    // Add hover effect to link
    propertyLink.addEventListener('mouseenter', () => {
        propertyLink.style.textDecoration = 'underline';
    });
    propertyLink.addEventListener('mouseleave', () => {
        propertyLink.style.textDecoration = 'none';
    });

    // Create closing parenthesis
    const closeParen = createElement('span', {
        className: 'key-name-compact'
    }, ')');

    // Append all elements to left section
    leftSection.appendChild(labelText);
    leftSection.appendChild(openParen);
    leftSection.appendChild(propertyLink);
    leftSection.appendChild(closeParen);

    // Append left section to wrapper
    keyItemCompact.appendChild(leftSection);

    listItem.appendChild(keyItemCompact);

    return listItem;
}
