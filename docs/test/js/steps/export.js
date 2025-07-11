/**
 * Handles the Export step functionality
 */
import { createDownloadLink, createFileInput, createElement, createButton, showMessage } from '../ui/components.js';
import { eventSystem } from '../events.js';

// Constants for validation
const PROPERTY_ID_REGEX = /^[PS]\d+$/;  // Matches P123, S456 (Wikidata properties)
const LANGUAGE_PROPERTY_REGEX = /^[LDA][a-z]{2,3}(-[a-z]+)?$/;  // Matches Len, Den, Amul, Lde-ch (language-specific labels/descriptions/aliases)

export function setupExportStep(state) {
    const quickStatementsTextarea = document.getElementById('quick-statements');
    const copyQuickStatementsBtn = document.getElementById('copy-quick-statements');
    // JSON export/import removed for MVP
    // const downloadJsonBtn = document.getElementById('download-json');
    // const importJsonBtn = document.getElementById('import-json');
    
    // Initialize export when entering this step
    document.addEventListener('DOMContentLoaded', () => {
        // Check if we're already on step 5 (e.g., from restored state)
        const currentState = state.getState();
        if (currentState.currentStep === 5) {
            initializeExport();
        }
        
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 5) {
                    initializeExport();
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-export')?.addEventListener('click', () => {
            initializeExport();
        });
    });
    
    // Listen for step change events
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 5) {
            initializeExport();
        }
    });
    
    // Copy QuickStatements button
    if (copyQuickStatementsBtn) {
        copyQuickStatementsBtn.addEventListener('click', () => {
            copyQuickStatements();
        });
    }
    
    // Download QuickStatements button
    const downloadQuickStatementsBtn = document.getElementById('download-quick-statements');
    if (downloadQuickStatementsBtn) {
        downloadQuickStatementsBtn.addEventListener('click', () => {
            downloadQuickStatements();
        });
    }
    
    // Open QuickStatements button
    const openQuickStatementsBtn = document.getElementById('open-quick-statements');
    if (openQuickStatementsBtn) {
        openQuickStatementsBtn.addEventListener('click', () => {
            openQuickStatements();
        });
    }
    
    // JSON export/import functionality removed for MVP
    
    // Initialize export
    function initializeExport() {
        // Generate QuickStatements directly
        generateQuickStatements();
    }
    
    // Utility function to escape strings for QuickStatements
    function escapeQuickStatementsString(str) {
        if (!str) return '""';
        // Escape quotes and handle special characters
        return `"${str.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
    }
    
    // Format dates for QuickStatements
    function formatDate(dateString, precision = 11) {
        if (!dateString) return null;
        
        try {
            let date;
            if (dateString instanceof Date) {
                date = dateString;
            } else {
                date = new Date(dateString);
            }
            
            if (isNaN(date.getTime())) {
                return null;
            }
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            
            return `+${year}-${month}-${day}T00:00:00Z/${precision}`;
        } catch (error) {
            console.error('Error formatting date:', dateString, error);
            return null;
        }
    }
    
    // Format a single statement with references
    function formatStatement(itemId, propertyId, value, references = []) {
        if (!itemId || !propertyId || !value) {
            return null;
        }
        
        let statement = `${itemId}\t${propertyId}\t${value}`;
        
        // Add references
        if (references && references.length > 0) {
            references.forEach(ref => {
                if (ref.url) {
                    statement += `\tS854\t${escapeQuickStatementsString(ref.url)}`;
                }
                if (ref.retrievedDate) {
                    const formattedDate = formatDate(ref.retrievedDate);
                    if (formattedDate) {
                        statement += `\tS813\t${formattedDate}`;
                    }
                }
            });
        }
        
        return statement;
    }
    
    // Validate QuickStatements syntax
    function validateQuickStatements(statements) {
        const errors = [];
        const warnings = [];
        
        if (!statements || statements.trim() === '') {
            errors.push('No statements to validate');
            return { isValid: false, errors, warnings };
        }
        
        const lines = statements.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const trimmedLine = line.trim();
            
            if (trimmedLine === 'CREATE' || trimmedLine === 'LAST') {
                // Valid command lines
                return;
            }
            
            const parts = trimmedLine.split('\t');
            
            if (parts.length < 3) {
                errors.push(`Line ${lineNum}: Invalid format - expected at least 3 tab-separated parts`);
                return;
            }
            
            // Validate item ID (first part)
            const itemId = parts[0];
            if (itemId !== 'LAST' && !itemId.match(/^Q\d+$/)) {
                errors.push(`Line ${lineNum}: Invalid item ID '${itemId}' - should be Q followed by numbers`);
            }
            
            // Validate property ID (second part)
            const propertyId = parts[1];
            // Allow special properties for labels (Len) and descriptions (Den) where n is language code
            if (!propertyId.match(PROPERTY_ID_REGEX) && !propertyId.match(LANGUAGE_PROPERTY_REGEX)) {
                errors.push(`Line ${lineNum}: Invalid property ID '${propertyId}' - should be P or S followed by numbers, or L/D followed by language code`);
            }
            
            // Validate value format (third part)
            const value = parts[2];
            if (value.startsWith('"') && !value.endsWith('"')) {
                errors.push(`Line ${lineNum}: Unclosed string value`);
            }
            
            if (value.match(/^Q\d+$/) && value === 'Q0') {
                warnings.push(`Line ${lineNum}: Q0 is not a valid item ID`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Extract label or description value from item data with fallback to original fetched data
     * 
     * This function implements a two-stage fallback strategy:
     * 1. First tries to get the value from reconciled data (user has explicitly matched/selected values)
     * 2. Falls back to the original fetched data if no reconciled value exists
     * 
     * @param {Object} itemData - The item's reconciled data containing properties and their matches
     * @param {string} propertyKey - The key/field name to extract the value from
     * @param {Array} fetchedData - The original fetched data array from Omeka S
     * @param {string} itemId - The item identifier in format "item-N" where N is the index
     * @returns {string|null} The extracted value or null if not found
     */
    function getLabelOrDescriptionValue(itemData, propertyKey, fetchedData, itemId) {
        // Stage 1: Try to get from reconciled data (preferred source)
        // This contains user-selected matches from the reconciliation process
        if (itemData.properties && itemData.properties[propertyKey]) {
            const propertyData = itemData.properties[propertyKey];
            if (propertyData.reconciled && propertyData.reconciled[0] && propertyData.reconciled[0].selectedMatch) {
                // Return the matched value if available, otherwise the original value
                return propertyData.reconciled[0].selectedMatch.value || propertyData.reconciled[0].original;
            }
        }
        
        // Stage 2: Fall back to original fetched data
        // This is the raw data from Omeka S before any reconciliation
        if (fetchedData && Array.isArray(fetchedData)) {
            // Extract numeric index from itemId (format: "item-0", "item-1", etc.)
            const itemIndex = parseInt(itemId.replace('item-', ''));
            const originalItem = fetchedData[itemIndex];
            
            if (originalItem && originalItem[propertyKey] !== undefined && originalItem[propertyKey] !== null) {
                let value = originalItem[propertyKey];
                
                // Handle complex Omeka S value structures
                if (Array.isArray(value)) {
                    // Take first value if property contains multiple values
                    value = value[0];
                }
                if (typeof value === 'object' && value !== null) {
                    // Extract value from Omeka S value objects
                    // Try common Omeka S value properties in order of preference
                    value = value['@value'] || value['o:label'] || JSON.stringify(value);
                }
                
                return value;
            }
        }
        
        return null;
    }
    
    // Generate QuickStatements
    function generateQuickStatements() {
        if (!quickStatementsTextarea) return;
        
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData;
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        
        // Combine old-style references with new global references
        // Note: We don't filter by enabled anymore since we now use property-specific references
        const oldReferences = currentState.references || [];
        const globalReferences = currentState.globalReferences || [];
        const allReferences = [...oldReferences, ...globalReferences];
        
        const entitySchema = currentState.entitySchema;
        const designerData = currentState.designerData || {};
        
        if (!reconciliationData || Object.keys(reconciliationData).length === 0) {
            quickStatementsTextarea.value = 'No reconciliation data available. Please complete the reconciliation step.';
            updateValidationDisplay({ isValid: false, errors: ['No reconciliation data available'], warnings: [] });
            return;
        }
        
        let quickStatementsText = '';
        const errors = [];
        
        // Process each item
        Object.keys(reconciliationData).forEach(itemId => {
            const itemData = reconciliationData[itemId];
            
            try {
                // Always create new items
                quickStatementsText += 'CREATE\n';
                
                // Add labels for all configured languages
                const labelMappings = designerData.labelMappings || {};
                Object.keys(labelMappings).forEach(languageCode => {
                    const propertyKey = labelMappings[languageCode];
                    if (propertyKey) {
                        const labelValue = getLabelOrDescriptionValue(itemData, propertyKey, currentState.fetchedData, itemId);
                        if (labelValue) {
                            const langSuffix = languageCode === 'en' ? 'en' : languageCode;
                            quickStatementsText += `LAST\tL${langSuffix}\t${escapeQuickStatementsString(labelValue)}\n`;
                        }
                    }
                });
                
                // Add descriptions for all configured languages
                const descriptionMappings = designerData.descriptionMappings || {};
                Object.keys(descriptionMappings).forEach(languageCode => {
                    const propertyKey = descriptionMappings[languageCode];
                    if (propertyKey) {
                        const descriptionValue = getLabelOrDescriptionValue(itemData, propertyKey, currentState.fetchedData, itemId);
                        if (descriptionValue) {
                            const langSuffix = languageCode === 'en' ? 'en' : languageCode;
                            quickStatementsText += `LAST\tD${langSuffix}\t${escapeQuickStatementsString(descriptionValue)}\n`;
                        }
                    }
                });
                
                // Add aliases for all configured languages
                const aliasMappings = designerData.aliasMappings || {};
                Object.keys(aliasMappings).forEach(languageCode => {
                    const propertyKey = aliasMappings[languageCode];
                    if (propertyKey) {
                        const aliasValue = getLabelOrDescriptionValue(itemData, propertyKey, currentState.fetchedData, itemId);
                        if (aliasValue) {
                            const langSuffix = languageCode === 'en' ? 'en' : languageCode;
                            quickStatementsText += `LAST\tA${langSuffix}\t${escapeQuickStatementsString(aliasValue)}\n`;
                        }
                    }
                });
                
                // Add entity type from schema if available and valid
                // Only add P31 (instance of) if entitySchema is a valid Q-identifier
                if (entitySchema && entitySchema.match(/^Q\d+$/)) {
                    quickStatementsText += `LAST\tP31\t${entitySchema}\n`;
                }
                
                var itemPrefix = 'LAST';
                
                // Process each property
                Object.keys(itemData.properties).forEach(propertyKey => {
                    const propertyData = itemData.properties[propertyKey];
                    
                    // Find the corresponding mapping to get the Wikidata property ID
                    const mapping = mappedKeys.find(m => m.key === propertyKey);
                    const wikidataPropertyId = mapping?.property?.id || propertyKey;
                    
                    // Process each reconciled value
                    propertyData.reconciled.forEach(reconciledValue => {
                        if (reconciledValue.selectedMatch) {
                            const match = reconciledValue.selectedMatch;
                            let value = '';
                            
                            try {
                                if (match.type === 'wikidata') {
                                    value = match.id;
                                } else if (match.type === 'custom') {
                                    if (match.datatype === 'time') {
                                        value = formatDate(match.value);
                                        if (!value) {
                                            errors.push(`Invalid date format for ${propertyKey}: ${match.value}`);
                                            return;
                                        }
                                    } else {
                                        value = escapeQuickStatementsString(match.value);
                                    }
                                } else if (match.type === 'string') {
                                    // Handle string type reconciliation (from "Accept as String" option)
                                    value = escapeQuickStatementsString(match.value);
                                }
                                
                                if (value) {
                                    // Use property-specific references if available, otherwise use all global references
                                    let references = propertyData.references || allReferences;
                                    
                                    // Format the statement
                                    const statement = formatStatement(itemPrefix, wikidataPropertyId, value, references);
                                    if (statement) {
                                        quickStatementsText += statement + '\n';
                                    }
                                }
                            } catch (error) {
                                errors.push(`Error processing ${propertyKey}: ${error.message}`);
                            }
                        }
                    });
                });
                
                // Add separator between items
                quickStatementsText += '\n';
            } catch (error) {
                errors.push(`Error processing item ${itemId}: ${error.message}`);
            }
        });
        
        quickStatementsTextarea.value = quickStatementsText;
        
        // Validate the generated statements
        const validation = validateQuickStatements(quickStatementsText);
        if (errors.length > 0) {
            validation.errors = [...validation.errors, ...errors];
            validation.isValid = false;
        }
        
        updateValidationDisplay(validation);
    }
    
    // Update validation display
    function updateValidationDisplay(validation) {
        // Get or create validation display element
        let validationDisplay = document.getElementById('validation-display');
        if (!validationDisplay) {
            validationDisplay = createElement('div', {
                id: 'validation-display',
                className: 'validation-display'
            });
            const exportContainer = document.querySelector('.export-container');
            const quickStatementsOutput = document.querySelector('.quick-statements-output');
            exportContainer.insertBefore(validationDisplay, quickStatementsOutput.nextSibling);
        }
        
        validationDisplay.innerHTML = '';
        
        if (validation.isValid && validation.errors.length === 0) {
            // No success message needed - valid syntax is expected
        } else {
            if (validation.errors.length > 0) {
                const errorDiv = createElement('div', {
                    className: 'validation-errors'
                });
                errorDiv.appendChild(createElement('h4', {}, 'Errors:'));
                const errorList = createElement('ul', { className: 'error-list' });
                validation.errors.forEach(error => {
                    errorList.appendChild(createElement('li', {}, error));
                });
                errorDiv.appendChild(errorList);
                validationDisplay.appendChild(errorDiv);
            }
        }
        
        if (validation.warnings && validation.warnings.length > 0) {
            const warningDiv = createElement('div', {
                className: 'validation-warnings'
            });
            warningDiv.appendChild(createElement('h4', {}, 'Warnings:'));
            const warningList = createElement('ul', { className: 'warning-list' });
            validation.warnings.forEach(warning => {
                warningList.appendChild(createElement('li', {}, warning));
            });
            warningDiv.appendChild(warningList);
            validationDisplay.appendChild(warningDiv);
        }
    }
    
    // Copy QuickStatements to clipboard
    function copyQuickStatements() {
        if (!quickStatementsTextarea) return;
        
        try {
            quickStatementsTextarea.select();
            document.execCommand('copy');
            showMessage('QuickStatements copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            showMessage('Failed to copy to clipboard. Please select and copy manually.', 'error');
        }
    }
    
    // Download QuickStatements as .txt file
    function downloadQuickStatements() {
        if (!quickStatementsTextarea || !quickStatementsTextarea.value.trim()) {
            showMessage('No QuickStatements to download', 'error');
            return;
        }
        
        const content = quickStatementsTextarea.value;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `quickstatements-${timestamp}.txt`;
        
        const downloadLink = createDownloadLink(url, filename, {
            onClick: () => {
                setTimeout(() => URL.revokeObjectURL(url), 100);
                showMessage('QuickStatements downloaded successfully', 'success');
            }
        });
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
    
    // Generate QuickStatements URL
    function generateQuickStatementsUrl(quickStatementsText) {
        if (!quickStatementsText || !quickStatementsText.trim()) {
            return null;
        }
        
        // Replace TAB characters with "|" and newlines with "||"
        let urlText = quickStatementsText
            .replace(/\t/g, '|')
            .replace(/\n/g, '||');
        
        // Apply URL encoding
        urlText = encodeURIComponent(urlText);
        
        // Generate the complete URL
        return `https://quickstatements.toolforge.org/#/v1=${urlText}`;
    }
    
    // Open QuickStatements with generated URL
    function openQuickStatements() {
        if (!quickStatementsTextarea || !quickStatementsTextarea.value.trim()) {
            showMessage('No QuickStatements to open', 'error');
            return;
        }
        
        const quickStatementsText = quickStatementsTextarea.value;
        const url = generateQuickStatementsUrl(quickStatementsText);
        
        if (url) {
            window.open(url, '_blank');
            showMessage('Opening QuickStatements in new tab', 'success');
        } else {
            showMessage('Failed to generate QuickStatements URL', 'error');
        }
    }
    
    // Download JSON
    function downloadJson() {
        // Prepare the state for export
        const exportData = state.exportState();
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const filename = `wikidata-mapping-${new Date().toISOString().slice(0, 10)}.json`;
        
        // Create download link
        const downloadLink = createDownloadLink(url, filename, {
            onClick: () => {
                // Cleanup after download
                setTimeout(() => URL.revokeObjectURL(url), 100);
            }
        });
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Mark changes as saved
        state.markChangesSaved();
    }
    
    // Import JSON
    function importJson() {
        // For wireframe, use a file input
        const fileInput = createFileInput({
            accept: 'application/json',
            onChange: (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const jsonData = e.target.result;
                        const success = state.importState(jsonData);
                        
                        if (success) {
                            alert('Project imported successfully');
                            
                            // Navigate to the step stored in the imported state
                            const currentStep = state.getCurrentStep();
                            document.querySelector(`.step[data-step="${currentStep}"]`)?.click();
                            
                            // Re-generate QuickStatements
                            generateQuickStatements();
                        } else {
                            alert('Error importing project: Invalid JSON format');
                        }
                    } catch (error) {
                        console.error('Error importing project:', error);
                        alert('Error importing project: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        });
        
        fileInput.click();
    }
}