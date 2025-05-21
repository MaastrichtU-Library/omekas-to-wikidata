/**
 * State management for the application
 * Maintains the application state and provides methods to access and update it
 */
export function setupState() {
    // Initial state
    const initialState = {
        currentStep: 1,
        highestCompletedStep: 0,
        hasUnsavedChanges: false,
        testMode: false,
        
        // Step 1: Input
        apiUrl: '',
        apiKey: '',
        pagination: 10,
        fetchedData: null,
        selectedExample: null,
        
        // Step 2: Mapping
        entitySchema: '',
        mappings: {
            nonLinkedKeys: [],
            mappedKeys: [],
            ignoredKeys: []
        },
        
        // Step 3: Reconciliation
        reconciliationProgress: {
            total: 0,
            completed: 0
        },
        reconciliationData: [],
        
        // Step 4: Designer
        references: [],
        selectedExampleItem: '',
        designerData: [],
        
        // Step 5: Export
        quickStatements: '',
        exportTimestamp: null
    };
    
    // Create a deep copy of the initial state to work with
    let state = JSON.parse(JSON.stringify(initialState));
    
    // Get state
    function getState() {
        return JSON.parse(JSON.stringify(state));
    }
    
    // Set full state
    function setState(newState) {
        state = JSON.parse(JSON.stringify(newState));
        state.hasUnsavedChanges = true;
    }
    
    // Reset state to initial
    function resetState() {
        state = JSON.parse(JSON.stringify(initialState));
        state.hasUnsavedChanges = false;
    }
    
    // Get current step
    function getCurrentStep() {
        return state.currentStep;
    }
    
    // Set current step
    function setCurrentStep(step) {
        state.currentStep = step;
    }
    
    // Get highest completed step
    function getHighestCompletedStep() {
        return state.highestCompletedStep;
    }
    
    // Mark a step as completed
    function completeStep(step) {
        if (step > state.highestCompletedStep) {
            state.highestCompletedStep = step;
        }
    }
    
    // Check if state has unsaved changes
    function hasUnsavedChanges() {
        return state.hasUnsavedChanges;
    }
    
    // Mark changes as saved
    function markChangesSaved() {
        state.hasUnsavedChanges = false;
    }
    
    // Mark that there are unsaved changes
    function markChangesUnsaved() {
        state.hasUnsavedChanges = true;
    }
    
    // Validate a step to check if it's complete
    function validateStep(step) {
        switch (step) {
            case 1:
                return !!state.fetchedData && !!state.selectedExample;
            case 2:
                return state.mappings.mappedKeys.length > 0;
            case 3:
                return state.reconciliationProgress.completed === state.reconciliationProgress.total && 
                       state.reconciliationProgress.total > 0;
            case 4:
                return state.references.length > 0 && state.designerData.length > 0;
            default:
                return false;
        }
    }
    
    // Save state to JSON
    function exportState() {
        const exportData = JSON.parse(JSON.stringify(state));
        exportData.exportTimestamp = new Date().toISOString();
        return exportData;
    }
    
    // Import state from JSON
    function importState(jsonData) {
        try {
            const importedState = JSON.parse(jsonData);
            
            // Validate imported state
            if (!importedState || !importedState.hasOwnProperty('currentStep')) {
                throw new Error('Invalid state format');
            }
            
            // Update state
            state = importedState;
            state.hasUnsavedChanges = false;
            
            return true;
        } catch (error) {
            console.error('Error importing state:', error);
            return false;
        }
    }
    
    // Get test mode status
    function isTestMode() {
        return state.testMode;
    }
    
    // Set test mode
    function setTestMode(mode) {
        state.testMode = !!mode;
    }
    
    // API for state management
    return {
        getState,
        setState,
        resetState,
        getCurrentStep,
        setCurrentStep,
        getHighestCompletedStep,
        completeStep,
        hasUnsavedChanges,
        markChangesSaved,
        markChangesUnsaved,
        validateStep,
        exportState,
        importState,
        isTestMode,
        setTestMode
    };
}