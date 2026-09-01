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
 * Configuration for available CORS proxy services
 * Ordered by success rate: CORS Proxy (corsproxy.io) → AllOrigins (fixed) → Community Proxy → ThingProxy → YQL Proxy
 */
const CORS_PROXIES = [
    {
        name: 'CORS Proxy (corsproxy.io)',
        transform: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
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
        name: 'Community CORS Proxy (CORS.lol)',
        transform: (url) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
        parseResponse: (response) => response,
        headers: {}
    },
    {
        name: 'ThingProxy',
        transform: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
        parseResponse: (response) => response,
        headers: {}
    },
    {
        name: 'YQL Proxy',
        transform: (url) => `https://query.yahooapis.com/v1/public/yql?q=${encodeURIComponent(`select * from json where url="${url}"`)}&format=json&env=store://datatables.org/alltableswithkeys`,
        parseResponse: (response) => {
            // YQL wraps response in query.results
            if (response && response.query && response.query.results && response.query.results.json) {
                return response.query.results.json;
            }
            throw new Error('YQL returned unexpected response format');
        },
        headers: {}
    }
];

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
            const response = await fetch(url, options);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Response is not valid JSON. Please check the API URL.');
            }

            const data = await response.json();

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
    
    // Attempt each proxy in order
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        const proxy = CORS_PROXIES[i];

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

            const response = await fetch(proxyUrl, proxyOptions);

            if (!response.ok) {
                throw new Error(`Proxy ${proxy.name} returned ${response.status}: ${response.statusText}`);
            }

            // Check content type
            const contentType = response.headers.get('content-type');

            let rawData;
            if (contentType && contentType.includes('application/json')) {
                rawData = await response.json();
            } else {
                // If not JSON, try to parse as text first
                const textData = await response.text();
                try {
                    rawData = JSON.parse(textData);
                } catch {
                    throw new Error(`${proxy.name} returned non-JSON content: ${contentType}`);
                }
            }

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
 * Gets a human-readable explanation of CORS and potential solutions
 * @returns {Object} - Object containing explanation and solutions
 */
export function getCorsExplanation() {
    return {
        what: "CORS (Cross-Origin Resource Sharing) is a security feature that prevents websites from accessing resources on other domains without permission.",
        
        why: "The Omeka S server at this URL hasn't been configured to allow cross-origin requests from web applications like this tool.",
        
        solutions: [
            {
                title: "Contact the Administrator",
                description: "Ask the Omeka S administrator to enable CORS headers (this is safe for public APIs)",
                action: "show-admin-template"
            },
            {
                title: "Use Proxy Service",
                description: "We can route your request through a proxy service (data remains public)",
                action: "try-proxy"
            },
            {
                title: "Manual Data Entry",
                description: "Copy and paste the JSON data directly from the API URL",
                action: "manual-input"
            }
        ]
    };
}

/**
 * Generates a template email for administrators to enable CORS
 * @param {string} domain - The domain that needs CORS access
 * @returns {Object} - Email template with subject and body
 */
export function getAdminEmailTemplate(domain) {
    const subject = "Request to Enable CORS Headers for Omeka S API Access";
    
    const body = `Dear Omeka S Administrator,

I am trying to access your Omeka S API from a web application (${domain || 'a cultural heritage mapping tool'}) but am encountering CORS (Cross-Origin Resource Sharing) restrictions.

WHAT IS NEEDED:
Enable CORS headers on your Omeka S installation to allow web applications to access your public API.

WHY THIS IS SAFE:
- CORS only affects browser-based access, not direct API access
- This change only allows reading public data that's already accessible via your API
- No authentication or private data is involved
- This is a standard configuration for public APIs

HOW TO IMPLEMENT:
Add the following lines to your .htaccess file in the Omeka S root directory:

\`\`\`apache
# Enable CORS for API access
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Headers "origin, x-requested-with, content-type"
    Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
</IfModule>
\`\`\`

For more secure configuration (recommended), replace "*" with specific domains:
\`\`\`apache
Header set Access-Control-Allow-Origin "${domain || 'https://your-trusted-domain.com'}"
\`\`\`

DOCUMENTATION:
- Omeka Forum discussion: https://forum.omeka.org/t/cors-header-not-present-in-default-installations/15400
- CORS explanation: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

This change will enable broader access to your public collections data through web-based tools while maintaining security.

Thank you for considering this request!

Best regards`;

    return { subject, body };
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