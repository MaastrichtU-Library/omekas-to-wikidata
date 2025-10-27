/**
 * Constraint UI components module
 * Handles UI components for constraint display and formatting
 * Separated from constraint validation business logic
 * @module mapping/ui/constraint-ui
 */

// Import dependencies
import { createElement } from '../../ui/components.js';

/**
 * Creates a constraint section UI element with value type, format, and other constraints
 * @param {Object} constraints - Constraints object with valueType, format, and other arrays
 * @returns {HTMLElement|null} Constraints section element or null if no constraints
 */
export function createConstraintsSection(constraints) {
    if (!constraints) return null;
    
    const hasConstraints = (constraints.format && constraints.format.length > 0) ||
                          (constraints.valueType && constraints.valueType.length > 0) ||
                          (constraints.other && constraints.other.length > 0);
    
    if (!hasConstraints) {
        return null; // Don't show anything if no constraints
    }
    
    const constraintsSection = createElement('div', {
        className: 'constraints-section'
    });
    
    // Value type restrictions - more user-friendly
    if (constraints.valueType && constraints.valueType.length > 0) {
        const valueTypeSection = createCompactConstraint(
            'Value restrictions',
            'Your values must link to specific types of items',
            formatValueTypeConstraintsCompact(constraints.valueType)
        );
        constraintsSection.appendChild(valueTypeSection);
    }
    
    // Format requirements - simplified
    if (constraints.format && constraints.format.length > 0) {
        const formatSection = createCompactConstraint(
            'Format rules',
            'Your text values must follow a specific format',
            formatFormatConstraintsCompact(constraints.format)
        );
        constraintsSection.appendChild(formatSection);
    }
    
    // Other constraints - only show if important
    if (constraints.other && constraints.other.length > 0) {
        const otherSection = createCompactConstraint(
            'Other requirements',
            'Additional validation rules apply',
            formatOtherConstraintsCompact(constraints.other)
        );
        constraintsSection.appendChild(otherSection);
    }
    
    return constraintsSection;
}

/**
 * Creates a compact constraint section with expandable details
 * @param {string} title - Constraint title
 * @param {string} explanation - Brief explanation text
 * @param {string} details - HTML details content
 * @returns {HTMLElement} Compact constraint element
 */
export function createCompactConstraint(title, explanation, details) {
    const container = createElement('details', {
        className: 'constraint-compact'
    });
    
    const summaryEl = createElement('summary', {
        className: 'constraint-compact-summary'
    });
    summaryEl.innerHTML = `<span class="constraint-compact-title">${title}</span>`;
    container.appendChild(summaryEl);
    
    const detailsEl = createElement('div', {
        className: 'constraint-compact-details'
    });
    detailsEl.innerHTML = `
        <div class="constraint-explanation">${explanation}</div>
        ${details}
    `;
    container.appendChild(detailsEl);
    
    return container;
}

/**
 * Formats value type constraints in a compact, user-friendly way
 * @param {Array} valueTypeConstraints - Array of value type constraint objects
 * @returns {string} Formatted HTML string
 */
export function formatValueTypeConstraintsCompact(valueTypeConstraints) {
    if (!valueTypeConstraints || valueTypeConstraints.length === 0) {
        return '<p>No restrictions found.</p>';
    }
    
    let html = '<div class="constraint-simple-list">';
    let allTypes = [];
    
    valueTypeConstraints.forEach(constraint => {
        constraint.classes.forEach(classId => {
            const label = constraint.classLabels[classId] || classId;
            allTypes.push(label);
        });
    });
    
    // Show only first few types to keep it compact
    const displayTypes = allTypes.slice(0, 3);
    const hasMore = allTypes.length > 3;
    
    html += '<p><strong>Must be:</strong> ';
    html += displayTypes.join(', ');
    if (hasMore) {
        html += ` <em>and ${allTypes.length - 3} others</em>`;
    }
    html += '</p>';
    
    html += '</div>';
    return html;
}

/**
 * Formats format constraints in a simplified way
 * @param {Array} formatConstraints - Array of format constraint objects
 * @returns {string} Formatted HTML string
 */
export function formatFormatConstraintsCompact(formatConstraints) {
    if (!formatConstraints || formatConstraints.length === 0) {
        return '<p>No format rules found.</p>';
    }
    
    let html = '<div class="constraint-simple-list">';
    
    formatConstraints.forEach((constraint, index) => {
        html += `<p><strong>Rule ${index + 1}:</strong> ${constraint.description}</p>`;
    });
    
    html += '</div>';
    return html;
}

/**
 * Formats other constraints in a minimal way
 * @param {Array} otherConstraints - Array of other constraint objects
 * @returns {string} Formatted HTML string
 */
export function formatOtherConstraintsCompact(otherConstraints) {
    if (!otherConstraints || otherConstraints.length === 0) {
        return '<p>No additional requirements found.</p>';
    }
    
    return `<p>This property has <strong>${otherConstraints.length}</strong> additional validation rule${otherConstraints.length > 1 ? 's' : ''}.</p>`;
}