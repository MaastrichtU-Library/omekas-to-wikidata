/**
 * Value transformation blocks for Stage 3 mapping
 * Handles different types of value transformations that can be applied to property values
 * @module transformations
 */

/**
 * Block type definitions
 */
export const BLOCK_TYPES = {
    PREFIX: 'prefix',
    SUFFIX: 'suffix', 
    FIND_REPLACE: 'findReplace',
    COMPOSE: 'compose',
    REGEX: 'regex'
};

/**
 * Block type metadata for UI rendering
 */
export const BLOCK_METADATA = {
    [BLOCK_TYPES.PREFIX]: {
        name: 'Add Prefix',
        description: 'Add text to the beginning of the value',
        icon: '⟨',
        defaultConfig: {
            text: ''
        }
    },
    [BLOCK_TYPES.SUFFIX]: {
        name: 'Add Suffix',
        description: 'Add text to the end of the value',
        icon: '⟩',
        defaultConfig: {
            text: ''
        }
    },
    [BLOCK_TYPES.FIND_REPLACE]: {
        name: 'Find & Replace',
        description: 'Find and replace text in the value',
        icon: '🔄',
        defaultConfig: {
            find: '',
            replace: '',
            caseSensitive: false,
            useWholeWord: false
        }
    },
    [BLOCK_TYPES.COMPOSE]: {
        name: 'Compose',
        description: 'Combine multiple values and text patterns',
        icon: '🧩',
        defaultConfig: {
            pattern: '{{value}}'
        }
    },
    [BLOCK_TYPES.REGEX]: {
        name: 'Regular Expression',
        description: 'Advanced pattern matching and transformation',
        icon: '🔍',
        defaultConfig: {
            pattern: '',
            replacement: '',
            flags: 'g'
        }
    }
};

/**
 * Applies a single transformation block to a value
 * @param {string} value - The input value
 * @param {Object} block - The transformation block
 * @returns {string} The transformed value
 */
export function applyTransformation(value, block) {
    if (!value || !block || !block.type || !block.config) {
        return value;
    }
    
    try {
        switch (block.type) {
            case BLOCK_TYPES.PREFIX:
                return applyPrefixTransformation(value, block.config);
                
            case BLOCK_TYPES.SUFFIX:
                return applySuffixTransformation(value, block.config);
                
            case BLOCK_TYPES.FIND_REPLACE:
                return applyFindReplaceTransformation(value, block.config);
                
            case BLOCK_TYPES.COMPOSE:
                return applyComposeTransformation(value, block.config);
                
            case BLOCK_TYPES.REGEX:
                return applyRegexTransformation(value, block.config);
                
            default:
                console.warn(`Unknown transformation type: ${block.type}`);
                return value;
        }
    } catch (error) {
        console.error(`Error applying transformation ${block.type}:`, error);
        return value;
    }
}

/**
 * Applies multiple transformation blocks in sequence
 * @param {string} initialValue - The initial input value
 * @param {Array} blocks - Array of transformation blocks
 * @returns {Array} Array of objects with {value, blockId} showing progression
 */
export function applyTransformationChain(initialValue, blocks) {
    if (!blocks || blocks.length === 0) {
        return [{ value: initialValue, blockId: null }];
    }
    
    // Sort blocks by order
    const sortedBlocks = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const results = [{ value: initialValue, blockId: null }];
    let currentValue = initialValue;
    
    for (const block of sortedBlocks) {
        currentValue = applyTransformation(currentValue, block);
        results.push({ value: currentValue, blockId: block.id });
    }
    
    return results;
}

/**
 * Apply prefix transformation
 * @param {string} value - Input value
 * @param {Object} config - Configuration {text}
 * @returns {string} Transformed value
 */
function applyPrefixTransformation(value, config) {
    const prefix = config.text || '';
    return prefix + value;
}

/**
 * Apply suffix transformation
 * @param {string} value - Input value
 * @param {Object} config - Configuration {text}
 * @returns {string} Transformed value
 */
function applySuffixTransformation(value, config) {
    const suffix = config.text || '';
    return value + suffix;
}

/**
 * Apply find and replace transformation
 * @param {string} value - Input value
 * @param {Object} config - Configuration {find, replace, caseSensitive, useWholeWord}
 * @returns {string} Transformed value
 */
function applyFindReplaceTransformation(value, config) {
    const { find, replace = '', caseSensitive = false, useWholeWord = false } = config;
    
    if (!find) return value;
    
    let searchPattern = find;
    
    // Escape special regex characters if we're not using regex mode
    searchPattern = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (useWholeWord) {
        searchPattern = `\\b${searchPattern}\\b`;
    }
    
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchPattern, flags);
    
    return value.replace(regex, replace);
}

/**
 * Apply compose transformation
 * @param {string} value - Input value
 * @param {Object} config - Configuration {pattern, sourceData}
 * @returns {string} Transformed value
 */
