/**
 * Validation Engine for String Properties
 * @module reconciliation/ui/validation-engine
 * 
 * Handles regex constraints extraction from Wikidata properties and provides
 * real-time validation for string values with detailed feedback.
 */

/**
 * Enhanced regex constraints database
 * In production, this would come from Wikidata property constraints API
 */
const CONSTRAINT_DATABASE = {
    // Common identifiers
    'isbn': {
        pattern: '^(?:97[89])?\\d{9}(?:\\d|X)$',
        description: 'ISBN-10 (10 digits, last may be X) or ISBN-13 (13 digits starting with 978 or 979)',
        examples: ['0123456789', '978-0123456789', '123456789X'],
        errorMessage: 'ISBN must be 10 or 13 digits. ISBN-10 may end with X.'
    },
    'issn': {
        pattern: '^\\d{4}-\\d{3}[\\dX]$',
        description: 'ISSN format: four digits, hyphen, three digits, and check digit (may be X)',
        examples: ['1234-5678', '0028-0836', '1550-7998'],
        errorMessage: 'ISSN must be in format NNNN-NNNX where X can be a digit or X'
    },
    'doi': {
        pattern: '^10\\.\\d+/.+$',
        description: 'DOI (Digital Object Identifier) starting with "10." followed by registrant and suffix',
        examples: ['10.1000/182', '10.1038/nature12373', '10.1145/1327452.1327492'],
        errorMessage: 'DOI must start with "10." followed by registrant code and suffix'
    },
    'orcid': {
        pattern: '^\\d{4}-\\d{4}-\\d{4}-\\d{3}[\\dX]$',
        description: 'ORCID identifier: 16 digits in groups of 4, separated by hyphens',
        examples: ['0000-0002-1825-0097', '0000-0003-1234-567X'],
        errorMessage: 'ORCID must be 16 digits in format NNNN-NNNN-NNNN-NNNX'
    },
    'url': {
        pattern: '^https?:\\/\\/[^\\s]+$',
        description: 'Valid HTTP or HTTPS URL',
        examples: ['https://example.com', 'http://www.example.org/path'],
        errorMessage: 'Must be a valid HTTP or HTTPS URL'
    },
    'email': {
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        description: 'Valid email address format',
        examples: ['user@example.com', 'test.email@domain.org'],
        errorMessage: 'Must be a valid email address'
    },
    'year': {
        pattern: '^\\d{4}$',
        description: 'Four-digit year',
        examples: ['2023', '1995', '1066'],
        errorMessage: 'Must be a four-digit year'
    },
    'date_iso': {
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'ISO 8601 date format (YYYY-MM-DD)',
        examples: ['2023-12-25', '1995-07-15', '2000-01-01'],
        errorMessage: 'Must be in format YYYY-MM-DD'
    }
};

/**
 * Extract regex constraints for a property
 * @param {string} property - Property identifier
 * @param {Object} propertyData - Property metadata from Wikidata
 * @returns {Object|null} Constraint object or null if no constraints
 */
export function extractRegexConstraints(property, propertyData = null) {
    // First check if we have explicit constraint data from Wikidata
    if (propertyData && propertyData.constraints) {
        for (const constraint of propertyData.constraints) {
            if (constraint.type === 'format' && constraint.pattern) {
                return {
                    pattern: constraint.pattern,
                    description: constraint.description || `Must match pattern: ${constraint.pattern}`,
                    source: 'wikidata'
                };
            }
        }
    }
    
    // Fallback to local constraint database
    const lowerProperty = property.toLowerCase();
    
    // Direct match first
    if (CONSTRAINT_DATABASE[lowerProperty]) {
        return {
            ...CONSTRAINT_DATABASE[lowerProperty],
            source: 'builtin'
        };
    }
    
    // Pattern matching for property names
    for (const [key, constraint] of Object.entries(CONSTRAINT_DATABASE)) {
        if (lowerProperty.includes(key)) {
            return {
                ...constraint,
                source: 'builtin'
            };
        }
    }
    
    return null;
}

/**
 * Validate a string value against constraints
 * @param {string} value - Value to validate
 * @param {Object} constraints - Constraint object
 * @returns {Object} Validation result
 */
export function validateStringValue(value, constraints) {
    if (!constraints || !constraints.pattern) {
        return {
            isValid: true,
            message: 'No validation constraints defined',
            level: 'info'
        };
    }
    
    if (!value || value.trim() === '') {
        return {
            isValid: false,
            message: 'Value cannot be empty',
            level: 'error'
        };
    }
    
    try {
        const regex = new RegExp(constraints.pattern);
        const isValid = regex.test(value.trim());
        
        return {
            isValid,
            message: isValid ? 'Value is valid' : (constraints.errorMessage || `Value does not match required pattern`),
            level: isValid ? 'success' : 'error',
            pattern: constraints.pattern,
            description: constraints.description,
            examples: constraints.examples
        };
    } catch (error) {
        console.error('Invalid regex pattern:', constraints.pattern, error);
        return {
            isValid: true,
            message: 'Constraint pattern is invalid - validation skipped',
            level: 'warning'
        };
    }
}

/**
 * Validate value in real-time as user types
 * @param {string} value - Current value
 * @param {Object} constraints - Constraint object
 * @returns {Object} Real-time validation result
 */
