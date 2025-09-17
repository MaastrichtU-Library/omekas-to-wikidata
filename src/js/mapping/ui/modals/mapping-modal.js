/**
 * Mapping modal functionality for property selection and configuration
 * Handles the main property mapping modal interface
 * @module mapping/ui/modals/mapping-modal
 */

// Import dependencies
import { createElement } from '../../../ui/components.js';
import { setupPropertySearch, extractEntitySchemaProperties, setupEntitySchemaPropertySelection } from '../../core/property-searcher.js';
import { renderValueTransformationUI } from '../../core/transformation-engine.js';
import { moveKeyToCategory, mapKeyToProperty, moveToNextUnmappedKey } from '../mapping-lists.js';
import { formatSampleValue } from './modal-helpers.js';
import { showMessage } from '../../../ui/components.js';
import { extractAtFieldsFromAllItems, extractAllFieldsFromItems } from '../../core/data-analyzer.js';
import { extractAllFields } from '../../../transformations.js';

/**
 * Search Wikidata items using the wbsearchentities API
 */
async function searchWikidataItems(query, resultsContainer) {
    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }
    
    resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
    
    try {
        const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&type=item&limit=10`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.search || data.search.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No items found</div>';
            return;
        }
        
        // Clear loading message
        resultsContainer.innerHTML = '';
        
        // Display results
        data.search.forEach(item => {
            const resultItem = createElement('div', {
                className: 'wikidata-search-result-item',
                onClick: () => insertWikidataItemReference(item)
            });
            
            const itemLabel = createElement('div', {
                className: 'item-label'
            }, `${item.label} (${item.id})`);
            
            const itemDescription = createElement('div', {
                className: 'item-description'
            }, item.description || 'No description available');
            
            resultItem.appendChild(itemLabel);
            resultItem.appendChild(itemDescription);
            resultsContainer.appendChild(resultItem);
        });
        
    } catch (error) {
        console.error('Error searching Wikidata items:', error);
        resultsContainer.innerHTML = `<div class="search-error">Search failed: ${error.message}</div>`;
    }
}

/**
 * Insert a Wikidata item reference into the compose pattern
 */
function insertWikidataItemReference(item) {
    // Find the compose pattern textarea and insert the Q-ID
    const patternInput = document.querySelector('.pattern-input');
    if (patternInput) {
        const currentPattern = patternInput.value;
        const qidReference = `{{wikidata:${item.id}}}`;
        
        // Insert at cursor position if possible, otherwise append
        if (patternInput.selectionStart !== undefined) {
            const start = patternInput.selectionStart;
            const end = patternInput.selectionEnd;
            patternInput.value = currentPattern.substring(0, start) + qidReference + currentPattern.substring(end);
            patternInput.selectionStart = patternInput.selectionEnd = start + qidReference.length;
        } else {
            patternInput.value = currentPattern + qidReference;
        }
        
        // Trigger input event to update the pattern
        patternInput.dispatchEvent(new Event('input', { bubbles: true }));
        patternInput.focus();
    }
    
    // Show a success message
    showMessage(`Added ${item.label} (${item.id}) to pattern`, 'success', 2000);
}

/**
 * Handle selection of metadata field (Labels, Descriptions, Aliases)
 */
function selectMetadataField(metadataOption) {
    // Clear any existing property selection
    const searchInput = document.getElementById('property-search-input');
    if (searchInput) searchInput.value = '';
    
    const suggestions = document.getElementById('property-suggestions');
    if (suggestions) suggestions.innerHTML = '';
    
    // Remove selected class from all buttons
    document.querySelectorAll('.metadata-select-button').forEach(btn => {
        btn.classList.remove('selected');
        btn.style.borderColor = '#ddd';
        btn.style.background = 'white';
    });
    
    // Add selected class to clicked button
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
        event.currentTarget.style.borderColor = '#3366cc';
        event.currentTarget.style.background = '#e6f0ff';
    }
    
    // Create metadata property object
    const metadataProperty = {
        id: metadataOption.id,
        label: metadataOption.label,
        description: metadataOption.description,
        datatype: 'monolingualtext',
        datatypeLabel: 'Monolingual text',
        isMetadata: true,
        helpUrl: metadataOption.helpUrl
    };
    
    // Store as selected property
    window.currentMappingSelectedProperty = metadataProperty;
    
    // Update the selected property display
    const selectedSection = document.getElementById('selected-property');
    const selectedDetails = document.getElementById('selected-property-details');
    
    if (selectedSection && selectedDetails) {
        selectedSection.style.display = 'block';
        selectedDetails.innerHTML = `
            <div class="property-info metadata-property-info">
                <h3>${metadataOption.icon} ${metadataProperty.label}</h3>
                <p class="property-id">Metadata Field</p>
                <p>${metadataProperty.description}</p>
                <a href="${metadataOption.helpUrl}" target="_blank" rel="noopener">
                    Learn more about ${metadataProperty.label} →
                </a>
                <div class="metadata-notice" style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                    <strong>Note:</strong> This is a metadata field for Wikidata entities. 
                    Values will be treated as language-specific text.
                </div>
            </div>
        `;
    }
    
    // Update datatype display
    const datatypeDisplay = document.getElementById('detected-datatype');
    if (datatypeDisplay) {
        datatypeDisplay.innerHTML = `
            <span class="datatype-label">Monolingual text</span>
        `;
    }
    
    // Show datatype section
    const datatypeSection = document.getElementById('datatype-info-section');
    if (datatypeSection) {
        datatypeSection.style.display = 'block';
    }
}

/**
 * Opens the mapping modal for a key
 */
export function openMappingModal(keyData) {
    // Store keyData globally for modal title updates
    window.currentMappingKeyData = keyData;
    
    // Extract fields once for the entire modal session to optimize performance
    if (keyData && keyData.sampleValue && window.mappingStepState) {
        const currentState = window.mappingStepState.getState();
        
        if (currentState.fetchedData) {
            const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
            
            // Use first item that has any meaningful data (not looking for specific key)
            let fullItemData = items.find(item => {
                return typeof item === 'object' && item !== null && Object.keys(item).length > 0;
            });
            
            if (fullItemData) {
                keyData.extractedFields = extractAllFields(fullItemData);
            }
        }
    }
    
    // Import modal functionality
    import('../../../ui/modal-ui.js').then(({ setupModalUI }) => {
        const modalUI = setupModalUI();
        
        // Create modal content
        const modalContent = createMappingModalContent(keyData);
        
        // Create buttons based on whether this is a custom property or not
        const isCustomProperty = !keyData.key || 
                                keyData.key.trim() === '' || 
                                keyData.key.startsWith('custom_') || 
                                keyData.isCustomProperty === true;
        const buttons = isCustomProperty ? [
            // For custom properties, show simpler button set
            {
                text: 'Cancel',
                type: 'secondary',
                keyboardShortcut: 'Escape',
                callback: () => {
                    modalUI.closeModal();
                }
            },
            {
                text: keyData.key && keyData.key.startsWith('custom_') ? 'Update Property' : 'Add Property',
                type: 'primary',
                keyboardShortcut: 'Enter',
                callback: () => {
                    console.log('[SAVE] Add/Update Property clicked');
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        console.log('[SAVE] Selected property:', selectedProperty);
                        
                        // For custom properties, create or update the key data
                        const customKeyData = {
                            ...keyData,
                            key: keyData.key || `custom_${selectedProperty.id}`,
                            type: 'custom',
                            frequency: keyData.frequency || 1,
                            totalItems: keyData.totalItems || 1,
                            isCustomProperty: true,
                            isMetadata: selectedProperty.isMetadata || false
                        };
                        
                        console.log('[SAVE] Custom key data:', customKeyData);
                        
                        // Transfer compose transformation data from current mappingId to final mappingId if needed
                        const finalMappingId = window.mappingStepState.generateMappingId(customKeyData.key, selectedProperty.id);
                        const composeSection = document.querySelector('.compose-section');
                        const currentMappingId = composeSection?.dataset?.mappingId;
                        
                        console.log('[SAVE] MappingId transfer:', {
                            currentMappingId,
                            finalMappingId,
                            needsTransfer: currentMappingId && currentMappingId !== finalMappingId
                        });
                        
                        if (currentMappingId && currentMappingId !== finalMappingId) {
                            const currentState = window.mappingStepState.getState();
                            const currentBlocks = currentState.mappings?.transformationBlocks?.[currentMappingId] || [];
                            
                            console.log('[SAVE] Transferring blocks:', {
                                from: currentMappingId,
                                to: finalMappingId,
                                blocks: currentBlocks
                            });
                            
                            // Transfer transformation blocks from current to final mappingId
                            currentBlocks.forEach(block => {
                                console.log('[SAVE] Transferring block:', block);
                                window.mappingStepState.addTransformationBlock(finalMappingId, block);
                            });
                            
                            // Clean up current mappingId if it was temporary
                            if (currentMappingId.startsWith('temp_') && currentState.mappings?.transformationBlocks) {
                                console.log('[SAVE] Deleting temporary mappingId:', currentMappingId);
                                delete currentState.mappings.transformationBlocks[currentMappingId];
                            }
                        }
                        
                        console.log('[SAVE] Calling mapKeyToProperty with:', {
                            customKeyData,
                            selectedProperty
                        });
                        
                        mapKeyToProperty(customKeyData, selectedProperty, window.mappingStepState);
                        
                        // Check final state
                        const finalState = window.mappingStepState.getState();
                        console.log('[SAVE] Final state after save:', {
                            mappedKeys: finalState.mappings.mappedKeys,
                            transformationBlocks: finalState.mappings?.transformationBlocks?.[finalMappingId]
                        });
                        
                        modalUI.closeModal();
                        showMessage(keyData.key ? 'Custom property updated successfully' : 'Custom property added successfully', 'success', 3000);
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            }
        ] : [
            {
                text: 'Ignore',
                type: 'secondary',
                keyboardShortcut: 'i',
                callback: () => {
                    moveKeyToCategory(keyData, 'ignored', window.mappingStepState);
                    modalUI.closeModal();
                }
            },
            {
                text: 'Ignore and Next',
                type: 'secondary',
                keyboardShortcut: 'x',
                callback: () => {
                    moveKeyToCategory(keyData, 'ignored', window.mappingStepState);
                    modalUI.closeModal();
                    moveToNextUnmappedKey(window.mappingStepState);
                }
            },
            {
                text: 'Confirm',
                type: 'secondary',
                keyboardShortcut: 'c',
                callback: () => {
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        modalUI.closeModal();
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            },
            {
                text: 'Confirm and Duplicate',
                type: 'secondary',
                keyboardShortcut: 'd',
                callback: () => {
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        // Save the current mapping
                        mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        modalUI.closeModal();
                        
                        // Open a new modal for the same key with reset configuration
                        setTimeout(() => {
                            // Create a fresh keyData object for the duplicate
                            const duplicateKeyData = {
                                ...keyData,
                                selectedAtField: undefined,  // Reset @ field selection
                                selectedTransformationField: undefined,  // Reset transformation
                                isDuplicate: true  // Mark as duplicate
                            };
                            openMappingModal(duplicateKeyData);
                        }, 100);
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
                        mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        modalUI.closeModal();
                        moveToNextUnmappedKey(window.mappingStepState);
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            }
        ];
        
        // Open modal with mapping relationship header
        const modalTitle = isCustomProperty ? 'Select Value' : createMappingRelationshipTitle(keyData.key, null);
        modalUI.openModal(
            modalTitle,
            modalContent,
            buttons,
            () => {
                // Remove the wide class when modal closes
                const modal = document.querySelector('.modal');
                if (modal) {
                    modal.classList.remove('mapping-modal-wide');
                }
            }
        );
        
        // Add class to modal for wider display after opening
        setTimeout(() => {
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.classList.add('mapping-modal-wide');
            }
        }, 0);
    });
}

/**
 * Creates mapping modal content with two-column layout
 */
export function createMappingModalContent(keyData) {
    // Check if this is a metadata property (labels, descriptions, aliases)
    const isMetadata = keyData.isMetadata || ['label', 'description', 'aliases'].includes(keyData.key?.toLowerCase());
    
    // Check if this is a custom property (empty key OR custom key from previous saves)
    const isCustomProperty = !keyData.key || 
                            keyData.key.trim() === '' || 
                            keyData.key.startsWith('custom_') || 
                            keyData.isCustomProperty === true;
    
    const container = createElement('div', {
        className: 'mapping-modal-content two-column-layout'
    });
    
    // Add duplicate notice if this is a duplicate mapping
    if (keyData.isDuplicate) {
        const duplicateNotice = createElement('div', {
            className: 'duplicate-notice'
        });
        duplicateNotice.innerHTML = `
            <div class="duplicate-notice-content">
                <strong>Creating duplicate mapping for:</strong> ${keyData.key}
                <p>Select a different @ field or property to create an additional mapping for this key.</p>
            </div>
        `;
        container.appendChild(duplicateNotice);
    }
    
    // LEFT COLUMN - Omeka S Data (or empty for custom properties)
    const leftColumn = createElement('div', {
        className: 'mapping-column left-column'
    });
    
    if (isCustomProperty) {
        // For custom properties, rebrand as "Custom Value" section
        const leftHeader = createElement('div', {
            className: 'column-header'
        }, 'Custom Value');
        leftColumn.appendChild(leftHeader);
        
        // Compose transformation section
        const composeSection = createElement('div', {
            className: 'compose-section'
        });
        
        const composeHeader = createElement('h4', {}, 'Value Composition');
        composeSection.appendChild(composeHeader);
        
        const composeDescription = createElement('p', {
            className: 'compose-description'
        }, 'Create complex values by combining text and variables from your data fields.');
        composeSection.appendChild(composeDescription);
        
        // Create or load existing transformation block for compose functionality
        let composeBlock;
        let existingPattern = null;
        
        // Check for existing transformation data in multiple locations
        if (window.mappingStepState) {
            const currentState = window.mappingStepState.getState();
            const possibleMappingIds = [];
            
            console.log('[MODAL] Looking for existing compose blocks for custom property:', {
                keyData,
                currentStateTransformationBlocks: currentState.mappings?.transformationBlocks
            });
            
            // Build list of possible mappingIds to check for existing patterns
            if (keyData.key && keyData.property) {
                // Final mappingId for saved custom properties
                const finalMappingId = window.mappingStepState.generateMappingId(keyData.key, keyData.property.id);
                possibleMappingIds.push(finalMappingId);
                console.log('[MODAL] Adding final mappingId:', finalMappingId);
            }
            if (keyData.key) {
                // Temporary mappingId for custom properties being edited
                const tempMappingId = `temp_${keyData.key}`;
                possibleMappingIds.push(tempMappingId);
                console.log('[MODAL] Adding temp mappingId:', tempMappingId);
            }
            // Always check the general temporary ID
            possibleMappingIds.push('temp_custom_property');
            
            console.log('[MODAL] Checking possible mappingIds:', possibleMappingIds);
            
            // Look for existing compose blocks in any of these locations
            for (const mappingId of possibleMappingIds) {
                const existingBlocks = currentState.mappings?.transformationBlocks?.[mappingId] || [];
                const existingComposeBlock = existingBlocks.find(block => block.type === 'compose');
                
                console.log('[MODAL] Checking mappingId:', mappingId, 'found blocks:', existingBlocks);
                
                if (existingComposeBlock && existingComposeBlock.config.pattern) {
                    console.log('[MODAL] Found existing compose block with pattern:', {
                        mappingId,
                        pattern: existingComposeBlock.config.pattern,
                        fullBlock: existingComposeBlock
                    });
                    // Use the existing block but ensure sourceData is updated
                    composeBlock = {
                        ...existingComposeBlock,
                        config: {
                            ...existingComposeBlock.config,
                            // Preserve pattern but update sourceData with latest data
                            sourceData: existingComposeBlock.config.sourceData || {}
                        }
                    };
                    existingPattern = existingComposeBlock.config.pattern;
                    break;
                }
            }
            
            if (!composeBlock) {
                console.log('[MODAL] No existing compose block found, will create new one');
            }
        }
        
        // If no existing block found, create a new one with sourceData
        if (!composeBlock) {
            // Get source data from the current state
            let sourceData = {};
            if (window.mappingStepState) {
                const currentState = window.mappingStepState.getState();
                if (currentState.fetchedData) {
                    const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
                    sourceData = items.find(item => typeof item === 'object' && item !== null && Object.keys(item).length > 0) || {};
                }
            }
            
            composeBlock = {
                id: 'custom-compose',
                type: 'compose',
                config: {
                    pattern: existingPattern || '{{value}}', // Default to {{value}} instead of placeholder text
                    sourceData: sourceData // Include source data for field replacements
                }
            };
        }
        
        // Create mappingId for custom properties
        let mappingId;
        if (keyData.key && keyData.property) {
            // For existing custom properties with a selected property, use the real mappingId
            mappingId = window.mappingStepState.generateMappingId(keyData.key, keyData.property.id);
        } else if (keyData.key) {
            // For existing custom properties without a property selected yet, use temp mappingId
            mappingId = `temp_${keyData.key}`;
        } else {
            // For completely new custom properties
            mappingId = 'temp_custom_property';
        }
        
        console.log('[MODAL] Using mappingId for compose section:', mappingId);
        
        // Add the compose block to the transformation state if it's not already there
        const currentState = window.mappingStepState.getState();
        const existingBlocks = currentState.mappings?.transformationBlocks?.[mappingId] || [];
        const hasExistingComposeBlock = existingBlocks.find(block => block.id === composeBlock.id);
        
        console.log('[MODAL] Before adding block:', {
            mappingId,
            hasExistingComposeBlock,
            existingBlocks,
            composeBlock
        });
        
        if (!hasExistingComposeBlock) {
            console.log('[MODAL] Adding compose block to state with mappingId:', mappingId);
            window.mappingStepState.addTransformationBlock(mappingId, composeBlock);
            
            // Verify it was added
            const afterAddState = window.mappingStepState.getState();
            const afterAddBlocks = afterAddState.mappings?.transformationBlocks?.[mappingId];
            console.log('[MODAL] After adding block, state blocks:', afterAddBlocks);
        } else {
            console.log('[MODAL] Compose block already exists in state, not adding');
        }
        
        // Import the compose config UI
        import('../../core/transformation-engine.js').then(({ renderComposeConfigUI }) => {
            const composeUI = renderComposeConfigUI(mappingId, composeBlock, window.mappingStepState);
            composeSection.appendChild(composeUI);
            
            // Store the mappingId for later use
            composeSection.dataset.mappingId = mappingId;
        });
        
        leftColumn.appendChild(composeSection);
        
        // Wikidata Item Search section
        const itemSearchSection = createElement('div', {
            className: 'wikidata-item-search-section',
            style: 'margin-top: 20px;'
        });
        
        const itemSearchHeader = createElement('h4', {}, 'Wikidata Item Search');
        itemSearchSection.appendChild(itemSearchHeader);
        
        const itemSearchDescription = createElement('p', {
            className: 'search-description'
        }, 'Search for Wikidata items to use as values or references.');
        itemSearchSection.appendChild(itemSearchDescription);
        
        const itemSearchInput = createElement('input', {
            type: 'text',
            placeholder: 'Search Wikidata items (e.g., "Albert Einstein")...',
            className: 'wikidata-item-search-input',
            onInput: (e) => {
                if (e.target.value.trim().length > 2) {
                    searchWikidataItems(e.target.value.trim(), itemSearchResults);
                } else {
                    itemSearchResults.innerHTML = '';
                }
            }
        });
        itemSearchSection.appendChild(itemSearchInput);
        
        const itemSearchResults = createElement('div', {
            className: 'wikidata-item-search-results'
        });
        itemSearchSection.appendChild(itemSearchResults);
        
        leftColumn.appendChild(itemSearchSection);
    } else {
        // Column header
        const leftHeader = createElement('div', {
            className: 'column-header'
        }, 'Omeka S Data');
        leftColumn.appendChild(leftHeader);
        
        // Key information section
        const keyInfo = createElement('div', {
            className: 'key-info'
        });
    
    const keyDisplay = keyData.linkedDataUri 
        ? `<a href="${keyData.linkedDataUri}" target="_blank" class="clickable-key">${keyData.key}</a>`
        : keyData.key;
    
    // Basic key info (always visible)
    const basicInfo = createElement('div', {});
    basicInfo.innerHTML = `
        <h4>Key Information</h4>
        <p><strong>Key:</strong> ${keyDisplay}</p>
        <p><strong>Frequency:</strong> ${keyData.frequency || 1} out of ${keyData.totalItems || 1} items</p>
    `;
    keyInfo.appendChild(basicInfo);
    
    // Field selector section (for JSON-LD fields - both @ fields and regular fields)
    const atFieldSection = createElement('div', {
        className: 'at-field-section'
    });
    
    // Check if this key has fields across all items
    const currentState = window.mappingStepState.getState();
    if (currentState.fetchedData) {
        const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
        const fieldGroups = extractAllFieldsFromItems(keyData.key, items);
        
        if (fieldGroups.length > 0) {
            const atFieldLabel = createElement('label', {
                className: 'at-field-label'
            }, 'Original Key Field:');
            
            const atFieldSelect = createElement('select', {
                className: 'at-field-select',
                id: `at-field-select-${keyData.key.replace(/[^a-zA-Z0-9]/g, '_')}`,
                onChange: (e) => {
                    // Store the selected field in the keyData for later use
                    keyData.selectedAtField = e.target.value;
                    
                    // Update sample values if they're already loaded
                    const samplesContent = document.querySelector('.samples-content');
                    if (samplesContent && samplesContent.hasChildNodes()) {
                        loadSampleValues(samplesContent, keyData, window.mappingStepState);
                    }
                }
            });
            
            // Set default selection to @id if available, then @value, then first option
            let defaultField = null;
            
            // Find default field from all groups
            for (const group of fieldGroups) {
                const idField = group.fields.find(field => field.key === '@id');
                const valueField = group.fields.find(field => field.key === '@value');
                
                if (idField) {
                    defaultField = idField;
                    break;
                } else if (valueField && !defaultField) {
                    defaultField = valueField;
                }
            }
            
            // If no @ fields found, use first field
            if (!defaultField && fieldGroups[0] && fieldGroups[0].fields.length > 0) {
                defaultField = fieldGroups[0].fields[0];
            }
            
            // Store the default selection
            if (defaultField) {
                keyData.selectedAtField = defaultField.key;
            }
            
            // Populate options with optgroups for each object structure
            fieldGroups.forEach((group, groupIndex) => {
                if (group.fields.length === 0) return;
                
                // Create optgroup for this object structure
                const optGroup = createElement('optgroup', {
                    label: fieldGroups.length > 1 ? `Object Type ${groupIndex + 1}` : 'Available Fields'
                });
                
                // Add fields to optgroup
                group.fields.forEach(field => {
                    const option = createElement('option', {
                        value: field.key,
                        selected: defaultField && field.key === defaultField.key
                    }, `${field.key}: ${field.preview}`);
                    optGroup.appendChild(option);
                });
                
                atFieldSelect.appendChild(optGroup);
            });
            
            atFieldSection.appendChild(atFieldLabel);
            atFieldSection.appendChild(atFieldSelect);
            keyInfo.appendChild(atFieldSection);
        }
    }
    
    // Sample values section (collapsible)
    const samplesSection = createElement('div', {
        className: 'samples-section'
    });
    
    // Sample toggle button
    const samplesToggle = createElement('button', {
        className: 'samples-toggle',
        onClick: () => {
            const isExpanded = samplesSection.classList.contains('expanded');
            if (isExpanded) {
                samplesSection.classList.remove('expanded');
                samplesToggle.textContent = '▶ Show Sample Values';
            } else {
                samplesSection.classList.add('expanded');
                samplesToggle.textContent = '▼ Hide Sample Values';
                
                // Load samples if not already loaded
                if (!samplesContent.hasChildNodes()) {
                    loadSampleValues(samplesContent, keyData, window.mappingStepState);
                }
            }
        }
    }, '▶ Show Sample Values');
    
    samplesSection.appendChild(samplesToggle);
    
    // Collapsible samples content
    const samplesContent = createElement('div', {
        className: 'samples-content'
    });
    
    samplesSection.appendChild(samplesContent);
    keyInfo.appendChild(samplesSection);
    leftColumn.appendChild(keyInfo);
    
    // Value transformation section (Stage 3) - Collapsible
    const transformationSection = createElement('div', {
        className: 'transformation-section',
        style: 'margin-top: 20px;'
    });
    
    // Toggle button for transformation section
    const transformationToggle = createElement('button', {
        className: 'transformation-toggle',
        onClick: () => {
            const isExpanded = transformationSection.classList.contains('expanded');
            if (isExpanded) {
                transformationSection.classList.remove('expanded');
                transformationToggle.textContent = '▶ Add Transformation';
            } else {
                transformationSection.classList.add('expanded');
                transformationToggle.textContent = '▼ Hide Transformations';
                
                // For metadata fields, ensure compose transformation is added by default
                if (isMetadata) {
                    const composeContainer = document.querySelector('.transformation-blocks');
                    if (composeContainer && !composeContainer.hasChildNodes()) {
                        // Add a default compose block for metadata
                        const addComposeBtn = document.querySelector('.add-compose-btn');
                        if (addComposeBtn) {
                            addComposeBtn.click();
                        }
                    }
                }
            }
        }
    }, '▶ Add Transformation');
    
    transformationSection.appendChild(transformationToggle);
    
    // Collapsible content container
    const transformationContent = createElement('div', {
        className: 'transformation-content'
    });
    
    const transformationHeader = createElement('h4', {}, 'Value Transformation');
    transformationContent.appendChild(transformationHeader);
    
    const valueTransformationContainer = renderValueTransformationUI(keyData, window.mappingStepState);
    transformationContent.appendChild(valueTransformationContainer);
    
    transformationSection.appendChild(transformationContent);
        leftColumn.appendChild(transformationSection);
    }
    
    container.appendChild(leftColumn);
    
    // RIGHT COLUMN - Wikidata Property
    const rightColumn = createElement('div', {
        className: 'mapping-column right-column'
    });
    
    // Column header with link to Wikidata help page
    const rightHeaderText = isMetadata ? 
        `<a href="https://www.wikidata.org/wiki/Help:Label" target="_blank" rel="noopener">Wikidata ${keyData.key || 'Property'}</a>` : 
        'Wikidata Property';
    const rightHeader = createElement('div', {
        className: 'column-header'
    });
    rightHeader.innerHTML = rightHeaderText;
    rightColumn.appendChild(rightHeader);
    
    // Property search section or metadata information
    const searchSection = createElement('div', {
        className: 'property-search'
    });
    
    if (isMetadata) {
        // For metadata properties, show information instead of search
        const metadataType = keyData.key?.toLowerCase();
        let helpUrl, helpText, description;
        
        switch(metadataType) {
            case 'label':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Label';
                helpText = 'Labels';
                description = 'Labels are the main name given to identify an entity. They do not need to be unique. In Wikidata, labels are language-specific.';
                break;
            case 'description':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Description';
                helpText = 'Descriptions';
                description = 'Descriptions are short phrases that disambiguate items with similar labels. They are language-specific and should be lowercase except for proper nouns.';
                break;
            case 'aliases':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Aliases';
                helpText = 'Aliases';
                description = 'Aliases are alternative names for an entity. They help people find items even if they search for a name that is different from the label.';
                break;
            default:
                helpUrl = 'https://www.wikidata.org/wiki/Help:Label';
                helpText = 'Metadata';
                description = 'This is a metadata field for Wikidata entities.';
        }
        
        searchSection.innerHTML = `
            <div class="metadata-info">
                <h4>${helpText} Information</h4>
                <p>${description}</p>
                <p><a href="${helpUrl}" target="_blank" rel="noopener">Learn more about ${helpText} on Wikidata →</a></p>
                <div class="metadata-notice">
                    <strong>Note:</strong> ${helpText} are language-specific monolingual text values. You can map your Omeka S data to provide ${metadataType} values for Wikidata entities.
                </div>
            </div>
        `;
    } else {
        // For custom properties, add metadata quick select buttons
        if (isCustomProperty) {
            // Add metadata quick select buttons
            const metadataButtonsSection = createElement('div', {
                className: 'metadata-buttons-section',
                style: 'margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; border: 1px solid #e0e0e0;'
            });
            
            const metadataHeader = createElement('h4', {
                style: 'margin-bottom: 10px;'
            }, 'Quick Select Metadata Fields');
            
            const metadataDescription = createElement('p', {
                style: 'margin-bottom: 15px; font-size: 0.9em; color: #666;'
            }, 'Select one of these to map your data to Wikidata entity metadata:');
            
            const buttonsContainer = createElement('div', {
                className: 'metadata-buttons-grid',
                style: 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;'
            });
            
            // Create metadata buttons
            const metadataOptions = [
                {
                    id: 'label',
                    label: 'Labels',
                    icon: '🏷️',
                    description: 'Main name for entities',
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Label'
                },
                {
                    id: 'description',
                    label: 'Descriptions',
                    icon: '📝',
                    description: 'Short disambiguating phrases',
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Description'
                },
                {
                    id: 'aliases',
                    label: 'Aliases',
                    icon: '🔄',
                    description: 'Alternative names',
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Aliases'
                }
            ];
            
            metadataOptions.forEach(option => {
                const button = createElement('button', {
                    className: 'metadata-select-button',
                    style: `
                        padding: 12px;
                        border: 2px solid #ddd;
                        background: white;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: all 0.2s;
                        text-align: center;
                    `,
                    onClick: () => selectMetadataField(option),
                    onMouseOver: (e) => {
                        if (!e.target.classList.contains('selected')) {
                            e.target.style.borderColor = '#3366cc';
                            e.target.style.background = '#f0f4ff';
                        }
                    },
                    onMouseOut: (e) => {
                        if (!e.target.classList.contains('selected')) {
                            e.target.style.borderColor = '#ddd';
                            e.target.style.background = 'white';
                        }
                    }
                });
                
                button.innerHTML = `
                    <div style="font-size: 1.5em; margin-bottom: 5px;">${option.icon}</div>
                    <div style="font-weight: bold; margin-bottom: 3px;">${option.label}</div>
                    <div style="font-size: 0.8em; color: #666;">${option.description}</div>
                `;
                
                buttonsContainer.appendChild(button);
            });
            
            metadataButtonsSection.appendChild(metadataHeader);
            metadataButtonsSection.appendChild(metadataDescription);
            metadataButtonsSection.appendChild(buttonsContainer);
            searchSection.appendChild(metadataButtonsSection);
            
            // Add divider
            const divider = createElement('div', {
                style: 'margin: 20px 0; border-bottom: 1px solid #ddd; position: relative;'
            });
            
            const orLabel = createElement('span', {
                style: `
                    position: absolute;
                    top: -10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: white;
                    padding: 0 10px;
                    color: #999;
                `
            }, 'OR');
            
            divider.appendChild(orLabel);
            searchSection.appendChild(divider);
        }
        
        // Check if entity schema is selected to conditionally add dropdown
        const schemaState = window.mappingStepState?.getState();
        const selectedSchema = schemaState?.selectedEntitySchema;
        const hasEntitySchemaProperties = selectedSchema?.properties && 
            (selectedSchema.properties.required?.length > 0 || selectedSchema.properties.optional?.length > 0);
        
        const entitySchemaDropdownHTML = hasEntitySchemaProperties ? `
            <div class="entity-schema-properties" id="entity-schema-properties">
                <label for="entity-schema-property-select">Properties from Entity Schema:</label>
                <select class="entity-schema-property-select" id="entity-schema-property-select">
                    <option value="">Select a property from schema...</option>
                </select>
                <small class="schema-indicator">These properties are recommended by the selected entity schema</small>
            </div>
        ` : '';
        
        const regularSearchHTML = `
            ${entitySchemaDropdownHTML}
            <h4>Search Properties</h4>
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
        
        // Create a container div for the regular search HTML
        const regularSearchContainer = createElement('div');
        regularSearchContainer.innerHTML = regularSearchHTML;
        searchSection.appendChild(regularSearchContainer);
    }
    rightColumn.appendChild(searchSection);
    
    // Data type information section (Stage 2 content)
    const dataTypeInfo = createElement('div', {
        className: 'datatype-info',
        id: 'datatype-info-section',
        style: isMetadata ? 'margin-top: 20px;' : 'margin-top: 20px; display: none;'
    });
    
    if (isMetadata) {
        // For metadata, always show monolingual text type
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Expected Value Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <span class="datatype-label">Monolingual text</span>
                </div>
                <div class="datatype-description">
                    <p>This field expects language-specific text values. Each value should be associated with a language code (e.g., "en" for English, "fr" for French).</p>
                </div>
            </div>
        `;
    } else {
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Expected Value Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <div class="datatype-loading">Select a property to see expected type...</div>
                </div>
            </div>
        `;
    }
    rightColumn.appendChild(dataTypeInfo);
    
    container.appendChild(rightColumn);
    
    // Setup search functionality and pre-populate if mapped (only for non-metadata)
    if (!isMetadata) {
        setTimeout(() => {
            setupPropertySearch(keyData, window.mappingStepState);
            // Setup entity schema property dropdown if it exists
            setupEntitySchemaPropertySelection(window.mappingStepState);
        }, 100);
    } else {
        // For metadata properties, store them as selected automatically
        window.currentMappingSelectedProperty = {
            id: keyData.key?.toLowerCase(),
            label: keyData.key,
            description: `${keyData.key} for Wikidata entities`,
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text',
            isMetadata: true
        };
    }
    
    return container;
}

