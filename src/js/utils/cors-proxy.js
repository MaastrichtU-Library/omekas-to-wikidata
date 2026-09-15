/**
 * CORS Proxy utilities for handling cross-origin requests to Omeka S APIs
 * Provides tiered fallback system with multiple proxy services
 */

/**
 * Domain memory cache for tracking CORS-blocked domains
 * Reduces console noise by skipping direct fetch for known blocked domains
 */
const corsBlockedDomains = new Set();

/**
 * Extracts domain from URL for CORS tracking
 * @param {string} url - Full URL
 * @returns {string} - Domain (e.g., "example.com")
 */
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url; // Fallback if URL parsing fails
    }
}

/**
 * Public CORS proxies are a convenience fallback, not infrastructure the app controls.
 * Keep the list short and bounded so an unavailable service does not hold up import.
 */
const CORS_PROXIES = [
    {
        name: 'Community CORS Proxy (CORS.lol)',
        transform: (url) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
        parseResponse: (response) => response,
        headers: {}
    },
    {
        name: 'AllOrigins',
        transform: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        parseResponse: (response) => {
            console.log('AllOrigins raw response:', response);
            // AllOrigins wraps the response in {contents, status}
            if (response && typeof response === 'object' && response.contents) {
                try {
                    // Check if contents is base64 encoded (starts with "data:")
                    if (typeof response.contents === 'string' && response.contents.startsWith('data:')) {
                        // Extract base64 part and decode
                        const base64Part = response.contents.split(',')[1];
                        if (base64Part) {
                            const decodedString = atob(base64Part);
                            return JSON.parse(decodedString);
                        }
                    }
                    // Contents should be a string containing JSON
                    if (typeof response.contents === 'string') {
                        return JSON.parse(response.contents);
                    } else {
                        // If contents is already an object, return it directly
                        return response.contents;
                    }
                } catch (parseError) {
                    console.error('AllOrigins content parsing failed:', parseError);
                    console.error('Contents type:', typeof response.contents);
                    console.error('Contents sample:', response.contents.substring ? response.contents.substring(0, 200) : response.contents);
                    throw new Error(`AllOrigins returned invalid JSON: ${parseError.message}`);
                }
            }
            console.error('AllOrigins unexpected response format:', response);
            throw new Error('AllOrigins returned unexpected response format');
        },
        headers: {}
    },
    {
        name: 'CodeTabs Proxy',
        transform: (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
        parseResponse: (response) => response,
        headers: {}
    }
];

const DIRECT_FETCH_TIMEOUT_MS = 12_000;
const PROXY_FETCH_TIMEOUT_MS = 4_000;
const PROXY_FALLBACK_WINDOW_MS = 10_000;

async function fetchWithTimeout(url, options, timeoutMs, sourceName) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`${sourceName} timed out after ${Math.round(timeoutMs / 1000)} seconds`);
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function isJsonContentType(contentType) {
    if (!contentType) {
        return false;
    }

    const mediaType = contentType.split(';')[0].trim().toLowerCase();
    return mediaType === 'application/json' || mediaType.endsWith('+json');
}

async function parseJsonResponse(response, sourceName) {
    const contentType = response.headers.get('content-type');

    if (isJsonContentType(contentType)) {
        return response.json();
    }

    const textData = await response.text();

    try {
        return JSON.parse(textData);
    } catch {
        throw new Error(`${sourceName} returned non-JSON content: ${contentType || 'unknown content type'}`);
    }
}

/**
 * Attempts to fetch data using direct request first, then CORS proxies as fallback
 * Remembers CORS-blocked domains to skip direct fetch and reduce console noise
 * @param {string} url - The original API URL to fetch
 * @param {Object} options - Fetch options (optional)
 * @returns {Promise<{data: Object, method: string, proxyUsed: string|null}>}
 */
