/**
 * Identifier Detection System for Omeka S to Wikidata mapping
 * Extracts and matches various identifier types from Omeka S JSON data
 * @module identifier-detection
 */

/**
 * Data structure for extracted identifiers
 */
export class IdentifierDetection {
    constructor() {
        this.extractedIdentifiers = {};
        this.wikidataMatches = {};
        this.conflicts = {};
    }

    /**
     * Main extraction orchestrator - processes all items in the dataset
     * @param {Array} omekaItems - Array of Omeka S items
     * @returns {Object} Complete identifier detection results
     */
    async processItems(omekaItems) {
        console.log('🔍 Starting identifier detection for', omekaItems.length, 'items');

        for (const item of omekaItems) {
            const itemId = item['o:id'];
            console.log(`Processing item ${itemId}:`, item['o:title']);

            this.extractedIdentifiers[itemId] = this.extractAllIdentifiers(item);
        }

        await this.matchWithWikidata();
        this.detectConflicts();

        return {
            extractedIdentifiers: this.extractedIdentifiers,
            wikidataMatches: this.wikidataMatches,
            conflicts: this.conflicts
        };
    }

    /**
     * Extract all identifier types from a single Omeka S item
     * @param {Object} item - Single Omeka S item JSON
     * @returns {Object} Extracted identifiers organized by type
     */
    extractAllIdentifiers(item) {
        const identifiers = {
            itemLevel: {
                ark: this.extractARK(item),
                oclc: this.extractOCLC(item)
            },
            valueLevel: {
                viaf: this.extractVIAF(item),
                geonames: this.extractGeoNames(item),
                iso639: this.extractLanguageCodes(item),
                wikidataQids: this.extractWikidataQIDs(item)
            }
        };

        console.log(`Extracted identifiers for item ${item['o:id']}:`, identifiers);
        return identifiers;
    }

    /**
     * Extract ARK (Archival Resource Key) identifiers from dcterms:identifier
     * @param {Object} item - Omeka S item
     * @returns {Array} Found ARK identifiers
     */
    extractARK(item) {
        const arkPattern = /ark:\/\d+\/.+/;
        const identifiers = [];

        const dctermsIdentifier = item['dcterms:identifier'];
        if (Array.isArray(dctermsIdentifier)) {
            for (const identifier of dctermsIdentifier) {
                if (identifier.type === 'literal' && identifier['@value']) {
                    const match = identifier['@value'].match(arkPattern);
                    if (match) {
                        identifiers.push({
                            value: match[0],
                            source: 'dcterms:identifier'
                        });
                    }
                }
            }
        }

        return identifiers;
    }

    /**
     * Extract OCLC numbers from schema:sameAs WorldCat URLs
     * @param {Object} item - Omeka S item
     * @returns {Array} Found OCLC numbers
     */
    extractOCLC(item) {
        const oclcPattern = /oclc\/(\d+)/;
        const identifiers = [];

        const sameAs = item['schema:sameAs'];
        if (Array.isArray(sameAs)) {
            for (const reference of sameAs) {
                if (reference.type === 'uri' && reference['@id']) {
                    const match = reference['@id'].match(oclcPattern);
                    if (match) {
                        identifiers.push({
                            value: match[1], // Just the number
                            source: 'schema:sameAs',
                            url: reference['@id']
                        });
                    }
                }
            }
        }

        return identifiers;
    }

    /**
     * Extract VIAF IDs from various value suggest URIs
     * @param {Object} item - Omeka S item
     * @returns {Array} Found VIAF identifiers
     */
    extractVIAF(item) {
        const viafPattern = /viaf\.org\/viaf\/(\d+)/;
        const identifiers = [];

        // Check common fields that might contain VIAF URIs
        const fieldsToCheck = ['schema:publisher', 'schema:author', 'schema:creator'];

        for (const fieldName of fieldsToCheck) {
            const field = item[fieldName];
            if (Array.isArray(field)) {
                for (const value of field) {
                    if (value.type && value.type.includes('viaf') && value['@id']) {
                        const match = value['@id'].match(viafPattern);
                        if (match) {
                            identifiers.push({
                                value: match[1],
                                source: fieldName,
                                url: value['@id'],
                                label: value['o:label'] || null
                            });
                        }
                    }
                }
            }
        }

        return identifiers;
    }

    /**
     * Extract GeoNames IDs from location fields
     * @param {Object} item - Omeka S item
     * @returns {Array} Found GeoNames identifiers
     */
    extractGeoNames(item) {
        const geonamesPattern = /geonames\.org\/(\d+)/;
        const identifiers = [];

        // Check location-related fields
        const fieldsToCheck = ['schema:locationCreated', 'schema:itemLocation'];

        for (const fieldName of fieldsToCheck) {
            const field = item[fieldName];
            if (Array.isArray(field)) {
                for (const value of field) {
                    if (value.type && value.type.includes('geonames') && value['@id']) {
                        const match = value['@id'].match(geonamesPattern);
                        if (match) {
                            identifiers.push({
                                value: match[1],
                                source: fieldName,
                                url: value['@id'],
                                label: value['o:label'] || null
                            });
                        }
                    }
                }
            }
        }

        return identifiers;
    }

