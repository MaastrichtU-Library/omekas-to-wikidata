/**
 * JSON visualization functionality
 */
import { createInteractiveJson } from './interactive-json.js';
import { setupKeysView, exportJson } from './property-view.js';
import { setupLodView } from './lod-view.js';

/**
 * Processes properties in JSON data, replacing values of specific keys with a placeholder
 * @param {Object|Array} data - The data to process
 * @param {Object} replacements - Keys to find and their replacement values
 * @param {Function} [callback] - Optional callback that is called for each replaced property
 * @returns {Object|Array} - Processed data with properties replaced
 */
export function replacePropertyValues(data, replacements, callback) {
    if (Array.isArray(data)) {
        // Process each item in array
        return data.map(item => replacePropertyValues(item, replacements, callback));
    } else if (data !== null && typeof data === 'object') {
        // Process each property in the object
        const newObj = {};
        Object.keys(data).forEach(key => {
            // Check if this key should have its value replaced
            if (key in replacements) {
                newObj[key] = replacements[key];
                if (callback) callback(key);
            } else if (typeof data[key] === 'object' && data[key] !== null) {
                // Recursively process nested objects/arrays
                newObj[key] = replacePropertyValues(data[key], replacements, callback);
            } else {
                // Copy other values directly
                newObj[key] = data[key];
            }
        });
        return newObj;
    }
    // Return non-objects unchanged
    return data;
}

/**
 * Displays data in the active tab
 * @param {Object|Array} data - The data to display
 * @param {string} url - URL that was used to fetch the data
 * @param {Object} elements - DOM elements
 */
export function displayData(data, url, elements) {
    // Find the active tab content
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;

    // Clear previous content
    const resultContainer = activeTab.querySelector('.result-container');
    if (!resultContainer) return;
    resultContainer.innerHTML = '';
    
    // Process data - replace extracted text content if checkbox is checked
    let processedData = data;
    if (elements.removeExtractedTextCheckbox && elements.removeExtractedTextCheckbox.checked) {
        console.log('Replacing extracttext:extracted_text content');
        
        // Counter for replaced properties
        let replacedCount = 0;
        const countingCallback = (key) => {
            replacedCount++;
        };
        
        // Replacement value for extracttext:extracted_text
        const replacements = {
            "extracttext:extracted_text": "[extracted text content removed for performance]"
        };
        
        // Process the data
        processedData = replacePropertyValues(data, replacements, countingCallback);
        
        console.log(`Replaced content in ${replacedCount} instances of extracttext:extracted_text`);
        
        // Display a notice that text was removed
        const noticeDiv = document.createElement('div');
        noticeDiv.style.backgroundColor = '#fff3cd';
        noticeDiv.style.color = '#856404';
        noticeDiv.style.padding = '8px 15px';
        noticeDiv.style.borderRadius = '4px';
        noticeDiv.style.marginBottom = '15px';
        noticeDiv.style.fontSize = '0.9em';
        noticeDiv.innerHTML = `<strong>Note:</strong> Content removed from ${replacedCount} extracted text field${replacedCount !== 1 ? 's' : ''} to improve performance. Disable this in Advanced Options if needed.`;
        resultContainer.appendChild(noticeDiv);
    } else {
        console.log('Keeping all data fields including extracted text content');
    }

    // Create view toggle buttons
    const viewToggle = document.createElement('div');
    viewToggle.className = 'view-toggle';

    // JSON View button
    const jsonViewBtn = createViewButton('JSON View', true);
    
    // Properties View button
    const keysViewBtn = createViewButton('Properties View', false);
    
    // Raw JSON button
    const rawJsonBtn = createViewButton('Raw JSON', false);
    
    // Linked Open Data View button
    const lodViewBtn = createViewButton('Linked Open Data View', false);

    // Add button event listeners
    jsonViewBtn.addEventListener('click', function() {
        setActiveView(this, jsonContainer, [keysViewBtn, rawJsonBtn, lodViewBtn], 
                     [keyStatsContainer, rawJsonContainer, lodContainer]);
    });

    keysViewBtn.addEventListener('click', function() {
        setActiveView(this, keyStatsContainer, [jsonViewBtn, rawJsonBtn, lodViewBtn], 
                     [jsonContainer, rawJsonContainer, lodContainer]);
    });

    rawJsonBtn.addEventListener('click', function() {
        setActiveView(this, rawJsonContainer, [jsonViewBtn, keysViewBtn, lodViewBtn], 
                     [jsonContainer, keyStatsContainer, lodContainer]);
    });

    lodViewBtn.addEventListener('click', function() {
        setActiveView(this, lodContainer, [jsonViewBtn, keysViewBtn, rawJsonBtn], 
                     [jsonContainer, keyStatsContainer, rawJsonContainer]);
    });

    // Add buttons to view toggle
    viewToggle.appendChild(jsonViewBtn);
    viewToggle.appendChild(keysViewBtn);
    viewToggle.appendChild(rawJsonBtn);
    viewToggle.appendChild(lodViewBtn);
    resultContainer.appendChild(viewToggle);

    // Create containers for different views
    const jsonContainer = createContainer('json-view');
    const keyStatsContainer = createContainer('keys-view', 'none');
    const rawJsonContainer = createContainer('raw-json-view', 'none');
    const lodContainer = createContainer('lod-view', 'none');

    // JSON View
    setupJsonView(jsonContainer, processedData);
    
    // Keys View
    setupKeysView(keyStatsContainer, processedData, jsonViewBtn);
    
    // Raw JSON View
    setupRawJsonView(rawJsonContainer, processedData);
    
    // LOD View
    setupLodView(lodContainer, processedData, url);

    // Add containers to the result container
    resultContainer.appendChild(jsonContainer);
    resultContainer.appendChild(keyStatsContainer);
    resultContainer.appendChild(rawJsonContainer);
    resultContainer.appendChild(lodContainer);
    
    // Store the original data and processed data as custom properties on the tab
    // This allows access to both versions when exporting
    activeTab.dataset.hasProcessedData = (processedData !== data).toString();
    if (processedData !== data) {
        // Store a reference to the original data in a safe way
        activeTab._originalData = data;
    }
}

