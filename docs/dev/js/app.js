/**
 * Main application entry point for the Omeka S to Wikidata Mapping Tool
 * Initializes all modules and sets up the application workflow
 * Implements proper separation of concerns with events for module communication
 * @module app
 */

// Import modules
import { eventSystem } from './events.js';
import { setupNavigation } from './navigation.js';
import { setupState } from './state.js';
import { setupInputStep } from './steps/input.js';
import { setupMappingStep } from './steps/mapping.js';
import { setupReconciliationStep } from './steps/reconciliation.js';
import { setupDesignerStep } from './steps/designer.js';
import { setupExportStep } from './steps/export.js';
import { setupModals } from './modals.js';

/**
 * Initialize the application
 */
function initializeApp() {
    // Initialize state management
    const state = setupState();
    window.debugState = state;
    
    // Initialize core modules
    const navigation = setupNavigation(state);
    const modals = setupModals(state);
    
    // Initialize step modules
    setupInputStep(state);
    setupMappingStep(state);
    setupReconciliationStep(state);
    setupDesignerStep(state);
    setupExportStep(state);
    
    // Set up application-level event listeners
    setupAppEventListeners(state);
    
    // Log initialization status
    console.log('Omeka S to Wikidata Mapping Tool initialized');
}

/**
 * Set up application-level event listeners
 * @param {Object} state - Application state manager
 */
function setupAppEventListeners(state) {
    // Show warning if user tries to leave with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (state.hasUnsavedChanges()) {
            const message = 'You have unsaved changes. Are you sure you want to leave?';
            e.returnValue = message;
            return message;
        }
    });
    
    // Listen for state changes
    eventSystem.subscribe(eventSystem.Events.STATE_CHANGED, (data) => {
        console.debug('State changed:', data.path);
    });
    
    // Listen for major events (for debugging/logging)
    eventSystem.subscribe(eventSystem.Events.STEP_COMPLETED, (data) => {
        console.debug(`Step ${data.step} completed`);
    });
    
    eventSystem.subscribe(eventSystem.Events.VALIDATION_FAILED, (data) => {
        console.debug(`Validation failed for step ${data.step}`);
    });
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);


