/**
 * Handles the Input step functionality - data ingestion and validation gateway
 * 
 * This module manages the critical first step of data acquisition from Omeka S instances.
 * It handles the complexity of web-based data fetching including:
 * - Cross-Origin Resource Sharing (CORS) challenges and proxy fallbacks
 * - Omeka S API endpoint validation and data format verification
 * - Manual JSON input as an alternative to API fetching
 * - Comprehensive error handling with user-friendly explanations
 * - Data structure validation to ensure compatibility with mapping step
 * 
 * The input step is the foundation of the entire workflow - invalid or incomplete
 * data here will cause problems throughout the subsequent mapping, reconciliation,
 * and export processes.
 * 
 * CORS Handling Strategy:
 * Web browsers prevent direct access to many Omeka S instances due to CORS policies.
 * This module implements a sophisticated fallback system using multiple proxy services
 * to ensure data access while maintaining security and transparency.
 * 
 * @module input
 */
import { eventSystem } from '../events.js';
import { fetchWithCorsProxy, getCorsExplanation, getAdminEmailTemplate } from '../utils/cors-proxy.js';
import { createButton, createElement } from '../ui/components.js';

function normalizeItems(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (data?.items && Array.isArray(data.items)) {
        return data.items;
    }

    if (data && typeof data === 'object') {
        return [data];
    }

    return [];
}

function getSelectedExampleFromData(data) {
    const items = normalizeItems(data);
    return items[0] || null;
}

function wrapItemsLikeOriginalData(originalData, filteredItems) {
    if (Array.isArray(originalData)) {
        return filteredItems;
    }

    if (originalData?.items && Array.isArray(originalData.items)) {
        return {
            ...originalData,
            items: filteredItems
        };
    }

    return filteredItems[0] || null;
}

function getResourceTemplateId(resourceTemplate) {
    if (!resourceTemplate) {
        return '';
    }

    const rawId = (
        typeof resourceTemplate === 'object'
            ? (resourceTemplate['o:id'] || resourceTemplate['@id'] || resourceTemplate.id)
            : resourceTemplate
    );

    if (typeof rawId === 'number') {
        return String(rawId);
    }

    if (typeof rawId === 'string') {
        return rawId.includes('/') ? rawId.split('/').pop() : rawId;
    }

    return rawId ? JSON.stringify(rawId) : '';
}

/**
 * Initializes the input step interface with comprehensive data acquisition capabilities
 * 
 * This function sets up the data ingestion interface that handles both automated
 * API fetching and manual JSON input. It provides sophisticated error handling
 * and validation to ensure only compatible data proceeds to the mapping step.
 * 
 * The function handles multiple input methods:
 * - Direct Omeka S API fetching with URL validation
 * - CORS proxy fallback for restricted instances
 * - Manual JSON paste for offline or problematic sources
 * - Data format validation and structure verification
 * 
 * @param {Object} state - Application state management instance
 * @param {Function} state.updateState - Updates application state with fetched data
 * @param {Function} state.getState - Retrieves current application state
 * @param {Function} state.markChangesUnsaved - Marks data changes as unsaved
 * 
 * @description
 * Input validation pipeline:
 * 1. URL format validation (must be valid Omeka S API endpoint)
 * 2. CORS-aware fetching with automatic proxy fallback
 * 3. JSON structure validation (must contain expected Omeka S format)
 * 4. Content analysis (must contain actual items with properties)
 * 5. State persistence and UI updates for successful data acquisition
 */