/**
 * Creates a button for the view toggle
 * @param {string} text - Button text
 * @param {boolean} isActive - Whether the button is initially active
 * @returns {HTMLButtonElement} - Created button
 */
function createViewButton(text, isActive) {
    const button = document.createElement('button');
    button.textContent = text;
    if (isActive) {
        button.classList.add('active');
    }
    return button;
}

/**
 * Sets the active view
 * @param {HTMLElement} activeBtn - Button to set active
 * @param {HTMLElement} activeContainer - Container to show
 * @param {HTMLElement[]} inactiveBtns - Buttons to set inactive
 * @param {HTMLElement[]} inactiveContainers - Containers to hide
 */
function setActiveView(activeBtn, activeContainer, inactiveBtns, inactiveContainers) {
    activeBtn.classList.add('active');
    activeContainer.style.display = 'block';
    
    inactiveBtns.forEach(btn => btn.classList.remove('active'));
    inactiveContainers.forEach(container => container.style.display = 'none');
}

/**
 * Creates a container div
 * @param {string} id - Container ID
 * @param {string} display - Initial display style
 * @returns {HTMLDivElement} - Created container
 */
function createContainer(id, display = 'block') {
    const container = document.createElement('div');
    container.id = id;
    container.style.display = display;
    return container;
}

/**
 * Sets up the JSON view
 * @param {HTMLElement} container - Container for the view
 * @param {Object|Array} data - Data to display
 */
function setupJsonView(container, data) {
    // Create export buttons for data
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginBottom = '15px';
    
    // Export processed data
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export JSON';
    
    // Check if there's a parent tab with processed data
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.dataset.hasProcessedData === 'true') {
        exportButton.textContent = 'Export JSON (without extracted text)';
        
        // Add button to export original data with extracted text
        const exportFullButton = document.createElement('button');
        exportFullButton.textContent = 'Export Full JSON (with extracted text)';
        exportFullButton.style.backgroundColor = '#f0f0f0';
        exportFullButton.style.color = '#333';
        exportFullButton.addEventListener('click', function() {
            if (activeTab._originalData) {
                exportJson(activeTab._originalData, 'full_data.json');
            }
        });
        buttonContainer.appendChild(exportFullButton);
    }
    
    exportButton.addEventListener('click', function() {
        exportJson(data, 'data.json');
    });
    buttonContainer.appendChild(exportButton);

    // Create interactive JSON display
    const jsonElement = document.createElement('div');
    jsonElement.appendChild(createInteractiveJson(data));

    // Add buttons above the JSON display
    container.appendChild(buttonContainer);
    container.appendChild(jsonElement);
}

/**
 * Sets up the raw JSON view
 * @param {HTMLElement} container - Container for the view
 * @param {Object|Array} data - Data to display
 */
function setupRawJsonView(container, data) {
    // Create export buttons container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginBottom = '15px';
    
    // Create export button for processed JSON
    const rawExportButton = document.createElement('button');
    rawExportButton.textContent = 'Export Raw JSON';
    rawExportButton.addEventListener('click', function() {
        exportJson(data, 'raw_data.json');
    });
    buttonContainer.appendChild(rawExportButton);
    
    // Check if there's a parent tab with processed data
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.dataset.hasProcessedData === 'true') {
        rawExportButton.textContent = 'Export Raw JSON (without extracted text)';
        
        // Add button to export original data with extracted text
        const exportFullButton = document.createElement('button');
        exportFullButton.textContent = 'Export Full Raw JSON (with extracted text)';
        exportFullButton.style.backgroundColor = '#f0f0f0';
        exportFullButton.style.color = '#333';
        exportFullButton.addEventListener('click', function() {
            if (activeTab._originalData) {
                exportJson(activeTab._originalData, 'full_raw_data.json');
            }
        });
        buttonContainer.appendChild(exportFullButton);
    }

    // Add raw JSON content
    const rawJsonPre = document.createElement('pre');
    rawJsonPre.style.whiteSpace = 'pre-wrap';
    rawJsonPre.style.backgroundColor = '#f5f5f5';
    rawJsonPre.style.padding = '15px';
    rawJsonPre.style.borderRadius = '5px';
    rawJsonPre.style.fontFamily = 'monospace';
    rawJsonPre.style.fontSize = '14px';
    rawJsonPre.style.overflow = 'auto';
    rawJsonPre.style.maxHeight = '600px';
    rawJsonPre.textContent = JSON.stringify(data, null, 2);

    container.appendChild(buttonContainer);
    container.appendChild(rawJsonPre);
}