/**
 * Load sample values for the collapsible samples section
 */
function loadSampleValues(container, keyData, state) {
    const currentState = state.getState();
    if (!currentState.fetchedData) {
        container.innerHTML = '<div class="no-samples">No sample data available</div>';
        return;
    }
    
    const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
    const samples = [];
    const maxSamples = 5;
    
    // Extract up to 5 sample values for this key
    for (const item of items) {
        if (samples.length >= maxSamples) break;
        if (item[keyData.key] !== undefined) {
            let valueToFormat = item[keyData.key];
            
            // If a specific @ field is selected, extract that field's value
            if (keyData.selectedAtField) {
                const keyValue = item[keyData.key];
                const valuesToProcess = Array.isArray(keyValue) ? keyValue : [keyValue];
                
                // Look for the selected @ field in the first available value
                for (const value of valuesToProcess) {
                    if (value && typeof value === 'object' && value[keyData.selectedAtField] !== undefined) {
                        valueToFormat = value[keyData.selectedAtField];
                        break;
                    }
                }
            }
            
            const sampleHtml = formatSampleValue(valueToFormat, keyData.contextMap || new Map());
            samples.push(sampleHtml);
        }
    }
    
    if (samples.length === 0) {
        container.innerHTML = '<div class="no-samples">No sample values found</div>';
        return;
    }
    
    // Display samples
    const samplesHtml = samples.map((sample, index) => `
        <div class="sample-item">
            <strong>Sample ${index + 1}:</strong> ${sample}
        </div>
    `).join('');
    
    container.innerHTML = samplesHtml;
}

