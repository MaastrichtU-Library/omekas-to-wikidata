/**
 * Handles the Input step functionality
 */
import { eventSystem } from '../events.js';

export function setupInputStep(state) {
    const apiUrlInput = document.getElementById('api-url');
    // Advanced parameters removed for MVP
    // const apiKeyInput = document.getElementById('api-key');
    // const paginationInput = document.getElementById('pagination');
    const fetchDataBtn = document.getElementById('fetch-data');
    const loadingIndicator = document.getElementById('loading');
    const dataStatus = document.getElementById('data-status');
    const viewRawJsonBtn = document.getElementById('view-raw-json');
    const proceedToMappingBtn = document.getElementById('proceed-to-mapping');
    
    // Set up raw JSON button to open complete API URL
    if (viewRawJsonBtn) {
        viewRawJsonBtn.addEventListener('click', () => {
            const currentState = state.getState();
            if (currentState.apiUrl) {
                window.open(currentState.apiUrl, '_blank');
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
                state.updateState('apiUrl', apiUrl);
                
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
                state.updateState('fetchedData', data);
                
                // Automatically select first item as example
                let selectedExample = null;
                if (Array.isArray(data)) {
                    selectedExample = data[0];
                } else if (data.items && Array.isArray(data.items)) {
                    selectedExample = data.items[0];
                } else if (typeof data === 'object') {
                    selectedExample = data;
                }
                
                if (selectedExample) {
                    state.updateState('selectedExample', selectedExample);
                    // Mark step 1 as completed
                    state.completeStep(1);
                }
                
                // Update UI
                displayData(data);
                
                // Show raw JSON button
                if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'inline-block';
                
                // Enable continue to mapping button
                if (proceedToMappingBtn) proceedToMappingBtn.disabled = false;
                
            } catch (error) {
                console.error('Error fetching data:', error);
                const errorMsg = error.message || 'Error fetching data. Please check the API URL and try again.';
                alert(errorMsg);
                
                // Clear any partial data
                state.fetchedData = null;
                state.selectedExample = null;
                if (dataStatus) dataStatus.innerHTML = '';
                if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'none';
                if (proceedToMappingBtn) proceedToMappingBtn.disabled = true;
                
            } finally {
                // Hide loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
        });
    }
    
    // Continue to mapping button
    if (proceedToMappingBtn) {
        proceedToMappingBtn.addEventListener('click', () => {
            const currentState = state.getState();
            if (!currentState.fetchedData || !currentState.selectedExample) {
                alert('Please fetch data first');
                return;
            }
            
            // Navigate to step 2
            state.setCurrentStep(2);
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
                    <p><em>Click "Continue to Mapping" to proceed, or "View Raw JSON" to see the full structure.</em></p>
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
    
    // Helper function to update UI when data is available
    function updateUIFromState() {
        const currentState = state.getState();
        
        // Update API URL input if it exists in state
        if (currentState.apiUrl && apiUrlInput) {
            apiUrlInput.value = currentState.apiUrl;
        }
        
        // Update data status if there's fetched data
        if (currentState.fetchedData) {
            displayData(currentState.fetchedData);
            
            // Show view raw JSON button
            if (viewRawJsonBtn) {
                viewRawJsonBtn.style.display = 'inline-block';
            }
            
            // Enable proceed button if data is valid
            if (proceedToMappingBtn) {
                proceedToMappingBtn.disabled = false;
            }
        }
    }
    
    // Listen for state changes (when session is restored or project loaded)
    eventSystem.subscribe(eventSystem.Events.STATE_CHANGED, (data) => {
        if (data.restored) {
            // When state is restored, update the UI
            updateUIFromState();
        }
    });
    
    // Listen for step changes to update UI when navigating to step 1
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 1) {
            // When entering step 1, refresh the UI state
            setTimeout(() => updateUIFromState(), 100); // Small delay to ensure DOM is ready
        }
    });
    
    // Initialize UI from current state on setup
    updateUIFromState();
}