export function validateRealTime(value, constraints) {
    if (!constraints || !constraints.pattern) {
        return {
            isValid: true,
            message: '',
            showHint: false
        };
    }
    
    // Empty value - show hint
    if (!value || value.trim() === '') {
        return {
            isValid: false,
            message: constraints.description || 'Enter a value',
            showHint: true,
            level: 'info'
        };
    }
    
    // Validate current value
    const result = validateStringValue(value, constraints);
    
    // For invalid values, provide helpful hints
    if (!result.isValid && constraints.examples) {
        result.message += `. Examples: ${constraints.examples.slice(0, 2).join(', ')}`;
    }
    
    return result;
}

/**
 * Get suggestions for fixing an invalid value
 * @param {string} value - Invalid value
 * @param {Object} constraints - Constraint object
 * @returns {Array} Array of suggested fixes
 */
export function getSuggestedFixes(value, constraints) {
    if (!value || !constraints) return [];
    
    const suggestions = [];
    const trimmedValue = value.trim();
    
    // Common fixes based on constraint type
    const constraintKey = Object.keys(CONSTRAINT_DATABASE).find(key => 
        constraints.pattern === CONSTRAINT_DATABASE[key].pattern
    );
    
    switch (constraintKey) {
        case 'isbn':
            // Remove hyphens and spaces
            const cleanIsbn = trimmedValue.replace(/[-\s]/g, '');
            if (cleanIsbn !== trimmedValue) {
                suggestions.push({
                    text: cleanIsbn,
                    description: 'Remove hyphens and spaces'
                });
            }
            break;
            
        case 'issn':
            // Add hyphen if missing
            if (/^\d{7}[\dX]$/.test(trimmedValue)) {
                suggestions.push({
                    text: trimmedValue.slice(0, 4) + '-' + trimmedValue.slice(4),
                    description: 'Add hyphen after 4th digit'
                });
            }
            break;
            
        case 'url':
            // Add protocol if missing
            if (!/^https?:\/\//.test(trimmedValue)) {
                suggestions.push({
                    text: 'https://' + trimmedValue,
                    description: 'Add HTTPS protocol'
                });
            }
            break;
            
        case 'year':
            // Extract year from longer string
            const yearMatch = trimmedValue.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                suggestions.push({
                    text: yearMatch[0],
                    description: 'Extract year from text'
                });
            }
            break;
    }
    
    return suggestions;
}

/**
 * Create interactive validation UI
 * @param {HTMLElement} container - Container element
 * @param {string} value - Current value
 * @param {Object} constraints - Constraint object
 * @param {Function} onUpdate - Callback for value updates
 */
export function createValidationUI(container, value, constraints, onUpdate) {
    const validation = validateRealTime(value, constraints);
    const suggestions = validation.isValid ? [] : getSuggestedFixes(value, constraints);
    
    container.innerHTML = `
        <div class="validation-ui">
            <div class="validation-status ${validation.isValid ? 'valid' : 'invalid'} ${validation.level || ''}">
                <span class="status-icon">${getStatusIcon(validation)}</span>
                <span class="status-text">${validation.message}</span>
            </div>
            
            ${suggestions.length > 0 ? `
                <div class="validation-suggestions">
                    <div class="suggestions-title">Suggested fixes:</div>
                    ${suggestions.map(suggestion => `
                        <button class="suggestion-button" onclick="applySuggestion('${escapeHtml(suggestion.text)}')">
                            <span class="suggestion-text">${escapeHtml(suggestion.text)}</span>
                            <span class="suggestion-description">${escapeHtml(suggestion.description)}</span>
                        </button>
                    `).join('')}
                </div>
            ` : ''}
            
            ${constraints.examples ? `
                <div class="validation-examples">
                    <div class="examples-title">Valid examples:</div>
                    <div class="examples-list">
                        ${constraints.examples.slice(0, 3).map(example => `
                            <code class="example-value">${escapeHtml(example)}</code>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Store callback for suggestion buttons
    window.applySuggestion = function(suggestedValue) {
        if (onUpdate) {
            onUpdate(suggestedValue);
        }
    };
}

/**
 * Get status icon for validation result
 * @param {Object} validation - Validation result
 * @returns {string} Icon character
 */
function getStatusIcon(validation) {
    if (!validation.message) return '';
    
    switch (validation.level) {
        case 'success': return '✓';
        case 'error': return '✗';
        case 'warning': return '⚠';
        case 'info': return 'ℹ';
        default: return validation.isValid ? '✓' : '✗';
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Live validation setup for input fields
 * @param {HTMLInputElement} input - Input element
 * @param {Object} constraints - Constraint object
 * @param {HTMLElement} feedbackContainer - Container for validation feedback
 */
export function setupLiveValidation(input, constraints, feedbackContainer) {
    if (!input || !constraints) return;
    
    const updateValidation = () => {
        const value = input.value;
        createValidationUI(feedbackContainer, value, constraints, (newValue) => {
            input.value = newValue;
            input.dispatchEvent(new Event('input'));
        });
    };
    
    // Initial validation
    updateValidation();
    
    // Set up event listeners
    input.addEventListener('input', updateValidation);
    input.addEventListener('blur', updateValidation);
    
    // Add CSS class for styling
    input.classList.add('validation-enabled');
}

/**
 * Batch validate multiple values
 * @param {Array} values - Array of {value, constraints} objects
 * @returns {Array} Array of validation results
 */
export function validateBatch(values) {
    return values.map(({ value, constraints }) => ({
        value,
        validation: validateStringValue(value, constraints)
    }));
}