/**
 * Get selected property from modal
 */
export function getSelectedPropertyFromModal() {
    // For metadata properties, ensure the property is properly formatted
    const property = window.currentMappingSelectedProperty;
    if (property && property.isMetadata) {
        // Ensure metadata properties have the correct structure
        return {
            ...property,
            id: property.id || property.label?.toLowerCase(),
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text'
        };
    }
    return property;
}

/**
 * Create mapping relationship title with arrow
 */
function createMappingRelationshipTitle(keyName, property) {
    const sourceSpan = `<span class="mapping-source">${keyName}</span>`;
    const arrow = `<span class="mapping-arrow">→</span>`;
    const targetSpan = property 
        ? `<span class="mapping-target clickable" data-property-id="${property.id}" title="View on Wikidata" style="cursor: pointer; text-decoration: underline;">${property.label} (${property.id})</span>`
        : `<span class="mapping-target unmapped">unmapped</span>`;
    
    return `<div class="mapping-relationship-header">${sourceSpan}${arrow}${targetSpan}</div>`;
}

/**
 * Update the modal title to show the mapping relationship
 */
export function updateModalTitle(property) {
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle && window.currentMappingKeyData) {
        const keyName = window.currentMappingKeyData.key || 'Key';
        const titleHtml = createMappingRelationshipTitle(keyName, property);
        modalTitle.innerHTML = titleHtml;
        
        // Make the target property clickable
        const targetSpan = modalTitle.querySelector('.mapping-target.clickable');
        if (targetSpan) {
            targetSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                const propertyId = targetSpan.dataset.propertyId;
                if (propertyId) {
                    window.open(`https://www.wikidata.org/wiki/Property:${propertyId}`, '_blank');
                }
            });
        }
    }
}

/**
 * Update Stage 2 summary to show detected data type
 */
export function updateStage2Summary(property) {
    // In two-column layout, update the datatype section visibility and content
    const datatypeSection = document.getElementById('datatype-info-section');
    const datatypeDisplay = document.getElementById('detected-datatype');
    
    if (datatypeSection && datatypeDisplay && property && property.datatypeLabel) {
        datatypeSection.style.display = 'block';
        datatypeDisplay.innerHTML = `
            <div class="datatype-item">
                <strong>Type:</strong> ${property.datatypeLabel}
            </div>
        `;
    }
}