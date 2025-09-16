/**
 * Reconciliation Data Processing Module
 * Handles data structures, initialization, and data processing for reconciliation
 * @module reconciliation/core/reconciliation-data
 */

import { getMockItemsData, getMockMappingData } from '../../data/mock-data.js';
import { applyTransformationChain } from '../../transformations.js';

/**
 * Calculates total reconciliable cells for accurate progress tracking
 * 
 * This function performs sophisticated analysis of the data structure to determine
 * exactly how many individual property values need reconciliation. The calculation
 * is critical for:
 * - Accurate progress reporting during batch processing
 * - Resource planning and performance estimation
 * - User expectation management for large datasets
 */
export function calculateTotalReconciliableCells(data, mappedKeys, manualProperties = []) {
    let total = 0;
    data.forEach(item => {
        // Count mapped property cells
        mappedKeys.forEach(keyObj => {
            // Pass the full keyObj to extractPropertyValues to handle @ field selection
            const values = extractPropertyValues(item, keyObj);
            total += values.length;
        });
        
        // Count manual property cells (each manual property counts as 1 cell per item)
        total += manualProperties.length;
    });
    return total;
}

/**
 * Extracts property values from Omeka S items with comprehensive format handling
 * 
 * Omeka S stores property values in various complex formats depending on the
 * property type, resource relationships, and export configuration. This function
 * normalizes all these formats into consistent string arrays for reconciliation.
 * 
 * Supported value formats:
 * - Simple strings and primitives
 * - Arrays of value objects with @value annotations
 * - Resource references with o:label properties
 * - Mixed arrays containing different value types
 * - Nested objects with various value properties
 * - JSON-LD @ fields (e.g., @id, @value, @type) for duplicate mappings
 * 
 * @param {Object} item - Single Omeka S item object
 * @param {string|Object} keyOrKeyObj - Property key or key object with selectedAtField
 * @param {Object} [state] - Optional state object to apply transformations
 * @returns {Array<string>} Array of normalized string values for reconciliation (transformed if transformations exist)
 * 
 * @example
 * // Omeka S multi-value property:
 * extractPropertyValues(item, "dcterms:subject");
 * // Input: [{"@value": "Art"}, {"o:label": "History"}]
 * // Output: ["Art", "History"]
 * 
 * // With @ field selection:
 * extractPropertyValues(item, {key: "schema:itemLocation", selectedAtField: "@id"});
 * // Input: [{"@id": "http://example.org/loc1", "@value": "Location 1"}]
 * // Output: ["http://example.org/loc1"]
 * 
 * // With transformations (state provided):
 * extractPropertyValues(item, keyObj, state);
 * // Output: Values after applying configured transformations
 * 
 * @description
 * The normalization process is essential because Wikidata reconciliation
 * requires consistent string representations of values. The function prioritizes
 * human-readable labels (o:label) over technical values (@value) when both exist.
 * 
 * When a state object is provided, the function will also check for and apply
 * any configured transformations before returning the values.
 */
export function extractPropertyValues(item, keyOrKeyObj, state = null) {
    // Handle both string keys and key objects
    let key, selectedAtField;
    if (typeof keyOrKeyObj === 'object' && keyOrKeyObj.key) {
        key = keyOrKeyObj.key;
        selectedAtField = keyOrKeyObj.selectedAtField;
    } else {
        key = keyOrKeyObj;
    }
    
    const value = item[key];
    if (!value) return [];
    
    // Helper function to extract value from a single object
    const extractFromObject = (v) => {
        // If a specific @ field is selected, ONLY return that field's value
        if (selectedAtField) {
            if (typeof v === 'object' && v[selectedAtField] !== undefined) {
                return String(v[selectedAtField]);
            } else {
                // Don't fall back to default extraction when a specific @ field is requested
                // Return null to indicate this object doesn't have the requested field
                return null;
            }
        }
        
        // Default extraction logic (only when no specific @ field is selected)
        if (typeof v === 'object' && v['o:label']) {
            return v['o:label'];
        } else if (typeof v === 'object' && v['@value']) {
            return v['@value'];
        } else if (typeof v === 'string') {
            return v;
        } else {
            return String(v);
        }
    };
    
    // Handle different data structures
    let extractedValues;
    if (Array.isArray(value)) {
        // Filter out null values to only include objects that have the requested @ field
        extractedValues = value.map(v => extractFromObject(v)).filter(v => v !== null);
    } else {
        const extracted = extractFromObject(value);
        extractedValues = extracted !== null ? [extracted] : [];
    }
    
    // Apply transformations if state is provided
    if (state && extractedValues.length > 0) {
        try {
            // Get property information for generating mapping ID
            let propertyId;
            if (typeof keyOrKeyObj === 'object' && keyOrKeyObj.property && keyOrKeyObj.property.id) {
                propertyId = keyOrKeyObj.property.id;
            }
            
            // Generate mapping ID to look up transformations
            if (propertyId) {
                const mappingId = state.generateMappingId(key, propertyId, selectedAtField);
                const transformationBlocks = state.getTransformationBlocks(mappingId);
                
                if (transformationBlocks && transformationBlocks.length > 0) {
                    // Apply transformations to each extracted value
                    extractedValues = extractedValues.map(originalValue => {
                        const transformationResult = applyTransformationChain(originalValue, transformationBlocks);
                        // Get the final transformed value
                        return transformationResult[transformationResult.length - 1]?.value || originalValue;
                    });
                }
            }
        } catch (error) {
            console.warn('Error applying transformations to extracted values:', error);
            // Return original values if transformation fails
        }
    }
    
    return extractedValues;
}

