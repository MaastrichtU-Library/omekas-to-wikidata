/**
 * Core Entity Schema functionality
 * Handles Entity Schema definitions, API calls, and ShEx parsing
 * @module entity-schemas/entity-schema-core
 */

import { detectSourceRequirement } from './schema-property-mapper.js';
import { parseShExCode } from './shex-parser.js';

/**
 * Default Entity Schemas for the application
 */
export const DEFAULT_SCHEMAS = [
    {
        id: 'E473',
        label: 'Edition or translation of a written work, Maastricht University Library',
        description: 'Items held in Maastricht University Library collections',
        url: 'https://www.wikidata.org/wiki/EntitySchema:E473'
    },
    {
        id: 'E487', 
        label: 'Edition or translation of a written work, Radboud University Library',
        description: 'Items held in Radboud University Library collections',
        url: 'https://www.wikidata.org/wiki/EntitySchema:E487'
    },
    {
        id: 'E476',
        label: 'Manuscript',
        description: 'Handwritten documents, illuminated manuscripts',
        url: 'https://www.wikidata.org/wiki/EntitySchema:E476'
    },
    {
        id: 'E488',
        label: 'Incunable', 
        description: 'Printed works before 1501',
        url: 'https://www.wikidata.org/wiki/EntitySchema:E488'
    }
];

/**
 * Cache for Entity Schema data to avoid redundant API calls
 */
const entitySchemaCache = new Map();

/**
 * Search Entity Schemas on Wikidata
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of entity schema results
 */
export async function searchEntitySchemas(query) {
    try {
        // Check cache first
        const cacheKey = `search_${query.toLowerCase()}`;
        if (entitySchemaCache.has(cacheKey)) {
            return entitySchemaCache.get(cacheKey);
        }

        let schemaResults = [];

        // Method 1: Direct lookup if query looks like an E-identifier
        if (query.match(/^E\d+$/i)) {
            try {
                const directResult = await fetchEntitySchemaDetails(query.toUpperCase());
                if (directResult) {
                    schemaResults = [directResult];
                }
            } catch (e) {
                console.error('Direct entity lookup failed:', e);
            }
        }

        // Method 2: Search in Entity Schema namespace (640) for text queries
        if (schemaResults.length === 0) {
            const searchUrl = `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=640&srlimit=20&format=json&origin=*`;
            
            const response = await fetch(searchUrl);
            const data = await response.json();

            if (data.query && data.query.search && data.query.search.length > 0) {
                schemaResults = data.query.search
                    .filter(item => item.title.match(/^EntitySchema:E\d+$/))
                    .slice(0, 10)
                    .map(item => {
                        const id = item.title.replace('EntitySchema:', '');
                        const snippet = item.snippet ? item.snippet.replace(/<[^>]+>/g, '') : '';
                        return {
                            id: id,
                            label: item.title.replace('EntitySchema:', '') || `Entity Schema ${id}`,
                            description: snippet || `Entity Schema ${id}`,
                            url: `https://www.wikidata.org/wiki/EntitySchema:${id}`
                        };
                    });
            }
        }

        // Cache results
        entitySchemaCache.set(cacheKey, schemaResults);
        
        return schemaResults;
        
    } catch (error) {
        console.error('Search error:', error);
        throw new Error(`Entity Schema search failed: ${error.message}`);
    }
}

/**
 * Fetch detailed Entity Schema information from Wikidata
 * @param {string} schemaId - Entity Schema ID (e.g., 'E473')
 * @returns {Promise<Object|null>} Entity Schema details or null if not found
 */
export async function fetchEntitySchemaDetails(schemaId) {
    try {
        // Check cache first
        if (entitySchemaCache.has(schemaId)) {
            return entitySchemaCache.get(schemaId);
        }

        console.log('Fetching Entity Schema details for:', schemaId);
        
        // Method 1: Use MediaWiki parse API to get structured data
        const parseUrl = `https://www.wikidata.org/w/api.php?action=parse&page=EntitySchema:${schemaId}&format=json&origin=*&prop=text|displaytitle`;
        
        const parseResponse = await fetch(parseUrl);
        
        let label = `Entity Schema ${schemaId}`;
        let description = `Entity Schema ${schemaId}`;
        
        if (parseResponse.ok) {
            const parseData = await parseResponse.json();
            
            if (parseData.parse) {
                // Extract label from displaytitle or parse the HTML
                if (parseData.parse.displaytitle) {
                    label = parseData.parse.displaytitle.replace(/<[^>]*>/g, '');
                }
                
                // Try to extract label and description from the parsed HTML
                if (parseData.parse.text && parseData.parse.text['*']) {
                    const htmlContent = parseData.parse.text['*'];
                    
                    // Look for label pattern in the HTML
                    const labelMatch = htmlContent.match(/<th[^>]*>Label<\/th>\s*<td[^>]*>([^<]+)<\/td>/i) ||
                                     htmlContent.match(/<span[^>]*class="[^"]*wb-itemlink-label[^"]*"[^>]*>([^<]+)<\/span>/i);
                    
                    if (labelMatch) {
                        label = labelMatch[1].trim();
                    }
                    
                    // Look for description pattern in the HTML
                    const descMatch = htmlContent.match(/<th[^>]*>Description<\/th>\s*<td[^>]*>([^<]+)<\/td>/i) ||
                                    htmlContent.match(/<span[^>]*class="[^"]*wb-itemlink-description[^"]*"[^>]*>([^<]+)<\/span>/i);
                    
                    if (descMatch) {
                        description = descMatch[1].trim();
                    }
                }
            }
        }
        
        // Fetch ShEx code
        let shexCode = null;
        try {
            const shexUrl = `https://www.wikidata.org/wiki/Special:EntitySchemaText/${schemaId}`;
            const shexResponse = await fetch(shexUrl);
            if (shexResponse.ok) {
                shexCode = await shexResponse.text();
            }
        } catch (e) {
            console.log('Could not fetch ShEx code:', e);
        }
        
        const schemaDetails = {
            id: schemaId,
            label: label,
            description: description,
            url: `https://www.wikidata.org/wiki/EntitySchema:${schemaId}`,
            shexCode: shexCode,
            properties: shexCode ? parseShExProperties(shexCode) : null
        };
        
        // Cache the result
        entitySchemaCache.set(schemaId, schemaDetails);
        
        return schemaDetails;
        
    } catch (e) {
        console.error('Error fetching schema:', e);
        return null;
    }
}

