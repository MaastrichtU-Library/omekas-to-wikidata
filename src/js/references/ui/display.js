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
 */
export function renderReferencesSection(summary, container) {
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

    // Create reference type cards
    const referenceTypes = ['omeka-item', 'oclc', 'ark'];

    referenceTypes.forEach(type => {
        const data = summary[type];
        if (data && data.count > 0) {
            const card = createReferenceTypeCard(type, data);
            container.appendChild(card);
        }
    });
}

/**
 * Creates a card displaying a reference type with count and tooltip
 * @param {string} type - Reference type
 * @param {Object} data - Reference data with count and examples
 * @returns {HTMLElement} Card element
 */
export function createReferenceTypeCard(type, data) {
    const label = getReferenceTypeLabel(type);
    const description = getReferenceTypeDescription(type);

    // Create card container
    const card = createElement('div', {
        className: 'reference-type-card'
    });

    // Create header with label and count
    const header = createElement('div', {
        className: 'reference-type-header'
    });

    const titleSpan = createElement('span', {
        className: 'reference-type-title'
    }, `${label} (${data.count} ${data.count === 1 ? 'item' : 'items'})`);

    // Create info icon with tooltip
    const infoIcon = createElement('span', {
        className: 'reference-info-icon',
        title: 'Hover for examples'
    }, 'ⓘ');

    // Create tooltip element
    const tooltip = createTooltip(data.examples, type);

    // Add hover handlers for tooltip
    let hideTimeout;

    infoIcon.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        tooltip.style.display = 'block';

        // Position tooltip near the icon
        const iconRect = infoIcon.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        tooltip.style.left = `${iconRect.left - cardRect.left + 20}px`;
        tooltip.style.top = `${iconRect.top - cardRect.top - 10}px`;
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

    header.appendChild(titleSpan);
    header.appendChild(infoIcon);

    // Create description
    const descDiv = createElement('div', {
        className: 'reference-type-description'
    }, description);

    // Assemble card
    card.appendChild(header);
    card.appendChild(descDiv);
    card.appendChild(tooltip);

    return card;
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
            position: 'absolute',
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
 */
export function updateReferencesDisplay(summary, container) {
    renderReferencesSection(summary, container);
}
