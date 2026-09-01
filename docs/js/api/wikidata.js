/**
 * Wikidata API module for fetching property information and constraints
 * @module api/wikidata
 */

// Cache for property information to avoid redundant API calls
const propertyCache = new Map();
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Fetches property information including datatype, label, and description
 * @param {string} propertyId - Wikidata property ID (e.g., 'P1476')
 * @returns {Promise<Object>} Property information object
 */
export async function getPropertyInfo(propertyId) {
    // Check cache first
    const cached = getCachedProperty(propertyId, 'info');
    if (cached) return cached;
    
    try {
        const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${propertyId}&props=datatype|labels|descriptions&languages=en&format=json&origin=*`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const entity = data.entities[propertyId];
        
        if (!entity || entity.missing) {
            throw new Error(`Property ${propertyId} not found`);
        }
        
        const propertyInfo = {
            id: propertyId,
            datatype: entity.datatype || 'unknown',
            datatypeLabel: formatDatatype(entity.datatype),
            label: entity.labels?.en?.value || 'No label',
            description: entity.descriptions?.en?.value || 'No description available'
        };
        
        // Cache the result
        setCachedProperty(propertyId, 'info', propertyInfo);
        
        return propertyInfo;
    } catch (error) {
        console.error(`Error fetching property info for ${propertyId}:`, error);
        throw error;
    }
}

/**
 * Fetches property information for multiple properties in a single batch call
 * @param {Array<string>} propertyIds - Array of Wikidata property IDs (e.g., ['P1476', 'P577'])
 * @returns {Promise<Object>} Object mapping property IDs to property information
 */
export async function getBatchPropertyInfo(propertyIds) {
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
        return {};
    }
    
    // Check cache for all properties first
    const cachedResults = {};
    const uncachedIds = [];
    
    for (const propertyId of propertyIds) {
        const cached = getCachedProperty(propertyId, 'info');
        if (cached) {
            cachedResults[propertyId] = cached;
        } else {
            uncachedIds.push(propertyId);
        }
    }
    
    // If all properties are cached, return immediately
    if (uncachedIds.length === 0) {
        return cachedResults;
    }
    
    try {
        // Build batch API URL with all uncached property IDs
        const idsParam = uncachedIds.join('|');
        const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${idsParam}&props=datatype|labels|descriptions&languages=en&format=json&origin=*`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const batchResults = { ...cachedResults };
        
        // Process each property in the batch response
        for (const propertyId of uncachedIds) {
            const entity = data.entities[propertyId];
            
            if (entity && !entity.missing) {
                const propertyInfo = {
                    id: propertyId,
                    datatype: entity.datatype || 'unknown',
                    datatypeLabel: formatDatatype(entity.datatype),
                    label: entity.labels?.en?.value || 'No label',
                    description: entity.descriptions?.en?.value || 'No description available'
                };
                
                // Cache the result
                setCachedProperty(propertyId, 'info', propertyInfo);
                batchResults[propertyId] = propertyInfo;
            } else {
                console.warn(`Property ${propertyId} not found in batch response`);
                // Create minimal fallback
                const fallbackInfo = {
                    id: propertyId,
                    datatype: 'unknown',
                    datatypeLabel: 'Unknown',
                    label: propertyId,
                    description: 'Property information not available'
                };
                batchResults[propertyId] = fallbackInfo;
            }
        }
        
        return batchResults;
    } catch (error) {
        console.error(`Error fetching batch property info for [${propertyIds.join(', ')}]:`, error);
        
        // Return cached results + fallbacks for failed properties
        const fallbackResults = { ...cachedResults };
        for (const propertyId of uncachedIds) {
            if (!fallbackResults[propertyId]) {
                fallbackResults[propertyId] = {
                    id: propertyId,
                    datatype: 'unknown',
                    datatypeLabel: 'Unknown',
                    label: propertyId,
                    description: 'Failed to fetch property information'
                };
            }
        }
        return fallbackResults;
    }
}

/**
 * Fetches property constraints including format regex and value type constraints
 * @param {string} propertyId - Wikidata property ID (e.g., 'P1476')
 * @returns {Promise<Object>} Constraints object with format, valueType, and other arrays
 */
