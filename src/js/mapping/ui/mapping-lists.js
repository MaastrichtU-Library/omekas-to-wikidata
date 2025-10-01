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
    
    // Process keys with detected identifiers - auto-map them (async)
    const autoMappedKeys = [];
    const keysToAddAsNonLinked = [];
    
    // Collect all identifier fields that need auto-mapping
    const identifierFields = regularKeys.filter(keyObj => keyObj.hasIdentifier && keyObj.identifierInfo);
    const nonIdentifierFields = regularKeys.filter(keyObj => !keyObj.hasIdentifier || !keyObj.identifierInfo);
    
    // Process identifier fields concurrently for better performance
    if (identifierFields.length > 0) {
        try {
            const mappingPromises = identifierFields.map(async (keyObj) => {
                // Skip identifiers without a known property ID
                if (keyObj.identifierInfo.propertyId === null) {
                    console.info(
                        `Skipping identifier field '${keyObj.key}': ` +
                        `Detected as ${keyObj.identifierInfo.type} (${keyObj.identifierInfo.label}) ` +
                        `but no property mapping is available. ` +
                        `Sample value: ${JSON.stringify(keyObj.sampleValue)}`
                    );
                    return null;
                }

                // Create an auto-mapping for this identifier field with API constraint fetching
                const mappingObj = await createIdentifierMapping(
                    keyObj.key,
                    keyObj.identifierInfo,
                    keyObj.sampleValue
                );

                // Add the full key data with enhanced property mapping
                return {
                    ...keyObj,
                    property: mappingObj.property,
                    mappingId: state.generateMappingId(keyObj.key, mappingObj.property.id, mappingObj.selectedAtField),
                    mappedAt: mappingObj.mappedAt,
                    autoMapped: true,
                    identifierType: mappingObj.identifierType,
                    displayName: mappingObj.displayName,
                    sampleValue: mappingObj.sampleValue,
                    selectedAtField: mappingObj.selectedAtField,
                    availableFields: mappingObj.availableFields
                };
            });

            // Wait for all auto-mappings to complete and filter out null results
            const completedMappings = (await Promise.all(mappingPromises)).filter(m => m !== null);
            autoMappedKeys.push(...completedMappings);
        } catch (error) {
            console.error('Error during auto-mapping process:', error);
            // Fall back to adding identifier fields as non-linked if auto-mapping fails
            keysToAddAsNonLinked.push(...identifierFields);
        }
    }
    
    // Add non-identifier fields to non-linked keys
    keysToAddAsNonLinked.push(...nonIdentifierFields);
    
    // Add ignored keys to ignored list
    const currentIgnoredKeys = [...updatedState.mappings.ignoredKeys, ...ignoredKeys];
    
    // Add regular keys (without identifiers) and failed auto-mappings to non-linked keys
    const currentNonLinkedKeys = updatedState.mappings.nonLinkedKeys.filter(k => 
        !keyAnalysis.find(ka => ka.key === (k.key || k))
    );
    const allNonLinkedKeys = [...currentNonLinkedKeys, ...keysToAddAsNonLinked];
    
    // Add auto-mapped keys to existing mapped keys
    const allMappedKeys = [...updatedState.mappings.mappedKeys, ...autoMappedKeys];
    
    // Update all mappings atomically
    state.updateMappings(allNonLinkedKeys, allMappedKeys, currentIgnoredKeys);
    
    // If we auto-mapped any keys, show a enhanced message
    if (autoMappedKeys.length > 0) {
        const identifierTypes = [...new Set(autoMappedKeys.map(k => k.identifierType))].join(', ');
        const constraintsFetched = autoMappedKeys.filter(k => k.property.constraintsFetched).length;
        
        showMessage(
            `Auto-mapped ${autoMappedKeys.length} identifier field(s): ${identifierTypes} (${constraintsFetched}/${autoMappedKeys.length} with constraints)`,
            'success',
            6000
        );
    }
    
    // Get final state for UI update
    const finalState = state.getState();
    
    // Populate the UI lists
    populateKeyList(nonLinkedKeysList, finalState.mappings.nonLinkedKeys, 'non-linked');
    populateKeyList(mappedKeysList, finalState.mappings.mappedKeys, 'mapped');
    populateKeyList(ignoredKeysList, finalState.mappings.ignoredKeys, 'ignored');
    
    // Update section counts
    updateSectionCounts(finalState.mappings);
    
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



/**
 * Updates the section counts display
 */
export function updateSectionCounts(mappings) {
    const totalKeys = mappings.nonLinkedKeys.length + mappings.mappedKeys.length + mappings.ignoredKeys.length;
    
    // Update Non-linked Keys section (now first)
    const nonLinkedSection = document.querySelector('.key-sections .section:nth-child(1) summary');
    if (nonLinkedSection) {
        nonLinkedSection.innerHTML = `<span class="section-title">Non-linked Keys</span><span class="section-count">(${mappings.nonLinkedKeys.length}/${totalKeys})</span>`;
    }
    
    // Update Mapped Keys section (now second)
    const mappedSection = document.querySelector('.key-sections .section:nth-child(2) summary');
    if (mappedSection) {
        mappedSection.innerHTML = `<span class="section-title">Mapped Keys</span><span class="section-count">(${mappings.mappedKeys.length}/${totalKeys})</span>`;
    }
    
    // Update Ignored Keys section (now third)
    const ignoredSection = document.querySelector('.key-sections .section:nth-child(3) summary');
    if (ignoredSection) {
        ignoredSection.innerHTML = `<span class="section-title">Ignored Keys</span><span class="section-count">(${mappings.ignoredKeys.length}/${totalKeys})</span>`;
    }
}

