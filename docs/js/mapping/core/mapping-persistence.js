/**
 * Mapping data persistence module
 * Handles saving, loading, and generating mapping configurations
 * @module mapping/core/mapping-persistence
 */

// Import dependencies
import { showMessage, createDownloadLink } from '../../ui/components.js';

/**
 * Generates mapping configuration data for export/saving
 * @param {Object} state - Application state instance
 * @returns {Object} Mapping configuration object
 */
export function generateMappingData(state) {
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

/**
 * Downloads mapping data as a JSON file
 * @param {Object} mappingData - Mapping configuration to download
 */
export function downloadMappingAsJson(mappingData) {
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

/**
 * Loads mapping data from uploaded file and applies to state
 * @param {Object} mappingData - Mapping configuration to load
 * @param {Object} state - Application state instance
 */
export async function loadMappingFromData(mappingData, state) {
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
        return keys.map(key => {
            // Check if this is a custom mapping
            const isCustomMapping = key.key?.startsWith('custom_') || 
                                   key.isCustomProperty === true || 
                                   key.type === 'custom';
            
            return {
                ...key,
                contextMap: key.contextMap ? new Map(Object.entries(key.contextMap)) : new Map(),
                // Skip dataset validation for custom mappings
                notInCurrentDataset: isCustomMapping ? false : !currentDataKeys.has(key.key)
            };
        });
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
    const { populateLists } = await import('../../mapping/ui/mapping-lists.js');
    populateLists(state);
}