/**
 * Data analysis module for Omeka S metadata processing
 * Handles JSON-LD data analysis, context resolution, and field extraction
 * @module mapping/core/data-analyzer
 */

// Import dependencies (minimal for data analysis)
import { detectIdentifier } from '../../utils/identifier-detection.js';

// Context cache for JSON-LD definitions
const contextCache = new Map();

/**
 * Fetches and caches JSON-LD context definitions from remote URLs
 * 
 * @param {string} contextUrl - URL to fetch context from
 * @returns {Promise<Map>} Map of prefix->URI mappings
 */
export async function fetchContextDefinitions(contextUrl) {
    if (contextCache.has(contextUrl)) {
        return contextCache.get(contextUrl);
    }
    
    try {
        const response = await fetch(contextUrl);
        const contextData = await response.json();
        
        const contextMap = new Map();
        
        // Handle nested @context structure
        let context = contextData;
        if (contextData['@context']) {
            context = contextData['@context'];
        }
        
        if (typeof context === 'object') {
            for (const [prefix, definition] of Object.entries(context)) {
                if (typeof definition === 'string') {
                    contextMap.set(prefix, definition);
                } else if (typeof definition === 'object' && definition['@id']) {
                    contextMap.set(prefix, definition['@id']);
                }
            }
        }
        
        contextCache.set(contextUrl, contextMap);
        return contextMap;
    } catch (error) {
        console.error(`Failed to fetch context from ${contextUrl}:`, error);
        return new Map();
    }
}

/**
 * Converts camelCase property names to human-readable spaced words
 * 
 * Used in the UI to make technical property names more user-friendly
 * when displaying Omeka S fields for mapping selection.
 * 
 * @param {string} text - camelCase text to convert
 * @returns {string} Text with spaces inserted before capital letters
 * 
 * @example
 * convertCamelCaseToSpaces("dctermsCreated") // "dcterms Created"
 * convertCamelCaseToSpaces("itemType") // "item Type"
 */
