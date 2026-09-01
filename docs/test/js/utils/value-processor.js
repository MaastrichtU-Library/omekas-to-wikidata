/**
 * Value Processor Module
 * Processes JSON-LD values to detect and resolve identifiers to Wikidata items
 * @module utils/value-processor
 */

import { detectValueIdentifier } from './identifier-detection.js';
import { resolveIdentifierToWikidata } from './identifier-resolver.js';

/**
 * Process a single value object for identifier detection and resolution
 * @param {Object} valueObj - The value object to process
 * @param {string} fieldKey - The field key containing this value
 * @returns {Promise<Object>} Processed value object with identifier_matched_to_wikidata_item if found
 */
async function processValueObject(valueObj, fieldKey) {
    // Skip if already processed or no @id field
    if (!valueObj || typeof valueObj !== 'object' || !valueObj['@id'] || valueObj.identifier_matched_to_wikidata_item) {
        return valueObj;
    }
    
    // Detect identifier in the @id field
    const detection = detectValueIdentifier(valueObj);
    
    if (!detection) {
        return valueObj;
    }
    
    try {
        // Resolve identifier to Wikidata item
        const wikidataItem = await resolveIdentifierToWikidata(
            detection.type,
            detection.identifierValue,
            detection.originalValue
        );
        
        if (wikidataItem) {
            // Add the matched Wikidata item to the value object
            valueObj.identifier_matched_to_wikidata_item = wikidataItem;
            
        }
    } catch (error) {
        console.error(`Failed to resolve identifier for ${fieldKey}:`, error);
    }
    
    return valueObj;
}

/**
 * Process all values in a property for identifier detection
 * @param {any} propertyValue - The property value (can be array or single value)
 * @param {string} fieldKey - The field key
 * @returns {Promise<any>} Processed property value
 */
async function processPropertyValues(propertyValue, fieldKey) {
    if (!propertyValue) {
        return propertyValue;
    }
    
    if (Array.isArray(propertyValue)) {
        // Process each value in the array
        const processedValues = await Promise.all(
            propertyValue.map(value => processValueObject(value, fieldKey))
        );
        return processedValues;
    } else if (typeof propertyValue === 'object') {
        // Process single object value
        return await processValueObject(propertyValue, fieldKey);
    }
    
    // Return primitive values as-is
    return propertyValue;
}

/**
 * Process all items for value-level identifier detection
 * @param {Array} items - Array of data items to process
 * @returns {Promise<Array>} Processed items with identifier matches added
 */
export async function processItemsForValueIdentifiers(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return items;
    }
    
    
    const processedItems = await Promise.all(
        items.map(async (item) => {
            if (typeof item !== 'object' || !item) {
                return item;
            }
            
            // Process each property in the item
            const processedItem = { ...item };
            
            for (const [key, value] of Object.entries(item)) {
                // Skip JSON-LD system keys
                if (key.startsWith('@')) {
                    continue;
                }
                
                // Process the property values
                processedItem[key] = await processPropertyValues(value, key);
            }
            
            return processedItem;
        })
    );
    
    
    return processedItems;
}

/**
 * Process a single item for value identifiers (for incremental processing)
 * @param {Object} item - Single data item to process
 * @returns {Promise<Object>} Processed item with identifier matches added
 */
export async function processItemForValueIdentifiers(item) {
    if (typeof item !== 'object' || !item) {
        return item;
    }
    
    const processedItem = { ...item };
    
    for (const [key, value] of Object.entries(item)) {
        // Skip JSON-LD system keys
        if (key.startsWith('@')) {
            continue;
        }
        
        // Process the property values
        processedItem[key] = await processPropertyValues(value, key);
    }
    
    return processedItem;
}