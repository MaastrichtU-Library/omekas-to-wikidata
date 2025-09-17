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
    console.log('🔍 [Validation Engine] extractRegexConstraints called:', {
        property,
        hasPropertyData: !!propertyData,
        propertyDataStructure: propertyData ? Object.keys(propertyData) : null,
        propertyDataConstraints: propertyData?.constraints
    });
    
    // First check if we have explicit constraint data from Wikidata
    if (propertyData && propertyData.constraints) {
        console.log('📋 [Validation Engine] Checking Wikidata constraints:', {
            constraintsStructure: Object.keys(propertyData.constraints),
            hasFormat: !!propertyData.constraints.format,
            formatCount: propertyData.constraints.format?.length || 0,
            constraints: propertyData.constraints
        });
        
        // Check for format constraints array (new structure)
        if (propertyData.constraints.format && Array.isArray(propertyData.constraints.format)) {
            console.log('📝 [Validation Engine] Checking format constraints array:');
            
            for (const formatConstraint of propertyData.constraints.format) {
                console.log('🔎 [Validation Engine] Examining format constraint:', {
                    hasRegex: !!formatConstraint.regex,
                    hasPattern: !!formatConstraint.pattern,
                    formatConstraint
                });
                
                // Look for regex field (new structure)
                if (formatConstraint.regex) {
                    const result = {
                        pattern: formatConstraint.regex,
                        description: formatConstraint.description || `Must match pattern: ${formatConstraint.regex}`,
                        source: 'wikidata',
                        rank: formatConstraint.rank
                    };
                    console.log('✅ [Validation Engine] Found Wikidata format constraint (regex field):', result);
                    return result;
                }
                
                // Fallback to pattern field (legacy structure)
                if (formatConstraint.pattern) {
                    const result = {
                        pattern: formatConstraint.pattern,
                        description: formatConstraint.description || `Must match pattern: ${formatConstraint.pattern}`,
                        source: 'wikidata',
                        rank: formatConstraint.rank
                    };
                    console.log('✅ [Validation Engine] Found Wikidata format constraint (pattern field):', result);
                    return result;
                }
            }
        }
        
        // Legacy check: constraints as direct array (old structure)
        if (Array.isArray(propertyData.constraints)) {
            console.log('📝 [Validation Engine] Checking legacy constraints array:');
            for (const constraint of propertyData.constraints) {
                console.log('🔎 [Validation Engine] Examining legacy constraint:', {
                    type: constraint.type,
                    hasPattern: !!constraint.pattern,
                    hasRegex: !!constraint.regex,
                    constraint
                });
                
                if (constraint.type === 'format') {
                    if (constraint.regex) {
                        const result = {
                            pattern: constraint.regex,
                            description: constraint.description || `Must match pattern: ${constraint.regex}`,
                            source: 'wikidata'
                        };
                        console.log('✅ [Validation Engine] Found legacy format constraint (regex field):', result);
                        return result;
                    }
                    
                    if (constraint.pattern) {
                        const result = {
                            pattern: constraint.pattern,
                            description: constraint.description || `Must match pattern: ${constraint.pattern}`,
                            source: 'wikidata'
                        };
                        console.log('✅ [Validation Engine] Found legacy format constraint (pattern field):', result);
                        return result;
                    }
                }
            }
        }
        
        console.log('❌ [Validation Engine] No format constraints found in Wikidata data');
    } else {
        console.log('❌ [Validation Engine] No propertyData or constraints available');
    }
    
    // Fallback to local constraint database
    const lowerProperty = property.toLowerCase();
    console.log('🗂️ [Validation Engine] Checking local constraint database:', {
        lowerProperty,
        availableKeys: Object.keys(CONSTRAINT_DATABASE)
    });
    
    // Direct match first
    if (CONSTRAINT_DATABASE[lowerProperty]) {
        const result = {
            ...CONSTRAINT_DATABASE[lowerProperty],
            source: 'builtin'
        };
        console.log('✅ [Validation Engine] Found direct match in local database:', result);
        return result;
    }
    
    // Pattern matching for property names
    for (const [key, constraint] of Object.entries(CONSTRAINT_DATABASE)) {
        if (lowerProperty.includes(key)) {
            const result = {
                ...constraint,
                source: 'builtin'
            };
            console.log('✅ [Validation Engine] Found pattern match in local database:', {
                matchedKey: key,
                result
            });
            return result;
        }
    }
    
    console.log('❌ [Validation Engine] No constraints found anywhere for property:', property);
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
 * Search languages using proper two-step Wikidata approach + fallback
 * @param {string} query - Language search query
 * @returns {Promise<Array>} Array of language objects with enhanced data
 */
