/**
 * State management for the application.
 * Maintains the application state and provides methods to access and update it.
 * Uses the event system to notify other modules of state changes.
 * @module state
 * @returns {Object} State management API with methods for state manipulation
 * @example
 * // Initialize state management
 * import { setupState } from './state.js';
 * const state = setupState();
 * 
 * // Get current state
 * const currentState = state.getState();
 * console.log(currentState.currentStep);
 * 
 * // Update state
 * state.updateState('currentStep', 2);
 * state.updateMappings(['unmapped1'], [{ key: 'title', property: {id: 'P1476'} }], []);
 * 
 * // Listen for state changes
 * import { eventSystem } from './events.js';
 * eventSystem.subscribe(eventSystem.Events.STATE_CHANGED, (change) => {
 *   console.log('State changed:', change.path, change.newValue);
 * });
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
        entitySchema: '', // Deprecated - use selectedEntitySchema instead
        selectedEntitySchema: null, // Current selected Entity Schema object
        entitySchemaHistory: [], // Recently selected schemas for quick access
        mappings: {
            nonLinkedKeys: [],
            mappedKeys: [],
            ignoredKeys: [],
            transformationBlocks: {}, // mappingId -> array of transformation blocks
            selectedTransformationFields: {} // mappingId -> selected field key
        },
        
        // Entity Schema mapping status tracking
        schemaMappingStatus: {
            requiredMapped: [],
            requiredUnmapped: [],
            optionalMapped: [],
            optionalUnmapped: [],
            lastUpdated: null
        },
        
        // Step 3: Reconciliation
        reconciliationProgress: {
            total: 0,
            completed: 0
        },
        reconciliationData: [],
        linkedItems: {}, // Maps itemId to Wikidata QID for items linked to existing Wikidata items
        
        // Step 4: References
        references: {
            itemReferences: {}, // Map of itemId -> array of reference objects
            summary: {}, // Map of referenceType -> {count, examples: [{itemId, value}]}
            selectedTypes: ['omeka-item', 'oclc', 'ark'], // List of selected reference types (default: all selected)
            customReferences: [] // Array of custom reference objects added by user
        },

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
        if (savedState.references && savedState.references.itemReferences &&
            Object.keys(savedState.references.itemReferences).length > 0) {
            const refCount = Object.keys(savedState.references.itemReferences).length;
            summary.push(`• ${refCount} item${refCount > 1 ? 's' : ''} with references`);
        }
        
        summaryEl.innerHTML = summary.length > 0 ? 
            '<h4>Session includes:</h4>' + summary.join('<br>') : 
            '';
        
        // Show modal
        modal.style.display = 'flex';
        
        // Prevent modal content from closing the modal when clicked
        const modalContent = modal.querySelector('.modal');
        const handleContentClick = (e) => e.stopPropagation();
        if (modalContent) {
            modalContent.addEventListener('click', handleContentClick);
        }
        
        // Handle button clicks
        const handleRestore = () => {
            modal.style.display = 'none';
            restorePersistedState();
            cleanup();
        };
        
        const handleFresh = () => {
            modal.style.display = 'none';
            clearPersistedState();
            cleanup();
        };
        
        const handleOverlayClick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                clearPersistedState();
                cleanup();
            }
        };
        
        const cleanup = () => {
            restoreBtn.removeEventListener('click', handleRestore);
            freshBtn.removeEventListener('click', handleFresh);
            modal.removeEventListener('click', handleOverlayClick);
            if (modalContent) {
                modalContent.removeEventListener('click', handleContentClick);
            }
        };
        
        restoreBtn.addEventListener('click', handleRestore);
        freshBtn.addEventListener('click', handleFresh);
        modal.addEventListener('click', handleOverlayClick);
    }
    
    /**
     * Restore the persisted state
     */
    function restorePersistedState() {
        const loadedState = loadPersistedState();
        if (loadedState) {
            const previousStep = state.currentStep;
            state = loadedState;
            
            
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
        } catch (error) {
            console.error('Failed to persist state:', error);
        }
    }
    
    /**
     * Returns a deep copy of the current state
     * @returns {Object} Deep copy of the current state
     * @example
     * const state = setupState();
     * const currentState = state.getState();
     * console.log(currentState.currentStep); // 1
     * console.log(currentState.mappings.mappedKeys); // []
     */
    function getState() {
        const stateCopy = JSON.parse(JSON.stringify(state));
        return stateCopy;
    }
    
    /**
     * Updates part of the state
     * @param {string} path - Dot-notation path to the state property to update (e.g., 'mappings.nonLinkedKeys')
     * @param {any} value - New value to set
     * @param {boolean} markUnsaved - Whether to mark state as having unsaved changes (default: true)
     * @example
     * // Update current step
     * state.updateState('currentStep', 2);
     * 
     * @example
     * // Update nested mapping data
     * state.updateState('mappings.mappedKeys', [
     *   { key: 'dcterms:title', property: { id: 'P1476', label: 'title' } }
     * ]);
     * 
     * @example
     * // Update without marking as unsaved (for system updates)
     * state.updateState('reconciliationProgress.completed', 5, false);
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
        
        // Persist state to localStorage
        persistState();
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
        
        // Persist state to localStorage
        persistState();
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
        if (step < 1 || step > 5 || step === state.currentStep) {
            return;
        }
        
        const oldStep = state.currentStep;
        state.currentStep = step;
        
        
        // Notify listeners of the step change
        eventSystem.publish(eventSystem.Events.STEP_CHANGED, {
            oldStep,
            newStep: step
        });
        
        // Persist state to localStorage
        persistState();
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
        
        // Persist state to localStorage
        persistState();
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
                return true; // Always valid - empty placeholder step
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
        
        // Persist state to localStorage
        persistState();
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
        
        // Persist state to localStorage
        persistState();
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
        
        // Persist state to localStorage
        persistState();
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
        
        // Persist state to localStorage
        persistState();
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
        if (!state.mappings.transformationBlocks) {
            state.mappings.transformationBlocks = {};
        }
        if (!state.mappings.selectedTransformationFields) {
            state.mappings.selectedTransformationFields = {};
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
        
        // Persist state to localStorage
        persistState();
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
        
        // Persist state to localStorage
        persistState();
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
        
        // Persist state to localStorage
        persistState();
    }
    
    
    /**
<<<<<<< HEAD
     * Toggles a reference type between selected and ignored
     * @param {string} type - Reference type to toggle (e.g., 'omeka-item', 'oclc', 'ark')
     */
    function toggleReferenceType(type) {
        const oldSelectedTypes = [...state.references.selectedTypes];
        const index = state.references.selectedTypes.indexOf(type);

        if (index === -1) {
            // Not selected, add it
            state.references.selectedTypes.push(type);
        } else {
            // Already selected, remove it
            state.references.selectedTypes.splice(index, 1);
        }

        state.hasUnsavedChanges = true;

        // Notify listeners of the reference type toggle
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'references.selectedTypes',
            oldValue: oldSelectedTypes,
            newValue: [...state.references.selectedTypes]
        });

        // Persist state to localStorage
        persistState();
    }

    /**
     * Checks if a reference type is selected
     * @param {string} type - Reference type to check
     * @returns {boolean} True if the reference type is selected
     */
    function isReferenceTypeSelected(type) {
        return state.references.selectedTypes.includes(type);
    }

    /**
     * Adds a custom reference to the state
     * @param {Object} customRef - Custom reference object
     */
    function addCustomReference(customRef) {
        if (!state.references.customReferences) {
            state.references.customReferences = [];
        }

        const oldValue = [...state.references.customReferences];
        state.references.customReferences.push(customRef);

        // Also add to selectedTypes so it's selected by default
        if (!state.references.selectedTypes.includes(customRef.id)) {
            state.references.selectedTypes.push(customRef.id);
        }

        state.hasUnsavedChanges = true;

        // Notify listeners
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'references.customReferences',
            oldValue,
            newValue: [...state.references.customReferences]
        });

        // Persist state to localStorage
        persistState();
    }

    /**
     * Removes a custom reference from the state
     * @param {string} id - ID of the custom reference to remove
     */
    function removeCustomReference(id) {
        if (!state.references.customReferences) {
            return;
        }

        const oldValue = [...state.references.customReferences];
        state.references.customReferences = state.references.customReferences.filter(ref => ref.id !== id);

        // Also remove from selectedTypes
        const typeIndex = state.references.selectedTypes.indexOf(id);
        if (typeIndex !== -1) {
            state.references.selectedTypes.splice(typeIndex, 1);
        }

        state.hasUnsavedChanges = true;

        // Notify listeners
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'references.customReferences',
            oldValue,
            newValue: [...state.references.customReferences]
        });

        // Persist state to localStorage
        persistState();
    }

    /**
     * Gets all custom references
     * @returns {Array} Array of custom reference objects
     */
    function getCustomReferences() {
        return state.references.customReferences || [];
    }

    /**
     * Updates an existing custom reference
     * @param {string} id - ID of the custom reference to update
     * @param {Object} updatedReference - Complete reference object from createCustomReference
     */
    function updateCustomReference(id, updatedReference) {
        if (!state.references.customReferences) {
            return;
        }

        const index = state.references.customReferences.findIndex(ref => ref.id === id);
        if (index === -1) {
            console.error(`Custom reference with id ${id} not found`);
            return;
        }

        const oldValue = [...state.references.customReferences];

        // Replace with the complete updated reference object
        // The modal now provides a complete reference via createCustomReference
        state.references.customReferences[index] = updatedReference;

        state.hasUnsavedChanges = true;

        // Notify listeners
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'references.customReferences',
            oldValue,
            newValue: [...state.references.customReferences]
        });

        // Persist state to localStorage
        persistState();
    }

    /**
     * Links an item to an existing Wikidata item
     * @param {string} itemId - Item ID (e.g., 'item-0')
     * @param {string} qid - Wikidata QID (e.g., 'Q12345')
     */
    function linkItemToWikidata(itemId, qid) {
        if (!itemId || !qid) {
            console.error('Both itemId and qid are required for linking');
            return;
        }

        const oldLinkedItems = JSON.parse(JSON.stringify(state.linkedItems || {}));

        if (!state.linkedItems) {
            state.linkedItems = {};
        }

        state.linkedItems[itemId] = qid;
        state.hasUnsavedChanges = true;

        // Notify listeners of the link update
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: `linkedItems.${itemId}`,
            oldValue: oldLinkedItems[itemId] || null,
            newValue: qid
        });

        // Persist state to localStorage
        persistState();
    }

    /**
     * Unlinks an item from its Wikidata item
     * @param {string} itemId - Item ID (e.g., 'item-0')
     */
    function unlinkItem(itemId) {
        if (!itemId) {
            console.error('itemId is required for unlinking');
            return;
        }

        if (!state.linkedItems || !state.linkedItems[itemId]) {
            // Item is not linked, nothing to do
            return;
        }

        const oldQid = state.linkedItems[itemId];
        delete state.linkedItems[itemId];
        state.hasUnsavedChanges = true;

        // Notify listeners of the unlink
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: `linkedItems.${itemId}`,
            oldValue: oldQid,
            newValue: null
        });

        // Persist state to localStorage
        persistState();
    }

    /**
     * Gets the linked Wikidata QID for an item
     * @param {string} itemId - Item ID (e.g., 'item-0')
     * @returns {string|null} Wikidata QID or null if not linked
     */
    function getLinkedItem(itemId) {
        if (!itemId || !state.linkedItems) {
            return null;
        }
        return state.linkedItems[itemId] || null;
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
        
        // Persist state to localStorage
        persistState();
    }
    
    /**
     * Generates a mapping ID from key and property ID
     * @param {string} key - The source data key
     * @param {string} propertyId - The Wikidata property ID
     * @param {string} atField - Optional @ field selector (e.g., '@id', '@value')
     * @returns {string} The mapping ID
     */
    function generateMappingId(key, propertyId, atField) {
        if (!key || !propertyId) return propertyId || key || 'unknown';
        // Include @ field in the ID if specified to support duplicate mappings
        if (atField) {
            return `${key}::${atField}::${propertyId}`;
        }
        return `${key}::${propertyId}`;
    }
    
    /**
     * Adds a transformation block to a property mapping
     * @param {string} mappingId - The mapping ID (key::propertyId format) or legacy propertyId
     * @param {Object} block - The transformation block to add
     */
    function addTransformationBlock(mappingId, block) {
        ensureMappingArrays();
        
        if (!state.mappings.transformationBlocks[mappingId]) {
            state.mappings.transformationBlocks[mappingId] = [];
        }
        
        const oldValue = JSON.parse(JSON.stringify(state.mappings.transformationBlocks[mappingId]));
        
        // Generate unique ID if not provided
        const blockWithId = {
            ...block,
            id: block.id || `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            order: state.mappings.transformationBlocks[mappingId].length
        };
        
        // Check if a block with this ID already exists
        const existingBlockIndex = state.mappings.transformationBlocks[mappingId].findIndex(b => b.id === blockWithId.id);
        if (existingBlockIndex !== -1) {
            // Update existing block instead of adding duplicate
            state.mappings.transformationBlocks[mappingId][existingBlockIndex] = blockWithId;
        } else {
            state.mappings.transformationBlocks[mappingId].push(blockWithId);
        }
        state.hasUnsavedChanges = true;
        
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: `mappings.transformationBlocks.${mappingId}`,
            oldValue,
            newValue: [...state.mappings.transformationBlocks[mappingId]]
        });
        
        // Persist state to localStorage
        persistState();
        
        return blockWithId;
    }
    
    /**
     * Removes a transformation block by ID
     * @param {string} mappingId - The mapping ID (key::propertyId format) or legacy propertyId
     * @param {string} blockId - The block ID to remove
     */
    function removeTransformationBlock(mappingId, blockId) {
        ensureMappingArrays();
        
        if (!state.mappings.transformationBlocks[mappingId]) return;
        
        const oldValue = [...state.mappings.transformationBlocks[mappingId]];
        const index = state.mappings.transformationBlocks[mappingId].findIndex(b => b.id === blockId);
        
        if (index > -1) {
            state.mappings.transformationBlocks[mappingId].splice(index, 1);
            
            // Update order indices for remaining blocks
            state.mappings.transformationBlocks[mappingId].forEach((block, i) => {
                block.order = i;
            });
            
            state.hasUnsavedChanges = true;
            
            eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
                path: `mappings.transformationBlocks.${mappingId}`,
                oldValue,
                newValue: [...state.mappings.transformationBlocks[mappingId]]
            });
            
            // Persist state to localStorage
            persistState();
        }
    }
    
    /**
     * Updates a transformation block configuration
     * @param {string} mappingId - The mapping ID (key::propertyId format) or legacy propertyId
     * @param {string} blockId - The block ID to update
     * @param {Object} config - The new configuration
     */
    function updateTransformationBlock(mappingId, blockId, config) {
        ensureMappingArrays();
        
        if (!state.mappings.transformationBlocks[mappingId]) return;
        
        const oldValue = [...state.mappings.transformationBlocks[mappingId]];
        const block = state.mappings.transformationBlocks[mappingId].find(b => b.id === blockId);
        
        if (block) {
            block.config = { ...block.config, ...config };
            state.hasUnsavedChanges = true;
            
            eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
                path: `mappings.transformationBlocks.${mappingId}`,
                oldValue,
                newValue: [...state.mappings.transformationBlocks[mappingId]]
            });
            
            // Persist state to localStorage
            persistState();
        }
    }
    
    /**
     * Reorders transformation blocks for a property mapping
     * @param {string} mappingId - The mapping ID (key::propertyId format) or legacy propertyId
     * @param {Array} newOrder - Array of block IDs in new order
     */
    function reorderTransformationBlocks(mappingId, newOrder) {
        ensureMappingArrays();
        
        if (!state.mappings.transformationBlocks[mappingId]) return;
        
        const oldValue = [...state.mappings.transformationBlocks[mappingId]];
        const blocks = state.mappings.transformationBlocks[mappingId];
        
        // Create new ordered array
        const reorderedBlocks = newOrder.map((blockId, index) => {
            const block = blocks.find(b => b.id === blockId);
            if (block) {
                block.order = index;
                return block;
            }
        }).filter(Boolean);
        
        state.mappings.transformationBlocks[mappingId] = reorderedBlocks;
        state.hasUnsavedChanges = true;
        
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: `mappings.transformationBlocks.${mappingId}`,
            oldValue,
            newValue: [...state.mappings.transformationBlocks[mappingId]]
        });
        
        // Persist state to localStorage
        persistState();
    }
    
    /**
     * Gets transformation blocks for a property mapping
     * @param {string} mappingId - The mapping ID (key::propertyId format) or legacy propertyId
     * @returns {Array} Array of transformation blocks
     */
    function getTransformationBlocks(mappingId) {
        ensureMappingArrays();
        // First try with the mapping ID as-is
        if (state.mappings.transformationBlocks[mappingId]) {
            return state.mappings.transformationBlocks[mappingId];
        }
        // Backwards compatibility: if not found and doesn't contain '::', it might be a legacy propertyId
        // Check if any existing keys end with this propertyId
        if (!mappingId.includes('::')) {
            for (const key in state.mappings.transformationBlocks) {
                if (key.endsWith(`::${mappingId}`)) {
                    return state.mappings.transformationBlocks[key];
                }
            }
        }
        return [];
    }
    
    /**
     * Sets the selected transformation field for a mapping
     * @param {string} mappingId - The mapping ID
     * @param {string} fieldKey - The selected field key
     */
    function setSelectedTransformationField(mappingId, fieldKey) {
        ensureMappingArrays();
        
        const oldValue = state.mappings.selectedTransformationFields[mappingId];
        state.mappings.selectedTransformationFields[mappingId] = fieldKey;
        state.hasUnsavedChanges = true;
        
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: `mappings.selectedTransformationFields.${mappingId}`,
            oldValue,
            newValue: fieldKey
        });
        
        // Persist state to localStorage
        persistState();
    }
    
    /**
     * Gets the selected transformation field for a mapping
     * @param {string} mappingId - The mapping ID
     * @returns {string|null} The selected field key or null
     */
    function getSelectedTransformationField(mappingId) {
        ensureMappingArrays();
        return state.mappings.selectedTransformationFields[mappingId] || null;
    }
    
    /**
     * Sets the selected Entity Schema
     * @param {Object} schema - The Entity Schema object
     */
    function setSelectedEntitySchema(schema) {
        const oldValue = state.selectedEntitySchema;
        state.selectedEntitySchema = schema;
        
        // Add to history if not already present
        if (schema && schema.id) {
            ensureEntitySchemaHistory();
            const existingIndex = state.entitySchemaHistory.findIndex(s => s.id === schema.id);
            if (existingIndex > -1) {
                // Move to front
                state.entitySchemaHistory.splice(existingIndex, 1);
            }
            // Add to front, keep only last 10
            state.entitySchemaHistory.unshift(schema);
            state.entitySchemaHistory = state.entitySchemaHistory.slice(0, 10);
        }
        
        state.hasUnsavedChanges = true;
        
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'selectedEntitySchema',
            oldValue,
            newValue: schema
        });
        
        // Persist state to localStorage
        persistState();
    }
    
    /**
     * Gets the currently selected Entity Schema
     * @returns {Object|null} The selected Entity Schema or null
     */
    function getSelectedEntitySchema() {
        return state.selectedEntitySchema;
    }
    
    /**
     * Gets the Entity Schema history
     * @returns {Array} Array of recently selected Entity Schemas
     */
    function getEntitySchemaHistory() {
        ensureEntitySchemaHistory();
        return [...state.entitySchemaHistory];
    }
    
    /**
     * Ensures the Entity Schema history array is initialized
     */
    function ensureEntitySchemaHistory() {
        if (!state.entitySchemaHistory) {
            state.entitySchemaHistory = [];
        }
    }
    
    /**
     * Clears the Entity Schema history
     */
    function clearEntitySchemaHistory() {
        const oldValue = [...(state.entitySchemaHistory || [])];
        state.entitySchemaHistory = [];
        state.hasUnsavedChanges = true;
        
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'entitySchemaHistory',
            oldValue,
            newValue: []
        });
        
        // Persist state to localStorage
        persistState();
    }
    
    /**
     * Updates the Entity Schema mapping status
     * @param {Object} status - Mapping status object with categorized properties
     */
    function updateSchemaMappingStatus(status) {
        const oldValue = { ...state.schemaMappingStatus };
        state.schemaMappingStatus = {
            ...status,
            lastUpdated: new Date().toISOString()
        };
        state.hasUnsavedChanges = true;
        
        eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
            path: 'schemaMappingStatus',
            oldValue,
            newValue: state.schemaMappingStatus
        });
        
        // Persist state to localStorage
        persistState();
    }
    
    /**
     * Gets the current Entity Schema mapping status
     * @returns {Object} Current mapping status
     */
    function getSchemaMappingStatus() {
        return { ...state.schemaMappingStatus };
    }
    
    /**
     * Clear persisted state from localStorage
     */
    function clearPersistedState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
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
        // Convenience methods for transformation blocks
        generateMappingId,
        addTransformationBlock,
        removeTransformationBlock,
        updateTransformationBlock,
        reorderTransformationBlocks,
        getTransformationBlocks,
        setSelectedTransformationField,
        getSelectedTransformationField,
        // Convenience methods for reconciliation progress
        incrementReconciliationCompleted,
        incrementReconciliationSkipped,
        setReconciliationProgress,
        // Convenience methods for references
        toggleReferenceType,
        isReferenceTypeSelected,
        addCustomReference,
        removeCustomReference,
        getCustomReferences,
        updateCustomReference,
        // Convenience methods for linked items
        linkItemToWikidata,
        unlinkItem,
        getLinkedItem,
        // Convenience methods for Entity Schema
        setSelectedEntitySchema,
        getSelectedEntitySchema,
        getEntitySchemaHistory,
        clearEntitySchemaHistory,
        updateSchemaMappingStatus,
        getSchemaMappingStatus,
        // Utility methods
        loadMockData,
        // Persistence methods
        clearPersistedState,
        persistState
    };
}