function applyComposeTransformation(value, config) {
    const { pattern = '{{value}}', sourceData = {} } = config;
    
    if (!pattern) return value;
    
    let result = pattern;
    
    // Replace {{value}} with the current value
    result = result.replace(/\{\{value\}\}/g, value || '');
    
    // Replace {{field:path}} with values from source data
    result = result.replace(/\{\{field:([^}]+)\}\}/g, (match, fieldPath) => {
        const fieldValue = getValueByPath(sourceData, fieldPath);
        return fieldValue || '';
    });
    
    return result;
}

/**
 * Apply regex transformation
 * @param {string} value - Input value
 * @param {Object} config - Configuration {pattern, replacement, flags}
 * @returns {string} Transformed value
 */
function applyRegexTransformation(value, config) {
    const { pattern, replacement = '', flags = 'g' } = config;
    
    if (!pattern) return value;
    
    try {
        // Sanitize flags to prevent dangerous operations
        const safeFlags = sanitizeRegexFlags(flags);
        const regex = new RegExp(pattern, safeFlags);
        return value.replace(regex, replacement);
    } catch (error) {
        console.warn('Invalid regex pattern:', pattern, error);
        return value;
    }
}

/**
 * Get value from object by dot-notation path
 * @param {Object} obj - Source object
 * @param {string} path - Dot-notation path (e.g., 'publisher.o:label')
 * @returns {string} Value at path or empty string
 */
function getValueByPath(obj, path) {
    if (!obj || !path) return '';
    
    try {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && current[key] !== undefined) {
                current = current[key];
            } else {
                return '';
            }
        }
        
        // Convert final value to string
        if (typeof current === 'string') {
            return current;
        } else if (current && typeof current === 'object') {
            // Try to extract meaningful value from Omeka S structures
            if (current['@value']) return String(current['@value']);
            if (current['o:label']) return String(current['o:label']);
            if (current['value']) return String(current['value']);
            if (current['name']) return String(current['name']);
            if (current['title']) return String(current['title']);
            if (current['label']) return String(current['label']);
            if (current['display_title']) return String(current['display_title']);
        }
        
        return String(current || '');
    } catch (error) {
        console.warn('Error getting value by path:', path, error);
        return '';
    }
}

/**
 * Sanitize regex flags to prevent dangerous operations
 * @param {string} flags - Input flags
 * @returns {string} Safe flags
 */
function sanitizeRegexFlags(flags) {
    if (!flags || typeof flags !== 'string') return 'g';
    
    // Allow only safe flags
    const safeFlags = flags.toLowerCase().split('').filter(flag => 
        ['g', 'i', 'm', 's', 'u'].includes(flag)
    ).join('');
    
    return safeFlags || 'g';
}

/**
 * Validates a transformation block configuration
 * @param {Object} block - The transformation block
 * @returns {Object} Validation result {isValid, errors}
 */
export function validateTransformationBlock(block) {
    const errors = [];
    
    if (!block) {
        errors.push('Block is required');
        return { isValid: false, errors };
    }
    
    if (!block.type) {
        errors.push('Block type is required');
    } else if (!BLOCK_METADATA[block.type]) {
        errors.push(`Invalid block type: ${block.type}`);
    }
    
    if (!block.config) {
        errors.push('Block configuration is required');
        return { isValid: errors.length === 0, errors };
    }
    
    // Type-specific validation
    switch (block.type) {
        case BLOCK_TYPES.PREFIX:
        case BLOCK_TYPES.SUFFIX:
            if (typeof block.config.text !== 'string') {
                errors.push('Text must be a string');
            }
            break;
            
        case BLOCK_TYPES.FIND_REPLACE:
            if (!block.config.find) {
                errors.push('Find text is required');
            }
            if (typeof block.config.find !== 'string') {
                errors.push('Find text must be a string');
            }
            if (typeof block.config.replace !== 'string') {
                errors.push('Replace text must be a string');
            }
            break;
            
        case BLOCK_TYPES.COMPOSE:
            if (typeof block.config.pattern !== 'string') {
                errors.push('Pattern must be a string');
            }
            break;
            
        case BLOCK_TYPES.REGEX:
            if (!block.config.pattern) {
                errors.push('Regex pattern is required');
            }
            if (typeof block.config.pattern !== 'string') {
                errors.push('Regex pattern must be a string');
            }
            // Test if pattern is valid
            try {
                new RegExp(block.config.pattern, sanitizeRegexFlags(block.config.flags));
            } catch (e) {
                errors.push('Invalid regex pattern');
            }
            break;
    }
    
    return { isValid: errors.length === 0, errors };
}

/**
 * Creates a new transformation block with default configuration
 * @param {string} type - The block type
 * @param {Object} customConfig - Custom configuration to merge
 * @returns {Object} New transformation block
 */