export async function searchWikidataLanguages(query) {
    console.log('🔍 searchWikidataLanguages called with query:', query);
    
    const queryTrimmed = query.trim();
    
    // Fast fallback results for immediate response
    console.log('🔍 Getting fallback results for:', queryTrimmed);
    const fallbackResults = searchFallbackLanguages(queryTrimmed);
    console.log('🔍 Fallback results:', fallbackResults);
    
    // For very short queries, just return fallback
    if (queryTrimmed.length < 2) {
        console.log('🔍 Query too short, returning fallback only');
        return fallbackResults;
    }
    
    try {
        // Step 1: Search for candidate entities using wbsearchentities
        const candidates = await searchWikidataEntities(queryTrimmed);
        
        if (candidates.length === 0) {
            return fallbackResults;
        }
        
        // Step 2: Validate candidates and extract language data
        const validatedLanguages = await validateAndEnhanceLanguages(candidates);
        
        // Combine results: validated Wikidata languages + fallback (avoiding duplicates)
        const combinedResults = combineLanguageResults(validatedLanguages, fallbackResults);
        
        return combinedResults.slice(0, 12); // Limit total results
        
    } catch (error) {
        console.warn('Wikidata language search failed:', error);
        return fallbackResults;
    }
}

/**
 * Step 1: Search for candidate entities using wbsearchentities
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of candidate entity objects
 */