export function setupInputStep(state) {
    const apiUrlInput = document.getElementById('api-url');
    const defaultApiUrl = apiUrlInput?.value || '';
    // Advanced parameters removed for MVP
    // const apiKeyInput = document.getElementById('api-key');
    // const paginationInput = document.getElementById('pagination');
    const fetchDataBtn = document.getElementById('fetch-data');
    const loadingIndicator = document.getElementById('loading');
    const dataStatus = document.getElementById('data-status');
    const viewRawJsonBtn = document.getElementById('view-raw-json');
    const proceedToMappingBtn = document.getElementById('proceed-to-mapping');
    
    // Manual JSON input elements
    const manualJsonButton = document.getElementById('manual-json-button');
    const manualJsonArea = document.getElementById('manual-json-area');
    const manualJsonTextarea = document.getElementById('manual-json-textarea');
    const processManualJsonButton = document.getElementById('process-manual-json-button');
    const cancelManualJsonButton = document.getElementById('cancel-manual-json');

    function updateActiveInputData(data, markUnsaved = true) {
        state.updateState('fetchedData', data, markUnsaved);
        state.updateState('selectedExample', getSelectedExampleFromData(data), markUnsaved);
    }

    function hasExistingProjectData() {
        const currentState = state.getState();
        const mappings = currentState.mappings || {};
        const references = currentState.references || {};

        const hasMappings =
            (mappings.nonLinkedKeys?.length || 0) > 0 ||
            (mappings.mappedKeys?.length || 0) > 0 ||
            (mappings.ignoredKeys?.length || 0) > 0;
        const hasReconciliation = Object.keys(currentState.reconciliationData || {}).length > 0;
        const hasReferences =
            Object.keys(references.itemReferences || {}).length > 0 ||
            Object.keys(references.propertyReferences || {}).length > 0 ||
            (references.customReferences?.length || 0) > 0;
        const hasLinkedItems = Object.keys(currentState.linkedItems || {}).length > 0;

        return Boolean(
            currentState.fetchedData ||
            hasMappings ||
            hasReconciliation ||
            hasReferences ||
            hasLinkedItems ||
            currentState.quickStatements
        );
    }

    function confirmProjectReplacement(preservedApiUrl = '') {
        if (!hasExistingProjectData()) {
            return true;
        }

        const confirmed = window.confirm(
            'Loading new data will replace the current project and clear existing mappings, reconciliation, references, and export data. Do you want to continue?'
        );

        if (!confirmed) {
            return false;
        }

        state.resetState({
            preserveTestMode: true,
            apiUrl: preservedApiUrl
        });

        if (apiUrlInput) {
            apiUrlInput.value = preservedApiUrl || defaultApiUrl;
        }

        return true;
    }
    
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

                if (!confirmProjectReplacement(apiUrl)) {
                    return;
                }
                
                // Update state
                state.updateState('apiUrl', apiUrl);
                
                // Show loading indicator
                if (loadingIndicator) loadingIndicator.style.display = 'block';
                
                // Update status to show we're attempting to fetch
                if (dataStatus) {
                    dataStatus.innerHTML = '<p>Attempting to fetch data...</p>';
                }

                // First, attempt to fetch resource templates to have proper names and order
                let resourceTemplates = [];
                state.updateState('resourceTemplates', resourceTemplates, false);
                try {
                    const baseUrl = apiUrl.split('/api/')[0];
                    const templatesUrl = `${baseUrl}/api/resource_templates`;
                    const templatesResult = await fetchWithCorsProxy(templatesUrl);
                    if (templatesResult.success && Array.isArray(templatesResult.data)) {
                        resourceTemplates = templatesResult.data;
                        state.updateState('resourceTemplates', resourceTemplates, false);
                        console.log(`Successfully fetched ${resourceTemplates.length} resource templates`);
                    }
                } catch (templateError) {
                    console.warn('Could not fetch resource templates, falling back to basic naming:', templateError);
                }
                
                // Fetch data using CORS proxy fallback system
                const result = await fetchWithCorsProxy(apiUrl);
                const data = result.data;

                // Validate JSON structure
                if (!isValidOmekaResponse(data)) {
                    throw new Error('Invalid Omeka S API response format. Expected an array or object with items.');
                }
                
                // Process the successful data
                processSuccessfulData(data, result.method, {
                    proxyUsed: result.proxyUsed || null
                });
                
            } catch (error) {
                console.error('Error fetching data:', error);
                
                // Display comprehensive error information with solutions
                if (dataStatus) {
                    displayCorsError(error, apiUrl);
                }
                
                // Clear any partial data
                state.updateState('allFetchedData', null, false);
                state.updateState('resourceTemplates', [], false);
                state.updateState('selectedTemplates', [], false);
                state.updateState('fetchedData', null);
                state.updateState('selectedExample', null);
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
    
    // Manual JSON input button
    if (manualJsonButton) {
        manualJsonButton.addEventListener('click', () => {
            showManualJsonInput();
        });
    }
    
    // Process manual JSON button
    if (processManualJsonButton) {
        processManualJsonButton.addEventListener('click', () => {
            processManualJsonInput();
        });
    }
    
    // Cancel manual JSON button
    if (cancelManualJsonButton) {
        cancelManualJsonButton.addEventListener('click', () => {
            hideManualJsonInput();
        });
    }
    
    // Helper functions for manual JSON input
    function showManualJsonInput() {
        if (manualJsonArea) {
            manualJsonArea.style.display = 'block';
            manualJsonTextarea.focus();
            
            // Clear any existing data status
            if (dataStatus) {
                dataStatus.innerHTML = '<p class="placeholder">Paste your JSON data above and click "Process JSON Data"</p>';
            }
            
            // Hide other UI elements
            if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'none';
            if (proceedToMappingBtn) proceedToMappingBtn.disabled = true;
        }
    }
    
    function hideManualJsonInput() {
        if (manualJsonArea) {
            manualJsonArea.style.display = 'none';
            manualJsonTextarea.value = '';
            
            // Restore data status if there was previous data
            const currentState = state.getState();
            if (currentState.fetchedData) {
                displayData(currentState.allFetchedData || currentState.fetchedData, 'restored');
                if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'inline-block';
            } else {
                if (dataStatus) {
                    dataStatus.innerHTML = '<p class="placeholder">Data status will appear here after fetching</p>';
                }
            }
        }
    }
    
    function processManualJsonInput() {
        const jsonText = manualJsonTextarea.value.trim();
        const preservedApiUrl = apiUrlInput?.value.trim() || '';
        
        if (!jsonText) {
            alert('Please paste JSON data first');
            return;
        }
        
        try {
            const data = JSON.parse(jsonText);
            
            // Validate the data
            if (!isValidOmekaResponse(data)) {
                throw new Error('Invalid Omeka S API response format. Expected an array or object with items.');
            }

            if (!confirmProjectReplacement(preservedApiUrl)) {
                return;
            }
            
            // Process the manually entered data
            state.updateState('resourceTemplates', [], false);
            processSuccessfulData(data, 'manual');
            
            // Hide the manual input area
            hideManualJsonInput();
            
        } catch (parseError) {
            alert(`Invalid JSON data: ${parseError.message}`);
        }
    }

    /**
     * Validates Omeka S API URL format and accessibility requirements
     * 
     * This function performs basic URL validation to ensure the provided endpoint
     * meets minimum requirements for API access. It checks protocol security and
     * format validity but cannot verify actual endpoint functionality due to CORS.
     * 
     * @param {string} url - User-provided API URL to validate
     * @returns {boolean} True if URL meets basic validation criteria
     * 
     * @example
     * isValidApiUrl("https://example.com/api/items") // true
     * isValidApiUrl("ftp://example.com/api") // false
     * 
     * @description
     * Validation criteria:
     * - Must be a valid URL format (parseable by URL constructor)
     * - Must use HTTP or HTTPS protocol (no file:// or other schemes)
     * - No validation of endpoint existence (would require CORS-breaking requests)
     * 
     * This basic validation prevents obvious errors but actual API compatibility
     * is verified during the fetchWithCorsProxy attempt.
     */
    function isValidApiUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    /**
     * Validates Omeka S API response structure and content requirements
     * 
     * This function performs comprehensive validation of fetched JSON data to ensure
     * it matches expected Omeka S API formats. The validation is critical because
     * downstream processes depend on specific data structures and properties.
     * 
     * Omeka S APIs can return data in multiple formats:
     * - Direct array of item objects
     * - Wrapper object with 'items' array property
     * - Single item object (for specific item requests)
     * 
     * @param {any} data - JSON data retrieved from API endpoint
     * @returns {boolean} True if data structure is compatible with the mapping system
     * 
     * @description
     * Validation requirements:
     * - Must be valid JSON (already parsed at this point)
     * - Must contain at least one item object
     * - Items must be objects (not primitives)
     * - Items must have property keys beyond just JSON-LD system keys (@context, @id, @type)
     * - Must have mappable metadata properties for the workflow to be meaningful
     * 
     * The validation ensures data quality while being flexible enough to handle
     * different Omeka S export formats and configurations.
     */
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
    
    /**
     * Displays comprehensive CORS error information with actionable solutions
     * 
     * When data fetching fails due to CORS restrictions or other access issues,
     * this function provides detailed explanations and practical solutions for users.
     * It goes beyond generic error messages to educate users about CORS and provide
     * specific steps they can take to resolve access issues.
     * 
     * @param {Error} error - The error object from failed fetch attempt
     * @param {string} apiUrl - The API URL that failed to fetch
     * 
     * @description
     * Error handling strategy:
     * - Provides clear explanation of CORS and why it affects data access
     * - Offers multiple solution paths (manual JSON, admin contact, proxy services)
     * - Generates ready-to-send email templates for contacting Omeka S administrators
     * - Explains technical concepts in user-friendly language
     * - Maintains trust by explaining data privacy and security considerations
     * 
     * The comprehensive error handling reduces user frustration and provides
     * clear paths forward when technical issues arise.
     */
    function displayCorsError(error, apiUrl) {
        const explanation = getCorsExplanation();
        
        dataStatus.innerHTML = `
            <div class="error-container">
                <div class="error-header">
                    <h3>❌ Unable to Access API</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                </div>
                
                <div class="error-explanation">
                    <h4>What's happening?</h4>
                    <p>${explanation.what}</p>
                    <p>${explanation.why}</p>
                </div>
                
                <div class="error-solutions">
                    <h4>Solutions:</h4>
                    <div class="solution-buttons">
                        <button id="try-manual-input" class="solution-btn primary">
                            📋 Use Manual Data Entry
                        </button>
                        <button id="show-admin-help" class="solution-btn">
                            👤 Contact Administrator
                        </button>
                        <button id="retry-fetch" class="solution-btn">
                            🔄 Try Again
                        </button>
                    </div>
                </div>
                
                
                <div id="admin-help-area" class="admin-help-area" style="display: none;">
                    <h4>Administrator Contact Template</h4>
                    <p>Send this message to your Omeka S administrator:</p>
                    <div class="email-template">
                        <div class="template-field">
                            <label>Subject:</label>
                            <input type="text" id="email-subject" readonly value="Request to Enable CORS Headers for Omeka S API Access">
                            <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">📋 Copy</button>
                        </div>
                        <div class="template-field">
                            <label>Message:</label>
                            <textarea id="email-body" readonly rows="12"></textarea>
                            <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value)">📋 Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Set up event listeners for solution buttons
        setupErrorSolutionListeners(apiUrl);
    }
    
    // Helper function to set up event listeners for error solution buttons
    function setupErrorSolutionListeners(apiUrl) {
        const tryManualBtn = document.getElementById('try-manual-input');
        const showAdminBtn = document.getElementById('show-admin-help');
        const retryBtn = document.getElementById('retry-fetch');
        
        if (tryManualBtn) {
            tryManualBtn.addEventListener('click', () => {
                // Hide the error display and show the manual JSON input
                dataStatus.innerHTML = '<p class="placeholder">Use the "📋 Enter JSON manually" button above to input your data</p>';
                showManualJsonInput();
            });
        }
        
        if (showAdminBtn) {
            showAdminBtn.addEventListener('click', () => {
                document.getElementById('admin-help-area').style.display = 'block';
                document.getElementById('manual-input-area').style.display = 'none';
                
                // Populate email template
                const template = getAdminEmailTemplate(window.location.origin);
                document.getElementById('email-subject').value = template.subject;
                document.getElementById('email-body').value = template.body;
            });
        }
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                // Trigger the fetch button click to retry
                document.getElementById('fetch-data').click();
            });
        }
        
    }
    
    /**
     * Processes validated data for use throughout the application workflow
     * 
     * This function handles successful data acquisition from either automatic API
     * fetching or manual JSON input. It performs final processing and state updates
     * to make the data available for the mapping step.
     * 
     * @param {Object|Array} data - Validated Omeka S data structure
     * @param {string} method - How data was acquired ('direct', 'proxy', 'manual')
     * 
     * @description
     * Processing steps:
     * 1. Stores validated data in application state
     * 2. Prepares active data for optional template-based filtering
     * 3. Updates interface to show successful data acquisition
     * 4. Enables navigation to mapping step when the active selection is valid
     * 5. Provides user feedback about data size and characteristics
     * 
     * The function serves as the gateway between data acquisition and the core
     * mapping workflow, ensuring all subsequent steps have access to properly
     * formatted and validated data.
     */
    function processSuccessfulData(data, method = 'direct', details = {}) {
        // Preserve the original dataset while the active working dataset may be filtered by template
        state.updateState('selectedTemplates', [], false);
        state.updateState('allFetchedData', data, false);
        state.updateState('fetchedData', data, false);
        state.updateState('selectedExample', null, false);

        // Update UI
        displayData(data, method, details);

        // Show raw JSON button
        if (viewRawJsonBtn) viewRawJsonBtn.style.display = 'inline-block';

        // Note: proceed button will be enabled/disabled by template selection UI
    }

    // Helper function to display data
    function displayData(data, method = 'direct', details = {}) {
        if (!dataStatus) {
            return;
        }

        const itemsArray = normalizeItems(data);
        const itemCount = itemsArray.length;
        const sampleItem = itemsArray[0] || null;
        const propertyCount = sampleItem && typeof sampleItem === 'object'
            ? Object.keys(sampleItem).length
            : 0;

        let sampleProperties = [];
        if (sampleItem) {
            const keys = Object.keys(sampleItem);
            sampleProperties = keys.slice(0, 5);
        }

        let methodMessage = '';
        if (method === 'manual') {
            methodMessage = 'Data processed from manual input';
        } else if (method === 'direct') {
            methodMessage = 'Data loaded successfully via direct connection';
        } else if (method === 'proxy') {
            methodMessage = 'Data loaded successfully via CORS proxy';
        } else if (method === 'restored') {
            methodMessage = 'Data restored from previous session';
        }

        const templateStats = new Map();
        const allTemplates = state.getState().resourceTemplates || [];

        itemsArray.forEach(item => {
            const resourceTemplate = item?.['o:resource_template'];
            if (!resourceTemplate) {
                return;
            }

            const id = getResourceTemplateId(resourceTemplate);
            let label = '';
            const templateDefinition = allTemplates.find(template => String(template['o:id']) === id);

            if (templateDefinition) {
                label = templateDefinition['o:label'] || '';
            }

            if (!label && typeof resourceTemplate === 'object') {
                label = resourceTemplate['o:label'] || resourceTemplate.label || '';
            }

            if (!label && Array.isArray(item?.['@type'])) {
                const genericTypes = new Set(['o:Item', 'o:Resource', 'o:Media']);
                const candidate = item['@type'].find(type => typeof type === 'string' && !genericTypes.has(type));
                if (candidate) {
                    label = candidate;
                }
            }

            const key = id || 'unknown';
            const entry = templateStats.get(key) || { count: 0, id, label };
            entry.count += 1;
            if (!entry.label && label) {
                entry.label = label;
            }
            templateStats.set(key, entry);
        });

        const currentState = state.getState();
        const selectedTemplateIds = new Set(currentState.selectedTemplates || []);
        const templateEntries = Array.from(templateStats.values()).sort((a, b) => b.count - a.count);

        const summaryContainer = createElement('div', { className: 'data-summary' });
        summaryContainer.appendChild(
            createElement('p', {}, [
                createElement('strong', {}, methodMessage)
            ])
        );

        if (method === 'proxy' && details.proxyUsed) {
            summaryContainer.appendChild(
                createElement('p', { className: 'proxy-success-message' }, `Proxy used: ${details.proxyUsed}`)
            );
        }

        const summaryList = createElement('ul');
        summaryList.appendChild(createElement('li', {}, `Items found: ${itemCount}`));
        summaryList.appendChild(createElement('li', {}, `Properties per item: ${propertyCount}`));
        if (sampleProperties.length > 0) {
            const suffix = propertyCount > 5 ? '...' : '';
            summaryList.appendChild(
                createElement('li', {}, `Sample properties: ${sampleProperties.join(', ')}${suffix}`)
            );
        }
        summaryContainer.appendChild(summaryList);

        if (templateEntries.length > 0) {
            const templateSection = createElement('div', { className: 'template-selection' });
            templateSection.appendChild(createElement('h4', {}, 'Items by resource template'));

            const templateChoices = createElement('div', { className: 'template-choices' });
            const checkboxes = templateEntries.map(templateEntry => {
                const checkbox = createElement('input', {
                    type: 'checkbox',
                    className: 'template-checkbox',
                    dataset: {
                        templateId: templateEntry.id
                    }
                });
                checkbox.checked = selectedTemplateIds.has(templateEntry.id);

                const templateName = templateEntry.label?.trim()
                    ? `Resource Template ID=${templateEntry.id} (${templateEntry.label.trim()})`
                    : `Resource Template ID=${templateEntry.id}`;

                templateChoices.appendChild(
                    createElement('label', { className: 'template-choice' }, [
                        checkbox,
                        ` ${templateName} `,
                        createElement('span', { className: 'muted' }, `(${templateEntry.count} items)`)
                    ])
                );

                return checkbox;
            });
            templateSection.appendChild(templateChoices);

            const templateActions = createElement('div', {
                className: 'template-actions',
                style: {
                    marginTop: '8px'
                }
            });
            const selectAllButton = createButton('Select all', {
                id: 'select-all-templates'
            });
            const clearButton = createButton('Clear', {
                id: 'clear-template-selection'
            });
            templateActions.appendChild(selectAllButton);
            templateActions.appendChild(clearButton);
            templateSection.appendChild(templateActions);

            templateSection.appendChild(
                createElement('p', { className: 'hint' }, [
                    createElement('em', {}, 'Select which template(s) to include. Proceeding will only use items from the selected template(s).')
                ])
            );
            summaryContainer.appendChild(templateSection);

            const recompute = () => {
                const selectedIds = checkboxes
                    .filter(checkbox => checkbox.checked)
                    .map(checkbox => checkbox.dataset.templateId);

                state.updateState('selectedTemplates', selectedIds, false);

                if (selectedIds.length === 0) {
                    state.updateState('fetchedData', state.getState().allFetchedData, false);
                    state.updateState('selectedExample', null, false);
                    if (proceedToMappingBtn) {
                        proceedToMappingBtn.disabled = true;
                    }
                    return;
                }

                const filteredItems = itemsArray.filter(item => {
                    const templateId = getResourceTemplateId(item?.['o:resource_template']);
                    return selectedIds.includes(templateId);
                });
                const filteredData = wrapItemsLikeOriginalData(data, filteredItems);
                updateActiveInputData(filteredData);
                state.completeStep(1);

                if (proceedToMappingBtn) {
                    proceedToMappingBtn.disabled = filteredItems.length === 0;
                }
            };

            checkboxes.forEach(checkbox => checkbox.addEventListener('change', recompute));
            selectAllButton.addEventListener('click', () => {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                });
                recompute();
            });
            clearButton.addEventListener('click', () => {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
                recompute();
            });

            if (selectedTemplateIds.size > 0) {
                recompute();
            } else if (templateEntries.length === 1 && checkboxes[0]) {
                checkboxes[0].checked = true;
                recompute();
            } else if (proceedToMappingBtn) {
                proceedToMappingBtn.disabled = true;
            }
        } else {
            summaryContainer.appendChild(
                createElement('p', { className: 'hint' }, [
                    createElement('em', {}, 'No resource template metadata detected. All items will be used.')
                ])
            );
            updateActiveInputData(data, false);
            state.completeStep(1);
            if (proceedToMappingBtn) {
                proceedToMappingBtn.disabled = false;
            }
        }

        summaryContainer.appendChild(
            createElement('p', {}, [
                createElement('em', {}, 'Click "Continue to Mapping" to proceed, or "View Raw JSON" to see the full structure.')
            ])
        );

        dataStatus.innerHTML = '';
        dataStatus.appendChild(summaryContainer);
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
        if (apiUrlInput && currentState.apiUrl) {
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
        } else {
            if (apiUrlInput && !currentState.apiUrl) {
                apiUrlInput.value = defaultApiUrl;
            }
            if (dataStatus) {
                dataStatus.innerHTML = '<p class="placeholder">Data status will appear here after fetching</p>';
            }
            if (viewRawJsonBtn) {
                viewRawJsonBtn.style.display = 'none';
            }
            if (proceedToMappingBtn) {
                proceedToMappingBtn.disabled = true;
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
