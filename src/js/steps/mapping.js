/**
 * Handles the Mapping step functionality
 * Provides UI for mapping Omeka S fields to Wikidata properties
 */
import { eventSystem } from '../events.js';
import { showMessage, createElement, createListItem, createDownloadLink } from '../ui/components.js';
import { getCompletePropertyData } from '../api/wikidata.js';
export function setupMappingStep(state) {
    // Initialize DOM elements
    const entitySchemaInput = document.getElementById('entity-schema');
    const nonLinkedKeysList = document.getElementById('non-linked-keys');
    const mappedKeysList = document.getElementById('mapped-keys');
    const ignoredKeysList = document.getElementById('ignored-keys');
    const manualPropertiesList = document.getElementById('manual-properties');
    const addManualPropertyBtn = document.getElementById('add-manual-property');
    const proceedToReconciliationBtn = document.getElementById('proceed-to-reconciliation');
    const testMappingModelBtn = document.getElementById('test-mapping-model');
    const loadMappingBtn = document.getElementById('load-mapping');
    const saveMappingBtn = document.getElementById('save-mapping');
    const loadMappingFileInput = document.getElementById('load-mapping-file');
    
    // Don't set a default entity schema - leave it empty
    // The user should explicitly choose a valid Wikidata Q-identifier
    
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
    
    // Add manual property functionality
    if (addManualPropertyBtn) {
        addManualPropertyBtn.addEventListener('click', () => {
            openAddManualPropertyModal();
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
                    } else if (typeof definition === 'object' && definition['@id']) {
                        contextMap.set(prefix, definition['@id']);
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
    
    // Helper function to convert camelCase to spaced words
    function convertCamelCaseToSpaces(text) {
        // Insert space before uppercase letters that are preceded by lowercase letters or digits
        return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
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
            
            // Handle both object and string contexts
            if (typeof context === 'object') {
                for (const [prefix, uri] of Object.entries(context)) {
                    if (typeof uri === 'string') {
                        contextMap.set(prefix, uri);
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
        
        if (!currentState.fetchedData) {
            return;
        }
        
        // Analyze all keys from the complete dataset
        const keyAnalysis = await extractAndAnalyzeKeys(currentState.fetchedData);
        
        // Initialize arrays if they don't exist in state
        state.ensureMappingArrays();
        
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
        } catch (error) {
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
        
        // Add regular keys to non-linked keys
        const currentNonLinkedKeys = updatedState.mappings.nonLinkedKeys.filter(k => 
            !keyAnalysis.find(ka => ka.key === (k.key || k))
        );
        const allNonLinkedKeys = [...currentNonLinkedKeys, ...regularKeys];
        
        // Update all mappings atomically
        state.updateMappings(allNonLinkedKeys, updatedState.mappings.mappedKeys, currentIgnoredKeys);
        
        // Get final state for UI update
        const finalState = state.getState();
        
        // Populate the UI lists
        populateKeyList(nonLinkedKeysList, finalState.mappings.nonLinkedKeys, 'non-linked');
        populateKeyList(mappedKeysList, finalState.mappings.mappedKeys, 'mapped');
        populateKeyList(ignoredKeysList, finalState.mappings.ignoredKeys, 'ignored');
        populateManualPropertiesList(manualPropertiesList, finalState.mappings.manualProperties);
        
        // Update section counts
        updateSectionCounts(finalState.mappings);
        
        // Auto-add metadata fields and P31 (instance of) if not already mapped or present as manual property
        autoAddMetadataFields(finalState);
        autoAddInstanceOfProperty(finalState);
        
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
    
    // Auto-add metadata fields (label, description, aliases) if not already present
    async function autoAddMetadataFields(currentState) {
        const metadataFields = [
            {
                id: 'label',
                label: 'label',
                description: 'Human-readable name of the item',
                datatype: 'monolingualtext',
                datatypeLabel: 'Monolingual text',
                isMetadata: true
            },
            {
                id: 'description',
                label: 'description',
                description: 'Short description of the item',
                datatype: 'monolingualtext',
                datatypeLabel: 'Monolingual text',
                isMetadata: true
            },
            {
                id: 'aliases',
                label: 'aliases',
                description: 'Alternative names for the item',
                datatype: 'monolingualtext',
                datatypeLabel: 'Monolingual text',
                isMetadata: true
            }
        ];
        
        for (const field of metadataFields) {
            // Check if this metadata field is already in manual properties
            const hasField = currentState.mappings.manualProperties.some(prop => 
                prop.property.id === field.id && prop.property.isMetadata
            );
            
            if (!hasField) {
                const metadataProperty = {
                    property: field,
                    defaultValue: '',
                    isRequired: false,
                    isMetadata: true,
                    cannotRemove: true // Make it non-removable like P31
                };
                
                state.addManualProperty(metadataProperty);
            }
        }
        
        // Refresh the manual properties display
        const manualPropertiesList = document.getElementById('manual-properties');
        if (manualPropertiesList) {
            populateManualPropertiesList(manualPropertiesList, state.getState().mappings.manualProperties);
            updateSectionCounts(state.getState().mappings);
        }
    }
    
    // Auto-add P31 (instance of) if not already mapped or present as manual property
    async function autoAddInstanceOfProperty(currentState) {
        // Check if P31 or P279 is already mapped
        const hasP31Mapped = currentState.mappings.mappedKeys.some(key => 
            key.property && (key.property.id === 'P31' || key.property.id === 'P279')
        );
        
        // Check if P31 or P279 is already in manual properties
        const hasP31Manual = currentState.mappings.manualProperties.some(prop => 
            prop.property.id === 'P31' || prop.property.id === 'P279'
        );
        
        // If neither P31 nor P279 is mapped or manual, auto-add P31
        if (!hasP31Mapped && !hasP31Manual) {
            try {
                // Get complete property data for P31
                const propertyData = await getCompletePropertyData('P31');
                
                const p31Property = {
                    property: {
                        id: 'P31',
                        label: 'instance of',
                        description: 'that class of which this subject is a particular example and member',
                        datatype: 'wikibase-item',
                        datatypeLabel: 'Item',
                        ...propertyData
                    },
                    defaultValue: '', // User needs to provide a value
                    isRequired: true,
                    cannotRemove: true // Make it non-removable
                };
                
                state.addManualProperty(p31Property);
                
                // Refresh the manual properties display
                populateManualPropertiesList(manualPropertiesList, state.getState().mappings.manualProperties);
                updateSectionCounts(state.getState().mappings);
                
                // Show message to user
                showMessage('Added required property: instance of (P31). Please set a default value.', 'info', 5000);
                
            } catch (error) {
                console.error('Error auto-adding P31:', error);
                // Fallback to basic P31 without constraints
                const p31Property = {
                    property: {
                        id: 'P31',
                        label: 'instance of',
                        description: 'that class of which this subject is a particular example and member',
                        datatype: 'wikibase-item',
                        datatypeLabel: 'Item'
                    },
                    defaultValue: '',
                    isRequired: true,
                    cannotRemove: true
                };
                
                state.addManualProperty(p31Property);
                populateManualPropertiesList(manualPropertiesList, state.getState().mappings.manualProperties);
                updateSectionCounts(state.getState().mappings);
                showMessage('Added required property: instance of (P31). Please set a default value.', 'info', 5000);
            }
        }
    }
    
    // Helper function to update section counts in summary headers
    function updateSectionCounts(mappings) {
        const totalKeys = mappings.nonLinkedKeys.length + mappings.mappedKeys.length + mappings.ignoredKeys.length;
        const manualPropertiesCount = mappings.manualProperties?.length || 0;
        
        // Update Manual Properties section (now first)
        const manualPropertiesSection = document.querySelector('.key-sections .section:nth-child(1) summary');
        if (manualPropertiesSection) {
            manualPropertiesSection.innerHTML = `<span class="section-title">Extra Wikidata properties and metadata</span><span class="section-count">(${manualPropertiesCount})</span>`;
        }
        
        // Update Non-linked Keys section (now second)
        const nonLinkedSection = document.querySelector('.key-sections .section:nth-child(2) summary');
        if (nonLinkedSection) {
            nonLinkedSection.innerHTML = `<span class="section-title">Non-linked Keys</span><span class="section-count">(${mappings.nonLinkedKeys.length}/${totalKeys})</span>`;
        }
        
        // Update Mapped Keys section (now third)
        const mappedSection = document.querySelector('.key-sections .section:nth-child(3) summary');
        if (mappedSection) {
            mappedSection.innerHTML = `<span class="section-title">Mapped Keys</span><span class="section-count">(${mappings.mappedKeys.length}/${totalKeys})</span>`;
        }
        
        // Update Ignored Keys section (now fourth)
        const ignoredSection = document.querySelector('.key-sections .section:nth-child(4) summary');
        if (ignoredSection) {
            ignoredSection.innerHTML = `<span class="section-title">Ignored Keys</span><span class="section-count">(${mappings.ignoredKeys.length}/${totalKeys})</span>`;
        }
    }
    
    // Helper function to populate a key list
    function populateKeyList(listElement, keys, type) {
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (!keys.length) {
            const placeholderText = type === 'non-linked'
                ? 'All keys have been processed'
                : type === 'mapped'
                    ? 'No mapped keys yet'
                    : 'No ignored keys';
            const placeholder = createListItem(placeholderText, { isPlaceholder: true });
            listElement.appendChild(placeholder);
            return;
        }
        
        keys.forEach(keyObj => {
            // Handle both string keys (legacy) and key objects
            const keyData = typeof keyObj === 'string' 
                ? { key: keyObj, type: 'unknown', frequency: 1, totalItems: 1 }
                : keyObj;
            
            // Create compact key display
            const keyDisplay = createElement('div', {
                className: keyData.notInCurrentDataset 
                    ? 'key-item-compact not-in-current-dataset'
                    : 'key-item-compact'
            });
            
            const keyName = createElement('span', {
                className: 'key-name-compact'
            }, keyData.key);
            keyDisplay.appendChild(keyName);
            
            // Show property info for mapped keys immediately after key name
            if (type === 'mapped' && keyData.property) {
                const propertyInfo = createElement('span', {
                    className: 'property-info'
                }, ` → ${keyData.property.id}: ${keyData.property.label}`);
                keyDisplay.appendChild(propertyInfo);
            }
            
            // Show frequency information at the end
            if (keyData.frequency && keyData.totalItems) {
                const frequencyIndicator = createElement('span', {
                    className: 'key-frequency'
                }, `(${keyData.frequency}/${keyData.totalItems})`);
                keyDisplay.appendChild(frequencyIndicator);
            } else if (keyData.notInCurrentDataset) {
                // Show indicator for keys not in current dataset
                const notInDatasetIndicator = createElement('span', {
                    className: 'not-in-dataset-indicator'
                }, '(not in current dataset)');
                keyDisplay.appendChild(notInDatasetIndicator);
            }
            
            // Create list item with appropriate options
            const liOptions = {
                className: keyData.notInCurrentDataset 
                    ? 'clickable key-item-clickable-compact not-in-current-dataset disabled'
                    : 'clickable key-item-clickable-compact',
                onClick: !keyData.notInCurrentDataset ? () => openMappingModal(keyData) : null,
                dataset: { key: keyData.key }
            };
            
            if (keyData.notInCurrentDataset) {
                liOptions.title = 'This key is not present in the current dataset';
            }
            
            const li = createListItem(keyDisplay, liOptions);
            
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
    
    // Helper function to populate manual properties list
    function populateManualPropertiesList(listElement, manualProperties) {
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (!manualProperties.length) {
            const placeholder = createListItem('No additional properties added yet', { isPlaceholder: true });
            listElement.appendChild(placeholder);
            return;
        }
        
        manualProperties.forEach(manualProp => {
            // Create the main display content using the same pattern as other key lists
            const keyDisplay = createElement('div', {
                className: 'key-item-compact'
            });
            
            // Property name and ID
            const propertyDisplayText = manualProp.property.isMetadata 
                ? `${manualProp.property.label} (metadata)`
                : `${manualProp.property.label} (${manualProp.property.id})`;
            const propertyName = createElement('span', {
                className: 'key-name-compact'
            }, propertyDisplayText);
            keyDisplay.appendChild(propertyName);
            
            // Property info section showing default value and required status
            let infoText = '';
            if (manualProp.defaultValue) {
                infoText = `Default: ${manualProp.defaultValue}`;
            } else {
                infoText = 'No default value';
            }
            if (manualProp.isRequired) {
                infoText += ' • Required';
            }
            
            const propertyInfo = createElement('span', {
                className: 'property-info'
            }, infoText);
            keyDisplay.appendChild(propertyInfo);
            
            // Remove button styled like frequency badges (only if removable)
            if (!manualProp.cannotRemove) {
                const removeBtn = createElement('button', {
                    className: 'key-frequency remove-manual-property-btn',
                    onClick: (e) => {
                        e.stopPropagation();
                        removeManualPropertyFromUI(manualProp.property.id);
                    },
                    title: 'Remove this additional property'
                }, '×');
                keyDisplay.appendChild(removeBtn);
            }
            
            // Create list item with standard styling and behavior
            const li = createListItem(keyDisplay, {
                className: 'clickable key-item-clickable-compact',
                onClick: () => openManualPropertyEditModal(manualProp),
                title: 'Click to edit this additional property'
            });
            
            listElement.appendChild(li);
        });
    }
    
    // Function to open edit modal for manual property
    function openManualPropertyEditModal(manualProp) {
        // Import modal functionality
        import('../ui/modal-ui.js').then(({ setupModalUI }) => {
            const modalUI = setupModalUI();
            
            // Check if this is a metadata field
            if (manualProp.property.isMetadata) {
                // Create simplified modal content for metadata
                const modalContent = createMetadataEditModalContent(manualProp);
                
                // Create buttons for metadata
                const buttons = [
                    {
                        text: 'Cancel',
                        type: 'secondary',
                        keyboardShortcut: 'Escape',
                        callback: () => {
                            modalUI.closeModal();
                        }
                    },
                    {
                        text: 'Update',
                        type: 'primary',
                        keyboardShortcut: 'Enter',
                        callback: () => {
                            const defaultValueInput = document.getElementById('metadata-default-value-input');
                            const defaultValue = defaultValueInput ? defaultValueInput.value.trim() : '';
                            
                            // Update the metadata property
                            const updatedProp = {
                                ...manualProp,
                                defaultValue
                            };
                            
                            // Remove and re-add to update
                            state.removeManualProperty(manualProp.property.id);
                            state.addManualProperty(updatedProp);
                            
                            populateLists();
                            modalUI.closeModal();
                            showMessage(`Updated ${manualProp.property.label}`, 'success', 2000);
                        }
                    }
                ];
                
                // Open modal with metadata-specific title
                modalUI.openModal(
                    manualProp.property.label.charAt(0).toUpperCase() + manualProp.property.label.slice(1),
                    modalContent,
                    buttons
                );
            } else {
                // Regular property - use existing flow
                const modalContent = createAddManualPropertyModalContent(manualProp);
                
                const buttons = [
                    {
                        text: 'Cancel',
                        type: 'secondary',
                        keyboardShortcut: 'Escape',
                        callback: () => {
                            modalUI.closeModal();
                        }
                    },
                    {
                        text: 'Update Property',
                        type: 'primary',
                        keyboardShortcut: 'Enter',
                        callback: () => {
                            const { selectedProperty, defaultValue, isRequired } = getManualPropertyFromModal();
                            if (selectedProperty) {
                                // Remove the old property and add the updated one
                                state.removeManualProperty(manualProp.property.id);
                                addManualPropertyToState(selectedProperty, defaultValue, isRequired);
                                modalUI.closeModal();
                            } else {
                                showMessage('Please select a Wikidata property first.', 'warning', 3000);
                            }
                        }
                    }
                ];
                
                // Open modal
                modalUI.openModal(
                    'Edit Additional Custom Wikidata Property',
                    modalContent,
                    buttons
                );
            }
        });
    }
    
    // Create modal content for metadata fields
    function createMetadataEditModalContent(manualProp) {
        const container = createElement('div', {
            className: 'metadata-edit-modal-content'
        });
        
        // Description section
        const descriptionSection = createElement('div', {
            className: 'metadata-description-section',
            style: 'margin-bottom: 20px;'
        });
        descriptionSection.innerHTML = `
            <p>${manualProp.property.description}</p>
        `;
        container.appendChild(descriptionSection);
        
        // Default value section
        const defaultValueSection = createElement('div', {
            className: 'default-value-section'
        });
        defaultValueSection.innerHTML = `
            <h4>Default Value (Optional)</h4>
            <div class="default-value-description">
                This value will be pre-filled for all items. You can modify individual values during reconciliation.
            </div>
            <div class="default-value-input-container">
                <input type="text" id="metadata-default-value-input" 
                       placeholder="Enter a default value..." 
                       class="default-value-input"
                       value="${manualProp.defaultValue || ''}">
                <div class="input-help">Enter a text value for ${manualProp.property.label}</div>
            </div>
        `;
        container.appendChild(defaultValueSection);
        
        return container;
    }
    
    // Remove manual property from UI and state
    function removeManualPropertyFromUI(propertyId) {
        // Check if this property can be removed
        const currentState = state.getState();
        const property = currentState.mappings.manualProperties.find(p => p.property.id === propertyId);
        
        if (property && property.cannotRemove) {
            showMessage('This property cannot be removed', 'warning', 2000);
            return;
        }
        
        state.removeManualProperty(propertyId);
        populateLists();
        showMessage('Additional property removed', 'success', 2000);
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
                    text: 'Ignore and Next',
                    type: 'secondary',
                    keyboardShortcut: 'x',
                    callback: () => {
                        moveKeyToCategory(keyData, 'ignored');
                        modalUI.closeModal();
                        moveToNextUnmappedKey();
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
        const container = createElement('div', {
            className: 'mapping-modal-content'
        });
        
        // Key information section
        const keyInfo = createElement('div', {
            className: 'key-info'
        });
        
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
        const searchSection = createElement('div', {
            className: 'property-search'
        });
        searchSection.innerHTML = `
            <h4>Search Wikidata Properties</h4>
            <input type="text" id="property-search-input" placeholder="Type to search for Wikidata properties..." class="property-search-input">
            <div id="property-suggestions" class="property-suggestions"></div>
            <div id="selected-property" class="selected-property" style="display: none;">
                <h4>Selected Property</h4>
                <div id="selected-property-details"></div>
                <div id="property-constraints" class="property-constraints" style="display: none;">
                    <div class="constraint-loading" style="display: none;">Loading constraint information...</div>
                    <div class="constraint-content"></div>
                    <div class="constraint-info-notice">
                        This information is automatically retrieved from Wikidata and cannot be changed.
                    </div>
                </div>
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
            searchInput.value = `${keyData.property.id}: ${keyData.property.label}`;
        } else {
            window.currentMappingSelectedProperty = null;
            
            // Pre-fill search with key name (without schema prefix) and auto-search
            if (keyData && keyData.key) {
                let searchTerm = keyData.key;
                
                // Remove schema prefix if present (everything before and including ':')
                if (searchTerm.includes(':')) {
                    searchTerm = searchTerm.split(':').pop();
                }
                
                // Convert camelCase to spaced words
                searchTerm = convertCamelCaseToSpaces(searchTerm);
                
                // Set the search input value
                searchInput.value = searchTerm;
                
                // Automatically perform the search if the term is meaningful
                if (searchTerm.trim().length >= 2) {
                    // Small delay to ensure DOM is ready
                    setTimeout(() => {
                        searchWikidataProperties(searchTerm.trim(), suggestionsContainer);
                    }, 100);
                }
            }
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
            const autoSection = createElement('div', {
                className: 'suggestion-section'
            });
            autoSection.innerHTML = '<h5>Previously Used</h5>';
            
            autoSuggestions.forEach(property => {
                const item = createPropertySuggestionItem(property, true);
                autoSection.appendChild(item);
            });
            
            container.appendChild(autoSection);
        }
        
        // Show Wikidata results
        if (wikidataResults.length > 0) {
            const wikidataSection = createElement('div', {
                className: 'suggestion-section'
            });
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
        const item = createElement('div', {
            className: `property-suggestion-item ${isPrevious ? 'previous' : ''}`,
            onClick: () => selectProperty(property)
        });
        
        item.innerHTML = `
            <div class="property-main">
                <span class="property-id">${property.id}</span>
                <span class="property-label">${property.label}</span>
            </div>
            <div class="property-description">${property.description}</div>
        `;
        
        return item;
    }
    
    // Select a property
    async function selectProperty(property) {
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
        
        // Fetch and display constraints
        await displayPropertyConstraints(property.id);
    }
    
    // Display property constraints
    async function displayPropertyConstraints(propertyId) {
        const constraintsContainer = document.getElementById('property-constraints');
        const loadingDiv = constraintsContainer?.querySelector('.constraint-loading');
        const contentDiv = constraintsContainer?.querySelector('.constraint-content');
        
        if (!constraintsContainer || !loadingDiv || !contentDiv) return;
        
        // Show container and loading state
        constraintsContainer.style.display = 'block';
        loadingDiv.style.display = 'block';
        contentDiv.innerHTML = '';
        
        try {
            // Fetch complete property data with constraints
            const propertyData = await getCompletePropertyData(propertyId);
            
            // Update the selected property with complete data
            window.currentMappingSelectedProperty = {
                ...window.currentMappingSelectedProperty,
                ...propertyData
            };
            
            // Hide loading
            loadingDiv.style.display = 'none';
            
            // Build constraint display
            let constraintHtml = '';
            
            // Always show datatype
            constraintHtml += `<div class="constraint-datatype"><strong>Wikidata expects:</strong> ${propertyData.datatypeLabel}</div>`;
            
            // Show format constraints if any
            if (propertyData.constraints.format.length > 0) {
                const formatDescriptions = propertyData.constraints.format
                    .filter(c => c.rank !== 'deprecated')
                    .map(c => c.description)
                    .join('; ');
                
                if (formatDescriptions) {
                    constraintHtml += `<div class="constraint-format"><strong>Format requirements:</strong> ${formatDescriptions}</div>`;
                }
            }
            
            // Show value type constraints if any
            if (propertyData.constraints.valueType.length > 0) {
                const valueTypeDescriptions = propertyData.constraints.valueType
                    .filter(c => c.rank !== 'deprecated')
                    .map(constraint => {
                        // Convert Q-numbers to human-readable labels
                        const classLabels = constraint.classes.map(qId => {
                            return constraint.classLabels[qId] || qId;
                        });
                        return classLabels.join(', ');
                    })
                    .join('; ');
                
                if (valueTypeDescriptions) {
                    constraintHtml += `<div class="constraint-value-types"><strong>Must be:</strong> ${valueTypeDescriptions}</div>`;
                }
            }
            
            contentDiv.innerHTML = constraintHtml;
            
        } catch (error) {
            console.error('Error fetching property constraints:', error);
            loadingDiv.style.display = 'none';
            contentDiv.innerHTML = '<div class="constraint-error">Unable to load constraint information</div>';
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
        state.updateMappings(updatedNonLinkedKeys, updatedMappedKeys, updatedIgnoredKeys);
        
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
            state.updateMappings(cleanedNonLinkedKeys, cleanedMappedKeys, finalIgnoredKeys);
        } else if (category === 'mapped') {
            const finalMappedKeys = [...cleanedMappedKeys, keyDataWithAnimation];
            state.updateMappings(cleanedNonLinkedKeys, finalMappedKeys, cleanedIgnoredKeys);
        } else if (category === 'non-linked') {
            const finalNonLinkedKeys = [...cleanedNonLinkedKeys, keyDataWithAnimation];
            state.updateMappings(finalNonLinkedKeys, cleanedMappedKeys, cleanedIgnoredKeys);
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
    
    // Function to open manual property modal
    function openAddManualPropertyModal() {
        // Import modal functionality
        import('../ui/modal-ui.js').then(({ setupModalUI }) => {
            const modalUI = setupModalUI();
            
            // Create modal content
            const modalContent = createAddManualPropertyModalContent();
            
            // Create buttons
            const buttons = [
                {
                    text: 'Cancel',
                    type: 'secondary',
                    keyboardShortcut: 'Escape',
                    callback: () => {
                        modalUI.closeModal();
                    }
                },
                {
                    text: 'Add Property',
                    type: 'primary',
                    keyboardShortcut: 'Enter',
                    callback: () => {
                        const { selectedProperty, defaultValue, isRequired } = getManualPropertyFromModal();
                        if (selectedProperty) {
                            addManualPropertyToState(selectedProperty, defaultValue, isRequired);
                            modalUI.closeModal();
                        } else {
                            showMessage('Please select a Wikidata property first.', 'warning', 3000);
                        }
                    }
                }
            ];
            
            // Open modal
            modalUI.openModal(
                'Add Additional Custom Wikidata Property',
                modalContent,
                buttons
            );
        });
    }
    
    // Create the content for the add manual property modal
    function createAddManualPropertyModalContent(existingProperty = null) {
        const container = createElement('div', {
            className: 'manual-property-modal-content'
        });
        
        // Property search section (reuse existing search functionality)
        const searchSection = createElement('div', {
            className: 'property-search'
        });
        searchSection.innerHTML = `
            <h4>Search Wikidata Properties</h4>
            <input type="text" id="manual-property-search-input" placeholder="Type to search for Wikidata properties..." class="property-search-input">
            <div id="manual-property-suggestions" class="property-suggestions"></div>
            <div id="manual-selected-property" class="selected-property" style="display: none;">
                <h4>Selected Property</h4>
                <div id="manual-selected-property-details"></div>
                <div id="manual-property-constraints" class="property-constraints" style="display: none;">
                    <div class="constraint-loading" style="display: none;">Loading constraint information...</div>
                    <div class="constraint-content"></div>
                    <div class="constraint-info-notice">
                        This information is automatically retrieved from Wikidata and cannot be changed.
                    </div>
                </div>
            </div>
        `;
        container.appendChild(searchSection);
        
        // Instance of / Subclass of toggle section (for P31/P279)
        const classificationSection = createElement('div', {
            className: 'classification-toggle-section',
            style: 'display: none;' // Initially hidden, shown when P31 or P279 is selected
        });
        classificationSection.innerHTML = `
            <h4>Classification Type</h4>
            <div class="classification-options">
                <label>
                    <input type="radio" name="classification-type" value="P31" checked>
                    Instance of (P31) - This item is an example of this class
                </label>
                <label>
                    <input type="radio" name="classification-type" value="P279">
                    Subclass of (P279) - This item type is a subtype of this class
                </label>
            </div>
        `;
        container.appendChild(classificationSection);
        
        // Default value section
        const defaultValueSection = createElement('div', {
            className: 'default-value-section'
        });
        defaultValueSection.innerHTML = `
            <h4>Default Value (Optional)</h4>
            <div class="default-value-description">
                This value will be pre-filled for all items. You can modify individual values during reconciliation.
            </div>
            <div id="default-value-input-container" class="default-value-input-container">
                <input type="text" id="default-value-input" placeholder="Enter a default value..." class="default-value-input">
            </div>
        `;
        container.appendChild(defaultValueSection);
        
        // Setup search functionality
        setTimeout(() => setupManualPropertySearch(existingProperty), 100);
        
        return container;
    }
    
    // Setup search functionality for manual property modal
    function setupManualPropertySearch(existingProperty = null) {
        const searchInput = document.getElementById('manual-property-search-input');
        const suggestionsContainer = document.getElementById('manual-property-suggestions');
        let searchTimeout;
        
        if (!searchInput) return;
        
        // Pre-populate if editing existing property
        if (existingProperty) {
            window.currentManualPropertySelected = existingProperty.property;
            selectManualProperty(existingProperty.property);
            searchInput.value = `${existingProperty.property.id}: ${existingProperty.property.label}`;
            
            // Pre-populate default value
            setTimeout(() => {
                const defaultValueInput = document.getElementById('default-value-input');
                if (defaultValueInput && existingProperty.defaultValue) {
                    defaultValueInput.value = existingProperty.defaultValue;
                }
            }, 200);
        } else {
            window.currentManualPropertySelected = null;
        }
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                suggestionsContainer.innerHTML = '';
                return;
            }
            
            searchTimeout = setTimeout(() => {
                searchManualPropertyWikidataProperties(query, suggestionsContainer);
            }, 300);
        });
    }
    
    // Search Wikidata properties for manual property modal
    async function searchManualPropertyWikidataProperties(query, container) {
        try {
            container.innerHTML = '<div class="loading">Searching...</div>';
            
            // Wikidata API search
            const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=property&format=json&origin=*`;
            
            const response = await fetch(wikidataUrl);
            const data = await response.json();
            
            displayManualPropertySuggestions(data.search || [], container);
        } catch (error) {
            console.error('Error searching Wikidata properties:', error);
            container.innerHTML = '<div class="error">Error searching properties. Please try again.</div>';
        }
    }
    
    // Display property suggestions for manual property modal
    function displayManualPropertySuggestions(wikidataResults, container) {
        container.innerHTML = '';
        
        if (wikidataResults.length > 0) {
            wikidataResults.forEach(property => {
                const formattedProperty = {
                    id: property.id,
                    label: property.label,
                    description: property.description || 'No description available'
                };
                const item = createManualPropertySuggestionItem(formattedProperty);
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<div class="no-results">No properties found</div>';
        }
    }
    
    // Create a property suggestion item for manual property modal
    function createManualPropertySuggestionItem(property) {
        const item = createElement('div', {
            className: 'property-suggestion-item',
            onClick: () => selectManualProperty(property)
        });
        
        item.innerHTML = `
            <div class="property-main">
                <span class="property-id">${property.id}</span>
                <span class="property-label">${property.label}</span>
            </div>
            <div class="property-description">${property.description}</div>
        `;
        
        return item;
    }
    
    // Select a property in manual property modal
    async function selectManualProperty(property) {
        // Remove selection from other items
        document.querySelectorAll('.property-suggestion-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to clicked item
        if (typeof event !== 'undefined' && event.target) {
            const targetItem = event.target.closest('.property-suggestion-item');
            if (targetItem) {
                targetItem.classList.add('selected');
            }
        }
        
        // Store selected property
        window.currentManualPropertySelected = property;
        
        // Update search input with selected property label
        const searchInput = document.getElementById('manual-property-search-input');
        if (searchInput) {
            searchInput.value = `${property.id}: ${property.label}`;
        }
        
        // Clear suggestions container
        const suggestionsContainer = document.getElementById('manual-property-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = '';
        }
        
        // Show selected property details
        const selectedContainer = document.getElementById('manual-selected-property');
        const detailsContainer = document.getElementById('manual-selected-property-details');
        
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
        
        // Show classification toggle if this is P31 or P279
        const classificationSection = document.querySelector('.classification-toggle-section');
        if (classificationSection) {
            if (property.id === 'P31' || property.id === 'P279') {
                classificationSection.style.display = 'block';
                // Set the appropriate radio button
                const radio = document.querySelector(`input[name="classification-type"][value="${property.id}"]`);
                if (radio) radio.checked = true;
            } else {
                classificationSection.style.display = 'none';
            }
        }
        
        // Fetch and display constraints
        await displayManualPropertyConstraints(property.id);
        
        // Update default value input based on datatype
        updateDefaultValueInputForDatatype(property);
    }
    
    // Display property constraints for manual property modal
    async function displayManualPropertyConstraints(propertyId) {
        const constraintsContainer = document.getElementById('manual-property-constraints');
        const loadingDiv = constraintsContainer?.querySelector('.constraint-loading');
        const contentDiv = constraintsContainer?.querySelector('.constraint-content');
        
        if (!constraintsContainer || !loadingDiv || !contentDiv) return;
        
        // Show container and loading state
        constraintsContainer.style.display = 'block';
        loadingDiv.style.display = 'block';
        contentDiv.innerHTML = '';
        
        try {
            // Fetch complete property data with constraints
            const propertyData = await getCompletePropertyData(propertyId);
            
            // Update the selected property with complete data
            window.currentManualPropertySelected = {
                ...window.currentManualPropertySelected,
                ...propertyData
            };
            
            // Hide loading
            loadingDiv.style.display = 'none';
            
            // Build constraint display
            let constraintHtml = '';
            
            // Always show datatype
            constraintHtml += `<div class="constraint-datatype"><strong>Wikidata expects:</strong> ${propertyData.datatypeLabel}</div>`;
            
            // Show format constraints if any
            if (propertyData.constraints.format.length > 0) {
                const formatDescriptions = propertyData.constraints.format
                    .filter(c => c.rank !== 'deprecated')
                    .map(c => c.description)
                    .join('; ');
                
                if (formatDescriptions) {
                    constraintHtml += `<div class="constraint-format"><strong>Format requirements:</strong> ${formatDescriptions}</div>`;
                }
            }
            
            // Show value type constraints if any
            if (propertyData.constraints.valueType.length > 0) {
                const valueTypeDescriptions = propertyData.constraints.valueType
                    .filter(c => c.rank !== 'deprecated')
                    .map(constraint => {
                        // Convert Q-numbers to human-readable labels
                        const classLabels = constraint.classes.map(qId => {
                            return constraint.classLabels[qId] || qId;
                        });
                        return classLabels.join(', ');
                    })
                    .join('; ');
                
                if (valueTypeDescriptions) {
                    constraintHtml += `<div class="constraint-value-types"><strong>Must be:</strong> ${valueTypeDescriptions}</div>`;
                }
            }
            
            contentDiv.innerHTML = constraintHtml;
            
            // Update default value input based on complete property data
            updateDefaultValueInputForDatatype(propertyData);
            
        } catch (error) {
            console.error('Error fetching property constraints:', error);
            loadingDiv.style.display = 'none';
            contentDiv.innerHTML = '<div class="constraint-error">Unable to load constraint information</div>';
        }
    }
    
    // Update default value input based on property datatype
    function updateDefaultValueInputForDatatype(propertyData) {
        const inputContainer = document.getElementById('default-value-input-container');
        if (!inputContainer) return;
        
        const datatype = propertyData.datatype;
        let inputHtml = '';
        
        switch (datatype) {
            case 'wikibase-item':
                inputHtml = `
                    <input type="text" id="default-value-input" placeholder="Search for a Wikidata item..." class="default-value-input item-search-input">
                    <div id="default-value-suggestions" class="property-suggestions"></div>
                `;
                break;
            case 'time':
                inputHtml = `
                    <input type="date" id="default-value-input" class="default-value-input">
                    <div class="input-help">Enter a date value</div>
                `;
                break;
            case 'quantity':
                inputHtml = `
                    <input type="number" id="default-value-input" placeholder="Enter a number..." class="default-value-input">
                    <div class="input-help">Enter a numeric value</div>
                `;
                break;
            case 'string':
            case 'monolingualtext':
            default:
                inputHtml = `
                    <input type="text" id="default-value-input" placeholder="Enter a text value..." class="default-value-input">
                    <div class="input-help">Enter a text value</div>
                `;
                break;
        }
        
        inputContainer.innerHTML = inputHtml;
    }
    
    // Get manual property data from modal
    function getManualPropertyFromModal() {
        const selectedProperty = window.currentManualPropertySelected;
        const defaultValueInput = document.getElementById('default-value-input');
        const classificationRadio = document.querySelector('input[name="classification-type"]:checked');
        
        let defaultValue = defaultValueInput ? defaultValueInput.value.trim() : '';
        let isRequired = false;
        
        // Handle classification properties
        if (selectedProperty && (selectedProperty.id === 'P31' || selectedProperty.id === 'P279')) {
            isRequired = true;
            // Update the property ID based on the radio selection
            if (classificationRadio && classificationRadio.value !== selectedProperty.id) {
                selectedProperty.id = classificationRadio.value;
                selectedProperty.label = classificationRadio.value === 'P31' ? 'instance of' : 'subclass of';
            }
        }
        
        return {
            selectedProperty,
            defaultValue,
            isRequired
        };
    }
    
    // Add manual property to state
    function addManualPropertyToState(property, defaultValue, isRequired) {
        const manualProperty = {
            property,
            defaultValue,
            isRequired
        };
        
        state.addManualProperty(manualProperty);
        
        // Refresh the UI
        populateLists();
        
        showMessage(`Added additional property: ${property.label} (${property.id})`, 'success', 3000);
    }
    
    // Generate mapping data for saving
    function generateMappingData(state) {
        const currentState = state.getState();
        const mappingData = {
            version: "1.0",
            createdAt: new Date().toISOString(),
            entitySchema: currentState.entitySchema || '',
            mappings: {
                mapped: currentState.mappings.mappedKeys.map(key => ({
                    key: key.key,
                    linkedDataUri: key.linkedDataUri,
                    contextMap: key.contextMap && key.contextMap instanceof Map ? Object.fromEntries(key.contextMap) : {},
                    property: key.property ? {
                        id: key.property.id,
                        label: key.property.label,
                        description: key.property.description,
                        datatype: key.property.datatype,
                        datatypeLabel: key.property.datatypeLabel,
                        constraints: key.property.constraints,
                        constraintsFetched: key.property.constraintsFetched,
                        constraintsError: key.property.constraintsError
                    } : null,
                    mappedAt: key.mappedAt
                })),
                ignored: currentState.mappings.ignoredKeys.map(key => ({
                    key: key.key,
                    linkedDataUri: key.linkedDataUri,
                    contextMap: key.contextMap && key.contextMap instanceof Map ? Object.fromEntries(key.contextMap) : {}
                })),
                manualProperties: (currentState.mappings.manualProperties || []).map(prop => ({
                    property: {
                        id: prop.property.id,
                        label: prop.property.label,
                        description: prop.property.description,
                        datatype: prop.property.datatype,
                        datatypeLabel: prop.property.datatypeLabel,
                        constraints: prop.property.constraints,
                        constraintsFetched: prop.property.constraintsFetched,
                        constraintsError: prop.property.constraintsError
                    },
                    defaultValue: prop.defaultValue,
                    isRequired: prop.isRequired,
                    addedAt: prop.addedAt
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
        
        const downloadLink = createDownloadLink(url, filename, {
            onClick: () => {
                // Clean up the URL after download
                setTimeout(() => URL.revokeObjectURL(url), 100);
            }
        });
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
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
        
        // Load manual properties
        const manualProperties = mappingData.mappings.manualProperties || [];
        
        // Update state
        state.updateMappings([], mappedKeys, ignoredKeys); // Clear non-linked keys, load mapped and ignored
        
        // Clear existing manual properties and add loaded ones
        currentState.mappings.manualProperties = [];
        manualProperties.forEach(prop => {
            state.addManualProperty(prop);
        });
        
        // Update UI
        populateLists();
        
    }
    
}