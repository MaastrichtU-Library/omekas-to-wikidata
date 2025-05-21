/**
 * Handles the Wikidata Designer step functionality
 */
export function setupDesignerStep(state) {
    const referenceList = document.getElementById('reference-list');
    const addReferenceBtn = document.getElementById('add-reference');
    const exampleItemSelect = document.getElementById('example-item');
    const propertyList = document.getElementById('property-list');
    const previewContainer = document.getElementById('preview-container');
    const proceedToExportBtn = document.getElementById('proceed-to-export');
    
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
    
    // Add reference button
    if (addReferenceBtn) {
        addReferenceBtn.addEventListener('click', () => {
            addReference();
        });
    }
    
    // Example item selector
    if (exampleItemSelect) {
        exampleItemSelect.addEventListener('change', () => {
            updatePreview();
        });
    }
    
    // Initialize the designer
    function initializeDesigner() {
        // Check if we have completed reconciliation
        if (state.reconciliationProgress?.completed < state.reconciliationProgress?.total) return;
        
        // Populate example items dropdown
        populateExampleItems();
        
        // Display references (or placeholder)
        displayReferences();
        
        // Display properties
        displayProperties();
        
        // Update preview
        updatePreview();
        
        // Disable proceed button until references are added
        if (proceedToExportBtn) {
            proceedToExportBtn.disabled = true;
        }
    }
    
    // Display references
    function displayReferences() {
        if (!referenceList) return;
        
        referenceList.innerHTML = '';
        
        if (!state.references || !state.references.length) {
            const placeholder = document.createElement('p');
            placeholder.className = 'placeholder';
            placeholder.textContent = 'Add at least one reference before continuing';
            referenceList.appendChild(placeholder);
            return;
        }
        
        state.references.forEach((ref, index) => {
            const refItem = document.createElement('div');
            refItem.className = 'reference-item';
            refItem.textContent = `Reference ${index + 1}: ${ref.type} - ${ref.value}`;
            referenceList.appendChild(refItem);
        });
    }
    
    // Add a reference
    function addReference() {
        // For wireframe, just add a dummy reference
        const referenceType = prompt('Enter reference type (e.g., stated in, reference URL):', 'stated in');
        if (!referenceType) return;
        
        const referenceValue = prompt('Enter reference value:', 'Example Reference');
        if (!referenceValue) return;
        
        // Add to state
        if (!state.references) state.references = [];
        state.references.push({
            type: referenceType,
            value: referenceValue
        });
        state.markChangesUnsaved();
        
        // Update UI
        displayReferences();
        
        // Enable proceed button if we have references and properties
        if (proceedToExportBtn) {
            proceedToExportBtn.disabled = !(state.references.length > 0 && state.designerData.length > 0);
        }
    }
    
    // Populate example items dropdown
    function populateExampleItems() {
        if (!exampleItemSelect) return;
        
        // Clear dropdown
        exampleItemSelect.innerHTML = '';
        
        // Add default empty option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an item for preview';
        exampleItemSelect.appendChild(defaultOption);
        
        // Add example item
        const exampleOption = document.createElement('option');
        exampleOption.value = '1';
        exampleOption.textContent = 'Example Item';
        exampleItemSelect.appendChild(exampleOption);
    }
    
    // Display properties
    function displayProperties() {
        if (!propertyList) return;
        
        propertyList.innerHTML = '';
        
        if (!state.mappings || !state.mappings.mappedKeys || !state.mappings.mappedKeys.length) {
            const placeholder = document.createElement('p');
            placeholder.className = 'placeholder';
            placeholder.textContent = 'No properties available. Complete the mapping and reconciliation steps first.';
            propertyList.appendChild(placeholder);
            return;
        }
        
        // Create property items for each mapped key
        state.mappings.mappedKeys.forEach(key => {
            const propertyItem = document.createElement('div');
            propertyItem.className = 'property-item';
            
            const propertyHeader = document.createElement('div');
            propertyHeader.className = 'property-header';
            propertyHeader.textContent = key;
            propertyItem.appendChild(propertyHeader);
            
            const propertyContent = document.createElement('div');
            propertyContent.className = 'property-content';
            propertyContent.textContent = 'Property Value: Placeholder';
            propertyItem.appendChild(propertyContent);
            
            // Add click handler to edit property
            propertyItem.addEventListener('click', () => {
                editProperty(key, propertyItem);
            });
            
            propertyList.appendChild(propertyItem);
        });
        
        // Initialize designer data if empty
        if (!state.designerData || !state.designerData.length) {
            state.designerData = state.mappings.mappedKeys.map(key => ({
                property: key,
                value: 'Placeholder value',
                reference: state.references && state.references.length ? state.references[0] : null
            }));
        }
        
        // Enable proceed button if we have references and properties
        if (proceedToExportBtn) {
            proceedToExportBtn.disabled = !(state.references.length > 0 && state.designerData.length > 0);
        }
    }
    
    // Edit a property
    function editProperty(property, propertyItem) {
        // For wireframe, just show an alert
        alert(`Edit property: ${property}\n\nIn the full implementation, this will open a modal for editing the property value.`);
        
        // Update the property display
        const propertyContent = propertyItem.querySelector('.property-content');
        if (propertyContent) {
            propertyContent.textContent = 'Property Value: Updated Value';
        }
        
        // Update designer data
        const propertyIndex = state.designerData.findIndex(item => item.property === property);
        if (propertyIndex !== -1) {
            state.designerData[propertyIndex].value = 'Updated Value';
        }
        
        // Enable proceed button if we have references and properties
        if (proceedToExportBtn) {
            proceedToExportBtn.disabled = !(state.references.length > 0 && state.designerData.length > 0);
        }
    }
    
    // Update preview
    function updatePreview() {
        if (!previewContainer) return;
        
        previewContainer.innerHTML = '';
        
        if (!state.designerData || !state.designerData.length) {
            const placeholder = document.createElement('p');
            placeholder.className = 'placeholder';
            placeholder.textContent = 'Configure properties to see preview';
            previewContainer.appendChild(placeholder);
            return;
        }
        
        // Create preview content
        const previewTitle = document.createElement('h4');
        previewTitle.textContent = 'Example Item (Q12345)';
        previewContainer.appendChild(previewTitle);
        
        const previewDescription = document.createElement('p');
        previewDescription.textContent = 'Example item description';
        previewContainer.appendChild(previewDescription);
        
        const statementsList = document.createElement('ul');
        statementsList.className = 'statements-list';
        
        state.designerData.forEach(data => {
            const statementItem = document.createElement('li');
            statementItem.className = 'statement-item';
            statementItem.innerHTML = `<strong>${data.property}:</strong> ${data.value}`;
            statementsList.appendChild(statementItem);
        });
        
        previewContainer.appendChild(statementsList);
    }
}