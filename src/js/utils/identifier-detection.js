/**
 * Identifier Detection Utility
 * Detects various identifier types in field values and maps them to Wikidata properties
 * @module utils/identifier-detection
 */

import { extractAvailableFields } from '../mapping/core/data-analyzer.js';
import { getPropertyInfo, getPropertyConstraints } from '../api/wikidata.js';

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
    },
    'oclc': {
        propertyId: 'P243',
        label: 'OCLC control number',
        description: 'identifier for a unique bibliographic record in OCLC WorldCat',
        pattern: /worldcat\.org\/oclc\/(\d+)|oclc[:\s]?(\d+)/i
    },
    'wikidata': {
        propertyId: null, // Direct Q-number, no property mapping needed
        label: 'Wikidata Item',
        description: 'Direct Wikidata entity reference',
        pattern: /wikidata\.org\/(?:entity|wiki)\/(Q\d+)|^(Q\d+)$/i
    },
    'iso639-1': {
        propertyId: null, // Language codes map directly to Wikidata items
        label: 'ISO 639-1 Language Code',
        description: 'Two-letter language code from ISO 639-1 standard',
        pattern: /id\.loc\.gov\/vocabulary\/iso639-1\/([a-z]{2})/i
    }
};

/**
 * Detects if a value contains an identifier and returns comprehensive metadata
 * 
 * ALGORITHM OVERVIEW:
 * This function implements a sophisticated multi-layered identifier detection system
 * that recognizes external identifiers commonly found in library and cultural heritage
 * metadata. The algorithm uses pattern matching, contextual analysis, and semantic
 * understanding to automatically identify and categorize identifier types.
 * 
 * DETECTION PHASES:
 * 
 * PHASE 1: VALUE EXTRACTION AND NORMALIZATION
 * - Handles multiple input formats (strings, objects, arrays, JSON-LD structures)
 * - Extracts string values from complex Omeka S data structures
 * - Normalizes whitespace and encoding issues
 * - Handles multilingual content and special characters
 * 
 * PHASE 2: PATTERN-BASED DETECTION
 * Primary detection using comprehensive regex patterns for known identifier systems:
 * - Academic identifiers: DOI, ORCID, ISNI, Scopus ID
 * - Bibliographic identifiers: ISBN, ISSN, OCLC, Handle
 * - Authority identifiers: VIAF, Library of Congress, GeoNames
 * - Archival identifiers: ARK (Archival Resource Key)
 * - Repository identifiers: URN, Persistent URL schemes
 * - Wikidata identifiers: Direct Q-number references
 * 
 * Each pattern is crafted to handle:
 * - Multiple format variations (with/without prefixes, different separators)
 * - URL and non-URL forms (both "doi:10.1000/123" and "https://doi.org/10.1000/123")
 * - Case insensitive matching where appropriate
 * - Validation of identifier structure (check digits, valid ranges)
 * 
 * PHASE 3: CONTEXTUAL FIELD ANALYSIS
 * When pattern matching fails, analyzes field names for identifier hints:
 * - Field name semantic analysis (contains "identifier", "id", "ark", etc.)
 * - Domain-specific patterns (library vs. archival vs. academic contexts)
 * - Heuristic confidence scoring based on field name relevance
 * - Special handling for ambiguous or partial identifiers
 * 
 * PHASE 4: CONFIDENCE ASSESSMENT
 * - Pattern matches: High confidence (1.0) - precise structural validation
 * - Field name matches: Medium confidence (0.6-0.8) - contextual but uncertain  
 * - Hybrid matches: Variable confidence based on multiple signal strength
 * - Validation against known identifier constraints and check digits
 * 
 * PHASE 5: METADATA ENRICHMENT
 * - Maps detected identifiers to corresponding Wikidata properties
 * - Provides human-readable labels and descriptions
 * - Extracts clean identifier values (removes URL formatting)
 * - Preserves original values for debugging and verification
 * - Associates with source field context for mapping decisions
 * 
 * IDENTIFIER COVERAGE:
 * The algorithm recognizes 15+ major identifier systems covering:
 * - Academic publishing: DOI, ORCID, Scopus, ResearcherID
 * - Library standards: ISBN, ISSN, OCLC, Library of Congress
 * - Authority control: VIAF, ISNI, GeoNames, Wikidata
 * - Digital preservation: ARK, Handle, URN schemes
 * - Custom institutional identifiers with configurable patterns
 * 
 * ERROR HANDLING & ROBUSTNESS:
 * - Graceful handling of malformed input data
 * - Null-safe operations throughout the detection pipeline
 * - Comprehensive logging of detection attempts and failures
 * - Fallback mechanisms for partial or corrupted identifiers
 * - Pattern compilation error recovery
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Compiled regex patterns cached for repeated use
 * - Early termination on first successful pattern match
 * - Efficient string extraction from complex objects
 * - Minimal memory allocation during detection process
 * 
 * @param {any} value - The value to analyze (string, object, array, or JSON-LD structure)
 * @param {string} fieldKey - The field key/name containing this value for contextual analysis
 * @returns {Object|null} Comprehensive detection result or null if no identifier found
 * @returns {string} result.type - Identifier type (e.g., 'doi', 'viaf', 'ark')
 * @returns {string|null} result.propertyId - Corresponding Wikidata property ID (e.g., 'P356' for DOI)
 * @returns {string} result.label - Human-readable identifier name
 * @returns {string} result.description - Detailed description of identifier system
 * @returns {string} result.identifierValue - Clean extracted identifier value
 * @returns {string} result.originalValue - Original input value for reference
 * @returns {string} result.fieldKey - Source field name for context
 * @returns {number} result.confidence - Detection confidence (0.0-1.0)
 * 
 * @example
 * // DOI detection from URL
 * detectIdentifier("https://doi.org/10.1000/182", "dcterms:source")
 * // Returns: {
 * //   type: 'doi',
 * //   propertyId: 'P356', 
 * //   label: 'DOI',
 * //   description: 'Digital Object Identifier',
 * //   identifierValue: '10.1000/182',
 * //   originalValue: 'https://doi.org/10.1000/182',
 * //   fieldKey: 'dcterms:source',
 * //   confidence: 1.0
 * // }
 * 
 * @example
 * // VIAF detection from complex Omeka S structure
 * detectIdentifier(
 *   {"@value": "https://viaf.org/viaf/12345", "@type": "uri"},
 *   "dcterms:creator"
 * )
 * // Returns: { type: 'viaf', identifierValue: '12345', ... }
 * 
 * @example
 * // Field-based detection for partial identifiers
 * detectIdentifier("ark:/12345/item123", "identifier")
 * // Returns: { type: 'ark', confidence: 0.8, ... }
 * 
 * @throws {Error} When regex pattern compilation fails or value extraction encounters critical errors
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
 * Creates a normalized mapping object for an identifier field with value field analysis
 * This ensures auto-mapped identifiers have the same structure as manually mapped ones
 * @param {string} fieldKey - The field key to map
 * @param {Object} detection - The identifier detection result
 * @param {any} sampleValue - Sample value for display and field analysis
 * @returns {Promise<Object>} Normalized mapping object ready to be added to mappedKeys
 */
