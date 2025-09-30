/**
 * Custom Reference Management Module
 * Handles creation, validation, and processing of user-defined custom references
 * @module references/core/custom-references
 */

/**
 * Creates a custom reference object from user input
 * @param {string} name - Name of the custom reference
 * @param {Array} itemReferences - Array of {itemId, url} objects
 * @returns {Object} Custom reference object
 */
export function createCustomReference(name, itemReferences) {
    // Filter out items with empty URLs
    const validItems = itemReferences.filter(item => item.url && item.url.trim() !== '');

    if (validItems.length === 0) {
        throw new Error('At least one item must have a reference URL');
    }

    // Extract base URL from the first valid reference
    const baseUrl = extractBaseUrl(validItems[0].url);

    return {
        id: `custom-ref-${Date.now()}`,
        name: name || 'Custom reference',
        type: 'custom',
        items: validItems,
        baseUrl,
        count: validItems.length,
        createdAt: new Date().toISOString()
    };
}

/**
 * Extracts the base URL (origin) from a full URL
 * @param {string} url - Full URL
 * @returns {string} Base URL (protocol + domain)
 */
export function extractBaseUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.origin;
    } catch (error) {
        // If URL parsing fails, try to extract domain manually
        const match = url.match(/^(https?:\/\/[^\/]+)/);
        return match ? match[1] : url;
    }
}

/**
 * Validates a custom reference
 * @param {string} name - Reference name
 * @param {Array} itemReferences - Array of {itemId, url} objects
 * @returns {Object} Validation result {isValid, errors}
 */
export function validateCustomReference(name, itemReferences) {
    const errors = [];

    if (!name || name.trim() === '') {
        errors.push('Reference name cannot be empty');
    }

    if (!Array.isArray(itemReferences)) {
        errors.push('Invalid item references format');
        return { isValid: false, errors };
    }

    const validItems = itemReferences.filter(item => item.url && item.url.trim() !== '');

    if (validItems.length === 0) {
        errors.push('At least one item must have a reference URL');
    }

    // Validate each URL
    validItems.forEach((item, index) => {
        try {
            new URL(item.url);
        } catch (e) {
            // Try to validate as a partial URL
            if (!item.url.match(/^https?:\/\/.+/)) {
                errors.push(`Invalid URL format for item ${index + 1}: ${item.url}`);
            }
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Converts custom reference to summary format for display
 * @param {Object} customRef - Custom reference object
 * @returns {Object} Summary format {count, examples}
 */
export function customReferenceToSummary(customRef) {
    return {
        count: customRef.count,
        examples: customRef.items.slice(0, 10).map(item => ({
            itemId: item.itemId,
            value: item.url
        }))
    };
}

/**
 * Gets the label for a custom reference type
 * @param {Object} customRef - Custom reference object
 * @returns {string} Display label
 */
export function getCustomReferenceLabel(customRef) {
    return customRef.name;
}

/**
 * Gets the description for a custom reference type
 * @param {Object} customRef - Custom reference object
 * @returns {string} Description
 */
export function getCustomReferenceDescription(customRef) {
    return customRef.baseUrl;
}

/**
 * Merges custom references into the references summary
 * @param {Object} summary - Existing summary from auto-detection
 * @param {Array} customReferences - Array of custom reference objects
 * @returns {Object} Merged summary
 */
export function mergeCustomReferencesIntoSummary(summary, customReferences) {
    const merged = { ...summary };

    customReferences.forEach(customRef => {
        merged[customRef.id] = customReferenceToSummary(customRef);
    });

    return merged;
}