export async function fetchWithCorsProxy(url, options = {}) {
    let lastError = null;
    const domain = extractDomain(url);
    const isKnownCorsBlocked = corsBlockedDomains.has(domain);

    // Skip direct fetch if we know this domain is CORS-blocked
    if (isKnownCorsBlocked) {
        console.log(`📡 Using proxy for known CORS-blocked domain: ${domain}`);
    } else {
        // First attempt: Direct fetch (no proxy)
        try {
            const response = await fetchWithTimeout(url, options, DIRECT_FETCH_TIMEOUT_MS, 'Direct API request');

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
            }

            const data = await parseJsonResponse(response, 'Response');

            return {
                data,
                method: 'direct',
                proxyUsed: null,
                success: true
            };

        } catch (error) {
            lastError = error;

            // Check if it's a CORS error
            if (!isCorsError(error)) {
                // If it's not a CORS error, don't try proxies
                throw error;
            }

            // Remember this domain for future requests
            corsBlockedDomains.add(domain);
            console.log(`🔄 CORS blocked - switching to proxy (future requests will skip direct fetch)`);
        }
    }
    
    const proxyDeadline = Date.now() + PROXY_FALLBACK_WINDOW_MS;

    // Attempt each proxy in order without letting public fallback services delay import indefinitely.
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        const proxy = CORS_PROXIES[i];
        const remainingProxyTime = proxyDeadline - Date.now();

        if (remainingProxyTime <= 0) {
            lastError = new Error(
                `Public CORS proxy attempts timed out after ${Math.round(PROXY_FALLBACK_WINDOW_MS / 1000)} seconds`
            );
            break;
        }

        try {
            // Only show attempting message if previous proxies failed
            if (i > 0) {
                console.log(`  Trying ${proxy.name}...`);
            }

            const proxyUrl = proxy.transform(url);
            const proxyOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    ...proxy.headers
                }
            };

            const response = await fetchWithTimeout(
                proxyUrl,
                proxyOptions,
                Math.min(PROXY_FETCH_TIMEOUT_MS, remainingProxyTime),
                proxy.name
            );

            if (!response.ok) {
                throw new Error(`Proxy ${proxy.name} returned ${response.status}: ${response.statusText}`);
            }

            const rawData = await parseJsonResponse(response, proxy.name);
            const data = proxy.parseResponse(rawData);

            console.log(`✅ Fetched via ${proxy.name}`);

            return {
                data,
                method: 'proxy',
                proxyUsed: proxy.name,
                success: true
            };

        } catch (error) {
            // Only log failures if we're going to try another proxy
            if (i < CORS_PROXIES.length - 1) {
                console.log(`  ⚠️ ${proxy.name} failed, trying next...`);
            }
            lastError = error;
            continue;
        }
    }
    
    // All methods failed
    throw new Error(`All fetch methods failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Determines if an error is likely a CORS error
 * @param {Error} error - The error to check
 * @returns {boolean} - True if it appears to be a CORS error
 */
function isCorsError(error) {
    const errorMessage = error.message.toLowerCase();
    const corsIndicators = [
        'cors',
        'cross-origin',
        'network error',
        'failed to fetch',
        'access-control-allow-origin'
    ];
    
    return corsIndicators.some(indicator => errorMessage.includes(indicator));
}

/**
 * Gets a human-readable explanation of a CORS restriction.
 * @returns {Object} - Object containing the explanation text
 */
export function getCorsExplanation() {
    return {
        what: "CORS (Cross-Origin Resource Sharing) is a security feature that prevents websites from accessing resources on other domains without permission.",
        
        why: "The Omeka S server at this URL hasn't been configured to allow cross-origin requests from web applications like this tool. You can still open the API JSON and paste it into Manual JSON Input."
    };
}

/**
 * Generates Apache .htaccess configuration for CORS
 * @param {string} allowedOrigin - Specific origin to allow, or "*" for all
 * @returns {string} - Apache configuration
 */
export function generateCorsConfig(allowedOrigin = "*") {
    return `# CORS Configuration for Omeka S API
# Add this to your .htaccess file in the Omeka S root directory

<IfModule mod_headers.c>
    # Allow cross-origin requests
    Header set Access-Control-Allow-Origin "${allowedOrigin}"
    Header set Access-Control-Allow-Headers "origin, x-requested-with, content-type, authorization"
    Header set Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE"
    
    # Handle preflight requests
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} OPTIONS
    RewriteRule ^(.*)$ $1 [R=200,L]
</IfModule>

# Alternative: For JSON API endpoints only
# <FilesMatch "\\.(json)$">
#     <IfModule mod_headers.c>
#         Header set Access-Control-Allow-Origin "${allowedOrigin}"
#         Header set Access-Control-Allow-Headers "origin, x-requested-with, content-type"
#         Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
#     </IfModule>
# </FilesMatch>`;
}