export function convertCamelCaseToSpaces(text) {
    // Insert space before uppercase letters that are preceded by lowercase letters or digits
    return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * Extracts sample values from complex Omeka S data structures for JSON display
 * 
 * This function has been updated to return full object/array structures rather than
 * extracted text values, enabling rich JSON visualization in the mapping interface.
 * This change supports the enhanced Stage 1 JSON display functionality.
 * 
 * Omeka S stores values in various formats (arrays, objects with @value annotations,
 * nested structures). This function preserves the original structure to enable
 * comprehensive data inspection and transformation planning.
 * 
 * @param {any} value - Raw value from Omeka S data structure
 * @returns {any|null} Full object/array structure or null if no meaningful content
 * 
 * @example
 * // Omeka S array format - returns first full object
 * extractSampleValue([{"@value": "Sample Title", "type": "literal"}]) 
 * // Returns: {"@value": "Sample Title", "type": "literal"}
 * 
 * // Omeka S object format - returns full object structure
 * extractSampleValue({"@value": "2023-01-01", "@type": "date"}) 
 * // Returns: {"@value": "2023-01-01", "@type": "date"}
 * 
 * @description
 * Returns full data structures to support:
 * - Rich JSON visualization in mapping interface
 * - Comprehensive understanding of data complexity
 * - Transformation planning based on complete structure
 * - Preservation of all metadata and type information
 */
export function extractSampleValue(value) {
    if (value === null || value === undefined) {
        return null;
    }
    
    // Handle arrays (common in Omeka S) - return first item as full object
    if (Array.isArray(value)) {
        if (value.length === 0) return null;
        return value[0]; // Return full first object, not extracted value
    }
    
    // Return the full object/value as-is for JSON display
    return value;
}

/**
 * Extracts and analyzes all property keys from Omeka S data with semantic context resolution
 * 
 * This is the core analysis function that processes raw Omeka S JSON-LD data to identify
 * all available properties for mapping. It performs sophisticated analysis including:
 * - Frequency analysis to identify common vs. rare properties
 * - JSON-LD context resolution to understand semantic meanings  
 * - Sample value extraction to help users understand property content
 * - URI generation for linked data compatibility
 * 
 * The frequency analysis is crucial because:
 * - Properties appearing in all items are likely core metadata (title, creator)
 * - Rare properties might be specialized fields needing careful mapping
 * - Missing properties in some items affect data completeness decisions
 * 
 * @param {Object|Array} data - Raw Omeka S data (single object or array of items)
 * @returns {Promise<Array>} Array of analyzed property objects with metadata
 * 
 * @example
 * const analysis = await extractAndAnalyzeKeys(omekaData);
 * // Returns: [{
 * //   key: "dcterms:title",
 * //   frequency: 25,        // appears in 25 out of 25 items
 * //   sampleValue: "Book Title",
 * //   linkedDataUri: "http://purl.org/dc/terms/title"
 * // }]
 * 
 * @description
 * Processing steps:
 * 1. Normalizes various Omeka S data formats into consistent item arrays
 * 2. Extracts and caches JSON-LD context definitions (with remote fetching)
 * 3. Counts property frequency across all items (ignoring @-prefixed JSON-LD system keys)
 * 4. Resolves prefixed properties to full URIs using context definitions
 * 5. Extracts sample values to help users understand property content
 * 6. Applies fallback URI generation for properties without explicit context
 */
export async function extractAndAnalyzeKeys(data) {
    const keyFrequency = new Map();
    const contextMap = new Map();
    let items = [];
    
    // Normalize data structure to get array of items
    // Omeka S can export data in different formats:
    // 1. Direct array of items (most common)
    // 2. Wrapper object with 'items' property
    // 3. Single item object (less common)
    if (Array.isArray(data)) {
        items = data;
    } else if (data.items && Array.isArray(data.items)) {
        items = data.items;
    } else if (typeof data === 'object') {
        items = [data];
    }
    
    // Extract context information from first item
    // JSON-LD context is essential for understanding property semantics
    // It maps short prefixes (like "dcterms") to full URIs
    if (items.length > 0 && items[0]['@context']) {
        const context = items[0]['@context'];
        
        // Handle both object and string contexts
        // Object contexts: direct prefix->URI mappings in the data
        // String contexts: URLs pointing to remote context definitions
        if (typeof context === 'object') {
            for (const [prefix, uri] of Object.entries(context)) {
                if (typeof uri === 'string') {
                    contextMap.set(prefix, uri);
                }
            }
        } else if (typeof context === 'string') {
            // Fetch remote context definitions
            const remoteContext = await fetchContextDefinitions(context);
            for (const [prefix, uri] of remoteContext) {
                contextMap.set(prefix, uri);
            }
        }
    }
    
    // Analyze all items to get key frequency
    // Frequency analysis reveals data patterns and helps prioritize mapping efforts:
    // - Properties in every item are core metadata (title, type)
    // - Properties in some items might be optional or specialized
    // - Very rare properties might be data entry errors or edge cases
    items.forEach(item => {
        if (typeof item === 'object' && item !== null) {
            Object.keys(item).forEach(key => {
                // Skip JSON-LD system keys (@context, @id, @type)
                // These are structural metadata, not content properties
                if (key.startsWith('@')) return;
                
                // Count all keys including o: keys - we'll categorize them later
                // o: prefix typically indicates Omeka-specific properties
                const count = keyFrequency.get(key) || 0;
                keyFrequency.set(key, count + 1);
            });
        }
    });
    
    // Convert to array and sort by frequency
    // Higher frequency properties appear first, making core metadata more prominent
    const keyAnalysis = Array.from(keyFrequency.entries())
        .map(([key, frequency]) => {
            // Get sample value from first item that has this key
            // Sample values help users understand what kind of data each property contains
            let sampleValue = null;
            let linkedDataUri = null;
            
            for (const item of items) {
                if (item[key] !== undefined) {
                    sampleValue = extractSampleValue(item[key]);
                    break;
                }
            }
            
            // Generate linked data URI from context
            // This is critical for semantic interoperability - we need full URIs
            // to understand what each property actually represents
            if (key.includes(':')) {
                // Handle prefixed properties (e.g., "dcterms:title")
                const [prefix, localName] = key.split(':', 2);
                const baseUri = contextMap.get(prefix);
                if (baseUri) {
                    // Handle different URI patterns used by various vocabularies:
                    // - Hash URIs: http://example.org/vocab# (common in RDF)
                    // - Slash URIs: http://example.org/vocab/ (common in REST APIs)
                    if (baseUri.endsWith('/') || baseUri.endsWith('#')) {
                        linkedDataUri = baseUri + localName;
                    } else {
                        linkedDataUri = baseUri + '/' + localName;
                    }
                }
            } else {
                // Fallback for properties without explicit prefixes
                // Many Omeka installations use common vocabularies without declaring context
                const commonPrefixes = {
                    'schema': 'https://schema.org/',        // Schema.org vocabulary
                    'dc': 'http://purl.org/dc/terms/',     // Dublin Core terms
                    'dcterms': 'http://purl.org/dc/terms/',
                    'foaf': 'http://xmlns.com/foaf/0.1/',  // Friend of a Friend
                    'skos': 'http://www.w3.org/2004/02/skos/core#' // SKOS vocabulary
                };
                
                // Pattern matching for common vocabulary prefixes
                // This helps when context is missing or incomplete
                for (const [prefix, uri] of Object.entries(commonPrefixes)) {
                    if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
                        const localName = key.substring(prefix.length);
                        linkedDataUri = uri + localName;
                        break;
                    }
                }
                
                // Check if there's a default namespace in the context
                // Empty string key indicates default namespace
                const defaultNs = contextMap.get('');
                if (defaultNs && !linkedDataUri) {
                    linkedDataUri = defaultNs + key;
                }
            }
            
            // Check if this field contains an identifier
            const identifierDetection = detectIdentifier(sampleValue, key);
            
            return {
                key,
                frequency,
                totalItems: items.length,
                sampleValue,
                linkedDataUri,
                type: Array.isArray(sampleValue) ? 'array' : typeof sampleValue,
                contextMap: contextMap,
                hasIdentifier: identifierDetection !== null,
                identifierInfo: identifierDetection
            };
        })
        .sort((a, b) => b.frequency - a.frequency); // Sort by frequency descending
    
    return keyAnalysis;
}

