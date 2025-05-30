/**
 * Handles the Mapping step functionality
 * Provides UI for mapping Omeka S fields to Wikidata properties
 */
import { eventSystem } from '../events.js';
export function setupMappingStep(state) {
    // Initialize DOM elements
    const entitySchemaInput = document.getElementById('entity-schema');
    const nonLinkedKeysList = document.getElementById('non-linked-keys');
    const mappedKeysList = document.getElementById('mapped-keys');
    const ignoredKeysList = document.getElementById('ignored-keys');
    const proceedToReconciliationBtn = document.getElementById('proceed-to-reconciliation');
    const testMappingModelBtn = document.getElementById('test-mapping-model');
    
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
    
    // Helper function to extract and analyze keys from all items
    function extractAndAnalyzeKeys(data) {
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
                        sampleValue = item[key];
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
                    type: Array.isArray(sampleValue) ? 'array' : typeof sampleValue
                };
            })
            .sort((a, b) => b.frequency - a.frequency); // Sort by frequency descending
        
        return keyAnalysis;
    }

    // Helper function to populate key lists
    function populateLists() {
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
        const keyAnalysis = extractAndAnalyzeKeys(currentState.fetchedData);
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
        
        // Separate o: keys and regular keys
        const omekaKeys = newKeys.filter(k => k.key.startsWith('o:'));
        const regularKeys = newKeys.filter(k => !k.key.startsWith('o:'));
        
        // Add o: keys to ignored
        const currentIgnoredKeys = [...updatedState.mappings.ignoredKeys, ...omekaKeys];
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
            }
            
            li.appendChild(keyDisplay);
            
            // Add click handler for all keys to open mapping modal
            li.className = 'clickable key-item-clickable-compact';
            li.addEventListener('click', () => openMappingModal(keyData));
            
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
                            alert('Please select a Wikidata property first.');
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
                            alert('Please select a Wikidata property first.');
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
        keyInfo.innerHTML = `
            <h4>Key Information</h4>
            <p><strong>Key:</strong> ${keyData.key}</p>
            <p><strong>Type:</strong> ${keyData.type || 'unknown'}</p>
            <p><strong>Frequency:</strong> ${keyData.frequency || 1} out of ${keyData.totalItems || 1} items</p>
            ${keyData.linkedDataUri ? `<p><strong>Linked Data URI:</strong> <a href="${keyData.linkedDataUri}" target="_blank">${keyData.linkedDataUri}</a></p>` : ''}
            <p><strong>Sample Value:</strong> ${formatSampleValue(keyData.sampleValue)}</p>
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
    function formatSampleValue(value) {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'object') {
            try {
                const jsonStr = JSON.stringify(value, null, 2);
                return jsonStr.length > 200 ? jsonStr.slice(0, 200) + '...' : jsonStr;
            } catch (e) {
                return '[object - cannot stringify]';
            }
        }
        const str = String(value);
        return str.length > 100 ? str.slice(0, 100) + '...' : str;
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
        
        // Add selection to clicked item
        event.target.closest('.property-suggestion-item').classList.add('selected');
        
        // Store selected property
        window.currentMappingSelectedProperty = property;
        
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
        
        // Add to target category with animation marker
        const keyDataWithAnimation = { ...keyData, isNewlyMoved: true };
        
        if (category === 'ignored') {
            const finalIgnoredKeys = [...updatedIgnoredKeys, keyDataWithAnimation];
            state.updateState('mappings.ignoredKeys', finalIgnoredKeys);
        } else if (category === 'mapped') {
            const finalMappedKeys = [...updatedMappedKeys, keyDataWithAnimation];
            state.updateState('mappings.mappedKeys', finalMappedKeys);
        } else if (category === 'non-linked') {
            const finalNonLinkedKeys = [...updatedNonLinkedKeys, keyDataWithAnimation];
            state.updateState('mappings.nonLinkedKeys', finalNonLinkedKeys);
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
    
}