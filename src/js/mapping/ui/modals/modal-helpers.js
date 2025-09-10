/**
 * Shared modal helper functions
 * Common utilities used across different modal types
 * @module mapping/ui/modals/modal-helpers
 */

/**
 * Format sample value for display
 */
export function formatSampleValue(value, contextMap = new Map()) {
    if (value === null || value === undefined) {
        return '<pre class="sample-value">N/A</pre>';
    }
    
    if (typeof value === 'object') {
        try {
            // Reset the seen set for each call
            const seenObjects = new WeakSet();
            
            // Use a replacer function to handle circular references and non-serializable objects
            const jsonStr = JSON.stringify(value, (key, val) => {
                // Handle circular references
                if (typeof val === 'object' && val !== null) {
                    if (seenObjects.has(val)) {
                        return '[Circular Reference]';
                    }
                    seenObjects.add(val);
                }
                // Handle functions
                if (typeof val === 'function') {
                    return '[Function]';
                }
                // Handle undefined
                if (val === undefined) {
                    return '[Undefined]';
                }
                return val;
            }, 2);
            
            // Validate that we got a proper JSON string
            if (!jsonStr || jsonStr === 'undefined' || jsonStr === 'null') {
                throw new Error('Invalid JSON result');
            }
            
            // Make JSON keys clickable by replacing them with links
            const clickableJsonStr = makeJsonKeysClickable(jsonStr, contextMap);
            // Create a scrollable container for JSON
            return `<div class="sample-json-container">
                <pre class="sample-json">${clickableJsonStr}</pre>
            </div>`;
        } catch (e) {
            console.error('JSON stringify error:', e, 'Value:', value);
            // Enhanced fallback that shows more useful information
            try {
                if (Array.isArray(value)) {
                    // Try to show full JSON for arrays, but limit to first few items if too large
                    const maxItems = 3;
                    const displayArray = value.length > maxItems ? value.slice(0, maxItems) : value;
                    const truncatedArray = value.length > maxItems ? [...displayArray, '...'] : displayArray;
                    
                    const jsonStr = JSON.stringify(truncatedArray, null, 2);
                    const clickableJsonStr = makeJsonKeysClickable(jsonStr, contextMap);
                    
                    return `<div class="sample-json-container">
                        <div class="array-info">Array with ${value.length} item${value.length !== 1 ? 's' : ''}</div>
                        <pre class="sample-json">${clickableJsonStr}</pre>
                    </div>`;
                } else if (value && typeof value === 'object') {
                    // Try to create a partial JSON representation
                    const partialObject = {};
                    const keys = Object.keys(value).slice(0, 5);
                    keys.forEach(key => {
                        try {
                            partialObject[key] = value[key];
                        } catch (e) {
                            partialObject[key] = '[Error accessing property]';
                        }
                    });
                    if (Object.keys(value).length > 5) {
                        partialObject['...'] = `(${Object.keys(value).length - 5} more properties)`;
                    }
                    
                    const jsonStr = JSON.stringify(partialObject, null, 2);
                    const clickableJsonStr = makeJsonKeysClickable(jsonStr, contextMap);
                    return `<div class="sample-json-container">
                        <pre class="sample-json">${clickableJsonStr}</pre>
                    </div>`;
                } else {
                    return `<pre class="sample-value">${Object.prototype.toString.call(value)}</pre>`;
                }
            } catch (e2) {
                return '<pre class="sample-value">[object - display error]</pre>';
            }
        }
    }
    
    // For non-object values, show them in a pre element with proper formatting
    const str = String(value);
    const displayStr = str.length > 200 ? str.slice(0, 200) + '...' : str;
    return `<pre class="sample-value">${displayStr}</pre>`;
}

/**
 * Helper function to make JSON keys clickable
 */
export function makeJsonKeysClickable(jsonStr, contextMap) {
    // Ensure contextMap is a Map
    if (!contextMap || typeof contextMap.get !== 'function') {
        contextMap = new Map();
    }
    
    // Pattern to match JSON keys (quoted strings followed by colon)
    return jsonStr.replace(/"([^"]+)"(\s*:)/g, (match, key, colon) => {
        // Skip system keys and values (not keys)
        if (key.startsWith('@') || key.match(/^\d+$/)) {
            return match;
        }
        
        // Generate URI for this key
        const uri = generateUriForKey(key, contextMap);
        if (uri) {
            return `"<a href="${uri}" target="_blank" class="clickable-json-key">${key}</a>"${colon}`;
        }
        return match;
    });
}

/**
 * Helper function to generate URI for a key
 */
export function generateUriForKey(key, contextMap) {
    // Ensure contextMap is a Map
    if (!contextMap || typeof contextMap.get !== 'function') {
        contextMap = new Map();
    }
    
    if (key.includes(':')) {
        const [prefix, localName] = key.split(':', 2);
        const baseUri = contextMap.get(prefix);
        if (baseUri) {
            // Handle different URI patterns
            if (baseUri.endsWith('/') || baseUri.endsWith('#')) {
                return baseUri + localName;
            } else {
                return baseUri + '/' + localName;
            }
        }
    } else {
        // Check for common prefixes even without explicit context
        const commonPrefixes = {
            'schema': 'https://schema.org/',
            'dc': 'http://purl.org/dc/terms/',
            'dcterms': 'http://purl.org/dc/terms/',
            'foaf': 'http://xmlns.com/foaf/0.1/',
            'skos': 'http://www.w3.org/2004/02/skos/core#'
        };
        
        // Try to match common patterns
        for (const [prefix, uri] of Object.entries(commonPrefixes)) {
            if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
                const localName = key.substring(prefix.length);
                return uri + localName;
            }
        }
        
        // Check if there's a default namespace
        const defaultNs = contextMap.get('');
        if (defaultNs) {
            return defaultNs + key;
        }
    }
    return null;
}