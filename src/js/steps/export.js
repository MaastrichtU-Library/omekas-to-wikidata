/**
 * Handles the Export step functionality
 */
import { createDownloadLink, createFileInput } from '../ui/components.js';
export function setupExportStep(state) {
    const quickStatementsTextarea = document.getElementById('quick-statements');
    const copyQuickStatementsBtn = document.getElementById('copy-quick-statements');
    // JSON export/import removed for MVP
    // const downloadJsonBtn = document.getElementById('download-json');
    // const importJsonBtn = document.getElementById('import-json');
    
    // Initialize export when entering this step
    document.addEventListener('DOMContentLoaded', () => {
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
    
    // Copy QuickStatements button
    if (copyQuickStatementsBtn) {
        copyQuickStatementsBtn.addEventListener('click', () => {
            copyQuickStatements();
        });
    }
    
    // JSON export/import functionality removed for MVP
    
    // Initialize export
    function initializeExport() {
        // Generate QuickStatements
        generateQuickStatements();
    }
    
    // Generate QuickStatements
    function generateQuickStatements() {
        if (!quickStatementsTextarea) return;
        
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData;
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const globalReferences = currentState.globalReferences || [];
        const entitySchema = currentState.entitySchema;
        
        if (!reconciliationData || Object.keys(reconciliationData).length === 0) {
            quickStatementsTextarea.value = 'No reconciliation data available. Please complete the reconciliation step.';
            return;
        }
        
        let quickStatementsText = '';
        
        // Process each item
        Object.keys(reconciliationData).forEach(itemId => {
            const itemData = reconciliationData[itemId];
            
            // Add CREATE statement for new item
            quickStatementsText += 'CREATE\n';
            
            // Add entity type from schema if available
            if (entitySchema) {
                quickStatementsText += `LAST\tP31\t${entitySchema}\n`;
            }
            
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
                        
                        if (match.type === 'wikidata') {
                            value = match.id;
                        } else if (match.type === 'custom') {
                            if (match.datatype === 'time') {
                                // Format time value for QuickStatements
                                value = `+${match.value}T00:00:00Z/11`;
                            } else {
                                value = `"${match.value}"`;
                            }
                        }
                        
                        if (value) {
                            // Add the main statement
                            quickStatementsText += `LAST\t${wikidataPropertyId}\t${value}`;
                            
                            // Add property-specific references
                            if (propertyData.references && propertyData.references.length > 0) {
                                propertyData.references.forEach(ref => {
                                    quickStatementsText += `\tS854\t"${ref.url}"`;
                                    if (ref.retrievedDate) {
                                        quickStatementsText += `\tS813\t+${ref.retrievedDate}T00:00:00Z/11`;
                                    }
                                });
                            }
                            
                            // Add global references if no property-specific ones
                            else if (globalReferences.length > 0) {
                                globalReferences.forEach(ref => {
                                    quickStatementsText += `\tS854\t"${ref.url}"`;
                                    if (ref.retrievedDate) {
                                        quickStatementsText += `\tS813\t+${ref.retrievedDate}T00:00:00Z/11`;
                                    }
                                });
                            }
                            
                            quickStatementsText += '\n';
                        }
                    }
                });
            });
            
            // Add separator between items
            quickStatementsText += '\n';
        });
        
        quickStatementsTextarea.value = quickStatementsText;
    }
    
    // Copy QuickStatements to clipboard
    function copyQuickStatements() {
        if (!quickStatementsTextarea) return;
        
        quickStatementsTextarea.select();
        document.execCommand('copy');
        
        alert('QuickStatements copied to clipboard');
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