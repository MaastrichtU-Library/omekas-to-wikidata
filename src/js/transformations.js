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
        name: 'Compose (Coming Soon)',
        description: 'Combine multiple values and text patterns',
        icon: '🧩',
        isPlaceholder: true,
        defaultConfig: {
            pattern: '{{value}}'
        }
    },
    [BLOCK_TYPES.REGEX]: {
        name: 'Regular Expression (Coming Soon)',
        description: 'Advanced pattern matching and transformation',
        icon: '🔍',
        isPlaceholder: true,
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
            case BLOCK_TYPES.REGEX:
                // Placeholder blocks - return original value
                return value;
                
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