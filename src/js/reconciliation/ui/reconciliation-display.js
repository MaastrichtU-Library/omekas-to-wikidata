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
                    <button class="btn small primary" onclick="applyMatchDirectly('${match.id}')">Select</button>
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
    
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (matchesContainer) matchesContainer.style.display = 'none';
    if (noMatches) {
        noMatches.style.display = 'block';
        noMatches.innerHTML = `
            <p>Error during reconciliation: ${error.message}</p>
            <button class="btn secondary" onclick="switchTab('manual')">Try Manual Search</button>
        `;
    }
}

/**
 * Display reconciliation results (compatibility function)
 * Now redirects to the new modal system
 */
export function displayReconciliationResults(matches, propertyType, value) {
    console.log('displayReconciliationResults called with:', { matches, propertyType, value });
    
    // Update the existing matches display if modal is open
    const existingMatchesContainer = document.getElementById('existing-matches');
    if (existingMatchesContainer && matches && matches.length > 0) {
        const topMatches = matches.slice(0, 3);
        
        existingMatchesContainer.innerHTML = `
            <div class="section-title">Existing Matches</div>
            <div class="matches-list">
                ${topMatches.map(match => createMatchItemHTML(match)).join('')}
            </div>
            ${matches.length > 3 ? `
                <button class="btn btn-link" onclick="showAllMatches()">Show all ${matches.length} matches</button>
            ` : ''}
        `;
    } else if (existingMatchesContainer) {
        existingMatchesContainer.innerHTML = `
            <div class="section-title">Existing Matches</div>
            <div class="no-matches">No automatic matches found</div>
        `;
    }
}

/**
 * Display high confidence matches (compatibility function)
 */
export function displayHighConfidenceMatches(matches) {
    console.log('displayHighConfidenceMatches called with:', matches);
    
    // Filter high confidence matches (score > 80)
    const highConfidenceMatches = matches.filter(match => (match.score || 0) > 80);
    
    if (highConfidenceMatches.length > 0) {
        displayReconciliationResults(highConfidenceMatches, 'wikibase-item', '');
    }
}

/**
 * Display fallback options (compatibility function)
 */
export function displayFallbackOptions(options = []) {
    console.log('displayFallbackOptions called with:', options);
    
    // This is now handled by the alternative actions in the new modal
    const alternativeActions = document.querySelector('.alternative-actions');
    if (alternativeActions) {
        alternativeActions.style.display = 'flex';
    }
}

/**
 * Show custom input interface (compatibility function)
 */
export function showCustomInputInterface(propertyType, value) {
    console.log('showCustomInputInterface called with:', { propertyType, value });
    
    // This is now handled by the string editor in the new modal
    const stringEditor = document.querySelector('.string-editor');
    if (stringEditor) {
        stringEditor.style.display = 'block';
    }
}

/**
 * Setup manual search in fallback (compatibility function)
 */
export function setupManualSearchInFallback() {
    console.log('setupManualSearchInFallback called');
    
    // This is now handled by the manual search section in the new modal
    const manualSearch = document.querySelector('.manual-search');
    if (manualSearch) {
        manualSearch.style.display = 'block';
    }
}

/**
 * Display fallback search results (compatibility function)
 */
export function displayFallbackSearchResults(results) {
    console.log('displayFallbackSearchResults called with:', results);
    
    // Update search results if modal is open
    const searchResults = document.getElementById('search-results');
    if (searchResults && results && results.length > 0) {
        searchResults.innerHTML = `
            <div class="search-matches">
                ${results.slice(0, 5).map(result => createMatchItemHTML(result)).join('')}
            </div>
        `;
    } else if (searchResults) {
        searchResults.innerHTML = '<div class="no-results">No results found</div>';
    }
}

/**
 * Setup expanded search (compatibility function)
 */
export function setupExpandedSearch() {
    console.log('setupExpandedSearch called');
    
    // This functionality is now built into the manual search section
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer) {
        searchContainer.style.display = 'flex';
    }
}

/**
 * Helper function to create match item HTML
 */
function createMatchItemHTML(match) {
    const matchId = match.id || match.concepturi || '';
    const matchName = match.name || match.label || 'Unnamed';
    const matchDescription = match.description || 'No description';
    const confidence = match.score ? Math.round(match.score) + '%' : '';
    
    return `
        <div class="match-item" data-match-id="${matchId}" onclick="applyMatchDirectly('${matchId}')">
            <div class="match-content">
                <div class="match-name">${escapeHtml(matchName)}</div>
                <div class="match-description">${escapeHtml(matchDescription)}</div>
                <div class="match-id">${matchId}</div>
            </div>
            ${confidence ? `<div class="match-confidence">${confidence}</div>` : ''}
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}