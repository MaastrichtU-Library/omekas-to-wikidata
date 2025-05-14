/**
 * Property view and key analysis functionality
 */
import { isUrl } from './url-utils.js';

// Export the function to get context data for use in other modules
let contextDataCache = null;

/**
 * Sets the context data for use in property exports
 * @param {Object} contextData - The JSON-LD context data
 */
export function setContextData(contextData) {
    contextDataCache = contextData;
}

/**
 * Gets the current context data
 * @returns {Object} - The current context data, or null if not set
 */
export function getContextData() {
    return contextDataCache;
}

/**
 * Analyzes keys in a JSON array
 * @param {Array} jsonArray - Array of objects to analyze
 * @returns {Object} - Object with key names and counts
 */
export function analyzeJsonKeys(jsonArray) {
    if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
        return {};
    }

    const keyStats = {};

    // Go through each item in the array
    jsonArray.forEach(item => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            // For each key in the object, increment the count
            Object.keys(item).forEach(key => {
                if (keyStats[key]) {
                    keyStats[key]++;
                } else {
                    keyStats[key] = 1;
                }
            });
        }
    });

    return keyStats;
}

/**
 * Sets up the keys view
 * @param {HTMLElement} container - Container for the view
 * @param {Object|Array} data - Data to display
 * @param {HTMLElement} jsonViewBtn - JSON view button for switching views
 */
export function setupKeysView(container, data, jsonViewBtn) {
    if (Array.isArray(data)) {
        const keyStats = analyzeJsonKeys(data);

        // Create title for key stats
        const keyStatsTitle = document.createElement('h3');
        keyStatsTitle.textContent = 'Properties in JSON Data';
        container.appendChild(keyStatsTitle);

        // Create button row for action buttons
        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.gap = '10px';
        buttonRow.style.marginBottom = '15px';

        // Create export filtered button
        const exportFilteredButton = document.createElement('button');
        exportFilteredButton.textContent = 'Export with Selected Properties';
        exportFilteredButton.addEventListener('click', function() {
            const filteredData = filterDataBySelectedKeys(data, container);
            exportJson(filteredData, 'filtered_data.json');
        });

        // Apply filters button
        const applyFiltersButton = document.createElement('button');
        applyFiltersButton.textContent = 'Apply to JSON View';
        applyFiltersButton.addEventListener('click', function() {
            // Switch to JSON view
            jsonViewBtn.click();
            // Apply filters to JSON view
            applyKeyFiltersToJsonView(container);
        });
        
        // Export Linked Data button
        const exportLodButton = document.createElement('button');
        exportLodButton.textContent = 'Export Property LOD Info';
        exportLodButton.title = 'Export Linked Open Data information for selected properties with sample values';
        exportLodButton.addEventListener('click', function() {
            exportPropertiesLinkedData(data, container, 3); // Export with 3 sample values
        });

        buttonRow.appendChild(exportFilteredButton);
        buttonRow.appendChild(applyFiltersButton);
        buttonRow.appendChild(exportLodButton);
        container.appendChild(buttonRow);

        // Add key stats content
        const keyList = document.createElement('div');

        // Sort keys by count (descending)
        const sortedKeys = Object.keys(keyStats).sort((a, b) => keyStats[b] - keyStats[a]);

        // Create a "Select All" checkbox
        const selectAllContainer = document.createElement('div');
        selectAllContainer.className = 'key-item';

        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.className = 'key-checkbox';
        selectAllCheckbox.id = 'select-all-keys';
        selectAllCheckbox.checked = true;

        const selectAllLabel = document.createElement('label');
        selectAllLabel.htmlFor = 'select-all-keys';
        selectAllLabel.className = 'key-name';
        selectAllLabel.textContent = 'Select All Properties';

        selectAllCheckbox.addEventListener('change', function() {
            const allCheckboxes = keyList.querySelectorAll('.key-checkbox');
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });

        selectAllContainer.appendChild(selectAllCheckbox);
        selectAllContainer.appendChild(selectAllLabel);
        keyList.appendChild(selectAllContainer);

        // Add a divider
        const divider = document.createElement('hr');
        keyList.appendChild(divider);

        // Add each key with its count
        sortedKeys.forEach(key => {
            const keyItem = document.createElement('div');
            keyItem.className = 'key-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'key-checkbox';
            checkbox.setAttribute('data-key', key);

            // Properties to exclude by default
            const excludedProperties = [
                'o:', // All Omeka S technical properties
                'extracttext:extracted_text' // Large extracted text fields
            ];
            
            // Check if this property should be excluded by default
            const shouldExclude = excludedProperties.some(excluded => 
                excluded.endsWith(':') 
                    ? key.startsWith(excluded) 
                    : key === excluded
            );
            
            checkbox.checked = !shouldExclude;

            const keyName = document.createElement('span');
            keyName.className = 'key-name';
            keyName.textContent = key;

            // Make the property name clickable to show values
            keyName.style.cursor = 'pointer';
            keyName.addEventListener('click', function() {
                showPropertyValues(key, data, keyStats[key]);
            });

            const keyCount = document.createElement('span');
            keyCount.className = 'key-count';
            keyCount.textContent = `(${keyStats[key]} items)`;

            keyItem.appendChild(checkbox);
            keyItem.appendChild(keyName);
            keyItem.appendChild(keyCount);

            keyList.appendChild(keyItem);
        });

        container.appendChild(keyList);
    } else {
        // If not an array, show message
        const noArrayMsg = document.createElement('p');
        noArrayMsg.textContent = 'Key analysis is only available for JSON arrays.';
        container.appendChild(noArrayMsg);
    }
}

