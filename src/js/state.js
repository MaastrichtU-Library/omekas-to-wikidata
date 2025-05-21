/**
 * State management for the application.
 * Maintains the application state and provides methods to access and update it.
 * Uses the event system to notify other modules of state changes.
 * @module state
 * @returns {Object} State management API with methods for state manipulation
 */
import { eventSystem } from './events.js';

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
     * Updates part of the state
     * @param {string} path - Dot-notation path to the state property to update (e.g., 'mappings.nonLinkedKeys')
     * @param {any} value - New value to set
     * @param {boolean} markUnsaved - Whether to mark state as having unsaved changes (default: true)
     */
    function updateState(path, value, markUnsaved = true) {
        // Split the path by dots
        const pathParts = path.split('.');
        
        // Start at the root of the state
        let current = state;
        
        // Navigate to the nested property (all except the last part)
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (current[pathParts[i]] === undefined) {
                current[pathParts[i]] = {};
            }
            current = current[pathParts[i]];
        }
        
        // Set the value at the final property
        const finalProperty = pathParts[pathParts.length - 1];
        const oldValue = current[finalProperty];
        current[finalProperty] = value;
        
        // Mark changes as unsaved if needed
        if (markUnsaved) {
            state.hasUnsavedChanges = true;
        }
        
        // Notify listeners of the state change
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path,
            oldValue,
            newValue: value
        });
    }
    
    /**
     * Replaces the entire state with a new state object
     * @param {Object} newState - The new state to set
     */
    function setState(newState) {
        const oldState = JSON.parse(JSON.stringify(state));
        state = JSON.parse(JSON.stringify(newState));
        state.hasUnsavedChanges = true;
        
        // Notify listeners of the complete state change
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: '',
            oldValue: oldState,
            newValue: state
        });
    }
    
    /**
     * Resets the state to the initial default values
     */
    function resetState() {
        const oldState = JSON.parse(JSON.stringify(state));
        state = JSON.parse(JSON.stringify(initialState));
        state.hasUnsavedChanges = false;
        
        // Notify listeners of the state reset
        eventSystem.publish(eventSystem.Events.STATE_RESET, {
            oldState,
            newState: state
        });
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
        if (step < 1 || step > 5 || step === state.currentStep) return;
        
        const oldStep = state.currentStep;
        state.currentStep = step;
        
        // Notify listeners of the step change
        eventSystem.publish(eventSystem.Events.STEP_CHANGED, {
            oldStep,
            newStep: step
        });
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
        if (step <= state.highestCompletedStep) return;
        
        const oldHighestStep = state.highestCompletedStep;
        state.highestCompletedStep = step;
        
        // Notify listeners of the step completion
        eventSystem.publish(eventSystem.Events.STEP_COMPLETED, {
            step,
            oldHighestStep,
            newHighestStep: step
        });
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
        if (!state.hasUnsavedChanges) return;
        
        state.hasUnsavedChanges = false;
    }
    
    /**
     * Marks that there are unsaved changes in the state
     */
    function markChangesUnsaved() {
        if (state.hasUnsavedChanges) return;
        
        state.hasUnsavedChanges = true;
    }
    
    /**
     * Validates if a step has all required data to be considered complete
     * @param {number} step - The step number to validate
     * @returns {boolean} True if the step is complete with all required data
     */
    function validateStep(step) {
        const result = _validateStepInternal(step);
        
        // Publish validation result
        eventSystem.publish(
            result ? eventSystem.Events.VALIDATION_SUCCEEDED : eventSystem.Events.VALIDATION_FAILED, 
            { step, result }
        );
        
        return result;
    }
    
    /**
     * Internal step validation logic
     * @private
     */
    function _validateStepInternal(step) {
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
        
        // Notify listeners of the state export
        eventSystem.publish(eventSystem.Events.STATE_EXPORTED, { exportData });
        
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
            
            const oldState = JSON.parse(JSON.stringify(state));
            
            // Update state
            state = importedState;
            state.hasUnsavedChanges = false;
            
            // Notify listeners of the state import
            eventSystem.publish(eventSystem.Events.STATE_IMPORTED, {
                oldState,
                newState: state
            });
            
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
        const oldMode = state.testMode;
        const newMode = !!mode;
        
        if (oldMode === newMode) return;
        
        state.testMode = newMode;
        
        // Notify listeners of the test mode change
        eventSystem.publish(eventSystem.Events.UI_TEST_MODE_CHANGED, {
            oldMode,
            newMode
        });
    }
    
    // API for state management
    return {
        getState,
        setState,
        updateState,
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