/**
 * Combine and sort all properties (mapped and manual) to prioritize label, description, aliases, and instance of
 */
export function combineAndSortProperties(mappedKeys, manualProperties) {
    // Create a unified array with both mapped and manual properties
    const allProperties = [];
    
    // Add mapped properties with a type indicator
    mappedKeys.forEach((keyObj, index) => {
        allProperties.push({
            type: 'mapped',
            data: keyObj,
            originalIndex: index
        });
    });
    
    // Add manual properties with a type indicator  
    manualProperties.forEach((manualProp, index) => {
        allProperties.push({
            type: 'manual',
            data: manualProp,
            originalIndex: index + mappedKeys.length // Offset by mapped keys length
        });
    });
    
    // Sort the combined array
    return allProperties.sort((a, b) => {
        const getPriority = (item) => {
            let label = '';
            let id = '';
            
            if (item.type === 'mapped') {
                const property = typeof item.data === 'string' ? null : item.data.property;
                if (!property) return 100;
                label = property.label ? property.label.toLowerCase() : '';
                id = property.id || '';
            } else if (item.type === 'manual') {
                label = item.data.property.label ? item.data.property.label.toLowerCase() : '';
                id = item.data.property.id || '';
            }
            
            // Priority order: label, description, aliases, instance of (P31), then everything else
            if (label === 'label') return 1;
            if (label === 'description') return 2;
            if (label === 'aliases' || label === 'alias') return 3;
            if (id === 'P31' || label === 'instance of') return 4;
            
            return 50; // All other properties maintain relative order
        };
        
        const aPriority = getPriority(a);
        const bPriority = getPriority(b);
        
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        
        // If same priority, maintain original order
        return a.originalIndex - b.originalIndex;
    });
}

/**
 * Load mock data for testing purposes
 * Note: This function will need to be called with state and initializeReconciliation function from orchestrator
 */
export function createMockDataLoader(state, initializeReconciliation) {
    return function loadMockDataForTesting() {
        
        const mockItems = getMockItemsData();
        const mockMapping = getMockMappingData();
        
        // Update state with mock data
        state.loadMockData(mockItems, mockMapping);
        
        
        // Initialize reconciliation with mock data
        setTimeout(() => {
            initializeReconciliation();
        }, 100);
    };
}

/**
 * Get original key information for a property
 */
export function createOriginalKeyInfoGetter(reconciliationData, state) {
    return function getOriginalKeyInfo(itemId, property) {
        // Get the original key name from the source data
        const originalData = reconciliationData[itemId]?.originalData;
        
        // Try to get the correct linked data URI from mapping information
        const currentState = state.getState();
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const mappingInfo = mappedKeys.find(keyObj => 
            (typeof keyObj === 'string' ? keyObj : keyObj.key) === property
        );
        
        let lodUri;
        if (mappingInfo && mappingInfo.linkedDataUri) {
            // Use the correct linked data URI from the mapping
            lodUri = mappingInfo.linkedDataUri;
        } else {
            // Fallback: try to extract from original data or generate generic URI
            lodUri = generateLodUri(property, originalData);
        }
        
        return {
            keyName: property,
            lodUri: lodUri
        };
    };
}

/**
 * Generate a LOD URI for the original key
 */
export function generateLodUri(property, originalData) {
    // Try to extract URI from the original data structure
    if (originalData && originalData[property]) {
        const value = originalData[property];
        
        // Check if it's an Omeka S structure with URI
        if (Array.isArray(value) && value[0] && value[0]['@id']) {
            return value[0]['@id'];
        } else if (typeof value === 'object' && value['@id']) {
            return value['@id'];
        }
    }
    
    // Fallback: create a generic ontology URI
    return `http://purl.org/dc/terms/${property}`;
}

