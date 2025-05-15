/**
 * Handles step navigation and progress tracking
 */
export function setupNavigation(state) {
    const steps = document.querySelectorAll('.step');
    const stepContents = document.querySelectorAll('.step-content');
    const progressBar = document.querySelector('.progress');
    
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
    
    // Test mode toggle elements
    const testModeSwitch = document.getElementById('test-mode-switch');
    const testModeStatus = document.getElementById('test-mode-status');

    // Initialize test mode from checkbox (defaults to true)
    let testMode = testModeSwitch ? testModeSwitch.checked : true;

    // Function to navigate to a specific step
    function navigateToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 5) return;
        
        // Update state
        state.setCurrentStep(stepNumber);
        
        // Update UI
        steps.forEach(step => {
            step.classList.remove('active');
        });
        
        stepContents.forEach(content => {
            content.classList.remove('active');
        });
        
        document.querySelector(`.step[data-step="${stepNumber}"]`).classList.add('active');
        document.getElementById(`step${stepNumber}`).classList.add('active');
        
        // Update progress bar
        const progressPercentage = ((stepNumber - 1) / 4) * 100;
        progressBar.style.width = `${progressPercentage}%`;

        // In test mode, mark all steps up to current as completed
        if (testMode && stepNumber > state.getHighestCompletedStep()) {
            for (let i = 1; i < stepNumber; i++) {
                state.completeStep(i);
            }
        }
    }

    // Enable step navigation by clicking on step indicators
    steps.forEach(step => {
        step.addEventListener('click', () => {
            const stepNumber = parseInt(step.getAttribute('data-step'));
            
            // In test mode, allow navigation to any step
            if (testMode) {
                navigateToStep(stepNumber);
            } else {
                // Normal behavior: Only allow navigation to steps that are already completed or the current step + 1
                if (stepNumber <= state.getHighestCompletedStep() + 1) {
                    navigateToStep(stepNumber);
                }
            }
        });
    });

    // Step navigation button handlers
    if (proceedToMappingBtn) {
        proceedToMappingBtn.addEventListener('click', () => {
            // In test mode, bypass validation
            if (testMode) {
                state.completeStep(1);
                navigateToStep(2);
            } else {
                // Validate step 1 before proceeding
                if (state.validateStep(1)) {
                    state.completeStep(1);
                    navigateToStep(2);
                }
            }
        });
    }

    if (backToInputBtn) {
        backToInputBtn.addEventListener('click', () => {
            navigateToStep(1);
        });
    }

    if (proceedToReconciliationBtn) {
        proceedToReconciliationBtn.addEventListener('click', () => {
            // In test mode, bypass validation
            if (testMode) {
                state.completeStep(2);
                navigateToStep(3);
            } else {
                // Validate step 2 before proceeding
                if (state.validateStep(2)) {
                    state.completeStep(2);
                    navigateToStep(3);
                }
            }
        });
    }

    if (backToMappingBtn) {
        backToMappingBtn.addEventListener('click', () => {
            navigateToStep(2);
        });
    }

    if (proceedToDesignerBtn) {
        proceedToDesignerBtn.addEventListener('click', () => {
            // In test mode, bypass validation
            if (testMode) {
                state.completeStep(3);
                navigateToStep(4);
            } else {
                // Validate step 3 before proceeding
                if (state.validateStep(3)) {
                    state.completeStep(3);
                    navigateToStep(4);
                }
            }
        });
    }

    if (backToReconciliationBtn) {
        backToReconciliationBtn.addEventListener('click', () => {
            navigateToStep(3);
        });
    }

    if (proceedToExportBtn) {
        proceedToExportBtn.addEventListener('click', () => {
            // In test mode, bypass validation
            if (testMode) {
                state.completeStep(4);
                navigateToStep(5);
            } else {
                // Validate step 4 before proceeding
                if (state.validateStep(4)) {
                    state.completeStep(4);
                    navigateToStep(5);
                }
            }
        });
    }

    if (backToDesignerBtn) {
        backToDesignerBtn.addEventListener('click', () => {
            navigateToStep(4);
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

    // Add keyboard navigation (arrow keys)
    document.addEventListener('keydown', (event) => {
        const currentStep = state.getCurrentStep();
        
        if (event.key === 'ArrowRight' && currentStep < 5) {
            // In test mode, allow navigation to any step with arrow keys
            if (testMode) {
                navigateToStep(currentStep + 1);
            } else {
                // Normal behavior: Check if we can proceed to the next step
                if (currentStep <= state.getHighestCompletedStep()) {
                    navigateToStep(currentStep + 1);
                }
            }
        } else if (event.key === 'ArrowLeft' && currentStep > 1) {
            navigateToStep(currentStep - 1);
        }
    });

    // Function to update test mode
    function updateTestMode() {
        testMode = testModeSwitch.checked;
        
        // Update UI
        if (testMode) {
            testModeStatus.textContent = 'Active';
            testModeStatus.className = 'test-mode-active';
            
            // Enable all navigation buttons
            [proceedToMappingBtn, proceedToReconciliationBtn, proceedToDesignerBtn, proceedToExportBtn].forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                }
            });
            
            console.log('⚠️ TEST MODE ENABLED: Step validation is bypassed and all steps are accessible');
        } else {
            testModeStatus.textContent = 'Inactive';
            testModeStatus.className = 'test-mode-inactive';
            
            // Disable buttons based on validation state
            if (proceedToMappingBtn) proceedToMappingBtn.disabled = !state.validateStep(1);
            if (proceedToReconciliationBtn) proceedToReconciliationBtn.disabled = !state.validateStep(2);
            if (proceedToDesignerBtn) proceedToDesignerBtn.disabled = !state.validateStep(3);
            if (proceedToExportBtn) proceedToExportBtn.disabled = !state.validateStep(4);
            
            console.log('✅ TEST MODE DISABLED: Step validation is enabled');
        }
    }
    
    // Add event listener for test mode toggle
    if (testModeSwitch) {
        testModeSwitch.addEventListener('change', updateTestMode);
        
        // Initialize test mode
        updateTestMode();
    }

    // Return the navigation API so it can be used by other modules
    return {
        navigateToStep,
        getTestMode: () => testMode,
        setTestMode: (mode) => {
            if (testModeSwitch) {
                testModeSwitch.checked = !!mode;
                updateTestMode();
            } else {
                testMode = !!mode;
            }
        }
    };
}