async function searchWikidataEntities(query) {
    const apiUrl = new URL('https://www.wikidata.org/w/api.php');
    apiUrl.searchParams.set('action', 'wbsearchentities');
    apiUrl.searchParams.set('search', query);
    apiUrl.searchParams.set('language', 'en');
    apiUrl.searchParams.set('uselang', 'en');
    apiUrl.searchParams.set('type', 'item');
    apiUrl.searchParams.set('limit', '15');
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('origin', '*');
    
    const response = await fetch(apiUrl.toString(), {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'OmekaS-to-Wikidata/1.0 (language-search)'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Wikidata search API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.search || [];
}

/**
 * Step 2: Validate candidates as languages and extract ISO codes
 * @param {Array} candidates - Candidate entities from search
 * @returns {Promise<Array>} Array of validated language objects
 */
async function validateAndEnhanceLanguages(candidates) {
    if (candidates.length === 0) return [];
    
    const qids = candidates.map(c => c.id);
    const entities = await getWikidataEntities(qids);
    
    const validatedLanguages = [];
    
    for (const candidate of candidates) {
        const entity = entities[candidate.id];
        if (!entity) continue;
        
        const languageData = entityToLanguageData(entity, candidate);
        if (languageData) {
            validatedLanguages.push(languageData);
        }
    }
    
    return validatedLanguages;
}

/**
 * Fetch full entity data from Wikidata
 * @param {Array} qids - Array of Wikidata QIDs
 * @returns {Promise<Object>} Entity data indexed by QID
 */
async function getWikidataEntities(qids) {
    const apiUrl = new URL('https://www.wikidata.org/w/api.php');
    apiUrl.searchParams.set('action', 'wbgetentities');
    apiUrl.searchParams.set('ids', qids.join('|'));
    apiUrl.searchParams.set('props', 'labels|descriptions|claims');
    apiUrl.searchParams.set('languages', 'en|fr|es|de|it'); // Include major languages
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('origin', '*');
    
    const response = await fetch(apiUrl.toString(), {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'OmekaS-to-Wikidata/1.0 (language-validation)'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Wikidata entities API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.entities || {};
}

/**
 * Convert Wikidata entity to language data if valid
 * @param {Object} entity - Wikidata entity object
 * @param {Object} searchResult - Original search result
 * @returns {Object|null} Language data object or null if not a language
 */
function entityToLanguageData(entity, searchResult) {
    // Validate that this is actually a language (P31 = Q34770)
    const instanceOfClaims = entity.claims?.P31 || [];
    const isLanguage = instanceOfClaims.some(claim => {
        const value = claim.mainsnak?.datavalue?.value;
        return value?.id === 'Q34770'; // language (Q34770)
    });
    
    if (!isLanguage) {
        return null;
    }
    
    // Extract ISO codes and other properties
    const getStringClaims = (pid) => {
        return (entity.claims?.[pid] || [])
            .map(claim => claim.mainsnak?.datavalue?.value)
            .filter(v => typeof v === 'string');
    };
    
    const iso639_1 = getStringClaims('P218')[0]; // ISO 639-1
    const iso639_2 = getStringClaims('P219'); // ISO 639-2 (can be multiple)
    const iso639_3 = getStringClaims('P220')[0]; // ISO 639-3
    const wikimediaCode = getStringClaims('P424')[0]; // Wikimedia language code
    
    // Get the best available language code for our system
    const code = iso639_1 || iso639_3 || wikimediaCode || entity.id;
    
    // Get labels and descriptions
    const label = entity.labels?.en?.value || searchResult.label || entity.id;
    const description = entity.descriptions?.en?.value || searchResult.description;
    
    return {
        id: entity.id, // QID
        code: code,
        label: label,
        description: description,
        iso639_1: iso639_1,
        iso639_2: iso639_2.length > 0 ? iso639_2 : undefined,
        iso639_3: iso639_3,
        wikimediaCode: wikimediaCode,
        source: 'wikidata'
    };
}

/**
 * Combine Wikidata results with fallback results, avoiding duplicates
 * @param {Array} wikidataResults - Validated Wikidata language results
 * @param {Array} fallbackResults - Fallback language results
 * @returns {Array} Combined unique language results
 */
function combineLanguageResults(wikidataResults, fallbackResults) {
    const combined = [...wikidataResults];
    const seenCodes = new Set(wikidataResults.map(r => r.code));
    const seenLabels = new Set(wikidataResults.map(r => r.label.toLowerCase()));
    
    // Add fallback results that don't duplicate Wikidata results
    for (const fallback of fallbackResults) {
        if (!seenCodes.has(fallback.code) && !seenLabels.has(fallback.label.toLowerCase())) {
            combined.push({
                ...fallback,
                source: 'fallback'
            });
            seenCodes.add(fallback.code);
            seenLabels.add(fallback.label.toLowerCase());
        }
    }
    
    return combined;
}

/**
 * Fallback language search when API fails
 * @param {string} query - Search query
 * @returns {Array} Array of matching languages
 */
function searchFallbackLanguages(query) {
    console.log('🔍 searchFallbackLanguages called with:', query);
    
    const queryLower = query.toLowerCase().trim();
    
    if (!queryLower) {
        console.log('🔍 Empty query, returning empty array');
        return [];
    }
    
    const commonLanguages = getCommonLanguages();
    console.log('🔍 Common languages available:', commonLanguages.length);
    
    const results = commonLanguages.filter(lang => 
        lang.label.toLowerCase().includes(queryLower) ||
        lang.code.toLowerCase().includes(queryLower) ||
        lang.code.toLowerCase().startsWith(queryLower)
    ).slice(0, 12);
    
    console.log('🔍 Fallback search results for "' + query + '":', results);
    return results;
}

/**
 * Extract language code from a language name
 * @param {string} languageName - Language name to extract code from
 * @returns {string|null} Language code or null if not found
 */
function extractLanguageCode(languageName) {
    const lowerName = languageName.toLowerCase();
    
    // Direct lookup in common languages
    const directMatch = getCommonLanguages().find(lang => 
        lang.label.toLowerCase() === lowerName
    );
    
    if (directMatch) {
        return directMatch.code;
    }
    
    // Pattern matching for common language name variations
    const patterns = {
        'english': 'en',
        'spanish': 'es', 
        'french': 'fr',
        'german': 'de',
        'italian': 'it',
        'portuguese': 'pt',
        'russian': 'ru',
        'japanese': 'ja',
        'chinese': 'zh',
        'arabic': 'ar',
        'dutch': 'nl',
        'polish': 'pl',
        'turkish': 'tr',
        'korean': 'ko',
        'hindi': 'hi'
    };
    
    for (const [pattern, code] of Object.entries(patterns)) {
        if (lowerName.includes(pattern)) {
            return code;
        }
    }
    
    return null;
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