/**
 * Handles the Input step functionality
 */
export function setupInputStep(state) {
    const apiUrlInput = document.getElementById('api-url');
    const apiKeyInput = document.getElementById('api-key');
    const paginationInput = document.getElementById('pagination');
    const fetchDataBtn = document.getElementById('fetch-data');
    const loadingIndicator = document.getElementById('loading');
    const jsonTreeView = document.getElementById('json-tree-view');
    const rawJsonView = document.getElementById('raw-json');
    const jsonContent = document.getElementById('json-content');
    const toggleJsonViewBtn = document.getElementById('toggle-json-view');
    const selectExampleBtn = document.getElementById('select-example');
    const proceedToMappingBtn = document.getElementById('proceed-to-mapping');
    
    // Toggle between tree view and raw JSON view
    if (toggleJsonViewBtn) {
        toggleJsonViewBtn.addEventListener('click', () => {
            jsonTreeView.classList.toggle('hidden');
            rawJsonView.classList.toggle('hidden');
            
            toggleJsonViewBtn.textContent = jsonTreeView.classList.contains('hidden') 
                ? 'Show Tree View'
                : 'Show Raw JSON';
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
                // Update state
                state.apiUrl = apiUrl;
                if (apiKeyInput) state.apiKey = apiKeyInput.value.trim();
                if (paginationInput) state.pagination = parseInt(paginationInput.value, 10) || 10;
                
                // Show loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'block';
                
                // TODO: Implement actual API fetch
                // For wireframe, use dummy data
                await simulateFetch();
                
                // Update UI
                displayData(getDummyData());
                
                // Enable select example button
                if (selectExampleBtn) selectExampleBtn.disabled = false;
                
            } catch (error) {
                console.error('Error fetching data:', error);
                alert('Error fetching data. Please check the API URL and try again.');
            } finally {
                // Hide loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
        });
    }
    
    // Select example object
    if (selectExampleBtn) {
        selectExampleBtn.addEventListener('click', () => {
            // For wireframe, select dummy example
            state.selectedExample = getDummyData().items[0];
            
            // Enable proceed button
            if (proceedToMappingBtn) proceedToMappingBtn.disabled = false;
            
            alert('Example object selected');
        });
    }
    
    // Helper function to simulate API fetch delay
    function simulateFetch() {
        return new Promise(resolve => {
            setTimeout(() => {
                state.fetchedData = getDummyData();
                resolve();
            }, 1000);
        });
    }
    
    // Helper function to display data
    function displayData(data) {
        if (jsonContent) {
            jsonContent.textContent = JSON.stringify(data, null, 2);
        }
        
        if (jsonTreeView) {
            // Simple tree view for wireframe
            jsonTreeView.innerHTML = '<div class="json-tree-node">JSON Tree Structure (Placeholder)</div>';
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