    /**
     * Extract ISO 639 language codes from schema:inLanguage
     * @param {Object} item - Omeka S item
     * @returns {Array} Found language codes
     */
    extractLanguageCodes(item) {
        const iso639Pattern = /iso639-([13])\/([a-z]{2,3})/;
        const identifiers = [];

        const inLanguage = item['schema:inLanguage'];
        if (Array.isArray(inLanguage)) {
            for (const language of inLanguage) {
                if (language.type && language.type.includes('iso6391') && language['@id']) {
                    const match = language['@id'].match(iso639Pattern);
                    if (match) {
                        identifiers.push({
                            value: match[2],
                            type: `ISO 639-${match[1]}`,
                            source: 'schema:inLanguage',
                            url: language['@id'],
                            label: language['o:label'] || null
                        });
                    }
                }
            }
        }

        return identifiers;
    }

    /**
     * Extract direct Wikidata QIDs from various fields
     * @param {Object} item - Omeka S item
     * @returns {Array} Found Wikidata QIDs
     */
    extractWikidataQIDs(item) {
        const wikidataPattern = /wikidata\.org\/(?:wiki\/|entity\/)([QP]\d+)/;
        const identifiers = [];

        // Recursively search all fields for Wikidata URIs
        const searchObject = (obj, path = '') => {
            if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    searchObject(item, `${path}[${index}]`);
                });
            } else if (obj && typeof obj === 'object') {
                for (const [key, value] of Object.entries(obj)) {
                    if (key === '@id' && typeof value === 'string') {
                        const match = value.match(wikidataPattern);
                        if (match) {
                            identifiers.push({
                                value: match[1],
                                source: path || key,
                                url: value,
                                label: obj['o:label'] || null
                            });
                        }
                    } else {
                        searchObject(value, path ? `${path}.${key}` : key);
                    }
                }
            }
        };

        searchObject(item);
        return identifiers;
    }

    /**
     * Query Wikidata for all extracted identifiers in parallel
     */
    async matchWithWikidata() {
        console.log('🔄 Querying Wikidata for identifier matches...');

        const queries = [];

        // Collect all queries to run in parallel
        for (const [itemId, identifiers] of Object.entries(this.extractedIdentifiers)) {
            // Item-level queries
            for (const ark of identifiers.itemLevel.ark) {
                queries.push({
                    itemId,
                    identifierType: 'ark',
                    identifier: ark,
                    query: this.buildSPARQLQuery('P8091', ark.value)
                });
            }

            for (const oclc of identifiers.itemLevel.oclc) {
                queries.push({
                    itemId,
                    identifierType: 'oclc',
                    identifier: oclc,
                    query: this.buildSPARQLQuery('P243', oclc.value)
                });
            }

            // Value-level queries
            for (const viaf of identifiers.valueLevel.viaf) {
                queries.push({
                    itemId,
                    identifierType: 'viaf',
                    identifier: viaf,
                    query: this.buildSPARQLQuery('P214', viaf.value)
                });
            }

            for (const geoname of identifiers.valueLevel.geonames) {
                queries.push({
                    itemId,
                    identifierType: 'geonames',
                    identifier: geoname,
                    query: this.buildSPARQLQuery('P1566', geoname.value)
                });
            }

            for (const lang of identifiers.valueLevel.iso639) {
                const property = lang.type === 'ISO 639-1' ? 'P218' : 'P220';
                queries.push({
                    itemId,
                    identifierType: 'iso639',
                    identifier: lang,
                    query: this.buildSPARQLQuery(property, lang.value)
                });
            }

            // Direct QID matches don't need queries - they're already Wikidata entities
            for (const qid of identifiers.valueLevel.wikidataQids) {
                if (!this.wikidataMatches[itemId]) {
                    this.wikidataMatches[itemId] = {};
                }
                if (!this.wikidataMatches[itemId]['wikidataQids']) {
                    this.wikidataMatches[itemId]['wikidataQids'] = [];
                }
                this.wikidataMatches[itemId]['wikidataQids'].push({
                    identifier: qid,
                    wikidataEntity: qid.value,
                    direct: true
                });
            }
        }

        // Execute all SPARQL queries in parallel
        const queryPromises = queries.map(queryInfo => 
            this.executeSPARQLQuery(queryInfo.query)
                .then(result => ({ ...queryInfo, result }))
                .catch(error => ({ ...queryInfo, error }))
        );

        const results = await Promise.all(queryPromises);

        // Process results
        for (const queryResult of results) {
            if (queryResult.error) {
                console.error(`SPARQL query failed for ${queryResult.identifierType}:`, queryResult.error);
                continue;
            }

            if (queryResult.result.results.bindings.length > 0) {
                const wikidataEntity = this.extractEntityFromSPARQLResult(queryResult.result);
                
                if (!this.wikidataMatches[queryResult.itemId]) {
                    this.wikidataMatches[queryResult.itemId] = {};
                }
                if (!this.wikidataMatches[queryResult.itemId][queryResult.identifierType]) {
                    this.wikidataMatches[queryResult.itemId][queryResult.identifierType] = [];
                }

                this.wikidataMatches[queryResult.itemId][queryResult.identifierType].push({
                    identifier: queryResult.identifier,
                    wikidataEntity,
                    sparqlResult: queryResult.result
                });

                console.log(`✅ Match found: ${queryResult.identifierType} ${queryResult.identifier.value} → ${wikidataEntity}`);
            }
        }
    }

    /**
     * Build SPARQL query for a specific property and value
     * @param {string} property - Wikidata property (e.g., 'P214')
     * @param {string} value - Identifier value
     * @returns {string} SPARQL query string
     */
    buildSPARQLQuery(property, value) {
        return `
            SELECT ?item WHERE { 
                ?item wdt:${property} "${value}" .
            }
            LIMIT 1
        `;
    }

    /**
     * Execute SPARQL query against Wikidata Query Service
     * @param {string} query - SPARQL query string
     * @returns {Promise<Object>} Query result
     */
    async executeSPARQLQuery(query) {
        const endpoint = 'https://query.wikidata.org/sparql';
        const url = new URL(endpoint);
        url.searchParams.set('query', query);
        url.searchParams.set('format', 'json');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/sparql-results+json',
                'User-Agent': 'Omeka-S-to-Wikidata-Tool/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Extract entity ID from SPARQL result
     * @param {Object} sparqlResult - SPARQL query result
     * @returns {string|null} Wikidata entity ID (e.g., 'Q12345')
     */
    extractEntityFromSPARQLResult(sparqlResult) {
        const bindings = sparqlResult.results.bindings;
        if (bindings.length === 0) return null;

        const itemUri = bindings[0].item.value;
        const match = itemUri.match(/\/entity\/([QP]\d+)$/);
        return match ? match[1] : null;
    }

    /**
     * Detect conflicts where multiple identifiers point to different Wikidata entities
     */
    detectConflicts() {
        console.log('🔍 Detecting identifier conflicts...');

        for (const [itemId, matches] of Object.entries(this.wikidataMatches)) {
            const entitiesByField = {};
            
            // Group matches by source field
            for (const [identifierType, identifierMatches] of Object.entries(matches)) {
                for (const match of identifierMatches) {
                    const field = match.identifier.source;
                    if (!entitiesByField[field]) {
                        entitiesByField[field] = [];
                    }
                    entitiesByField[field].push({
                        identifierType,
                        identifier: match.identifier,
                        wikidataEntity: match.wikidataEntity || match.identifier.value
                    });
                }
            }

            // Check for conflicts within fields
            for (const [field, matches] of Object.entries(entitiesByField)) {
                if (matches.length > 1) {
                    const entities = [...new Set(matches.map(m => m.wikidataEntity))];
                    if (entities.length > 1) {
                        if (!this.conflicts[itemId]) {
                            this.conflicts[itemId] = {};
                        }
                        this.conflicts[itemId][field] = matches;
                        console.log(`⚠️  Conflict detected in item ${itemId}, field ${field}:`, entities);
                    }
                }
            }
        }
    }

    /**
     * Get summary statistics for the detection results
     * @returns {Object} Statistics summary
     */
    getStatistics() {
        const stats = {
            totalItems: Object.keys(this.extractedIdentifiers).length,
            identifierCounts: {},
            matchCounts: {},
            conflictCounts: Object.keys(this.conflicts).length
        };

        // Count extracted identifiers by type
        for (const identifiers of Object.values(this.extractedIdentifiers)) {
            for (const [category, types] of Object.entries(identifiers)) {
                for (const [type, items] of Object.entries(types)) {
                    const key = `${category}.${type}`;
                    stats.identifierCounts[key] = (stats.identifierCounts[key] || 0) + items.length;
                }
            }
        }

        // Count matches by type
        for (const matches of Object.values(this.wikidataMatches)) {
            for (const [type, items] of Object.entries(matches)) {
                stats.matchCounts[type] = (stats.matchCounts[type] || 0) + items.length;
            }
        }

        return stats;
    }
}

/**
 * Helper function to create a new identifier detection instance and process data
 * @param {Array} omekaItems - Array of Omeka S items
 * @returns {Promise<Object>} Detection results
 */
export async function detectIdentifiers(omekaItems) {
    const detection = new IdentifierDetection();
    return await detection.processItems(omekaItems);
}