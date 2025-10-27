/**
 * URL utility functions
 */

/**
 * Checks if a string is a URL
 * @param {string} str - String to check
 * @returns {boolean} - True if string is a URL
 */
export function isUrl(str) {
    return typeof str === 'string' && /^https?:\/\//.test(str);
}

/**
 * Checks if a URL is an API URL from the same domain
 * @param {string} url - URL to check
 * @param {string} baseUrl - Base URL for comparison
 * @returns {boolean} - True if URL is an API URL from same domain
 */
export function isApiUrl(url, baseUrl) {
    if (!url || typeof url !== 'string') return false;

    // Check if it's a URL
    if (!isUrl(url)) return false;

    try {
        // Extract the domain from baseUrl
        const baseUrlObj = new URL(baseUrl);
        const urlObj = new URL(url);

        // Check if it's from the same domain
        const sameDomain = urlObj.hostname === baseUrlObj.hostname;

        // Check if it's an API URL
        const isApi = url.includes('/api/') ||
            urlObj.pathname.startsWith('/api/') ||
            url.includes('?') && (url.includes('resource=') || url.includes('property='));

        return sameDomain && isApi;
    } catch (e) {
        return false;
    }
}

/**
 * Checks if a string is an ARK identifier
 * @param {string} str - String to check
 * @returns {boolean} - True if string is an ARK identifier
 */
export function isArkIdentifier(str) {
    // ARK identifiers typically start with 'ark:/' followed by numbers and slashes
    return typeof str === 'string' && /ark:[\\/]?[0-9]+[\\/][0-9a-zA-Z.]+/i.test(str);
}

/**
 * Converts an ARK to a resolvable URL
 * @param {string} arkId - ARK identifier
 * @returns {string} - Resolvable URL for the ARK
 */
export function getArkUrl(arkId) {
    // If it already has http/https, return as is
    if (arkId.startsWith('http')) {
        return arkId;
    }

    // First try the N2T resolver (Name-to-Thing)
    return `https://n2t.net/${arkId}`;
}

/**
 * Extracts a readable name from a URL
 * @param {string} url - URL to extract name from
 * @returns {string} - Readable name
 */
export function getResourceNameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');

        // Find the resource type from the URL
        const apiIndex = pathParts.indexOf('api');
        if (apiIndex !== -1 && apiIndex < pathParts.length - 1) {
            let name = pathParts[apiIndex + 1];

            // If there's an ID in the path, add it to the name
            if (apiIndex + 2 < pathParts.length && pathParts[apiIndex + 2]) {
                name += ' ' + pathParts[apiIndex + 2];
            }

            return name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Fallback to showing part of the URL
        return url.split('/').slice(-2).join('/');
    } catch (e) {
        return 'API Result';
    }
}