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
 */
export function renderReferencesSection(summary, container, totalItems = 0) {
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
    const summaryElement = createElement('summary');

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
            const listItem = createReferenceListItem(type, data, totalItems);
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
 * @returns {HTMLElement} List item element
 */
export function createReferenceListItem(type, data, totalItems) {
    const label = getReferenceTypeLabel(type);
    const description = getReferenceTypeDescription(type);

    // Create list item (uses same classes as mapping lists)
    const listItem = createElement('li');

    // Create compact key item wrapper
    const keyItemCompact = createElement('div', {
        className: 'key-item-compact'
    });

    // Create key name with label and description
    const keyName = createElement('span', {
        className: 'key-name-compact'
    }, `${label} - ${description}`);

    // Create info icon with tooltip (inline with text)
    const infoIcon = createElement('span', {
        className: 'reference-info-icon',
        title: 'Hover for examples',
        style: {
            marginLeft: '8px',
            cursor: 'pointer',
            color: '#0066cc'
        }
    }, 'ⓘ');

    // Create frequency indicator (count display)
    const frequency = createElement('span', {
        className: 'key-frequency'
    }, `(${data.count}/${totalItems})`);

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

    // Append all elements in the correct order
    keyItemCompact.appendChild(keyName);
    keyItemCompact.appendChild(infoIcon);
    keyItemCompact.appendChild(frequency);
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
            maxWidth: '400px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }
    });

    // Create header
    const header = createElement('div', {
        className: 'tooltip-header',
        style: {
            fontWeight: 'bold',
            marginBottom: '8px',
            fontSize: '12px',
            color: '#333'
        }
    }, `Example values (showing up to ${examples.length})`);

    tooltip.appendChild(header);

    // Create list of examples
    const list = createElement('ul', {
        className: 'tooltip-examples-list',
        style: {
            margin: '0',
            padding: '0 0 0 20px',
            fontSize: '11px',
            listStyle: 'disc'
        }
    });

    examples.slice(0, 10).forEach(example => {
        const listItem = createElement('li', {
            style: {
                marginBottom: '4px',
                wordBreak: 'break-all',
                color: '#666'
            }
        });

        // Truncate long URLs for display
        const displayValue = example.value.length > 60
            ? example.value.substring(0, 60) + '...'
            : example.value;

        listItem.textContent = displayValue;
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
 */
export function updateReferencesDisplay(summary, container, totalItems = 0) {
    renderReferencesSection(summary, container, totalItems);
}
