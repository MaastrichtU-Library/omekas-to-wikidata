/**
 * Handles the Wikidata Designer step functionality
 */
import { createElement, createButton, showMessage } from '../ui/components.js';

export function setupDesignerStep(state) {
    // Get DOM elements with correct IDs
    const exampleItemSelector = document.getElementById('example-item-selector');
    const referencesList = document.getElementById('references-list');
    const propertiesList = document.getElementById('properties-list');
    const unavailableProperties = document.getElementById('unavailable-properties');
    const unavailableList = document.getElementById('unavailable-list');
    const designerPreview = document.getElementById('designer-preview');
    const issuesList = document.getElementById('issues-list');
    const referenceWarning = document.getElementById('reference-warning');
    
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
        // Check if we have completed reconciliation
        const reconciliationData = state.getState().reconciliationData;
        if (!reconciliationData || Object.keys(reconciliationData).length === 0) {
            showMessage('Please complete the reconciliation step first.', 'warning');
            return;
        }
        
        // Initialize state structures if needed
        if (!state.getState().references) {
            state.updateState('references', []);
        }
        
        if (!state.getState().designerData) {
            state.updateState('designerData', []);
        }
        
        // Populate components
        populateItemSelector();
        displayReferences();
        displayProperties();
        checkForIssues();
        updatePreview();
        updateProceedButton();
        
        // Try to auto-detect references on init
        autoDetectReferences(false);
    }
    
    // Populate the item selector dropdown
    function populateItemSelector() {
        if (!exampleItemSelector) return;
        
        const currentState = state.getState();
        const apiData = currentState.apiData;
        
        // Clear existing options except the first one
        while (exampleItemSelector.options.length > 1) {
            exampleItemSelector.remove(1);
        }
        
        // Add actual items from API data
        if (apiData && Array.isArray(apiData)) {
            apiData.forEach((item, index) => {
                const title = item['o:title'] || item['dcterms:title'] || `Item ${index + 1}`;
                const option = createElement('option', {
                    value: item['o:id'] || index
                }, title);
                exampleItemSelector.appendChild(option);
            });
        }
        
        // Set to multi-item view by default
        exampleItemSelector.value = 'multi-item';
    }
    
    // Handle item selection change
    function handleItemSelection() {
        const selectedValue = exampleItemSelector.value;
        
        if (selectedValue === 'multi-item') {
            // Show all properties
            unavailableProperties.style.display = 'none';
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
        const apiData = currentState.apiData;
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const reconciliationData = currentState.reconciliationData || {};
        
        // Find the selected item
        const selectedItem = apiData.find(item => 
            (item['o:id'] || apiData.indexOf(item)).toString() === itemId.toString()
        );
        
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
            unavailableProperties.style.display = 'block';
            unavailableList.innerHTML = '';
            
            missingProperties.forEach(mapping => {
                const propItem = createElement('div', {
                    className: 'unavailable-property',
                    onClick: () => findItemWithProperty(mapping.key)
                }, `${mapping.property.label} (${mapping.property.id})`);
                unavailableList.appendChild(propItem);
            });
        } else {
            unavailableProperties.style.display = 'none';
        }
    }
    
    // Find an item that has a specific property
    function findItemWithProperty(key) {
        const apiData = state.getState().apiData;
        
        for (let item of apiData) {
            if (item[key] !== undefined && item[key] !== null) {
                // Select this item in the dropdown
                const itemId = item['o:id'] || apiData.indexOf(item);
                exampleItemSelector.value = itemId.toString();
                handleItemSelection();
                break;
            }
        }
    }
    
    // Display references
    function displayReferences() {
        if (!referencesList) return;
        
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
        const apiData = currentState.apiData || [];
        
        displayPropertiesSubset(mappedKeys, null, reconciliationData);
    }
    
    // Display a subset of properties
    function displayPropertiesSubset(mappedKeys, specificItem, reconciliationData) {
        if (!propertiesList) return;
        
        propertiesList.innerHTML = '';
        
        if (!mappedKeys || mappedKeys.length === 0) {
            const placeholder = createElement('div', {
                className: 'placeholder'
            }, 'Properties will appear here after reconciliation');
            propertiesList.appendChild(placeholder);
            return;
        }
        
        const apiData = state.getState().apiData || [];
        
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
            
            // Get example value
            let exampleValue = 'No value';
            if (specificItem && specificItem[mapping.key]) {
                exampleValue = specificItem[mapping.key];
            } else if (!specificItem) {
                // Find first non-null value across all items
                for (let item of apiData) {
                    if (item[mapping.key]) {
                        exampleValue = item[mapping.key];
                        break;
                    }
                }
            }
            
            const propertyExample = createElement('div', {
                className: 'property-example'
            }, `Example: ${exampleValue}`);
            
            // Calculate statistics
            let itemsWithProperty = 0;
            if (specificItem) {
                itemsWithProperty = specificItem[mapping.key] ? 1 : 0;
            } else {
                itemsWithProperty = apiData.filter(item => 
                    item[mapping.key] !== undefined && item[mapping.key] !== null
                ).length;
            }
            
            const propertyStats = createElement('div', {
                className: 'property-stats'
            }, specificItem ? 
                (itemsWithProperty ? 'Has value' : 'No value') : 
                `${itemsWithProperty}/${apiData.length} items have this property`
            );
            
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
        const apiData = state.getState().apiData || [];
        const currentReferences = state.getState().references || [];
        const detectedRefs = new Set();
        
        // Search for sameAs and ARK identifiers
        apiData.forEach(item => {
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
        if (currentReferences.length === 0) {
            referenceWarning.style.display = 'block';
        } else {
            referenceWarning.style.display = 'none';
        }
    }
    
    // Search for references in API data
    function searchForReferences() {
        const searchTerm = prompt('Search for IDs or URLs in the API data:', '');
        if (!searchTerm) return;
        
        showMessage('Reference search functionality will be implemented in Phase 2', 'info');
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
        referenceWarning.style.display = 'none';
        
        showMessage('Reference added successfully', 'success');
    }
    
    // Add reference to specific property
    function addReferenceToProperty(propertyId) {
        showMessage('Property-specific reference management will be implemented in Phase 2', 'info');
    }
    
    // Edit property value
    function editPropertyValue(mapping) {
        showMessage('Property editing modal will be implemented in Phase 3', 'info');
    }
    
    // Check for issues
    function checkForIssues() {
        if (!issuesList) return;
        
        const issues = [];
        const currentState = state.getState();
        const references = currentState.references || [];
        const apiData = currentState.apiData || [];
        
        // Check for items without references
        if (references.filter(r => r.enabled).length === 0) {
            issues.push({
                type: 'no-references',
                text: 'No references are enabled. At least one reference is required.',
                icon: '⚠️'
            });
        }
        
        // Check for items without labels
        const itemsWithoutLabels = apiData.filter(item => 
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
        if (!designerPreview) return;
        
        const currentState = state.getState();
        const references = currentState.references || [];
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        // Generate preview content
        const previewData = {
            references: references.filter(r => r.enabled).map(r => ({
                P854: r.url,
                P813: new Date().toISOString().split('T')[0]
            })),
            properties: mappedKeys.map(mapping => ({
                property: mapping.property.id,
                label: mapping.property.label,
                example: 'example value'
            }))
        };
        
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
        if (!proceedToExportBtn) return;
        
        const references = state.getState().references || [];
        const enabledReferences = references.filter(r => r.enabled);
        
        proceedToExportBtn.disabled = enabledReferences.length === 0;
    }
}