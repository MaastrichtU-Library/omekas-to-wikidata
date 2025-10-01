/**
 * Wikidata Item Reconciliation Modal
 * @module reconciliation/ui/modals/wikidata-item-modal
 * 
 * Specialized modal interface for reconciling values to Wikidata entities (Q-IDs).
 * Handles entity search, match scoring, and entity selection workflow.
 * 
 * Features:
 * - Automatic entity matching via Wikidata API
 * - Manual entity search with live results
 * - Match confidence scoring and display
 * - High-confidence auto-selection (≥90%)
 * - Alternative actions (create new item, skip, etc.)
 */

/**
 * Create Wikidata Item reconciliation modal content
 * @param {string} itemId - Item ID being reconciled
 * @param {string} property - Property name being reconciled
 * @param {number} valueIndex - Index of value within property
 * @param {string} value - The value to reconcile
 * @param {Object} propertyData - Property metadata and constraints
 * @param {Array} existingMatches - Pre-existing matches if available
 * @returns {HTMLElement} Modal content element
 */
export function createWikidataItemModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null) {
    const modalContent = document.createElement('div');
    modalContent.className = 'wikidata-item-modal';

    // Store context for modal interactions
    modalContent.dataset.modalType = 'wikidata-item';
    modalContent.dataset.itemId = itemId;
    modalContent.dataset.property = property;
    modalContent.dataset.valueIndex = valueIndex;
    modalContent.dataset.value = value;
    if (propertyData) {
        modalContent.dataset.propertyData = JSON.stringify(propertyData);
    }
    if (existingMatches) {
        modalContent.dataset.existingMatches = JSON.stringify(existingMatches);
    }
    
    modalContent.innerHTML = `
        <div class="data-type-indicator">
            <span class="data-type-label">Expecting:</span>
            <span class="data-type-value">Wikidata Item</span>
        </div>

        <div class="value-display">
            <div class="section-title">Omeka S Value</div>
            <div class="original-value">${escapeHtml(value)}</div>
        </div>

        <div class="wikidata-item-section">
            <!-- Existing Matches -->
            <div class="existing-matches" id="existing-matches">
                <div class="section-title">Existing Matches</div>
                <div class="loading-indicator">Finding matches...</div>
            </div>

            <!-- Manual Search -->
            <div class="manual-search">
                <div class="section-title">Search Wikidata</div>
                <div class="search-container">
                    <input type="text" id="wikidata-search" class="search-input"
                           placeholder="Type to search..." value="${escapeHtml(value)}" style="width: 100%;">
                </div>
                <div class="search-results" id="search-results"></div>
            </div>

            <!-- Alternative Actions -->
            <div class="alternative-actions">
                <p class="create-item-help">If the Wikidata item does not exist, you can <a href="https://www.wikidata.org/wiki/Special:NewItem" target="_blank">create it</a>.</p>
            </div>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeReconciliationModal()">Cancel</button>
            <button class="btn btn-outline" onclick="skipReconciliation()">Skip</button>
            <button class="btn btn-primary" id="confirm-btn" onclick="confirmWikidataSelection()" disabled>Confirm</button>
        </div>
    `;

    return modalContent;
}

/**
 * Initialize Wikidata item modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element
 */
export function initializeWikidataItemModal(modalElement) {
    const value = modalElement.dataset.value;
    // Dataset attributes are lost when modal is created from innerHTML
    // So we need to get existingMatches from window.currentModalContext instead
    let existingMatches = modalElement.dataset.existingMatches ?
        JSON.parse(modalElement.dataset.existingMatches) : null;

    // CRITICAL FIX: Fallback to window.currentModalContext which was set before modal opened
    if (!existingMatches && window.currentModalContext?.existingMatches) {
        existingMatches = window.currentModalContext.existingMatches;
    }

    // Store modal context globally for interaction handlers
    window.currentModalContext = {
        itemId: modalElement.dataset.itemId,
        property: modalElement.dataset.property,
        valueIndex: parseInt(modalElement.dataset.valueIndex),
        originalValue: value,
        currentValue: value,
        propertyData: modalElement.dataset.propertyData ?
            JSON.parse(modalElement.dataset.propertyData) : null,
        dataType: 'wikibase-item',
        existingMatches: existingMatches,  // Now this has the correct value from the fallback above
        modalType: 'wikidata-item'
    };

    // Load existing matches for Wikidata items
    loadWikidataItemMatches(value, existingMatches);

    // Set up keystroke-based search with debounce
    const searchInput = document.getElementById('wikidata-search');
    if (searchInput) {
        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            // Clear previous timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            // Set new timeout to search after 300ms of no typing
            searchTimeout = setTimeout(() => {
                window.performWikidataEntitySearch();
            }, 300);
        });
    }
}

