/**
 * Mapping lists UI module
 * Handles the three-column interface management for mapping keys
 * @module mapping/ui/mapping-lists
 */

// Import dependencies
import { eventSystem } from '../../events.js';
import { createElement, createListItem, showMessage } from '../../ui/components.js';
import { extractAndAnalyzeKeys, convertCamelCaseToSpaces, extractSampleValue } from '../core/data-analyzer.js';
import { getCompletePropertyData } from '../../api/wikidata.js';
import { createIdentifierMapping } from '../../utils/identifier-detection.js';
import { processItemsForValueIdentifiers } from '../../utils/value-processor.js';

// Get DOM elements that are used across functions
const nonLinkedKeysList = document.getElementById('non-linked-keys');
const mappedKeysList = document.getElementById('mapped-keys');
const ignoredKeysList = document.getElementById('ignored-keys');
const manualPropertiesList = document.getElementById('manual-properties');
const proceedToReconciliationBtn = document.getElementById('proceed-to-reconciliation');

/**
 * Populates all mapping interface lists with analyzed property data
 */
export async function populateLists(state) {
    const currentState = state.getState();
    
    if (!currentState.fetchedData) {
        return;
    }
    
    // Process value-level identifiers in the fetched data
    const processedData = await processItemsForValueIdentifiers(currentState.fetchedData);
    
    // Update state with processed data (maintains original fetchedData reference)
    if (processedData !== currentState.fetchedData) {
        state.updateState('fetchedData', processedData);
    }
    
    // Analyze all keys from the complete dataset
    const keyAnalysis = await extractAndAnalyzeKeys(processedData);
    
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
    /**
     * Determines if a property key should be automatically ignored
     * 
     * This function implements business rules for automatic property filtering.
     * Certain technical or system properties are not suitable for Wikidata mapping
     * and should be filtered out to reduce interface complexity.
     * 
     * @param {string} key - Property key to evaluate
     * @returns {boolean} True if key should be automatically ignored
     * 
     * @description
     * Auto-ignore criteria:
     * - JSON-LD system properties (@context, @id, @type)
     * - Omeka system properties (o:id, o:resource_class, etc.)
     * - Internal technical fields not relevant to content description
     */
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
    
    // Process keys with detected identifiers - auto-map them
    const autoMappedKeys = [];
    const keysToAddAsNonLinked = [];
    
    regularKeys.forEach(keyObj => {
        if (keyObj.hasIdentifier && keyObj.identifierInfo) {
            // Create an auto-mapping for this identifier field
            const mappingObj = createIdentifierMapping(
                keyObj.key, 
                keyObj.identifierInfo, 
                keyObj.sampleValue
            );
            
            // Add the full key data with property mapping
            const mappedKey = {
                ...keyObj,
                property: mappingObj.property,
                mappingId: state.generateMappingId(keyObj.key, mappingObj.property.id),
                mappedAt: mappingObj.mappedAt,
                autoMapped: true,
                identifierType: mappingObj.identifierType,
                displayName: mappingObj.displayName
            };
            
            autoMappedKeys.push(mappedKey);
        } else {
            keysToAddAsNonLinked.push(keyObj);
        }
    });
    
    // Add ignored keys to ignored list
    const currentIgnoredKeys = [...updatedState.mappings.ignoredKeys, ...ignoredKeys];
    
    // Add regular keys (without identifiers) to non-linked keys
    const currentNonLinkedKeys = updatedState.mappings.nonLinkedKeys.filter(k => 
        !keyAnalysis.find(ka => ka.key === (k.key || k))
    );
    const allNonLinkedKeys = [...currentNonLinkedKeys, ...keysToAddAsNonLinked];
    
    // Add auto-mapped keys to existing mapped keys
    const allMappedKeys = [...updatedState.mappings.mappedKeys, ...autoMappedKeys];
    
    // Update all mappings atomically
    state.updateMappings(allNonLinkedKeys, allMappedKeys, currentIgnoredKeys);
    
    // If we auto-mapped any keys, show a message
    if (autoMappedKeys.length > 0) {
        const identifierTypes = [...new Set(autoMappedKeys.map(k => k.identifierType))].join(', ');
        showMessage(
            `Auto-mapped ${autoMappedKeys.length} identifier field(s): ${identifierTypes}`,
            'success',
            5000
        );
    }
    
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
    autoAddMetadataFields(finalState, state);
    autoAddInstanceOfProperty(finalState, state);
    
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
export async function autoAddMetadataFields(currentState, state) {
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
export async function autoAddInstanceOfProperty(currentState, state) {
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

/**
 * Updates the section counts display
 */
export function updateSectionCounts(mappings) {
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

/**
 * Populates a specific key list
 */
export function populateKeyList(listElement, keys, type) {
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
            onClick: !keyData.notInCurrentDataset ? () => window.openMappingModal(keyData) : null,
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

/**
 * Populates the manual properties list
 */
export function populateManualPropertiesList(listElement, manualProperties) {
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
        
        // Property info section showing required status
        let infoText = '';
        if (manualProp.isRequired) {
            infoText = 'Required';
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
                    window.removeManualPropertyFromUI(manualProp.property.id);
                },
                title: 'Remove this additional property'
            }, '×');
            keyDisplay.appendChild(removeBtn);
        }
        
        // Create list item with standard styling and behavior
        const li = createListItem(keyDisplay, {
            className: 'clickable key-item-clickable-compact',
            onClick: () => window.openManualPropertyEditModal(manualProp),
            title: 'Click to edit this additional property'
        });
        
        listElement.appendChild(li);
    });
}

/**
 * Moves a key to a specific category
 */
export function moveKeyToCategory(keyData, category, state) {
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
    populateLists(state);
    state.markChangesUnsaved();
}

/**
 * Maps a key to a property
 */
export function mapKeyToProperty(keyData, property, state) {
    // Generate the mapping ID for this key-property combination
    const mappingId = state.generateMappingId(keyData.key, property.id);
    
    // Create enhanced key data with property information and mapping ID
    const mappedKey = {
        ...keyData,
        property: property,
        mappingId: mappingId,
        mappedAt: new Date().toISOString()
    };
    
    // Use moveKeyToCategory to handle the movement properly
    moveKeyToCategory(mappedKey, 'mapped', state);
}

/**
 * Moves to the next unmapped key
 */
export function moveToNextUnmappedKey(state) {
    const currentState = state.getState();
    if (currentState.mappings.nonLinkedKeys.length > 0) {
        // Small delay to let UI update, then open next key
        setTimeout(() => {
            const nextKey = currentState.mappings.nonLinkedKeys[0];
            window.openMappingModal(nextKey);
        }, 200);
    }
}