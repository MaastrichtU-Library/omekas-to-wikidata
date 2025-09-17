/**
 * Enhanced Validation Engine for String Properties
 * @module reconciliation/ui/validation-engine
 * 
 * Comprehensive validation system supporting both regular strings and monolingual text.
 * Handles regex constraints, language selection, visual feedback, and Wikidata integration.
 * 
 * Features:
 * - Language search and selection via Wikidata API
 * - Persistent language preference storage
 * - Property link generation for Wikidata properties
 * - Enhanced visual validation feedback
 * - Support for monolingual text validation
 */

/**
 * Enhanced regex constraints database
 * In production, this would come from Wikidata property constraints API
 */
const CONSTRAINT_DATABASE = {
    // Common identifiers and formats
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
    },
    'wikidata_id': {
        pattern: '^Q\\d+$',
        description: 'Wikidata entity ID (Q followed by numbers)',
        examples: ['Q42', 'Q1234567', 'Q999999999'],
        errorMessage: 'Must be a valid Wikidata Q-ID (Q followed by numbers)'
    },
    'wikidata_property': {
        pattern: '^P\\d+$',
        description: 'Wikidata property ID (P followed by numbers)',
        examples: ['P31', 'P1234', 'P999999'],
        errorMessage: 'Must be a valid Wikidata P-ID (P followed by numbers)'
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

/**
 * Search Wikidata languages via API
 * @param {string} query - Language search query
 * @returns {Promise<Array>} Array of language objects with code and label
 */
export async function searchWikidataLanguages(query) {
    try {
        const apiUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&type=lexeme&limit=15`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Wikidata API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.search || data.search.length === 0) {
            // Fallback to manual language list for common languages
            return searchFallbackLanguages(query);
        }
        
        // Extract languages from lexeme search results
        const languages = [];
        const seenCodes = new Set();
        
        for (const result of data.search) {
            if (result.match && result.match.language) {
                const langCode = result.match.language;
                if (!seenCodes.has(langCode)) {
                    languages.push({
                        code: langCode,
                        label: getLanguageLabel(langCode) || result.match.text || langCode
                    });
                    seenCodes.add(langCode);
                }
            }
        }
        
        // Add common languages if few results
        if (languages.length < 5) {
            const commonLanguages = getCommonLanguages();
            const queryLower = query.toLowerCase();
            
            for (const lang of commonLanguages) {
                if (lang.label.toLowerCase().includes(queryLower) && !seenCodes.has(lang.code)) {
                    languages.push(lang);
                    seenCodes.add(lang.code);
                }
            }
        }
        
        return languages.slice(0, 10);
        
    } catch (error) {
        console.error('Wikidata language search failed:', error);
        // Fallback to manual search
        return searchFallbackLanguages(query);
    }
}

/**
 * Fallback language search when API fails
 * @param {string} query - Search query
 * @returns {Array} Array of matching languages
 */
function searchFallbackLanguages(query) {
    const queryLower = query.toLowerCase();
    return getCommonLanguages().filter(lang => 
        lang.label.toLowerCase().includes(queryLower) ||
        lang.code.toLowerCase().includes(queryLower)
    ).slice(0, 10);
}

/**
 * Get common language list
 * @returns {Array} Array of common language objects
 */
function getCommonLanguages() {
    return [
        { code: 'en', label: 'English' },
        { code: 'es', label: 'Spanish' },
        { code: 'fr', label: 'French' },
        { code: 'de', label: 'German' },
        { code: 'it', label: 'Italian' },
        { code: 'pt', label: 'Portuguese' },
        { code: 'ru', label: 'Russian' },
        { code: 'ja', label: 'Japanese' },
        { code: 'ko', label: 'Korean' },
        { code: 'zh', label: 'Chinese' },
        { code: 'ar', label: 'Arabic' },
        { code: 'hi', label: 'Hindi' },
        { code: 'nl', label: 'Dutch' },
        { code: 'pl', label: 'Polish' },
        { code: 'tr', label: 'Turkish' },
        { code: 'sv', label: 'Swedish' },
        { code: 'da', label: 'Danish' },
        { code: 'no', label: 'Norwegian' },
        { code: 'fi', label: 'Finnish' },
        { code: 'hu', label: 'Hungarian' },
        { code: 'cs', label: 'Czech' },
        { code: 'el', label: 'Greek' },
        { code: 'he', label: 'Hebrew' },
        { code: 'th', label: 'Thai' },
        { code: 'vi', label: 'Vietnamese' },
        { code: 'id', label: 'Indonesian' },
        { code: 'ms', label: 'Malay' },
        { code: 'tl', label: 'Filipino' },
        { code: 'uk', label: 'Ukrainian' },
        { code: 'bg', label: 'Bulgarian' },
        { code: 'hr', label: 'Croatian' },
        { code: 'sr', label: 'Serbian' },
        { code: 'sk', label: 'Slovak' },
        { code: 'sl', label: 'Slovenian' },
        { code: 'et', label: 'Estonian' },
        { code: 'lv', label: 'Latvian' },
        { code: 'lt', label: 'Lithuanian' },
        { code: 'ro', label: 'Romanian' },
        { code: 'ca', label: 'Catalan' },
        { code: 'eu', label: 'Basque' },
        { code: 'gl', label: 'Galician' },
        { code: 'is', label: 'Icelandic' },
        { code: 'ga', label: 'Irish' },
        { code: 'cy', label: 'Welsh' },
        { code: 'mt', label: 'Maltese' },
        { code: 'mk', label: 'Macedonian' },
        { code: 'sq', label: 'Albanian' },
        { code: 'bs', label: 'Bosnian' },
        { code: 'me', label: 'Montenegrin' }
    ];
}

/**
 * Get language label for a language code
 * @param {string} code - Language code
 * @returns {string|null} Language label or null if not found
 */
function getLanguageLabel(code) {
    const lang = getCommonLanguages().find(l => l.code === code);
    return lang ? lang.label : null;
}

/**
 * Get stored language preference from localStorage
 * @returns {Object|null} Stored language object or null
 */
export function getStoredLanguage() {
    try {
        const stored = localStorage.getItem('reconciliation_last_language');
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('Error reading stored language:', error);
        return null;
    }
}

/**
 * Store language preference in localStorage
 * @param {Object} language - Language object with code and label
 */
export function setStoredLanguage(language) {
    try {
        localStorage.setItem('reconciliation_last_language', JSON.stringify(language));
    } catch (error) {
        console.error('Error storing language preference:', error);
    }
}

/**
 * Generate Wikidata property link
 * @param {string} property - Property name or ID
 * @param {Object} propertyData - Property metadata
 * @returns {string|null} Wikidata property URL or null
 */
export function generatePropertyLink(property, propertyData) {
    // If we have explicit property ID from propertyData
    if (propertyData && propertyData.id) {
        return `https://www.wikidata.org/wiki/Property:${propertyData.id}`;
    }
    
    // If property looks like a Wikidata property ID (P followed by numbers)
    if (/^P\d+$/.test(property)) {
        return `https://www.wikidata.org/wiki/Property:${property}`;
    }
    
    // If we have a property URI that includes a Wikidata property ID
    if (propertyData && propertyData.uri) {
        const match = propertyData.uri.match(/P\d+/);
        if (match) {
            return `https://www.wikidata.org/wiki/Property:${match[0]}`;
        }
    }
    
    // For common property patterns, try to guess the Wikidata property
    const commonProperties = {
        'isbn': 'P212',
        'issn': 'P236', 
        'doi': 'P356',
        'orcid': 'P496',
        'title': 'P1476',
        'author': 'P50',
        'publisher': 'P123',
        'publication_date': 'P577',
        'language': 'P407'
    };
    
    const lowerProperty = property.toLowerCase();
    for (const [key, pid] of Object.entries(commonProperties)) {
        if (lowerProperty.includes(key)) {
            return `https://www.wikidata.org/wiki/Property:${pid}`;
        }
    }
    
    return null;
}

/**
 * Enhanced validation for monolingual text
 * @param {string} value - Text value
 * @param {string} languageCode - Language code
 * @param {Object} constraints - Validation constraints
 * @returns {Object} Validation result
 */
export function validateMonolingualText(value, languageCode, constraints) {
    // First validate the text value itself
    const textValidation = validateStringValue(value, constraints);
    
    // Then validate language requirement
    if (!languageCode) {
        return {
            isValid: false,
            message: 'Language selection is required for monolingual text',
            level: 'error'
        };
    }
    
    // Check if language code is valid
    if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(languageCode)) {
        return {
            isValid: false,
            message: 'Invalid language code format',
            level: 'error'
        };
    }
    
    // Return combined result
    if (!textValidation.isValid) {
        return textValidation;
    }
    
    return {
        isValid: true,
        message: `Valid monolingual text in ${getLanguageLabel(languageCode) || languageCode}`,
        level: 'success',
        languageCode: languageCode
    };
}