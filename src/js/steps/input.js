/**
 * Handles the Input step functionality
 */
export function setupInputStep(state) {
    console.log('🚀 Step 1 (Input) initialized');
    console.log('📋 Initial state:', {
        currentStep: state.getCurrentStep(),
        highestCompletedStep: state.getHighestCompletedStep(),
        hasUnsavedChanges: state.hasUnsavedChanges()
    });
    const apiUrlInput = document.getElementById('api-url');
    // Advanced parameters removed for MVP
    // const apiKeyInput = document.getElementById('api-key');
    // const paginationInput = document.getElementById('pagination');
    const fetchDataBtn = document.getElementById('fetch-data');
    const loadingIndicator = document.getElementById('loading');
    const dataStatus = document.getElementById('data-status');
    const viewRawJsonBtn = document.getElementById('view-raw-json');
    const proceedToMappingBtn = document.getElementById('proceed-to-mapping');
    
    // Set up raw JSON button to open in new tab
    if (viewRawJsonBtn) {
        viewRawJsonBtn.addEventListener('click', () => {
            console.log('📄 Opening raw JSON data in new tab');
            if (state.fetchedData) {
                const jsonBlob = new Blob([JSON.stringify(state.fetchedData, null, 2)], {
                    type: 'application/json'
                });
                const jsonUrl = URL.createObjectURL(jsonBlob);
                window.open(jsonUrl, '_blank');
                console.log('✅ Raw JSON tab opened successfully');
            } else {
                console.warn('⚠️ No fetched data available to display');
            }
        });
    }
    
    // Fetch data from API
    if (fetchDataBtn) {
        fetchDataBtn.addEventListener('click', async () => {
            const apiUrl = apiUrlInput.value.trim();
            console.log('🌐 Fetch Data button clicked');
            console.log('📝 API URL:', apiUrl);
            
            if (!apiUrl) {
                console.warn('⚠️ No API URL provided');
                alert('Please enter an API URL');
                return;
            }
            
            try {
                // Validate URL
                if (!isValidApiUrl(apiUrl)) {
                    console.error('❌ Invalid API URL format:', apiUrl);
                    alert('Please enter a valid Omeka S API URL (e.g., https://example.com/api/items)');
                    return;
                }
                
                console.log('✅ URL validation passed');
                
                // Update state
                state.apiUrl = apiUrl;
                console.log('💾 API URL saved to state');
                
                // Show loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'block';
                console.log('⏳ Loading indicator shown, starting API fetch...');
                
                // Fetch actual data from API
                const response = await fetch(apiUrl);
                console.log('📡 API response received:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
                }
                
                const contentType = response.headers.get('content-type');
                console.log('📋 Content-Type:', contentType);
                
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Response is not valid JSON. Please check the API URL.');
                }
                
                const data = await response.json();
                console.log('📊 JSON data parsed successfully:', {
                    type: Array.isArray(data) ? 'array' : typeof data,
                    hasItems: !!(data.items),
                    itemCount: Array.isArray(data) ? data.length : (data.items ? data.items.length : 'N/A')
                });
                
                // Validate JSON structure
                if (!isValidOmekaResponse(data)) {
                    console.error('❌ Invalid Omeka S response structure');
                    throw new Error('Invalid Omeka S API response format. Expected an array or object with items.');
                }
                
                console.log('✅ JSON structure validation passed');
                
                // Store fetched data
                state.fetchedData = data;
                console.log('💾 Fetched data stored in state');
                
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
                    state.selectedExample = selectedExample;
                    console.log('🎯 Example item automatically selected:', {
                        hasId: !!(selectedExample['@id'] || selectedExample['o:id']),
                        hasType: !!(selectedExample['@type']),
                        propertyCount: Object.keys(selectedExample).length
                    });
                    
                    // Mark step 1 as completed
                    const currentState = state.getState();
                    const newHighestStep = Math.max(currentState.highestCompletedStep, 1);
                    state.updateState('highestCompletedStep', newHighestStep);
                    console.log('🏁 Step 1 marked as completed, highest completed step:', newHighestStep);
                }
                
                // Update UI
                displayData(state.fetchedData);
                console.log('🎨 UI updated with fetched data');
                
                // Show raw JSON button
                if (viewRawJsonBtn) {
                    viewRawJsonBtn.style.display = 'inline-block';
                    console.log('👀 Raw JSON button enabled');
                }
                
                // Enable continue to mapping button
                if (proceedToMappingBtn) {
                    proceedToMappingBtn.disabled = false;
                    console.log('▶️ Continue to Mapping button enabled');
                }
                
                console.log('🎉 Data fetch completed successfully!');
                
            } catch (error) {
                console.error('❌ Error during data fetch:', error);
                console.log('🧹 Cleaning up after error...');
                
                const errorMsg = error.message || 'Error fetching data. Please check the API URL and try again.';
                alert(errorMsg);
                
                // Clear any partial data
                state.fetchedData = null;
                state.selectedExample = null;
                if (dataStatus) dataStatus.innerHTML = '';
                if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'none';
                if (proceedToMappingBtn) proceedToMappingBtn.disabled = true;
                
                console.log('🔄 State and UI reset after error');
                
            } finally {
                // Hide loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                console.log('⏳ Loading indicator hidden');
            }
        });
    }
    
    // Continue to mapping button
    if (proceedToMappingBtn) {
        proceedToMappingBtn.addEventListener('click', () => {
            console.log('➡️ Continue to Mapping button clicked');
            
            if (!state.fetchedData || !state.selectedExample) {
                console.warn('⚠️ Cannot proceed: missing data or example');
                console.log('📊 Current state:', {
                    hasFetchedData: !!state.fetchedData,
                    hasSelectedExample: !!state.selectedExample
                });
                alert('Please fetch data first');
                return;
            }
            
            console.log('✅ Validation passed, navigating to Step 2');
            
            // Navigate to step 2
            state.setCurrentStep(2);
            console.log('🎯 Navigation to Step 2 completed');
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
}