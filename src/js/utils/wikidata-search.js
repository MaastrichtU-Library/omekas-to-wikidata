/**
 * Shared Wikidata item-search helpers.
 *
 * Omeka collections often format personal names as "Family name, given name".
 * Wikidata labels commonly use the reverse order, so search both safe variants.
 */

/**
 * Build ordered Wikidata search queries for a user-entered value.
 * @param {string} value - Text to search for
 * @returns {string[]} Original query followed by a normalized personal-name form when applicable
 */
export function getWikidataSearchQueries(value) {
    const originalQuery = String(value || '').trim().replace(/\s+/g, ' ');
    if (!originalQuery) {
        return [];
    }

    const familyNameFirstMatch = originalQuery.match(/^([^,]+),\s*(.+)$/);
    if (!familyNameFirstMatch) {
        return [originalQuery];
    }

    const familyName = familyNameFirstMatch[1].trim();
    const givenNames = familyNameFirstMatch[2].trim();
    const normalizedName = `${givenNames} ${familyName}`.trim();

    return normalizedName && normalizedName !== originalQuery
        ? [originalQuery, normalizedName]
        : [originalQuery];
}

/**
 * Search Wikidata items with the original text and any safe name-order variant.
 * @param {string} value - Text to search for
 * @param {Object} options - Search configuration
 * @param {number} [options.limit=10] - Maximum results returned overall
 * @param {Function} [options.fetcher=fetch] - Fetch implementation, primarily for timed requests
 * @returns {Promise<Array>} Deduplicated Wikidata search results
 */
export async function searchWikidataItems(value, { limit = 10, fetcher = fetch } = {}) {
    const queries = getWikidataSearchQueries(value);
    if (queries.length === 0) {
        return [];
    }

    const requests = queries.map(async query => {
        const apiUrl = new URL('https://www.wikidata.org/w/api.php');
        apiUrl.searchParams.set('action', 'wbsearchentities');
        apiUrl.searchParams.set('search', query);
        apiUrl.searchParams.set('language', 'en');
        apiUrl.searchParams.set('format', 'json');
        apiUrl.searchParams.set('origin', '*');
        apiUrl.searchParams.set('type', 'item');
        apiUrl.searchParams.set('limit', String(limit));

        const response = await fetcher(apiUrl.toString());
        if (!response.ok) {
            const error = new Error(`Wikidata search API error: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        return Array.isArray(data.search) ? data.search : [];
    });

    const settledRequests = await Promise.allSettled(requests);
    const fulfilledRequests = settledRequests.filter(result => result.status === 'fulfilled');
    const successfulResults = fulfilledRequests.flatMap(result => result.value);

    if (fulfilledRequests.length === 0) {
        const failedRequest = settledRequests.find(result => result.status === 'rejected');
        throw failedRequest?.reason || new Error('Wikidata search returned no usable response.');
    }

    const seenIds = new Set();
    return successfulResults.filter(result => {
        if (!result?.id || seenIds.has(result.id)) {
            return false;
        }

        seenIds.add(result.id);
        return true;
    }).slice(0, limit);
}