/**
 * Determine why Wikidata item is required for this reconciliation
 */
export function createReconciliationRequirementReasonGetter(state, getPropertyDisplayInfo) {
    return function getReconciliationRequirementReason(property) {
        // Check if requirement comes from Entity Schema vs property constraint
        const currentState = state.getState();
        const entitySchemas = currentState.mappings?.entitySchemas || [];
        
        let reason = {
            explanation: "This property requires a Wikidata item to maintain linked data integrity.",
            links: []
        };
        
        // Check if this property is part of an Entity Schema
        if (entitySchemas.length > 0) {
            reason.explanation = "This property is required by the selected Entity Schema to be a Wikidata item.";
            reason.links.push(
                ...entitySchemas.map(schema => ({
                    label: `Entity Schema: ${schema.label || schema.id}`,
                    url: `https://www.wikidata.org/wiki/EntitySchema:${schema.id}`
                }))
            );
        }
        
        // Add property-specific investigation link
        const propertyInfo = getPropertyDisplayInfo(property);
        reason.links.push({
            label: `Property: ${propertyInfo.label} (${propertyInfo.pid})`,
            url: propertyInfo.wikidataUrl
        });
        
        return reason;
    };
}

/**
 * Validate reconciliation initialization requirements
 * Checks for required mappings, keys, and data availability
 */
export function validateReconciliationRequirements(currentState) {
    // Check for mapped keys
    if (!currentState.mappings || !currentState.mappings.mappedKeys || !currentState.mappings.mappedKeys.length) {
        return {
            isValid: false,
            error: 'No mapped keys available for reconciliation',
            details: currentState.mappings
        };
    }
    
    // Pre-filter check: ensure we have keys that exist in the current dataset
    const availableMappedKeys = currentState.mappings.mappedKeys.filter(keyObj => !keyObj.notInCurrentDataset);
    if (availableMappedKeys.length === 0) {
        return {
            isValid: false,
            error: 'No mapped keys are available in the current dataset for reconciliation',
            details: 'All mapped keys are from a different dataset or not present in current data'
        };
    }
    
    // Check for fetched data
    if (!currentState.fetchedData) {
        return {
            isValid: false,
            error: 'No fetched data available for reconciliation',
            details: currentState.fetchedData
        };
    }
    
    return {
        isValid: true,
        availableMappedKeys
    };
}

/**
 * Initialize reconciliation data structure
 * Creates the complex reconciliation data structure for all items and properties
 * @param {Array} data - Array of Omeka S items
 * @param {Array} mappedKeys - Array of mapped key objects
 * @param {Array} manualProperties - Array of manual properties
 * @param {Object} [state] - Optional state object for applying transformations
 */
export function initializeReconciliationDataStructure(data, mappedKeys, manualProperties, state = null) {
    const reconciliationData = {};
    
    data.forEach((item, index) => {
        const itemId = `item-${index}`;
        reconciliationData[itemId] = {
            originalData: item,
            properties: {}
        };
        
        // Initialize each mapped property
        mappedKeys.forEach(keyObj => {
            const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
            // Pass the full keyObj and state to apply transformations
            const values = extractPropertyValues(item, keyObj, state);
            reconciliationData[itemId].properties[keyName] = {
                originalValues: values,
                references: [], // References specific to this property
                propertyMetadata: typeof keyObj === 'object' ? keyObj : null, // Store full property object with constraints
                reconciled: values.map(() => ({
                    status: 'pending', // pending, reconciled, skipped, failed
                    matches: [],
                    selectedMatch: null,
                    manualValue: null,
                    qualifiers: {},
                    confidence: 0
                }))
            };
        });
        
        // Initialize each manual property with default values
        manualProperties.forEach(manualProp => {
            const propertyId = manualProp.property.id;
            const defaultValue = manualProp.defaultValue;
            
            // Create default values array - manual properties get one value per item
            const values = defaultValue ? [defaultValue] : [''];
            
            reconciliationData[itemId].properties[propertyId] = {
                originalValues: values,
                references: [], // References specific to this property
                isManualProperty: true, // Mark as manual property
                manualPropertyData: manualProp, // Store complete manual property data
                reconciled: values.map(() => ({
                    status: 'pending', // pending, reconciled, skipped, failed
                    matches: [],
                    selectedMatch: null,
                    manualValue: defaultValue || null,
                    qualifiers: {},
                    confidence: 0
                }))
            };
        });
    });
    
    return reconciliationData;
}