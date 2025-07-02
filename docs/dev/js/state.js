/**
 * State management for the application.
 * Maintains the application state and provides methods to access and update it.
 * Uses the event system to notify other modules of state changes.
 * @module state
 * @returns {Object} State management API with methods for state manipulation
 */
import { eventSystem } from './events.js';

export function setupState() {
    // Storage key for persistence
    const STORAGE_KEY = 'omekaToWikidataState';
    const STORAGE_VERSION = '1.0';
    
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
    
    // Check for persisted state but don't load automatically
    let state = JSON.parse(JSON.stringify(initialState));
    
    // Check if there's a saved session to offer restoration
    checkAndOfferRestore();
    
    /**
     * Check for saved session and offer to restore
     */
    function checkAndOfferRestore() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.version === STORAGE_VERSION) {
                    // Format the timestamp for display
                    const savedDate = new Date(parsed.timestamp);
                    const dateStr = savedDate.toLocaleDateString();
                    const timeStr = savedDate.toLocaleTimeString();
                    
                    // Check if there's meaningful data to restore
                    const hasData = parsed.state.fetchedData || 
                                  (parsed.state.mappings && parsed.state.mappings.mappedKeys && parsed.state.mappings.mappedKeys.length > 0) ||
                                  parsed.state.reconciliationData;
                    
                    if (hasData) {
                        // Use custom modal for the restore prompt
                        setTimeout(() => {
                            showRestoreModal(dateStr, timeStr, parsed.state);
                        }, 500); // Small delay to ensure DOM is ready
                    }
                }
            }
        } catch (error) {
            console.error('Failed to check persisted state:', error);
        }
    }
    
    /**
     * Load persisted state from localStorage
     * @returns {Object|null} Loaded state or null if not found/invalid
     */
    function loadPersistedState() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.version === STORAGE_VERSION) {
                    console.log('✅ Loaded persisted state from localStorage');
                    // Preserve the last opened step from saved state
                    return parsed.state;
                }
            }
        } catch (error) {
            console.error('Failed to load persisted state:', error);
        }
        return null;
    }
    
    /**
     * Show the restore session modal
     */
    function showRestoreModal(dateStr, timeStr, savedState) {
        const modal = document.getElementById('restore-session-modal');
        const dateEl = document.getElementById('session-date');
        const timeEl = document.getElementById('session-time');
        const summaryEl = document.getElementById('session-summary');
        const restoreBtn = document.getElementById('restore-session-btn');
        const freshBtn = document.getElementById('start-fresh-btn');
        
        if (!modal || !dateEl || !timeEl) return;
        
        // Set date and time
        dateEl.textContent = dateStr;
        timeEl.textContent = timeStr;
        
        // Create summary of saved data
        const summary = [];
        if (savedState.fetchedData) {
            const itemCount = Array.isArray(savedState.fetchedData) ? savedState.fetchedData.length : 1;
            summary.push(`• ${itemCount} item${itemCount > 1 ? 's' : ''} loaded from API`);
        }
        if (savedState.mappings && savedState.mappings.mappedKeys && savedState.mappings.mappedKeys.length > 0) {
            summary.push(`• ${savedState.mappings.mappedKeys.length} properties mapped`);
        }
        if (savedState.reconciliationData && Object.keys(savedState.reconciliationData).length > 0) {
            const reconciledCount = Object.keys(savedState.reconciliationData).length;
            summary.push(`• ${reconciledCount} item${reconciledCount > 1 ? 's' : ''} with reconciliation data`);
        }
        if (savedState.references && savedState.references.length > 0) {
            summary.push(`• ${savedState.references.length} reference${savedState.references.length > 1 ? 's' : ''} configured`);
        }
        
        summaryEl.innerHTML = summary.length > 0 ? 
            '<h4>Session includes:</h4>' + summary.join('<br>') : 
            '';
        
        // Show modal
        modal.style.display = 'flex';
        
        // Handle button clicks
        const handleRestore = () => {
            modal.style.display = 'none';
            restorePersistedState();
            cleanup();
        };
        
        const handleFresh = () => {
            modal.style.display = 'none';
            console.log('User chose to start fresh');
            clearPersistedState();
            cleanup();
        };
        
        const cleanup = () => {
            restoreBtn.removeEventListener('click', handleRestore);
            freshBtn.removeEventListener('click', handleFresh);
        };
        
        restoreBtn.addEventListener('click', handleRestore);
        freshBtn.addEventListener('click', handleFresh);
    }
    
    /**
     * Restore the persisted state
     */
    function restorePersistedState() {
        const loadedState = loadPersistedState();
        if (loadedState) {
            const previousStep = state.currentStep;
            state = loadedState;
            
            console.log(`🔄 Session restored - returning to step ${state.currentStep}`);
            
            // Notify all modules that state has been restored
            eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
                path: 'entire-state',
                oldValue: null,
                newValue: state,
                restored: true
            });
            
            // Trigger step change event to initialize the current step properly
            eventSystem.publish(eventSystem.Events.STEP_CHANGED, {
                oldStep: 1,
                newStep: state.currentStep
            });
            
            // Show success message using the showMessage function if available
            setTimeout(() => {
                if (window.showMessage) {
                    window.showMessage(`Previous session restored - returned to step ${state.currentStep}`, 'success');
                }
            }, 1000);
        }
    }
    
    /**
     * Save current state to localStorage
     */
    function persistState() {
        try {
            const toStore = {
                version: STORAGE_VERSION,
                timestamp: new Date().toISOString(),
                state: state
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
            console.log('💾 State persisted to localStorage');
        } catch (error) {
            console.error('Failed to persist state:', error);
        }
    }
    
    /**
     * Returns a deep copy of the current state
     * @returns {Object} Deep copy of the current state
     */
    function getState() {
        const stateCopy = JSON.parse(JSON.stringify(state));
        console.log('📝 State requested. Current state summary:');
        console.log('  - Current step:', stateCopy.currentStep);
        console.log('  - Has fetchedData:', !!stateCopy.fetchedData);
        console.log('  - Mapped keys count:', stateCopy.mappings?.mappedKeys?.length || 0);
        console.log('  - Test mode:', stateCopy.testMode);
        return stateCopy;
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
        
        // Persist state to localStorage
        persistState();
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
        
        // Clear persisted state as well
        clearPersistedState();
        
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
        
        console.log(`🔄 Step changed from ${oldStep} to ${step}`);
        
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
    
    /**
     * Updates all mapping categories atomically in a single operation
     * @param {Array} nonLinked - Array of non-linked keys
     * @param {Array} mapped - Array of mapped keys  
     * @param {Array} ignored - Array of ignored keys
     */
    function updateMappings(nonLinked, mapped, ignored) {
        const oldMappings = JSON.parse(JSON.stringify(state.mappings));
        
        state.mappings.nonLinkedKeys = nonLinked || [];
        state.mappings.mappedKeys = mapped || [];
        state.mappings.ignoredKeys = ignored || [];
        state.hasUnsavedChanges = true;
        
        // Notify listeners of the mapping update
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'mappings',
            oldValue: oldMappings,
            newValue: JSON.parse(JSON.stringify(state.mappings))
        });
    }
    
    /**
     * Adds items to a specific mapping category
     * @param {string} category - The category ('nonLinkedKeys', 'mappedKeys', or 'ignoredKeys')
     * @param {Array|string} items - Items to add (can be array or single item)
     */
    function addToMappingCategory(category, items) {
        if (!['nonLinkedKeys', 'mappedKeys', 'ignoredKeys'].includes(category)) {
            console.error(`Invalid mapping category: ${category}`);
            return;
        }
        
        ensureMappingArrays();
        
        const itemsArray = Array.isArray(items) ? items : [items];
        const oldValue = [...state.mappings[category]];
        
        // Add items that aren't already present
        itemsArray.forEach(item => {
            if (!state.mappings[category].includes(item)) {
                state.mappings[category].push(item);
            }
        });
        
        state.hasUnsavedChanges = true;
        
        // Notify listeners of the category update
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: `mappings.${category}`,
            oldValue,
            newValue: [...state.mappings[category]]
        });
    }
    
    /**
     * Removes items from a specific mapping category
     * @param {string} category - The category ('nonLinkedKeys', 'mappedKeys', or 'ignoredKeys')
     * @param {Array|string} items - Items to remove (can be array or single item)
     */
    function removeFromMappingCategory(category, items) {
        if (!['nonLinkedKeys', 'mappedKeys', 'ignoredKeys'].includes(category)) {
            console.error(`Invalid mapping category: ${category}`);
            return;
        }
        
        ensureMappingArrays();
        
        const itemsArray = Array.isArray(items) ? items : [items];
        const oldValue = [...state.mappings[category]];
        
        // Remove items
        itemsArray.forEach(item => {
            const index = state.mappings[category].indexOf(item);
            if (index > -1) {
                state.mappings[category].splice(index, 1);
            }
        });
        
        state.hasUnsavedChanges = true;
        
        // Notify listeners of the category update
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: `mappings.${category}`,
            oldValue,
            newValue: [...state.mappings[category]]
        });
    }
    
    /**
     * Ensures all mapping category arrays are initialized
     */
    function ensureMappingArrays() {
        if (!state.mappings.nonLinkedKeys) {
            state.mappings.nonLinkedKeys = [];
        }
        if (!state.mappings.mappedKeys) {
            state.mappings.mappedKeys = [];
        }
        if (!state.mappings.ignoredKeys) {
            state.mappings.ignoredKeys = [];
        }
    }
    
    /**
     * Increments the reconciliation completed counter
     */
    function incrementReconciliationCompleted() {
        const oldProgress = JSON.parse(JSON.stringify(state.reconciliationProgress));
        state.reconciliationProgress.completed++;
        state.hasUnsavedChanges = true;
        
        // Notify listeners of the progress update
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'reconciliationProgress.completed',
            oldValue: oldProgress.completed,
            newValue: state.reconciliationProgress.completed
        });
    }
    
    /**
     * Increments the reconciliation skipped counter (if we track skipped items)
     */
    function incrementReconciliationSkipped() {
        // Initialize skipped counter if it doesn't exist
        if (!state.reconciliationProgress.hasOwnProperty('skipped')) {
            state.reconciliationProgress.skipped = 0;
        }
        
        const oldSkipped = state.reconciliationProgress.skipped;
        state.reconciliationProgress.skipped++;
        state.hasUnsavedChanges = true;
        
        // Notify listeners of the skipped counter update
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'reconciliationProgress.skipped',
            oldValue: oldSkipped,
            newValue: state.reconciliationProgress.skipped
        });
    }
    
    /**
     * Sets the reconciliation progress values
     * @param {number} completed - Number of completed reconciliations
     * @param {number} total - Total number of items to reconcile
     */
    function setReconciliationProgress(completed, total) {
        const oldProgress = JSON.parse(JSON.stringify(state.reconciliationProgress));
        
        state.reconciliationProgress.completed = completed || 0;
        state.reconciliationProgress.total = total || 0;
        state.hasUnsavedChanges = true;
        
        // Notify listeners of the progress update
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'reconciliationProgress',
            oldValue: oldProgress,
            newValue: JSON.parse(JSON.stringify(state.reconciliationProgress))
        });
    }
    
    /**
     * Loads mock data for testing purposes
     * @param {Object} mockItems - Mock items data with items array
     * @param {Object} mockMapping - Mock mapping data with mappings object
     */
    function loadMockData(mockItems, mockMapping) {
        const oldState = JSON.parse(JSON.stringify(state));
        
        // Load mock items
        if (mockItems && mockItems.items) {
            state.fetchedData = mockItems.items;
        }
        
        // Load mock mappings
        if (mockMapping && mockMapping.mappings) {
            state.mappings.mappedKeys = mockMapping.mappings.mappedKeys || [];
            state.mappings.nonLinkedKeys = mockMapping.mappings.nonLinkedKeys || [];
            state.mappings.ignoredKeys = mockMapping.mappings.ignoredKeys || [];
        }
        
        state.hasUnsavedChanges = true;
        
        // Notify listeners of the mock data load
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'mockDataLoaded',
            oldValue: null,
            newValue: { mockItems, mockMapping }
        });
    }
    
    /**
     * Clear persisted state from localStorage
     */
    function clearPersistedState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('🗑️ Cleared persisted state from localStorage');
        } catch (error) {
            console.error('Failed to clear persisted state:', error);
        }
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
        setTestMode,
        // Convenience methods for mappings
        updateMappings,
        addToMappingCategory,
        removeFromMappingCategory,
        ensureMappingArrays,
        // Convenience methods for reconciliation progress
        incrementReconciliationCompleted,
        incrementReconciliationSkipped,
        setReconciliationProgress,
        // Utility methods
        loadMockData,
        // Persistence methods
        clearPersistedState,
        persistState
    };
}