/**
 * Parse ShEx code to extract property information
 * Enhanced with backwards-compatible dual parser implementation
 * 
 * @param {string} shexCode - ShEx code from Entity Schema  
 * @param {Object} options - Parsing options (optional)
 * @param {boolean} options.useNewParser - Use new parser (default: false for backwards compatibility)
 * @param {boolean} options.strictMode - Throw errors on parsing failures (default: false)
 * @param {boolean} options.enableFallback - Enable fallback to legacy parser (default: true)
 * @returns {Object} Object with required and optional properties
 */
export function parseShExProperties(shexCode, options = {}) {
    const opts = {
        useNewParser: false, // Default to legacy for backwards compatibility
        strictMode: false,
        enableFallback: true,
        ...options
    };
    
    // NEW PARSER PATH
    if (opts.useNewParser) {
        try {
            const parsed = parseShExCode(shexCode, {
                strictMode: opts.strictMode,
                preserveComments: true
            });
            
            // Convert new parser format to legacy format for backwards compatibility
            const result = {
                required: parsed.properties.required.map(prop => ({
                    id: prop.id,
                    label: prop.label,
                    description: prop.description, 
                    url: prop.url,
                    requiresSource: prop.requiresSource
                })),
                optional: parsed.properties.optional.map(prop => ({
                    id: prop.id,
                    label: prop.label,
                    description: prop.description,
                    url: prop.url,
                    requiresSource: prop.requiresSource
                }))
            };
            
            // Apply legacy fallback behavior if no properties found
            if (result.required.length === 0 && result.optional.length === 0) {
                result.required.push({
                    id: 'P31',
                    label: 'instance of', 
                    description: 'that class of which this subject is a particular example',
                    url: 'https://www.wikidata.org/wiki/Property:P31',
                    requiresSource: false
                });
            }
            
            return result;
            
        } catch (error) {
            console.warn('New ShEx parser failed:', error);
            
            if (!opts.enableFallback) {
                throw error;
            }
            
            console.log('Falling back to legacy parser for backwards compatibility');
            // Continue to legacy parser below
        }
    }
    
    // LEGACY PARSER PATH (EXACT ORIGINAL IMPLEMENTATION)
    // This is the original parseShExProperties function preserved for backwards compatibility
    return parseShExPropertiesLegacy(shexCode);
}

/**
 * Legacy ShEx parser implementation
 * EXACT copy of original parseShExProperties for backwards compatibility
 * DO NOT MODIFY - used as fallback and reference implementation
 * 
 * @param {string} shexCode - ShEx code from Entity Schema
 * @returns {Object} Object with required and optional properties
 */
function parseShExPropertiesLegacy(shexCode) {
    const requiredProperties = [];
    const optionalProperties = [];
    
    // Parse properties from ShEx code
    const propertyMatches = shexCode.match(/wdt:(\w+)\s+([^;]+);?\s*(?:#\s*(.*))?/g);
    
    if (propertyMatches) {
        propertyMatches.forEach(match => {
            const propMatch = match.match(/wdt:(\w+)\s+([^;]+);?\s*(?:#\s*(.*))?/);
            if (propMatch) {
                const propertyId = propMatch[1];
                const constraint = propMatch[2].trim();
                const comment = propMatch[3] ? propMatch[3].trim() : '';
                
                const property = {
                    id: propertyId,
                    label: comment || propertyId,
                    description: `Constraint: ${constraint}`,
                    url: `https://www.wikidata.org/wiki/Property:${propertyId}`,
                    requiresSource: detectSourceRequirement(constraint)
                };
                
                // Determine if required (no ? or *)
                if (constraint.includes('?') || constraint.includes('*')) {
                    optionalProperties.push(property);
                } else {
                    requiredProperties.push(property);
                }
            }
        });
    }
    
    // If no properties were parsed, add fallback
    if (requiredProperties.length === 0 && optionalProperties.length === 0) {
        requiredProperties.push({
            id: 'P31',
            label: 'instance of',
            description: 'that class of which this subject is a particular example',
            url: 'https://www.wikidata.org/wiki/Property:P31',
            requiresSource: false
        });
    }
    
    return {
        required: requiredProperties,
        optional: optionalProperties
    };
}

/**
 * Get Entity Schema by ID, trying cache first, then default schemas, then API
 * @param {string} schemaId - Entity Schema ID
 * @returns {Promise<Object|null>} Entity Schema details
 */
export async function getEntitySchema(schemaId) {
    // Check cache first
    if (entitySchemaCache.has(schemaId)) {
        return entitySchemaCache.get(schemaId);
    }
    
    // Check default schemas
    const defaultSchema = DEFAULT_SCHEMAS.find(schema => schema.id === schemaId);
    if (defaultSchema) {
        // Fetch full details for default schema
        return await fetchEntitySchemaDetails(schemaId);
    }
    
    // Fallback to API
    return await fetchEntitySchemaDetails(schemaId);
}

/**
 * Clear Entity Schema cache
 */
export function clearEntitySchemaCache() {
    entitySchemaCache.clear();
}