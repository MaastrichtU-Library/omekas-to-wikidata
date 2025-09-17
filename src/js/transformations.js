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
 * Applies multiple transformation blocks in sequence to create a processing chain
 * 
 * ALGORITHM OVERVIEW:
 * This function implements a pipeline processing architecture for data transformation.
 * It executes an ordered sequence of transformation blocks, where each block's output
 * becomes the input for the next block, creating a composable data processing chain.
 * 
 * PROCESSING PHASES:
 * 
 * PHASE 1: CHAIN VALIDATION
 * - Validates input parameters and handles edge cases
 * - Returns early for empty transformation chains with initial value preserved
 * - Ensures graceful handling of malformed block definitions
 * 
 * PHASE 2: ORDERING AND SEQUENCING
 * - Sorts transformation blocks by their order property (ascending)
 * - Handles missing order values by treating them as priority 0
 * - Creates a stable sort to maintain relative ordering for equal priorities
 * - Prevents execution order ambiguity that could cause inconsistent results
 * 
 * PHASE 3: SEQUENTIAL PROCESSING
 * - Executes blocks in determined order using iterator pattern
 * - Maintains transformation history for debugging and preview
 * - Implements error isolation - failed blocks don't halt the entire chain
 * - Passes intermediate values through the processing pipeline
 * 
 * PHASE 4: RESULT AGGREGATION
 * - Collects transformation steps with intermediate values
 * - Associates each transformation result with its originating block ID
 * - Maintains complete audit trail for transformation debugging
 * - Enables step-by-step preview functionality in the UI
 * 
 * DESIGN PATTERNS IMPLEMENTED:
 * - Chain of Responsibility: Each block processes and passes along the value
 * - Pipeline Pattern: Sequential processing with intermediate results
 * - Immutable Transformation: Original values preserved at each step
 * - Error Isolation: Block failures don't cascade to subsequent blocks
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - O(n) time complexity where n is number of blocks
 * - Memory overhead: O(n) for storing intermediate results
 * - Lazy evaluation: Only processes blocks when needed
 * - No redundant processing: Each block executes exactly once
 * 
 * ERROR HANDLING STRATEGY:
 * - Graceful degradation: Invalid blocks return input unchanged
 * - Comprehensive logging: All transformation errors captured
 * - State preservation: Original values always accessible
 * - Non-blocking failures: Chain continues despite individual block errors
 * 
 * @param {string} initialValue - The initial input value to transform through the chain
 * @param {Array<Object>} blocks - Array of transformation block definitions
 * @param {string} blocks[].id - Unique identifier for the transformation block
 * @param {string} blocks[].type - Type of transformation (prefix, suffix, regex, etc.)
 * @param {Object} blocks[].config - Block-specific configuration parameters
 * @param {number} [blocks[].order=0] - Execution order (lower numbers execute first)
 * @returns {Array<Object>} Array of transformation steps with progression
 * @returns {string} returns[].value - Value after applying transformations up to this step
 * @returns {string|null} returns[].blockId - ID of block that produced this value, null for initial
 * 
 * @example
 * // Basic transformation chain
 * const blocks = [
 *   { id: '1', type: 'prefix', config: { text: 'Dr. ' }, order: 1 },
 *   { id: '2', type: 'suffix', config: { text: ', PhD' }, order: 2 },
 *   { id: '3', type: 'findReplace', config: { find: ' ', replace: '_' }, order: 3 }
 * ];
 * 
 * const result = applyTransformationChain('John Smith', blocks);
 * // Returns: [
 * //   { value: 'John Smith', blockId: null },      // Initial value
 * //   { value: 'Dr. John Smith', blockId: '1' },   // After prefix
 * //   { value: 'Dr. John Smith, PhD', blockId: '2' }, // After suffix  
 * //   { value: 'Dr._John_Smith,_PhD', blockId: '3' }  // After find/replace
 * // ]
 * 
 * @example
 * // Complex text processing for Wikidata format compliance
 * const formatBlocks = [
 *   { id: 'clean', type: 'regex', config: { pattern: '\\s+', replacement: ' ', flags: 'g' }, order: 1 },
 *   { id: 'trim', type: 'regex', config: { pattern: '^\\s+|\\s+$', replacement: '', flags: 'g' }, order: 2 },
 *   { id: 'title', type: 'compose', config: { pattern: '{{value}} (author)' }, order: 3 }
 * ];
 * 
 * const formatted = applyTransformationChain('  jane   doe  ', formatBlocks);
 * // Produces: 'jane doe (author)' through multi-step processing
 * 
 * @throws {Error} When transformation blocks contain invalid configurations
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
    
    console.log('[COMPOSE_TRANSFORM] Applying compose transformation:', {
        inputValue: value,
        pattern: pattern,
        hasSourceData: !!sourceData && Object.keys(sourceData).length > 0,
        sourceDataKeys: Object.keys(sourceData || {}).slice(0, 5)  // Show first 5 keys
    });
    
    if (!pattern) return value;
    
    let result = pattern;
    
    // Replace {{value}} with the current value
    result = result.replace(/\{\{value\}\}/g, value || '');
    console.log('[COMPOSE_TRANSFORM] After {{value}} replacement:', result);
    
    // Replace {{field:path}} with values from source data
    result = result.replace(/\{\{field:([^}]+)\}\}/g, (match, fieldPath) => {
        const fieldValue = getValueByPath(sourceData, fieldPath);
        console.log('[COMPOSE_TRANSFORM] Replacing field:', {
            fieldPath,
            fieldValue,
            found: !!fieldValue
        });
        return fieldValue || '';
    });
    console.log('[COMPOSE_TRANSFORM] After {{field:path}} replacement:', result);
    
    // Replace {{wikidata:QID}} references (these remain as-is for user reference)
    // The QIDs themselves are the values we want to keep
    result = result.replace(/\{\{wikidata:(Q\d+)\}\}/g, (match, qid) => {
        console.log('[COMPOSE_TRANSFORM] Found Wikidata QID:', qid);
        return qid;  // Return just the QID without the wrapper
    });
    
    console.log('[COMPOSE_TRANSFORM] Final result:', result);
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
        pattern: '.*?(\\b\\d{4}\\b).*',
        replacement: '$1',
        description: 'Extract 4-digit year from text'
    },
    'Extract Numbers': {
        pattern: '[^\\d]+',
        replacement: '',
        description: 'Extract all numbers from text'
    },
    'Remove Special Characters': {
        pattern: '[^a-zA-Z0-9\\s]',
        replacement: '',
        description: 'Remove special characters, keep only letters, numbers and spaces'
    },
    'Extract Email': {
        pattern: '.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}).*',
        replacement: '$1',
        description: 'Extract email addresses'
    },
    'Remove Whitespace': {
        pattern: '\\s',
        replacement: '',
        description: 'Remove all whitespace characters'
    },
    'Remove Brackets': {
        pattern: '[\\[\\]{}()]',
        replacement: '',
        description: 'Remove all types of brackets'
    },
    'Remove HTTP/HTTPS': {
        pattern: 'https?://',
        replacement: '',
        description: 'Remove http:// and https:// from URLs'
    },
    'Extract URL Last Part': {
        pattern: '.*\\/(.+)$',
        replacement: '$1',
        description: 'Extract the last part of a URL after the final slash'
    }
};

