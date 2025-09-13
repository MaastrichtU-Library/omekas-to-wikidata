/**
 * Core Entity Schema functionality
 * Handles Entity Schema definitions, API calls, and ShEx parsing
 * @module entity-schemas/entity-schema-core
 */

import { detectSourceRequirement } from './schema-property-mapper.js';
import { parseShExCode } from './shex-parser.js';
import { fetchPropertyData } from './wikidata-property-service.js';

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
            properties: null, // Will be populated asynchronously
            loading: !!shexCode // Flag to indicate properties are loading
        };
        
        // Parse properties asynchronously if ShEx code is available
        if (shexCode) {
            schemaDetails.properties = await parseShExProperties(shexCode);
            schemaDetails.loading = false;
        }
        
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
 * Uses standards-compliant ShEx parser and enriches with Wikidata API data
 * 
 * @param {string} shexCode - ShEx code from Entity Schema
 * @param {Object} options - Parsing options (optional)
 * @param {boolean} options.strictMode - Throw errors on parsing failures (default: false)
 * @returns {Promise<Object>} Object with required and optional properties
 */
export async function parseShExProperties(shexCode, options = {}) {
    try {
        const parsed = parseShExCode(shexCode, {
            strictMode: options.strictMode || false,
            preserveComments: true
        });
        
        // Collect all property IDs for batch fetching
        const allPropertyIds = [
            ...parsed.properties.required.map(p => p.id),
            ...parsed.properties.optional.map(p => p.id)
        ];
        
        // Batch fetch property data from Wikidata API
        const propertyData = await fetchPropertyData(allPropertyIds);
        const propertyMap = new Map(propertyData.map(p => [p.id, p]));
        
        // Helper function to enrich property with API data
        const enrichProperty = (prop) => {
            const apiData = propertyMap.get(prop.id) || {};
            return {
                id: prop.id,
                label: apiData.label || prop.id, // Fallback to ID if no label
                description: apiData.description || `Property ${prop.id}`,
                url: apiData.url || `https://www.wikidata.org/wiki/Property:${prop.id}`,
                schemaComment: prop.schemaComment, // Preserve for tooltip
                constraint: prop.constraint,
                requiresSource: prop.requiresSource
            };
        };
        
        // Convert to expected format with enriched data
        const result = {
            required: parsed.properties.required.map(enrichProperty),
            optional: parsed.properties.optional.map(enrichProperty)
        };
        
        // Apply P31 fallback if no properties found
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
        console.error('ShEx parsing failed:', error);
        
        // Return P31 fallback on error (maintains app stability)
        return {
            required: [{
                id: 'P31',
                label: 'instance of',
                description: 'that class of which this subject is a particular example',
                url: 'https://www.wikidata.org/wiki/Property:P31',
                requiresSource: false
            }],
            optional: []
        };
    }
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