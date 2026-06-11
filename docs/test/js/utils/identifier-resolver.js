/**
 * Identifier Resolution Service
 * Resolves various identifier types to Wikidata items using SPARQL queries
 * @module utils/identifier-resolver
 */

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

/**
 * Cache for resolved identifiers to avoid redundant SPARQL queries
 */
const resolutionCache = new Map();

/**
 * Execute SPARQL query against Wikidata
 * @param {string} query - SPARQL query
 * @returns {Promise<Object>} Query results
 */
async function executeSparqlQuery(query) {
    const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json',
                'User-Agent': 'OmekaS-to-Wikidata-Converter/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`SPARQL query failed: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('SPARQL query error:', error);
        throw error;
    }
}

/**
 * Resolve VIAF identifier to Wikidata item
 * @param {string} viafId - VIAF identifier
 * @returns {Promise<string|null>} Wikidata Q-number or null
 */
export async function resolveVIAFToWikidata(viafId) {
    const cacheKey = `viaf:${viafId}`;
    if (resolutionCache.has(cacheKey)) {
        return resolutionCache.get(cacheKey);
    }
    
    const query = `
        SELECT ?item WHERE {
            ?item wdt:P214 "${viafId}" .
        }
        LIMIT 1
    `;
    
    try {
        const result = await executeSparqlQuery(query);
        if (result.results?.bindings?.length > 0) {
            const itemUri = result.results.bindings[0].item.value;
            const qNumber = itemUri.split('/').pop();
            resolutionCache.set(cacheKey, qNumber);
            return qNumber;
        }
    } catch (error) {
        console.error(`Failed to resolve VIAF ${viafId}:`, error);
    }
    
    resolutionCache.set(cacheKey, null);
    return null;
}

/**
 * Resolve GeoNames identifier to Wikidata item
 * @param {string} geonamesId - GeoNames identifier
 * @returns {Promise<string|null>} Wikidata Q-number or null
 */
export async function resolveGeoNamesToWikidata(geonamesId) {
    const cacheKey = `geonames:${geonamesId}`;
    if (resolutionCache.has(cacheKey)) {
        return resolutionCache.get(cacheKey);
    }
    
    const query = `
        SELECT ?item WHERE {
            ?item wdt:P1566 "${geonamesId}" .
        }
        LIMIT 1
    `;
    
    try {
        const result = await executeSparqlQuery(query);
        if (result.results?.bindings?.length > 0) {
            const itemUri = result.results.bindings[0].item.value;
            const qNumber = itemUri.split('/').pop();
            resolutionCache.set(cacheKey, qNumber);
            return qNumber;
        }
    } catch (error) {
        console.error(`Failed to resolve GeoNames ${geonamesId}:`, error);
    }
    
    resolutionCache.set(cacheKey, null);
    return null;
}

/**
 * Resolve OCLC identifier to Wikidata item
 * @param {string} oclcId - OCLC identifier
 * @returns {Promise<string|null>} Wikidata Q-number or null
 */
export async function resolveOCLCToWikidata(oclcId) {
    const cacheKey = `oclc:${oclcId}`;
    if (resolutionCache.has(cacheKey)) {
        return resolutionCache.get(cacheKey);
    }
    
    const query = `
        SELECT ?item WHERE {
            ?item wdt:P243 "${oclcId}" .
        }
        LIMIT 1
    `;
    
    try {
        const result = await executeSparqlQuery(query);
        if (result.results?.bindings?.length > 0) {
            const itemUri = result.results.bindings[0].item.value;
            const qNumber = itemUri.split('/').pop();
            resolutionCache.set(cacheKey, qNumber);
            return qNumber;
        }
    } catch (error) {
        console.error(`Failed to resolve OCLC ${oclcId}:`, error);
    }
    
    resolutionCache.set(cacheKey, null);
    return null;
}

/**
 * Resolve Library of Congress identifier to Wikidata item
 * @param {string} locId - Library of Congress identifier
 * @returns {Promise<string|null>} Wikidata Q-number or null
 */
export async function resolveLocToWikidata(locId) {
    const cacheKey = `loc:${locId}`;
    if (resolutionCache.has(cacheKey)) {
        return resolutionCache.get(cacheKey);
    }
    
    const query = `
        SELECT ?item WHERE {
            ?item wdt:P244 "${locId}" .
        }
        LIMIT 1
    `;
    
    try {
        const result = await executeSparqlQuery(query);
        if (result.results?.bindings?.length > 0) {
            const itemUri = result.results.bindings[0].item.value;
            const qNumber = itemUri.split('/').pop();
            resolutionCache.set(cacheKey, qNumber);
            return qNumber;
        }
    } catch (error) {
        console.error(`Failed to resolve LoC ${locId}:`, error);
    }
    
    resolutionCache.set(cacheKey, null);
    return null;
}

/**
 * Resolve ORCID identifier to Wikidata item
 * @param {string} orcidId - ORCID identifier
 * @returns {Promise<string|null>} Wikidata Q-number or null
 */
export async function resolveORCIDToWikidata(orcidId) {
    const cacheKey = `orcid:${orcidId}`;
    if (resolutionCache.has(cacheKey)) {
        return resolutionCache.get(cacheKey);
    }
    
    const query = `
        SELECT ?item WHERE {
            ?item wdt:P496 "${orcidId}" .
        }
        LIMIT 1
    `;
    
    try {
        const result = await executeSparqlQuery(query);
        if (result.results?.bindings?.length > 0) {
            const itemUri = result.results.bindings[0].item.value;
            const qNumber = itemUri.split('/').pop();
            resolutionCache.set(cacheKey, qNumber);
            return qNumber;
        }
    } catch (error) {
        console.error(`Failed to resolve ORCID ${orcidId}:`, error);
    }
    
    resolutionCache.set(cacheKey, null);
    return null;
}

