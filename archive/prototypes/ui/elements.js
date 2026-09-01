/**
 * Reference to all DOM elements used in the application
 */
export function initElements() {
    return {
        baseUrlInput: document.getElementById('baseUrl'),
        resourceTypeSelect: document.getElementById('resourceType'),
        itemSetIdInput: document.getElementById('itemSetId'),
        searchQueryInput: document.getElementById('searchQuery'),
        pageInput: document.getElementById('page'),
        perPageInput: document.getElementById('perPage'),
        filtersDiv: document.getElementById('filters'),
        addFilterBtn: document.getElementById('addFilterBtn'),
        fetchBtn: document.getElementById('fetchBtn'),
        tabsContainer: document.getElementById('tabs-container'),
        tabsList: document.getElementById('tabs-list'),
        tabsContent: document.getElementById('tabs-content'),
        loadingDiv: document.getElementById('loading'),
        advancedOptionsBtn: document.getElementById('advancedOptionsBtn'),
        queryParamsSection: document.getElementById('queryParamsSection'),
        removeExtractedTextCheckbox: document.getElementById('removeExtractedText')
    };
}