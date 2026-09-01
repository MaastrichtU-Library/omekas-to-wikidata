/**
 * Link Item Modal
 * @module reconciliation/ui/modals/link-item-modal
 *
 * Modal interface for linking items to existing Wikidata items.
 * When an item is linked, it will UPDATE the existing Wikidata item
 * instead of creating a new one during export.
 *
 * Features:
 * - Search for Wikidata items by label
 * - Display results with label, QID, and description
 * - Click to select and link item
 * - Linked items are saved in application state
 */

import { searchWikidataEntities, createWikidataMatchItem } from './wikidata-item-modal.js';

/**
 * Create link item modal content
 * @param {string} itemId - Item ID (e.g., 'item-0')
 * @param {number} itemNumber - Item number for display (e.g., 1 for 'item-0')
 * @param {string} currentQid - Currently linked QID, if any
 * @returns {HTMLElement} Modal content element
 */
export function createLinkItemModal(itemId, itemNumber, currentQid = null) {
    const modalContent = document.createElement('div');
    modalContent.className = 'link-item-modal';

    // Store context for modal interactions
    modalContent.dataset.modalType = 'link-item';
    modalContent.dataset.itemId = itemId;
    modalContent.dataset.itemNumber = itemNumber;
    if (currentQid) {
        modalContent.dataset.currentQid = currentQid;
    }

    modalContent.innerHTML = `
        <p class="modal-description" style="margin-bottom: 1.5rem;">Search to check if this item already exists on Wikidata. If found, link it to avoid creating a duplicate.</p>

        ${currentQid ? `
            <div class="current-link-display" style="margin-bottom: 1.5rem;">
                <div class="section-title">Currently Linked To</div>
                <div class="linked-item-display">
                    <a href="https://www.wikidata.org/wiki/${escapeHtml(currentQid)}" target="_blank" class="linked-qid">${escapeHtml(currentQid)}</a>
                </div>
            </div>
        ` : ''}

        <div class="search-section">
            <div class="search-container" style="margin-bottom: 1rem;">
                <input type="text" id="link-item-search" class="search-input"
                       placeholder="Type to search (e.g., 'Albert Einstein', 'painting', 'Q12345')" style="width: 100%;">
            </div>
            <div class="search-results" id="link-search-results"></div>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeLinkItemModal()">Cancel</button>
        </div>
    `;

    return modalContent;
}

/**
 * Initialize link item modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element
 */
export function initializeLinkItemModal(modalElement) {
    const itemId = modalElement.dataset.itemId;
    const itemNumber = modalElement.dataset.itemNumber;
    const currentQid = modalElement.dataset.currentQid || null;

    // Store modal context globally for interaction handlers
    window.currentLinkItemContext = {
        itemId: itemId,
        itemNumber: itemNumber,
        currentQid: currentQid,
        modalType: 'link-item'
    };

    // Set up keystroke-based search with debounce
    const searchInput = document.getElementById('link-item-search');
    if (searchInput) {
        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            // Clear previous timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            // Set new timeout to search after 300ms of no typing
            searchTimeout = setTimeout(() => {
                window.performLinkItemSearch();
            }, 300);
        });

        // Focus the search input
        setTimeout(() => searchInput.focus(), 100);
    }
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

/**
 * Create a Wikidata result item for link item modal
 * @param {Object} result - Result object with id, label, description
 * @returns {string} HTML string for result item
 */
function createLinkItemResult(result) {
    const safeId = escapeHtml(result.id);
    const jsEscapedId = result.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const label = escapeHtml(result.label || 'Unnamed');
    const description = result.description ? escapeHtml(result.description) : '';

    return `
        <div class="wikidata-match-item link-item-result" data-qid="${safeId}" onclick="selectLinkItem('${jsEscapedId}')">
            <div class="match-content">
                <div class="match-title">
                    ${label} <span class="match-qid-inline">(${safeId})</span>
                </div>
                ${description ? `<div class="match-description">${description}</div>` : ''}
            </div>
        </div>
    `;
}

// Global interaction handlers for link item modal

/**
 * Perform search for Wikidata items
 */
window.performLinkItemSearch = async function() {
    const searchInput = document.getElementById('link-item-search');
    const resultsContainer = document.getElementById('link-search-results');

    if (!searchInput || !resultsContainer) return;

    const query = searchInput.value.trim();
    if (!query) {
        resultsContainer.innerHTML = '';
        return;
    }

    resultsContainer.innerHTML = '<div class="loading">Searching Wikidata...</div>';

    try {
        const results = await searchWikidataEntities(query);

        if (results && results.length > 0) {
            resultsContainer.innerHTML = `
                <div class="results-list">
                    ${results.map(result => createLinkItemResult(result)).join('')}
                </div>
            `;
        } else {
            resultsContainer.innerHTML = '<div class="no-results">No items found. Try a different search query.</div>';
        }
    } catch (error) {
        console.error('Link item search failed:', error);
        resultsContainer.innerHTML = '<div class="error">Search failed. Please try again.</div>';
    }
};

/**
 * Select a Wikidata item to link
 * @param {string} qid - Wikidata QID to link
 */
window.selectLinkItem = function(qid) {
    if (!window.currentLinkItemContext) {
        console.error('No link item context available');
        return;
    }

    const { itemId, itemNumber } = window.currentLinkItemContext;

    // Call the callback function if provided
    if (window.onItemLinked) {
        window.onItemLinked(itemId, qid, itemNumber);
    }

    // Close the modal
    window.closeLinkItemModal();
};

/**
 * Close the link item modal
 */
window.closeLinkItemModal = function() {
    // Clean up global context
    delete window.currentLinkItemContext;

    // Close the modal using the global close function
    if (window.closeModal) {
        window.closeModal();
    }
};