/**
 * Resolve ISNI identifier to Wikidata item
 * @param {string} isniId - ISNI identifier
 * @returns {Promise<string|null>} Wikidata Q-number or null
 */
export async function resolveISNIToWikidata(isniId) {
    const cacheKey = `isni:${isniId}`;
    if (resolutionCache.has(cacheKey)) {
        return resolutionCache.get(cacheKey);
    }
    
    const query = `
        SELECT ?item WHERE {
            ?item wdt:P213 "${isniId}" .
        }
        LIMIT 1
    `;
    
    try {
        const result = await executeSparqlQuery(query);
        if (result.results?.bindings?.length > 0) {
            const itemUri = result.results.bindings[0].item.value;
            const qNumber = itemUri.split('/').pop();
            resolutionCache.set(cacheKey, qNumber);
            return qNumber;
        }
    } catch (error) {
        console.error(`Failed to resolve ISNI ${isniId}:`, error);
    }
    
    resolutionCache.set(cacheKey, null);
    return null;
}

/**
 * Resolve Wikidata identifier (returns as-is)
 * @param {string} qNumber - Wikidata Q-number
 * @returns {Promise<string>} Same Q-number
 */
export async function resolveWikidataId(qNumber) {
    // Direct Wikidata reference, return as-is
    return qNumber;
}

/**
 * Map of known license URLs to Wikidata items
 */
const LICENSE_MAPPING = {
    'https://www.wikidata.org/wiki/Q20007257': 'Q20007257', // CC-BY 4.0
    'https://creativecommons.org/licenses/by/4.0/': 'Q20007257', // CC-BY 4.0
    'https://creativecommons.org/licenses/by-sa/4.0/': 'Q18199165', // CC-BY-SA 4.0
    'https://creativecommons.org/licenses/by-nc/4.0/': 'Q34179348', // CC-BY-NC 4.0
    'https://creativecommons.org/licenses/by-nc-sa/4.0/': 'Q42553662', // CC-BY-NC-SA 4.0
    'https://creativecommons.org/licenses/by-nd/4.0/': 'Q36795408', // CC-BY-ND 4.0
    'https://creativecommons.org/publicdomain/zero/1.0/': 'Q6938433', // CC0
};

/**
 * Map of ISO 639-1 language codes to Wikidata items
 */
const LANGUAGE_MAPPING = {
    'http://id.loc.gov/vocabulary/iso639-1/en': 'Q1860', // English
    'http://id.loc.gov/vocabulary/iso639-1/nl': 'Q7411', // Dutch
    'http://id.loc.gov/vocabulary/iso639-1/de': 'Q188', // German
    'http://id.loc.gov/vocabulary/iso639-1/fr': 'Q150', // French
    'http://id.loc.gov/vocabulary/iso639-1/es': 'Q1321', // Spanish
    'http://id.loc.gov/vocabulary/iso639-1/it': 'Q652', // Italian
    'http://id.loc.gov/vocabulary/iso639-1/pt': 'Q5146', // Portuguese
    'http://id.loc.gov/vocabulary/iso639-1/ru': 'Q7737', // Russian
    'http://id.loc.gov/vocabulary/iso639-1/zh': 'Q7850', // Chinese
    'http://id.loc.gov/vocabulary/iso639-1/ja': 'Q5287', // Japanese
    'http://id.loc.gov/vocabulary/iso639-1/ar': 'Q13955', // Arabic
    'http://id.loc.gov/vocabulary/iso639-1/ko': 'Q9176', // Korean
};

/**
 * Main dispatcher to resolve identifier to Wikidata item
 * @param {string} identifierType - Type of identifier detected
 * @param {string} identifierValue - The identifier value
 * @param {string} originalUrl - The original URL/ID value
 * @returns {Promise<string|null>} Wikidata Q-number or null
 */
export async function resolveIdentifierToWikidata(identifierType, identifierValue, originalUrl = null) {
    // Check for known license mappings first
    if (originalUrl && LICENSE_MAPPING[originalUrl]) {
        return LICENSE_MAPPING[originalUrl];
    }
    
    // Check for language code mappings
    if (originalUrl && LANGUAGE_MAPPING[originalUrl]) {
        return LANGUAGE_MAPPING[originalUrl];
    }
    
    // Dispatch based on identifier type
    switch (identifierType) {
        case 'viaf':
            return await resolveVIAFToWikidata(identifierValue);
        case 'geonames':
            return await resolveGeoNamesToWikidata(identifierValue);
        case 'oclc':
            return await resolveOCLCToWikidata(identifierValue);
        case 'loc':
            return await resolveLocToWikidata(identifierValue);
        case 'orcid':
            return await resolveORCIDToWikidata(identifierValue);
        case 'isni':
            return await resolveISNIToWikidata(identifierValue);
        case 'wikidata':
            return await resolveWikidataId(identifierValue);
        case 'iso639-1':
            // For language codes, check the mapping
            return LANGUAGE_MAPPING[originalUrl] || null;
        default:
            console.warn(`Unknown identifier type: ${identifierType}`);
            return null;
    }
}

/**
 * Clear the resolution cache
 */
export function clearResolutionCache() {
    resolutionCache.clear();
}