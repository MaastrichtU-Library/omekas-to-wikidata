/**
 * Reference Detection Module
 * Detects reference links from Omeka S API data for future Wikidata statement creation
 *
 * This module handles four types of references:
 * 1. Omeka Item API Links - Direct item references from @id field
 * 2. OCLC WorldCat Links - Bibliographic references from schema:sameAs
 * 3. ARK Identifiers - Persistent identifiers from dcterms:identifier
 * 4. Generic sameAs Links - Other related resources from schema:sameAs
 *
 * Unlike identifiers in Step 2 (used for reconciliation), these references
 * are complete URLs that will be added as Wikidata statement values.
 *
 * @module references/core/detector
 */

/**
 * Detects all references across all items in the dataset
 * @param {Array|Object} data - Array of Omeka S items or single item object
 * @returns {Object} Detection results with itemReferences and summary
 * @returns {Object} result.itemReferences - Map of itemId -> array of reference objects
 * @returns {Object} result.summary - Map of referenceType -> {count, examples}
 */
export function detectReferences(data) {
    // Normalize data structure to handle both single item and array formats
    // This matches the same normalization logic in data-analyzer.js
    let items = [];

    if (Array.isArray(data)) {
        items = data;
    } else if (data && data.items && Array.isArray(data.items)) {
        // Handle wrapper object: { items: [...] }
        items = data.items;
    } else if (data && typeof data === 'object') {
        // Handle single item object
        items = [data];
    }

    if (items.length === 0) {
        return {
            itemReferences: {},
            summary: {}
        };
    }

    const itemReferences = {};
    const summary = {
        'omeka-item': { count: 0, examples: [] },
        'oclc': { count: 0, examples: [] },
        'ark': { count: 0, examples: [] },
        'sameas': { count: 0, examples: [] }
    };

    items.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;

        // Use item's @id as itemId, or fall back to index
        const itemId = item['@id'] || item.id || `item-${index}`;
        const references = [];

        // Detect Omeka Item Link
        const omekaItemLink = detectOmekaItemLink(item);
        if (omekaItemLink) {
            references.push({ ...omekaItemLink, itemId });
            summary['omeka-item'].count++;
            if (summary['omeka-item'].examples.length < 10) {
                summary['omeka-item'].examples.push({
                    itemId,
                    value: omekaItemLink.url
                });
            }
        }

        // Detect OCLC Links
        const oclcLinks = detectOCLCLinks(item);
        if (oclcLinks.length > 0) {
            oclcLinks.forEach(link => {
                references.push({ ...link, itemId });
            });
            summary['oclc'].count++;
            if (summary['oclc'].examples.length < 10) {
                summary['oclc'].examples.push({
                    itemId,
                    value: oclcLinks[0].url // Use first OCLC link as example
                });
            }
        }

        // Detect ARK Identifiers
        const arkIdentifiers = detectARKIdentifiers(item);
        if (arkIdentifiers.length > 0) {
            arkIdentifiers.forEach(ark => {
                references.push({ ...ark, itemId });
            });
            summary['ark'].count++;
            if (summary['ark'].examples.length < 10) {
                summary['ark'].examples.push({
                    itemId,
                    value: arkIdentifiers[0].url // Use first ARK as example
                });
            }
        }

        // Detect generic sameAs references (not covered by specific detectors)
        const genericRefs = detectGenericSameAsReferences(item);
        if (genericRefs.length > 0) {
            genericRefs.forEach(ref => {
                references.push({ ...ref, itemId });
            });
            summary['sameas'].count++;
            if (summary['sameas'].examples.length < 10) {
                summary['sameas'].examples.push({
                    itemId,
                    value: genericRefs[0].url // Use first generic ref as example
                });
            }
        }

        // Store references for this item
        if (references.length > 0) {
            itemReferences[itemId] = references;
        }
    });

    return {
        itemReferences,
        summary
    };
}

/**
 * Detects Omeka Item API link from top-level @id field
 * @param {Object} item - Omeka S item object
 * @returns {Object|null} Reference object or null if not found
 */
export function detectOmekaItemLink(item) {
    if (!item || !item['@id']) return null;

    const id = item['@id'];
    if (typeof id !== 'string') return null;

    // Check if the @id contains "/items/" pattern
    if (id.includes('/items/')) {
        return {
            type: 'omeka-item',
            url: id,
            displayName: 'Omeka Item Link'
        };
    }

    return null;
}

/**
 * Detects OCLC WorldCat links from schema:sameAs field
 * @param {Object} item - Omeka S item object
 * @returns {Array} Array of OCLC reference objects
 */
