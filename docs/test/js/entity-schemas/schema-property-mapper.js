/**
 * Schema Property Mapper
 * Helper module to analyze and categorize schema properties vs current mappings
 * @module entity-schemas/schema-property-mapper
 */

/**
 * Analyze mapping status for a given Entity Schema
 * @param {Object} schema - Entity Schema with properties
 * @param {Array} mappedKeys - Current mapped keys from state
 * @returns {Object} Categorized mapping status
 */
export function getMappingStatus(schema, mappedKeys = []) {
    if (!schema?.properties) {
        return {
            requiredMapped: [],
            requiredUnmapped: [],
            optionalMapped: [],
            optionalUnmapped: [],
            progress: {
                required: { mapped: 0, total: 0, percentage: 100 },
                optional: { mapped: 0, total: 0, percentage: 0 }
            }
        };
    }

    const { required = [], optional = [] } = schema.properties;
    const mappedPropertyIds = new Set(
        mappedKeys.map(mapping => mapping.property?.id).filter(Boolean)
    );

    const requiredMapped = required.filter(prop => mappedPropertyIds.has(prop.id));
    const requiredUnmapped = required.filter(prop => !mappedPropertyIds.has(prop.id));
    const optionalMapped = optional.filter(prop => mappedPropertyIds.has(prop.id));
    const optionalUnmapped = optional.filter(prop => !mappedPropertyIds.has(prop.id));

    const progress = calculateProgress(
        requiredMapped.length,
        required.length,
        optionalMapped.length,
        optional.length
    );

    return {
        requiredMapped,
        requiredUnmapped,
        optionalMapped,
        optionalUnmapped,
        progress
    };
}

/**
 * Calculate progress percentages and generate progress text
 * @param {number} requiredMapped - Number of mapped required properties
 * @param {number} requiredTotal - Total number of required properties
 * @param {number} optionalMapped - Number of mapped optional properties
 * @param {number} optionalTotal - Total number of optional properties
 * @returns {Object} Progress data with percentages and text
 */
export function calculateProgress(requiredMapped, requiredTotal, optionalMapped, optionalTotal) {
    const requiredPercentage = requiredTotal > 0 ? Math.round((requiredMapped / requiredTotal) * 100) : 100;
    const optionalPercentage = optionalTotal > 0 ? Math.round((optionalMapped / optionalTotal) * 100) : 0;

    let requiredText;
    let requiredStatus;

    if (requiredTotal === 0) {
        requiredText = 'No required properties';
        requiredStatus = 'complete';
    } else if (requiredMapped === requiredTotal) {
        requiredText = '✓ All required mapped';
        requiredStatus = 'complete';
    } else {
        requiredText = `⚠ ${requiredMapped}/${requiredTotal} required mapped`;
        requiredStatus = 'incomplete';
    }

    const optionalText = optionalTotal > 0 ? `${optionalMapped}/${optionalTotal} optional` : 'No optional properties';

    return {
        required: {
            mapped: requiredMapped,
            total: requiredTotal,
            percentage: requiredPercentage,
            text: requiredText,
            status: requiredStatus
        },
        optional: {
            mapped: optionalMapped,
            total: optionalTotal,
            percentage: optionalPercentage,
            text: optionalText
        }
    };
}

/**
 * Detect if a property requires a source based on ShEx constraints
 * @param {string} constraint - ShEx constraint string
 * @returns {boolean} True if source is required
 */
export function detectSourceRequirement(constraint) {
    if (!constraint || typeof constraint !== 'string') {
        return false;
    }

    const lowerConstraint = constraint.toLowerCase();
    
    // Common patterns that indicate source requirements
    const sourcePatterns = [
        'prov:wasderivedfrom',
        'reference',
        'source',
        'citation',
        'wasDerivedFrom',
        'pr:',  // Property reference namespace
        'prov:', // Provenance namespace
        'stated in',
        'retrieved'
    ];

    return sourcePatterns.some(pattern => lowerConstraint.includes(pattern.toLowerCase()));
}

/**
 * Categorize all properties for easier rendering
 * @param {Object} schema - Entity Schema with properties
 * @param {Array} mappedKeys - Current mapped keys from state
 * @returns {Object} Categorized properties with mapping status
 */
export function categorizeProperties(schema, mappedKeys = []) {
    const mappingStatus = getMappingStatus(schema, mappedKeys);
    
    return {
        required: {
            mapped: mappingStatus.requiredMapped.map(prop => ({ ...prop, isMapped: true })),
            unmapped: mappingStatus.requiredUnmapped.map(prop => ({ ...prop, isMapped: false }))
        },
        optional: {
            mapped: mappingStatus.optionalMapped.map(prop => ({ ...prop, isMapped: true })),
            unmapped: mappingStatus.optionalUnmapped.map(prop => ({ ...prop, isMapped: false }))
        },
        progress: mappingStatus.progress
    };
}

/**
 * Generate a summary object for the collapsed view
 * @param {Object} schema - Entity Schema
 * @param {Object} progress - Progress data from calculateProgress
 * @returns {Object} Summary data for collapsed view
 */
export function generateSchemaSummary(schema, progress) {
    if (!schema) {
        return null;
    }

    return {
        id: schema.id,
        label: schema.label || `Entity Schema ${schema.id}`,
        url: schema.url || `https://www.wikidata.org/wiki/EntitySchema:${schema.id}`,
        requiredText: progress.required.text,
        requiredStatus: progress.required.status,
        optionalText: progress.optional.text,
        hasRequiredIssues: progress.required.status === 'incomplete',
        hasOptionalProperties: progress.optional.total > 0
    };
}

/**
 * Check if a specific property is mapped
 * @param {string} propertyId - Property ID to check (e.g., 'P31')
 * @param {Array} mappedKeys - Current mapped keys from state
 * @returns {boolean} True if property is mapped
 */
export function isPropertyMapped(propertyId, mappedKeys = []) {
    return mappedKeys.some(mapping => mapping.property?.id === propertyId);
}

/**
 * Get mapping details for a specific property
 * @param {string} propertyId - Property ID to get mapping for
 * @param {Array} mappedKeys - Current mapped keys from state
 * @returns {Object|null} Mapping object or null if not mapped
 */
export function getPropertyMapping(propertyId, mappedKeys = []) {
    return mappedKeys.find(mapping => mapping.property?.id === propertyId) || null;
}