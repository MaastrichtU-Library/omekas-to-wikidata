/**
 * Identifier Detection Utility
 * Detects various identifier types in field values and maps them to Wikidata properties
 * @module utils/identifier-detection
 */

/**
 * Mapping of identifier types to their corresponding Wikidata properties
 */
export const IDENTIFIER_PROPERTY_MAPPINGS = {
    'ark': {
        propertyId: 'P8091',
        label: 'Archival Resource Key',
        description: 'identifier for a digital or physical object, conforming to the ARK identifier scheme',
        pattern: /ark:[\\/]?[0-9]+[\\/][0-9a-zA-Z._\-]+/i
    },
    'viaf': {
        propertyId: 'P214',
        label: 'VIAF ID',
        description: 'identifier for the Virtual International Authority File database',
        pattern: /viaf\.org\/viaf\/(\d+)|^viaf:(\d+)/i
    },
    'geonames': {
        propertyId: 'P1566',
        label: 'GeoNames ID',
        description: 'identifier in the GeoNames geographical database',
        pattern: /geonames\.org\/(\d+)|^geonames:(\d+)/i
    },
    'loc': {
        propertyId: 'P244',
        label: 'Library of Congress authority ID',
        description: 'Library of Congress name authority (persons, families, corporate bodies, events, places, works and expressions)',
        pattern: /id\.loc\.gov\/authorities\/\w+\/([a-z]+\d+)|^loc:([a-z]+\d+)/i
    },
    'orcid': {
        propertyId: 'P496',
        label: 'ORCID iD',
        description: 'identifier for a person or organization in the ORCID registry',
        pattern: /orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])|^orcid:(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])/i
    },
    'doi': {
        propertyId: 'P356',
        label: 'DOI',
        description: 'serial code used to uniquely identify digital objects',
        pattern: /doi\.org\/(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)|^doi:(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)/i
    },
    'isbn': {
        propertyId: 'P212',
        label: 'ISBN-13',
        description: '13-digit International Standard Book Number',
        pattern: /^(?:ISBN[-\s]?)?(?:97[89])[-\s]?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,6}[-\s]?\d$/i
    },
    'issn': {
        propertyId: 'P236',
        label: 'ISSN',
        description: 'International Standard Serial Number',
        pattern: /^(?:ISSN[-\s]?)?\d{4}[-\s]?\d{3}[\dX]$/i
    },
    'isni': {
        propertyId: 'P213',
        label: 'ISNI',
        description: 'International Standard Name Identifier',
        pattern: /isni\.org\/isni\/(\d{15}[\dX])|^isni:(\d{15}[\dX])/i
    },
    'handle': {
        propertyId: 'P1184',
        label: 'Handle ID',
        description: 'identifier for an item in the Handle system',
        pattern: /hdl\.handle\.net\/(\d+\/\S+)|^hdl:(\d+\/\S+)/i
    }
};

/**
 * Detects if a value contains an identifier and returns information about it
 * @param {any} value - The value to check for identifiers
 * @param {string} fieldKey - The field key/name containing this value
 * @returns {Object|null} Detection result with type, propertyId, and metadata, or null if no identifier found
 */
export function detectIdentifier(value, fieldKey) {
    if (!value) return null;
    
    // Extract string value from various formats
    let stringValue = extractStringValue(value);
    if (!stringValue) return null;
    
    // Check against each identifier pattern
    for (const [type, config] of Object.entries(IDENTIFIER_PROPERTY_MAPPINGS)) {
        const match = stringValue.match(config.pattern);
        if (match) {
            // Extract the actual identifier value (without URL parts)
            const identifierValue = match[1] || match[2] || match[0];
            
            return {
                type: type,
                propertyId: config.propertyId,
                label: config.label,
                description: config.description,
                identifierValue: identifierValue,
                originalValue: stringValue,
                fieldKey: fieldKey,
                confidence: 1.0  // High confidence for pattern matches
            };
        }
    }
    
    // Check field name hints for identifier types
    const fieldLower = fieldKey.toLowerCase();
    
    // ARK identifiers often in fields like "identifier" without full URL
    if ((fieldLower.includes('identifier') || fieldLower.includes('ark')) && 
        stringValue.includes('ark:')) {
        return {
            type: 'ark',
            propertyId: IDENTIFIER_PROPERTY_MAPPINGS.ark.propertyId,
            label: IDENTIFIER_PROPERTY_MAPPINGS.ark.label,
            description: IDENTIFIER_PROPERTY_MAPPINGS.ark.description,
            identifierValue: stringValue,
            originalValue: stringValue,
            fieldKey: fieldKey,
            confidence: 0.9
        };
    }
    
    // Check for ISBN-10 (convert to ISBN-13)
    const isbn10Pattern = /^(?:ISBN[-\s]?)?(?:\d{9}[\dX])$/i;
    if (isbn10Pattern.test(stringValue.replace(/[-\s]/g, ''))) {
        return {
            type: 'isbn',
            propertyId: IDENTIFIER_PROPERTY_MAPPINGS.isbn.propertyId,
            label: IDENTIFIER_PROPERTY_MAPPINGS.isbn.label,
            description: IDENTIFIER_PROPERTY_MAPPINGS.isbn.description,
            identifierValue: stringValue,
            originalValue: stringValue,
            fieldKey: fieldKey,
            confidence: 0.95,
            note: 'ISBN-10 detected, may need conversion to ISBN-13'
        };
    }
    
    return null;
}

