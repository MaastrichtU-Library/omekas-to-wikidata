/**
 * Handles step navigation and progress tracking for the application workflow
 * Separates navigation logic from UI manipulation
 * @module navigation
 * @param {Object} state - Application state manager
 * @returns {Object} Navigation API with methods to control step navigation
 */
import { eventSystem } from './events.js';
import { setupNavigationUI } from './ui/navigation-ui.js';

export function setupNavigation(state) {
    // Set up the UI component
    const navigationUI = setupNavigationUI();
    
    // Navigation buttons
    const proceedToMappingBtn = document.getElementById('proceed-to-mapping');
    const backToInputBtn = document.getElementById('back-to-input');
    const proceedToReconciliationBtn = document.getElementById('proceed-to-reconciliation');
    const backToMappingBtn = document.getElementById('back-to-mapping');
    const proceedToDesignerBtn = document.getElementById('proceed-to-designer');
    const backToReconciliationBtn = document.getElementById('back-to-reconciliation');
    const proceedToExportBtn = document.getElementById('proceed-to-export');
    const backToDesignerBtn = document.getElementById('back-to-designer');
    const startNewProjectBtn = document.getElementById('start-new-project');
    
    // Step indicator elements
    const steps = document.querySelectorAll('.step');
    
    // Initialize with current state
    let testMode = state.isTestMode();
    
    /**
     * Navigates to a specific step in the workflow
     * @param {number} stepNumber - The step number to navigate to (1-5)
     */
    function navigateToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 5) return;
        
        
        // Update state (this will trigger STEP_CHANGED event)
        state.setCurrentStep(stepNumber);
        
        // In test mode, mark all steps up to current as completed
        if (testMode && stepNumber > state.getHighestCompletedStep()) {
            for (let i = 1; i < stepNumber; i++) {
                state.completeStep(i);
            }
        }
    }
    
    /**
     * Requests navigation to the next step with validation
     * @param {number} currentStep - The current step number
     */
    function requestNextStep(currentStep) {
        const nextStep = currentStep + 1;
        if (nextStep > 5) return;
        
        // In test mode, bypass validation
        if (testMode) {
            state.completeStep(currentStep);
            navigateToStep(nextStep);
            return;
        }
        
        // Validate current step before proceeding
        if (state.validateStep(currentStep)) {
            state.completeStep(currentStep);
            navigateToStep(nextStep);
        }
    }
    
    /**
     * Requests navigation to the previous step
     * @param {number} currentStep - The current step number
     */
    function requestPreviousStep(currentStep) {
        const previousStep = currentStep - 1;
        if (previousStep < 1) return;
        
        navigateToStep(previousStep);
    }
    
    /**
     * Toggles test mode
     */
    function toggleTestMode() {
        testMode = !testMode;
        state.setTestMode(testMode);
    }
    
    // Set up event listeners for navigation elements
    function setupEventListeners() {
        // Enable step navigation by clicking on step indicators
        steps.forEach(step => {
            // Track double-click timing
            let lastClickTime = 0;
            
            step.addEventListener('click', (event) => {
                const stepNumber = parseInt(step.getAttribute('data-step'));
                const currentTime = new Date().getTime();
                const timeSinceLastClick = currentTime - lastClickTime;
                const isDoubleClick = timeSinceLastClick < 300; // 300ms threshold for double click
                
                lastClickTime = currentTime;
                
                
                // Normal navigation behavior
                if (testMode) {
                    // In test mode, allow navigation to any step
                    navigateToStep(stepNumber);
                } else {
                    // Normal behavior: Only allow navigation to steps that are already completed or the current step + 1
                    const highestCompleted = state.getHighestCompletedStep();
                    if (stepNumber <= highestCompleted + 1) {
                        navigateToStep(stepNumber);
                    }
                }
            });
        });
    
        // Step navigation button handlers
        if (proceedToMappingBtn) {
            proceedToMappingBtn.addEventListener('click', () => {
                requestNextStep(1);
            });
        }
    
        if (backToInputBtn) {
            backToInputBtn.addEventListener('click', () => {
                requestPreviousStep(2);
            });
        }
    
        if (proceedToReconciliationBtn) {
            proceedToReconciliationBtn.addEventListener('click', () => {
                requestNextStep(2);
            });
        }
    
        if (backToMappingBtn) {
            backToMappingBtn.addEventListener('click', () => {
                requestPreviousStep(3);
            });
        }
    
        if (proceedToDesignerBtn) {
            proceedToDesignerBtn.addEventListener('click', () => {
                requestNextStep(3);
            });
        }
    
        if (backToReconciliationBtn) {
            backToReconciliationBtn.addEventListener('click', () => {
                requestPreviousStep(4);
            });
        }
    
        if (proceedToExportBtn) {
            proceedToExportBtn.addEventListener('click', () => {
                requestNextStep(4);
            });
        }
    
        if (backToDesignerBtn) {
            backToDesignerBtn.addEventListener('click', () => {
                requestPreviousStep(5);
            });
        }
    
        if (startNewProjectBtn) {
            startNewProjectBtn.addEventListener('click', () => {
                if (confirm('Starting a new project will clear all current data. Are you sure?')) {
                    state.resetState();
                    navigateToStep(1);
                }
            });
        }
    
        
        // Subscribe to state events that affect navigation
        eventSystem.subscribe(eventSystem.Events.UI_TEST_MODE_CHANGED, (data) => {
            testMode = data.newMode;
        });
    }
    
    // Initialize
    setupEventListeners();
    
    // Initialize UI with current state
    navigationUI.updateStepUI(state.getCurrentStep());
    navigationUI.updateTestModeUI(testMode);
    
    // Return the navigation API so it can be used by other modules
    return {
        /**
         * Navigate to a specific step
         * @param {number} stepNumber - The step number to navigate to (1-5)
         */
        navigateToStep,
        
        /**
         * Request navigation to the next step with validation
         * @param {number} currentStep - The current step number
         */
        requestNextStep,
        
        /**
         * Request navigation to the previous step
         * @param {number} currentStep - The current step number
         */
        requestPreviousStep,
        
        /**
         * Gets the current test mode status
         * @returns {boolean} True if test mode is enabled
         */
        getTestMode: () => testMode,
        
        /**
         * Sets the test mode status
         * @param {boolean} mode - True to enable test mode, false to disable
         */
        setTestMode: (mode) => {
            const newMode = !!mode;
            if (testMode !== newMode) {
                testMode = newMode;
                state.setTestMode(newMode);
            }
        },
        
        /**
         * Toggles test mode
         */
        toggleTestMode
    };
}