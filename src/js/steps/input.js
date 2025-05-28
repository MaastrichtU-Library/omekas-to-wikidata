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
                // Update state
                state.apiUrl = apiUrl;
                // Advanced parameters removed for MVP
                
                // Show loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'block';
                
                // TODO: Implement actual API fetch
                // For wireframe, use dummy data
                await simulateFetch();
                
                // Update UI
                displayData(state.fetchedData);
                
                // Show raw JSON button
                if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'inline-block';
                
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
        if (dataStatus) {
            // Show simple data status instead of complex tree view
            const itemCount = data.items ? data.items.length : 0;
            const propertyCount = data.items && data.items[0] ? Object.keys(data.items[0]).length : 0;
            
            dataStatus.innerHTML = `
                <div class="data-summary">
                    <p><strong>✅ Data loaded successfully</strong></p>
                    <ul>
                        <li>Items found: ${itemCount}</li>
                        <li>Properties per item: ${propertyCount}</li>
                    </ul>
                    <p><em>Click "View Raw JSON" to see the full data structure.</em></p>
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