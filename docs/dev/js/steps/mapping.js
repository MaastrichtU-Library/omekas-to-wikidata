/**
 * Handles the Mapping step functionality
 * Provides UI for mapping Omeka S fields to Wikidata properties
 */
import { eventSystem } from '../events.js';
import { showMessage, createElement, createListItem, createDownloadLink } from '../ui/components.js';
import { getCompletePropertyData } from '../api/wikidata.js';
import { BLOCK_TYPES, BLOCK_METADATA, createTransformationBlock, getTransformationPreview, extractAllFields, searchFields, COMMON_REGEX_PATTERNS } from '../transformations.js';
export function setupMappingStep(state) {
    // Store state globally for access in modal functions
    window.mappingStepState = state;
    
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
    
    // Helper function to extract sample values from Omeka S structures
    // Returns the full object/array structure for Stage 1 JSON display
    function extractSampleValue(value) {
        if (value === null || value === undefined) {
            return null;
        }
        
        // Handle arrays (common in Omeka S) - return first item as full object
        if (Array.isArray(value)) {
            if (value.length === 0) return null;
            return value[0]; // Return full first object, not extracted value
        }
        
        // Return the full object/value as-is for JSON display
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
        
        // Always auto-open Extra Wikidata properties and metadata section
        const manualPropertiesListElement = document.getElementById('manual-properties');
        if (manualPropertiesListElement) {
            const manualPropertiesSection = manualPropertiesListElement.closest('details');
            if (manualPropertiesSection) {
                manualPropertiesSection.open = true;
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
                        isMetadata: true,
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
                        datatypeLabel: 'Item',
                        isMetadata: true
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
                // Create consolidated modal content for metadata with automatic data type detection
                const modalContent = createConsolidatedMetadataModalContent(manualProp);
                
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
    
    // Create consolidated modal content for metadata fields with automatic data type detection
    function createConsolidatedMetadataModalContent(manualProp) {
        const container = createElement('div', {
            className: 'metadata-consolidated-modal-content'
        });
        
        // Stage 1: Property Information (Collapsible, closed by default)
        const stage1Section = createElement('details', {
            className: 'mapping-stage',
            id: 'metadata-stage-1-property-info'
        });
        
        const stage1Summary = createElement('summary', {
            className: 'stage-summary'
        }, 'Stage 1: Property Information');
        stage1Section.appendChild(stage1Summary);
        
        const stage1Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Property information section
        const propertyInfo = createElement('div', {
            className: 'property-info'
        });
        propertyInfo.innerHTML = `
            <h4>Property Details</h4>
            <p><strong>Property:</strong> ${manualProp.property.label}</p>
            <p><strong>Description:</strong> ${manualProp.property.description}</p>
        `;
        stage1Content.appendChild(propertyInfo);
        stage1Section.appendChild(stage1Content);
        container.appendChild(stage1Section);
        
        // Stage 2: Value Type Detection (Collapsible)
        const stage2Section = createElement('details', {
            className: 'mapping-stage',
            id: 'metadata-stage-2-value-type-detection',
            open: true
        });
        
        const stage2Summary = createElement('summary', {
            className: 'stage-summary',
            id: 'metadata-stage-2-summary'
        });
        
        // Automatically detect data type based on property
        let detectedDataType;
        if (manualProp.property.id === 'P31') {
            detectedDataType = 'Wikidata item';
        } else {
            detectedDataType = 'metadata';
        }
        
        stage2Summary.textContent = `Stage 2: Value type is ${detectedDataType}`;
        stage2Section.appendChild(stage2Summary);
        
        const stage2Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Data type display section
        const dataTypeSection = createElement('div', {
            className: 'detected-datatype-section'
        });
        dataTypeSection.innerHTML = `
            <h4>Detected Data Type</h4>
            <div class="datatype-display">
                <span class="datatype-label">${detectedDataType}</span>
            </div>
            <div class="datatype-description">
                ${manualProp.property.id === 'P31' 
                    ? 'Values will link to Wikidata items representing the type or class of each item.' 
                    : manualProp.property.id === 'description'
                        ? 'Expecting a language-specific string value. Descriptions are always specific to each language and cannot have a default value for all languages.'
                        : 'Expecting a string value. Labels and aliases can have a default value for all languages, with optional language-specific overrides. <a href="https://www.wikidata.org/wiki/Help:Default_values_for_labels_and_aliases" target="_blank" rel="noopener">Learn more about default values</a>.'}
            </div>
        `;
        stage2Content.appendChild(dataTypeSection);
        stage2Section.appendChild(stage2Content);
        container.appendChild(stage2Section);
        
        // Stage 3: Options (Collapsible)
        const stage3Section = createElement('details', {
            className: 'mapping-stage',
            id: 'metadata-stage-3-options',
            open: true
        });
        
        const stage3Summary = createElement('summary', {
            className: 'stage-summary'
        }, 'Stage 3: Options');
        stage3Section.appendChild(stage3Summary);
        
        const stage3Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Default value section - different for instance of vs other metadata
        if (manualProp.property.id === 'P31') {
            const instanceOfSection = createElement('div', {
                className: 'instance-of-section'
            });
            instanceOfSection.innerHTML = `
                <h4>Default Value (Optional)</h4>
                <div class="default-value-description">
                    This Wikidata item will be pre-filled for all items. You can modify individual values during reconciliation.
                </div>
                <div class="wikidata-search-container">
                    <input type="text" id="metadata-default-value-input" 
                           placeholder="Search for a Wikidata item..." 
                           class="wikidata-item-search-input"
                           value="${manualProp.defaultValue || ''}">
                    <div class="input-help">Search for and select the Wikidata item that represents what type of thing your items are (e.g., "book", "person", "building")</div>
                </div>
            `;
            stage3Content.appendChild(instanceOfSection);
        } else {
            // Regular metadata (label, description, aliases)
            const metadataSection = createElement('div', {
                className: 'metadata-section'
            });
            metadataSection.innerHTML = `
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
                <div class="placeholder-notice">
                    <em>Additional configuration options will be available here in future updates.</em>
                </div>
            `;
            stage3Content.appendChild(metadataSection);
        }
        stage3Section.appendChild(stage3Content);
        container.appendChild(stage3Section);
        
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
        // Store keyData globally for modal title updates
        window.currentMappingKeyData = keyData;
        
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
        
        // Stage 1: Key Information and Property Selection (Collapsible)
        const stage1Section = createElement('details', {
            className: 'mapping-stage',
            id: 'stage-1-property-selection',
            open: true // Open by default
        });
        
        const stage1Summary = createElement('summary', {
            className: 'stage-summary'
        }, 'Stage 1: Property Selection');
        stage1Section.appendChild(stage1Summary);
        
        const stage1Content = createElement('div', {
            className: 'stage-content'
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
        stage1Content.appendChild(keyInfo);
        
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
        stage1Content.appendChild(searchSection);
        stage1Section.appendChild(stage1Content);
        container.appendChild(stage1Section);
        
        // Stage 2: Value Type Detection (Initially hidden)
        const stage2Section = createElement('details', {
            className: 'mapping-stage',
            id: 'stage-2-value-type-detection'
        });
        
        const stage2Summary = createElement('summary', {
            className: 'stage-summary',
            id: 'stage-2-summary'
        }, 'Stage 2: Value Type Detection');
        stage2Section.appendChild(stage2Summary);
        
        const stage2Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Data type information section
        const dataTypeInfo = createElement('div', {
            className: 'datatype-info',
            id: 'datatype-info-section'
        });
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Detected Data Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <div class="datatype-loading">Select a property to detect data type...</div>
                </div>
            </div>
            <div class="datatype-description" id="datatype-description" style="display: none;">
                <p>Additional configuration options will be available here in future versions.</p>
            </div>
        `;
        stage2Content.appendChild(dataTypeInfo);
        stage2Section.appendChild(stage2Content);
        container.appendChild(stage2Section);
        
        // Stage 3: Value manipulation (Initially hidden)
        const stage3Section = createElement('details', {
            className: 'mapping-stage',
            id: 'stage-3-value-manipulation'
        });
        
        const stage3Summary = createElement('summary', {
            className: 'stage-summary'
        }, 'Stage 3: Value manipulation');
        stage3Section.appendChild(stage3Summary);
        
        const stage3Content = createElement('div', {
            className: 'stage-content'
        });
        
        // Value transformation section
        const valueTransformationContainer = renderValueTransformationUI(keyData, state);
        stage3Content.appendChild(valueTransformationContainer);
        stage3Section.appendChild(stage3Content);
        container.appendChild(stage3Section);
        
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
            wikidataSection.innerHTML = '<h5>Select a Wikidata property</h5>';
            
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
        
        // Fetch and display constraints (existing flow)
        await displayPropertyConstraints(property.id);
        
        // NEW: Transition to Stage 2 after property selection
        await transitionToDataTypeConfiguration(property);
    }
    
    // New function to handle transition to Stage 3 (skip Stage 2)
    async function transitionToDataTypeConfiguration(property) {
        // Update modal title to show the mapping relationship
        updateModalTitle(property);
        
        // Get all stages
        const stage1 = document.getElementById('stage-1-property-selection');
        const stage2 = document.getElementById('stage-2-value-type-detection');
        const stage3 = document.getElementById('stage-3-value-manipulation');
        
        if (stage1 && stage2 && stage3) {
            // Mark stages 1 and 2 as completed
            stage1.classList.add('stage-completed');
            stage2.classList.add('stage-completed');
            
            // Collapse stages 1 and 2
            stage1.open = false;
            stage2.open = false;
            
            // Open stage 3 after a brief delay for better UX
            setTimeout(() => {
                stage3.open = true;
                // Refresh Stage 3 transformation UI with the selected property
                refreshStage3TransformationUI();
            }, 300);
        }
        
        // Still process data type information silently (for internal use)
        await displayDataTypeConfiguration(property);
    }
    
    // Update the modal title to show the mapping relationship
    function updateModalTitle(property) {
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle && window.currentMappingKeyData) {
            const keyName = window.currentMappingKeyData.key || 'Key';
            modalTitle.textContent = `${keyName} → ${property.label} (${property.id})`;
        }
    }
    
    // Update Stage 2 summary to show detected data type
    function updateStage2Summary(property) {
        const stage2Summary = document.getElementById('stage-2-summary');
        if (stage2Summary && property && property.datatypeLabel) {
            stage2Summary.textContent = `Stage 2: Value type is ${property.datatypeLabel}`;
        }
    }
    
    // Display data type configuration in Stage 2
    async function displayDataTypeConfiguration(property) {
        const datatypeContainer = document.getElementById('detected-datatype');
        const descriptionContainer = document.getElementById('datatype-description');
        
        if (!datatypeContainer) return;
        
        // Show loading state
        datatypeContainer.innerHTML = '<div class="datatype-loading">Loading data type information...</div>';
        
        try {
            // Fetch complete property data if not already available
            let propertyData = property;
            if (!property.constraints || !property.constraintsFetched) {
                propertyData = await getCompletePropertyData(property.id);
                // Update the stored property with complete data
                window.currentMappingSelectedProperty = propertyData;
            }
            
            // Create the main data type display
            const datatypeDisplay = createElement('div', {
                className: 'datatype-result'
            });
            
            // Main data type information
            const mainInfo = createElement('div', {
                className: 'datatype-main-info'
            });
            mainInfo.innerHTML = `
                <div class="datatype-header">
                    <span class="datatype-name">${propertyData.datatypeLabel}</span>
                    <span class="datatype-code">(${propertyData.datatype})</span>
                </div>
                <div class="datatype-summary">${getDataTypeSummary(propertyData.datatype)}</div>
            `;
            datatypeDisplay.appendChild(mainInfo);
            
            // Constraints section
            const constraintsSection = createConstraintsSection(propertyData.constraints);
            if (constraintsSection) {
                datatypeDisplay.appendChild(constraintsSection);
            }
            
            // Technical details button
            const technicalSection = createElement('div', {
                className: 'technical-details-section'
            });
            
            const rawJsonBtn = createElement('button', {
                className: 'raw-json-btn',
                onClick: () => openRawJsonModal(propertyData)
            }, '{ } View Raw JSON');
            
            technicalSection.appendChild(rawJsonBtn);
            datatypeDisplay.appendChild(technicalSection);
            
            // Replace loading with content
            datatypeContainer.innerHTML = '';
            datatypeContainer.appendChild(datatypeDisplay);
            
            // Update Stage 2 summary with detected data type
            updateStage2Summary(propertyData);
            
            // Hide the redundant description section
            if (descriptionContainer) {
                descriptionContainer.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error displaying data type configuration:', error);
            datatypeContainer.innerHTML = `
                <div class="datatype-error">
                    <span class="error-message">Unable to load data type information</span>
                    <div class="error-details">${error.message}</div>
                </div>
            `;
        }
    }
    
    // Get a clear summary of what the data type means
    function getDataTypeSummary(datatype) {
        const summaries = {
            'wikibase-item': 'Values must be links to other Wikidata items (Q-numbers)',
            'string': 'Values are text strings with no language or translation needed',
            'external-id': 'Values are identifiers from external systems (IDs, codes)',
            'time': 'Values are dates or points in time',
            'quantity': 'Values are numbers with optional units of measurement', 
            'url': 'Values are web addresses (URLs)',
            'commonsMedia': 'Values are filenames of media files on Wikimedia Commons',
            'monolingualtext': 'Values are text in a specific language',
            'globe-coordinate': 'Values are geographical coordinates (latitude/longitude)',
            'wikibase-property': 'Values are links to Wikidata properties (P-numbers)',
            'math': 'Values are mathematical expressions',
            'geo-shape': 'Values are geographic shapes or regions',
            'musical-notation': 'Values are musical notation',
            'tabular-data': 'Values are structured tabular data',
            'wikibase-lexeme': 'Values are links to lexemes',
            'wikibase-form': 'Values are links to word forms',
            'wikibase-sense': 'Values are links to word senses'
        };
        
        return summaries[datatype] || 'Values follow Wikidata specifications for this data type';
    }
    
    // Create compact constraints section
    function createConstraintsSection(constraints) {
        if (!constraints) return null;
        
        const hasConstraints = (constraints.format && constraints.format.length > 0) ||
                              (constraints.valueType && constraints.valueType.length > 0) ||
                              (constraints.other && constraints.other.length > 0);
        
        if (!hasConstraints) {
            return null; // Don't show anything if no constraints
        }
        
        const constraintsSection = createElement('div', {
            className: 'constraints-section'
        });
        
        // Value type restrictions - more user-friendly
        if (constraints.valueType && constraints.valueType.length > 0) {
            const valueTypeSection = createCompactConstraint(
                'Value restrictions',
                'Your values must link to specific types of items',
                formatValueTypeConstraintsCompact(constraints.valueType)
            );
            constraintsSection.appendChild(valueTypeSection);
        }
        
        // Format requirements - simplified
        if (constraints.format && constraints.format.length > 0) {
            const formatSection = createCompactConstraint(
                'Format rules',
                'Your text values must follow a specific format',
                formatFormatConstraintsCompact(constraints.format)
            );
            constraintsSection.appendChild(formatSection);
        }
        
        // Other constraints - only show if important
        if (constraints.other && constraints.other.length > 0) {
            const otherSection = createCompactConstraint(
                'Other requirements',
                'Additional validation rules apply',
                formatOtherConstraintsCompact(constraints.other)
            );
            constraintsSection.appendChild(otherSection);
        }
        
        return constraintsSection;
    }
    
    // Create a compact constraint section
    function createCompactConstraint(title, explanation, details) {
        const container = createElement('details', {
            className: 'constraint-compact'
        });
        
        const summaryEl = createElement('summary', {
            className: 'constraint-compact-summary'
        });
        summaryEl.innerHTML = `<span class="constraint-compact-title">${title}</span>`;
        container.appendChild(summaryEl);
        
        const detailsEl = createElement('div', {
            className: 'constraint-compact-details'
        });
        detailsEl.innerHTML = `
            <div class="constraint-explanation">${explanation}</div>
            ${details}
        `;
        container.appendChild(detailsEl);
        
        return container;
    }
    
    // Format value type constraints - compact and user-friendly
    function formatValueTypeConstraintsCompact(valueTypeConstraints) {
        if (!valueTypeConstraints || valueTypeConstraints.length === 0) {
            return '<p>No restrictions found.</p>';
        }
        
        let html = '<div class="constraint-simple-list">';
        let allTypes = [];
        
        valueTypeConstraints.forEach(constraint => {
            constraint.classes.forEach(classId => {
                const label = constraint.classLabels[classId] || classId;
                allTypes.push(label);
            });
        });
        
        // Show only first few types to keep it compact
        const displayTypes = allTypes.slice(0, 3);
        const hasMore = allTypes.length > 3;
        
        html += '<p><strong>Must be:</strong> ';
        html += displayTypes.join(', ');
        if (hasMore) {
            html += ` <em>and ${allTypes.length - 3} others</em>`;
        }
        html += '</p>';
        
        html += '</div>';
        return html;
    }
    
    // Format format constraints - simplified
    function formatFormatConstraintsCompact(formatConstraints) {
        if (!formatConstraints || formatConstraints.length === 0) {
            return '<p>No format rules found.</p>';
        }
        
        let html = '<div class="constraint-simple-list">';
        
        formatConstraints.forEach((constraint, index) => {
            html += `<p><strong>Rule ${index + 1}:</strong> ${constraint.description}</p>`;
        });
        
        html += '</div>';
        return html;
    }
    
    // Format other constraints - minimal
    function formatOtherConstraintsCompact(otherConstraints) {
        if (!otherConstraints || otherConstraints.length === 0) {
            return '<p>No additional requirements found.</p>';
        }
        
        return `<p>This property has <strong>${otherConstraints.length}</strong> additional validation rule${otherConstraints.length > 1 ? 's' : ''}.</p>`;
    }
    
    // Open modal with raw JSON data
    function openRawJsonModal(propertyData) {
        import('../ui/modal-ui.js').then(({ setupModalUI }) => {
            const modalUI = setupModalUI();
            
            // Create JSON viewer content
            const jsonContent = createElement('div', {
                className: 'raw-json-viewer'
            });
            
            const jsonPre = createElement('pre', {
                className: 'json-display'
            }, JSON.stringify(propertyData, null, 2));
            
            jsonContent.appendChild(jsonPre);
            
            // Add copy button
            const copyBtn = createElement('button', {
                className: 'copy-json-btn',
                onClick: () => {
                    navigator.clipboard.writeText(JSON.stringify(propertyData, null, 2));
                    copyBtn.textContent = '✓ Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy to Clipboard';
                    }, 2000);
                }
            }, 'Copy to Clipboard');
            
            jsonContent.insertBefore(copyBtn, jsonPre);
            
            const buttons = [
                {
                    text: 'Close',
                    type: 'primary',
                    callback: () => modalUI.closeModal()
                }
            ];
            
            modalUI.openModal(
                `Raw JSON Data - ${propertyData.id}`,
                jsonContent,
                buttons
            );
        });
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
            <div class="classification-options" style="line-height: 1.8;">
                <div style="margin-bottom: 8px;">
                    <label style="cursor: pointer;">
                        <input type="radio" name="classification-type" value="P31" checked style="margin-right: 6px; width: auto;">Instance of (P31) - This item is an example of this class
                    </label>
                </div>
                <div>
                    <label style="cursor: pointer;">
                        <input type="radio" name="classification-type" value="P279" style="margin-right: 6px; width: auto;">Subclass of (P279) - This item type is a subtype of this class
                    </label>
                </div>
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

    /**
     * Extracts available fields from a sample value object
     * @param {*} sampleValue - The sample value (object, array, or primitive)
     * @returns {Array} Array of field objects {key, preview}
     */
    function extractAvailableFields(sampleValue) {
        if (!sampleValue || typeof sampleValue !== 'object') {
            return [{ key: '_value', preview: String(sampleValue || 'N/A') }];
        }

        // Handle arrays - get fields from first object
        if (Array.isArray(sampleValue)) {
            if (sampleValue.length === 0) return [{ key: '_value', preview: 'Empty Array' }];
            return extractAvailableFields(sampleValue[0]);
        }

        // Extract fields from object
        const fields = [];
        Object.entries(sampleValue).forEach(([key, value]) => {
            let preview = '';
            if (value === null || value === undefined) {
                preview = 'null';
            } else if (typeof value === 'string') {
                preview = value.length > 30 ? `${value.substring(0, 30)}...` : value;
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                preview = String(value);
            } else {
                preview = '[Object/Array]';
            }
            
            fields.push({ key, preview });
        });

        return fields.length > 0 ? fields : [{ key: '_value', preview: 'No fields available' }];
    }

    /**
     * Gets the value of a specific field from the sample value
     * @param {*} sampleValue - The sample value object
     * @param {string} fieldKey - The field key to extract
     * @returns {string} String representation of the field value
     */
    function getFieldValueFromSample(sampleValue, fieldKey) {
        if (!sampleValue || fieldKey === '_value') {
            return convertSampleValueToString(sampleValue);
        }

        // Handle arrays
        if (Array.isArray(sampleValue)) {
            if (sampleValue.length === 0) return '';
            return getFieldValueFromSample(sampleValue[0], fieldKey);
        }

        // Handle objects
        if (typeof sampleValue === 'object' && sampleValue[fieldKey] !== undefined) {
            return convertSampleValueToString(sampleValue[fieldKey]);
        }

        return '';
    }

    /**
     * Refreshes the transformation preview when field selection changes
     * @param {string} propertyId - The property ID
     * @param {Object} state - Application state
     */
    function refreshTransformationFieldPreview(propertyId, state) {
        const fieldSelector = document.getElementById(`field-selector-${propertyId}`);
        const container = document.getElementById(`transformation-blocks-${propertyId}`);
        
        if (!fieldSelector || !container) return;

        const keyData = window.currentMappingKeyData;
        if (!keyData) return;

        const selectedField = fieldSelector.value;
        const newSampleValue = getFieldValueFromSample(keyData.sampleValue, selectedField);
        
        // Update stored sample value
        container.dataset.sampleValue = newSampleValue;
        
        // Update the preview
        updateTransformationPreview(propertyId, state);
    }

    /**
     * Converts a sample value to a string suitable for transformation preview
     * Uses Omeka S type-aware extraction for meaningful values
     * @param {*} value - The sample value (can be object, array, string, etc.)
     * @returns {string} String representation for transformation
     */
    function convertSampleValueToString(value) {
        if (value === null || value === undefined) {
            return '';
        }

        // If it's already a string, return it
        if (typeof value === 'string') {
            return value;
        }

        // If it's a primitive value, convert to string
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        // Handle arrays
        if (Array.isArray(value)) {
            if (value.length === 0) return '';
            
            // Get first value and convert to string
            const firstValue = value[0];
            return convertSampleValueToString(firstValue);
        }

        // Handle Omeka S objects with type-aware extraction
        if (value && typeof value === 'object') {
            // Type-aware value extraction for Omeka S
            if (value.type && typeof value.type === 'string') {
                switch (true) {
                    // Literal values - use @value
                    case value.type === 'literal':
                    case value.type === 'numeric:timestamp':
                        if ('@value' in value && value['@value'] !== null && value['@value'] !== undefined) {
                            return String(value['@value']);
                        }
                        break;
                    
                    // Value suggest types - use o:label (human-readable label)
                    case value.type.startsWith('valuesuggest:'):
                        if ('o:label' in value && value['o:label'] !== null && value['o:label'] !== undefined) {
                            return String(value['o:label']);
                        }
                        break;
                    
                    // URI types - prefer o:label, fallback to @id
                    case value.type === 'uri':
                        if ('o:label' in value && value['o:label'] !== null && value['o:label'] !== undefined) {
                            return String(value['o:label']);
                        }
                        if ('@id' in value && value['@id'] !== null && value['@id'] !== undefined) {
                            return String(value['@id']);
                        }
                        break;
                }
            }
            
            // Fallback to standard property extraction for non-typed objects
            const valueProps = ['@value', 'o:label', 'value', 'name', 'title', 'label', 'display_title'];
            for (const prop of valueProps) {
                if (prop in value && value[prop] !== null && value[prop] !== undefined) {
                    return convertSampleValueToString(value[prop]);
                }
            }
            
            // Look for @id as last resort for URIs
            if ('@id' in value && value['@id'] !== null && value['@id'] !== undefined) {
                return String(value['@id']);
            }
            
            // If no known property found, look for any string values
            const entries = Object.entries(value);
            for (const [key, val] of entries) {
                if (typeof val === 'string' && val.trim() !== '' && !key.startsWith('property_') && key !== 'type') {
                    return val;
                }
            }
            
            // As a last resort, stringify the object in a readable way
            try {
                return JSON.stringify(value);
            } catch (e) {
                return '[Complex Object]';
            }
        }

        // Fallback for any other types
        return String(value);
    }

    /**
     * Renders the value transformation UI for Stage 3
     * @param {Object} keyData - The mapped key data
     * @param {Object} state - The application state
     * @returns {HTMLElement} The transformation UI container
     */
    function renderValueTransformationUI(keyData, state) {
        const container = createElement('div', {
            className: 'value-transformation-container',
            id: 'value-transformation-section'
        });

        // Property ID for transformation blocks - check both current selection and keyData
        const currentProperty = window.currentMappingSelectedProperty || keyData?.property;
        const propertyId = currentProperty?.id;
        
        if (!propertyId) {
            container.appendChild(createElement('div', {
                className: 'transformation-message'
            }, 'Select a property first to configure value transformations'));
            return container;
        }

        // Header section
        const header = createElement('div', { className: 'transformation-header' });
        header.appendChild(createElement('h4', {}, 'Value Transformation'));
        header.appendChild(createElement('p', { className: 'transformation-description' }, 
            'Apply transformations to modify values before reconciliation. Transformations are applied in order.'));
        container.appendChild(header);

        // Field selector section
        const rawSampleValue = keyData.sampleValue;
        const availableFields = extractAvailableFields(rawSampleValue);
        
        if (availableFields.length > 1) {
            const fieldSelectorSection = createElement('div', { className: 'field-selector-section' });
            
            const selectorLabel = createElement('label', { className: 'field-selector-label' }, 
                'Select field to transform:');
            
            const fieldSelect = createElement('select', {
                className: 'field-selector',
                id: `field-selector-${propertyId}`,
                onChange: (e) => {
                    // Update the sample value when field selection changes
                    refreshTransformationFieldPreview(propertyId, state);
                }
            });
            
            // Find the most logical default field (prefer keys with "@")
            let defaultField = availableFields.find(field => field.key.startsWith('@'));
            if (!defaultField) {
                // Fallback to first field if no @ field found
                defaultField = availableFields[0];
            }
            
            // Populate field options
            availableFields.forEach(field => {
                const option = createElement('option', {
                    value: field.key,
                    selected: field.key === defaultField.key
                }, `${field.key}: ${field.preview}`);
                fieldSelect.appendChild(option);
            });
            
            // Set the default selection explicitly
            fieldSelect.value = defaultField.key;
            
            fieldSelectorSection.appendChild(selectorLabel);
            fieldSelectorSection.appendChild(fieldSelect);
            container.appendChild(fieldSelectorSection);
        }

        // Sample value for preview - convert to string for transformations
        const currentState = state.getState();
        
        // Find the most logical default field (prefer keys with "@")
        let defaultFieldKey = null;
        if (availableFields.length > 0) {
            const defaultField = availableFields.find(field => field.key.startsWith('@'));
            defaultFieldKey = defaultField ? defaultField.key : availableFields[0].key;
        }
        
        const selectedField = availableFields.length > 1 ? 
            (document.getElementById(`field-selector-${propertyId}`)?.value || defaultFieldKey) :
            defaultFieldKey;
        
        const sampleValue = selectedField ? 
            getFieldValueFromSample(rawSampleValue, selectedField) :
            convertSampleValueToString(rawSampleValue) || 'Sample Value';
        
        // Transformation blocks container
        const blocksContainer = createElement('div', {
            className: 'transformation-blocks-container',
            id: `transformation-blocks-${propertyId}`
        });

        // Add transformation button
        const addBlockSection = createElement('div', { className: 'add-block-section' });
        const blockTypeSelect = createElement('select', {
            className: 'block-type-select',
            id: `block-type-select-${propertyId}`
        });

        // Add options for each block type
        Object.entries(BLOCK_METADATA).forEach(([type, metadata]) => {
            const option = createElement('option', {
                value: type,
                disabled: metadata.isPlaceholder
            }, metadata.name);
            blockTypeSelect.appendChild(option);
        });

        const addBlockBtn = createElement('button', {
            className: 'button button--secondary',
            onClick: () => addTransformationBlock(propertyId, blockTypeSelect.value, state)
        }, '+ Add Transformation');

        addBlockSection.appendChild(blockTypeSelect);
        addBlockSection.appendChild(addBlockBtn);

        // Store sample value for refreshes
        blocksContainer.dataset.sampleValue = sampleValue;

        // Initial render of transformation blocks
        renderTransformationBlocks(propertyId, sampleValue, blocksContainer, state);

        container.appendChild(blocksContainer);
        container.appendChild(addBlockSection);

        return container;
    }

    /**
     * Renders the list of transformation blocks for a property
     * @param {string} propertyId - The property ID
     * @param {string} sampleValue - Sample value for preview
     * @param {HTMLElement} container - Container to render into
     * @param {Object} state - Application state
     */
    function renderTransformationBlocks(propertyId, sampleValue, container, state) {
        // Clear existing content
        container.innerHTML = '';

        const blocks = state.getTransformationBlocks(propertyId);
        
        if (blocks.length === 0) {
            container.appendChild(createElement('div', {
                className: 'no-transformations-message'
            }, 'No transformations configured. Add a transformation to modify values before reconciliation.'));
            return;
        }

        // Get transformation preview with all steps
        const preview = getTransformationPreview(sampleValue, blocks);

        // Create transformation flow visualization
        const flowContainer = createElement('div', { className: 'transformation-flow' });
        
        preview.steps.forEach((step, index) => {
            // Value state display
            const valueDisplay = createElement('div', { 
                className: `transformation-value-state ${index === 0 ? 'initial' : index === preview.steps.length - 1 ? 'final' : 'intermediate'}`
            });
            
            valueDisplay.appendChild(createElement('div', { className: 'value-label' },
                index === 0 ? 'Original Value:' : 
                index === preview.steps.length - 1 ? 'Final Value:' : 
                `After Step ${index}:`));
            
            valueDisplay.appendChild(createElement('div', { className: 'value-content' }, 
                step.value || '(empty)'));

            flowContainer.appendChild(valueDisplay);

            // Add transformation block (except after the last step)
            if (index < preview.steps.length - 1) {
                const block = blocks.find(b => b.id === preview.steps[index + 1].blockId);
                if (block) {
                    const blockUI = renderTransformationBlockUI(propertyId, block, state);
                    flowContainer.appendChild(blockUI);
                }
            }
        });

        container.appendChild(flowContainer);
    }

    /**
     * Renders a single transformation block UI
     * @param {string} propertyId - The property ID
     * @param {Object} block - The transformation block
     * @param {Object} state - Application state
     * @returns {HTMLElement} Block UI element
     */
    function renderTransformationBlockUI(propertyId, block, state) {
        const metadata = BLOCK_METADATA[block.type];
        const blockElement = createElement('div', {
            className: `transformation-block transformation-block--${block.type}`,
            dataset: { blockId: block.id }
        });

        // Block header with drag handle and controls
        const blockHeader = createElement('div', { 
            className: 'block-header',
            draggable: 'true'
        });
        
        const dragHandle = createElement('div', { 
            className: 'drag-handle',
            title: 'Drag to reorder'
        }, '⋮⋮');
        
        const blockInfo = createElement('div', { className: 'block-info' });
        blockInfo.appendChild(createElement('span', { className: 'block-icon' }, metadata.icon));
        blockInfo.appendChild(createElement('span', { className: 'block-name' }, metadata.name));

        const blockControls = createElement('div', { className: 'block-controls' });
        const removeBtn = createElement('button', {
            className: 'remove-block-btn',
            title: 'Remove transformation',
            onClick: () => {
                state.removeTransformationBlock(propertyId, block.id);
                refreshTransformationUI(propertyId, state);
            }
        }, '×');
        
        blockControls.appendChild(removeBtn);
        
        blockHeader.appendChild(dragHandle);
        blockHeader.appendChild(blockInfo);
        blockHeader.appendChild(blockControls);

        // Block configuration
        const blockConfig = createElement('div', { className: 'block-config' });
        blockConfig.appendChild(renderBlockConfigUI(propertyId, block, state));

        blockElement.appendChild(blockHeader);
        blockElement.appendChild(blockConfig);

        // Add drag and drop handlers
        addDragHandlers(blockElement, blockHeader, propertyId, state);

        return blockElement;
    }

    /**
     * Renders the configuration UI for a specific block type
     * @param {string} propertyId - The property ID
     * @param {Object} block - The transformation block
     * @param {Object} state - Application state
     * @returns {HTMLElement} Configuration UI
     */
    function renderBlockConfigUI(propertyId, block, state) {
        const configContainer = createElement('div', { className: 'block-config-content' });
        
        switch (block.type) {
            case BLOCK_TYPES.PREFIX:
                return renderPrefixSuffixConfigUI(propertyId, block, state, 'Prefix text:');
            
            case BLOCK_TYPES.SUFFIX:
                return renderPrefixSuffixConfigUI(propertyId, block, state, 'Suffix text:');
                
            case BLOCK_TYPES.FIND_REPLACE:
                return renderFindReplaceConfigUI(propertyId, block, state);
                
            case BLOCK_TYPES.COMPOSE:
                return renderComposeConfigUI(propertyId, block, state);
                
            case BLOCK_TYPES.REGEX:
                return renderRegexConfigUI(propertyId, block, state);
                
            default:
                return createElement('div', {}, 'Unknown block type');
        }
    }

    /**
     * Renders prefix/suffix configuration UI
     */
    function renderPrefixSuffixConfigUI(propertyId, block, state, label) {
        const container = createElement('div', { className: 'config-field' });
        
        const labelElement = createElement('label', {}, label);
        const input = createElement('input', {
            type: 'text',
            value: block.config.text || '',
            placeholder: `Enter ${block.type} text...`,
            onInput: (e) => {
                state.updateTransformationBlock(propertyId, block.id, { text: e.target.value });
                updateTransformationPreview(propertyId, state);
            }
        });
        
        container.appendChild(labelElement);
        container.appendChild(input);
        return container;
    }

    /**
     * Renders find/replace configuration UI
     */
    function renderFindReplaceConfigUI(propertyId, block, state) {
        const container = createElement('div', { className: 'config-fields' });
        
        // Find field
        const findField = createElement('div', { className: 'config-field' });
        findField.appendChild(createElement('label', {}, 'Find:'));
        const findInput = createElement('input', {
            type: 'text',
            value: block.config.find || '',
            placeholder: 'Text to find...',
            onInput: (e) => {
                state.updateTransformationBlock(propertyId, block.id, { find: e.target.value });
                updateTransformationPreview(propertyId, state);
            }
        });
        findField.appendChild(findInput);
        
        // Replace field
        const replaceField = createElement('div', { className: 'config-field' });
        replaceField.appendChild(createElement('label', {}, 'Replace with:'));
        const replaceInput = createElement('input', {
            type: 'text',
            value: block.config.replace || '',
            placeholder: 'Replacement text...',
            onInput: (e) => {
                state.updateTransformationBlock(propertyId, block.id, { replace: e.target.value });
                updateTransformationPreview(propertyId, state);
            }
        });
        replaceField.appendChild(replaceInput);
        
        // Options
        const optionsField = createElement('div', { className: 'config-options' });
        
        const caseSensitiveCheck = createElement('input', {
            type: 'checkbox',
            id: `case-sensitive-${block.id}`,
            checked: block.config.caseSensitive || false,
            onChange: (e) => {
                state.updateTransformationBlock(propertyId, block.id, { caseSensitive: e.target.checked });
                updateTransformationPreview(propertyId, state);
            }
        });
        
        const caseSensitiveLabel = createElement('label', {
            htmlFor: `case-sensitive-${block.id}`
        }, 'Case sensitive');
        
        optionsField.appendChild(caseSensitiveCheck);
        optionsField.appendChild(caseSensitiveLabel);
        
        container.appendChild(findField);
        container.appendChild(replaceField);
        container.appendChild(optionsField);
        
        return container;
    }

    /**
     * Renders compose configuration UI
     */
    function renderComposeConfigUI(propertyId, block, state) {
        const container = createElement('div', { className: 'config-fields' });
        
        // Pattern field
        const patternField = createElement('div', { className: 'config-field' });
        patternField.appendChild(createElement('label', {}, 'Pattern:'));
        
        // Ensure pattern has a value, default to {{value}} if empty
        const currentPattern = (block.config.pattern && block.config.pattern.trim()) || '{{value}}';
        
        // If the pattern was empty, update the block config with the default
        if (!block.config.pattern || !block.config.pattern.trim()) {
            state.updateTransformationBlock(propertyId, block.id, { pattern: '{{value}}' });
        }
        
        // Ensure block has access to full item data for field substitution
        const keyData = window.currentMappingKeyData;
        if (keyData && (!block.config.sourceData || block.config.sourceData === keyData.sampleValue)) {
            const currentState = state.getState();
            if (currentState.fetchedData) {
                const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
                let fullItemData = items.find(item => {
                    if (typeof item === 'object' && item !== null && item[keyData.key] !== undefined) {
                        return true;
                    }
                    return false;
                });
                
                if (!fullItemData && items.length > 0) {
                    fullItemData = items[0];
                }
                
                if (fullItemData) {
                    state.updateTransformationBlock(propertyId, block.id, { sourceData: fullItemData });
                }
            }
        }
        
        const patternTextarea = createElement('textarea', {
            rows: 3,
            placeholder: 'Write your sentence and use {{value}} for current value or {{field:path}} for other fields...',
            className: 'pattern-input',
            onInput: (e) => {
                state.updateTransformationBlock(propertyId, block.id, { pattern: e.target.value });
                updateTransformationPreview(propertyId, state);
            }
        }, currentPattern);
        patternField.appendChild(patternTextarea);
        
        // Help text
        const helpText = createElement('div', { 
            className: 'help-text' 
        }, '💡 Use {{value}} for the current value and {{field:path}} to insert other fields from this item');
        patternField.appendChild(helpText);
        
        // Field search and insertion
        const fieldSearchSection = createElement('div', { className: 'field-search-section' });
        const fieldSearchLabel = createElement('label', {}, 'Insert Field:');
        fieldSearchSection.appendChild(fieldSearchLabel);
        
        const fieldSearchInput = createElement('input', {
            type: 'text',
            placeholder: 'Search fields to insert...',
            className: 'field-search-input',
            onInput: (e) => updateFieldSearchResults(e.target.value, propertyId, block, fieldResultsContainer)
        });
        fieldSearchSection.appendChild(fieldSearchInput);
        
        const fieldResultsContainer = createElement('div', { className: 'field-results' });
        fieldSearchSection.appendChild(fieldResultsContainer);
        
        // Initialize with empty search to show all fields
        setTimeout(() => updateFieldSearchResults('', propertyId, block, fieldResultsContainer), 100);
        
        container.appendChild(patternField);
        container.appendChild(fieldSearchSection);
        return container;
    }

    /**
     * Renders regex configuration UI
     */
    function renderRegexConfigUI(propertyId, block, state) {
        const container = createElement('div', { className: 'config-fields' });
        
        // Pattern field
        const patternField = createElement('div', { className: 'config-field' });
        patternField.appendChild(createElement('label', {}, 'Regex Pattern:'));
        const patternInput = createElement('input', {
            type: 'text',
            value: block.config.pattern || '',
            placeholder: 'Regular expression pattern...',
            className: 'regex-pattern-input',
            onInput: (e) => {
                state.updateTransformationBlock(propertyId, block.id, { pattern: e.target.value });
                updateTransformationPreview(propertyId, state);
            }
        });
        patternField.appendChild(patternInput);
        
        // Replacement field
        const replacementField = createElement('div', { className: 'config-field' });
        replacementField.appendChild(createElement('label', {}, 'Replacement:'));
        const replacementInput = createElement('input', {
            type: 'text',
            value: block.config.replacement || '',
            placeholder: 'Replacement pattern (use $1, $2 for capture groups)...',
            onInput: (e) => {
                state.updateTransformationBlock(propertyId, block.id, { replacement: e.target.value });
                updateTransformationPreview(propertyId, state);
            }
        });
        replacementField.appendChild(replacementInput);
        
        // Common patterns section
        const patternsSection = createElement('div', { className: 'config-field' });
        patternsSection.appendChild(createElement('label', {}, 'Common Patterns:'));
        
        const patternSelect = createElement('select', {
            className: 'pattern-select',
            onChange: (e) => {
                if (e.target.value && COMMON_REGEX_PATTERNS[e.target.value]) {
                    const pattern = COMMON_REGEX_PATTERNS[e.target.value];
                    state.updateTransformationBlock(propertyId, block.id, {
                        pattern: pattern.pattern,
                        replacement: pattern.replacement
                    });
                    updateTransformationPreview(propertyId, state);
                    
                    // Update the input field values to reflect the selected pattern
                    patternInput.value = pattern.pattern;
                    replacementInput.value = pattern.replacement;
                }
            }
        });
        
        // Add empty option
        patternSelect.appendChild(createElement('option', { value: '' }, 'Select a common pattern...'));
        
        // Add common patterns
        Object.entries(COMMON_REGEX_PATTERNS).forEach(([name, pattern]) => {
            const option = createElement('option', { value: name }, `${name} - ${pattern.description}`);
            patternSelect.appendChild(option);
        });
        
        patternsSection.appendChild(patternSelect);
        
        // Flags field
        const flagsField = createElement('div', { className: 'config-field' });
        flagsField.appendChild(createElement('label', {}, 'Flags:'));
        
        const flagsContainer = createElement('div', { className: 'regex-flags' });
        
        const flags = [
            { flag: 'g', label: 'Global (all matches)', checked: (block.config.flags || 'g').includes('g') },
            { flag: 'i', label: 'Case insensitive', checked: (block.config.flags || '').includes('i') },
            { flag: 'm', label: 'Multiline', checked: (block.config.flags || '').includes('m') },
            { flag: 's', label: 'Dot matches newlines', checked: (block.config.flags || '').includes('s') }
        ];
        
        flags.forEach(({ flag, label, checked }) => {
            const flagWrapper = createElement('div', { className: 'flag-option' });
            const checkbox = createElement('input', {
                type: 'checkbox',
                id: `flag-${flag}-${block.id}`,
                checked: checked,
                onChange: (e) => {
                    const currentFlags = block.config.flags || 'g';
                    let newFlags;
                    if (e.target.checked) {
                        newFlags = currentFlags.includes(flag) ? currentFlags : currentFlags + flag;
                    } else {
                        newFlags = currentFlags.replace(flag, '');
                    }
                    state.updateTransformationBlock(propertyId, block.id, { flags: newFlags });
                    updateTransformationPreview(propertyId, state);
                }
            });
            
            const checkboxLabel = createElement('label', {
                htmlFor: `flag-${flag}-${block.id}`
            }, label);
            
            flagWrapper.appendChild(checkbox);
            flagWrapper.appendChild(checkboxLabel);
            flagsContainer.appendChild(flagWrapper);
        });
        
        flagsField.appendChild(flagsContainer);
        
        container.appendChild(patternField);
        container.appendChild(replacementField);
        container.appendChild(patternsSection);
        container.appendChild(flagsField);
        return container;
    }

    /**
     * Updates field search results for Compose transformer
     */
    function updateFieldSearchResults(searchTerm, propertyId, block, resultsContainer) {
        resultsContainer.innerHTML = '';
        
        // Get the original item data for this property
        const keyData = window.currentMappingKeyData;
        if (!keyData || !keyData.sampleValue) {
            resultsContainer.appendChild(createElement('div', { 
                className: 'no-fields-message' 
            }, 'No field data available'));
            return;
        }
        
        // Get the full item data from state to extract all fields
        const state = window.mappingStepState;
        const currentState = state.getState();
        let fullItemData = null;
        
        if (currentState.fetchedData) {
            const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
            
            // Find the item that contains this property value
            // We'll match based on the key and sampleValue
            fullItemData = items.find(item => {
                if (typeof item === 'object' && item !== null && item[keyData.key] !== undefined) {
                    return true;
                }
                return false;
            });
            
            // If we couldn't find a specific item, use the first item as fallback
            if (!fullItemData && items.length > 0) {
                fullItemData = items[0];
            }
        }
        
        if (!fullItemData) {
            resultsContainer.appendChild(createElement('div', { 
                className: 'no-fields-message' 
            }, 'No full item data available'));
            return;
        }
        
        // Extract all fields from the full item data instead of just the property value
        const allFields = extractAllFields(fullItemData);
        const filteredFields = searchFields(allFields, searchTerm);
        
        if (filteredFields.length === 0) {
            resultsContainer.appendChild(createElement('div', { 
                className: 'no-fields-message' 
            }, 'No matching fields found'));
            return;
        }
        
        // Show all results - container will be scrollable
        filteredFields.forEach(field => {
            const fieldItem = createElement('div', {
                className: 'field-result-item',
                onClick: () => {
                    // Insert the field path into the pattern at cursor position
                    const patternTextarea = document.querySelector(`textarea.pattern-input`);
                    if (patternTextarea) {
                        const fieldPlaceholder = `{{field:${field.path}}}`;
                        const start = patternTextarea.selectionStart;
                        const end = patternTextarea.selectionEnd;
                        const currentPattern = patternTextarea.value;
                        const newPattern = currentPattern.substring(0, start) + fieldPlaceholder + currentPattern.substring(end);
                        patternTextarea.value = newPattern;
                        
                        // Update the state and preview
                        const state = window.mappingStepState;
                        state.updateTransformationBlock(propertyId, block.id, { 
                            pattern: newPattern,
                            sourceData: fullItemData 
                        });
                        updateTransformationPreview(propertyId, state);
                        
                        // Focus back to textarea and position cursor
                        patternTextarea.focus();
                        patternTextarea.setSelectionRange(start + fieldPlaceholder.length, start + fieldPlaceholder.length);
                    }
                }
            });
            
            const pathElement = createElement('div', { className: 'field-path' }, field.path);
            const previewElement = createElement('div', { className: 'field-preview' }, field.preview);
            
            fieldItem.appendChild(pathElement);
            fieldItem.appendChild(previewElement);
            resultsContainer.appendChild(fieldItem);
        });
    }
    
    /**
     * Adds a new transformation block
     */
    function addTransformationBlock(propertyId, blockType, state) {
        const newBlock = createTransformationBlock(blockType);
        state.addTransformationBlock(propertyId, newBlock);
        refreshTransformationUI(propertyId, state);
    }

    /**
     * Updates only the transformation preview values without re-rendering the entire UI
     * This prevents input fields from losing focus on every keystroke
     */
    function updateTransformationPreview(propertyId, state) {
        const container = document.getElementById(`transformation-blocks-${propertyId}`);
        if (!container || !container.dataset.sampleValue) return;

        const sampleValue = container.dataset.sampleValue;
        const blocks = state.getTransformationBlocks(propertyId);
        const preview = getTransformationPreview(sampleValue, blocks);

        // Update each value state display
        const valueStates = container.querySelectorAll('.transformation-value-state');
        preview.steps.forEach((step, index) => {
            if (valueStates[index]) {
                const valueContent = valueStates[index].querySelector('.value-content');
                if (valueContent) {
                    valueContent.textContent = step.value || '(empty)';
                }
            }
        });
    }

    /**
     * Refreshes the transformation UI for a property (full re-render)
     * Use sparingly as this will cause input fields to lose focus
     */
    function refreshTransformationUI(propertyId, state) {
        const container = document.getElementById(`transformation-blocks-${propertyId}`);
        if (container && container.dataset.sampleValue) {
            renderTransformationBlocks(propertyId, container.dataset.sampleValue, container, state);
        }
    }

    // Global variable to track the currently dragged element across all blocks
    let currentDraggedElement = null;

    /**
     * Adds drag and drop handlers to a block element
     */
    function addDragHandlers(blockElement, dragHandle, propertyId, state) {
        dragHandle.addEventListener('dragstart', (e) => {
            currentDraggedElement = blockElement;
            blockElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', blockElement.dataset.blockId);
        });

        dragHandle.addEventListener('dragend', () => {
            if (currentDraggedElement) {
                currentDraggedElement.classList.remove('dragging');
                currentDraggedElement = null;
            }
            // Remove drop target indicators from all blocks
            const blocks = Array.from(blockElement.parentElement.querySelectorAll('.transformation-block'));
            blocks.forEach(block => block.classList.remove('drop-target'));
        });

        blockElement.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (currentDraggedElement && currentDraggedElement !== blockElement) {
                blockElement.classList.add('drop-target');
            }
        });

        blockElement.addEventListener('dragleave', (e) => {
            // Only remove drop-target if we're actually leaving this element
            if (!blockElement.contains(e.relatedTarget)) {
                blockElement.classList.remove('drop-target');
            }
        });

        blockElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (currentDraggedElement && currentDraggedElement !== blockElement) {
                e.dataTransfer.dropEffect = 'move';
            }
        });

        blockElement.addEventListener('drop', (e) => {
            e.preventDefault();
            blockElement.classList.remove('drop-target');
            
            if (currentDraggedElement && currentDraggedElement !== blockElement) {
                // Reorder blocks
                const blocks = Array.from(blockElement.parentElement.querySelectorAll('.transformation-block'));
                const draggedIndex = blocks.indexOf(currentDraggedElement);
                const targetIndex = blocks.indexOf(blockElement);
                
                if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
                    const blockIds = blocks.map(el => el.dataset.blockId);
                    const draggedId = blockIds.splice(draggedIndex, 1)[0];
                    blockIds.splice(targetIndex, 0, draggedId);
                    
                    state.reorderTransformationBlocks(propertyId, blockIds);
                    refreshTransformationUI(propertyId, state);
                }
            }
        });
    }

    /**
     * Refreshes the Stage 3 transformation UI when a property is selected
     */
    function refreshStage3TransformationUI() {
        const existingContainer = document.getElementById('value-transformation-section');
        if (!existingContainer) return;

        // Get the stored keyData and state
        const keyData = window.currentMappingKeyData;
        const currentState = window.mappingStepState;
        
        if (!keyData || !currentState) return;

        // Create new transformation UI with the selected property
        const newContainer = renderValueTransformationUI(keyData, currentState);

        // Replace the existing container content
        existingContainer.parentNode.replaceChild(newContainer, existingContainer);
    }
    
    // Export functions globally for use by other modules
    window.openMappingModal = openMappingModal;
    window.openManualPropertyEditModal = openManualPropertyEditModal;
    
}