/**
 * Checks if a mapping exists for a given property ID
 */
function hasMappingForProperty(keys, propertyId) {
    return keys.some(keyObj => {
        const property = typeof keyObj === 'object' ? keyObj.property : null;
        return property?.id === propertyId;
    });
}

/**
 * Creates a required property placeholder element
 */
function createRequiredPropertyPlaceholder(propertyId, propertyLabel, description) {
    // Create the main container
    const placeholderDisplay = createElement('div', {
        className: 'key-item-compact required-mapping-placeholder'
    });

    // Property name in red
    const propertyName = createElement('span', {
        className: 'required-property-name'
    }, propertyLabel);
    placeholderDisplay.appendChild(propertyName);

    // Arrow separator
    const arrow = createElement('span', {
        className: 'property-info'
    }, ' → ');
    placeholderDisplay.appendChild(arrow);

    // Description text
    const descriptionText = createElement('span', {
        className: 'required-property-description'
    }, description);
    placeholderDisplay.appendChild(descriptionText);

    // Create list item with click handler
    const onClick = propertyId === 'label'
        ? () => window.openModalWithLabelPreselected?.()
        : () => window.openModalWithInstanceOfPreselected?.();

    const li = createListItem(placeholderDisplay, {
        className: 'clickable key-item-clickable-compact required-mapping-item',
        onClick: onClick
    });

    return li;
}

/**
 * Populates a specific key list
 */
export function populateKeyList(listElement, keys, type) {
    if (!listElement) return;

    listElement.innerHTML = '';

    // Add required property placeholders for mapped keys section
    if (type === 'mapped') {
        const hasLabelMapping = hasMappingForProperty(keys, 'label');
        const hasInstanceOfMapping = hasMappingForProperty(keys, 'P31');

        // Add Label placeholder if no label mapping exists
        if (!hasLabelMapping) {
            const labelPlaceholder = createRequiredPropertyPlaceholder(
                'label',
                'Label',
                'Labels are required for all Wikidata items'
            );
            listElement.appendChild(labelPlaceholder);
        }

        // Add Instance of placeholder if no instance of mapping exists
        if (!hasInstanceOfMapping) {
            const instanceOfPlaceholder = createRequiredPropertyPlaceholder(
                'P31',
                'Instance of',
                'Instance of is required for all Wikidata items'
            );
            listElement.appendChild(instanceOfPlaceholder);
        }
    }

    if (!keys.length) {
        // Only show "No mapped keys yet" if there are also no placeholders
        if (type !== 'mapped' || listElement.children.length === 0) {
            const placeholderText = type === 'non-linked'
                ? 'All keys have been processed'
                : type === 'mapped'
                    ? 'No mapped keys yet'
                    : 'No ignored keys';
            const placeholder = createListItem(placeholderText, { isPlaceholder: true });
            listElement.appendChild(placeholder);
        }
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
        
        // Display key name with @ field if present
        const keyDisplayText = keyData.selectedAtField 
            ? `${keyData.key} (${keyData.selectedAtField})`
            : keyData.key;
        const keyName = createElement('span', {
            className: 'key-name-compact'
        }, keyDisplayText);
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
        // For mapped items with mappingId, use mappingId for comparison to allow duplicates
        if (keyData.mappingId && k.mappingId) {
            return k.mappingId !== keyData.mappingId;
        }
        // For items without mappingId, use key comparison (fallback)
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
    const currentState = state.getState();

    // Generate the mapping ID for this key-property combination, including @ field if selected
    const newMappingId = state.generateMappingId(keyData.key, property.id, keyData.selectedAtField);

    // Check if this is an edit of an existing mapping with a different mappingId
    // This can happen when selectedAtField changes from null to a value (e.g., in auto-mapped identifiers)
    const existingMapping = currentState.mappings.mappedKeys.find(k =>
        k.key === keyData.key && k.property?.id === property.id
    );

    if (existingMapping && existingMapping.mappingId && existingMapping.mappingId !== newMappingId) {
        // MappingId has changed - need to migrate transformation blocks
        const oldMappingId = existingMapping.mappingId;
        const transformationBlocks = state.getTransformationBlocks(oldMappingId);

        if (transformationBlocks && transformationBlocks.length > 0) {
            // Migrate each transformation block to the new mappingId
            transformationBlocks.forEach(block => {
                state.addTransformationBlock(newMappingId, block);
            });

            // Remove transformation blocks from old mappingId by clearing the array
            // We can't delete the key directly, so we set it to empty array
            currentState.mappings.transformationBlocks[oldMappingId] = [];
        }
    }

    // Create enhanced key data with property information and mapping ID
    const mappedKey = {
        ...keyData,
        property: property,
        mappingId: newMappingId,
        mappedAt: new Date().toISOString()
    };

    // Use moveKeyToCategory to handle the movement properly
    moveKeyToCategory(mappedKey, 'mapped', state);

    // Publish mapping updated event for reconciliation table updates
    eventSystem.publish(eventSystem.Events.MAPPING_UPDATED, {
        type: 'mapped',
        keyData: mappedKey,
        previousKeyData: keyData,
        property: property,
        mappingId: newMappingId
    });
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