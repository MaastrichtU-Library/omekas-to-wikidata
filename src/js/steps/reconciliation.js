/**
 * Handles the Reconciliation step functionality
 * Manages the process of reconciling Omeka S values with Wikidata entities
 * Implements OpenRefine-style reconciliation interface with modal-based workflow
 */

import { openModal, closeModal } from '../modals.js';
import { detectPropertyType, getInputFieldConfig, createInputHTML, validateInput, getSuggestedEntityTypes } from '../utils/property-types.js';

export function setupReconciliationStep(state) {
    // Initialize DOM elements
    const propertyHeaders = document.getElementById('property-headers');
    const reconciliationRows = document.getElementById('reconciliation-rows');
    const reconciliationProgress = document.getElementById('reconciliation-progress');
    const reconcileNextBtn = document.getElementById('reconcile-next');
    const proceedToDesignerBtn = document.getElementById('proceed-to-designer');
    const testReconciliationModelBtn = document.getElementById('test-reconciliation-model');
    
    // Reconciliation state management
    let reconciliationData = {};
    let currentReconciliationCell = null;
    let contextSuggestions = new Map(); // Store previously selected values for suggestions
    
    // Initialize reconciliation data when entering this step
    document.addEventListener('DOMContentLoaded', () => {
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 3) {
                    initializeReconciliation();
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-reconciliation')?.addEventListener('click', () => {
            initializeReconciliation();
        });
    });
    
    // Reconcile next item button - now processes next unreconciled cell
    if (reconcileNextBtn) {
        reconcileNextBtn.addEventListener('click', () => {
            reconcileNextUnprocessedCell();
        });
    }
    
    /**
     * Initialize reconciliation interface based on fetched data and mappings
     */
    function initializeReconciliation() {
        if (!state.mappings || !state.mappings.mappedKeys || !state.mappings.mappedKeys.length) {
            console.warn('No mapped keys available for reconciliation');
            return;
        }
        
        if (!state.fetchedData) {
            console.warn('No fetched data available for reconciliation');
            return;
        }
        
        const mappedKeys = state.mappings.mappedKeys;
        const data = Array.isArray(state.fetchedData) ? state.fetchedData : [state.fetchedData];
        
        // Initialize reconciliation progress
        const totalCells = calculateTotalReconciliableCells(data, mappedKeys);
        state.reconciliationProgress = {
            total: totalCells,
            completed: 0,
            skipped: 0
        };
        
        // Initialize reconciliation data structure
        reconciliationData = {};
        data.forEach((item, index) => {
            const itemId = `item-${index}`;
            reconciliationData[itemId] = {
                originalData: item,
                properties: {}
            };
            
            // Initialize each mapped property
            mappedKeys.forEach(key => {
                const values = extractPropertyValues(item, key);
                reconciliationData[itemId].properties[key] = {
                    originalValues: values,
                    reconciled: values.map(() => ({
                        status: 'pending', // pending, reconciled, skipped, failed
                        matches: [],
                        selectedMatch: null,
                        manualValue: null,
                        qualifiers: {},
                        confidence: 0
                    }))
                };
            });
        });
        
        // Update progress display
        updateProgressDisplay();
        
        // Create reconciliation table
        createReconciliationTable(data, mappedKeys);
        
        // Update state
        state.reconciliationData = reconciliationData;
        
        // Enable/disable proceed button
        updateProceedButton();
    }
    
    /**
     * Calculate total number of reconcilable cells
     */
    function calculateTotalReconciliableCells(data, mappedKeys) {
        let total = 0;
        data.forEach(item => {
            mappedKeys.forEach(key => {
                const values = extractPropertyValues(item, key);
                total += values.length;
            });
        });
        return total;
    }
    
    /**
     * Extract property values from an item, handling multiple values
     */
    function extractPropertyValues(item, key) {
        const value = item[key];
        if (!value) return [];
        
        // Handle different data structures
        if (Array.isArray(value)) {
            return value.map(v => {
                if (typeof v === 'object' && v['o:label']) {
                    return v['o:label'];
                } else if (typeof v === 'object' && v['@value']) {
                    return v['@value'];
                } else if (typeof v === 'string') {
                    return v;
                } else {
                    return String(v);
                }
            });
        } else if (typeof value === 'object' && value['o:label']) {
            return [value['o:label']];
        } else if (typeof value === 'object' && value['@value']) {
            return [value['@value']];
        } else {
            return [String(value)];
        }
    }
    
    /**
     * Create the reconciliation table interface
     */
    function createReconciliationTable(data, mappedKeys) {
        // Clear existing content
        if (propertyHeaders) {
            propertyHeaders.innerHTML = '';
            
            // Add item header
            const itemHeader = document.createElement('th');
            itemHeader.textContent = 'Item';
            itemHeader.className = 'item-header';
            propertyHeaders.appendChild(itemHeader);
            
            // Add property headers
            mappedKeys.forEach(key => {
                const th = document.createElement('th');
                th.textContent = key;
                th.className = 'property-header';
                th.dataset.property = key;
                propertyHeaders.appendChild(th);
            });
        }
        
        // Create item rows
        if (reconciliationRows) {
            reconciliationRows.innerHTML = '';
            
            data.forEach((item, index) => {
                const itemId = `item-${index}`;
                const tr = document.createElement('tr');
                tr.id = `row-${itemId}`;
                tr.className = 'reconciliation-row';
                
                // Add item cell
                const itemCell = document.createElement('td');
                itemCell.className = 'item-cell';
                const itemTitle = item['o:title'] || item['title'] || `Item ${index + 1}`;
                itemCell.textContent = itemTitle;
                tr.appendChild(itemCell);
                
                // Add property cells
                mappedKeys.forEach(key => {
                    const values = extractPropertyValues(item, key);
                    
                    if (values.length === 0) {
                        // Empty cell
                        const td = document.createElement('td');
                        td.className = 'property-cell empty-cell';
                        td.textContent = '—';
                        tr.appendChild(td);
                    } else if (values.length === 1) {
                        // Single value cell
                        const td = createPropertyCell(itemId, key, 0, values[0]);
                        tr.appendChild(td);
                    } else {
                        // Multiple values cell
                        const td = document.createElement('td');
                        td.className = 'property-cell multi-value-cell';
                        td.dataset.itemId = itemId;
                        td.dataset.property = key;
                        
                        values.forEach((value, valueIndex) => {
                            const valueDiv = createValueElement(itemId, key, valueIndex, value);
                            td.appendChild(valueDiv);
                        });
                        
                        tr.appendChild(td);
                    }
                });
                
                reconciliationRows.appendChild(tr);
            });
        }
    }
    
    /**
     * Create a property cell for the reconciliation table
     */
    function createPropertyCell(itemId, property, valueIndex, value) {
        const td = document.createElement('td');
        td.className = 'property-cell single-value-cell';
        td.dataset.itemId = itemId;
        td.dataset.property = property;
        td.dataset.valueIndex = valueIndex;
        
        const valueDiv = createValueElement(itemId, property, valueIndex, value);
        td.appendChild(valueDiv);
        
        return td;
    }
    
    /**
     * Create a value element within a property cell
     */
    function createValueElement(itemId, property, valueIndex, value) {
        const valueDiv = document.createElement('div');
        valueDiv.className = 'property-value';
        valueDiv.dataset.status = 'pending';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'value-text';
        textSpan.textContent = value || 'Empty value';
        
        const statusSpan = document.createElement('span');
        statusSpan.className = 'value-status';
        statusSpan.textContent = 'Click to reconcile';
        
        valueDiv.appendChild(textSpan);
        valueDiv.appendChild(statusSpan);
        
        // Add click handler
        valueDiv.addEventListener('click', () => {
            openReconciliationModal(itemId, property, valueIndex, value);
        });
        
        // Add keyboard support
        valueDiv.setAttribute('tabindex', '0');
        valueDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openReconciliationModal(itemId, property, valueIndex, value);
            }
        });
        
        return valueDiv;
    }
    
    /**
     * Update progress display
     */
    function updateProgressDisplay() {
        if (reconciliationProgress) {
            const { total, completed, skipped } = state.reconciliationProgress;
            const remaining = total - completed - skipped;
            reconciliationProgress.innerHTML = `
                <div class="progress-stats">
                    <span class="stat completed">${completed} completed</span>
                    <span class="stat skipped">${skipped} skipped</span>
                    <span class="stat remaining">${remaining} remaining</span>
                    <span class="stat total">of ${total} total</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${total > 0 ? ((completed + skipped) / total * 100) : 0}%"></div>
                </div>
            `;
        }
        
        updateProceedButton();
    }
    
    /**
     * Update proceed button state
     */
    function updateProceedButton() {
        if (proceedToDesignerBtn) {
            const canProceed = state.reconciliationProgress.completed + state.reconciliationProgress.skipped >= state.reconciliationProgress.total && 
                              state.reconciliationProgress.total > 0;
            proceedToDesignerBtn.disabled = !canProceed;
        }
    }
    
    /**
     * Find and reconcile next unprocessed cell
     */
    function reconcileNextUnprocessedCell() {
        // Find first pending cell
        const pendingCell = document.querySelector('.property-value[data-status="pending"]');
        if (pendingCell) {
            pendingCell.click();
        } else {
            alert('No more items to reconcile. You can proceed to the next step.');
        }
    }
    
    /**
     * Open reconciliation modal for a specific property value
     */
    async function openReconciliationModal(itemId, property, valueIndex, value) {
        currentReconciliationCell = { itemId, property, valueIndex, value };
        
        // Create modal content
        const modalContent = createReconciliationModalContent(itemId, property, valueIndex, value);
        
        // Open modal
        openModal('Reconcile Value', modalContent, {
            size: 'large',
            onClose: () => {
                currentReconciliationCell = null;
            }
        });
        
        // Start automatic reconciliation
        await performAutomaticReconciliation(value, property);
    }
    
    /**
     * Create modal content for reconciliation
     */
    function createReconciliationModalContent(itemId, property, valueIndex, value) {
        // Detect property type for dynamic input fields
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        const customInputHTML = createInputHTML(propertyType, value, property);
        
        return `
            <div class="reconciliation-modal">
                <div class="reconciliation-header">
                    <h4>Reconcile: ${property}</h4>
                    <p class="original-value">Original value: <strong>"${value}"</strong></p>
                    <p class="item-context">From item: ${reconciliationData[itemId]?.originalData?.['o:title'] || itemId}</p>
                    <p class="property-type-info">
                        <span class="property-type-label">Expected type:</span> 
                        <span class="property-type-value">${inputConfig.description}</span>
                    </p>
                </div>
                
                <div class="reconciliation-options">
                    <div class="option-tabs">
                        ${inputConfig.requiresReconciliation ? 
                            '<button class="tab-btn active" data-tab="automatic">Automatic Matches</button>' : 
                            ''
                        }
                        ${inputConfig.requiresReconciliation ? 
                            '<button class="tab-btn" data-tab="manual">Manual Search</button>' : 
                            ''
                        }
                        <button class="tab-btn ${!inputConfig.requiresReconciliation ? 'active' : ''}" data-tab="custom">${inputConfig.requiresReconciliation ? 'Custom Value' : 'Enter Value'}</button>
                    </div>
                    
                    ${inputConfig.requiresReconciliation ? `
                        <div class="tab-content active" id="automatic-tab">
                            <div class="loading-indicator">
                                <p>Searching for matches...</p>
                                <div class="spinner"></div>
                            </div>
                            <div class="matches-container" style="display: none;">
                                <div class="matches-list"></div>
                            </div>
                            <div class="no-matches" style="display: none;">
                                <p>No automatic matches found.</p>
                                <button class="btn secondary" onclick="switchTab('manual')">Try Manual Search</button>
                            </div>
                        </div>
                        
                        <div class="tab-content" id="manual-tab">
                            <div class="manual-search">
                                <div class="search-controls">
                                    <input type="text" class="search-input" placeholder="Search Wikidata..." value="${value}">
                                    <button class="btn primary search-btn">Search</button>
                                </div>
                                <div class="search-results"></div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="tab-content ${!inputConfig.requiresReconciliation ? 'active' : ''}" id="custom-tab">
                        <div class="custom-value">
                            ${inputConfig.requiresReconciliation ? 
                                '<p>Enter a custom value if no Wikidata match is appropriate:</p>' : 
                                '<p>Enter the value for this property:</p>'
                            }
                            ${customInputHTML}
                            ${inputConfig.requiresReconciliation ? 
                                '<p class="note">This will be used as a literal value without Wikidata linking.</p>' : 
                                ''
                            }
                        </div>
                    </div>
                </div>
                
                <div class="reconciliation-actions">
                    <button class="btn secondary" onclick="skipReconciliation()">Skip for Later</button>
                    ${inputConfig.requiresReconciliation ? 
                        '<button class="btn secondary" onclick="createNewWikidataItem()">Create New Wikidata Item</button>' : 
                        ''
                    }
                    <button class="btn primary" onclick="confirmReconciliation()" ${!inputConfig.requiresReconciliation ? '' : 'disabled'}>Confirm Selection</button>
                </div>
            </div>
        `;
    }
    
    /**
     * Perform automatic reconciliation using Wikidata APIs
     */
    async function performAutomaticReconciliation(value, property) {
        // Check if this property type requires reconciliation
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        
        if (!inputConfig.requiresReconciliation) {
            // For non-reconciliation properties, just show the custom input
            const loadingIndicator = document.querySelector('.loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            return;
        }
        
        try {
            // Try reconciliation API first
            let matches = await tryReconciliationApi(value, property);
            
            // If no good matches, try direct Wikidata search
            if (!matches || matches.length === 0) {
                matches = await tryDirectWikidataSearch(value);
            }
            
            displayAutomaticMatches(matches);
            
        } catch (error) {
            console.error('Error during automatic reconciliation:', error);
            displayReconciliationError(error);
        }
    }
    
    /**
     * Try Wikidata Reconciliation API
     */
    async function tryReconciliationApi(value, property) {
        const reconApiUrl = 'https://wikidata.reconci.link/en/api';
        
        // Get suggested entity types based on property
        const entityTypes = getSuggestedEntityTypes(property);
        
        const query = {
            queries: {
                q1: {
                    query: value,
                    type: entityTypes,
                    properties: []
                }
            }
        };
        
        const requestBody = "queries=" + encodeURIComponent(JSON.stringify(query.queries));
        
        const response = await fetch(reconApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: requestBody
        });
        
        if (!response.ok) {
            throw new Error(`Reconciliation API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.q1 && data.q1.result) {
            return data.q1.result.map(match => ({
                id: match.id,
                name: match.name,
                description: match.description || 'No description available',
                score: match.score * 100,
                type: match.type || [],
                source: 'reconciliation'
            }));
        }
        
        return [];
    }
    
    /**
     * Try direct Wikidata search API
     */
    async function tryDirectWikidataSearch(value) {
        const apiUrl = 'https://www.wikidata.org/w/api.php';
        
        const params = new URLSearchParams({
            action: 'wbsearchentities',
            search: value,
            language: 'en',
            format: 'json',
            origin: '*',
            type: 'item',
            limit: 10
        });
        
        const response = await fetch(`${apiUrl}?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`Wikidata API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.search) {
            return data.search.map(item => ({
                id: item.id,
                name: item.label,
                description: item.description || 'No description available',
                score: 50, // Approximate score for direct search
                type: [],
                source: 'direct'
            }));
        }
        
        return [];
    }
    
    /**
     * Display automatic matches in the modal
     */
    function displayAutomaticMatches(matches) {
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
    function displayReconciliationError(error) {
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
    
    // Global functions for modal interactions (attached to window for onclick handlers)
    window.switchTab = function(tabName) {
        // Switch tab logic
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // If switching to manual tab, set up search
        if (tabName === 'manual') {
            setupManualSearch();
        }
    };
    
    window.selectMatch = function(matchId) {
        // Mark match as selected
        document.querySelectorAll('.match-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-match-id="${matchId}"]`).classList.add('selected');
        
        // Enable confirm button
        const confirmBtn = document.querySelector('.reconciliation-actions .btn.primary');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    };
    
    window.skipReconciliation = function() {
        if (currentReconciliationCell) {
            markCellAsSkipped(currentReconciliationCell);
            closeModal();
            
            // Auto-open next pending cell
            setTimeout(() => {
                reconcileNextUnprocessedCell();
            }, 100);
        }
    };
    
    window.createNewWikidataItem = function() {
        const value = currentReconciliationCell?.value;
        if (value) {
            const url = `https://www.wikidata.org/wiki/Special:NewItem?label=${encodeURIComponent(value)}`;
            window.open(url, '_blank');
        }
    };
    
    window.confirmReconciliation = function() {
        if (currentReconciliationCell) {
            const { property } = currentReconciliationCell;
            const propertyType = detectPropertyType(property);
            const selectedMatch = document.querySelector('.match-item.selected');
            
            // Handle Wikidata entity selection
            if (selectedMatch) {
                const matchId = selectedMatch.dataset.matchId;
                markCellAsReconciled(currentReconciliationCell, {
                    type: 'wikidata',
                    id: matchId,
                    label: selectedMatch.querySelector('.match-name').textContent,
                    description: selectedMatch.querySelector('.match-description').textContent
                });
                
                closeModal();
                setTimeout(() => reconcileNextUnprocessedCell(), 100);
                return;
            }
            
            // Handle custom value input from dynamic fields
            if (document.getElementById('custom-tab').classList.contains('active')) {
                const inputContainer = document.querySelector('.dynamic-input-container');
                let customValue = null;
                let qualifiers = {};
                
                // Extract value based on input type
                if (inputContainer) {
                    const textInput = inputContainer.querySelector('.text-input, .qid-input');
                    const numberInput = inputContainer.querySelector('.number-input');
                    const dateInput = inputContainer.querySelector('.date-input');
                    const urlInput = inputContainer.querySelector('.url-input');
                    const coordinatesInput = inputContainer.querySelector('.coordinates-input');
                    
                    if (textInput) {
                        customValue = textInput.value;
                        
                        // Check for language qualifier
                        const languageSelect = inputContainer.querySelector('.language-select');
                        if (languageSelect && languageSelect.value) {
                            qualifiers.language = languageSelect.value;
                        }
                    } else if (numberInput) {
                        customValue = numberInput.value;
                        
                        // Check for unit qualifier
                        const unitSelect = inputContainer.querySelector('.unit-select');
                        if (unitSelect && unitSelect.value) {
                            qualifiers.unit = unitSelect.value;
                        }
                    } else if (dateInput) {
                        customValue = dateInput.value;
                        
                        // Check for precision and calendar qualifiers
                        const precisionSelect = inputContainer.querySelector('.precision-select');
                        const calendarSelect = inputContainer.querySelector('.calendar-select');
                        
                        if (precisionSelect && precisionSelect.value) {
                            qualifiers.precision = precisionSelect.value;
                        }
                        if (calendarSelect && calendarSelect.value) {
                            qualifiers.calendar = calendarSelect.value;
                        }
                    } else if (urlInput) {
                        customValue = urlInput.value;
                    } else if (coordinatesInput) {
                        customValue = coordinatesInput.value;
                    }
                }
                
                // Fallback to old custom input for backward compatibility
                if (!customValue) {
                    const customInput = document.querySelector('.custom-input');
                    if (customInput) {
                        customValue = customInput.value;
                    }
                }
                
                // Validate the input
                if (customValue) {
                    const validation = validateInput(customValue, propertyType);
                    
                    if (!validation.isValid) {
                        // Show validation error
                        const validationMessage = document.querySelector('.validation-message');
                        if (validationMessage) {
                            validationMessage.textContent = validation.message;
                            validationMessage.style.display = 'block';
                            validationMessage.style.color = 'red';
                        } else {
                            alert(validation.message);
                        }
                        return;
                    }
                    
                    markCellAsReconciled(currentReconciliationCell, {
                        type: 'custom',
                        value: customValue,
                        datatype: propertyType,
                        qualifiers: qualifiers
                    });
                    
                    closeModal();
                    setTimeout(() => reconcileNextUnprocessedCell(), 100);
                } else {
                    alert('Please enter a value or select a match.');
                }
            }
        }
    };
    
    /**
     * Setup manual search functionality
     */
    function setupManualSearch() {
        const searchBtn = document.querySelector('.search-btn');
        const searchInput = document.querySelector('.search-input');
        const searchResults = document.querySelector('.search-results');
        
        const performSearch = async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            
            searchResults.innerHTML = '<div class="loading">Searching...</div>';
            
            try {
                const matches = await tryDirectWikidataSearch(query);
                
                if (matches.length > 0) {
                    searchResults.innerHTML = matches.map(match => `
                        <div class="search-result-item" data-match-id="${match.id}">
                            <div class="result-info">
                                <div class="result-name">${match.name}</div>
                                <div class="result-description">${match.description}</div>
                                <div class="result-id">
                                    <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                                </div>
                            </div>
                            <div class="result-actions">
                                <button class="btn small primary" onclick="selectManualMatch('${match.id}')">Select</button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    searchResults.innerHTML = '<div class="no-results">No results found.</div>';
                }
            } catch (error) {
                searchResults.innerHTML = `<div class="error">Search error: ${error.message}</div>`;
            }
        };
        
        searchBtn.onclick = performSearch;
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        };
    }
    
    window.selectManualMatch = function(matchId) {
        // Mark as selected and enable confirm
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-match-id="${matchId}"]`).classList.add('selected');
        
        const confirmBtn = document.querySelector('.reconciliation-actions .btn.primary');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    };
    
    /**
     * Mark a cell as reconciled
     */
    function markCellAsReconciled(cellInfo, reconciliation) {
        const { itemId, property, valueIndex } = cellInfo;
        
        // Update data structure
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex] = {
                    status: 'reconciled',
                    selectedMatch: reconciliation,
                    matches: [], // Could store all matches for reference
                    confidence: reconciliation.type === 'wikidata' ? 95 : 80
                };
            }
        }
        
        // Update UI
        updateCellDisplay(itemId, property, valueIndex, 'reconciled', reconciliation);
        
        // Update progress
        state.reconciliationProgress.completed++;
        updateProgressDisplay();
        
        // Store in context suggestions
        if (reconciliation.type === 'wikidata') {
            contextSuggestions.set(property, reconciliation);
        }
        
        // Update state
        state.reconciliationData = reconciliationData;
    }
    
    /**
     * Mark a cell as skipped
     */
    function markCellAsSkipped(cellInfo) {
        const { itemId, property, valueIndex } = cellInfo;
        
        // Update data structure
        if (reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            if (propData.reconciled[valueIndex]) {
                propData.reconciled[valueIndex].status = 'skipped';
            }
        }
        
        // Update UI
        updateCellDisplay(itemId, property, valueIndex, 'skipped');
        
        // Update progress
        state.reconciliationProgress.skipped++;
        updateProgressDisplay();
        
        // Update state
        state.reconciliationData = reconciliationData;
    }
    
    /**
     * Update cell display based on reconciliation status
     */
    function updateCellDisplay(itemId, property, valueIndex, status, reconciliation = null) {
        // Find the cell element
        const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
        const cell = document.querySelector(cellSelector);
        
        if (cell) {
            const valueElement = cell.querySelector('.property-value') || 
                               cell.querySelectorAll('.property-value')[valueIndex];
            
            if (valueElement) {
                valueElement.dataset.status = status;
                
                const statusSpan = valueElement.querySelector('.value-status');
                if (statusSpan) {
                    if (status === 'reconciled' && reconciliation) {
                        if (reconciliation.type === 'wikidata') {
                            statusSpan.innerHTML = `✓ <a href="https://www.wikidata.org/wiki/${reconciliation.id}" target="_blank">${reconciliation.id}</a>`;
                        } else {
                            statusSpan.textContent = '✓ Custom value';
                        }
                        statusSpan.className = 'value-status reconciled';
                    } else if (status === 'skipped') {
                        statusSpan.textContent = 'Skipped';
                        statusSpan.className = 'value-status skipped';
                    }
                }
                
                // Remove click handler for reconciled/skipped items
                if (status !== 'pending') {
                    valueElement.style.cursor = 'default';
                    valueElement.onclick = null;
                }
            }
        }
    }
}