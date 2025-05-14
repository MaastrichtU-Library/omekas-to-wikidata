/**
 * API fetching functionality for Omeka S
 */
import { createNewTab, showError } from '../ui/tabs.js';
import { getFilterParams } from '../ui/filters.js';
import { displayData } from '../utils/json-viewer.js';

/**
 * Constructs and performs an API request
 * @param {Object} elements - DOM elements
 */
export function fetchData(elements) {
    // Construct API URL
    let baseUrl = elements.baseUrlInput.value.trim();
    if (!baseUrl) {
        showError('Please enter a valid Omeka S base URL');
        return;
    }

    // Remove trailing slash if present
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }

    const resourceType = elements.resourceTypeSelect.value;
    let apiUrl = `${baseUrl}/api/${resourceType}`;

    // Build query parameters
    const params = new URLSearchParams();

    // Add pagination
    params.append('page', elements.pageInput.value);
    params.append('per_page', elements.perPageInput.value);

    // Add item set filter if provided
    const itemSetId = elements.itemSetIdInput.value.trim();
    if (resourceType === 'items' && itemSetId) {
        params.append('id', itemSetId);
    }

    // Add search query if provided
    const searchQuery = elements.searchQueryInput.value.trim();
    if (searchQuery) {
        params.append('search', searchQuery);
    }

    // Add property filters
    const filterParams = getFilterParams(elements.filtersDiv);
    filterParams.forEach((value, key) => {
        params.append(key, value);
    });

    // Append query parameters to URL
    const finalUrl = `${apiUrl}?${params.toString()}`;

    // Show loading indicator
    elements.loadingDiv.style.display = 'block';

    // Create a new tab for this request
    const tabId = createNewTab(`${resourceType}`, finalUrl, elements);

    // Fetch data
    fetch(finalUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Process data to replace extracted text fields before displaying
            if (elements.removeExtractedTextCheckbox && elements.removeExtractedTextCheckbox.checked) {
                // Function to recursively replace extracted text in the data
                const processExtractedText = (obj, replacementCount = {count: 0}) => {
                    if (Array.isArray(obj)) {
                        // Process arrays
                        obj.forEach(item => processExtractedText(item, replacementCount));
                    } else if (obj !== null && typeof obj === 'object') {
                        // Check if this object has the extracted text property
                        if (obj['extracttext:extracted_text']) {
                            // Replace the value with a placeholder
                            obj['extracttext:extracted_text'] = "[string content removed for performance]";
                            replacementCount.count++;
                            console.log('Replaced extracttext:extracted_text value');
                        }
                        
                        // Process all other properties recursively
                        Object.keys(obj).forEach(key => {
                            if (typeof obj[key] === 'object' && obj[key] !== null) {
                                processExtractedText(obj[key], replacementCount);
                            }
                        });
                    }
                    return replacementCount;
                };
                
                // Process the data and count replacements
                const replacementCount = processExtractedText(data);
                console.log(`Replaced ${replacementCount.count} extracted text values with placeholders`);
            }
            
            // Format and display the JSON data
            displayData(data, finalUrl, elements);
            elements.loadingDiv.style.display = 'none';
        })
        .catch(error => {
            showError(`Error fetching data: ${error.message}`, tabId);
            elements.loadingDiv.style.display = 'none';
        });
}

/**
 * Loads a URL in a specific tab
 * @param {string} url - URL to fetch
 * @param {string} tabId - ID of tab to load content into
 * @param {Object} elements - DOM elements
 */
export function loadUrlInTab(url, tabId, elements) {
    // Show loading indicator
    elements.loadingDiv.style.display = 'block';

    // Find tab content
    const tabContent = document.getElementById(tabId);
    if (!tabContent) return;

    const resultContainer = tabContent.querySelector('.result-container');
    if (!resultContainer) return;

    // Clear previous content
    resultContainer.innerHTML = '';

    // Fetch the data
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Process data to replace extracted text fields before displaying
            if (elements.removeExtractedTextCheckbox && elements.removeExtractedTextCheckbox.checked) {
                // Function to recursively replace extracted text in the data
                const processExtractedText = (obj, replacementCount = {count: 0}) => {
                    if (Array.isArray(obj)) {
                        // Process arrays
                        obj.forEach(item => processExtractedText(item, replacementCount));
                    } else if (obj !== null && typeof obj === 'object') {
                        // Check if this object has the extracted text property
                        if (obj['extracttext:extracted_text']) {
                            // Replace the value with a placeholder
                            obj['extracttext:extracted_text'] = "[string content removed for performance]";
                            replacementCount.count++;
                            console.log('Replaced extracttext:extracted_text value');
                        }
                        
                        // Process all other properties recursively
                        Object.keys(obj).forEach(key => {
                            if (typeof obj[key] === 'object' && obj[key] !== null) {
                                processExtractedText(obj[key], replacementCount);
                            }
                        });
                    }
                    return replacementCount;
                };
                
                // Process the data and count replacements
                const replacementCount = processExtractedText(data);
                console.log(`Replaced ${replacementCount.count} extracted text values with placeholders`);
            }
            
            // Format and display the JSON data
            displayData(data, url, elements);
            elements.loadingDiv.style.display = 'none';
        })
        .catch(error => {
            showError(error.message, tabId);
            elements.loadingDiv.style.display = 'none';
        });
}