/**
 * Extracts available fields from a sample value for transformation configuration
 * @param {*} sampleValue - The sample value to analyze
 * @returns {Array} Array of field objects with key and preview
 */
export function extractAvailableFields(sampleValue) {
    if (!sampleValue || typeof sampleValue !== 'object') {
        return [{ key: '_value', preview: String(sampleValue || 'N/A') }];
    }

    // Handle arrays - get fields from first object
    if (Array.isArray(sampleValue)) {
        if (sampleValue.length === 0) return [{ key: '_value', preview: 'Empty Array' }];
        return extractAvailableFields(sampleValue[0]);
    }

    // Extract fields from object
    const fields = [];
    Object.entries(sampleValue).forEach(([key, value]) => {
        let preview = '';
        if (value === null || value === undefined) {
            preview = 'null';
        } else if (typeof value === 'string') {
            preview = value.length > 30 ? `${value.substring(0, 30)}...` : value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            preview = String(value);
        } else {
            preview = '[Object/Array]';
        }
        
        fields.push({ key, preview });
    });

    return fields.length > 0 ? fields : [{ key: '_value', preview: 'No fields available' }];
}

/**
 * Gets the value of a specific field from the sample value
 * @param {*} sampleValue - The sample value object
 * @param {string} fieldKey - The field key to extract
 * @returns {string} String representation of the field value
 */
export function getFieldValueFromSample(sampleValue, fieldKey) {
    if (!sampleValue || fieldKey === '_value') {
        return convertSampleValueToString(sampleValue);
    }

    // Handle arrays
    if (Array.isArray(sampleValue)) {
        if (sampleValue.length === 0) return '';
        return getFieldValueFromSample(sampleValue[0], fieldKey);
    }

    // Handle objects
    if (typeof sampleValue === 'object' && sampleValue[fieldKey] !== undefined) {
        return convertSampleValueToString(sampleValue[fieldKey]);
    }

    return '';
}

/**
 * Converts a sample value to a string suitable for transformation preview
 * Uses Omeka S type-aware extraction for meaningful values
 * @param {*} value - The sample value (can be object, array, string, etc.)
 * @returns {string} String representation for transformation
 */
export function convertSampleValueToString(value) {
    if (value === null || value === undefined) {
        return '';
    }

    // If it's already a string, return it
    if (typeof value === 'string') {
        return value;
    }

    // If it's a primitive value, convert to string
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
        if (value.length === 0) return '';
        
        // Get first value and convert to string
        const firstValue = value[0];
        return convertSampleValueToString(firstValue);
    }

    // Handle Omeka S objects with type-aware extraction
    if (value && typeof value === 'object') {
        // Type-aware value extraction for Omeka S
        if (value.type && typeof value.type === 'string') {
            switch (true) {
                // Literal values - use @value
                case value.type === 'literal':
                case value.type === 'numeric:timestamp':
                    if ('@value' in value && value['@value'] !== null && value['@value'] !== undefined) {
                        return String(value['@value']);
                    }
                    break;
                
                // Value suggest types - use o:label (human-readable label)
                case value.type.startsWith('valuesuggest:'):
                    if ('o:label' in value && value['o:label'] !== null && value['o:label'] !== undefined) {
                        return String(value['o:label']);
                    }
                    break;
                
                // URI types - prefer o:label, fallback to @id
                case value.type === 'uri':
                    if ('o:label' in value && value['o:label'] !== null && value['o:label'] !== undefined) {
                        return String(value['o:label']);
                    }
                    if ('@id' in value && value['@id'] !== null && value['@id'] !== undefined) {
                        return String(value['@id']);
                    }
                    break;
            }
        }
        
        // Fallback to standard property extraction for non-typed objects
        const valueProps = ['@value', 'o:label', 'value', 'name', 'title', 'label', 'display_title'];
        for (const prop of valueProps) {
            if (prop in value && value[prop] !== null && value[prop] !== undefined) {
                return convertSampleValueToString(value[prop]);
            }
        }
        
        // Look for @id as last resort for URIs
        if ('@id' in value && value['@id'] !== null && value['@id'] !== undefined) {
            return String(value['@id']);
        }
        
        // If no known property found, look for any string values
        const entries = Object.entries(value);
        for (const [key, val] of entries) {
            if (typeof val === 'string' && val.trim() !== '' && !key.startsWith('property_') && key !== 'type') {
                return val;
            }
        }
        
        // As a last resort, stringify the object in a readable way
        try {
            return JSON.stringify(value);
        } catch (e) {
            return '[Complex Object]';
        }
    }

    // Fallback for any other types
    return String(value);
}