/**
 * Main application entry point for the Omeka S to Wikidata Mapping Tool
 * Initializes all modules and sets up the application workflow
 * @module app
 */

// Import modules
import { setupNavigation } from './navigation.js';
import { setupState } from './state.js';
import { setupInputStep } from './steps/input.js';
import { setupMappingStep } from './steps/mapping.js';
import { setupReconciliationStep } from './steps/reconciliation.js';
import { setupDesignerStep } from './steps/designer.js';
import { setupExportStep } from './steps/export.js';
import { setupModals } from './modals.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Show warning if user tries to leave or refresh the page
    window.addEventListener('beforeunload', (e) => {
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        e.returnValue = message;
        return message;
    });

    // Initialize app modules
    const state = setupState();
    const navigation = setupNavigation(state);
    const modals = setupModals(state);
    
    // Initialize steps
    setupInputStep(state);
    setupMappingStep(state);
    setupReconciliationStep(state);
    setupDesignerStep(state);
    setupExportStep(state);
    
    // Create a global app object to allow modules to access each other
    window.app = {
        modules: {
            state,
            navigation,
            modals
        }
    };

    // Log application start
    console.log('Omeka S to Wikidata Mapping Tool initialized');
});