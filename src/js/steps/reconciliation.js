/**
 * Handles the Reconciliation step functionality
 * Manages the process of reconciling Omeka S values with Wikidata entities
 * Implements OpenRefine-style reconciliation interface with modal-based workflow
 */

import { setupModalUI } from '../ui/modal-ui.js';
import { detectPropertyType, getInputFieldConfig, createInputHTML, validateInput, getSuggestedEntityTypes, setupDynamicDatePrecision, standardizeDateInput } from '../utils/property-types.js';
import { eventSystem } from '../events.js';
import { getMockItemsData, getMockMappingData } from '../data/mock-data.js';

export function setupReconciliationStep(state) {
    console.log('🔧 Setting up ReconciliationStep module');
    
    // Initialize modal UI
    const modalUI = setupModalUI();
    
    // Listen for STEP_CHANGED events to initialize reconciliation when entering step 3
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        console.log('🎯 STEP_CHANGED event received:', data);
        if (data.newStep === 3) {
            console.log('🎯 Entering step 3 - calling initializeReconciliation()');
            setTimeout(() => {
                initializeReconciliation();
            }, 100); // Small delay to ensure DOM is updated
        }
    });
    
    // Initialize DOM elements
    const propertyHeaders = document.getElementById('property-headers');
    const reconciliationRows = document.getElementById('reconciliation-rows');
    const reconciliationProgress = document.getElementById('reconciliation-progress');
    const reconcileNextBtn = document.getElementById('reconcile-next');
    const proceedToDesignerBtn = document.getElementById('proceed-to-designer');
    const testReconciliationModelBtn = document.getElementById('test-reconciliation-model');
    
    // Debug DOM element initialization
    console.log('🔧 ReconciliationStep DOM elements initialized:');
    console.log('  - propertyHeaders:', !!propertyHeaders, propertyHeaders);
    console.log('  - reconciliationRows:', !!reconciliationRows, reconciliationRows);
    console.log('  - reconciliationProgress:', !!reconciliationProgress, reconciliationProgress);
    console.log('  - reconcileNextBtn:', !!reconcileNextBtn, reconcileNextBtn);
    console.log('  - proceedToDesignerBtn:', !!proceedToDesignerBtn, proceedToDesignerBtn);
    console.log('  - testReconciliationModelBtn:', !!testReconciliationModelBtn, testReconciliationModelBtn);
    
    // Reconciliation state management
    let reconciliationData = {};
    let currentReconciliationCell = null;
    let contextSuggestions = new Map(); // Store previously selected values for suggestions
    
    // Initialize reconciliation data when entering this step
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🎯 ReconciliationStep: DOM loaded, setting up event listeners');
        
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            console.log(`🎯 Adding click listener to step ${step.dataset.step}`);
            step.addEventListener('click', () => {
                const stepNumber = parseInt(step.dataset.step);
                console.log(`🎯 Step ${stepNumber} clicked`);
                if (stepNumber === 3) {
                    console.log('🎯 Step 3 clicked - calling initializeReconciliation()');
                    initializeReconciliation();
                }
            });
        });
        
        // Also listen for the navigation button
        const proceedBtn = document.getElementById('proceed-to-reconciliation');
        if (proceedBtn) {
            console.log('🎯 Found proceed-to-reconciliation button, adding listener');
            proceedBtn.addEventListener('click', () => {
                console.log('🎯 proceed-to-reconciliation button clicked - calling initializeReconciliation()');
                initializeReconciliation();
            });
        } else {
            console.warn('🎯 proceed-to-reconciliation button not found!');
        }
    });
    
    // Reconcile next item button - now processes next unreconciled cell
    if (reconcileNextBtn) {
        reconcileNextBtn.addEventListener('click', () => {
            reconcileNextUnprocessedCell();
        });
    }
    
    // Test reconciliation model button for debugging
    if (testReconciliationModelBtn) {
        testReconciliationModelBtn.addEventListener('click', () => {
            console.log('🧪 Test reconciliation button clicked - loading mock data');
            loadMockDataForTesting();
        });
    }
    
    /**
     * Initialize reconciliation interface based on fetched data and mappings
     */
    function initializeReconciliation() {
        console.log('🚀 initializeReconciliation() called');
        const currentState = state.getState();
        console.log('🚀 Current state:', currentState);
        
        if (!currentState.mappings || !currentState.mappings.mappedKeys || !currentState.mappings.mappedKeys.length) {
            console.warn('❌ No mapped keys available for reconciliation');
            console.warn('❌ Current mappings:', currentState.mappings);
            return;
        }
        
        if (!currentState.fetchedData) {
            console.warn('❌ No fetched data available for reconciliation');
            console.warn('❌ Current fetchedData:', currentState.fetchedData);
            return;
        }
        
        console.log('✅ Validation passed - proceeding with reconciliation initialization');
        console.log('✅ Mapped keys:', currentState.mappings.mappedKeys);
        console.log('✅ Fetched data type:', typeof currentState.fetchedData);
        console.log('✅ Fetched data structure:', currentState.fetchedData);
        
        const mappedKeys = currentState.mappings.mappedKeys;
        const data = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
        console.log('✅ Data array:', data);
        console.log('✅ Data length:', data.length);
        
        // Initialize reconciliation progress
        const totalCells = calculateTotalReconciliableCells(data, mappedKeys);
        console.log('✅ Total reconcilable cells:', totalCells);
        state.updateState('reconciliationProgress', {
            total: totalCells,
            completed: 0,
            skipped: 0
        });
        
        // Initialize reconciliation data structure
        reconciliationData = {};
        data.forEach((item, index) => {
            const itemId = `item-${index}`;
            reconciliationData[itemId] = {
                originalData: item,
                properties: {}
            };
            
            // Initialize each mapped property
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const values = extractPropertyValues(item, keyName);
                reconciliationData[itemId].properties[keyName] = {
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
        console.log('✅ Creating reconciliation table...');
        createReconciliationTable(data, mappedKeys);
        
        // Update state
        console.log('✅ Updating state with reconciliation data...');
        state.updateState('reconciliationData', reconciliationData);
        
        // Enable/disable proceed button
        console.log('✅ Updating proceed button...');
        updateProceedButton();
        
        console.log('🎉 Reconciliation initialization completed successfully!');
    }
    
    /**
     * Load mock data for testing purposes
     */
    function loadMockDataForTesting() {
        console.log('🧪 Loading mock data for testing reconciliation...');
        
        const mockItems = getMockItemsData();
        const mockMapping = getMockMappingData();
        
        // Update state with mock data
        state.updateState('fetchedData', mockItems.items);
        state.updateState('mappings.mappedKeys', mockMapping.mappings.mappedKeys);
        state.updateState('mappings.nonLinkedKeys', mockMapping.mappings.nonLinkedKeys);
        state.updateState('mappings.ignoredKeys', mockMapping.mappings.ignoredKeys);
        
        console.log('🧪 Mock data loaded, calling initializeReconciliation()');
        
        // Initialize reconciliation with mock data
        setTimeout(() => {
            initializeReconciliation();
        }, 100);
    }
    
    /**
     * Calculate total number of reconcilable cells
     */
    function calculateTotalReconciliableCells(data, mappedKeys) {
        let total = 0;
        data.forEach(item => {
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const values = extractPropertyValues(item, keyName);
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
        console.log('🔨 Creating reconciliation table with data:', data.length, 'items and', mappedKeys.length, 'mapped keys');
        console.log('🔨 Property headers element:', propertyHeaders);
        console.log('🔨 Reconciliation rows element:', reconciliationRows);
        
        // Clear existing content
        if (propertyHeaders) {
            console.log('🔨 Clearing property headers');
            propertyHeaders.innerHTML = '';
            
            // Add item header
            const itemHeader = document.createElement('th');
            itemHeader.textContent = 'Item';
            itemHeader.className = 'item-header';
            propertyHeaders.appendChild(itemHeader);
            
            // Add property headers
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const th = document.createElement('th');
                th.textContent = keyName;
                th.className = 'property-header';
                th.dataset.property = keyName;
                propertyHeaders.appendChild(th);
            });
        }
        
        // Create item rows
        if (reconciliationRows) {
            console.log('🔨 Clearing and creating reconciliation rows');
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
                mappedKeys.forEach(keyObj => {
                    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                    const values = extractPropertyValues(item, keyName);
                    
                    if (values.length === 0) {
                        // Empty cell
                        const td = document.createElement('td');
                        td.className = 'property-cell empty-cell';
                        td.textContent = '—';
                        tr.appendChild(td);
                    } else if (values.length === 1) {
                        // Single value cell
                        const td = createPropertyCell(itemId, keyName, 0, values[0]);
                        tr.appendChild(td);
                    } else {
                        // Multiple values cell
                        const td = document.createElement('td');
                        td.className = 'property-cell multi-value-cell';
                        td.dataset.itemId = itemId;
                        td.dataset.property = keyName;
                        
                        values.forEach((value, valueIndex) => {
                            const valueDiv = createValueElement(itemId, keyName, valueIndex, value);
                            td.appendChild(valueDiv);
                        });
                        
                        tr.appendChild(td);
                    }
                });
                
                reconciliationRows.appendChild(tr);
            });
            console.log('🔨 Added', data.length, 'rows to reconciliation table');
        } else {
            console.error('🔨 reconciliationRows element not found!');
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
            const currentState = state.getState();
            const { total, completed, skipped } = currentState.reconciliationProgress;
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
            const currentState = state.getState();
            const canProceed = currentState.reconciliationProgress.completed + currentState.reconciliationProgress.skipped >= currentState.reconciliationProgress.total && 
                              currentState.reconciliationProgress.total > 0;
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
        modalUI.openModal('Reconcile Value', modalContent, [], () => {
            currentReconciliationCell = null;
        });
        
        // Setup dynamic date precision for any date inputs in the modal
        const modalElement = document.querySelector('.modal-overlay .modal-content');
        if (modalElement) {
            setupDynamicDatePrecision(modalElement);
        }
        
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
                        <button class="btn small secondary type-override-btn" onclick="showTypeOverride()">Change Type</button>
                    </p>
                    <div class="type-override-section" style="display: none;">
                        <h5>Override Property Type</h5>
                        <p>Choose a different data type for this property:</p>
                        <select class="type-override-select">
                            <option value="wikibase-item" ${propertyType === 'wikibase-item' ? 'selected' : ''}>Wikidata Item (Q-ID)</option>
                            <option value="string" ${propertyType === 'string' ? 'selected' : ''}>Text String</option>
                            <option value="external-id" ${propertyType === 'external-id' ? 'selected' : ''}>External Identifier</option>
                            <option value="url" ${propertyType === 'url' ? 'selected' : ''}>URL</option>
                            <option value="quantity" ${propertyType === 'quantity' ? 'selected' : ''}>Number/Quantity</option>
                            <option value="time" ${propertyType === 'time' ? 'selected' : ''}>Date/Time</option>
                            <option value="monolingualtext" ${propertyType === 'monolingualtext' ? 'selected' : ''}>Text with Language</option>
                            <option value="globe-coordinate" ${propertyType === 'globe-coordinate' ? 'selected' : ''}>Coordinates</option>
                        </select>
                        <button class="btn small primary" onclick="applyTypeOverride()">Apply</button>
                        <button class="btn small secondary" onclick="cancelTypeOverride()">Cancel</button>
                    </div>
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
                score: match.score,
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
            modalUI.closeModal();
            
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
                
                modalUI.closeModal();
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
                        // Standardize the date input and get precision
                        const standardized = standardizeDateInput(dateInput.value);
                        customValue = standardized.date;
                        
                        // Use detected precision if not manually overridden
                        const precisionSelect = inputContainer.querySelector('.precision-select');
                        const calendarSelect = inputContainer.querySelector('.calendar-select');
                        
                        if (precisionSelect && precisionSelect.value) {
                            qualifiers.precision = precisionSelect.value;
                        } else if (standardized.precision) {
                            // Use automatically detected precision
                            qualifiers.precision = standardized.precision;
                        }
                        
                        if (calendarSelect && calendarSelect.value) {
                            qualifiers.calendar = calendarSelect.value;
                        }
                        
                        // Store the display value for reference
                        if (standardized.displayValue) {
                            qualifiers.displayValue = standardized.displayValue;
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
                    
                    modalUI.closeModal();
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
        const currentState = state.getState();
        state.updateState('reconciliationProgress.completed', currentState.reconciliationProgress.completed + 1);
        updateProgressDisplay();
        
        // Store in context suggestions
        if (reconciliation.type === 'wikidata') {
            contextSuggestions.set(property, reconciliation);
        }
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
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
        const currentState = state.getState();
        state.updateState('reconciliationProgress.skipped', currentState.reconciliationProgress.skipped + 1);
        updateProgressDisplay();
        
        // Update state
        state.updateState('reconciliationData', reconciliationData);
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
    
    /**
     * Debug function to check reconciliation step state
     * Can be called from browser console: window.debugReconciliation()
     */
    function debugReconciliationStep() {
        console.log('🔍=== RECONCILIATION DEBUG REPORT ===');
        
        // Check DOM elements
        console.log('🔍 DOM Elements:');
        console.log('  - propertyHeaders:', propertyHeaders);
        console.log('  - reconciliationRows:', reconciliationRows);
        console.log('  - reconciliationProgress:', reconciliationProgress);
        console.log('  - reconcileNextBtn:', reconcileNextBtn);
        console.log('  - proceedToDesignerBtn:', proceedToDesignerBtn);
        console.log('  - testReconciliationModelBtn:', testReconciliationModelBtn);
        
        // Check state
        const currentState = state.getState();
        console.log('🔍 State:');
        console.log('  - Current step:', currentState.currentStep);
        console.log('  - Has fetchedData:', !!currentState.fetchedData);
        console.log('  - fetchedData type:', typeof currentState.fetchedData);
        console.log('  - fetchedData length:', Array.isArray(currentState.fetchedData) ? currentState.fetchedData.length : 'not array');
        console.log('  - Has mappings:', !!currentState.mappings);
        console.log('  - mappedKeys count:', currentState.mappings?.mappedKeys?.length || 0);
        console.log('  - mappedKeys:', currentState.mappings?.mappedKeys);
        console.log('  - Test mode:', currentState.testMode);
        
        // Check reconciliation data
        console.log('🔍 Reconciliation Data:');
        console.log('  - reconciliationData object keys:', Object.keys(reconciliationData));
        console.log('  - reconciliationData:', reconciliationData);
        
        console.log('🔍=== END DEBUG REPORT ===');
        
        return {
            domElements: {
                propertyHeaders,
                reconciliationRows,
                reconciliationProgress,
                reconcileNextBtn,
                proceedToDesignerBtn
            },
            state: currentState,
            reconciliationData
        };
    }
    
    // Expose debug function globally for console access
    window.debugReconciliation = debugReconciliationStep;
    window.loadMockReconciliationData = loadMockDataForTesting;
    window.initializeReconciliationManually = initializeReconciliation;
    
    // Type override functions
    window.showTypeOverride = function() {
        const overrideSection = document.querySelector('.type-override-section');
        if (overrideSection) {
            overrideSection.style.display = 'block';
        }
    };
    
    window.cancelTypeOverride = function() {
        const overrideSection = document.querySelector('.type-override-section');
        if (overrideSection) {
            overrideSection.style.display = 'none';
        }
    };
    
    window.applyTypeOverride = function() {
        const select = document.querySelector('.type-override-select');
        const overrideSection = document.querySelector('.type-override-section');
        const optionsContainer = document.querySelector('.reconciliation-options');
        
        if (!select || !select.value) return;
        
        const newType = select.value;
        console.log('🔄 Applying type override:', newType);
        
        // Get current property and value from the modal context
        if (!currentReconciliationCell) return;
        
        const { property, value } = currentReconciliationCell;
        
        // Update the property type info display
        const typeValueSpan = document.querySelector('.property-type-value');
        const inputConfig = getInputFieldConfig(newType);
        if (typeValueSpan) {
            typeValueSpan.textContent = inputConfig.description;
        }
        
        // Recreate the tabs and content with the new type
        const newTabsHTML = `
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
                    ${createInputHTML(newType, value, property)}
                    ${inputConfig.requiresReconciliation ? 
                        '<p class="note">This will be used as a literal value without Wikidata linking.</p>' : 
                        ''
                    }
                </div>
            </div>
        `;
        
        // Update the options container
        if (optionsContainer) {
            optionsContainer.innerHTML = newTabsHTML;
            
            // Setup dynamic date precision for any new date inputs
            setupDynamicDatePrecision(optionsContainer);
            
            // If the new type requires reconciliation, start automatic search
            if (inputConfig.requiresReconciliation) {
                performAutomaticReconciliation(value, property);
            }
            
            // Set up manual search if manual tab exists
            const manualTab = document.getElementById('manual-tab');
            if (manualTab) {
                setTimeout(() => setupManualSearch(), 100);
            }
        }
        
        // Hide the override section
        if (overrideSection) {
            overrideSection.style.display = 'none';
        }
        
        console.log('✅ Type override applied successfully');
    };
    
    // Return public API if needed
    return {
        debugReconciliationStep,
        loadMockDataForTesting,
        initializeReconciliation
    };
}