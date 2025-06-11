/**
 * Handles the Mapping step functionality
 * Provides UI for mapping Omeka S fields to Wikidata properties
 */
import { eventSystem } from '../events.js';
import { showMessage } from '../ui/components.js';
export function setupMappingStep(state) {
    // Initialize DOM elements
    const entitySchemaInput = document.getElementById('entity-schema');
    const nonLinkedKeysList = document.getElementById('non-linked-keys');
    const mappedKeysList = document.getElementById('mapped-keys');
    const ignoredKeysList = document.getElementById('ignored-keys');
    const proceedToReconciliationBtn = document.getElementById('proceed-to-reconciliation');
    const testMappingModelBtn = document.getElementById('test-mapping-model');
    const loadMappingBtn = document.getElementById('load-mapping');
    const saveMappingBtn = document.getElementById('save-mapping');
    const loadMappingFileInput = document.getElementById('load-mapping-file');
    
    // Set default entity schema
    if (entitySchemaInput && !entitySchemaInput.value) {
        entitySchemaInput.value = 'E473';
        state.updateState('entitySchema', 'E473');
    }
    
    // Listen for step changes via event system
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 2) {
            // Small delay to ensure DOM is ready
            setTimeout(() => populateLists(), 100);
        }
    });
    
    // When we enter this step, populate the lists
    document.addEventListener('DOMContentLoaded', () => {
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 2) {
                    setTimeout(() => populateLists(), 100);
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-mapping')?.addEventListener('click', () => {
            setTimeout(() => populateLists(), 100);
        });
        
        // Check if we're already on step 2 and have data
        if (state.getCurrentStep && state.getCurrentStep() === 2) {
            setTimeout(() => populateLists(), 100);
        }
        
        // Event listener for test modal button is now handled in modals.js
    });
    
    // Entity schema input
    if (entitySchemaInput) {
        entitySchemaInput.addEventListener('change', () => {
            state.updateState('entitySchema', entitySchemaInput.value);
            state.markChangesUnsaved();
        });
    }
    
    // Load mapping functionality
    if (loadMappingBtn && loadMappingFileInput) {
        loadMappingBtn.addEventListener('click', () => {
            loadMappingFileInput.click();
        });
        
        loadMappingFileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const mappingData = JSON.parse(text);
                await loadMappingFromData(mappingData, state);
                
                // Clear the file input for future use
                event.target.value = '';
                
                // Show success message
                console.log('Mapping loaded successfully');
                showMessage('Mapping loaded successfully! Restored ' + mappingData.mappings.mapped.length + ' mapped keys and ' + mappingData.mappings.ignored.length + ' ignored keys.', 'success', 5000);
            } catch (error) {
                console.error('Error loading mapping file:', error);
                showMessage('Error loading mapping file. Please check the file format.', 'error', 5000);
            }
        });
    }
    
    // Save mapping functionality
    if (saveMappingBtn) {
        saveMappingBtn.addEventListener('click', () => {
            const mappingData = generateMappingData(state);
            downloadMappingAsJson(mappingData);
        });
    }
    
    // Cache for fetched contexts to avoid repeated API calls
    const contextCache = new Map();
    
    // Function to fetch and parse @context from URL
    async function fetchContextDefinitions(contextUrl) {
        if (contextCache.has(contextUrl)) {
            return contextCache.get(contextUrl);
        }
        
        try {
            console.log(`Fetching context from: ${contextUrl}`);
            const response = await fetch(contextUrl);
            const contextData = await response.json();
            
            const contextMap = new Map();
            
            // Handle nested @context structure
            let context = contextData;
            if (contextData['@context']) {
                context = contextData['@context'];
            }
            
            if (typeof context === 'object') {
                for (const [prefix, definition] of Object.entries(context)) {
                    if (typeof definition === 'string') {
                        contextMap.set(prefix, definition);
                        console.log(`Remote context mapping: ${prefix} → ${definition}`);
                    } else if (typeof definition === 'object' && definition['@id']) {
                        contextMap.set(prefix, definition['@id']);
                        console.log(`Remote context mapping: ${prefix} → ${definition['@id']}`);
                    }
                }
            }
            
            contextCache.set(contextUrl, contextMap);
            return contextMap;
        } catch (error) {
            console.error(`Failed to fetch context from ${contextUrl}:`, error);
            return new Map();
        }
    }
    
    // Helper function to extract readable sample values from Omeka S structures
    function extractSampleValue(value) {
        if (value === null || value === undefined) {
            return null;
        }
        
        // Handle arrays (common in Omeka S)
        if (Array.isArray(value)) {
            if (value.length === 0) return null;
            
            // Get the first value for sample
            const firstValue = value[0];
            
            // If it's an object with @value, extract that
            if (firstValue && typeof firstValue === 'object' && '@value' in firstValue) {
                return firstValue['@value'];
            }
            
            // If it's an object with meaningful content, try to extract readable parts
            if (firstValue && typeof firstValue === 'object') {
                // Look for common value properties
                const valueProps = ['@value', 'value', 'name', 'title', 'label', 'display_title'];
                for (const prop of valueProps) {
                    if (prop in firstValue && firstValue[prop] !== null && firstValue[prop] !== undefined) {
                        return firstValue[prop];
                    }
                }
                // If no value property found, return the whole object for JSON display
                return firstValue;
            }
            
            // For primitive values in arrays, return the first one
            return firstValue;
        }
        
        // Handle objects with @value property
        if (value && typeof value === 'object' && '@value' in value) {
            return value['@value'];
        }
        
        // Handle other objects - look for common value properties
        if (value && typeof value === 'object') {
            const valueProps = ['@value', 'value', 'name', 'title', 'label', 'display_title'];
            for (const prop of valueProps) {
                if (prop in value && value[prop] !== null && value[prop] !== undefined) {
                    return value[prop];
                }
            }
            // Return the whole object for JSON display
            return value;
        }
        
        // For primitive values, return as-is
        return value;
    }
    
    // Helper function to extract and analyze keys from all items
    async function extractAndAnalyzeKeys(data) {
        const keyFrequency = new Map();
        const contextMap = new Map();
        let items = [];
        
        // Normalize data structure to get array of items
        if (Array.isArray(data)) {
            items = data;
        } else if (data.items && Array.isArray(data.items)) {
            items = data.items;
        } else if (typeof data === 'object') {
            items = [data];
        }
        
        // Extract context information from first item
        if (items.length > 0 && items[0]['@context']) {
            const context = items[0]['@context'];
            console.log('Found @context:', context);
            
            // Handle both object and string contexts
            if (typeof context === 'object') {
                for (const [prefix, uri] of Object.entries(context)) {
                    if (typeof uri === 'string') {
                        contextMap.set(prefix, uri);
                        console.log(`Context mapping: ${prefix} → ${uri}`);
                    }
                }
            } else if (typeof context === 'string') {
                // Fetch remote context definitions
                const remoteContext = await fetchContextDefinitions(context);
                for (const [prefix, uri] of remoteContext) {
                    contextMap.set(prefix, uri);
                }
            }
        }
        
        // Analyze all items to get key frequency
        items.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                Object.keys(item).forEach(key => {
                    // Skip JSON-LD system keys
                    if (key.startsWith('@')) return;
                    
                    // Count all keys including o: keys - we'll categorize them later
                    const count = keyFrequency.get(key) || 0;
                    keyFrequency.set(key, count + 1);
                });
            }
        });
        
        // Convert to array and sort by frequency
        const keyAnalysis = Array.from(keyFrequency.entries())
            .map(([key, frequency]) => {
                // Get sample value from first item that has this key
                let sampleValue = null;
                let linkedDataUri = null;
                
                for (const item of items) {
                    if (item[key] !== undefined) {
                        sampleValue = extractSampleValue(item[key]);
                        break;
                    }
                }
                
                // Generate linked data URI from context
                if (key.includes(':')) {
                    const [prefix, localName] = key.split(':', 2);
                    const baseUri = contextMap.get(prefix);
                    if (baseUri) {
                        // Handle different URI patterns
                        if (baseUri.endsWith('/') || baseUri.endsWith('#')) {
                            linkedDataUri = baseUri + localName;
                        } else {
                            linkedDataUri = baseUri + '/' + localName;
                        }
                        console.log(`Generated URI for ${key}: ${linkedDataUri}`);
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
                            linkedDataUri = uri + localName;
                            console.log(`Generated URI using common prefix for ${key}: ${linkedDataUri}`);
                            break;
                        }
                    }
                    
                    // Check if there's a default namespace
                    const defaultNs = contextMap.get('');
                    if (defaultNs && !linkedDataUri) {
                        linkedDataUri = defaultNs + key;
                    }
                }
                
                return {
                    key,
                    frequency,
                    totalItems: items.length,
                    sampleValue,
                    linkedDataUri,
                    type: Array.isArray(sampleValue) ? 'array' : typeof sampleValue,
                    contextMap: contextMap
                };
            })
            .sort((a, b) => b.frequency - a.frequency); // Sort by frequency descending
        
        return keyAnalysis;
    }

    // Helper function to populate key lists
    async function populateLists() {
        const currentState = state.getState();
        console.log('populateLists called', { 
            fetchedData: !!currentState.fetchedData,
            dataType: Array.isArray(currentState.fetchedData) ? 'array' : typeof currentState.fetchedData
        });
        
        if (!currentState.fetchedData) {
            console.log('No data available');
            return;
        }
        
        // Analyze all keys from the complete dataset
        const keyAnalysis = await extractAndAnalyzeKeys(currentState.fetchedData);
        console.log('Key analysis:', keyAnalysis);
        
        // Initialize arrays if they don't exist in state
        if (!currentState.mappings.nonLinkedKeys) {
            state.updateState('mappings.nonLinkedKeys', []);
        }
        if (!currentState.mappings.mappedKeys) {
            state.updateState('mappings.mappedKeys', []);
        }
        if (!currentState.mappings.ignoredKeys) {
            state.updateState('mappings.ignoredKeys', []);
        }
        
        // Get updated state after initialization
        const updatedState = state.getState();
        
        // Filter keys that haven't been processed yet
        const processedKeys = new Set([
            ...updatedState.mappings.mappedKeys.map(k => k.key || k),
            ...updatedState.mappings.ignoredKeys.map(k => k.key || k)
        ]);
        
        const newKeys = keyAnalysis.filter(keyObj => !processedKeys.has(keyObj.key));
        
        // Load ignore settings
        let ignorePatterns = ['o:'];
        try {
            const response = await fetch('./config/ignore-keys.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const settings = await response.json();
            ignorePatterns = settings.ignoredKeyPatterns || ['o:'];
            console.log('Loaded ignore patterns:', ignorePatterns);
        } catch (error) {
            console.warn('Could not load ignore settings, using defaults:', error);
        }
        
        // Function to check if key should be ignored
        const shouldIgnoreKey = (key) => {
            return ignorePatterns.some(pattern => {
                if (pattern.endsWith(':')) {
                    return key.startsWith(pattern);
                } else {
                    return key === pattern;
                }
            });
        };
        
        // Separate keys by type - ignored keys and regular keys
        const ignoredKeys = newKeys.filter(k => shouldIgnoreKey(k.key));
        const regularKeys = newKeys.filter(k => !shouldIgnoreKey(k.key));
        
        // Add ignored keys to ignored list
        const currentIgnoredKeys = [...updatedState.mappings.ignoredKeys, ...ignoredKeys];
        state.updateState('mappings.ignoredKeys', currentIgnoredKeys);
        
        // Add regular keys to non-linked keys
        const currentNonLinkedKeys = updatedState.mappings.nonLinkedKeys.filter(k => 
            !keyAnalysis.find(ka => ka.key === (k.key || k))
        );
        const allNonLinkedKeys = [...currentNonLinkedKeys, ...regularKeys];
        state.updateState('mappings.nonLinkedKeys', allNonLinkedKeys);
        
        // Get final state for UI update
        const finalState = state.getState();
        
        // Populate the UI lists
        populateKeyList(nonLinkedKeysList, finalState.mappings.nonLinkedKeys, 'non-linked');
        populateKeyList(mappedKeysList, finalState.mappings.mappedKeys, 'mapped');
        populateKeyList(ignoredKeysList, finalState.mappings.ignoredKeys, 'ignored');
        
        // Update section counts
        updateSectionCounts(finalState.mappings);
        
        // Auto-open mapped keys section if there are mapped keys
        if (finalState.mappings.mappedKeys.length > 0) {
            const mappedKeysList = document.getElementById('mapped-keys');
            if (mappedKeysList) {
                const mappedSection = mappedKeysList.closest('details');
                if (mappedSection) {
                    mappedSection.open = true;
                }
            }
        }
        
        // Enable continue button if there are mapped keys
        if (proceedToReconciliationBtn) {
            proceedToReconciliationBtn.disabled = !finalState.mappings.mappedKeys.length;
        }
    }
    
    // Helper function to update section counts in summary headers
    function updateSectionCounts(mappings) {
        const totalKeys = mappings.nonLinkedKeys.length + mappings.mappedKeys.length + mappings.ignoredKeys.length;
        
        // Update Non-linked Keys section
        const nonLinkedSection = document.querySelector('.key-sections .section:nth-child(1) summary');
        if (nonLinkedSection) {
            nonLinkedSection.innerHTML = `<span class="section-title">Non-linked Keys</span><span class="section-count">(${mappings.nonLinkedKeys.length}/${totalKeys})</span>`;
        }
        
        // Update Mapped Keys section
        const mappedSection = document.querySelector('.key-sections .section:nth-child(2) summary');
        if (mappedSection) {
            mappedSection.innerHTML = `<span class="section-title">Mapped Keys</span><span class="section-count">(${mappings.mappedKeys.length}/${totalKeys})</span>`;
        }
        
        // Update Ignored Keys section
        const ignoredSection = document.querySelector('.key-sections .section:nth-child(3) summary');
        if (ignoredSection) {
            ignoredSection.innerHTML = `<span class="section-title">Ignored Keys</span><span class="section-count">(${mappings.ignoredKeys.length}/${totalKeys})</span>`;
        }
    }
    
    // Helper function to populate a key list
    function populateKeyList(listElement, keys, type) {
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (!keys.length) {
            const placeholder = document.createElement('li');
            placeholder.className = 'placeholder';
            placeholder.textContent = type === 'non-linked'
                ? 'All keys have been processed'
                : type === 'mapped'
                    ? 'No mapped keys yet'
                    : 'No ignored keys';
            listElement.appendChild(placeholder);
            return;
        }
        
        keys.forEach(keyObj => {
            const li = document.createElement('li');
            
            // Handle both string keys (legacy) and key objects
            const keyData = typeof keyObj === 'string' 
                ? { key: keyObj, type: 'unknown', frequency: 1, totalItems: 1 }
                : keyObj;
            
            // Create compact key display
            const keyDisplay = document.createElement('div');
            keyDisplay.className = 'key-item-compact';
            
            // Add grayed-out class if key is not in current dataset
            if (keyData.notInCurrentDataset) {
                keyDisplay.classList.add('not-in-current-dataset');
                li.classList.add('not-in-current-dataset');
            }
            
            const keyName = document.createElement('span');
            keyName.className = 'key-name-compact';
            keyName.textContent = keyData.key;
            keyDisplay.appendChild(keyName);
            
            // Show property info for mapped keys immediately after key name
            if (type === 'mapped' && keyData.property) {
                const propertyInfo = document.createElement('span');
                propertyInfo.className = 'property-info';
                propertyInfo.textContent = ` → ${keyData.property.id}: ${keyData.property.label}`;
                keyDisplay.appendChild(propertyInfo);
            }
            
            // Show frequency information at the end
            if (keyData.frequency && keyData.totalItems) {
                const frequencyIndicator = document.createElement('span');
                frequencyIndicator.className = 'key-frequency';
                frequencyIndicator.textContent = `(${keyData.frequency}/${keyData.totalItems})`;
                keyDisplay.appendChild(frequencyIndicator);
            } else if (keyData.notInCurrentDataset) {
                // Show indicator for keys not in current dataset
                const notInDatasetIndicator = document.createElement('span');
                notInDatasetIndicator.className = 'not-in-dataset-indicator';
                notInDatasetIndicator.textContent = '(not in current dataset)';
                keyDisplay.appendChild(notInDatasetIndicator);
            }
            
            li.appendChild(keyDisplay);
            
            // Add click handler for all keys to open mapping modal (but disabled for grayed out keys)
            li.className = 'clickable key-item-clickable-compact';
            if (!keyData.notInCurrentDataset) {
                li.addEventListener('click', () => openMappingModal(keyData));
            } else {
                li.classList.add('disabled');
                li.title = 'This key is not present in the current dataset';
            }
            
            // Add data attribute for animations
            li.setAttribute('data-key', keyData.key);
            
            listElement.appendChild(li);
            
            // Add animation if this is a newly moved item
            if (keyData.isNewlyMoved) {
                li.classList.add('newly-moved');
                setTimeout(() => {
                    li.classList.remove('newly-moved');
                }, 2000);
            }
        });
    }
    
    // Function to open a mapping modal for a key
    function openMappingModal(keyData) {
        // Import modal functionality
        import('../ui/modal-ui.js').then(({ setupModalUI }) => {
            const modalUI = setupModalUI();
            
            // Create modal content
            const modalContent = createMappingModalContent(keyData);
            
            // Create buttons
            const buttons = [
                {
                    text: 'Ignore',
                    type: 'secondary',
                    keyboardShortcut: 'i',
                    callback: () => {
                        moveKeyToCategory(keyData, 'ignored');
                        modalUI.closeModal();
                    }
                },
                {
                    text: 'Confirm',
                    type: 'secondary',
                    keyboardShortcut: 'c',
                    callback: () => {
                        const selectedProperty = getSelectedPropertyFromModal();
                        if (selectedProperty) {
                            mapKeyToProperty(keyData, selectedProperty);
                            modalUI.closeModal();
                        } else {
                            showMessage('Please select a Wikidata property first.', 'warning', 3000);
                        }
                    }
                },
                {
                    text: 'Confirm and Next',
                    type: 'primary',
                    keyboardShortcut: 'n',
                    callback: () => {
                        const selectedProperty = getSelectedPropertyFromModal();
                        if (selectedProperty) {
                            mapKeyToProperty(keyData, selectedProperty);
                            modalUI.closeModal();
                            moveToNextUnmappedKey();
                        } else {
                            showMessage('Please select a Wikidata property first.', 'warning', 3000);
                        }
                    }
                }
            ];
            
            // Open modal
            modalUI.openModal(
                `Map Key: ${keyData.key}`,
                modalContent,
                buttons
            );
        });
    }
    
    // Create the content for the mapping modal
    function createMappingModalContent(keyData) {
        const container = document.createElement('div');
        container.className = 'mapping-modal-content';
        
        // Key information section
        const keyInfo = document.createElement('div');
        keyInfo.className = 'key-info';
        
        const sampleValueHtml = formatSampleValue(keyData.sampleValue, keyData.contextMap || new Map());
        
        const keyDisplay = keyData.linkedDataUri 
            ? `<a href="${keyData.linkedDataUri}" target="_blank" class="clickable-key">${keyData.key}</a>`
            : keyData.key;
        
        keyInfo.innerHTML = `
            <h4>Key Information</h4>
            <p><strong>Key:</strong> ${keyDisplay}</p>
            <p><strong>Frequency:</strong> ${keyData.frequency || 1} out of ${keyData.totalItems || 1} items</p>
            <div><strong>Sample Value:</strong> ${sampleValueHtml}</div>
        `;
        container.appendChild(keyInfo);
        
        // Property search section
        const searchSection = document.createElement('div');
        searchSection.className = 'property-search';
        searchSection.innerHTML = `
            <h4>Search Wikidata Properties</h4>
            <input type="text" id="property-search-input" placeholder="Type to search for Wikidata properties..." class="property-search-input">
            <div id="property-suggestions" class="property-suggestions"></div>
            <div id="selected-property" class="selected-property" style="display: none;">
                <h4>Selected Property</h4>
                <div id="selected-property-details"></div>
            </div>
        `;
        container.appendChild(searchSection);
        
        // Setup search functionality and pre-populate if mapped
        setTimeout(() => setupPropertySearch(keyData), 100);
        
        return container;
    }
    
    // Format sample value for display
    function formatSampleValue(value, contextMap = new Map()) {
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
    
    // Helper function to make JSON keys clickable
    function makeJsonKeysClickable(jsonStr, contextMap) {
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
    
    // Helper function to generate URI for a key
    function generateUriForKey(key, contextMap) {
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
    
    // Setup property search functionality
    function setupPropertySearch(keyData) {
        const searchInput = document.getElementById('property-search-input');
        const suggestionsContainer = document.getElementById('property-suggestions');
        let searchTimeout;
        let selectedProperty = null;
        
        if (!searchInput) return;
        
        // Pre-populate if this key is already mapped
        if (keyData && keyData.property) {
            window.currentMappingSelectedProperty = keyData.property;
            selectProperty(keyData.property);
            searchInput.value = keyData.property.label;
        } else {
            window.currentMappingSelectedProperty = null;
        }
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                suggestionsContainer.innerHTML = '';
                return;
            }
            
            searchTimeout = setTimeout(() => {
                searchWikidataProperties(query, suggestionsContainer);
            }, 300);
        });
    }
    
    // Search Wikidata properties
    async function searchWikidataProperties(query, container) {
        try {
            container.innerHTML = '<div class="loading">Searching...</div>';
            
            // Check autosuggest first
            const autoSuggestions = getAutoSuggestions(query);
            
            // Wikidata API search
            const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=property&format=json&origin=*`;
            
            const response = await fetch(wikidataUrl);
            const data = await response.json();
            
            displayPropertySuggestions(data.search || [], autoSuggestions, container);
        } catch (error) {
            console.error('Error searching Wikidata properties:', error);
            container.innerHTML = '<div class="error">Error searching properties. Please try again.</div>';
        }
    }
    
    // Get autosuggest based on previously mapped keys
    function getAutoSuggestions(query) {
        const suggestions = [];
        const currentState = state.getState();
        
        // Get previously mapped properties from state
        if (currentState.mappings && currentState.mappings.mappedKeys) {
            currentState.mappings.mappedKeys.forEach(mappedKey => {
                if (mappedKey.property && 
                    (mappedKey.property.label.toLowerCase().includes(query.toLowerCase()) ||
                     mappedKey.property.id.toLowerCase().includes(query.toLowerCase()))) {
                    suggestions.push({
                        ...mappedKey.property,
                        isPrevious: true
                    });
                }
            });
        }
        
        return suggestions;
    }
    
    // Display property suggestions
    function displayPropertySuggestions(wikidataResults, autoSuggestions, container) {
        container.innerHTML = '';
        
        // Show autosuggest results first
        if (autoSuggestions.length > 0) {
            const autoSection = document.createElement('div');
            autoSection.className = 'suggestion-section';
            autoSection.innerHTML = '<h5>Previously Used</h5>';
            
            autoSuggestions.forEach(property => {
                const item = createPropertySuggestionItem(property, true);
                autoSection.appendChild(item);
            });
            
            container.appendChild(autoSection);
        }
        
        // Show Wikidata results
        if (wikidataResults.length > 0) {
            const wikidataSection = document.createElement('div');
            wikidataSection.className = 'suggestion-section';
            wikidataSection.innerHTML = '<h5>Wikidata Properties</h5>';
            
            wikidataResults.forEach(property => {
                const formattedProperty = {
                    id: property.id,
                    label: property.label,
                    description: property.description || 'No description available'
                };
                const item = createPropertySuggestionItem(formattedProperty, false);
                wikidataSection.appendChild(item);
            });
            
            container.appendChild(wikidataSection);
        }
        
        if (autoSuggestions.length === 0 && wikidataResults.length === 0) {
            container.innerHTML = '<div class="no-results">No properties found</div>';
        }
    }
    
    // Create a property suggestion item
    function createPropertySuggestionItem(property, isPrevious) {
        const item = document.createElement('div');
        item.className = `property-suggestion-item ${isPrevious ? 'previous' : ''}`;
        
        item.innerHTML = `
            <div class="property-main">
                <span class="property-id">${property.id}</span>
                <span class="property-label">${property.label}</span>
            </div>
            <div class="property-description">${property.description}</div>
        `;
        
        item.addEventListener('click', () => {
            selectProperty(property);
        });
        
        return item;
    }
    
    // Select a property
    function selectProperty(property) {
        // Remove selection from other items
        document.querySelectorAll('.property-suggestion-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to clicked item if event exists
        if (typeof event !== 'undefined' && event.target) {
            const targetItem = event.target.closest('.property-suggestion-item');
            if (targetItem) {
                targetItem.classList.add('selected');
            }
        }
        
        // Store selected property
        window.currentMappingSelectedProperty = property;
        
        // Update search input with selected property label
        const searchInput = document.getElementById('property-search-input');
        if (searchInput) {
            searchInput.value = `${property.id}: ${property.label}`;
        }
        
        // Clear suggestions container
        const suggestionsContainer = document.getElementById('property-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = '';
        }
        
        // Show selected property details
        const selectedContainer = document.getElementById('selected-property');
        const detailsContainer = document.getElementById('selected-property-details');
        
        if (selectedContainer && detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="selected-property-info">
                    <span class="property-id">${property.id}</span>
                    <span class="property-label">${property.label}</span>
                    <div class="property-description">${property.description}</div>
                </div>
            `;
            selectedContainer.style.display = 'block';
        }
    }
    
    // Get selected property from modal
    function getSelectedPropertyFromModal() {
        return window.currentMappingSelectedProperty;
    }
    
    // Move key to a specific category
    function moveKeyToCategory(keyData, category) {
        const currentState = state.getState();
        const targetKey = typeof keyData === 'string' ? keyData : keyData.key;
        
        // Remove from ALL existing categories first
        const updatedNonLinkedKeys = currentState.mappings.nonLinkedKeys.filter(k => {
            const keyToCompare = typeof k === 'string' ? k : k.key;
            return keyToCompare !== targetKey;
        });
        
        const updatedMappedKeys = currentState.mappings.mappedKeys.filter(k => {
            const keyToCompare = typeof k === 'string' ? k : k.key;
            return keyToCompare !== targetKey;
        });
        
        const updatedIgnoredKeys = currentState.mappings.ignoredKeys.filter(k => {
            const keyToCompare = typeof k === 'string' ? k : k.key;
            return keyToCompare !== targetKey;
        });
        
        // Update all categories
        state.updateState('mappings.nonLinkedKeys', updatedNonLinkedKeys);
        state.updateState('mappings.mappedKeys', updatedMappedKeys);
        state.updateState('mappings.ignoredKeys', updatedIgnoredKeys);
        
        // Clear isNewlyMoved flag from all existing items to prevent old animations
        const clearAnimationFlag = (items) => items.map(item => {
            const { isNewlyMoved, ...cleanItem } = item;
            return cleanItem;
        });
        
        const cleanedNonLinkedKeys = clearAnimationFlag(updatedNonLinkedKeys);
        const cleanedMappedKeys = clearAnimationFlag(updatedMappedKeys);
        const cleanedIgnoredKeys = clearAnimationFlag(updatedIgnoredKeys);
        
        // Add to target category with animation marker (only for the current item)
        const keyDataWithAnimation = { ...keyData, isNewlyMoved: true };
        
        if (category === 'ignored') {
            const finalIgnoredKeys = [...cleanedIgnoredKeys, keyDataWithAnimation];
            state.updateState('mappings.ignoredKeys', finalIgnoredKeys);
            // Update other categories without animation
            state.updateState('mappings.nonLinkedKeys', cleanedNonLinkedKeys);
            state.updateState('mappings.mappedKeys', cleanedMappedKeys);
        } else if (category === 'mapped') {
            const finalMappedKeys = [...cleanedMappedKeys, keyDataWithAnimation];
            state.updateState('mappings.mappedKeys', finalMappedKeys);
            // Update other categories without animation
            state.updateState('mappings.nonLinkedKeys', cleanedNonLinkedKeys);
            state.updateState('mappings.ignoredKeys', cleanedIgnoredKeys);
        } else if (category === 'non-linked') {
            const finalNonLinkedKeys = [...cleanedNonLinkedKeys, keyDataWithAnimation];
            state.updateState('mappings.nonLinkedKeys', finalNonLinkedKeys);
            // Update other categories without animation
            state.updateState('mappings.mappedKeys', cleanedMappedKeys);
            state.updateState('mappings.ignoredKeys', cleanedIgnoredKeys);
        }
        
        // Update UI
        populateLists();
        state.markChangesUnsaved();
    }
    
    // Map key to property
    function mapKeyToProperty(keyData, property) {
        // Create enhanced key data with property information
        const mappedKey = {
            ...keyData,
            property: property,
            mappedAt: new Date().toISOString()
        };
        
        // Use moveKeyToCategory to handle the movement properly
        moveKeyToCategory(mappedKey, 'mapped');
    }
    
    // Move to next unmapped key
    function moveToNextUnmappedKey() {
        const currentState = state.getState();
        if (currentState.mappings.nonLinkedKeys.length > 0) {
            // Small delay to let UI update, then open next key
            setTimeout(() => {
                const nextKey = currentState.mappings.nonLinkedKeys[0];
                openMappingModal(nextKey);
            }, 200);
        }
    }
    
    // Generate mapping data for saving
    function generateMappingData(state) {
        const currentState = state.getState();
        const mappingData = {
            version: "1.0",
            createdAt: new Date().toISOString(),
            entitySchema: currentState.entitySchema || 'E473',
            mappings: {
                mapped: currentState.mappings.mappedKeys.map(key => ({
                    key: key.key,
                    linkedDataUri: key.linkedDataUri,
                    contextMap: key.contextMap && key.contextMap instanceof Map ? Object.fromEntries(key.contextMap) : {},
                    property: key.property ? {
                        id: key.property.id,
                        label: key.property.label,
                        description: key.property.description,
                        datatype: key.property.datatype
                    } : null,
                    mappedAt: key.mappedAt
                })),
                ignored: currentState.mappings.ignoredKeys.map(key => ({
                    key: key.key,
                    linkedDataUri: key.linkedDataUri,
                    contextMap: key.contextMap && key.contextMap instanceof Map ? Object.fromEntries(key.contextMap) : {}
                }))
            }
        };
        
        return mappingData;
    }
    
    // Download mapping data as JSON file
    function downloadMappingAsJson(mappingData) {
        const jsonString = JSON.stringify(mappingData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `omeka-wikidata-mapping-${timestamp}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Mapping saved as:', filename);
    }
    
    // Load mapping data from uploaded file
    async function loadMappingFromData(mappingData, state) {
        if (!mappingData.version || !mappingData.mappings) {
            throw new Error('Invalid mapping file format');
        }
        
        // Set entity schema
        if (mappingData.entitySchema) {
            const entitySchemaInput = document.getElementById('entity-schema');
            if (entitySchemaInput) {
                entitySchemaInput.value = mappingData.entitySchema;
                state.updateState('entitySchema', mappingData.entitySchema);
            }
        }
        
        // Get current dataset to check which keys exist
        const currentState = state.getState();
        const currentDataKeys = new Set();
        
        if (currentState.fetchedData) {
            const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
            items.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    Object.keys(item).forEach(key => {
                        if (!key.startsWith('@')) {
                            currentDataKeys.add(key);
                        }
                    });
                }
            });
        }
        
        // Convert contextMap objects back to Maps and check if keys exist in current dataset
        const processKeys = (keys) => {
            return keys.map(key => ({
                ...key,
                contextMap: key.contextMap ? new Map(Object.entries(key.contextMap)) : new Map(),
                notInCurrentDataset: !currentDataKeys.has(key.key) // Mark keys not in current dataset
            }));
        };
        
        // Load mappings
        const mappedKeys = processKeys(mappingData.mappings.mapped || []);
        const ignoredKeys = processKeys(mappingData.mappings.ignored || []);
        
        // Update state
        state.updateState('mappings.mappedKeys', mappedKeys);
        state.updateState('mappings.ignoredKeys', ignoredKeys);
        state.updateState('mappings.nonLinkedKeys', []); // Clear non-linked keys
        
        // Update UI
        populateLists();
        
        console.log('Loaded mapping with:', {
            mapped: mappedKeys.length,
            ignored: ignoredKeys.length,
            entitySchema: mappingData.entitySchema,
            keysNotInCurrentDataset: mappedKeys.filter(k => k.notInCurrentDataset).length + ignoredKeys.filter(k => k.notInCurrentDataset).length
        });
    }
    
}