/**
 * Gets selected keys from the key stats container
 * @param {HTMLElement} container - Key stats container
 * @returns {string[]} - Array of selected key names
 */
export function getSelectedKeys(container) {
    const checkedKeys = [];
    const keyCheckboxes = container.querySelectorAll('.key-checkbox[data-key]');

    keyCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            checkedKeys.push(checkbox.getAttribute('data-key'));
        }
    });

    return checkedKeys;
}

/**
 * Filters data based on selected keys
 * @param {Array} jsonArray - Array of objects to filter
 * @param {HTMLElement} container - Key stats container with selections
 * @returns {Array} - Filtered array
 */
export function filterDataBySelectedKeys(jsonArray, container) {
    if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
        return [];
    }

    // Get all checked key checkboxes
    const checkedKeys = getSelectedKeys(container);

    // Filter the data to only include the selected keys
    return jsonArray.map(item => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            const filteredItem = {};

            Object.keys(item).forEach(key => {
                if (checkedKeys.includes(key)) {
                    filteredItem[key] = item[key];
                }
            });

            return filteredItem;
        }
        return item;
    });
}

/**
 * Applies key filters to the JSON view
 * @param {HTMLElement} container - Key stats container with selections
 */
export function applyKeyFiltersToJsonView(container) {
    const checkedKeys = getSelectedKeys(container);

    // Find all keys in the JSON view and hide/show based on selection
    const jsonContainer = document.getElementById('json-view');
    if (!jsonContainer) return;

    // Find the array objects in the JSON view
    const arrayContent = jsonContainer.querySelector('.json-content');
    if (!arrayContent) return;

    // Look for item containers in the array (these are the top-level objects)
    const itemContainers = arrayContent.children;

    // Go through each item container
    Array.from(itemContainers).forEach(itemContainer => {
        // Get the object content container for this item
        const objectContentContainer = itemContainer.querySelector('.json-content');
        if (!objectContentContainer) return;

        // Find all property lines in this object (top-level properties only)
        const propertyLines = objectContentContainer.querySelectorAll(':scope > div > .json-line');

        propertyLines.forEach(line => {
            const keyElement = line.querySelector(':scope > .json-key');
            if (!keyElement) return;

            // Get the key name (remove the colon and space)
            const keyText = keyElement.textContent;
            const key = keyText.replace(/:\s*$/, '');

            // Skip array indices
            if (/^\d+$/.test(key)) return;

            // Hide/show based on selection
            if (checkedKeys.includes(key)) {
                line.style.display = 'flex'; // Show
            } else {
                line.style.display = 'none'; // Hide
            }
        });
    });
}

/**
 * Shows property values in a modal
 * @param {string} propertyName - Name of the property to show values for
 * @param {Array} jsonArray - Data array
 * @param {number} count - Number of occurrences
 */
