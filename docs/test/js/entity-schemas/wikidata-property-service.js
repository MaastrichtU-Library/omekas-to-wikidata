/**
 * Wikidata Property Service
 * Fetches property labels and descriptions from Wikidata API
 * @module entity-schemas/wikidata-property-service
 */

// Cache property data to minimize API calls
const propertyCache = new Map();

/**
 * Batch fetch property labels and descriptions from Wikidata
 * @param {string[]} propertyIds - Array of property IDs (e.g., ['P31', 'P195'])
 * @returns {Promise<Object[]>} Array of property data objects
 */
export async function fetchPropertyData(propertyIds) {
    if (!propertyIds || propertyIds.length === 0) {
        return [];
    }

    // Ensure property IDs are unique and valid
    const uniqueIds = [...new Set(propertyIds.filter(id => id && id.match(/^P\d+$/)))];
    
    // Separate cached and uncached properties
    const result = [];
    const uncachedIds = [];
    
    for (const id of uniqueIds) {
        if (propertyCache.has(id)) {
            result.push(propertyCache.get(id));
        } else {
            uncachedIds.push(id);
        }
    }
    
    // If all properties are cached, return immediately
    if (uncachedIds.length === 0) {
        return result;
    }
    
    try {
        // Batch fetch uncached properties from Wikidata API
        // Split into chunks of 50 to avoid API limits
        const chunks = [];
        for (let i = 0; i < uncachedIds.length; i += 50) {
            chunks.push(uncachedIds.slice(i, i + 50));
        }
        
        for (const chunk of chunks) {
            const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels|descriptions&languages=en&format=json&origin=*`;
            
            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to fetch property data:', response.status);
                continue;
            }
            
            const data = await response.json();
            
            if (data.entities) {
                for (const [propId, entity] of Object.entries(data.entities)) {
                    // Handle missing entities
                    if (entity.missing !== undefined) {
                        const fallbackData = {
                            id: propId,
                            label: propId,
                            description: `Property ${propId}`,
                            url: `https://www.wikidata.org/wiki/Property:${propId}`
                        };
                        propertyCache.set(propId, fallbackData);
                        result.push(fallbackData);
                        continue;
                    }
                    
                    // Extract labels and descriptions
                    const propertyData = {
                        id: propId,
                        label: entity.labels?.en?.value || propId,
                        description: entity.descriptions?.en?.value || `Property ${propId}`,
                        url: `https://www.wikidata.org/wiki/Property:${propId}`
                    };
                    
                    // Cache the result
                    propertyCache.set(propId, propertyData);
                    result.push(propertyData);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching property data from Wikidata:', error);
        
        // Return fallback data for uncached properties
        for (const id of uncachedIds) {
            const fallbackData = {
                id: id,
                label: id,
                description: `Property ${id}`,
                url: `https://www.wikidata.org/wiki/Property:${id}`
            };
            propertyCache.set(id, fallbackData);
            result.push(fallbackData);
        }
    }
    
    // Sort results to match original order
    const idToData = new Map(result.map(item => [item.id, item]));
    return uniqueIds.map(id => idToData.get(id)).filter(Boolean);
}

/**
 * Get data for a single property
 * @param {string} propertyId - Property ID (e.g., 'P31')
 * @returns {Promise<Object>} Property data object
 */
export async function getPropertyData(propertyId) {
    if (propertyCache.has(propertyId)) {
        return propertyCache.get(propertyId);
    }
    
    const results = await fetchPropertyData([propertyId]);
    return results[0] || {
        id: propertyId,
        label: propertyId,
        description: `Property ${propertyId}`,
        url: `https://www.wikidata.org/wiki/Property:${propertyId}`
    };
}

/**
 * Pre-populate cache with common properties to reduce API calls
 */
export function preloadCommonProperties() {
    const commonProperties = {
        'P31': { id: 'P31', label: 'instance of', description: 'that class of which this subject is a particular example and member', url: 'https://www.wikidata.org/wiki/Property:P31' },
        'P195': { id: 'P195', label: 'collection', description: 'art, museum, archival, or bibliographic collection the subject is part of', url: 'https://www.wikidata.org/wiki/Property:P195' },
        'P217': { id: 'P217', label: 'inventory number', description: 'identifier for a physical object or a set of physical objects in a collection', url: 'https://www.wikidata.org/wiki/Property:P217' },
        'P1476': { id: 'P1476', label: 'title', description: 'published name of a work, such as a newspaper article, a literary work, piece of music, a website, or a performance work', url: 'https://www.wikidata.org/wiki/Property:P1476' },
        'P50': { id: 'P50', label: 'author', description: 'main creator(s) of a written work (use on works, not humans); use P2093 when Wikidata item is unknown or does not exist', url: 'https://www.wikidata.org/wiki/Property:P50' },
        'P123': { id: 'P123', label: 'publisher', description: 'organization or person responsible for publishing books, periodicals, printed music, podcasts, games or software', url: 'https://www.wikidata.org/wiki/Property:P123' },
        'P577': { id: 'P577', label: 'publication date', description: 'date or point in time when a work was first published or released', url: 'https://www.wikidata.org/wiki/Property:P577' },
        'P407': { id: 'P407', label: 'language of work or name', description: 'language associated with this creative work (such as books, shows, songs, broadcasts or websites) or a name (for persons use "native language" (P103) and "languages spoken, written or signed" (P1412))', url: 'https://www.wikidata.org/wiki/Property:P407' },
        'P212': { id: 'P212', label: 'ISBN-13', description: '13-digit International Standard Book Number', url: 'https://www.wikidata.org/wiki/Property:P212' },
        'P1104': { id: 'P1104', label: 'number of pages', description: 'number of pages in an edition of a written work', url: 'https://www.wikidata.org/wiki/Property:P1104' }
    };
    
    for (const [id, data] of Object.entries(commonProperties)) {
        propertyCache.set(id, data);
    }
}

/**
 * Clear the property cache
 */
export function clearPropertyCache() {
    propertyCache.clear();
}

// Initialize with common properties
preloadCommonProperties();