/**
 * Detects all identifiers in an array or single value
 * @param {any} value - The value(s) to check
 * @param {string} fieldKey - The field key containing this value
 * @returns {Array} Array of detection results
 */
export function detectAllIdentifiers(value, fieldKey) {
    const results = [];
    
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            const detection = detectIdentifier(item, fieldKey);
            if (detection) {
                detection.arrayIndex = index;
                results.push(detection);
            }
        });
    } else {
        const detection = detectIdentifier(value, fieldKey);
        if (detection) {
            results.push(detection);
        }
    }
    
    return results;
}

/**
 * Extracts a string value from various Omeka S data formats
 * @param {any} value - The value to extract from
 * @returns {string|null} Extracted string or null
 */
function extractStringValue(value) {
    if (typeof value === 'string') {
        return value;
    }
    
    if (value && typeof value === 'object') {
        // Omeka S value object formats
        if (value['@value']) return String(value['@value']);
        if (value['o:label']) return String(value['o:label']);
        if (value['@id']) return String(value['@id']);
        if (value.value) return String(value.value);
        
        // For URI type objects
        if (value.type === 'uri' && value['@id']) {
            return String(value['@id']);
        }
    }
    
    return null;
}

/**
 * Creates a mapping object for an identifier field
 * @param {string} fieldKey - The field key to map
 * @param {Object} detection - The identifier detection result
 * @param {any} sampleValue - Sample value for display
 * @returns {Object} Mapping object ready to be added to mappedKeys
 */
export function createIdentifierMapping(fieldKey, detection, sampleValue) {
    // Format the display name like other mappings
    const displayValue = extractStringValue(sampleValue);
    const truncatedValue = displayValue && displayValue.length > 30 
        ? displayValue.substring(0, 30) + '...' 
        : displayValue;
    
    return {
        key: fieldKey,
        property: {
            id: detection.propertyId,
            label: detection.label,
            description: detection.description,
            datatype: 'external-id',  // Most identifiers are external IDs
            datatypeLabel: 'External identifier'
        },
        linkedDataUri: null,  // Will be set if available
        mappedAt: new Date().toISOString(),
        autoMapped: true,  // Flag to indicate this was auto-detected
        identifierType: detection.type,
        displayName: `${fieldKey} (${truncatedValue || detection.identifierValue})`
    };
}

/**
 * Analyzes all fields in the data for identifiers
 * @param {Array} items - Array of data items
 * @returns {Map} Map of fieldKey -> detection results
 */
export function analyzeFieldsForIdentifiers(items) {
    const identifierFields = new Map();
    
    if (!Array.isArray(items) || items.length === 0) {
        return identifierFields;
    }
    
    // Check each field in each item
    items.forEach(item => {
        if (typeof item !== 'object' || !item) return;
        
        Object.keys(item).forEach(key => {
            // Skip JSON-LD system keys
            if (key.startsWith('@')) return;
            
            // Skip if we already detected this field
            if (identifierFields.has(key)) return;
            
            const value = item[key];
            const detections = detectAllIdentifiers(value, key);
            
            if (detections.length > 0) {
                // Use the first detection as the primary
                identifierFields.set(key, {
                    detection: detections[0],
                    sampleValue: value,
                    multipleDetected: detections.length > 1
                });
            }
        });
    });
    
    return identifierFields;
}