/**
 * Handles the Wikidata Designer step functionality
 */
import { createElement, createButton, showMessage } from '../ui/components.js';
import { eventSystem } from '../events.js';

export function setupDesignerStep(state) {
    
    // Get DOM elements with correct IDs
    const exampleItemSelector = document.getElementById('example-item-selector');
    const labelsContainer = document.getElementById('labels-container');
    const descriptionsContainer = document.getElementById('descriptions-container');
    const aliasesContainer = document.getElementById('aliases-container');
    const addLabelLanguageBtn = document.getElementById('add-label-language');
    const addDescriptionLanguageBtn = document.getElementById('add-description-language');
    const addAliasLanguageBtn = document.getElementById('add-alias-language');
    const referencesList = document.getElementById('references-list');
    const propertiesList = document.getElementById('properties-list');
    const unavailableProperties = document.getElementById('unavailable-properties');
    const unavailableList = document.getElementById('unavailable-list');
    const issuesList = document.getElementById('issues-list');
    const referenceWarning = document.getElementById('reference-warning');
    
    console.log('Designer DOM elements:', {
        exampleItemSelector: !!exampleItemSelector,
        labelsContainer: !!labelsContainer,
        descriptionsContainer: !!descriptionsContainer,
        aliasesContainer: !!aliasesContainer,
        addLabelLanguageBtn: !!addLabelLanguageBtn,
        addDescriptionLanguageBtn: !!addDescriptionLanguageBtn,
        addAliasLanguageBtn: !!addAliasLanguageBtn,
        referencesList: !!referencesList,
        propertiesList: !!propertiesList,
        unavailableProperties: !!unavailableProperties
    });
    
    // Buttons
    const autoDetectReferencesBtn = document.getElementById('auto-detect-references');
    const searchReferenceBtn = document.getElementById('search-reference');
    const addReferenceBtn = document.getElementById('add-reference');
    const addNewStatementBtn = document.getElementById('add-new-statement');
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
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 4) {
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
    
    if (addLabelLanguageBtn) {
        addLabelLanguageBtn.addEventListener('click', () => showLanguageModal('label'));
    }
    
    if (addDescriptionLanguageBtn) {
        addDescriptionLanguageBtn.addEventListener('click', () => showLanguageModal('description'));
    }
    
    if (addAliasLanguageBtn) {
        addAliasLanguageBtn.addEventListener('click', () => showLanguageModal('alias'));
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
    
    if (addNewStatementBtn) {
        addNewStatementBtn.addEventListener('click', showNewStatementModal);
    }
    
    if (backToReconciliationBtn) {
        backToReconciliationBtn.addEventListener('click', () => {
            state.setCurrentStep(3);
        });
    }
    
    if (proceedToExportBtn) {
        proceedToExportBtn.addEventListener('click', () => {
            proceedToExportBtn.disabled = true; // Disable immediately to prevent double-clicks
            
            if (validateDesignerData()) {
                state.setCurrentStep(5);
            } else {
                // Re-enable the button if validation fails
                proceedToExportBtn.disabled = false;
            }
        });
    }
    
    // Initialize the designer
    function initializeDesigner() {
        const currentState = state.getState();
        
        // Debug logging to understand the state
        
        // Test accessing specific reconciled data
        if (currentState.reconciliationData && currentState.reconciliationData['item-0']) {
            const firstItem = currentState.reconciliationData['item-0'];
        }
        
        // Check if we have completed reconciliation
        const reconciliationData = currentState.reconciliationData;
        if (!reconciliationData || Object.keys(reconciliationData).length === 0) {
            console.error('Designer - No reconciliation data found!');
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
        initializeLanguageMappings();
        displayReferences();
        displayProperties();
        checkForIssues();
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
    
    // Initialize language mappings with default English
    function initializeLanguageMappings() {
        const currentState = state.getState();
        const designerData = currentState.designerData || {};
        
        // Initialize language mappings structure if not exists
        if (!designerData.labelMappings) {
            designerData.labelMappings = {};
        }
        if (!designerData.descriptionMappings) {
            designerData.descriptionMappings = {};
        }
        if (!designerData.aliasMappings) {
            designerData.aliasMappings = {};
        }
        if (!designerData.supportedLanguages) {
            designerData.supportedLanguages = ['mul']; // Default to multilingual
        }
        
        state.updateState('designerData', designerData);
        
        // If no languages configured yet, add default multilingual for labels only
        if (Object.keys(designerData.labelMappings).length === 0) {
            addLanguageMapping('label', 'mul');
        }
        // Descriptions and aliases start empty - user must add them explicitly
        
        // Render existing language mappings
        renderLanguageMappings();
    }
    
    // Get all available property keys from fetched data
    function getAvailablePropertyKeys() {
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData;
        
        if (!fetchedData || !Array.isArray(fetchedData) || fetchedData.length === 0) {
            return [];
        }
        
        // Get all unique keys from the fetched data
        const allKeys = new Set();
        fetchedData.forEach(item => {
            Object.keys(item).forEach(key => {
                // Skip technical keys and add user-friendly ones
                if (!key.startsWith('@') && !key.startsWith('o:') || 
                    key === 'o:title' || key === 'o:id') {
                    allKeys.add(key);
                }
            });
        });
        
        return Array.from(allKeys).sort();
    }
    
    // Show language selection modal
    function showLanguageModal(type) {
        const modal = createElement('div', {
            className: 'modal-overlay active'
        });
        
        const modalContent = createElement('div', {
            className: 'modal language-modal'
        });
        
        const modalHeader = createElement('div', {
            className: 'modal-header'
        });
        
        const modalTitle = createElement('h3', {}, `Add Language for ${type === 'label' ? 'Labels' : type === 'description' ? 'Descriptions' : 'Aliases'}`);
        modalHeader.appendChild(modalTitle);
        
        const closeBtn = createElement('button', {
            className: 'modal-close',
            onClick: () => modal.remove()
        }, '×');
        modalHeader.appendChild(closeBtn);
        
        const modalBody = createElement('div', {
            className: 'modal-body'
        });
        
        // Language selection
        const languageGroup = createElement('div', {
            className: 'form-group'
        });
        
        const languageLabel = createElement('label', {}, 'Language:');
        const languageSelect = createElement('select', {
            className: 'language-select'
        });
        
        // Common languages
        const commonLanguages = [
            { code: 'mul', name: 'Multilingual (default for all languages)' },
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'it', name: 'Italian' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'nl', name: 'Dutch' },
            { code: 'ru', name: 'Russian' },
            { code: 'zh', name: 'Chinese' },
            { code: 'ja', name: 'Japanese' },
            { code: 'ar', name: 'Arabic' }
        ];
        
        // Add placeholder option
        const placeholderOption = createElement('option', { value: '' }, 'Select a language...');
        languageSelect.appendChild(placeholderOption);
        
        // Add common languages
        commonLanguages.forEach(lang => {
            const option = createElement('option', { 
                value: lang.code,
                selected: lang.code === 'mul' // Default to multilingual
            }, `${lang.name} (${lang.code})`);
            languageSelect.appendChild(option);
        });
        
        // Add custom option
        const customOption = createElement('option', { value: 'custom' }, 'Other language (enter code)');
        languageSelect.appendChild(customOption);
        
        languageGroup.appendChild(languageLabel);
        languageGroup.appendChild(languageSelect);
        
        // Custom language input (hidden by default)
        const customGroup = createElement('div', {
            className: 'form-group custom-language-group',
            style: 'display: none;'
        });
        
        const customLabel = createElement('label', {}, 'Language Code (e.g., "sv" for Swedish):');
        const customInput = createElement('input', {
            type: 'text',
            className: 'custom-language-input',
            placeholder: 'Enter 2-letter language code',
            maxLength: 10
        });
        
        customGroup.appendChild(customLabel);
        customGroup.appendChild(customInput);
        
        modalBody.appendChild(languageGroup);
        modalBody.appendChild(customGroup);
        
        // Add help text for multilingual option
        const mulHelpText = createElement('div', {
            className: 'help-text',
            style: 'display: none; margin-top: 8px; padding: 8px; background-color: #e7f3ff; border-radius: 4px; font-size: 0.85em;'
        }, 'The "mul" (multilingual) option creates a default label that applies to all languages. This is useful for proper names, technical terms, or universal concepts that don\'t need translation. Wikidata will automatically use this label when no language-specific label exists.');
        
        modalBody.appendChild(mulHelpText);
        
        // Show/hide custom input and help text based on selection
        languageSelect.addEventListener('change', () => {
            if (languageSelect.value === 'custom') {
                customGroup.style.display = 'block';
                customInput.focus();
                mulHelpText.style.display = 'none';
            } else if (languageSelect.value === 'mul') {
                customGroup.style.display = 'none';
                mulHelpText.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
                mulHelpText.style.display = 'none';
            }
        });
        
        // Show help text by default since "mul" is selected
        mulHelpText.style.display = 'block';
        
        // Modal footer
        const modalFooter = createElement('div', {
            className: 'modal-footer'
        });
        
        const cancelBtn = createElement('button', {
            className: 'button button--secondary',
            onClick: () => modal.remove()
        }, 'Cancel');
        
        const addBtn = createElement('button', {
            className: 'button button--primary',
            onClick: () => {
                const selectedLang = languageSelect.value;
                let languageCode = '';
                
                if (selectedLang === 'custom') {
                    languageCode = customInput.value.trim().toLowerCase();
                    if (!languageCode || languageCode.length < 2) {
                        showMessage('Please enter a valid language code', 'error');
                        return;
                    }
                } else if (selectedLang) {
                    languageCode = selectedLang;
                } else {
                    showMessage('Please select a language', 'error');
                    return;
                }
                
                // Check if language already exists
                const currentState = state.getState();
                const mappings = type === 'label' ? 
                    currentState.designerData?.labelMappings || {} : 
                    currentState.designerData?.descriptionMappings || {};
                
                if (mappings[languageCode]) {
                    showMessage(`Language "${languageCode}" already exists for ${type}s`, 'warning');
                    return;
                }
                
                addLanguageMapping(type, languageCode);
                modal.remove();
            }
        }, 'Add Language');
        
        modalFooter.appendChild(cancelBtn);
        modalFooter.appendChild(addBtn);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Focus language select
        setTimeout(() => languageSelect.focus(), 100);
    }
    
    // Add a language mapping
    function addLanguageMapping(type, languageCode) {
        const currentState = state.getState();
        const designerData = { ...currentState.designerData };
        
        if (!designerData.labelMappings) designerData.labelMappings = {};
        if (!designerData.descriptionMappings) designerData.descriptionMappings = {};
        if (!designerData.aliasMappings) designerData.aliasMappings = {};
        if (!designerData.supportedLanguages) designerData.supportedLanguages = [];
        
        // Add to the appropriate mapping
        if (type === 'label') {
            designerData.labelMappings[languageCode] = null; // Will be set when user selects property
        } else if (type === 'description') {
            designerData.descriptionMappings[languageCode] = null;
        } else if (type === 'alias') {
            designerData.aliasMappings[languageCode] = null;
        }
        
        // Add to supported languages if not already there
        if (!designerData.supportedLanguages.includes(languageCode)) {
            designerData.supportedLanguages.push(languageCode);
        }
        
        state.updateState('designerData', designerData);
        renderLanguageMappings();
        
        showMessage(`Added ${languageCode} language for ${type}s`, 'success');
    }
    
    // Remove a language mapping
    function removeLanguageMapping(type, languageCode) {
        const currentState = state.getState();
        const designerData = { ...currentState.designerData };
        
        if (type === 'label' && designerData.labelMappings) {
            delete designerData.labelMappings[languageCode];
        } else if (type === 'description' && designerData.descriptionMappings) {
            delete designerData.descriptionMappings[languageCode];
        } else if (type === 'alias' && designerData.aliasMappings) {
            delete designerData.aliasMappings[languageCode];
        }
        
        // Remove from supported languages if not used elsewhere
        const isUsedInLabels = designerData.labelMappings && designerData.labelMappings[languageCode];
        const isUsedInDescriptions = designerData.descriptionMappings && designerData.descriptionMappings[languageCode];
        const isUsedInAliases = designerData.aliasMappings && designerData.aliasMappings[languageCode];
        
        if (!isUsedInLabels && !isUsedInDescriptions && !isUsedInAliases && designerData.supportedLanguages) {
            designerData.supportedLanguages = designerData.supportedLanguages.filter(lang => lang !== languageCode);
        }
        
        state.updateState('designerData', designerData);
        renderLanguageMappings();
        
        showMessage(`Removed ${languageCode} language for ${type}s`, 'success');
    }
    
    // Render all language mappings
    function renderLanguageMappings() {
        renderLanguageMappingsForType('label');
        renderLanguageMappingsForType('description');
        renderLanguageMappingsForType('alias');
    }
    
    // Render language mappings for a specific type
    function renderLanguageMappingsForType(type) {
        const container = type === 'label' ? labelsContainer : 
                        type === 'description' ? descriptionsContainer : 
                        aliasesContainer;
        if (!container) return;
        
        const currentState = state.getState();
        const mappings = type === 'label' ? 
            currentState.designerData?.labelMappings || {} : 
            type === 'description' ? 
            currentState.designerData?.descriptionMappings || {} :
            currentState.designerData?.aliasMappings || {};
        
        container.innerHTML = '';
        
        const availableKeys = getAvailablePropertyKeys();
        
        Object.keys(mappings).forEach(languageCode => {
            const languageRow = createElement('div', {
                className: `language-mapping-row ${languageCode === 'en' ? 'default-language' : ''}`
            });
            
            // Language code label
            const languageLabel = createElement('div', {
                className: 'language-code'
            }, languageCode);
            if (languageCode === 'en') {
                languageLabel.appendChild(createElement('span', {
                    className: 'default-indicator'
                }, ' (default)'));
            }
            
            // Property selector
            const propertySelector = createElement('select', {
                className: 'property-selector',
                'data-language': languageCode,
                'data-type': type
            });
            
            // Add placeholder option
            const placeholderOption = createElement('option', { value: '' }, `Select property for ${type}...`);
            propertySelector.appendChild(placeholderOption);
            
            // Add available properties
            availableKeys.forEach(key => {
                const option = createElement('option', { value: key }, key);
                propertySelector.appendChild(option);
            });
            
            // Set current value
            if (mappings[languageCode]) {
                propertySelector.value = mappings[languageCode];
            } else {
                // Auto-select reasonable defaults for new mappings
                const preferredKeys = type === 'label' ? 
                    ['schema:name', 'o:title', 'dcterms:title', 'rdfs:label', 'title'] :
                    ['schema:description', 'dcterms:description', 'description', 'dcterms:abstract', 'abstract', 'summary'];
                
                for (const preferredKey of preferredKeys) {
                    if (availableKeys.includes(preferredKey)) {
                        propertySelector.value = preferredKey;
                        handleLanguageMappingChange(type, languageCode, preferredKey);
                        break;
                    }
                }
            }
            
            // Event listener for property selection
            propertySelector.addEventListener('change', () => {
                handleLanguageMappingChange(type, languageCode, propertySelector.value);
            });
            
            // Preview field
            const previewField = createElement('input', {
                type: 'text',
                className: 'language-preview',
                readonly: true,
                placeholder: `${type} preview will appear here`
            });
            
            // Update preview immediately
            updateLanguagePreview(type, languageCode, propertySelector.value, previewField);
            
            // Remove button (don't allow removing if it's the only language)
            const removeBtn = createElement('button', {
                className: 'button button--danger button--small remove-language-btn',
                onClick: () => removeLanguageMapping(type, languageCode)
            }, '×');
            
            // Disable remove button if it's the only language
            if (Object.keys(mappings).length === 1) {
                removeBtn.disabled = true;
                removeBtn.title = 'Cannot remove the only language';
            }
            
            languageRow.appendChild(languageLabel);
            languageRow.appendChild(propertySelector);
            languageRow.appendChild(previewField);
            languageRow.appendChild(removeBtn);
            
            container.appendChild(languageRow);
        });
    }
    
    // Handle language mapping change
    function handleLanguageMappingChange(type, languageCode, propertyKey) {
        const currentState = state.getState();
        const designerData = { ...currentState.designerData };
        
        if (type === 'label') {
            if (!designerData.labelMappings) designerData.labelMappings = {};
            designerData.labelMappings[languageCode] = propertyKey;
        } else {
            if (!designerData.descriptionMappings) designerData.descriptionMappings = {};
            designerData.descriptionMappings[languageCode] = propertyKey;
        }
        
        state.updateState('designerData', designerData);
        
        // Update preview for this language
        const previewField = document.querySelector(`.language-mapping-row .property-selector[data-language="${languageCode}"][data-type="${type}"]`)
            ?.parentNode?.querySelector('.language-preview');
        
        if (previewField) {
            updateLanguagePreview(type, languageCode, propertyKey, previewField);
        }
    }
    
    // Update language preview
    function updateLanguagePreview(type, languageCode, propertyKey, previewField) {
        if (!propertyKey || !previewField) {
            if (previewField) previewField.value = '';
            return;
        }
        
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData;
        const selectedItemValue = exampleItemSelector?.value;
        
        if (!fetchedData || fetchedData.length === 0) {
            previewField.value = 'No data available';
            return;
        }
        
        if (selectedItemValue === 'multi-item') {
            // For multi-item view, show first available value
            for (const item of fetchedData) {
                if (item[propertyKey] !== undefined && item[propertyKey] !== null) {
                    let displayValue = item[propertyKey];
                    // Handle complex values
                    if (Array.isArray(displayValue)) {
                        displayValue = displayValue[0];
                    }
                    if (typeof displayValue === 'object' && displayValue !== null) {
                        displayValue = displayValue['@value'] || displayValue['o:label'] || JSON.stringify(displayValue);
                    }
                    previewField.value = `Example: ${displayValue}`;
                    return;
                }
            }
            previewField.value = 'No values found';
        } else {
            // For specific item view
            const itemIndex = parseInt(selectedItemValue);
            const selectedItem = fetchedData[itemIndex];
            if (selectedItem && selectedItem[propertyKey] !== undefined && selectedItem[propertyKey] !== null) {
                let displayValue = selectedItem[propertyKey];
                // Handle complex values
                if (Array.isArray(displayValue)) {
                    displayValue = displayValue[0];
                }
                if (typeof displayValue === 'object' && displayValue !== null) {
                    displayValue = displayValue['@value'] || displayValue['o:label'] || JSON.stringify(displayValue);
                }
                previewField.value = displayValue;
            } else {
                previewField.value = 'No value for this item';
            }
        }
    }
    
    // Update all language previews when item selection changes
    function updateAllLanguagePreviews() {
        const currentState = state.getState();
        const designerData = currentState.designerData || {};
        
        // Update label previews
        const labelMappings = designerData.labelMappings || {};
        Object.keys(labelMappings).forEach(languageCode => {
            const propertyKey = labelMappings[languageCode];
            if (propertyKey) {
                const previewField = document.querySelector(`.language-mapping-row .property-selector[data-language="${languageCode}"][data-type="label"]`)
                    ?.parentNode?.querySelector('.language-preview');
                if (previewField) {
                    updateLanguagePreview('label', languageCode, propertyKey, previewField);
                }
            }
        });
        
        // Update description previews
        const descriptionMappings = designerData.descriptionMappings || {};
        Object.keys(descriptionMappings).forEach(languageCode => {
            const propertyKey = descriptionMappings[languageCode];
            if (propertyKey) {
                const previewField = document.querySelector(`.language-mapping-row .property-selector[data-language="${languageCode}"][data-type="description"]`)
                    ?.parentNode?.querySelector('.language-preview');
                if (previewField) {
                    updateLanguagePreview('description', languageCode, propertyKey, previewField);
                }
            }
        });
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
        
        // Update all language previews for the new selection
        updateAllLanguagePreviews();
    }
    
    // Display properties for a specific item
    function displayPropertiesForItem(itemId) {
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData;
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const reconciliationData = currentState.reconciliationData || {};
        
        
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
    
    // Helper function to create a standardized reference object
    // This ensures consistency across all reference operations
    function createReferenceObject(ref) {
        return {
            url: ref.url,
            retrievedDate: ref.retrievedDate || new Date().toISOString().split('T')[0],
            addedAt: ref.addedAt || new Date().toISOString(),
            autoDetected: ref.autoDetected,
            type: ref.type
        };
    }
    
    // Check if a reference is applied to all properties that should have it
    // This function checks if a reference is consistently applied across all properties and items
    function checkIfReferenceIsApplied(ref) {
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData || {};
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        // If no reconciliation data exists, return false
        if (Object.keys(reconciliationData).length === 0) {
            return false;
        }
        
        // Get all property keys that should have references
        const allPropertyKeys = new Set();
        
        // Add mapped keys
        mappedKeys.forEach(mapping => {
            allPropertyKeys.add(mapping.key);
        });
        
        // Add any custom properties that exist in reconciliation data
        Object.keys(reconciliationData).forEach(itemKey => {
            const itemData = reconciliationData[itemKey];
            if (itemData.properties) {
                Object.keys(itemData.properties).forEach(propertyKey => {
                    allPropertyKeys.add(propertyKey);
                });
            }
        });
        
        // If no properties exist, return false
        if (allPropertyKeys.size === 0) {
            return false;
        }
        
        // Check if the reference is applied to ALL properties across ALL items
        let totalPropertiesWithData = 0;
        let propertiesWithThisReference = 0;
        
        for (const itemKey of Object.keys(reconciliationData)) {
            const itemData = reconciliationData[itemKey];
            if (itemData.properties) {
                for (const propertyKey of allPropertyKeys) {
                    const propData = itemData.properties[propertyKey];
                    // Only count properties that have reconciled data or are used
                    if (propData && (propData.reconciled?.length > 0 || propData.references?.length > 0)) {
                        totalPropertiesWithData++;
                        if (propData.references && propData.references.some(r => r.url === ref.url)) {
                            propertiesWithThisReference++;
                        }
                    }
                }
            }
        }
        
        // Return true if this reference is applied to all properties that have data
        // This ensures the toggle reflects whether the reference is applied "to all"
        return totalPropertiesWithData > 0 && propertiesWithThisReference === totalPropertiesWithData;
    }
    
    // Display references
    function displayReferences() {
        const referencesList = document.getElementById('references-list');
        if (!referencesList) {
            console.error('Designer - referencesList not found!');
            return;
        }
        
        const currentState = state.getState();
        const globalReferences = currentState.globalReferences || [];
        const reconciliationData = currentState.reconciliationData || {};
        const fetchedData = currentState.fetchedData || [];
        
        referencesList.innerHTML = '';
        
        // Collect item-specific references (sameAs URLs)
        const itemSpecificRefs = new Map(); // Map of URL -> Set of item indices
        let totalItemsWithSameAs = 0;
        
        fetchedData.forEach((item, index) => {
            if (item['schema:sameAs']) {
                const sameAsValues = Array.isArray(item['schema:sameAs']) ? 
                    item['schema:sameAs'] : [item['schema:sameAs']];
                
                let itemHasSameAs = false;
                sameAsValues.forEach(value => {
                    let url = null;
                    let type = 'sameAs URL';
                    
                    if (typeof value === 'string' && value.startsWith('http')) {
                        url = value;
                    } else if (typeof value === 'object' && value !== null && value['@id']) {
                        const idValue = value['@id'];
                        if (typeof idValue === 'string' && idValue.startsWith('http')) {
                            url = idValue;
                            type = value['o:label'] ? `sameAs (${value['o:label']})` : 'sameAs URL';
                        }
                    }
                    
                    if (url) {
                        itemHasSameAs = true;
                        if (!itemSpecificRefs.has(url)) {
                            itemSpecificRefs.set(url, new Set());
                        }
                        itemSpecificRefs.get(url).add(index);
                    }
                });
                
                if (itemHasSameAs) {
                    totalItemsWithSameAs++;
                }
            }
        });
        
        // Create sections for different reference types
        const hasBothTypes = globalReferences.length > 0 && itemSpecificRefs.size > 0;
        
        // Display item-specific references section if any exist
        if (itemSpecificRefs.size > 0) {
            const itemSpecificSection = createElement('div', {
                className: 'reference-section item-specific-section'
            });
            
            const sectionHeader = createElement('h4', {
                className: 'reference-section-header'
            }, 'Item-Specific References (Auto-detected)');
            
            const sectionDescription = createElement('p', {
                className: 'reference-section-description'
            }, `Found sameAs statements in ${totalItemsWithSameAs} out of ${fetchedData.length} items. Each item's sameAs URL is applied as a reference to that specific item's properties.`);
            
            itemSpecificSection.appendChild(sectionHeader);
            itemSpecificSection.appendChild(sectionDescription);
            
            // Show aggregated view for item-specific references
            const aggregatedRef = createElement('div', {
                className: 'reference-item item-specific-aggregate'
            });
            
            const refInfo = createElement('div', {
                className: 'reference-info'
            });
            
            const refLabel = createElement('div', {
                className: 'reference-label'
            }, 'sameAs URLs (Item-specific)');
            
            const refDetails = createElement('div', {
                className: 'reference-details'
            }, `${itemSpecificRefs.size} unique URL${itemSpecificRefs.size > 1 ? 's' : ''} across ${totalItemsWithSameAs} item${totalItemsWithSameAs > 1 ? 's' : ''}`);
            
            refInfo.appendChild(refLabel);
            refInfo.appendChild(refDetails);
            
            // Collapsible toggle for sample URLs
            const samplesToggle = createElement('div', {
                className: 'reference-samples-toggle collapsible',
                onclick: (e) => {
                    e.stopPropagation();
                    const toggle = e.target;
                    const samplesContainer = toggle.nextElementSibling;
                    
                    toggle.classList.toggle('expanded');
                    samplesContainer.style.display = toggle.classList.contains('expanded') ? 'flex' : 'none';
                }
            }, `Show ${itemSpecificRefs.size} URL${itemSpecificRefs.size > 1 ? 's' : ''}`);
            
            // Sample URLs (initially hidden)
            const sampleUrls = createElement('div', {
                className: 'reference-samples',
                style: 'display: none;'
            });
            
            let sampleCount = 0;
            for (const [url, itemIndices] of itemSpecificRefs) {
                if (sampleCount >= 2) break;
                const sampleUrl = createElement('a', {
                    className: 'reference-sample-url',
                    href: url,
                    target: '_blank',
                    title: `Used by ${itemIndices.size} item${itemIndices.size > 1 ? 's' : ''}`
                }, url);
                sampleUrls.appendChild(sampleUrl);
                sampleCount++;
            }
            
            if (itemSpecificRefs.size > 2) {
                const moreIndicator = createElement('div', {
                    className: 'reference-more'
                }, `... and ${itemSpecificRefs.size - 2} more`);
                sampleUrls.appendChild(moreIndicator);
            }
            
            aggregatedRef.appendChild(refInfo);
            aggregatedRef.appendChild(samplesToggle);
            aggregatedRef.appendChild(sampleUrls);
            
            // Status indicator
            const statusDiv = createElement('div', {
                className: 'reference-status'
            });
            
            const statusInfo = createElement('div', {
                className: 'status-info'
            });
            
            const statusIcon = createElement('span', {
                className: 'status-icon status-applied'
            }, '✓');
            
            const statusText = createElement('span', {
                className: 'status-text'
            }, 'Applied to respective items');
            
            statusInfo.appendChild(statusIcon);
            statusInfo.appendChild(statusText);
            statusDiv.appendChild(statusInfo);
            
            // Add View Details button
            const viewDetailsBtn = createButton('View Details', {
                className: 'btn btn-secondary btn-small',
                onclick: () => showSameAsSummaryModal()
            });
            statusDiv.appendChild(viewDetailsBtn);
            
            aggregatedRef.appendChild(statusDiv);
            
            itemSpecificSection.appendChild(aggregatedRef);
            referencesList.appendChild(itemSpecificSection);
        }
        
        // Display global references section
        if (globalReferences.length > 0) {
            const globalSection = createElement('div', {
                className: 'reference-section global-section'
            });
            
            if (hasBothTypes) {
                const sectionHeader = createElement('h4', {
                    className: 'reference-section-header'
                }, 'Global References');
                
                const sectionDescription = createElement('p', {
                    className: 'reference-section-description'
                }, 'These references are applied to all properties of all items.');
                
                globalSection.appendChild(sectionHeader);
                globalSection.appendChild(sectionDescription);
            }
            
            globalReferences.forEach((ref, index) => {
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
                
                // Single toggle button
                const refActions = createElement('div', {
                    className: 'reference-actions'
                });
                
                const isApplied = ref.enabled !== false;
                const toggleBtn = createButton(isApplied ? '✓ Applied' : 'Apply', {
                    className: `reference-toggle-btn ${isApplied ? 'active' : ''}`,
                    onClick: () => {
                        ref.enabled = !ref.enabled;
                        
                        if (ref.enabled) {
                            applyReferenceToAllProperties(ref);
                            toggleBtn.textContent = '✓ Applied';
                            toggleBtn.classList.add('active');
                        } else {
                            removeReferenceFromAllProperties(ref);
                            toggleBtn.textContent = 'Apply';
                            toggleBtn.classList.remove('active');
                        }
                        
                        state.markChangesUnsaved();
                    }
                });
                
                refActions.appendChild(toggleBtn);
                
                refItem.appendChild(refInfo);
                refItem.appendChild(refActions);
                
                globalSection.appendChild(refItem);
            });
            
            referencesList.appendChild(globalSection);
        }
        
        // Show placeholder if no references
        if (globalReferences.length === 0 && itemSpecificRefs.size === 0) {
            const placeholder = createElement('div', {
                className: 'placeholder'
            }, 'No references added yet. Click "Auto-detect References" to find sameAs and ARK identifiers.');
            referencesList.appendChild(placeholder);
        }
    }
    
    // Display properties
    function displayProperties() {
        const currentState = state.getState();
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const reconciliationData = currentState.reconciliationData || {};
        const fetchedData = currentState.fetchedData || [];
        
        // Enhanced debug logging
        
        // Check if mappedKeys have the expected structure
        if (mappedKeys.length > 0) {
        }
        
        displayPropertiesSubset(mappedKeys, null, reconciliationData);
    }
    
    // Display a subset of properties
    function displayPropertiesSubset(mappedKeys, specificItem, reconciliationData) {
        
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
        
        
        // Debug: Check structure of each mapping
        mappedKeys.forEach((mapping, index) => {
        });
        
        const fetchedData = state.getState().fetchedData || [];
        
        mappedKeys.forEach(mapping => {
            // Check if mapping has required property structure
            if (!mapping.property || !mapping.property.id) {
                console.error('=== DEBUG: Invalid mapping structure ===');
                console.error('Mapping missing property.id:', mapping);
                return; // Skip this mapping
            }
            
            const propertyItem = createElement('div', {
                className: 'wikidata-statement'
            });
            
            // Property label section - compact layout with label and P number on same line
            const propertyLabelSection = createElement('div', {
                className: 'statement-property'
            });
            
            const propertyHeaderRow = createElement('div', {
                className: 'property-header-row'
            });
            
            const propertyLabel = createElement('span', {
                className: 'property-label'
            }, mapping.property.label);
            
            const propertyIdLink = createElement('a', {
                href: `https://www.wikidata.org/entity/${mapping.property.id}`,
                target: '_blank',
                className: 'property-id-link'
            }, mapping.property.id);
            
            propertyHeaderRow.appendChild(propertyLabel);
            propertyHeaderRow.appendChild(createElement('span', {}, ' ('));
            propertyHeaderRow.appendChild(propertyIdLink);
            propertyHeaderRow.appendChild(createElement('span', {}, ')'));
            propertyLabelSection.appendChild(propertyHeaderRow);
            
            // Property value column (right side)
            const propertyValueSection = createElement('div', {
                className: 'statement-value'
            });
            
            // Get reconciled value
            let exampleValue = 'No value';
            let reconciledDisplay = '';
            
            if (specificItem) {
                // For specific item view
                const itemIndex = fetchedData.indexOf(specificItem);
                const itemKey = `item-${itemIndex}`;
                
                const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                
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
                    
                    const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                    
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
            
            // Calculate statistics for value count
            let itemsWithProperty = 0;
            
            if (specificItem) {
                // Check if it's a custom property or has reconciliation data
                const itemIndex = fetchedData.indexOf(specificItem);
                const itemKey = `item-${itemIndex}`;
                const hasReconciliationData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                const hasOriginalData = specificItem[mapping.key] !== undefined && specificItem[mapping.key] !== null;
                
                itemsWithProperty = (hasReconciliationData || hasOriginalData) ? 1 : 0;
            } else {
                // Count items with property (check both original data and reconciliation data)
                fetchedData.forEach((item, index) => {
                    const itemKey = `item-${index}`;
                    const hasReconciliationData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                    const hasOriginalData = item[mapping.key] !== undefined && item[mapping.key] !== null;
                    
                    if (hasReconciliationData || hasOriginalData) {
                        itemsWithProperty++;
                    }
                });
            }
            
            // Create the compact value display with label, QID, 'example', and count
            const statementMainValue = createElement('div', {
                className: 'statement-main-value'
            });
            
            // Extract label and QID from reconciled data for compact display
            let displayLabel = 'No value';
            let displayQID = null;
            
            if (specificItem) {
                const itemIndex = fetchedData.indexOf(specificItem);
                const itemKey = `item-${itemIndex}`;
                const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                
                if (reconciledData?.selectedMatch) {
                    const match = reconciledData.selectedMatch;
                    if (match.type === 'wikidata') {
                        displayLabel = match.label;
                        displayQID = match.id;
                    } else {
                        displayLabel = match.value || 'Custom value';
                    }
                } else if (specificItem[mapping.key]) {
                    displayLabel = specificItem[mapping.key];
                }
            } else {
                // For multi-item view, show the mapping/key name instead of specific values
                displayLabel = mapping.key;
                displayQID = null;
            }
            
            // Build the compact value display: label (QID if exists) example [count]
            const valueRow = createElement('div', {
                className: 'value-display-row'
            });
            
            // Label (and QID if available)
            if (displayQID) {
                const labelLink = createElement('a', {
                    href: `https://www.wikidata.org/entity/${displayQID}`,
                    target: '_blank',
                    className: 'value-qid-link'
                }, displayLabel);
                valueRow.appendChild(labelLink);
                
                const qidBadge = createElement('a', {
                    href: `https://www.wikidata.org/entity/${displayQID}`,
                    target: '_blank',
                    className: 'value-qid-badge'
                }, ` (${displayQID})`);
                valueRow.appendChild(qidBadge);
            } else {
                const labelSpan = createElement('span', {
                    className: 'value-label'
                }, displayLabel);
                valueRow.appendChild(labelSpan);
            }
            
            // Check if this is a generic reference or has item-specific values
            const hasItemSpecificValues = checkIfHasItemSpecificValues(mapping, fetchedData, reconciliationData);
            
            if (!specificItem) {
                // In multi-item view, always show fold/unfold button for items with values
                if (itemsWithProperty > 0 && hasItemSpecificValues) {
                    const foldButton = createElement('button', {
                        className: 'fold-button',
                        'data-folded': 'true',
                        onClick: (e) => {
                            e.preventDefault();
                            const button = e.target;
                            const isFolded = button.getAttribute('data-folded') === 'true';
                            if (isFolded) {
                                button.setAttribute('data-folded', 'false');
                                button.textContent = '▼';
                                // Show expanded values
                                showExpandedValues(mapping, fetchedData, reconciliationData, propertyValueSection);
                            } else {
                                button.setAttribute('data-folded', 'true');
                                button.textContent = '▶';
                                // Hide expanded values
                                hideExpandedValues(propertyValueSection);
                            }
                        }
                    }, '▶');
                    valueRow.appendChild(foldButton);
                }
                
                // Value count (clickable to show modal)
                const valueCountLink = createElement('a', {
                    href: '#',
                    className: 'value-count-link',
                    onClick: (e) => {
                        e.preventDefault();
                        showValuesModal(mapping, fetchedData, reconciliationData, specificItem);
                    }
                }, ` [${itemsWithProperty > 0 ? `${itemsWithProperty} value${itemsWithProperty === 1 ? '' : 's'}` : '0 values'}]`);
                valueRow.appendChild(valueCountLink);
            } else {
                // Specific item view: show only the specific value, no additional text or count
                // The specific value is already displayed in the valueRow from the displayLabel/displayQID logic above
            }
            
            statementMainValue.appendChild(valueRow);
            propertyValueSection.appendChild(statementMainValue);
            
            // Create actions section - aligned to the right
            const statementActions = createElement('div', {
                className: 'statement-actions'
            });
            
            const addRefBtn = createButton('+ Reference', {
                className: 'wikidata-btn wikidata-btn--reference',
                onClick: () => addReferenceToProperty(mapping.property.id)
            });
            
            statementActions.appendChild(addRefBtn);
            
            // Add actions to value section
            propertyValueSection.appendChild(statementActions);
            
            // Display property-specific references if any
            const propertyReferences = getPropertyReferences(mapping.property.id, reconciliationData, specificItem, mapping.key);
            if (propertyReferences.length > 0) {
                const referencesSection = createElement('div', {
                    className: 'statement-references'
                });
                
                const referencesTitle = createElement('div', {
                    className: 'references-title'
                }, `References (${propertyReferences.length}):`);
                referencesSection.appendChild(referencesTitle);
                
                propertyReferences.forEach((ref, index) => {
                    const refItem = createElement('div', {
                        className: 'reference-item-small'
                    });
                    
                    const refContent = createElement('div', {
                        className: 'reference-content'
                    });
                    
                    const refLink = createElement('a', {
                        href: ref.url,
                        target: '_blank',
                        className: 'reference-link'
                    }, ref.url.length > 50 ? ref.url.substring(0, 50) + '...' : ref.url);
                    
                    refContent.appendChild(refLink);
                    
                    if (ref.retrievedDate) {
                        const dateSpan = createElement('span', {
                            className: 'reference-date'
                        }, ` (retrieved ${ref.retrievedDate})`);
                        refContent.appendChild(dateSpan);
                    }
                    
                    refItem.appendChild(refContent);
                    
                    // Add remove button
                    const removeBtn = createButton('×', {
                        className: 'reference-remove-btn',
                        title: 'Remove reference',
                        onClick: () => removePropertyReference(mapping.property.id, mapping.key, ref, specificItem)
                    });
                    
                    refItem.appendChild(removeBtn);
                    referencesSection.appendChild(refItem);
                });
                
                // Add references section to the property value section instead of property item
                propertyValueSection.appendChild(referencesSection);
            }
            
            // Assemble the complete statement
            propertyItem.appendChild(propertyLabelSection);
            propertyItem.appendChild(propertyValueSection);
            
            propertiesList.appendChild(propertyItem);
        });
    }
    
    // Get references for a specific property
    function getPropertyReferences(propertyId, reconciliationData, specificItem, mappingKey) {
        const references = [];
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData || [];
        
        if (specificItem) {
            // Get references for specific item
            const itemIndex = fetchedData.indexOf(specificItem);
            const itemKey = `item-${itemIndex}`;
            
            // Check all possible locations for references
            // 1. Direct property references using mapping key
            const propDataByKey = reconciliationData[itemKey]?.properties[mappingKey];
            if (propDataByKey && propDataByKey.references) {
                references.push(...propDataByKey.references);
            }
            
            // 2. Property references using property ID
            const propDataById = reconciliationData[itemKey]?.properties[propertyId];
            if (propDataById && propDataById.references) {
                references.push(...propDataById.references);
            }
        } else {
            // Get references from all items that have this property
            const uniqueRefs = new Map();
            
            Object.keys(reconciliationData).forEach(itemKey => {
                // Check both mapping key and property ID
                const propDataByKey = reconciliationData[itemKey]?.properties[mappingKey];
                const propDataById = reconciliationData[itemKey]?.properties[propertyId];
                
                const collectRefs = (propData) => {
                    if (propData && propData.references) {
                        propData.references.forEach(ref => {
                            uniqueRefs.set(ref.url, ref);
                        });
                    }
                };
                
                collectRefs(propDataByKey);
                collectRefs(propDataById);
            });
            
            references.push(...Array.from(uniqueRefs.values()));
        }
        
        return references;
    }
    
    // Show values modal when value count is clicked
    async function showValuesModal(mapping, fetchedData, reconciliationData, specificItem) {
        const { createModal } = await import('../ui/components.js');
        
        const modal = createModal({
            title: `All values for ${mapping.property.label} (${mapping.property.id})`,
            content: '',
            onClose: () => modal.remove()
        });
        
        const modalContent = modal.querySelector('.modal-content');
        modalContent.innerHTML = '';
        
        // Create values list
        const valuesList = createElement('div', {
            className: 'values-modal-list'
        });
        
        if (specificItem) {
            // For specific item, show only that item's value
            const itemIndex = fetchedData.indexOf(specificItem);
            const itemKey = `item-${itemIndex}`;
            const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
            
            const valueItem = createElement('div', {
                className: 'value-modal-item'
            });
            
            const itemLabel = createElement('div', {
                className: 'value-item-label'
            }, `Item ${itemIndex + 1}`);
            
            let valueDisplay = 'No value';
            if (reconciledData?.selectedMatch) {
                const match = reconciledData.selectedMatch;
                if (match.type === 'wikidata') {
                    valueDisplay = createElement('a', {
                        href: `https://www.wikidata.org/entity/${match.id}`,
                        target: '_blank',
                        className: 'value-link'
                    }, `${match.label} (${match.id})`);
                } else {
                    valueDisplay = match.value || 'Custom value';
                }
            } else if (specificItem[mapping.key]) {
                valueDisplay = `Original: ${specificItem[mapping.key]}`;
            }
            
            const valueContent = createElement('div', {
                className: 'value-content'
            });
            if (typeof valueDisplay === 'string') {
                valueContent.textContent = valueDisplay;
            } else {
                valueContent.appendChild(valueDisplay);
            }
            
            valueItem.appendChild(itemLabel);
            valueItem.appendChild(valueContent);
            valuesList.appendChild(valueItem);
        } else {
            // For multi-item view, show all items with values
            fetchedData.forEach((item, index) => {
                const itemKey = `item-${index}`;
                const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
                const hasOriginalData = item[mapping.key] !== undefined && item[mapping.key] !== null;
                
                if (reconciledData || hasOriginalData) {
                    const valueItem = createElement('div', {
                        className: 'value-modal-item'
                    });
                    
                    const itemLabel = createElement('div', {
                        className: 'value-item-label'
                    }, `Item ${index + 1}`);
                    
                    let valueDisplay = 'No value';
                    if (reconciledData?.selectedMatch) {
                        const match = reconciledData.selectedMatch;
                        if (match.type === 'wikidata') {
                            valueDisplay = createElement('a', {
                                href: `https://www.wikidata.org/entity/${match.id}`,
                                target: '_blank',
                                className: 'value-link'
                            }, `${match.label} (${match.id})`);
                        } else {
                            valueDisplay = match.value || 'Custom value';
                        }
                    } else if (item[mapping.key]) {
                        valueDisplay = `Original: ${item[mapping.key]}`;
                    }
                    
                    const valueContent = createElement('div', {
                        className: 'value-content'
                    });
                    if (typeof valueDisplay === 'string') {
                        valueContent.textContent = valueDisplay;
                    } else {
                        valueContent.appendChild(valueDisplay);
                    }
                    
                    valueItem.appendChild(itemLabel);
                    valueItem.appendChild(valueContent);
                    valuesList.appendChild(valueItem);
                }
            });
        }
        
        if (valuesList.children.length === 0) {
            const noValues = createElement('div', {
                className: 'no-values-message'
            }, 'No values found for this property.');
            valuesList.appendChild(noValues);
        }
        
        modalContent.appendChild(valuesList);
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
    }

    // Auto-detect references
    function autoDetectReferences(showNotification = true) {
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData || [];
        const reconciliationData = { ...currentState.reconciliationData } || {};
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        let itemsWithSameAs = 0;
        let totalSameAsRefs = 0;
        let itemSpecificRefsAdded = 0;
        const sampleUrls = new Set();
        
        // Process each item individually for item-specific sameAs references
        fetchedData.forEach((item, index) => {
            const itemKey = `item-${index}`;
            let itemHasSameAs = false;
            
            // Check for sameAs
            if (item['schema:sameAs']) {
                const sameAsValues = Array.isArray(item['schema:sameAs']) ? 
                    item['schema:sameAs'] : [item['schema:sameAs']];
                
                sameAsValues.forEach(value => {
                    let url = null;
                    let type = 'sameAs URL';
                    
                    // Handle string values (simple format)
                    if (typeof value === 'string' && value.startsWith('http')) {
                        url = value;
                    }
                    // Handle object values (complex format with @id)
                    else if (typeof value === 'object' && value !== null && value['@id']) {
                        const idValue = value['@id'];
                        if (typeof idValue === 'string' && idValue.startsWith('http')) {
                            url = idValue;
                            type = value['o:label'] ? `sameAs (${value['o:label']})` : 'sameAs URL';
                        }
                    }
                    
                    if (url) {
                        itemHasSameAs = true;
                        totalSameAsRefs++;
                        sampleUrls.add(url);
                        
                        // Add this sameAs URL as a reference to ALL properties of THIS specific item
                        if (reconciliationData[itemKey]?.properties) {
                            Object.keys(reconciliationData[itemKey].properties).forEach(propertyKey => {
                                const propData = reconciliationData[itemKey].properties[propertyKey];
                                if (!propData.references) {
                                    propData.references = [];
                                }
                                
                                // Check if this reference already exists for this property
                                const existingRef = propData.references.find(ref => ref.url === url);
                                if (!existingRef) {
                                    propData.references.push({
                                        url: url,
                                        type: type,
                                        autoDetected: true,
                                        itemSpecific: true,
                                        retrievedDate: new Date().toISOString().split('T')[0],
                                        addedAt: new Date().toISOString()
                                    });
                                    itemSpecificRefsAdded++;
                                }
                            });
                        }
                    }
                });
            }
            
            if (itemHasSameAs) {
                itemsWithSameAs++;
            }
        });
        
        // Also detect ARK identifiers globally (these can remain global as they're usually institutional)
        const currentGlobalReferences = currentState.globalReferences || [];
        const detectedGlobalRefs = new Set();
        
        fetchedData.forEach(item => {
            // Check for ARK identifiers
            Object.values(item).forEach(value => {
                if (typeof value === 'string' && value.includes('ark:/')) {
                    const arkMatch = value.match(/ark:\/[\w\/]+/);
                    if (arkMatch) {
                        detectedGlobalRefs.add({
                            url: `https://n2t.net/${arkMatch[0]}`,
                            type: 'Archival Resource Key (ARK)',
                            autoDetected: true,
                            enabled: true
                        });
                    }
                }
            });
        });
        
        // Add ARK references to global references
        let globalRefsAdded = 0;
        detectedGlobalRefs.forEach(ref => {
            const exists = currentGlobalReferences.some(r => r.url === ref.url);
            if (!exists) {
                currentGlobalReferences.push(ref);
                globalRefsAdded++;
            }
        });
        
        // Update state with modified reconciliation data and global references
        if (itemSpecificRefsAdded > 0) {
            state.updateState('reconciliationData', reconciliationData);
        }
        if (globalRefsAdded > 0) {
            state.updateState('globalReferences', currentGlobalReferences);
            
            // Apply enabled global references immediately
            currentGlobalReferences.forEach(ref => {
                if (ref.enabled !== false) {
                    applyReferenceToAllProperties(ref);
                }
            });
        }
        
        // Update displays
        if (itemSpecificRefsAdded > 0 || globalRefsAdded > 0) {
            displayReferences();
            displayProperties();
            updateProceedButton();
        }
        
        // Show comprehensive notification
        if (showNotification) {
            let message = '';
            if (itemsWithSameAs > 0) {
                message += `Added ${totalSameAsRefs} sameAs reference${totalSameAsRefs > 1 ? 's' : ''} to ${itemsWithSameAs}/${fetchedData.length} items`;
                if (globalRefsAdded > 0) {
                    message += ` and ${globalRefsAdded} global ARK reference${globalRefsAdded > 1 ? 's' : ''}`;
                }
                
                // Show sameAs summary modal if multiple items have sameAs
                if (itemsWithSameAs > 1) {
                    setTimeout(() => showSameAsSummaryModal(itemsWithSameAs, fetchedData.length, Array.from(sampleUrls)), 1000);
                }
            } else if (globalRefsAdded > 0) {
                message = `Found ${globalRefsAdded} ARK reference${globalRefsAdded > 1 ? 's' : ''}`;
            } else {
                message = 'No new references found automatically';
            }
            
            showMessage(message, itemsWithSameAs > 0 || globalRefsAdded > 0 ? 'success' : 'info');
        }
        
        // Show warning if no references found at all
        const referenceWarning = document.getElementById('reference-warning');
        if (referenceWarning) {
            const globalRefs = currentState.globalReferences?.length || 0;
            const hasItemSpecificRefs = itemSpecificRefsAdded > 0 || itemsWithSameAs > 0;
            
            if (globalRefs === 0 && !hasItemSpecificRefs) {
                referenceWarning.style.display = 'block';
            } else {
                referenceWarning.style.display = 'none';
            }
        }
    }
    
    // Show sameAs summary modal
    function showSameAsSummaryModal(itemsWithSameAs, totalItems, sampleUrls) {
        const modal = createElement('div', {
            className: 'modal-overlay active'
        });
        
        const modalContent = createElement('div', {
            className: 'modal sameas-summary-modal'
        });
        
        const modalHeader = createElement('div', {
            className: 'modal-header'
        });
        
        const modalTitle = createElement('h3', {}, 'SameAs References Detected');
        
        const closeBtn = createButton('×', {
            className: 'modal-close',
            onClick: () => modal.remove()
        });
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeBtn);
        
        const modalBody = createElement('div', {
            className: 'modal-body'
        });
        
        // Summary section
        const summarySection = createElement('div', {
            className: 'sameas-summary'
        });
        
        const summaryTitle = createElement('h4', {}, 'Detection Results');
        
        const summaryText = createElement('p', {}, 
            `Found sameAs statements in ${itemsWithSameAs} out of ${totalItems} items. ` +
            `Each item's sameAs URL has been added as a reference to that specific item's properties.`
        );
        
        summarySection.appendChild(summaryTitle);
        summarySection.appendChild(summaryText);
        
        // Sample URLs section
        const samplesSection = createElement('div', {
            className: 'sameas-samples'
        });
        
        const samplesTitle = createElement('h4', {}, 'Sample URLs Found');
        
        const samplesList = createElement('ul', {
            className: 'sameas-samples-list'
        });
        
        // Show up to 3 sample URLs
        Array.from(sampleUrls).slice(0, 3).forEach(url => {
            const listItem = createElement('li', {});
            const urlLink = createElement('a', {
                href: url,
                target: '_blank',
                className: 'sameas-sample-link'
            }, url);
            listItem.appendChild(urlLink);
            samplesList.appendChild(listItem);
        });
        
        if (sampleUrls.size > 3) {
            const moreItem = createElement('li', {
                className: 'more-indicator'
            }, `... and ${sampleUrls.size - 3} more`);
            samplesList.appendChild(moreItem);
        }
        
        samplesSection.appendChild(samplesTitle);
        samplesSection.appendChild(samplesList);
        
        // Global reference option section
        const globalOptionSection = createElement('div', {
            className: 'global-option-section'
        });
        
        const globalTitle = createElement('h4', {}, 'Optional: Create Global Reference');
        
        const globalDescription = createElement('p', {}, 
            `You can optionally create a global reference that represents the sameAs pattern. ` +
            `This will be applied to all properties of all items, in addition to the item-specific references.`
        );
        
        const globalForm = createElement('div', {
            className: 'global-form'
        });
        
        const urlGroup = createElement('div', {
            className: 'form-group'
        });
        
        const urlLabel = createElement('label', {}, 'Representative URL (optional):');
        const urlSelect = createElement('select', {
            className: 'sameas-url-select'
        });
        
        // Add empty option
        const emptyOption = createElement('option', {
            value: '',
            selected: true
        }, '-- Select a sample URL or enter custom --');
        urlSelect.appendChild(emptyOption);
        
        // Add sample URLs as options
        Array.from(sampleUrls).forEach(url => {
            const option = createElement('option', {
                value: url
            }, url);
            urlSelect.appendChild(option);
        });
        
        const customUrlInput = createElement('input', {
            type: 'url',
            className: 'custom-url-input',
            placeholder: 'Or enter a custom URL...',
            style: 'margin-top: 8px;'
        });
        
        urlGroup.appendChild(urlLabel);
        urlGroup.appendChild(urlSelect);
        urlGroup.appendChild(customUrlInput);
        
        const descriptionGroup = createElement('div', {
            className: 'form-group'
        });
        
        const descLabel = createElement('label', {}, 'Description:');
        const descInput = createElement('input', {
            type: 'text',
            className: 'description-input',
            placeholder: `e.g., "SameAs URLs (${itemsWithSameAs}/${totalItems} items have this)"`,
            value: `SameAs URLs (${itemsWithSameAs}/${totalItems} items have this)`
        });
        
        descriptionGroup.appendChild(descLabel);
        descriptionGroup.appendChild(descInput);
        
        globalForm.appendChild(urlGroup);
        globalForm.appendChild(descriptionGroup);
        
        globalOptionSection.appendChild(globalTitle);
        globalOptionSection.appendChild(globalDescription);
        globalOptionSection.appendChild(globalForm);
        
        modalBody.appendChild(summarySection);
        modalBody.appendChild(samplesSection);
        modalBody.appendChild(globalOptionSection);
        
        // Modal footer
        const modalFooter = createElement('div', {
            className: 'modal-footer'
        });
        
        const skipBtn = createButton('Skip Global Reference', {
            className: 'wikidata-btn wikidata-btn--secondary',
            onClick: () => modal.remove()
        });
        
        const createBtn = createButton('Create Global Reference', {
            className: 'wikidata-btn wikidata-btn--primary',
            onClick: () => {
                const selectedUrl = urlSelect.value || customUrlInput.value.trim();
                const description = descInput.value.trim();
                
                if (selectedUrl) {
                    createGlobalSameAsReference(selectedUrl, description);
                    modal.remove();
                    showMessage('Global sameAs reference created', 'success');
                } else {
                    showMessage('Please select or enter a URL for the global reference', 'warning');
                }
            }
        });
        
        modalFooter.appendChild(skipBtn);
        modalFooter.appendChild(createBtn);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Handle URL selection switching
        urlSelect.addEventListener('change', () => {
            if (urlSelect.value) {
                customUrlInput.value = '';
            }
        });
        
        customUrlInput.addEventListener('input', () => {
            if (customUrlInput.value.trim()) {
                urlSelect.value = '';
            }
        });
    }
    
    // Create global sameAs reference
    function createGlobalSameAsReference(url, description) {
        const currentState = state.getState();
        const globalReferences = currentState.globalReferences || [];
        
        // Check if this URL already exists
        if (globalReferences.some(r => r.url === url)) {
            showMessage('This reference URL already exists', 'warning');
            return;
        }
        
        globalReferences.push({
            url: url,
            type: description || 'SameAs URL (Global)',
            autoDetected: false,
            enabled: true,
            retrievedDate: new Date().toISOString().split('T')[0],
            addedAt: new Date().toISOString()
        });
        
        state.updateState('globalReferences', globalReferences);
        displayReferences();
    }

    // Search for references in API data with interactive modal
    function searchForReferences() {
        showReferenceSearchModal();
    }
    
    // Show interactive reference search modal
    function showReferenceSearchModal() {
        const modalContainer = document.getElementById('modal-container');
        const modalTitle = document.getElementById('modal-title');
        const modalContent = document.getElementById('modal-content');
        const modalFooter = document.getElementById('modal-footer');
        
        if (!modalContainer || !modalTitle || !modalContent || !modalFooter) {
            console.error('Modal elements not found');
            return;
        }
        
        // Set modal title
        modalTitle.textContent = 'Search for References';
        
        // Create modal content
        const searchContainer = createElement('div', {
            className: 'reference-search-container'
        });
        
        // Search input section
        const searchInputSection = createElement('div', {
            className: 'search-input-section'
        });
        
        const searchLabel = createElement('label', {
            htmlFor: 'reference-search-input'
        }, 'Search for IDs or URLs in the API data:');
        
        const searchInput = createElement('input', {
            type: 'text',
            id: 'reference-search-input',
            className: 'reference-search-input',
            placeholder: 'Type to search...'
        });
        
        searchInputSection.appendChild(searchLabel);
        searchInputSection.appendChild(searchInput);
        
        // Results section
        const resultsSection = createElement('div', {
            className: 'search-results-section'
        });
        
        const resultsHeader = createElement('div', {
            className: 'results-header'
        }, 'Search Results:');
        
        const resultsContainer = createElement('div', {
            className: 'reference-search-results',
            id: 'reference-search-results'
        });
        
        // Initial placeholder
        const placeholder = createElement('div', {
            className: 'search-placeholder'
        }, 'Start typing to search for references...');
        resultsContainer.appendChild(placeholder);
        
        resultsSection.appendChild(resultsHeader);
        resultsSection.appendChild(resultsContainer);
        
        searchContainer.appendChild(searchInputSection);
        searchContainer.appendChild(resultsSection);
        
        // Set modal content
        modalContent.innerHTML = '';
        modalContent.appendChild(searchContainer);
        
        // Modal footer with close button
        modalFooter.innerHTML = '';
        const closeButton = createButton('Close', {
            type: 'secondary',
            onClick: () => closeModal()
        });
        modalFooter.appendChild(closeButton);
        
        // Show modal
        modalContainer.style.display = 'flex';
        
        // Focus search input
        searchInput.focus();
        
        // Add search functionality with debouncing
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performReferenceSearch(e.target.value, resultsContainer);
            }, 300);
        });
    }
    
    // Perform reference search and update results
    function performReferenceSearch(searchTerm, resultsContainer) {
        resultsContainer.innerHTML = '';
        
        if (!searchTerm || searchTerm.length < 2) {
            const placeholder = createElement('div', {
                className: 'search-placeholder'
            }, 'Start typing to search for references...');
            resultsContainer.appendChild(placeholder);
            return;
        }
        
        const fetchedData = state.getState().fetchedData || [];
        const currentReferences = state.getState().references || [];
        const foundRefs = new Map();
        
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
                                const refKey = url;
                                if (!foundRefs.has(refKey)) {
                                    foundRefs.set(refKey, {
                                        url: url,
                                        type: `Found in ${key}`,
                                        autoDetected: false,
                                        enabled: true,
                                        source: `Item: ${item['o:title'] || 'Untitled'}`,
                                        context: searchValue.toString(),
                                        property: key
                                    });
                                }
                            });
                        }
                        
                        // Also check if the whole value is a URL
                        if (searchValue.toString().startsWith('http')) {
                            const refKey = searchValue.toString();
                            if (!foundRefs.has(refKey)) {
                                foundRefs.set(refKey, {
                                    url: searchValue.toString(),
                                    type: `Found in ${key}`,
                                    autoDetected: false,
                                    enabled: true,
                                    source: `Item: ${item['o:title'] || 'Untitled'}`,
                                    context: searchValue.toString(),
                                    property: key
                                });
                            }
                        }
                    }
                });
            });
        });
        
        if (foundRefs.size === 0) {
            const noResults = createElement('div', {
                className: 'no-search-results'
            }, `No references found containing "${searchTerm}"`);
            resultsContainer.appendChild(noResults);
            return;
        }
        
        // Display found references
        const resultsCount = createElement('div', {
            className: 'results-count'
        }, `Found ${foundRefs.size} reference${foundRefs.size > 1 ? 's' : ''} containing "${searchTerm}"`);
        resultsContainer.appendChild(resultsCount);
        
        foundRefs.forEach(ref => {
            const isAlreadyAdded = currentReferences.some(r => r.url === ref.url);
            
            const refItem = createElement('div', {
                className: `reference-search-result ${isAlreadyAdded ? 'already-added' : ''}`
            });
            
            const refInfo = createElement('div', {
                className: 'reference-info'
            });
            
            const refUrl = createElement('a', {
                className: 'reference-url',
                href: ref.url,
                target: '_blank'
            }, ref.url);
            
            const refDetails = createElement('div', {
                className: 'reference-details'
            });
            
            const refType = createElement('div', {
                className: 'reference-type'
            }, `${ref.type} • ${ref.source}`);
            
            if (ref.context && ref.context !== ref.url) {
                const refContext = createElement('div', {
                    className: 'reference-context'
                }, `Context: ${ref.context.length > 100 ? ref.context.substring(0, 100) + '...' : ref.context}`);
                refDetails.appendChild(refContext);
            }
            
            refDetails.appendChild(refType);
            refInfo.appendChild(refUrl);
            refInfo.appendChild(refDetails);
            
            const refActions = createElement('div', {
                className: 'reference-actions'
            });
            
            if (isAlreadyAdded) {
                const addedLabel = createElement('span', {
                    className: 'reference-added-label'
                }, '✓ Added');
                refActions.appendChild(addedLabel);
            } else {
                const addButton = createButton('+ Add', {
                    type: 'primary',
                    onClick: () => addReferenceFromSearch(ref, refItem)
                });
                refActions.appendChild(addButton);
            }
            
            refItem.appendChild(refInfo);
            refItem.appendChild(refActions);
            
            resultsContainer.appendChild(refItem);
        });
    }
    
    // Add reference from search results
    function addReferenceFromSearch(ref, refItem) {
        const currentState = state.getState();
        const globalReferences = currentState.globalReferences || [];
        
        // Check if already exists
        if (globalReferences.some(r => r.url === ref.url)) {
            showMessage('This reference already exists', 'warning');
            return;
        }
        
        // Add the reference to global references
        const newRef = {
            url: ref.url,
            type: ref.type,
            autoDetected: false,
            enabled: true,
            source: ref.source,
            retrievedDate: new Date().toISOString().split('T')[0], // Today's date
            addedAt: new Date().toISOString()
        };
        
        globalReferences.push(newRef);
        state.updateState('globalReferences', globalReferences);
        
        // Apply the reference immediately since it's enabled by default
        applyReferenceToAllProperties(newRef);
        
        displayReferences();
        updateProceedButton();
        
        // Update the UI to show it's been added
        refItem.classList.add('already-added');
        const actionsDiv = refItem.querySelector('.reference-actions');
        actionsDiv.innerHTML = '';
        const addedLabel = createElement('span', {
            className: 'reference-added-label'
        }, '✓ Added');
        actionsDiv.appendChild(addedLabel);
        
        showMessage('Reference added successfully', 'success');
        
        // Hide reference warning if it exists
        const referenceWarning = document.getElementById('reference-warning');
        if (referenceWarning) {
            referenceWarning.style.display = 'none';
        }
    }
    
    // Close modal helper
    function closeModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            modalContainer.style.display = 'none';
        }
    }
    
    // Add manual reference
    function addManualReference() {
        const url = prompt('Enter reference URL:', 'https://');
        if (!url || url === 'https://') return;
        
        const currentState = state.getState();
        const globalReferences = currentState.globalReferences || [];
        
        // Check if already exists
        if (globalReferences.some(r => r.url === url)) {
            showMessage('This reference already exists', 'warning');
            return;
        }
        
        const newRef = {
            url: url,
            type: 'Manual reference',
            autoDetected: false,
            enabled: true,
            retrievedDate: new Date().toISOString().split('T')[0],
            addedAt: new Date().toISOString()
        };
        
        globalReferences.push(newRef);
        state.updateState('globalReferences', globalReferences);
        
        // Apply the reference immediately since it's enabled by default
        applyReferenceToAllProperties(newRef);
        
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
        const modal = createElement('div', {
            className: 'modal-overlay active'
        });
        
        const modalContent = createElement('div', {
            className: 'modal reference-modal'
        });
        
        const modalHeader = createElement('div', {
            className: 'modal-header'
        });
        
        const modalTitle = createElement('h3', {}, `Add Reference for ${propertyId}`);
        modalHeader.appendChild(modalTitle);
        
        const closeBtn = createButton('×', {
            className: 'modal-close',
            onClick: () => document.body.removeChild(modal)
        });
        modalHeader.appendChild(closeBtn);
        modalContent.appendChild(modalHeader);
        
        const modalBody = createElement('div', {
            className: 'modal-body'
        });
        
        // Reference URL input
        const urlGroup = createElement('div', {
            className: 'form-group'
        });
        const urlLabel = createElement('label', {}, 'Reference URL (P854)');
        const urlInput = createElement('input', {
            type: 'url',
            className: 'wikidata-input',
            placeholder: 'https://example.com/source',
            required: true
        });
        urlGroup.appendChild(urlLabel);
        urlGroup.appendChild(urlInput);
        modalBody.appendChild(urlGroup);
        
        // Retrieved date input
        const dateGroup = createElement('div', {
            className: 'form-group'
        });
        const dateLabel = createElement('label', {}, 'Retrieved Date (P813)');
        const dateInput = createElement('input', {
            type: 'date',
            className: 'wikidata-input',
            value: new Date().toISOString().split('T')[0] // Today's date
        });
        dateGroup.appendChild(dateLabel);
        dateGroup.appendChild(dateInput);
        modalBody.appendChild(dateGroup);
        
        // Scope selector
        const scopeGroup = createElement('div', {
            className: 'form-group'
        });
        const scopeLabel = createElement('label', {}, 'Apply reference to:');
        const scopeSelect = createElement('select', {
            className: 'wikidata-input'
        });
        
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData || [];
        
        const scopeOptions = [
            { value: 'this-property-all-items', text: `All items with property ${propertyId}` },
            { value: 'all-properties', text: 'All properties of all items (global reference)' },
            { value: 'item-specific', text: `Item-specific references (add each item's own URL)` }
        ];
        
        // Add individual item options if there are multiple items
        if (fetchedData.length > 1) {
            fetchedData.forEach((item, index) => {
                const itemTitle = item['o:title'] || item['dcterms:title'] || `Item ${index + 1}`;
                scopeOptions.push({
                    value: `single-item-${index}`,
                    text: `Only "${itemTitle}"`
                });
            });
        }
        
        scopeOptions.forEach(opt => {
            const option = createElement('option', {
                value: opt.value
            }, opt.text);
            scopeSelect.appendChild(option);
        });
        
        scopeGroup.appendChild(scopeLabel);
        scopeGroup.appendChild(scopeSelect);
        modalBody.appendChild(scopeGroup);
        
        modalContent.appendChild(modalBody);
        
        // Modal footer with buttons
        const modalFooter = createElement('div', {
            className: 'modal-footer'
        });
        
        const cancelBtn = createButton('Cancel', {
            className: 'wikidata-btn wikidata-btn--secondary',
            onClick: () => document.body.removeChild(modal)
        });
        
        const addBtn = createButton('Add Reference', {
            className: 'wikidata-btn wikidata-btn--primary',
            onClick: () => {
                const url = urlInput.value.trim();
                const retrievedDate = dateInput.value;
                const scope = scopeSelect.value;
                
                if (!url) {
                    showMessage('Please enter a reference URL', 'error');
                    return;
                }
                
                addPropertyReference(propertyId, url, retrievedDate, scope);
                document.body.removeChild(modal);
            }
        });
        
        modalFooter.appendChild(cancelBtn);
        modalFooter.appendChild(addBtn);
        modalContent.appendChild(modalFooter);
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Focus URL input
        setTimeout(() => urlInput.focus(), 100);
    }
    
    // Remove a reference from a property
    function removePropertyReference(propertyId, mappingKey, refToRemove, specificItem) {
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData;
        const fetchedData = currentState.fetchedData || [];
        
        if (specificItem) {
            // Remove from specific item
            const itemIndex = fetchedData.indexOf(specificItem);
            const itemKey = `item-${itemIndex}`;
            
            // Check both mapping key and property ID locations
            [mappingKey, propertyId].forEach(key => {
                if (key && reconciliationData[itemKey]?.properties[key]?.references) {
                    reconciliationData[itemKey].properties[key].references = 
                        reconciliationData[itemKey].properties[key].references.filter(
                            ref => ref.url !== refToRemove.url
                        );
                }
            });
        } else {
            // Remove from all items
            Object.keys(reconciliationData).forEach(itemKey => {
                // Check both mapping key and property ID locations
                [mappingKey, propertyId].forEach(key => {
                    if (key && reconciliationData[itemKey]?.properties[key]?.references) {
                        reconciliationData[itemKey].properties[key].references = 
                            reconciliationData[itemKey].properties[key].references.filter(
                                ref => ref.url !== refToRemove.url
                            );
                    }
                });
            });
        }
        
        // Update state with modified reconciliation data
        state.updateState('reconciliationData', reconciliationData);
        
        // Refresh display
        displayProperties();
        
        showMessage('Reference removed', 'success');
    }
    
    // Apply reference to all properties
    function applyReferenceToAllProperties(ref) {
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData;
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        // Get all property keys that should have references applied
        // This includes both original mapped keys and any custom properties added via "Add New Statement"
        const allPropertyKeys = new Set();
        
        // Add mapped keys
        mappedKeys.forEach(mapping => {
            allPropertyKeys.add(mapping.key);
        });
        
        // Add any custom properties that exist in reconciliation data
        Object.keys(reconciliationData).forEach(itemKey => {
            const itemData = reconciliationData[itemKey];
            if (itemData.properties) {
                Object.keys(itemData.properties).forEach(propertyKey => {
                    allPropertyKeys.add(propertyKey);
                });
            }
        });
        
        // Apply reference to all items and all identified properties
        Object.keys(reconciliationData).forEach(itemKey => {
            const itemData = reconciliationData[itemKey];
            
            if (!itemData.properties) {
                itemData.properties = {};
            }
            
            // Ensure all property keys exist and have the reference applied
            allPropertyKeys.forEach(propertyKey => {
                // Initialize property if it doesn't exist
                if (!itemData.properties[propertyKey]) {
                    itemData.properties[propertyKey] = {
                        references: [],
                        reconciled: []
                    };
                }
                
                const propData = itemData.properties[propertyKey];
                
                if (!propData.references) {
                    propData.references = [];
                }
                
                // Check if reference already exists
                const existingRef = propData.references.find(r => r.url === ref.url);
                if (!existingRef) {
                    // Use the helper function to create a consistent reference object
                    propData.references.push(createReferenceObject(ref));
                }
            });
        });
        
        // Update state with modified reconciliation data
        state.updateState('reconciliationData', reconciliationData);
        
        // Refresh the display
        displayProperties();
    }
    
    // Remove reference from all properties
    function removeReferenceFromAllProperties(ref) {
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData;
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        // Get all property keys that might have this reference
        // This includes both original mapped keys and any custom properties added via "Add New Statement"
        const allPropertyKeys = new Set();
        
        // Add mapped keys
        mappedKeys.forEach(mapping => {
            allPropertyKeys.add(mapping.key);
        });
        
        // Add any custom properties that exist in reconciliation data
        Object.keys(reconciliationData).forEach(itemKey => {
            const itemData = reconciliationData[itemKey];
            if (itemData.properties) {
                Object.keys(itemData.properties).forEach(propertyKey => {
                    allPropertyKeys.add(propertyKey);
                });
            }
        });
        
        // Remove reference from all items and all identified properties
        Object.keys(reconciliationData).forEach(itemKey => {
            const itemData = reconciliationData[itemKey];
            
            if (itemData.properties) {
                allPropertyKeys.forEach(propertyKey => {
                    const propData = itemData.properties[propertyKey];
                    
                    if (propData && propData.references) {
                        propData.references = propData.references.filter(r => r.url !== ref.url);
                    }
                });
            }
        });
        
        // Update state with modified reconciliation data
        state.updateState('reconciliationData', reconciliationData);
        
        // Refresh the display
        displayProperties();
    }
    
    // Add a reference to a property with the specified scope
    function addPropertyReference(propertyId, url, retrievedDate, scope) {
        const currentState = state.getState();
        const reconciliationData = { ...currentState.reconciliationData };
        const fetchedData = currentState.fetchedData || [];
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        // Find the mapping for this property ID to get the key
        const mapping = mappedKeys.find(m => m.property?.id === propertyId);
        const mappingKey = mapping?.key;
        
        if (scope === 'all-properties') {
            // Add to global references
            const globalRefs = currentState.globalReferences || [];
            globalRefs.push({
                url: url,
                type: 'Manual reference',
                autoDetected: false,
                enabled: true,
                retrievedDate: retrievedDate,
                addedAt: new Date().toISOString()
            });
            state.updateState('globalReferences', globalRefs);
        } else if (scope === 'item-specific') {
            // Add item-specific references - each item gets its own sameAs URL if available
            let itemsWithSameAs = 0;
            fetchedData.forEach((item, index) => {
                const itemKey = `item-${index}`;
                
                // Check if this item has sameAs
                if (item['schema:sameAs']) {
                    const sameAsValues = Array.isArray(item['schema:sameAs']) ? 
                        item['schema:sameAs'] : [item['schema:sameAs']];
                    
                    sameAsValues.forEach(value => {
                        let itemUrl = null;
                        let itemType = 'sameAs URL';
                        
                        // Handle string values (simple format)
                        if (typeof value === 'string' && value.startsWith('http')) {
                            itemUrl = value;
                        }
                        // Handle object values (complex format with @id)
                        else if (typeof value === 'object' && value !== null && value['@id']) {
                            const idValue = value['@id'];
                            if (typeof idValue === 'string' && idValue.startsWith('http')) {
                                itemUrl = idValue;
                                itemType = value['o:label'] ? `sameAs (${value['o:label']})` : 'sameAs URL';
                            }
                        }
                        
                        if (itemUrl && reconciliationData[itemKey]?.properties) {
                            // Add to the specific property for this item
                            const propertyKey = mappingKey || propertyId;
                            if (reconciliationData[itemKey].properties[propertyKey]) {
                                const propData = reconciliationData[itemKey].properties[propertyKey];
                                if (!propData.references) {
                                    propData.references = [];
                                }
                                
                                // Check if reference already exists
                                const existingRef = propData.references.find(ref => ref.url === itemUrl);
                                if (!existingRef) {
                                    propData.references.push({
                                        url: itemUrl,
                                        type: itemType,
                                        autoDetected: false,
                                        itemSpecific: true,
                                        retrievedDate: retrievedDate,
                                        addedAt: new Date().toISOString()
                                    });
                                    itemsWithSameAs++;
                                }
                            }
                        }
                    });
                }
            });
            
            if (itemsWithSameAs === 0) {
                showMessage('No sameAs URLs found in the items', 'warning');
                return;
            }
            
            // Update state with modified reconciliation data
            state.updateState('reconciliationData', reconciliationData);
            showMessage(`Added item-specific sameAs references for ${itemsWithSameAs} items`, 'success');
        } else if (scope.startsWith('single-item-')) {
            // Add to single specific item
            const itemIndex = parseInt(scope.replace('single-item-', ''));
            const itemKey = `item-${itemIndex}`;
            
            if (reconciliationData[itemKey]?.properties) {
                const propertyKey = mappingKey || propertyId;
                if (reconciliationData[itemKey].properties[propertyKey]) {
                    const propData = reconciliationData[itemKey].properties[propertyKey];
                    if (!propData.references) {
                        propData.references = [];
                    }
                    
                    // Check if reference already exists
                    const existingRef = propData.references.find(ref => ref.url === url);
                    if (!existingRef) {
                        propData.references.push({
                            url: url,
                            type: 'Manual reference',
                            autoDetected: false,
                            itemSpecific: true,
                            retrievedDate: retrievedDate,
                            addedAt: new Date().toISOString()
                        });
                    }
                }
            }
            
            // Update state with modified reconciliation data
            state.updateState('reconciliationData', reconciliationData);
            
            const itemTitle = fetchedData[itemIndex]?.['o:title'] || fetchedData[itemIndex]?.['dcterms:title'] || `Item ${itemIndex + 1}`;
            showMessage(`Reference added to "${itemTitle}"`, 'success');
        } else if (scope === 'this-property-all-items') {
            // Add to all items that have this property
            const itemsToUpdate = [];
            
            Object.keys(reconciliationData).forEach(itemId => {
                // Check if item has this property using both propertyId and mappingKey
                const hasPropertyById = reconciliationData[itemId].properties?.[propertyId];
                const hasPropertyByKey = mappingKey && reconciliationData[itemId].properties?.[mappingKey];
                
                if (hasPropertyById || hasPropertyByKey) {
                    itemsToUpdate.push({
                        itemId: itemId,
                        propertyKey: hasPropertyByKey ? mappingKey : propertyId
                    });
                }
            });
            
            // Update reconciliation data for each item
            itemsToUpdate.forEach(update => {
                const propData = reconciliationData[update.itemId].properties[update.propertyKey];
                if (!propData.references) {
                    propData.references = [];
                }
                
                // Check if reference already exists
                const existingRef = propData.references.find(ref => ref.url === url);
                if (!existingRef) {
                    propData.references.push({
                        url: url,
                        type: 'Manual reference',
                        autoDetected: false,
                        retrievedDate: retrievedDate,
                        addedAt: new Date().toISOString()
                    });
                }
            });
            
            // Update state with modified reconciliation data
            state.updateState('reconciliationData', reconciliationData);
            showMessage(`Reference added to ${itemsToUpdate.length} items with property ${propertyId}`, 'success');
        }
        
        // Refresh the display
        displayProperties();
        displayReferences();
    }
    
    // Show new statement modal
    function showNewStatementModal() {
        // Create modal for adding new statement
        const modal = createElement('div', {
            className: 'modal-overlay active'
        });
        
        const modalContent = createElement('div', {
            className: 'modal new-statement-modal'
        });
        
        const modalHeader = createElement('div', {
            className: 'modal-header'
        });
        
        const modalTitle = createElement('h3', {}, 'Add New Statement');
        
        const closeBtn = createButton('×', {
            className: 'modal-close',
            onClick: () => modal.remove()
        });
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeBtn);
        
        const modalBody = createElement('div', {
            className: 'modal-body'
        });
        
        // Property search section
        const propertySection = createElement('div', {
            className: 'property-search-section'
        });
        
        const propertyLabel = createElement('label', {}, 'Property:');
        const propertyInput = createElement('input', {
            type: 'text',
            className: 'property-search-input',
            placeholder: 'Search for a property (e.g., "instance of", "P31")'
        });
        
        const propertyResults = createElement('div', {
            className: 'property-search-results'
        });
        
        propertySection.appendChild(propertyLabel);
        propertySection.appendChild(propertyInput);
        propertySection.appendChild(propertyResults);
        
        // Value section
        const valueSection = createElement('div', {
            className: 'value-section'
        });
        
        const valueLabel = createElement('label', {}, 'Value:');
        const valueInput = createElement('input', {
            type: 'text',
            className: 'value-input',
            placeholder: 'Enter value for all items'
        });
        
        valueSection.appendChild(valueLabel);
        valueSection.appendChild(valueInput);
        
        // Add button
        const addButton = createButton('Add Statement', {
            className: 'button--primary',
            onClick: () => addNewStatement(propertyInput.value, valueInput.value, modal)
        });
        
        modalBody.appendChild(propertySection);
        modalBody.appendChild(valueSection);
        modalBody.appendChild(addButton);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Add property search functionality
        propertyInput.addEventListener('input', () => searchProperties(propertyInput.value, propertyResults));
        
        // Focus the property input
        propertyInput.focus();
    }
    
    // Search for properties
    function searchProperties(query, resultsContainer) {
        resultsContainer.innerHTML = '';
        
        if (!query || query.length < 2) {
            return;
        }
        
        // Simple property search - in a real implementation, this would search Wikidata
        const commonProperties = [
            { id: 'P31', label: 'instance of', description: 'that class of which this subject is a particular example and member' },
            { id: 'P17', label: 'country', description: 'sovereign state of this item' },
            { id: 'P106', label: 'occupation', description: 'occupation of a person' },
            { id: 'P569', label: 'date of birth', description: 'date on which the subject was born' },
            { id: 'P570', label: 'date of death', description: 'date on which the subject died' },
            { id: 'P19', label: 'place of birth', description: 'most specific known birth location' },
            { id: 'P20', label: 'place of death', description: 'most specific known death location' },
            { id: 'P27', label: 'country of citizenship', description: 'the object is a country that recognizes the subject as its citizen' }
        ];
        
        const filteredProperties = commonProperties.filter(prop => 
            prop.label.toLowerCase().includes(query.toLowerCase()) ||
            prop.id.toLowerCase().includes(query.toLowerCase()) ||
            prop.description.toLowerCase().includes(query.toLowerCase())
        );
        
        filteredProperties.forEach(prop => {
            const resultItem = createElement('div', {
                className: 'property-result-item',
                onClick: () => selectProperty(prop, resultsContainer)
            });
            
            // Create compact format: "label (P123) description"
            const propLink = createElement('a', {
                href: `https://www.wikidata.org/wiki/Property:${prop.id}`,
                target: '_blank',
                className: 'prop-id-link',
                onClick: (e) => e.stopPropagation() // Prevent modal selection when clicking link
            }, prop.id);
            
            const compactText = createElement('span', {
                className: 'prop-compact'
            });
            
            const labelSpan = createElement('span', {
                className: 'prop-label'
            }, prop.label);
            
            const bracketOpen = createElement('span', {}, ' (');
            const bracketClose = createElement('span', {}, ') ');
            
            const descSpan = createElement('span', {
                className: 'prop-description'
            }, prop.description);
            
            compactText.appendChild(labelSpan);
            compactText.appendChild(bracketOpen);
            compactText.appendChild(propLink);
            compactText.appendChild(bracketClose);
            compactText.appendChild(descSpan);
            
            resultItem.appendChild(compactText);
            
            resultsContainer.appendChild(resultItem);
        });
        
    }
    
    // Select a property
    function selectProperty(property, resultsContainer) {
        const propertyInput = document.querySelector('.property-search-input');
        propertyInput.value = `${property.label} (${property.id})`;
        propertyInput.dataset.selectedId = property.id;
        propertyInput.dataset.selectedLabel = property.label;
        resultsContainer.innerHTML = '';
    }
    
    // Add new statement
    function addNewStatement(propertyText, value, modal) {
        const propertyInput = document.querySelector('.property-search-input');
        const selectedId = propertyInput.dataset.selectedId;
        const selectedLabel = propertyInput.dataset.selectedLabel;
        
        if (!selectedId || !value.trim()) {
            showMessage('Please select a property and enter a value', 'error');
            return;
        }
        
        // Add the new statement to all items
        const currentState = state.getState();
        const fetchedData = currentState.fetchedData || [];
        const reconciliationData = { ...currentState.reconciliationData } || {};
        
        // Create a new mapping for this property
        const newMapping = {
            key: `custom_${selectedId}`,
            property: {
                id: selectedId,
                label: selectedLabel
            }
        };
        
        // Add to mapped keys
        const mappedKeys = [...(currentState.mappings?.mappedKeys || [])];
        mappedKeys.push(newMapping);
        
        // Add reconciled values for all items
        fetchedData.forEach((item, index) => {
            const itemKey = `item-${index}`;
            
            if (!reconciliationData[itemKey]) {
                reconciliationData[itemKey] = { properties: {} };
            }
            
            if (!reconciliationData[itemKey].properties) {
                reconciliationData[itemKey].properties = {};
            }
            
            reconciliationData[itemKey].properties[newMapping.key] = {
                reconciled: [{
                    status: 'reconciled',
                    selectedMatch: {
                        type: 'custom',
                        value: value.trim(),
                        datatype: 'string'
                    },
                    confidence: 100
                }],
                references: [] // Initialize empty references array for new properties
            };
        });
        
        // Apply any enabled global references to the new property
        const globalReferences = currentState.globalReferences || [];
        
        globalReferences.forEach(ref => {
            if (ref.enabled !== false) { // Apply references that are enabled
                fetchedData.forEach((item, index) => {
                    const itemKey = `item-${index}`;
                    const propData = reconciliationData[itemKey].properties[newMapping.key];
                    
                    if (propData && propData.references) {
                        // Check if reference doesn't already exist
                        const existingRef = propData.references.find(r => r.url === ref.url);
                        if (!existingRef) {
                            propData.references.push(createReferenceObject(ref));
                        }
                    }
                });
            }
        });
        
        // Update state
        state.updateState('mappings.mappedKeys', mappedKeys);
        state.updateState('reconciliationData', reconciliationData);
        
        // Refresh display
        displayProperties();
        
        // Close modal
        modal.remove();
        
        showMessage(`Added "${selectedLabel}" statement to all ${fetchedData.length} items`, 'success');
    }
    
    // Helper function to ensure all properties have initialized references arrays
    function ensureReferencesArrays(reconciliationData) {
        Object.values(reconciliationData).forEach(itemData => {
            if (itemData.properties) {
                Object.values(itemData.properties).forEach(propData => {
                    if (!propData.references) {
                        propData.references = [];
                    }
                });
            }
        });
    }
    
    // Check for issues
    function checkForIssues() {
        const issuesSection = document.querySelector('.issues-section');
        const issuesList = document.getElementById('issues-list');
        if (!issuesSection || !issuesList) {
            console.error('Designer - issues section not found!');
            return;
        }
        
        const issues = [];
        const currentState = state.getState();
        const oldReferences = currentState.references || [];
        const globalReferences = currentState.globalReferences || [];
        const allReferences = [...oldReferences, ...globalReferences];
        const fetchedData = currentState.fetchedData || [];
        const reconciliationData = currentState.reconciliationData || {};
        
        // Ensure all properties have references arrays
        ensureReferencesArrays(reconciliationData);
        
        // Check if any property has references
        let hasAnyReferences = false;
        for (const itemKey of Object.keys(reconciliationData)) {
            const itemData = reconciliationData[itemKey];
            if (itemData.properties) {
                for (const propertyKey of Object.keys(itemData.properties)) {
                    const propData = itemData.properties[propertyKey];
                    if (propData.references?.length > 0) {
                        hasAnyReferences = true;
                        break;
                    }
                }
                if (hasAnyReferences) break;
            }
        }
        
        // Also check if any global references exist (even if not applied yet)
        if (!hasAnyReferences && allReferences.length === 0) {
            issues.push({
                type: 'no-references',
                text: 'No references added. At least one reference is required.',
                icon: '⚠️'
            });
        }
        
        // Update issues display
        issuesList.innerHTML = '';
        
        if (issues.length === 0) {
            // Hide the entire issues section when there are no issues
            issuesSection.style.display = 'none';
        } else {
            // Show the issues section when there are issues
            issuesSection.style.display = 'block';
            
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
        // Hide the preview section as it's not needed
        const previewSection = document.querySelector('.preview-section');
        if (previewSection) {
            previewSection.style.display = 'none';
        }
        return; // Exit early as preview is not needed
        
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
        
        // Get label information
        const labelKey = currentState.designerData?.labelKey;
        let itemLabel = '';
        
        if (labelKey && fetchedData.length > 0) {
            if (selectedItemValue === 'multi-item') {
                // For multi-item view, show first available label
                for (const item of fetchedData) {
                    if (item[labelKey] !== undefined && item[labelKey] !== null) {
                        let displayValue = item[labelKey];
                        if (Array.isArray(displayValue)) {
                            displayValue = displayValue[0];
                        }
                        if (typeof displayValue === 'object' && displayValue !== null) {
                            displayValue = displayValue['@value'] || displayValue['o:label'] || JSON.stringify(displayValue);
                        }
                        itemLabel = `Example: ${displayValue}`;
                        break;
                    }
                }
            } else {
                // For specific item
                const itemIndex = parseInt(selectedItemValue);
                const selectedItem = fetchedData[itemIndex];
                if (selectedItem && selectedItem[labelKey] !== undefined && selectedItem[labelKey] !== null) {
                    let displayValue = selectedItem[labelKey];
                    if (Array.isArray(displayValue)) {
                        displayValue = displayValue[0];
                    }
                    if (typeof displayValue === 'object' && displayValue !== null) {
                        displayValue = displayValue['@value'] || displayValue['o:label'] || JSON.stringify(displayValue);
                    }
                    itemLabel = displayValue;
                }
            }
        }
        
        // Generate preview content
        const previewData = {
            item: selectedItemValue === 'multi-item' ? 'Multi-item view' : `Item ${selectedItemValue}`,
            label: itemLabel || 'No label selected',
            labelSource: labelKey || 'No label source selected',
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
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData || {};
        const oldReferences = currentState.references || [];
        const globalReferences = currentState.globalReferences || [];
        const allReferences = [...oldReferences, ...globalReferences];
        
        // Ensure all properties have references arrays
        ensureReferencesArrays(reconciliationData);
        
        // Check if any property has references
        let hasAnyReferences = false;
        for (const itemKey of Object.keys(reconciliationData)) {
            const itemData = reconciliationData[itemKey];
            if (itemData.properties) {
                for (const propertyKey of Object.keys(itemData.properties)) {
                    const propData = itemData.properties[propertyKey];
                    if (propData.references?.length > 0) {
                        hasAnyReferences = true;
                        break;
                    }
                }
                if (hasAnyReferences) break;
            }
        }
        
        // If no references applied to properties and no global references exist
        if (!hasAnyReferences && allReferences.length === 0) {
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
        
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData || {};
        const oldReferences = currentState.references || [];
        const globalReferences = currentState.globalReferences || [];
        const allReferences = [...oldReferences, ...globalReferences];
        
        // Ensure all properties have references arrays
        ensureReferencesArrays(reconciliationData);
        
        // Check if any property has references
        let hasAnyReferences = false;
        for (const itemKey of Object.keys(reconciliationData)) {
            const itemData = reconciliationData[itemKey];
            if (itemData.properties) {
                for (const propertyKey of Object.keys(itemData.properties)) {
                    const propData = itemData.properties[propertyKey];
                    if (propData.references?.length > 0) {
                        hasAnyReferences = true;
                        break;
                    }
                }
                if (hasAnyReferences) break;
            }
        }
        
        // Enable button if references exist either in properties or globally
        proceedToExportBtn.disabled = !hasAnyReferences && allReferences.length === 0;
    }
    
    // Check if a property has item-specific values (not all the same)
    function checkIfHasItemSpecificValues(mapping, fetchedData, reconciliationData) {
        const values = new Set();
        let hasAnyValue = false;
        
        fetchedData.forEach((item, index) => {
            const itemKey = `item-${index}`;
            const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
            
            if (reconciledData?.selectedMatch) {
                hasAnyValue = true;
                const match = reconciledData.selectedMatch;
                if (match.type === 'wikidata') {
                    values.add(match.id);
                } else {
                    values.add(match.value);
                }
            } else if (item[mapping.key] !== undefined && item[mapping.key] !== null) {
                hasAnyValue = true;
                values.add(item[mapping.key]);
            }
        });
        
        // Return true if there are multiple different values (item-specific)
        return hasAnyValue && values.size > 1;
    }
    
    // Show expanded values for a property
    function showExpandedValues(mapping, fetchedData, reconciliationData, containerElement) {
        // Remove any existing expanded values
        hideExpandedValues(containerElement);
        
        // Create expanded values container
        const expandedContainer = createElement('div', {
            className: 'expanded-values-container'
        });
        
        fetchedData.forEach((item, index) => {
            const itemKey = `item-${index}`;
            const reconciledData = reconciliationData[itemKey]?.properties[mapping.key]?.reconciled?.[0];
            const hasOriginalData = item[mapping.key] !== undefined && item[mapping.key] !== null;
            
            if (reconciledData || hasOriginalData) {
                const itemRow = createElement('div', {
                    className: 'expanded-item-row'
                });
                
                const itemLabel = createElement('span', {
                    className: 'expanded-item-label'
                }, `Item ${index + 1}: `);
                itemRow.appendChild(itemLabel);
                
                if (reconciledData?.selectedMatch) {
                    const match = reconciledData.selectedMatch;
                    if (match.type === 'wikidata') {
                        const valueLink = createElement('a', {
                            href: `https://www.wikidata.org/entity/${match.id}`,
                            target: '_blank',
                            className: 'expanded-value-link'
                        }, `${match.label} (${match.id})`);
                        itemRow.appendChild(valueLink);
                    } else {
                        const valueText = createElement('span', {
                            className: 'expanded-value-text'
                        }, match.value || 'Custom value');
                        itemRow.appendChild(valueText);
                    }
                } else if (hasOriginalData) {
                    const valueText = createElement('span', {
                        className: 'expanded-value-text original'
                    }, `Original: ${item[mapping.key]}`);
                    itemRow.appendChild(valueText);
                }
                
                expandedContainer.appendChild(itemRow);
            }
        });
        
        containerElement.appendChild(expandedContainer);
    }
    
    // Hide expanded values
    function hideExpandedValues(containerElement) {
        const expandedContainer = containerElement.querySelector('.expanded-values-container');
        if (expandedContainer) {
            expandedContainer.remove();
        }
    }
}