export function detectOCLCLinks(item) {
    const oclcLinks = [];

    if (!item || !item['schema:sameAs']) return oclcLinks;

    const sameAs = item['schema:sameAs'];
    if (!Array.isArray(sameAs)) return oclcLinks;

    // Pattern to match OCLC WorldCat URLs
    const oclcPattern = /worldcat\.org\/oclc\/(\d+)/i;

    sameAs.forEach(reference => {
        if (!reference || typeof reference !== 'object') return;

        // Check @id field for OCLC URL
        const idValue = reference['@id'];
        if (idValue && typeof idValue === 'string') {
            const match = idValue.match(oclcPattern);
            if (match) {
                oclcLinks.push({
                    type: 'oclc',
                    url: idValue,
                    oclcNumber: match[1],
                    displayName: 'OCLC WorldCat Link'
                });
            }
        }
    });

    return oclcLinks;
}

/**
 * Detects ARK identifiers from dcterms:identifier field
 * Prefixes them with https://n2t.net/ to create complete URLs
 * @param {Object} item - Omeka S item object
 * @returns {Array} Array of ARK reference objects
 */
export function detectARKIdentifiers(item) {
    const arkIdentifiers = [];

    if (!item || !item['dcterms:identifier']) return arkIdentifiers;

    const identifiers = item['dcterms:identifier'];
    if (!Array.isArray(identifiers)) return arkIdentifiers;

    // Pattern to match ARK identifiers
    const arkPattern = /^ark:[\\/]?[0-9]+[\\/][0-9a-zA-Z._\-]+/i;

    identifiers.forEach(identifier => {
        if (!identifier || typeof identifier !== 'object') return;

        // Check @value field for ARK identifier
        const value = identifier['@value'];
        if (value && typeof value === 'string') {
            const match = value.match(arkPattern);
            if (match) {
                // Prefix ARK identifier with n2t.net resolver
                const fullUrl = `https://n2t.net/${match[0]}`;
                arkIdentifiers.push({
                    type: 'ark',
                    url: fullUrl,
                    arkValue: match[0],
                    displayName: 'ARK Identifier'
                });
            }
        }
    });

    return arkIdentifiers;
}

/**
 * Detects generic schema:sameAs references that aren't covered by specific detectors
 * This catches any sameAs URLs that don't match OCLC WorldCat patterns
 * @param {Object} item - Omeka S item object
 * @returns {Array} Array of generic reference objects
 */
export function detectGenericSameAsReferences(item) {
    const genericRefs = [];

    if (!item || !item['schema:sameAs']) return genericRefs;

    const sameAs = item['schema:sameAs'];
    if (!Array.isArray(sameAs)) return genericRefs;

    // Patterns for specific detectors to skip (avoid double-counting)
    const oclcPattern = /worldcat\.org\/oclc\/(\d+)/i;

    sameAs.forEach(reference => {
        if (!reference || typeof reference !== 'object') return;

        const idValue = reference['@id'];
        if (!idValue || typeof idValue !== 'string') return;

        // Skip if already detected by specific detector
        if (oclcPattern.test(idValue)) return;

        // Valid URL check
        try {
            new URL(idValue);
            genericRefs.push({
                type: 'sameas',
                url: idValue,
                displayName: 'Related Resource',
                label: reference['o:label'] || null
            });
        } catch (e) {
            // Invalid URL, skip
        }
    });

    return genericRefs;
}

/**
 * Gets a human-readable label for a reference type
 * @param {string} type - Reference type
 * @returns {string} Display label
 */
export function getReferenceTypeLabel(type) {
    const labels = {
        'omeka-item': 'Omeka API item',
        'oclc': 'OCLC WorldCat',
        'ark': 'ARK identifier',
        'sameas': 'Related resource (sameAs)'
    };
    return labels[type] || type;
}

/**
 * Gets a description for a reference type by extracting base URL from examples
 * @param {string} type - Reference type
 * @param {Object} data - Reference data with examples array
 * @returns {string} Base URL without protocol
 */
export function getReferenceTypeDescription(type, data) {
    // Extract base URL from first example
    if (data && data.examples && data.examples.length > 0) {
        const firstUrl = data.examples[0].value;
        try {
            const url = new URL(firstUrl);
            // Return origin without protocol
            return url.hostname;
        } catch (e) {
            // If URL parsing fails, try to extract domain manually
            const match = firstUrl.match(/^https?:\/\/([^\/]+)/);
            return match ? match[1] : firstUrl;
        }
    }
    return '';
}
