/**
 * UI-specific functionality for the navigation module
 * Handles DOM manipulation and event handling for step navigation
 * @module ui/navigation-ui
 */
import { eventSystem } from '../events.js';
import { toggleClass, createElement } from './components.js';

export function setupNavigationUI() {
    // UI Elements
    const steps = document.querySelectorAll('.step');
    const stepContents = document.querySelectorAll('.step-content');
    const progressBar = document.querySelector('.progress');
    
    // Navigation buttons
    const navigationButtons = {
        proceedToMapping: document.getElementById('proceed-to-mapping'),
        backToInput: document.getElementById('back-to-input'),
        proceedToReconciliation: document.getElementById('proceed-to-reconciliation'),
        backToMapping: document.getElementById('back-to-mapping'),
        proceedToDesigner: document.getElementById('proceed-to-designer'),
        backToReconciliation: document.getElementById('back-to-reconciliation'),
        proceedToExport: document.getElementById('proceed-to-export'),
        backToDesigner: document.getElementById('back-to-designer'),
        startNewProject: document.getElementById('start-new-project')
    };
    
    // Track test mode state
    let testMode = false;
    
    /**
     * Updates the UI for a specific step
     * @param {number} stepNumber - The step number to display (1-5)
     */
    function updateStepUI(stepNumber) {
        if (stepNumber < 1 || stepNumber > 5) return;
        
        // Update step indicators
        steps.forEach(step => {
            toggleClass(step, 'active', false);
            toggleClass(step, 'step--active', false);
        });
        
        // Update step content
        stepContents.forEach(content => {
            toggleClass(content, 'active', false);
        });
        
        // Set the active step and content
        const targetStep = document.querySelector(`.step[data-step="${stepNumber}"]`);
        toggleClass(targetStep, 'active', true);
        toggleClass(targetStep, 'step--active', true);
        
        const targetContent = document.getElementById(`step${stepNumber}`);
        toggleClass(targetContent, 'active', true);
        
        // Update progress bar
        const progressPercentage = ((stepNumber - 1) / 4) * 100;
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
        }
    }
    
    /**
     * Updates UI and functionality based on current test mode status
     * @param {boolean} isTestMode - Whether test mode is enabled
     */
    function updateTestModeUI(isTestMode) {
        testMode = isTestMode;
        
        // Update step indicators
        steps.forEach(step => {
            toggleClass(step, 'test-mode-enabled', isTestMode);
        });
        
        // Update button states based on test mode
        if (isTestMode) {
            // Enable all navigation buttons in test mode
            [
                navigationButtons.proceedToMapping,
                navigationButtons.proceedToReconciliation,
                navigationButtons.proceedToDesigner,
                navigationButtons.proceedToExport
            ].forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                }
            });
        }
        
        // Remove old test mode indicator
        const oldIndicator = document.getElementById('test-mode-indicator');
        if (oldIndicator) {
            document.body.removeChild(oldIndicator);
        }
        
        // Add or remove test mode class on the body
        toggleClass(document.body, 'test-mode-active', isTestMode);
        
        // Create indicator if in test mode
        if (isTestMode) {
            const indicator = createElement('div', {
                id: 'test-mode-indicator',
                textContent: 'Test Mode',
                style: {
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: '1000'
                }
            });
            
            document.body.appendChild(indicator);
        }
    }
    
    /**
     * Updates button states based on step validation results
     * @param {number} step - The step number
     * @param {boolean} isValid - Whether the step is valid
     */
    function updateButtonState(step, isValid) {
        if (testMode) return; // In test mode, all buttons are enabled
        
        switch (step) {
            case 1:
                if (navigationButtons.proceedToMapping) {
                    navigationButtons.proceedToMapping.disabled = !isValid;
                }
                break;
            case 2:
                if (navigationButtons.proceedToReconciliation) {
                    navigationButtons.proceedToReconciliation.disabled = !isValid;
                }
                break;
            case 3:
                if (navigationButtons.proceedToDesigner) {
                    navigationButtons.proceedToDesigner.disabled = !isValid;
                }
                break;
            case 4:
                if (navigationButtons.proceedToExport) {
                    navigationButtons.proceedToExport.disabled = !isValid;
                }
                break;
        }
    }
    
    // Set up event listeners to handle UI updates based on navigation events
    function setupEventListeners() {
        // Listen for step changes
        eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
            updateStepUI(data.newStep);
        });
        
        // Listen for test mode changes
        eventSystem.subscribe(eventSystem.Events.UI_TEST_MODE_CHANGED, (data) => {
            updateTestModeUI(data.newMode);
        });
        
        // Listen for validation results
        eventSystem.subscribe(eventSystem.Events.VALIDATION_SUCCEEDED, (data) => {
            updateButtonState(data.step, true);
        });
        
        eventSystem.subscribe(eventSystem.Events.VALIDATION_FAILED, (data) => {
            updateButtonState(data.step, false);
        });
    }
    
    // Initialize
    setupEventListeners();
    
    // Return UI API
    return {
        updateStepUI,
        updateTestModeUI,
        updateButtonState
    };
}