export async function getPropertyConstraints(propertyId) {
    // Check cache first
    const cached = getCachedProperty(propertyId, 'constraints');
    if (cached) return cached;
    
    try {
        const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${propertyId}&property=P2302&format=json&origin=*`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const claims = data.claims?.P2302 || [];
        
        const constraints = {
            format: [],
            valueType: [],
            other: []
        };
        
        // Collect all Q-numbers that need labels
        const qNumbersToFetch = new Set();
        
        // Process each constraint claim
        for (const claim of claims) {
            // Skip deprecated constraints
            if (claim.rank === 'deprecated') {
                continue;
            }
            
            const constraintTypeId = claim.mainsnak?.datavalue?.value?.['numeric-id'];
            
            if (!constraintTypeId) continue;
            
            // Format constraint (Q21502404)
            if (constraintTypeId === 21502404) {
                const regexQualifiers = claim.qualifiers?.P1793 || [];
                const syntaxClarifications = claim.qualifiers?.P2916 || [];
                
                for (const regexQualifier of regexQualifiers) {
                    const regex = regexQualifier.datavalue?.value;
                    if (regex) {
                        // Look for English syntax clarification
                        let description = 'Format must match pattern';
                        for (const clarification of syntaxClarifications) {
                            if (clarification.datavalue?.value?.language === 'en') {
                                description = clarification.datavalue.value.text;
                                break;
                            }
                        }
                        
                        constraints.format.push({
                            regex: regex,
                            description: humanizeRegexDescription(regex, description),
                            rank: claim.rank || 'normal'
                        });
                    }
                }
            }
            // Value type constraint (Q21503250)
            else if (constraintTypeId === 21503250) {
                const classQualifiers = claim.qualifiers?.P2308 || [];
                const classIds = [];
                
                for (const classQualifier of classQualifiers) {
                    const classId = classQualifier.datavalue?.value?.['numeric-id'];
                    if (classId) {
                        const qId = `Q${classId}`;
                        classIds.push(qId);
                        qNumbersToFetch.add(qId);
                    }
                }
                
                if (classIds.length > 0) {
                    constraints.valueType.push({
                        classes: classIds,
                        classLabels: {}, // Will be filled below
                        rank: claim.rank || 'normal'
                    });
                }
            }
            // Other constraint types for future expansion
            else {
                constraints.other.push({
                    type: `Q${constraintTypeId}`,
                    rank: claim.rank || 'normal',
                    qualifiers: claim.qualifiers
                });
            }
        }
        
        // Fetch labels for all Q-numbers in value type constraints
        if (qNumbersToFetch.size > 0) {
            try {
                const labels = await fetchEntityLabels(Array.from(qNumbersToFetch));
                
                // Update value type constraints with labels
                constraints.valueType.forEach(constraint => {
                    constraint.classes.forEach(qId => {
                        if (labels[qId]) {
                            constraint.classLabels[qId] = labels[qId];
                        }
                    });
                });
            } catch (error) {
                console.error('Error fetching entity labels for constraints:', error);
                // Continue without labels - constraints will work but show Q-numbers
            }
        }
        
        // Cache the result
        setCachedProperty(propertyId, 'constraints', constraints);
        
        return constraints;
    } catch (error) {
        console.error(`Error fetching constraints for ${propertyId}:`, error);
        // Return empty constraints on error
        return {
            format: [],
            valueType: [],
            other: []
        };
    }
}

/**
 * Fetches labels for multiple Wikidata entities
 * @param {Array<string>} entityIds - Array of entity IDs (e.g., ['Q5', 'Q215627'])
 * @returns {Promise<Object>} Object mapping entity ID to label
 */
export async function fetchEntityLabels(entityIds) {
    if (!entityIds || entityIds.length === 0) {
        return {};
    }
    
    try {
        // Wikidata API can handle multiple entities at once (up to 50)
        const chunks = [];
        for (let i = 0; i < entityIds.length; i += 50) {
            chunks.push(entityIds.slice(i, i + 50));
        }
        
        const allLabels = {};
        
        for (const chunk of chunks) {
            const ids = chunk.join('|');
            const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=labels&languages=en&format=json&origin=*`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Extract labels from response
            for (const [entityId, entityData] of Object.entries(data.entities)) {
                if (entityData && entityData.labels && entityData.labels.en) {
                    allLabels[entityId] = entityData.labels.en.value;
                } else {
                    // Fallback to entity ID if no label found
                    allLabels[entityId] = entityId;
                }
            }
        }
        
        return allLabels;
    } catch (error) {
        console.error('Error fetching entity labels:', error);
        // Return fallback mapping
        const fallbackLabels = {};
        entityIds.forEach(id => {
            fallbackLabels[id] = id;
        });
        return fallbackLabels;
    }
}