export function showPropertyValues(propertyName, jsonArray, count) {
    // Create modal container
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '1000';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.overflowY = 'auto';

    // Create modal content
    const content = document.createElement('div');
    content.style.backgroundColor = 'white';
    content.style.padding = '20px';
    content.style.borderRadius = '5px';
    content.style.maxWidth = '800px';
    content.style.width = '80%';
    content.style.maxHeight = '80vh';
    content.style.overflowY = 'auto';

    // Create header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '15px';

    const title = document.createElement('h3');
    title.textContent = `Values for property "${propertyName}" (${count} occurrences)`;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0 5px';
    closeBtn.style.marginTop = '-5px';
    closeBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    content.appendChild(header);

    // Extract unique values for this property
    const values = [];

    jsonArray.forEach(item => {
        if (item && typeof item === 'object' && !Array.isArray(item) && propertyName in item) {
            // Get the value
            const value = item[propertyName];
            values.push(value);
        }
    });

    // Group identical values and count them
    const valueCount = {};
    values.forEach(value => {
        const valueStr = JSON.stringify(value);
        if (valueCount[valueStr]) {
            valueCount[valueStr].count++;
        } else {
            valueCount[valueStr] = {
                value: value,
                count: 1
            };
        }
    });

    // Create a table to display values
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const valueHeader = document.createElement('th');
    valueHeader.textContent = 'Value';
    valueHeader.style.textAlign = 'left';
    valueHeader.style.padding = '8px';
    valueHeader.style.borderBottom = '1px solid #ddd';

    const countHeader = document.createElement('th');
    countHeader.textContent = 'Count';
    countHeader.style.textAlign = 'right';
    countHeader.style.padding = '8px';
    countHeader.style.borderBottom = '1px solid #ddd';

    headerRow.appendChild(valueHeader);
    headerRow.appendChild(countHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');

    // Sort by count (descending)
    const sortedValues = Object.values(valueCount).sort((a, b) => b.count - a.count);

    sortedValues.forEach(item => {
        const row = document.createElement('tr');

        const valueCell = document.createElement('td');
        valueCell.style.padding = '8px';
        valueCell.style.borderBottom = '1px solid #ddd';

        // Format the value based on its type
        if (typeof item.value === 'object' && item.value !== null) {
            const codeBlock = document.createElement('pre');
            codeBlock.style.margin = '0';
            codeBlock.style.whiteSpace = 'pre-wrap';
            codeBlock.style.wordBreak = 'break-word';
            codeBlock.style.backgroundColor = '#f5f5f5';
            codeBlock.style.padding = '5px';
            codeBlock.style.borderRadius = '3px';
            codeBlock.textContent = JSON.stringify(item.value, null, 2);
            valueCell.appendChild(codeBlock);
        } else if (isUrl(item.value)) {
            const link = document.createElement('a');
            link.href = item.value;
            link.target = '_blank';
            link.textContent = item.value;
            valueCell.appendChild(link);
        } else {
            valueCell.textContent = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        }

        const countCell = document.createElement('td');
        countCell.textContent = item.count;
        countCell.style.textAlign = 'right';
        countCell.style.padding = '8px';
        countCell.style.borderBottom = '1px solid #ddd';

        row.appendChild(valueCell);
        row.appendChild(countCell);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    content.appendChild(table);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Close modal when clicking outside content
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Exports data as a JSON file
 * @param {Object|Array} data - Data to export
 * @param {string} filename - Name for the downloaded file
 */
export function exportJson(data, filename) {
    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(data, null, 2);

    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Exports property information as linked data
 * @param {string} propertyName - The property name (possibly prefixed)
 * @param {Array} jsonArray - The array of data objects
 * @param {number} sampleSize - Number of sample values to include (default 3)
 * @returns {Object} - Object with property linked data information
 */
function exportPropertyLinkedData(propertyName, jsonArray, sampleSize = 3) {
    const context = contextDataCache ? contextDataCache['@context'] : null;
    const result = {
        property: propertyName,
        uri: null,
        prefix: null,
        namespace: null,
        localName: propertyName,
        sampleValues: []
    };
    
    // Try to extract prefix and name
    if (propertyName.includes(':')) {
        const [prefix, name] = propertyName.split(':');
        result.prefix = prefix;
        result.localName = name;
        
        // If we have context, get the full URI
        if (context && context[prefix]) {
            result.namespace = context[prefix];
            result.uri = context[prefix] + name;
        }
    } else if (context && context[propertyName]) {
        // Direct property in context
        result.uri = context[propertyName];
    }
    
    // Get sample values
    if (Array.isArray(jsonArray) && jsonArray.length > 0) {
        const validItems = jsonArray.filter(item => 
            item && typeof item === 'object' && propertyName in item);
        
        if (validItems.length > 0) {
            // Get up to sampleSize random items
            const randomItems = [];
            const itemsCopy = [...validItems];
            
            for (let i = 0; i < Math.min(sampleSize, itemsCopy.length); i++) {
                const randomIndex = Math.floor(Math.random() * itemsCopy.length);
                randomItems.push(itemsCopy[randomIndex]);
                // Remove the item to avoid duplicates
                itemsCopy.splice(randomIndex, 1);
            }
            
            // Extract values
            result.sampleValues = randomItems.map(item => {
                const value = item[propertyName];
                return {
                    rawValue: value,
                    type: typeof value,
                    isObject: typeof value === 'object' && value !== null,
                    isArray: Array.isArray(value)
                };
            });
        }
    }
    
    return result;
}

/**
 * Exports property linked data information for all or selected properties
 * @param {Array} data - The JSON array data
 * @param {HTMLElement} container - Container with property selections
 * @param {number} sampleSize - Number of sample values to include
 */
export function exportPropertiesLinkedData(data, container, sampleSize = 3) {
    if (!Array.isArray(data) || data.length === 0) {
        alert('No data available to export property information');
        return;
    }
    
    // Get selected properties
    const selectedKeys = getSelectedKeys(container);
    if (selectedKeys.length === 0) {
        alert('No properties selected for export');
        return;
    }
    
    // Generate linked data for each property
    const propertiesData = {
        exportDate: new Date().toISOString(),
        properties: selectedKeys.map(key => exportPropertyLinkedData(key, data, sampleSize))
    };
    
    // Export as JSON
    exportJson(propertiesData, 'properties_linked_data.json');
}