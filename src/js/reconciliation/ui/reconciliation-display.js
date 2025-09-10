/**
 * Reconciliation Display Utilities Module
 * Handles display helpers, property information, and UI utilities
 * @module reconciliation/ui/reconciliation-display
 */

/**
 * Factory function to create getPropertyDisplayInfo with state dependency
 */
export function createGetPropertyDisplayInfoFactory(state) {
    return async function getPropertyDisplayInfo(property) {
        // Try to get real property information from the current mappings state
        const currentState = state.getState();
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        // Check if we have mapping information for this property
        const mappingInfo = mappedKeys.find(keyObj => 
            (typeof keyObj === 'string' ? keyObj : keyObj.key) === property
        );
        
        if (mappingInfo && typeof mappingInfo === 'object' && mappingInfo.property) {
            // We have real Wikidata property information
            const wikidataProperty = mappingInfo.property;
            return {
                label: wikidataProperty.label || property,
                pid: wikidataProperty.id,
                description: wikidataProperty.description || getPropertyDescription(property),
                wikidataUrl: `https://www.wikidata.org/wiki/Property:${wikidataProperty.id}`,
                isMock: false
            };
        }
        
        // Fallback: Try to fetch property information from Wikidata API
        try {
            const realPropertyInfo = await fetchWikidataPropertyInfo(property);
            if (realPropertyInfo) {
                return realPropertyInfo;
            }
        } catch (error) {
            console.warn('Could not fetch Wikidata property info:', error);
        }
        
        // Final fallback: create a mock PID and use property name as label
        const mockPid = generateMockPid(property);
        
        return {
            label: property.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            pid: mockPid,
            description: getPropertyDescription(property),
            wikidataUrl: `https://www.wikidata.org/wiki/Property:${mockPid}`,
            isMock: true
        };
    };
}

/**
 * Fetch real property information from Wikidata
 */
export async function fetchWikidataPropertyInfo(propertyKeyword) {
    try {
        // Search for properties using the keyword
        const apiUrl = 'https://www.wikidata.org/w/api.php';
        const params = new URLSearchParams({
            action: 'wbsearchentities',
            search: propertyKeyword,
            language: 'en',
            format: 'json',
            origin: '*',
            type: 'property',
            limit: 1
        });
        
        const response = await fetch(`${apiUrl}?${params.toString()}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.search && data.search.length > 0) {
            const prop = data.search[0];
            return {
                label: prop.label || propertyKeyword,
                pid: prop.id,
                description: prop.description || getPropertyDescription(propertyKeyword),
                wikidataUrl: `https://www.wikidata.org/wiki/Property:${prop.id}`
            };
        }
    } catch (error) {
        console.warn('Error fetching Wikidata property info:', error);
    }
    return null;
}

/**
 * Generate a mock PID for demonstration (in real implementation, this would come from mappings)
 */
export function generateMockPid(property) {
    // Create a deterministic but realistic-looking PID based on property name
    const hash = property.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    const pidNumber = Math.abs(hash) % 9000 + 1000; // Generate P1000-P9999
    return `P${pidNumber}`;
}

/**
 * Get property description based on common property patterns
 */
export function getPropertyDescription(property) {
    const descriptions = {
        'author': 'creator of a creative work or other object',
        'creator': 'maker of this creative work or other object',
        'title': 'published name of a work',
        'date': 'point in time',
        'subject': 'primary topic of a work',
        'publisher': 'organization or person responsible for publishing',
        'language': 'language of work or name',
        'format': 'file format, physical medium, or dimensions',
        'identifier': 'identifier for this item',
        'rights': 'copyright and other rights information',
        'coverage': 'spatial or temporal topic of the resource',
        'description': 'textual description of the entity',
        'contributor': 'person or organization that contributed to the subject',
        'relation': 'related resource',
        'source': 'work from which this work is derived',
        'type': 'nature or genre of the resource'
    };
    
    // Try to match property name to description
    for (const [key, desc] of Object.entries(descriptions)) {
        if (property.toLowerCase().includes(key)) {
            return desc;
        }
    }
    
    return `Property describing ${property.replace(/[_-]/g, ' ')}`;
}

/**
 * Get the correct Wikidata URL for a property based on its type
 */
export function getWikidataUrlForProperty(property) {
    const label = property.label?.toLowerCase();
    
    // Special cases for core Wikidata concepts
    if (label === 'label') {
        return 'https://www.wikidata.org/wiki/Help:Label';
    }
    if (label === 'description') {
        return 'https://www.wikidata.org/wiki/Help:Description';
    }
    if (label === 'aliases' || label === 'alias') {
        return 'https://www.wikidata.org/wiki/Help:Aliases';
    }
    
    // For regular properties, use the property page
    return `https://www.wikidata.org/wiki/Property:${property.id}`;
}

/**
 * Display automatic matches in the modal
 */
export function displayAutomaticMatches(matches) {
    const loadingIndicator = document.querySelector('.loading-indicator');
    const matchesContainer = document.querySelector('.matches-container');
    const noMatches = document.querySelector('.no-matches');
    const matchesList = document.querySelector('.matches-list');
    
    loadingIndicator.style.display = 'none';
    
    if (matches && matches.length > 0) {
        matchesContainer.style.display = 'block';
        noMatches.style.display = 'none';
        
        matchesList.innerHTML = matches.map((match, index) => `
            <div class="match-item ${index === 0 ? 'recommended' : ''}" data-match-id="${match.id}">
                <div class="match-score">${match.score.toFixed(1)}%</div>
                <div class="match-info">
                    <div class="match-name">${match.name}</div>
                    <div class="match-description">${match.description}</div>
                    <div class="match-id">
                        <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                        <span class="match-source">(${match.source})</span>
                    </div>
                </div>
                <div class="match-actions">
                    <button class="btn small primary" onclick="selectMatch('${match.id}')">Select</button>
                </div>
            </div>
        `).join('');
        
        // Enable confirm button if we have matches
        const confirmBtn = document.querySelector('.reconciliation-actions .btn.primary');
        if (confirmBtn && matches.length > 0) {
            confirmBtn.disabled = false;
        }
        
    } else {
        matchesContainer.style.display = 'none';
        noMatches.style.display = 'block';
    }
}

/**
 * Display reconciliation error
 */
export function displayReconciliationError(error) {
    const loadingIndicator = document.querySelector('.loading-indicator');
    const matchesContainer = document.querySelector('.matches-container');
    const noMatches = document.querySelector('.no-matches');
    
    loadingIndicator.style.display = 'none';
    matchesContainer.style.display = 'none';
    noMatches.style.display = 'block';
    noMatches.innerHTML = `
        <p>Error during reconciliation: ${error.message}</p>
        <button class="btn secondary" onclick="switchTab('manual')">Try Manual Search</button>
    `;
}