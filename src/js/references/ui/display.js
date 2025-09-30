/**
 * Reference Display Module
 * Renders detected references with counts and example tooltips
 * @module references/ui/display
 */

import { createElement } from '../../ui/components.js';
import { getReferenceTypeLabel, getReferenceTypeDescription } from '../core/detector.js';

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

    // Create reference type list items
    const referenceTypes = ['omeka-item', 'oclc', 'ark'];

    referenceTypes.forEach(type => {
        const data = summary[type];
        if (data && data.count > 0) {
            const listItem = createReferenceListItem(type, data, totalItems, state);
            list.appendChild(listItem);
        }
    });

    section.appendChild(list);
    container.appendChild(section);
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
    const description = getReferenceTypeDescription(type);

    // Check if this type is selected (default to selected if no state)
    const isSelected = state ? state.isReferenceTypeSelected(type) : true;

    // Create list item (uses same classes as mapping lists)
    const listItem = createElement('li', {
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
            width: '100%'
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

    // Add click handler to toggle selection state
    if (state) {
        status.addEventListener('click', () => {
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