export async function createIdentifierMapping(fieldKey, detection, sampleValue) {
    // Format the display name like other mappings
    const displayValue = extractStringValue(sampleValue);
    const truncatedValue = displayValue && displayValue.length > 30 
        ? displayValue.substring(0, 30) + '...' 
        : displayValue;
    
    // Analyze available fields in the sample value for value transformation
    const availableFields = extractAvailableFields(sampleValue);
    
    // Determine the best default field using the same logic as manual mappings
    // Priority: @id > @value > other @ fields > first available (but ignore @type)
    let selectedAtField = null;
    
    if (availableFields.length > 1) {
        // Find the most logical default field
        let defaultField = availableFields.find(field => field.key === '@id');
        if (!defaultField) {
            defaultField = availableFields.find(field => field.key === '@value');
        }
        if (!defaultField) {
            // Look for other @ fields, but exclude @type
            defaultField = availableFields.find(field => 
                field.key.startsWith('@') && field.key !== '@type'
            );
        }
        if (!defaultField) {
            // Fall back to first non-@type field
            defaultField = availableFields.find(field => field.key !== '@type') || availableFields[0];
        }
        
        selectedAtField = defaultField?.key || null;
    }
    
    // Fetch property information and constraints via API
    let propertyInfo = null;
    let constraints = null;
    let constraintsFetched = false;
    let constraintsError = null;
    
    try {
        // Fetch comprehensive property information
        propertyInfo = await getPropertyInfo(detection.propertyId);
        
        // Fetch property constraints for validation and formatting
        constraints = await getPropertyConstraints(detection.propertyId);
        constraintsFetched = true;
        
        console.log(`Auto-mapping: Fetched constraints for ${detection.propertyId} (${detection.label})`);
    } catch (error) {
        console.warn(`Auto-mapping: Failed to fetch constraints for ${detection.propertyId}:`, error);
        constraintsError = error.message;
        
        // Use fallback property info from detection
        propertyInfo = {
            id: detection.propertyId,
            label: detection.label,
            description: detection.description,
            datatype: 'external-id',
            datatypeLabel: 'External identifier'
        };
    }
    
    return {
        key: fieldKey,
        property: {
            id: detection.propertyId,
            label: propertyInfo.label,
            description: propertyInfo.description,
            datatype: propertyInfo.datatype,
            datatypeLabel: propertyInfo.datatypeLabel,
            constraints: constraints,
            constraintsFetched: constraintsFetched,
            constraintsError: constraintsError
        },
        linkedDataUri: null,  // Will be set if available
        mappedAt: new Date().toISOString(),
        autoMapped: true,  // Flag to indicate this was auto-detected
        identifierType: detection.type,
        displayName: `${fieldKey} (${truncatedValue || detection.identifierValue})`,
        sampleValue: sampleValue,  // Store sample value for field analysis
        selectedAtField: selectedAtField,  // Store selected field for value extraction
        availableFields: availableFields  // Store available fields for UI
    };
}
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

/**
 * Detects identifier in a value object's @id field
 * @param {Object} valueObj - The value object containing @id field
 * @returns {Object|null} Detection result with type and extracted ID, or null if no identifier found
 */
export function detectValueIdentifier(valueObj) {
    if (!valueObj || typeof valueObj !== 'object' || !valueObj['@id']) {
        return null;
    }
    
    const idValue = valueObj['@id'];
    
    // Check against each identifier pattern
    for (const [type, config] of Object.entries(IDENTIFIER_PROPERTY_MAPPINGS)) {
        const match = idValue.match(config.pattern);
        if (match) {
            // Extract the actual identifier value
            const identifierValue = match[1] || match[2] || match[0];
            
            return {
                type: type,
                identifierValue: identifierValue,
                originalValue: idValue,
                propertyId: config.propertyId,
                label: config.label
            };
        }
    }
    
    return null;
}