/**
 * Handles the Wikidata Designer step functionality
 */
import { createElement, createButton, showMessage } from '../ui/components.js';

export function setupDesignerStep(state) {
    console.log('🎨 Designer - setupDesignerStep called');
    
    // Get DOM elements with correct IDs
    const exampleItemSelector = document.getElementById('example-item-selector');
    const referencesList = document.getElementById('references-list');
    const propertiesList = document.getElementById('properties-list');
    const unavailableProperties = document.getElementById('unavailable-properties');
    const unavailableList = document.getElementById('unavailable-list');
    const designerPreview = document.getElementById('designer-preview');
    const issuesList = document.getElementById('issues-list');
    const referenceWarning = document.getElementById('reference-warning');
    
    console.log('Designer - DOM elements found:', {
        exampleItemSelector: !!exampleItemSelector,
        referencesList: !!referencesList,
        propertiesList: !!propertiesList,
        unavailableProperties: !!unavailableProperties,
        designerPreview: !!designerPreview
    });
    
    // Buttons
    const autoDetectReferencesBtn = document.getElementById('auto-detect-references');
    const searchReferenceBtn = document.getElementById('search-reference');
    const addReferenceBtn = document.getElementById('add-reference');
    const proceedToExportBtn = document.getElementById('proceed-to-export');
    const backToReconciliationBtn = document.getElementById('back-to-reconciliation');
    
    // Initialize designer when entering this step
    document.addEventListener('DOMContentLoaded', () => {
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 4) {
                    initializeDesigner();
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-designer')?.addEventListener('click', () => {
            initializeDesigner();
        });
    });
    
    // Listen for step change events
    window.addEventListener('STEP_CHANGED', (event) => {
        console.log('Designer - STEP_CHANGED event received:', event.detail);
        if (event.detail.newStep === 4) {
            console.log('Designer - Initializing designer for step 4');
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                initializeDesigner();
            }, 100);
        }
    });
    
    // Event listeners
    if (exampleItemSelector) {
        exampleItemSelector.addEventListener('change', handleItemSelection);
    }
    
    if (autoDetectReferencesBtn) {
        autoDetectReferencesBtn.addEventListener('click', autoDetectReferences);
    }
    
    if (searchReferenceBtn) {
        searchReferenceBtn.addEventListener('click', searchForReferences);
    }
    
    if (addReferenceBtn) {
        addReferenceBtn.addEventListener('click', addManualReference);
    }
    
    if (backToReconciliationBtn) {
        backToReconciliationBtn.addEventListener('click', () => {
            state.updateState('currentStep', 3);
        });
    }
    
    if (proceedToExportBtn) {
        proceedToExportBtn.addEventListener('click', () => {
            if (validateDesignerData()) {
                state.updateState('currentStep', 5);
            }
        });
    }
    
    // Initialize the designer
    function initializeDesigner() {
        console.log('🎨 Designer - initializeDesigner() called');
        const currentState = state.getState();
        
        // Debug logging to understand the state
        console.log('Designer - Current state:', currentState);
        console.log('Designer - API data type:', typeof currentState.fetchedData);
        console.log('Designer - API data:', currentState.fetchedData);
        console.log('Designer - Reconciliation data:', currentState.reconciliationData);
        console.log('Designer - Reconciliation data keys:', Object.keys(currentState.reconciliationData || {}));
        console.log('Designer - First item reconciliation data:', currentState.reconciliationData?.['item-0']);
        console.log('Designer - Mappings:', currentState.mappings);
        console.log('Designer - Mapped keys:', currentState.mappings?.mappedKeys);
        
        // Test accessing specific reconciled data
        if (currentState.reconciliationData && currentState.reconciliationData['item-0']) {
            const firstItem = currentState.reconciliationData['item-0'];
            console.log('Designer - First item properties:', Object.keys(firstItem.properties));
            console.log('Designer - First item author reconciliation:', firstItem.properties['schema:author']);
        }
        
        // Check if we have completed reconciliation
        const reconciliationData = currentState.reconciliationData;
        if (!reconciliationData || Object.keys(reconciliationData).length === 0) {
            console.error('Designer - No reconciliation data found!');
            showMessage('Please complete the reconciliation step first.', 'warning');
            return;
        }
        
        console.log('Designer - Reconciliation data found, proceeding with initialization');
        
        // Initialize state structures if needed
        if (!state.getState().references) {
            state.updateState('references', []);
        }
        
        if (!state.getState().designerData) {
            state.updateState('designerData', []);
        }
        
        // Populate components
        console.log('Designer - Calling populateItemSelector()');
        populateItemSelector();
        console.log('Designer - Calling displayReferences()');
        displayReferences();
        console.log('Designer - Calling displayProperties()');
        displayProperties();
        console.log('Designer - Calling checkForIssues()');
        checkForIssues();
        console.log('Designer - Calling updatePreview()');
        updatePreview();
        console.log('Designer - Calling updateProceedButton()');
        updateProceedButton();
        
        // Try to auto-detect references on init
        autoDetectReferences(false);
    }
    
    // Populate the item selector dropdown
    function populateItemSelector() {
        const exampleItemSelector = document.getElementById('example-item-selector');
        if (!exampleItemSelector) {
            console.error('Designer - exampleItemSelector not found!');
            return;
        }
        
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData;
        
        // Clear existing options except the first one
        while (exampleItemSelector.options.length > 1) {
            exampleItemSelector.remove(1);
        }
        
        // Add actual items from API data
        if (fetchedData && Array.isArray(fetchedData)) {
            fetchedData.forEach((item, index) => {
                const title = item['o:title'] || item['dcterms:title'] || `Item ${index + 1}`;
                const option = createElement('option', {
                    value: index  // Use index instead of o:id
                }, title);
                exampleItemSelector.appendChild(option);
            });
        }
        
        // Set to multi-item view by default
        exampleItemSelector.value = 'multi-item';
    }
    
    // Handle item selection change
    function handleItemSelection() {
        const exampleItemSelector = document.getElementById('example-item-selector');
        if (!exampleItemSelector) return;
        
        const selectedValue = exampleItemSelector.value;
        
        if (selectedValue === 'multi-item') {
            // Show all properties
            const unavailableProperties = document.getElementById('unavailable-properties');
            if (unavailableProperties) {
                unavailableProperties.style.display = 'none';
            }
            displayProperties();
        } else {
            // Show properties for specific item
            displayPropertiesForItem(selectedValue);
        }
        
        updatePreview();
    }
    
    // Display properties for a specific item
    function displayPropertiesForItem(itemId) {
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData;
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const reconciliationData = currentState.reconciliationData || {};
        
        console.log('Designer - Displaying properties for item:', itemId);
        console.log('Designer - Reconciliation data for this item:', reconciliationData[itemId]);
        
        // Find the selected item by index
        const selectedItem = fetchedData[parseInt(itemId)];
        
        if (!selectedItem) return;
        
        // Get properties that exist for this item
        const itemProperties = [];
        const missingProperties = [];
        
        mappedKeys.forEach(mapping => {
            const key = mapping.key;
            if (selectedItem[key] !== undefined && selectedItem[key] !== null) {
                itemProperties.push(mapping);
            } else {
                missingProperties.push(mapping);
            }
        });
        
        // Display available properties
        displayPropertiesSubset(itemProperties, selectedItem, reconciliationData);
        
        // Display unavailable properties
        if (missingProperties.length > 0) {
            const unavailableProperties = document.getElementById('unavailable-properties');
            const unavailableList = document.getElementById('unavailable-list');
            
            if (unavailableProperties) {
                unavailableProperties.style.display = 'block';
            }
            
            if (unavailableList) {
                unavailableList.innerHTML = '';
            
            missingProperties.forEach(mapping => {
                const propItem = createElement('div', {
                    className: 'unavailable-property',
                    onClick: () => findItemWithProperty(mapping.key)
                }, `${mapping.property.label} (${mapping.property.id})`);
                unavailableList.appendChild(propItem);
            });
            }
        } else {
            const unavailableProperties = document.getElementById('unavailable-properties');
            if (unavailableProperties) {
                unavailableProperties.style.display = 'none';
            }
        }
    }
    
    // Find an item that has a specific property
    function findItemWithProperty(key) {
        const fetchedData = state.getState().fetchedData;
        
        for (let i = 0; i < fetchedData.length; i++) {
            const item = fetchedData[i];
            if (item[key] !== undefined && item[key] !== null) {
                // Select this item in the dropdown
                const exampleItemSelector = document.getElementById('example-item-selector');
                if (exampleItemSelector) {
                    exampleItemSelector.value = i.toString();
                    handleItemSelection();
                }
                break;
            }
        }
    }
    
    // Display references
    function displayReferences() {
        const referencesList = document.getElementById('references-list');
        if (!referencesList) {
            console.error('Designer - referencesList not found!');
            return;
        }
        
        const references = state.getState().references || [];
        
        referencesList.innerHTML = '';
        
        if (references.length === 0) {
            const placeholder = createElement('div', {
                className: 'placeholder'
            }, 'No references added yet. References will be auto-detected from sameAs and ARK identifiers.');
            referencesList.appendChild(placeholder);
            return;
        }
        
        references.forEach((ref, index) => {
            const refItem = createElement('div', {
                className: `reference-item ${ref.autoDetected ? 'auto-detected' : ''}`
            });
            
            const refInfo = createElement('div', {
                className: 'reference-info'
            });
            
            const refUrl = createElement('a', {
                className: 'reference-url',
                href: ref.url,
                target: '_blank'
            }, ref.url);
            
            const refType = createElement('div', {
                className: 'reference-type'
            }, ref.type || 'Manual reference');
            
            refInfo.appendChild(refUrl);
            refInfo.appendChild(refType);
            
            const refToggle = createElement('div', {
                className: 'reference-toggle'
            });
            
            const toggleInput = createElement('input', {
                type: 'checkbox',
                id: `ref-toggle-${index}`,
                checked: ref.enabled !== false
            });
            
            const toggleLabel = createElement('label', {
                htmlFor: `ref-toggle-${index}`
            }, 'Apply to all');
            
            toggleInput.addEventListener('change', (e) => {
                ref.enabled = e.target.checked;
                state.markChangesUnsaved();
                updatePreview();
            });
            
            refToggle.appendChild(toggleInput);
            refToggle.appendChild(toggleLabel);
            
            refItem.appendChild(refInfo);
            refItem.appendChild(refToggle);
            
            referencesList.appendChild(refItem);
        });
    }
    
    // Display properties
    function displayProperties() {
        const currentState = state.getState();
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const reconciliationData = currentState.reconciliationData || {};
        const fetchedData = currentState.fetchedData || [];
        
        // Debug log to check if we have reconciliation data
        console.log('Designer - Reconciliation data available:', Object.keys(reconciliationData).length > 0);
        console.log('Designer - Mapped keys:', mappedKeys.length);
        
        displayPropertiesSubset(mappedKeys, null, reconciliationData);
    }
    
    // Display a subset of properties
    function displayPropertiesSubset(mappedKeys, specificItem, reconciliationData) {
        console.log('Designer - displayPropertiesSubset called with:', {
            mappedKeysLength: mappedKeys?.length,
            specificItem: !!specificItem,
            reconciliationDataKeys: Object.keys(reconciliationData || {})
        });
        
        // Get the properties list element fresh each time
        const propertiesList = document.getElementById('properties-list');
        
        if (!propertiesList) {
            console.error('Designer - propertiesList element not found!');
            return;
        }
        
        propertiesList.innerHTML = '';
        
        if (!mappedKeys || mappedKeys.length === 0) {
            console.warn('Designer - No mapped keys found, showing placeholder');
            const placeholder = createElement('div', {
                className: 'placeholder'
            }, 'Properties will appear here after reconciliation');
            propertiesList.appendChild(placeholder);
            return;
        }
        
        console.log('Designer - Processing', mappedKeys.length, 'mapped keys');
        
        const fetchedData = state.getState().fetchedData || [];
        
        mappedKeys.forEach(mapping => {
            const propertyItem = createElement('div', {
                className: 'property-item'
            });
            
            const propertyIdBadge = createElement('div', {
                className: 'property-id-badge'
            }, mapping.property.id);
            
            const propertyContent = createElement('div', {
                className: 'property-content'
            });
            
            const propertyLabelRow = createElement('div', {
                className: 'property-label-row'
            });
            
            const propertyLabelText = createElement('div', {
                className: 'property-label-text'
            }, mapping.property.label);
            
            propertyLabelRow.appendChild(propertyLabelText);
            
            // Get reconciled value
            let exampleValue = 'No value';
            let reconciledDisplay = '';
            
            if (specificItem) {
                // For specific item view
                const itemIndex = fetchedData.indexOf(specificItem);
                const itemKey = `item-${itemIndex}`;
                console.log(`Designer - Looking for reconciliation data for itemIndex: ${itemIndex}, property: ${mapping.key}`);
                console.log(`Designer - Trying itemKey: ${itemKey}`);
                console.log(`Designer - ReconciliationData has key ${itemKey}:`, itemKey in reconciliationData);
                
                const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                console.log(`Designer - Reconciled data for ${itemKey}/${mapping.key}:`, reconciledData);
                
                if (reconciledData?.selectedMatch) {
                    const match = reconciledData.selectedMatch;
                    if (match.type === 'wikidata') {
                        exampleValue = `${match.label} (${match.id})`;
                        reconciledDisplay = `✓ Reconciled to: ${match.label} (${match.id})`;
                    } else {
                        exampleValue = match.value || 'Custom value';
                        reconciledDisplay = `✓ Custom value: ${match.value || 'Set'}`;
                    }
                } else if (specificItem[mapping.key]) {
                    exampleValue = `Original: ${specificItem[mapping.key]}`;
                    reconciledDisplay = '⚠️ Not reconciled yet';
                }
            } else {
                // For multi-item view, find first reconciled value
                let foundReconciled = false;
                for (let i = 0; i < fetchedData.length; i++) {
                    const item = fetchedData[i];
                    const itemKey = `item-${i}`;  // Use index-based key
                    console.log(`Designer - Multi-item view checking ${itemKey} for property ${mapping.key}`);
                    
                    const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                    console.log(`Designer - Multi-item reconciled data for ${itemKey}/${mapping.key}:`, reconciledData);
                    
                    if (reconciledData?.selectedMatch) {
                        const match = reconciledData.selectedMatch;
                        if (match.type === 'wikidata') {
                            exampleValue = `${match.label} (${match.id})`;
                            reconciledDisplay = `Example: ${match.label} (${match.id})`;
                        } else {
                            exampleValue = match.value || 'Custom value';
                            reconciledDisplay = `Example: ${match.value || 'Custom value'}`;
                        }
                        foundReconciled = true;
                        break;
                    }
                }
                
                // If no reconciled values found, show original
                if (!foundReconciled) {
                    for (let item of fetchedData) {
                        if (item[mapping.key]) {
                            exampleValue = `Original: ${item[mapping.key]}`;
                            reconciledDisplay = '⚠️ No items reconciled yet';
                            break;
                        }
                    }
                }
            }
            
            const isReconciled = reconciledDisplay && reconciledDisplay.includes('✓');
            const propertyExample = createElement('div', {
                className: `property-example ${isReconciled ? 'reconciled' : 'not-reconciled'}`
            }, reconciledDisplay || `Original: ${exampleValue}`);
            
            // Calculate statistics including reconciliation
            let itemsWithProperty = 0;
            let itemsReconciled = 0;
            
            if (specificItem) {
                const itemIndex = fetchedData.indexOf(specificItem);
                const itemKey = `item-${itemIndex}`;
                itemsWithProperty = specificItem[mapping.key] ? 1 : 0;
                const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                itemsReconciled = reconciledData?.selectedMatch ? 1 : 0;
            } else {
                // Count items with property and reconciliation status
                fetchedData.forEach((item, index) => {
                    if (item[mapping.key] !== undefined && item[mapping.key] !== null) {
                        itemsWithProperty++;
                        const itemKey = `item-${index}`;
                        const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                        if (reconciledData?.selectedMatch) {
                            itemsReconciled++;
                        }
                    }
                });
            }
            
            let statsClass = 'property-stats';
            let statsText = '';
            
            if (specificItem) {
                if (itemsReconciled) {
                    statsClass += ' reconciled';
                    statsText = '✓ Reconciled';
                } else if (itemsWithProperty) {
                    statsClass += ' not-reconciled';
                    statsText = '⚠️ Not reconciled';
                } else {
                    statsText = 'No value';
                }
            } else {
                // Multi-item view
                if (itemsReconciled === itemsWithProperty && itemsWithProperty > 0) {
                    statsClass += ' reconciled';
                    statsText = `✓ All ${itemsWithProperty} items reconciled`;
                } else if (itemsReconciled > 0) {
                    statsClass += ' partial';
                    statsText = `${itemsReconciled}/${itemsWithProperty} reconciled`;
                } else if (itemsWithProperty > 0) {
                    statsClass += ' not-reconciled';
                    statsText = `⚠️ 0/${itemsWithProperty} reconciled`;
                } else {
                    statsText = 'No items have this property';
                }
            }
            
            const propertyStats = createElement('div', {
                className: statsClass
            }, statsText);
            
            propertyContent.appendChild(propertyLabelRow);
            propertyContent.appendChild(propertyExample);
            propertyContent.appendChild(propertyStats);
            
            const propertyActions = createElement('div', {
                className: 'property-actions'
            });
            
            const addRefBtn = createButton('+ Reference', {
                className: 'add-reference-btn',
                onClick: () => addReferenceToProperty(mapping.property.id)
            });
            
            const editBtn = createButton('Edit', {
                className: 'edit-property-btn',
                onClick: () => editPropertyValue(mapping)
            });
            
            propertyActions.appendChild(addRefBtn);
            propertyActions.appendChild(editBtn);
            
            propertyItem.appendChild(propertyIdBadge);
            propertyItem.appendChild(propertyContent);
            propertyItem.appendChild(propertyActions);
            
            propertiesList.appendChild(propertyItem);
        });
    }
    
    // Auto-detect references
    function autoDetectReferences(showNotification = true) {
        const fetchedData = state.getState().fetchedData || [];
        const currentReferences = state.getState().references || [];
        const detectedRefs = new Set();
        
        // Search for sameAs and ARK identifiers
        fetchedData.forEach(item => {
            // Check for sameAs
            if (item['schema:sameAs']) {
                const sameAsValues = Array.isArray(item['schema:sameAs']) ? 
                    item['schema:sameAs'] : [item['schema:sameAs']];
                
                sameAsValues.forEach(value => {
                    if (typeof value === 'string' && value.startsWith('http')) {
                        detectedRefs.add({
                            url: value,
                            type: 'sameAs URL',
                            autoDetected: true,
                            enabled: true
                        });
                    }
                });
            }
            
            // Check for ARK identifiers
            Object.values(item).forEach(value => {
                if (typeof value === 'string' && value.includes('ark:/')) {
                    const arkMatch = value.match(/ark:\/[\w\/]+/);
                    if (arkMatch) {
                        detectedRefs.add({
                            url: `https://n2t.net/${arkMatch[0]}`,
                            type: 'Archival Resource Key (ARK)',
                            autoDetected: true,
                            enabled: true
                        });
                    }
                }
            });
        });
        
        // Add detected references that aren't already in the list
        let addedCount = 0;
        detectedRefs.forEach(ref => {
            const exists = currentReferences.some(r => r.url === ref.url);
            if (!exists) {
                currentReferences.push(ref);
                addedCount++;
            }
        });
        
        if (addedCount > 0) {
            state.updateState('references', currentReferences);
            displayReferences();
            updateProceedButton();
            if (showNotification) {
                showMessage(`Found ${addedCount} new reference${addedCount > 1 ? 's' : ''}`, 'success');
            }
        } else if (showNotification) {
            showMessage('No new references found automatically', 'info');
        }
        
        // Show warning if no references found at all
        const referenceWarning = document.getElementById('reference-warning');
        if (referenceWarning) {
            if (currentReferences.length === 0) {
                referenceWarning.style.display = 'block';
            } else {
                referenceWarning.style.display = 'none';
            }
        }
    }
    
    // Search for references in API data
    function searchForReferences() {
        const searchTerm = prompt('Search for IDs or URLs in the API data:', '');
        if (!searchTerm) return;
        
        const fetchedData = state.getState().fetchedData || [];
        const currentReferences = state.getState().references || [];
        const foundRefs = new Set();
        
        // Search through all items and properties
        fetchedData.forEach(item => {
            Object.entries(item).forEach(([key, value]) => {
                // Handle different value types
                const searchValues = [];
                
                if (Array.isArray(value)) {
                    value.forEach(v => {
                        if (typeof v === 'object' && v !== null) {
                            if (v['@id']) searchValues.push(v['@id']);
                            if (v['@value']) searchValues.push(v['@value']);
                            if (v['o:label']) searchValues.push(v['o:label']);
                        } else if (typeof v === 'string') {
                            searchValues.push(v);
                        }
                    });
                } else if (typeof value === 'object' && value !== null) {
                    if (value['@id']) searchValues.push(value['@id']);
                    if (value['@value']) searchValues.push(value['@value']);
                    if (value['o:label']) searchValues.push(value['o:label']);
                } else if (typeof value === 'string') {
                    searchValues.push(value);
                }
                
                // Check if any value contains the search term
                searchValues.forEach(searchValue => {
                    if (searchValue && searchValue.toString().toLowerCase().includes(searchTerm.toLowerCase())) {
                        // Extract URLs from the value
                        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
                        const urls = searchValue.toString().match(urlRegex);
                        
                        if (urls) {
                            urls.forEach(url => {
                                foundRefs.add({
                                    url: url,
                                    type: `Found in ${key}`,
                                    autoDetected: false,
                                    enabled: true,
                                    source: `Item: ${item['o:title'] || 'Untitled'}`
                                });
                            });
                        }
                        
                        // Also check if the whole value is a URL
                        if (searchValue.toString().startsWith('http')) {
                            foundRefs.add({
                                url: searchValue.toString(),
                                type: `Found in ${key}`,
                                autoDetected: false,
                                enabled: true,
                                source: `Item: ${item['o:title'] || 'Untitled'}`
                            });
                        }
                    }
                });
            });
        });
        
        // Add found references that aren't already in the list
        let addedCount = 0;
        foundRefs.forEach(ref => {
            const exists = currentReferences.some(r => r.url === ref.url);
            if (!exists) {
                currentReferences.push(ref);
                addedCount++;
            }
        });
        
        if (addedCount > 0) {
            state.updateState('references', currentReferences);
            displayReferences();
            updateProceedButton();
            showMessage(`Found ${addedCount} new reference${addedCount > 1 ? 's' : ''} containing "${searchTerm}"`, 'success');
        } else {
            showMessage(`No new references found containing "${searchTerm}"`, 'info');
        }
    }
    
    // Add manual reference
    function addManualReference() {
        const url = prompt('Enter reference URL:', 'https://');
        if (!url || url === 'https://') return;
        
        const references = state.getState().references || [];
        
        // Check if already exists
        if (references.some(r => r.url === url)) {
            showMessage('This reference already exists', 'warning');
            return;
        }
        
        references.push({
            url: url,
            type: 'Manual reference',
            autoDetected: false,
            enabled: true
        });
        
        state.updateState('references', references);
        displayReferences();
        updateProceedButton();
        
        const referenceWarning = document.getElementById('reference-warning');
        if (referenceWarning) {
            referenceWarning.style.display = 'none';
        }
        
        showMessage('Reference added successfully', 'success');
    }
    
    // Add reference to specific property
    function addReferenceToProperty(propertyId) {
        showMessage('Property-specific reference management will be implemented in Phase 2', 'info');
    }
    
    // Edit property value
    function editPropertyValue(mapping) {
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData || [];
        const reconciliationData = currentState.reconciliationData || {};
        const exampleItemSelector = document.getElementById('example-item-selector');
        const selectedValue = exampleItemSelector?.value;
        
        // Create modal for editing
        const modal = createElement('div', {
            className: 'modal-overlay active'
        });
        
        const modalContent = createElement('div', {
            className: 'modal property-edit-modal'
        });
        
        const modalHeader = createElement('div', {
            className: 'modal-header'
        });
        
        const modalTitle = createElement('h3', {}, `Edit Property: ${mapping.property.label}`);
        
        const closeBtn = createButton('×', {
            className: 'modal-close',
            onClick: () => modal.remove()
        });
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeBtn);
        
        const modalBody = createElement('div', {
            className: 'modal-body'
        });
        
        // Get all values for this property
        const propertyValues = [];
        
        if (selectedValue === 'multi-item') {
            // Get values from all items
            fetchedData.forEach((item, index) => {
                const itemKey = `item-${index}`;
                const value = item[mapping.key];
                const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                
                if (value !== undefined && value !== null) {
                    propertyValues.push({
                        itemIndex: index,
                        itemKey: itemKey,
                        itemTitle: item['o:title'] || `Item ${index + 1}`,
                        originalValue: value,
                        reconciled: reconciledData
                    });
                }
            });
        } else {
            // Get value from selected item
            const itemIndex = parseInt(selectedValue);
            const item = fetchedData[itemIndex];
            const itemKey = `item-${itemIndex}`;
            const value = item[mapping.key];
            const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
            
            if (value !== undefined && value !== null) {
                propertyValues.push({
                    itemIndex: itemIndex,
                    itemKey: itemKey,
                    itemTitle: item['o:title'] || `Item ${itemIndex + 1}`,
                    originalValue: value,
                    reconciled: reconciledData
                });
            }
        }
        
        // Display property values
        const valuesContainer = createElement('div', {
            className: 'property-values-container'
        });
        
        propertyValues.forEach((pv, index) => {
            const valueItem = createElement('div', {
                className: 'property-value-item'
            });
            
            const itemLabel = createElement('div', {
                className: 'item-label'
            }, pv.itemTitle);
            
            const originalValue = createElement('div', {
                className: 'original-value'
            }, `Original: ${Array.isArray(pv.originalValue) ? pv.originalValue[0]['@value'] || pv.originalValue[0] : pv.originalValue}`);
            
            const currentValue = createElement('div', {
                className: 'current-value'
            });
            
            if (pv.reconciled?.selectedMatch) {
                const match = pv.reconciled.selectedMatch;
                if (match.type === 'wikidata') {
                    currentValue.textContent = `Current: ${match.label} (${match.id})`;
                } else {
                    currentValue.textContent = `Current: ${match.value}`;
                }
                currentValue.classList.add('reconciled');
            } else {
                currentValue.textContent = 'Not reconciled';
                currentValue.classList.add('not-reconciled');
            }
            
            const editBtn = createButton('Edit', {
                className: 'edit-value-btn',
                onClick: () => editSingleValue(pv, mapping)
            });
            
            valueItem.appendChild(itemLabel);
            valueItem.appendChild(originalValue);
            valueItem.appendChild(currentValue);
            valueItem.appendChild(editBtn);
            
            valuesContainer.appendChild(valueItem);
        });
        
        modalBody.appendChild(valuesContainer);
        
        // Add universal update option if multi-item
        if (selectedValue === 'multi-item' && propertyValues.length > 1) {
            const universalSection = createElement('div', {
                className: 'universal-update-section'
            });
            
            const universalTitle = createElement('h4', {}, 'Universal Update');
            const universalDesc = createElement('p', {}, 'Apply the same value to all items with this property');
            
            const universalBtn = createButton('Set Universal Value', {
                className: 'button--primary',
                onClick: () => setUniversalValue(mapping, propertyValues)
            });
            
            universalSection.appendChild(universalTitle);
            universalSection.appendChild(universalDesc);
            universalSection.appendChild(universalBtn);
            
            modalBody.appendChild(universalSection);
        }
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
    }
    
    // Edit single property value
    function editSingleValue(propertyValue, mapping) {
        const newValue = prompt(`Enter new value for ${mapping.property.label}:`, 
            propertyValue.reconciled?.selectedMatch?.label || 
            propertyValue.reconciled?.selectedMatch?.value || 
            (Array.isArray(propertyValue.originalValue) ? propertyValue.originalValue[0]['@value'] || propertyValue.originalValue[0] : propertyValue.originalValue)
        );
        
        if (newValue === null) return;
        
        // Update reconciliation data
        const reconciliationData = state.getState().reconciliationData || {};
        
        if (!reconciliationData[propertyValue.itemKey]) {
            reconciliationData[propertyValue.itemKey] = { 
                originalData: state.getState().fetchedData[propertyValue.itemIndex],
                properties: {} 
            };
        }
        
        if (!reconciliationData[propertyValue.itemKey].properties[mapping.key]) {
            reconciliationData[propertyValue.itemKey].properties[mapping.key] = { 
                originalValues: [propertyValue.originalValue],
                reconciled: [] 
            };
        }
        
        reconciliationData[propertyValue.itemKey].properties[mapping.key].reconciled[0] = {
            status: 'reconciled',
            selectedMatch: {
                type: 'custom',
                value: newValue,
                datatype: 'string'
            },
            confidence: 100
        };
        
        state.updateState('reconciliationData', reconciliationData);
        
        // Refresh displays
        displayProperties();
        updatePreview();
        
        // Close modal
        document.querySelector('.modal-overlay')?.remove();
        
        showMessage(`Updated ${mapping.property.label} for ${propertyValue.itemTitle}`, 'success');
    }
    
    // Set universal value for all items
    function setUniversalValue(mapping, propertyValues) {
        const universalValue = prompt(`Enter universal value for ${mapping.property.label} (will apply to all ${propertyValues.length} items):`);
        
        if (universalValue === null) return;
        
        // Update reconciliation data for all items
        const reconciliationData = state.getState().reconciliationData || {};
        
        propertyValues.forEach(pv => {
            if (!reconciliationData[pv.itemKey]) {
                reconciliationData[pv.itemKey] = { 
                    originalData: state.getState().fetchedData[pv.itemIndex],
                    properties: {} 
                };
            }
            
            if (!reconciliationData[pv.itemKey].properties[mapping.key]) {
                reconciliationData[pv.itemKey].properties[mapping.key] = { 
                    originalValues: [pv.originalValue],
                    reconciled: [] 
                };
            }
            
            reconciliationData[pv.itemKey].properties[mapping.key].reconciled[0] = {
                status: 'reconciled',
                selectedMatch: {
                    type: 'custom',
                    value: universalValue,
                    datatype: 'string'
                },
                confidence: 100
            };
        });
        
        state.updateState('reconciliationData', reconciliationData);
        
        // Update reconciliation progress
        state.updateState('reconciliationProgress.completed', 
            state.getState().reconciliationProgress.completed + propertyValues.length);
        
        // Refresh displays
        displayProperties();
        updatePreview();
        
        // Close modal
        document.querySelector('.modal-overlay')?.remove();
        
        showMessage(`Updated ${mapping.property.label} for ${propertyValues.length} items`, 'success');
    }
    
    // Check for issues
    function checkForIssues() {
        const issuesList = document.getElementById('issues-list');
        if (!issuesList) {
            console.error('Designer - issuesList not found!');
            return;
        }
        
        const issues = [];
        const currentState = state.getState();
        const references = currentState.references || [];
        const fetchedData = currentState.fetchedData || [];
        
        // Check for items without references
        if (references.filter(r => r.enabled).length === 0) {
            issues.push({
                type: 'no-references',
                text: 'No references are enabled. At least one reference is required.',
                icon: '⚠️'
            });
        }
        
        // Check for items without labels
        const itemsWithoutLabels = fetchedData.filter(item => 
            !item['o:title'] && !item['dcterms:title'] && !item['rdfs:label']
        );
        
        if (itemsWithoutLabels.length > 0) {
            issues.push({
                type: 'no-labels',
                text: `${itemsWithoutLabels.length} item${itemsWithoutLabels.length > 1 ? 's' : ''} without labels`,
                icon: '⚠️'
            });
        }
        
        // Update issues display
        issuesList.innerHTML = '';
        
        if (issues.length === 0) {
            const placeholder = createElement('div', {
                className: 'placeholder'
            }, 'No issues detected');
            issuesList.appendChild(placeholder);
        } else {
            issues.forEach(issue => {
                const issueItem = createElement('div', {
                    className: 'issue-item'
                });
                
                const issueIcon = createElement('span', {
                    className: 'issue-icon'
                }, issue.icon);
                
                const issueText = createElement('span', {
                    className: 'issue-text'
                }, issue.text);
                
                issueItem.appendChild(issueIcon);
                issueItem.appendChild(issueText);
                
                if (issue.type === 'no-references') {
                    const fixBtn = createButton('Add Reference', {
                        className: 'issue-action',
                        onClick: addManualReference
                    });
                    issueItem.appendChild(fixBtn);
                }
                
                issuesList.appendChild(issueItem);
            });
        }
    }
    
    // Update preview
    function updatePreview() {
        const designerPreview = document.getElementById('designer-preview');
        if (!designerPreview) {
            console.error('Designer - designerPreview not found!');
            return;
        }
        
        const currentState = state.getState();
        const references = currentState.references || [];
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const reconciliationData = currentState.reconciliationData || {};
        const fetchedData = currentState.fetchedData || [];
        const exampleItemSelector = document.getElementById('example-item-selector');
        const selectedItemValue = exampleItemSelector?.value;
        
        // Generate preview content
        const previewData = {
            item: selectedItemValue === 'multi-item' ? 'Multi-item view' : `Item ${selectedItemValue}`,
            references: references.filter(r => r.enabled).map(r => ({
                P854: r.url,
                P813: new Date().toISOString().split('T')[0]
            })),
            statements: []
        };
        
        // Add reconciled statements to preview
        mappedKeys.forEach(mapping => {
            const statementData = {
                property: mapping.property.id,
                propertyLabel: mapping.property.label,
                values: []
            };
            
            if (selectedItemValue === 'multi-item') {
                // Show all reconciled values across items
                fetchedData.forEach((item, index) => {
                    const itemKey = `item-${index}`;
                    const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                    
                    if (reconciledData?.selectedMatch) {
                        const match = reconciledData.selectedMatch;
                        if (match.type === 'wikidata') {
                            statementData.values.push({
                                type: 'wikidata-item',
                                value: match.id,
                                label: match.label
                            });
                        } else {
                            statementData.values.push({
                                type: match.datatype || 'string',
                                value: match.value
                            });
                        }
                    }
                });
            } else {
                // Show values for specific item
                const selectedItem = fetchedData[parseInt(selectedItemValue)];
                
                if (selectedItem) {
                    const itemKey = `item-${selectedItemValue}`;
                    const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                    
                    if (reconciledData?.selectedMatch) {
                        const match = reconciledData.selectedMatch;
                        if (match.type === 'wikidata') {
                            statementData.values.push({
                                type: 'wikidata-item',
                                value: match.id,
                                label: match.label
                            });
                        } else {
                            statementData.values.push({
                                type: match.datatype || 'string',
                                value: match.value
                            });
                        }
                    }
                }
            }
            
            if (statementData.values.length > 0) {
                previewData.statements.push(statementData);
            }
        });
        
        const previewContent = designerPreview.querySelector('.preview-content');
        if (previewContent) {
            previewContent.textContent = JSON.stringify(previewData, null, 2);
        }
    }
    
    // Validate designer data before proceeding
    function validateDesignerData() {
        const references = state.getState().references || [];
        const enabledReferences = references.filter(r => r.enabled);
        
        if (enabledReferences.length === 0) {
            showMessage('Please add at least one reference before proceeding', 'warning');
            return false;
        }
        
        return true;
    }
    
    // Update proceed button state
    function updateProceedButton() {
        const proceedToExportBtn = document.getElementById('proceed-to-export');
        if (!proceedToExportBtn) {
            console.error('Designer - proceedToExportBtn not found!');
            return;
        }
        
        const references = state.getState().references || [];
        const enabledReferences = references.filter(r => r.enabled);
        
        proceedToExportBtn.disabled = enabledReferences.length === 0;
    }
}