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
import { setupStep4 } from './steps/step4.js';
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
    window.navigation = navigation; // Expose for testing
    const modals = setupModals(state);
    
    // Initialize step modules
    setupInputStep(state);
    setupMappingStep(state);
    setupReconciliationStep(state);
    setupStep4(state);
    setupExportStep(state);
    
    // Set up application-level event listeners
    setupAppEventListeners(state);
    
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
    
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);


