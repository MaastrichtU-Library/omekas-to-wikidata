/**
 * Handles the Mapping step functionality
 * Provides UI for mapping Omeka S fields to Wikidata properties
 */
export function setupMappingStep(state) {
    // Initialize DOM elements
    const entitySchemaInput = document.getElementById('entity-schema');
    const nonLinkedKeysList = document.getElementById('non-linked-keys');
    const mappedKeysList = document.getElementById('mapped-keys');
    const ignoredKeysList = document.getElementById('ignored-keys');
    const proceedToReconciliationBtn = document.getElementById('proceed-to-reconciliation');
    const testMappingModelBtn = document.getElementById('test-mapping-model');
    
    // When we enter this step, populate the lists
    document.addEventListener('DOMContentLoaded', () => {
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 2) {
                    populateLists();
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-mapping')?.addEventListener('click', () => {
            populateLists();
        });
        
        // Event listener for test modal button is now handled in modals.js
    });
    
    // Entity schema input
    if (entitySchemaInput) {
        entitySchemaInput.addEventListener('change', () => {
            state.entitySchema = entitySchemaInput.value;
            state.markChangesUnsaved();
        });
    }
    
    // Helper function to extract all keys from nested JSON structure
    function extractKeysFromObject(obj, prefix = '', maxDepth = 3, currentDepth = 0) {
        const keys = [];
        
        if (currentDepth >= maxDepth || !obj || typeof obj !== 'object') {
            return keys;
        }
        
        for (const [key, value] of Object.entries(obj)) {
            // Skip JSON-LD system keys
            if (key.startsWith('@')) continue;
            
            const fullKey = prefix ? `${prefix}.${key}` : key;
            keys.push({
                key: fullKey,
                originalKey: key,
                type: Array.isArray(value) ? 'array' : typeof value,
                sampleValue: Array.isArray(value) ? value[0] : value,
                depth: currentDepth
            });
            
            // Recursively extract keys from nested objects
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                keys.push(...extractKeysFromObject(value, fullKey, maxDepth, currentDepth + 1));
            }
            
            // Extract keys from first element of arrays if it's an object
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                keys.push(...extractKeysFromObject(value[0], fullKey, maxDepth, currentDepth + 1));
            }
        }
        
        return keys;
    }

    // Helper function to populate key lists
    function populateLists() {
        if (!state.fetchedData || !state.selectedExample) return;
        
        // Extract all keys from the selected example object
        const extractedKeys = extractKeysFromObject(state.selectedExample);
        
        // Initialize arrays if they don't exist in state
        if (!state.mappings.nonLinkedKeys) state.mappings.nonLinkedKeys = [];
        if (!state.mappings.mappedKeys) state.mappings.mappedKeys = [];
        if (!state.mappings.ignoredKeys) state.mappings.ignoredKeys = [];
        
        // Filter keys that haven't been processed yet
        const processedKeys = new Set([
            ...state.mappings.mappedKeys.map(k => k.key || k),
            ...state.mappings.ignoredKeys.map(k => k.key || k)
        ]);
        
        const newKeys = extractedKeys.filter(keyObj => !processedKeys.has(keyObj.key));
        
        // Add new keys to non-linked keys
        const currentNonLinkedKeys = state.mappings.nonLinkedKeys.map(k => typeof k === 'string' ? { key: k } : k);
        state.mappings.nonLinkedKeys = [...currentNonLinkedKeys, ...newKeys];
        
        // Populate the UI lists
        populateKeyList(nonLinkedKeysList, state.mappings.nonLinkedKeys, 'non-linked');
        populateKeyList(mappedKeysList, state.mappings.mappedKeys, 'mapped');
        populateKeyList(ignoredKeysList, state.mappings.ignoredKeys, 'ignored');
        
        // Enable continue button if there are mapped keys
        if (proceedToReconciliationBtn) {
            proceedToReconciliationBtn.disabled = !state.mappings.mappedKeys.length;
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
                ? { key: keyObj, type: 'unknown', sampleValue: null, depth: 0 }
                : keyObj;
            
            // Create key display with additional information
            const keyDisplay = document.createElement('div');
            keyDisplay.className = 'key-item';
            
            const keyName = document.createElement('span');
            keyName.className = 'key-name';
            keyName.textContent = keyData.key;
            keyDisplay.appendChild(keyName);
            
            if (keyData.type && keyData.type !== 'unknown') {
                const typeIndicator = document.createElement('span');
                typeIndicator.className = 'key-type';
                typeIndicator.textContent = `[${keyData.type}]`;
                keyDisplay.appendChild(typeIndicator);
            }
            
            // Show sample value for context
            if (keyData.sampleValue !== null && keyData.sampleValue !== undefined) {
                const sampleValue = document.createElement('span');
                sampleValue.className = 'key-sample';
                const displayValue = typeof keyData.sampleValue === 'object' 
                    ? '[object]' 
                    : String(keyData.sampleValue).slice(0, 30) + (String(keyData.sampleValue).length > 30 ? '...' : '');
                sampleValue.textContent = `: ${displayValue}`;
                keyDisplay.appendChild(sampleValue);
            }
            
            li.appendChild(keyDisplay);
            
            // Add click handler for non-linked keys to open mapping modal
            if (type === 'non-linked') {
                li.className = 'clickable key-item-clickable';
                li.addEventListener('click', () => openMappingModal(keyData));
            } else {
                li.className = 'key-item-display';
            }
            
            listElement.appendChild(li);
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
                    text: 'Skip',
                    type: 'secondary',
                    keyboardShortcut: 's',
                    callback: () => {
                        modalUI.closeModal();
                        // Move to next unmapped key automatically
                        moveToNextUnmappedKey();
                    }
                },
                {
                    text: 'Ignore',
                    type: 'secondary',
                    keyboardShortcut: 'i',
                    callback: () => {
                        moveKeyToCategory(keyData, 'ignored');
                        modalUI.closeModal();
                        moveToNextUnmappedKey();
                    }
                },
                {
                    text: 'Confirm',
                    type: 'primary',
                    keyboardShortcut: 'c',
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
            <p><strong>Type:</strong> ${keyData.type}</p>
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
        
        // Setup search functionality
        setTimeout(() => setupPropertySearch(), 100);
        
        return container;
    }
    
    // Format sample value for display
    function formatSampleValue(value) {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'object') return '[object]';
        const str = String(value);
        return str.length > 100 ? str.slice(0, 100) + '...' : str;
    }
    
    // Setup property search functionality
    function setupPropertySearch() {
        const searchInput = document.getElementById('property-search-input');
        const suggestionsContainer = document.getElementById('property-suggestions');
        let searchTimeout;
        let selectedProperty = null;
        
        if (!searchInput) return;
        
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
        
        // Store reference to selected property for later access
        window.currentMappingSelectedProperty = null;
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
        
        // Get previously mapped properties from state
        if (state.mappings && state.mappings.mappedKeys) {
            state.mappings.mappedKeys.forEach(mappedKey => {
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
        // Remove from non-linked keys
        state.mappings.nonLinkedKeys = state.mappings.nonLinkedKeys.filter(k => {
            const keyToCompare = typeof k === 'string' ? k : k.key;
            const targetKey = typeof keyData === 'string' ? keyData : keyData.key;
            return keyToCompare !== targetKey;
        });
        
        // Add to target category
        if (category === 'ignored') {
            state.mappings.ignoredKeys.push(keyData);
        }
        
        // Update UI
        populateLists();
        state.markChangesUnsaved();
    }
    
    // Map key to property
    function mapKeyToProperty(keyData, property) {
        // Remove from non-linked keys
        state.mappings.nonLinkedKeys = state.mappings.nonLinkedKeys.filter(k => {
            const keyToCompare = typeof k === 'string' ? k : k.key;
            const targetKey = typeof keyData === 'string' ? keyData : keyData.key;
            return keyToCompare !== targetKey;
        });
        
        // Add to mapped keys with property information
        const mappedKey = {
            ...keyData,
            property: property,
            mappedAt: new Date().toISOString()
        };
        state.mappings.mappedKeys.push(mappedKey);
        
        // Update UI
        populateLists();
        state.markChangesUnsaved();
    }
    
    // Move to next unmapped key
    function moveToNextUnmappedKey() {
        if (state.mappings.nonLinkedKeys.length > 0) {
            // Small delay to let UI update, then open next key
            setTimeout(() => {
                const nextKey = state.mappings.nonLinkedKeys[0];
                openMappingModal(nextKey);
            }, 200);
        }
    }
    
}