/**
 * Load existing matches for Wikidata items
 * @param {string} value - Value to search for
 * @param {Array} existingMatches - Pre-existing matches if available
 */
export async function loadWikidataItemMatches(value, existingMatches = null) {
    const matchesContainer = document.getElementById('existing-matches');
    if (!matchesContainer) {
        return;
    }

    // CRITICAL FIX: Check if container already has valid match data displayed
    // Don't replace reconciliation results that were already loaded
    const hasExistingMatchList = matchesContainer.querySelector('.matches-list');
    const hasLoadingIndicator = matchesContainer.innerHTML.includes('Finding matches...');

    if (hasExistingMatchList && !hasLoadingIndicator) {
        return;
    }

    try {
        let matches = existingMatches;

        // If no existing matches provided, search for new ones
        if (!matches || matches.length === 0) {
            matches = await searchWikidataEntities(value);
        }

        if (matches && matches.length > 0) {
            const topMatches = matches.slice(0, 3); // Show top 3 matches

            matchesContainer.innerHTML = `
                <div class="section-title">Existing Matches</div>
                <div class="matches-list">
                    ${topMatches.map(match => createWikidataMatchItem(match)).join('')}
                </div>
                ${matches.length > 3 ? `
                    <button class="btn btn-link" onclick="showAllWikidataMatches()">Show all ${matches.length} matches</button>
                ` : ''}
            `;

            // Auto-select high-confidence matches (≥90%)
            const highConfidenceMatch = matches.find(match => match.score >= 90);
            if (highConfidenceMatch) {
                setTimeout(() => {
                    applyWikidataMatchDirectly(highConfidenceMatch.id);
                }, 100);
            }

        } else {
            // Only show "no matches" if container is in loading state
            // Don't replace existing valid match data
            if (hasLoadingIndicator || !hasExistingMatchList) {
                matchesContainer.innerHTML = `
                    <div class="section-title">Existing Matches</div>
                    <div class="no-matches">No automatic matches found</div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading Wikidata matches:', error);
        // Only show error if container doesn't already have valid data
        if (hasLoadingIndicator || !hasExistingMatchList) {
            matchesContainer.innerHTML = `
                <div class="section-title">Existing Matches</div>
                <div class="error-message">Error loading matches</div>
            `;
        }
    }
}

/**
 * Search Wikidata entities using the API
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of match objects
 */
export async function searchWikidataEntities(query) {
    try {
        const apiUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&type=item&limit=10`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Wikidata API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.search || data.search.length === 0) {
            return [];
        }
        
        // Return simple format: id, label, description
        return data.search.map(result => ({
            id: result.id,
            label: result.label || result.id,
            description: result.description || ''
        }));
        
    } catch (error) {
        console.error('Wikidata entity search failed:', error);
        return [];
    }
}

/**
 * Create Wikidata match item HTML
 * @param {Object} match - Match object with id, label, description
 * @returns {string} HTML string for match item
 */
export function createWikidataMatchItem(match) {
    // Escape match.id for safe use in HTML attributes
    const safeMatchId = escapeHtml(match.id);
    // Escape match.id for safe use in JavaScript string literals
    const jsEscapedId = match.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const label = escapeHtml(match.label || 'Unnamed');
    const description = match.description ? escapeHtml(match.description) : '';

    return `
        <div class="wikidata-match-item" data-match-id="${safeMatchId}" onclick="applyWikidataMatchDirectly('${jsEscapedId}')">
            <div class="match-content">
                <div class="match-title">
                    ${label} <span class="match-qid-inline">(${safeMatchId})</span>
                </div>
                ${description ? `<div class="match-description">${description}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global interaction handlers for Wikidata item modal
window.performWikidataEntitySearch = async function() {
    const searchInput = document.getElementById('wikidata-search');
    const resultsContainer = document.getElementById('search-results');
    
    if (!searchInput || !resultsContainer) return;
    
    const query = searchInput.value.trim();
    if (!query) return;
    
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const matches = await searchWikidataEntities(query);
        
        if (matches && matches.length > 0) {
            resultsContainer.innerHTML = `
                <div class="search-matches">
                    ${matches.slice(0, 5).map(match => createWikidataMatchItem(match)).join('')}
                </div>
            `;
        } else {
            resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div class="error">Search failed</div>';
    }
};

/**
 * Emergency context reconstruction for Wikidata modal if context is missing
 */
function ensureWikidataModalContext() {
    if (!window.currentModalContext) {
        // Try to reconstruct context from modal DOM
        const modalContainer = document.querySelector('.reconciliation-modal-redesign') ||
                             document.querySelector('.wikidata-item-modal') ||
                             document.querySelector('[data-modal-type]');
        
        if (modalContainer && modalContainer.dataset) {
            const dataset = modalContainer.dataset;
            window.currentModalContext = {
                itemId: dataset.itemId,
                property: dataset.property,
                valueIndex: dataset.valueIndex ? parseInt(dataset.valueIndex) : 0,
                originalValue: dataset.value,
                currentValue: dataset.value,
                propertyData: dataset.propertyData ? JSON.parse(dataset.propertyData) : null,
                dataType: 'wikibase-item',
                modalType: 'wikidata-item'
            };
            return true;
        } else {
            return false;
        }
    }
    return true; // Context already exists
}

window.applyWikidataMatchDirectly = function(matchId) {
    // Ensure context is available
    if (!ensureWikidataModalContext()) {
        return;
    }
    
    // Get match details from DOM
    const escapedId = CSS.escape ? CSS.escape(matchId) : matchId.replace(/(["\\\n\r\t])/g, '\\$1');
    const matchElement = document.querySelector(`[data-match-id="${escapedId}"]`);
    
    if (!matchElement) {
        return;
    }
    
    // Try both class selectors for compatibility
    const matchLabelElement = matchElement.querySelector('.match-label') || matchElement.querySelector('.match-name');
    const matchDescriptionElement = matchElement.querySelector('.match-description');
    
    const matchLabel = matchLabelElement?.textContent || 'Unknown';
    const matchDescription = matchDescriptionElement?.textContent || 'No description';
    
    // Directly apply the match instead of just storing and enabling confirm button
    if (typeof window.selectMatchAndAdvance === 'function') {
        window.selectMatchAndAdvance(matchId);
    } else if (typeof window.markCellAsReconciled === 'function' && window.currentModalContext) {
        window.markCellAsReconciled(window.currentModalContext, {
            type: 'wikidata',
            id: matchId,
            label: matchLabel,
            description: matchDescription
        });
        window.closeReconciliationModal();
    } else {
        // Fallback to legacy behavior
        window.selectedMatch = {
            id: matchId,
            label: matchLabel,
            description: matchDescription
        };
        
        // Enable confirm button
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
        
        // Visual feedback - highlight selected match
        document.querySelectorAll('.wikidata-match-item').forEach(item => {
            item.classList.remove('selected');
        });
        matchElement.classList.add('selected');
    }
};

window.showAllWikidataMatches = async function() {
    const value = window.currentModalContext?.originalValue;
    if (!value) return;
    
    const matchesContainer = document.getElementById('existing-matches');
    if (!matchesContainer) return;
    
    try {
        let matches = window.currentModalContext?.existingMatches;
        
        // If no existing matches, search for new ones
        if (!matches || matches.length === 0) {
            matches = await searchWikidataEntities(value);
        }
        
        if (matches && matches.length > 0) {
            matchesContainer.innerHTML = `
                <div class="section-title">All Matches</div>
                <div class="matches-list">
                    ${matches.map(match => createWikidataMatchItem(match)).join('')}
                </div>
                <button class="btn btn-link" onclick="showTopWikidataMatches()">Show fewer matches</button>
            `;
        }
    } catch (error) {
        console.error('Error showing all Wikidata matches:', error);
    }
};

window.showTopWikidataMatches = function() {
    const value = window.currentModalContext?.originalValue;
    if (value) {
        const existingMatches = window.currentModalContext?.existingMatches;
        loadWikidataItemMatches(value, existingMatches);
    }
};

window.confirmWikidataSelection = function() {
    if (!window.currentModalContext || !window.selectedMatch) {
        return;
    }

    // Call the global selectMatchAndAdvance function that should be set up by the reconciliation system
    if (typeof window.selectMatchAndAdvance === 'function') {
        window.selectMatchAndAdvance(window.selectedMatch.id);
    } else {
        if (typeof window.closeReconciliationModal === 'function') {
            window.closeReconciliationModal();
        }
    }
};

window.skipWikidataReconciliation = function() {
    // Use the existing skipReconciliation function for proper state management and UI updates
    if (typeof window.skipReconciliation === 'function') {
        window.skipReconciliation();
    } else {
        console.warn('skipReconciliation function not available');
        if (typeof window.closeReconciliationModal === 'function') {
            window.closeReconciliationModal();
        }
    }
};

window.useAsLiteralString = function() {
    if (typeof window.closeReconciliationModal === 'function') {
        window.closeReconciliationModal();
    }
};