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
    setupNavigation(state);
    setupModals(state);
    
    // Initialize steps
    setupInputStep(state);
    setupMappingStep(state);
    setupReconciliationStep(state);
    setupDesignerStep(state);
    setupExportStep(state);

    // Log application start
    console.log('Omeka S to Wikidata Mapping Tool initialized');
});