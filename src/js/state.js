/**
 * State management for the application.
 * Maintains the application state and provides methods to access and update it.
 * @module state
 * @returns {Object} State management API with methods for state manipulation
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
    
    /**
     * Returns a deep copy of the current state
     * @returns {Object} Deep copy of the current state
     */
    function getState() {
        return JSON.parse(JSON.stringify(state));
    }
    
    /**
     * Replaces the entire state with a new state object
     * @param {Object} newState - The new state to set
     */
    function setState(newState) {
        state = JSON.parse(JSON.stringify(newState));
        state.hasUnsavedChanges = true;
    }
    
    /**
     * Resets the state to the initial default values
     */
    function resetState() {
        state = JSON.parse(JSON.stringify(initialState));
        state.hasUnsavedChanges = false;
    }
    
    /**
     * Gets the current active step number
     * @returns {number} Current step number (1-5)
     */
    function getCurrentStep() {
        return state.currentStep;
    }
    
    /**
     * Sets the current active step
     * @param {number} step - The step number to set as current (1-5)
     */
    function setCurrentStep(step) {
        state.currentStep = step;
    }
    
    /**
     * Gets the highest step number that has been completed
     * @returns {number} Highest completed step number
     */
    function getHighestCompletedStep() {
        return state.highestCompletedStep;
    }
    
    /**
     * Marks a step as completed if it's higher than the current highest completed step
     * @param {number} step - The step number to mark as completed
     */
    function completeStep(step) {
        if (step > state.highestCompletedStep) {
            state.highestCompletedStep = step;
        }
    }
    
    /**
     * Checks if there are unsaved changes in the state
     * @returns {boolean} True if there are unsaved changes
     */
    function hasUnsavedChanges() {
        return state.hasUnsavedChanges;
    }
    
    /**
     * Marks all changes as saved
     */
    function markChangesSaved() {
        state.hasUnsavedChanges = false;
    }
    
    /**
     * Marks that there are unsaved changes in the state
     */
    function markChangesUnsaved() {
        state.hasUnsavedChanges = true;
    }
    
    /**
     * Validates if a step has all required data to be considered complete
     * @param {number} step - The step number to validate
     * @returns {boolean} True if the step is complete with all required data
     */
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
    
    /**
     * Exports the current state to a serializable object with timestamp
     * @returns {Object} Current state with added export timestamp
     */
    function exportState() {
        const exportData = JSON.parse(JSON.stringify(state));
        exportData.exportTimestamp = new Date().toISOString();
        return exportData;
    }
    
    /**
     * Imports state from a JSON string
     * @param {string} jsonData - JSON string containing state data
     * @returns {boolean} True if import was successful, false otherwise
     */
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
    
    /**
     * Gets the current test mode status
     * @returns {boolean} True if test mode is enabled
     */
    function isTestMode() {
        return state.testMode;
    }
    
    /**
     * Enables or disables test mode
     * @param {boolean} mode - True to enable test mode, false to disable
     */
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