/**
 * Fetches complete property data including info and constraints
 * @param {string} propertyId - Wikidata property ID (e.g., 'P1476')
 * @returns {Promise<Object>} Complete property data object
 */
export async function getCompletePropertyData(propertyId) {
    try {
        // Fetch both in parallel
        const [info, constraints] = await Promise.all([
            getPropertyInfo(propertyId),
            getPropertyConstraints(propertyId)
        ]);
        
        return {
            ...info,
            constraints: constraints,
            constraintsFetched: true,
            constraintsError: null
        };
    } catch (error) {
        console.error(`Error fetching complete property data for ${propertyId}:`, error);
        
        // Try to at least return property info if constraints fail
        try {
            const info = await getPropertyInfo(propertyId);
            return {
                ...info,
                constraints: {
                    format: [],
                    valueType: [],
                    other: []
                },
                constraintsFetched: true,
                constraintsError: error.message
            };
        } catch (infoError) {
            // If both fail, throw the original error
            throw error;
        }
    }
}

/**
 * Format datatype to user-friendly label
 * @param {string} datatype - Raw datatype from Wikidata API
 * @returns {string} User-friendly datatype label
 */
function formatDatatype(datatype) {
    const datatypeMap = {
        'wikibase-item': 'Wikidata item',
        'time': 'point in time',
        'monolingualtext': 'monolingual text',
        'external-id': 'external identifier',
        'string': 'text string',
        'url': 'URL',
        'quantity': 'quantity',
        'globe-coordinate': 'geographic coordinates',
        'commonsMedia': 'Commons media file',
        'wikibase-property': 'Wikidata property',
        'math': 'mathematical expression',
        'geo-shape': 'geographic shape',
        'musical-notation': 'musical notation',
        'tabular-data': 'tabular data',
        'wikibase-lexeme': 'lexeme',
        'wikibase-form': 'form',
        'wikibase-sense': 'sense'
    };
    
    return datatypeMap[datatype] || datatype;
}

/**
 * Convert regex pattern to human-readable description
 * @param {string} regex - Regular expression pattern
 * @param {string} fallbackDescription - Fallback description from API
 * @returns {string} Human-readable description
 */
function humanizeRegexDescription(regex, fallbackDescription) {
    // Check for common patterns
    if (regex.includes('<br') && regex.includes('<p>') && regex.includes('<i>')) {
        return 'Must not contain HTML tags like <br>, <i>, <em>, <p>';
    }
    
    if (regex === '[1-9]\\d*|') {
        return 'Must be a positive integer';
    }
    
    if (regex.includes('http') || regex.includes('https')) {
        return 'Must be a valid URL';
    }
    
    // If we have a clarification from the API, use it
    if (fallbackDescription && fallbackDescription !== 'Format must match pattern') {
        return fallbackDescription;
    }
    
    // Default to showing the pattern
    return `Must match pattern: ${regex}`;
}

/**
 * Get cached property data
 * @param {string} propertyId - Property ID
 * @param {string} type - Cache type ('info' or 'constraints')
 * @returns {Object|null} Cached data or null if not found/expired
 */
export function getCachedProperty(propertyId, type) {
    const cacheKey = `${propertyId}-${type}`;
    const cached = propertyCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        return cached.data;
    }
    
    // Remove expired cache
    if (cached) {
        propertyCache.delete(cacheKey);
    }
    
    return null;
}

/**
 * Set cached property data
 * @param {string} propertyId - Property ID
 * @param {string} type - Cache type ('info' or 'constraints')
 * @param {Object} data - Data to cache
 */
function setCachedProperty(propertyId, type, data) {
    const cacheKey = `${propertyId}-${type}`;
    propertyCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
    });
}

/**
 * Clear all cached property data
 */
export function clearPropertyCache() {
    propertyCache.clear();
}

/**
 * Get cache statistics for debugging
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
    return {
        size: propertyCache.size,
        entries: Array.from(propertyCache.keys())
    };
}