export function createTransformationBlock(type, customConfig = {}) {
    const metadata = BLOCK_METADATA[type];
    if (!metadata) {
        throw new Error(`Invalid block type: ${type}`);
    }
    
    return {
        type,
        config: {
            ...metadata.defaultConfig,
            ...customConfig
        }
    };
}

/**
 * Common regex patterns for quick selection
 */
export const COMMON_REGEX_PATTERNS = {
    'Extract Year': {
        pattern: '\\b(\\d{4})\\b',
        replacement: '$1',
        description: 'Extract 4-digit year from text'
    },
    'Remove HTML Tags': {
        pattern: '<[^>]*>',
        replacement: '',
        description: 'Remove all HTML tags from text'
    },
    'Extract Numbers': {
        pattern: '\\d+',
        replacement: '$&',
        description: 'Extract all numbers from text'
    },
    'Remove Special Characters': {
        pattern: '[^a-zA-Z0-9\\s]',
        replacement: '',
        description: 'Remove special characters, keep only letters, numbers and spaces'
    },
    'Extract Email': {
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        replacement: '$&',
        description: 'Extract email addresses'
    },
    'Clean Whitespace': {
        pattern: '\\s+',
        replacement: ' ',
        description: 'Replace multiple whitespace with single space'
    },
    'Extract Parentheses Content': {
        pattern: '\\(([^)]+)\\)',
        replacement: '$1',
        description: 'Extract content from parentheses'
    },
    'Remove Brackets': {
        pattern: '[\\[\\]{}()]',
        replacement: '',
        description: 'Remove all types of brackets'
    }
};\n\n/**\n * Recursively extract all field paths and values from an Omeka S object\n * @param {Object} obj - The Omeka S data object\n * @param {string} basePath - Current path being processed\n * @param {Array} results - Array to collect results\n * @returns {Array} Array of {path, value, preview} objects\n */\nexport function extractAllFields(obj, basePath = '', results = []) {\n    if (!obj || typeof obj !== 'object') {\n        if (basePath && obj !== null && obj !== undefined) {\n            const value = String(obj);\n            results.push({\n                path: basePath,\n                value: value,\n                preview: value.length > 50 ? `${value.substring(0, 50)}...` : value\n            });\n        }\n        return results;\n    }\n    \n    if (Array.isArray(obj)) {\n        obj.forEach((item, index) => {\n            const newPath = basePath ? `${basePath}.${index}` : String(index);\n            extractAllFields(item, newPath, results);\n        });\n    } else {\n        Object.entries(obj).forEach(([key, value]) => {\n            const newPath = basePath ? `${basePath}.${key}` : key;\n            \n            if (value && typeof value === 'object') {\n                // Also check if this object has immediate string values we should extract\n                if (typeof value === 'object' && !Array.isArray(value)) {\n                    // Check for common Omeka S value patterns\n                    const immediateValues = ['@value', 'o:label', 'value', 'name', 'title', 'label', 'display_title'];\n                    for (const prop of immediateValues) {\n                        if (value[prop] && typeof value[prop] === 'string') {\n                            const val = String(value[prop]);\n                            results.push({\n                                path: `${newPath}.${prop}`,\n                                value: val,\n                                preview: val.length > 50 ? `${val.substring(0, 50)}...` : val\n                            });\n                        }\n                    }\n                }\n                // Continue recursive extraction\n                extractAllFields(value, newPath, results);\n            } else if (value !== null && value !== undefined) {\n                const val = String(value);\n                results.push({\n                    path: newPath,\n                    value: val,\n                    preview: val.length > 50 ? `${val.substring(0, 50)}...` : val\n                });\n            }\n        });\n    }\n    \n    return results;\n}\n\n/**\n * Search through extracted fields by key or value (case-insensitive)\n * @param {Array} fields - Array of field objects from extractAllFields\n * @param {string} searchTerm - Search term\n * @returns {Array} Filtered array of matching fields\n */\nexport function searchFields(fields, searchTerm) {\n    if (!searchTerm || !fields) return fields;\n    \n    const term = searchTerm.toLowerCase();\n    return fields.filter(field => \n        field.path.toLowerCase().includes(term) || \n        field.value.toLowerCase().includes(term)\n    );\n}\n\n/**\n * Gets a preview of the transformation result\n * @param {string} value - Sample value to transform\n * @param {Array} blocks - Array of transformation blocks\n * @returns {Object} Preview result with steps\n */\nexport function getTransformationPreview(value, blocks) {\n    if (!value) {\n        return { steps: [], finalValue: '' };  \n    }\n    \n    const steps = applyTransformationChain(value, blocks);\n    const finalValue = steps[steps.length - 1]?.value || value;\n    \n    return {\n        steps,\n        finalValue\n    };\n}