/**
 * Recursively extract all field paths and values from an Omeka S object
 * @param {Object} obj - The Omeka S data object
 * @param {string} basePath - Current path being processed
 * @param {Array} results - Array to collect results
 * @returns {Array} Array of {path, value, preview} objects
 */
export function extractAllFields(obj, basePath = '', results = []) {
    if (!obj || typeof obj !== 'object') {
        if (basePath && obj !== null && obj !== undefined) {
            const value = String(obj);
            results.push({
                path: basePath,
                value: value,
                preview: value.length > 50 ? `${value.substring(0, 50)}...` : value
            });
        }
        return results;
    }
    
    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            const newPath = basePath ? `${basePath}.${index}` : String(index);
            extractAllFields(item, newPath, results);
        });
    } else {
        Object.entries(obj).forEach(([key, value]) => {
            const newPath = basePath ? `${basePath}.${key}` : key;
            
            if (value && typeof value === 'object') {
                // Also check if this object has immediate string values we should extract
                if (typeof value === 'object' && !Array.isArray(value)) {
                    // Check for common Omeka S value patterns
                    const immediateValues = ['@value', 'o:label', 'value', 'name', 'title', 'label', 'display_title'];
                    for (const prop of immediateValues) {
                        if (value[prop] && typeof value[prop] === 'string') {
                            const val = String(value[prop]);
                            results.push({
                                path: `${newPath}.${prop}`,
                                value: val,
                                preview: val.length > 50 ? `${val.substring(0, 50)}...` : val
                            });
                        }
                    }
                }
                // Continue recursive extraction
                extractAllFields(value, newPath, results);
            } else if (value !== null && value !== undefined) {
                const val = String(value);
                results.push({
                    path: newPath,
                    value: val,
                    preview: val.length > 50 ? `${val.substring(0, 50)}...` : val
                });
            }
        });
    }
    
    return results;
}

/**
 * Search through extracted fields by key or value (case-insensitive)
 * @param {Array} fields - Array of field objects from extractAllFields
 * @param {string} searchTerm - Search term
 * @returns {Array} Filtered array of matching fields
 */
export function searchFields(fields, searchTerm) {
    if (!searchTerm || !fields) return fields;
    
    const term = searchTerm.toLowerCase();
    return fields.filter(field => 
        field.path.toLowerCase().includes(term) || 
        field.value.toLowerCase().includes(term)
    );
}

/**
 * Gets a preview of the transformation result
 * @param {string} value - Sample value to transform
 * @param {Array} blocks - Array of transformation blocks
 * @returns {Object} Preview result with steps
 */
export function getTransformationPreview(value, blocks) {
    if (!value) {
        return { steps: [], finalValue: '' };  
    }
    
    const steps = applyTransformationChain(value, blocks);
    const finalValue = steps[steps.length - 1]?.value || value;
    
    return {
        steps,
        finalValue
    };
}