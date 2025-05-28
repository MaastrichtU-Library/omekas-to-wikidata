/**
 * Handles the Input step functionality
 */
export function setupInputStep(state) {
    const apiUrlInput = document.getElementById('api-url');
    // Advanced parameters removed for MVP
    // const apiKeyInput = document.getElementById('api-key');
    // const paginationInput = document.getElementById('pagination');
    const fetchDataBtn = document.getElementById('fetch-data');
    const loadingIndicator = document.getElementById('loading');
    const dataStatus = document.getElementById('data-status');
    const viewRawJsonBtn = document.getElementById('view-raw-json');
    const selectExampleBtn = document.getElementById('select-example');
    const proceedToMappingBtn = document.getElementById('proceed-to-mapping');
    
    // Set up raw JSON button to open in new tab
    if (viewRawJsonBtn) {
        viewRawJsonBtn.addEventListener('click', () => {
            if (state.fetchedData) {
                const jsonBlob = new Blob([JSON.stringify(state.fetchedData, null, 2)], {
                    type: 'application/json'
                });
                const jsonUrl = URL.createObjectURL(jsonBlob);
                window.open(jsonUrl, '_blank');
            }
        });
    }
    
    // Fetch data from API
    if (fetchDataBtn) {
        fetchDataBtn.addEventListener('click', async () => {
            const apiUrl = apiUrlInput.value.trim();
            if (!apiUrl) {
                alert('Please enter an API URL');
                return;
            }
            
            try {
                // Validate URL
                if (!isValidApiUrl(apiUrl)) {
                    alert('Please enter a valid Omeka S API URL (e.g., https://example.com/api/items)');
                    return;
                }
                
                // Update state
                state.apiUrl = apiUrl;
                
                // Show loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'block';
                
                // Fetch actual data from API
                const response = await fetch(apiUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
                }
                
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Response is not valid JSON. Please check the API URL.');
                }
                
                const data = await response.json();
                
                // Validate JSON structure
                if (!isValidOmekaResponse(data)) {
                    throw new Error('Invalid Omeka S API response format. Expected an array or object with items.');
                }
                
                // Store fetched data
                state.fetchedData = data;
                
                // Update UI
                displayData(state.fetchedData);
                
                // Show raw JSON button
                if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'inline-block';
                
                // Enable select example button
                if (selectExampleBtn) selectExampleBtn.disabled = false;
                
            } catch (error) {
                console.error('Error fetching data:', error);
                const errorMsg = error.message || 'Error fetching data. Please check the API URL and try again.';
                alert(errorMsg);
                
                // Clear any partial data
                state.fetchedData = null;
                if (dataStatus) dataStatus.innerHTML = '';
                if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'none';
                if (selectExampleBtn) selectExampleBtn.disabled = true;
                
            } finally {
                // Hide loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
        });
    }
    
    // Select example object
    if (selectExampleBtn) {
        selectExampleBtn.addEventListener('click', () => {
            if (!state.fetchedData) {
                alert('Please fetch data first');
                return;
            }
            
            // Select first item from fetched data
            let exampleItem = null;
            if (Array.isArray(state.fetchedData)) {
                exampleItem = state.fetchedData[0];
            } else if (state.fetchedData.items && Array.isArray(state.fetchedData.items)) {
                exampleItem = state.fetchedData.items[0];
            } else {
                exampleItem = state.fetchedData;
            }
            
            if (!exampleItem) {
                alert('No example item found in the fetched data');
                return;
            }
            
            state.selectedExample = exampleItem;
            
            // Enable proceed button
            if (proceedToMappingBtn) proceedToMappingBtn.disabled = false;
            
            // Update state to indicate step 1 is complete
            state.updateState('highestCompletedStep', Math.max(state.getState().highestCompletedStep, 1));
            
            alert('Example object selected successfully');
        });
    }
    
    // Helper function to validate API URL
    function isValidApiUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    // Helper function to validate Omeka S API response
    function isValidOmekaResponse(data) {
        if (!data) return false;
        
        // Check if it's an array (direct items array)
        if (Array.isArray(data)) {
            return data.length > 0;
        }
        
        // Check if it's an object with items array
        if (typeof data === 'object' && data.items && Array.isArray(data.items)) {
            return data.items.length > 0;
        }
        
        // Check if it's a single object (single item response)
        if (typeof data === 'object' && data['@type']) {
            return true;
        }
        
        return false;
    }
    
    // Helper function to display data
    function displayData(data) {
        if (dataStatus) {
            let itemCount = 0;
            let propertyCount = 0;
            let sampleItem = null;
            
            // Analyze data structure
            if (Array.isArray(data)) {
                itemCount = data.length;
                sampleItem = data[0];
            } else if (data.items && Array.isArray(data.items)) {
                itemCount = data.items.length;
                sampleItem = data.items[0];
            } else if (typeof data === 'object') {
                itemCount = 1;
                sampleItem = data;
            }
            
            // Count properties in sample item
            if (sampleItem && typeof sampleItem === 'object') {
                propertyCount = Object.keys(sampleItem).length;
            }
            
            // Extract some sample properties for preview
            let sampleProperties = [];
            if (sampleItem) {
                const keys = Object.keys(sampleItem);
                sampleProperties = keys.slice(0, 5); // Show first 5 properties
            }
            
            dataStatus.innerHTML = `
                <div class="data-summary">
                    <p><strong>✅ Data loaded successfully</strong></p>
                    <ul>
                        <li>Items found: ${itemCount}</li>
                        <li>Properties per item: ${propertyCount}</li>
                        ${sampleProperties.length > 0 ? `<li>Sample properties: ${sampleProperties.join(', ')}${propertyCount > 5 ? '...' : ''}</li>` : ''}
                    </ul>
                    <p><em>Click "Select Example" to proceed, or "View Raw JSON" to see the full structure.</em></p>
                </div>
            `;
        }
    }
    
    // Helper function to get dummy data
    function getDummyData() {
        return {
            "items": [
                {
                    "@context": "http://example.org/context/item",
                    "@id": "http://example.org/api/items/1",
                    "@type": ["o:Item"],
                    "o:id": 1,
                    "o:title": "Example Item",
                    "dcterms:title": [
                        {
                            "@value": "Example Item",
                            "@language": "en"
                        }
                    ],
                    "dcterms:description": [
                        {
                            "@value": "This is an example item description.",
                            "@language": "en"
                        }
                    ],
                    "dcterms:creator": [
                        {
                            "@value": "John Doe",
                            "@language": null
                        }
                    ],
                    "dcterms:date": [
                        {
                            "@value": "2023-01-15",
                            "@type": "http://www.w3.org/2001/XMLSchema#date"
                        }
                    ],
                    "o:created": {
                        "@value": "2023-01-15T10:30:45+00:00",
                        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
                    }
                }
            ]
        };
    }
}