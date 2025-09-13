/**
 * Entity Schema Overview Component
 * Displays selected Entity Schema information and mapping progress
 * @module entity-schemas/entity-schema-overview
 */

import { createElement } from '../ui/components.js';
import { eventSystem } from '../events.js';
import { 
    getMappingStatus, 
    categorizeProperties, 
    generateSchemaSummary, 
    detectSourceRequirement 
} from './schema-property-mapper.js';

/**
 * Initialize the Entity Schema Overview component
 * @param {Object} state - Application state object
 * @returns {HTMLElement} Overview container element
 */
export function initializeSchemaOverview(state) {
    const container = createElement('div', {
        className: 'entity-schema-overview',
        id: 'entity-schema-overview'
    });

    let isExpanded = false;
    let currentSchema = null;
    let headerElement = null;
    let bodyElement = null;

    // Initial render
    updateOverview();

    // Event listeners
    eventSystem.subscribe('entitySchemaSelected', (event) => {
        currentSchema = event.schema;
        updateOverview();
    });

    eventSystem.subscribe(eventSystem.Events.STATE_CHANGED, (event) => {
        if (event.path === 'mappings.mappedKeys' || event.path.includes('mappings')) {
            updateOverview();
        }
    });

    /**
     * Update the entire overview display
     */
    function updateOverview() {
        const selectedSchema = state.getSelectedEntitySchema();
        
        // Hide if no schema selected
        if (!selectedSchema) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        // Show and update content
        container.style.display = 'block';
        currentSchema = selectedSchema;
        
        const mappedKeys = state.getState().mappings?.mappedKeys || [];
        const categorizedProps = categorizeProperties(selectedSchema, mappedKeys);
        const summary = generateSchemaSummary(selectedSchema, categorizedProps.progress);

        renderOverview(summary, categorizedProps);
    }

    /**
     * Render the complete overview component
     * @param {Object} summary - Schema summary data
     * @param {Object} categorizedProps - Categorized properties data
     */
    function renderOverview(summary, categorizedProps) {
        container.innerHTML = '';

        // Create header (always visible)
        headerElement = createHeader(summary);
        container.appendChild(headerElement);

        // Create body (expandable)
        bodyElement = createBody(categorizedProps);
        container.appendChild(bodyElement);

        // Set initial expanded state
        updateExpandedState();
    }

    /**
     * Create the header section (collapsed view)
     * @param {Object} summary - Schema summary data
     * @returns {HTMLElement} Header element
     */
    function createHeader(summary) {
        const header = createElement('div', {
            className: 'schema-overview-header',
            onClick: toggleExpansion
        });

        const info = createElement('div', { className: 'schema-overview-collapsed' });

        // Schema label
        const label = createElement('span', {
            className: 'schema-label'
        }, summary.label);

        // Schema ID with link
        const idLink = createElement('a', {
            className: 'schema-id-link',
            href: summary.url,
            target: '_blank',
            onClick: (e) => e.stopPropagation() // Don't trigger expansion
        }, `(${summary.id})`);

        // Required progress
        const requiredProgress = createElement('span', {
            className: `required-progress ${summary.requiredStatus}`
        }, summary.requiredText);

        // Optional progress (subdued)
        const optionalProgress = createElement('span', {
            className: 'optional-progress'
        }, summary.optionalText);

        // Toggle indicator
        const toggleIndicator = createElement('span', {
            className: 'toggle-indicator'
        }, isExpanded ? '▲' : '▼');

        info.appendChild(label);
        info.appendChild(createElement('span', {}, ' '));
        info.appendChild(idLink);
        info.appendChild(createElement('span', {}, ' • '));
        info.appendChild(requiredProgress);
        
        if (summary.hasOptionalProperties) {
            info.appendChild(createElement('span', {}, ' • '));
            info.appendChild(optionalProgress);
        }

        header.appendChild(info);
        header.appendChild(toggleIndicator);

        return header;
    }

    /**
     * Create the body section (expanded view)
     * @param {Object} categorizedProps - Categorized properties data
     * @returns {HTMLElement} Body element
     */
    function createBody(categorizedProps) {
        const body = createElement('div', {
            className: 'schema-overview-expanded',
            style: isExpanded ? 'display: block;' : 'display: none;'
        });

        // Required properties section
        if (categorizedProps.required.mapped.length > 0 || categorizedProps.required.unmapped.length > 0) {
            const requiredSection = createPropertySection(
                'Required Properties',
                [...categorizedProps.required.mapped, ...categorizedProps.required.unmapped],
                'required'
            );
            body.appendChild(requiredSection);
        }

        // Optional properties section
        if (categorizedProps.optional.mapped.length > 0 || categorizedProps.optional.unmapped.length > 0) {
            const optionalSection = createPropertySection(
                'Optional Properties',
                [...categorizedProps.optional.mapped, ...categorizedProps.optional.unmapped],
                'optional'
            );
            body.appendChild(optionalSection);
        }

        // If no properties at all
        if (categorizedProps.required.mapped.length === 0 && 
            categorizedProps.required.unmapped.length === 0 && 
            categorizedProps.optional.mapped.length === 0 && 
            categorizedProps.optional.unmapped.length === 0) {
            const emptyMessage = createElement('div', {
                className: 'no-properties-message'
            }, 'This Entity Schema has no defined properties.');
            body.appendChild(emptyMessage);
        }

        return body;
    }

    /**
     * Create a property section (required or optional)
     * @param {string} title - Section title
     * @param {Array} properties - Property objects
     * @param {string} sectionType - 'required' or 'optional'
     * @returns {HTMLElement} Property section element
     */
    function createPropertySection(title, properties, sectionType) {
        const section = createElement('div', {
            className: `property-list-section ${sectionType}-section`
        });

        const header = createElement('h4', {
            className: 'property-section-header'
        }, title);

        const list = createElement('div', {
            className: 'property-list'
        });

        properties.forEach(property => {
            const item = createPropertyItem(property, sectionType);
            list.appendChild(item);
        });

        section.appendChild(header);
        section.appendChild(list);

        return section;
    }

    /**
     * Create a single property item
     * @param {Object} property - Property object
     * @param {string} sectionType - 'required' or 'optional'
     * @returns {HTMLElement} Property item element
     */
    function createPropertyItem(property, sectionType) {
        const item = createElement('div', {
            className: `property-item ${property.isMapped ? 'mapped' : 'unmapped'} ${sectionType}`,
            'data-property-id': property.id
        });

        // Status indicator
        const statusIndicator = createElement('span', {
            className: 'status-indicator'
        });
        
        if (property.isMapped) {
            statusIndicator.textContent = '✓';
            statusIndicator.classList.add('mapped');
        } else {
            statusIndicator.textContent = sectionType === 'required' ? '●' : '○';
            statusIndicator.classList.add('unmapped', sectionType);
        }

        // Property label
        const label = createElement('span', {
            className: 'property-label'
        }, property.label || property.id);

        // Property ID with link
        const idLink = createElement('a', {
            className: 'property-id-link',
            href: property.url || `https://www.wikidata.org/wiki/Property:${property.id}`,
            target: '_blank',
            title: `View ${property.id} on Wikidata`
        }, `(${property.id})`);

        // Source indicator if required
        let sourceIndicator = null;
        if (property.requiresSource || (property.description && detectSourceRequirement(property.description))) {
            sourceIndicator = createElement('span', {
                className: 'source-indicator',
                title: 'This property requires a source/reference'
            }, '📎');
        }

        item.appendChild(statusIndicator);
        item.appendChild(label);
        item.appendChild(createElement('span', {}, ' '));
        item.appendChild(idLink);
        
        if (sourceIndicator) {
            item.appendChild(createElement('span', {}, ' '));
            item.appendChild(sourceIndicator);
        }

        return item;
    }

    /**
     * Toggle expansion state
     */
    function toggleExpansion() {
        isExpanded = !isExpanded;
        updateExpandedState();
    }

    /**
     * Update the expanded/collapsed state
     */
    function updateExpandedState() {
        if (!bodyElement || !headerElement) return;

        const toggleIndicator = headerElement.querySelector('.toggle-indicator');
        
        if (isExpanded) {
            bodyElement.style.display = 'block';
            if (toggleIndicator) toggleIndicator.textContent = '▲';
            headerElement.classList.add('expanded');
        } else {
            bodyElement.style.display = 'none';
            if (toggleIndicator) toggleIndicator.textContent = '▼';
            headerElement.classList.remove('expanded');
        }
    }

    return container;
}