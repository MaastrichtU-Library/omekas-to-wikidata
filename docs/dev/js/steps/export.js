/**
 * Handles the Export step functionality
 */
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
        
        // For wireframe, generate placeholder QuickStatements
        let quickStatementsText = 'CREATE';
        
        if (state.designerData && state.designerData.length) {
            state.designerData.forEach(data => {
                quickStatementsText += `\nLAST\t${data.property}\t"${data.value}"\tS854\t"${data.reference?.value || 'Example Reference'}"`;
            });
        } else {
            quickStatementsText += '\nLAST\tP31\tQ5\tS854\t"Example Reference"';
            quickStatementsText += '\nLAST\tP1476\t"Example Title"\tS854\t"Example Reference"';
            quickStatementsText += '\nLAST\tP577\t+2023-01-15T00:00:00Z/11\tS854\t"Example Reference"';
        }
        
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
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `wikidata-mapping-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
        
        // Mark changes as saved
        state.markChangesSaved();
    }
    
    // Import JSON
    function importJson() {
        // For wireframe, use a file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';
        
        fileInput.addEventListener('change', (event) => {
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
        });
        
        fileInput.click();
    }
}