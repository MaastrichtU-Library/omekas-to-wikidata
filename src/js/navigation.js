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
    
    // Use test mode from state
    let testMode = state.isTestMode();
    console.log('Navigation initialized with testMode:', testMode);

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

    // Function to update UI and functionality based on test mode
    function updateTestModeStatus() {
        // In test mode, ensure all step buttons are clickable by adding a visual indicator
        steps.forEach(step => {
            if (testMode) {
                step.classList.add('test-mode-enabled');
            } else {
                step.classList.remove('test-mode-enabled');
            }
        });
        
        // Update button states based on test mode
        if (testMode) {
            // Enable all navigation buttons in test mode
            [proceedToMappingBtn, proceedToReconciliationBtn, proceedToDesignerBtn, proceedToExportBtn].forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                }
            });
        } else {
            // In normal mode, disable buttons based on validation state
            if (proceedToMappingBtn) proceedToMappingBtn.disabled = !state.validateStep(1);
            if (proceedToReconciliationBtn) proceedToReconciliationBtn.disabled = !state.validateStep(2);
            if (proceedToDesignerBtn) proceedToDesignerBtn.disabled = !state.validateStep(3);
            if (proceedToExportBtn) proceedToExportBtn.disabled = !state.validateStep(4);
        }
        
        // Remove old test mode indicator if it exists
        const oldIndicator = document.getElementById('test-mode-indicator');
        if (oldIndicator) {
            document.body.removeChild(oldIndicator);
        }
        
        // Add or remove test mode class on the body
        if (testMode) {
            document.body.classList.add('test-mode-active');
            
            // Create small green indicator in the top right corner
            const indicator = document.createElement('div');
            indicator.id = 'test-mode-indicator';
            indicator.textContent = 'Test Mode';
            indicator.style.position = 'fixed';
            indicator.style.top = '10px';
            indicator.style.right = '10px';
            indicator.style.backgroundColor = '#4caf50'; // Green background
            indicator.style.color = 'white';
            indicator.style.padding = '5px 10px';
            indicator.style.fontSize = '12px';
            indicator.style.fontWeight = 'bold';
            indicator.style.borderRadius = '4px';
            indicator.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            indicator.style.zIndex = '1000';
            document.body.appendChild(indicator);
        } else {
            document.body.classList.remove('test-mode-active');
        }
    }
    
    // Initialize test mode UI
    updateTestModeStatus();
    
    // Enable step navigation by clicking on step indicators
    steps.forEach(step => {
        // Track double-click timing
        let lastClickTime = 0;
        
        step.addEventListener('click', (event) => {
            console.log('Step clicked:', step.getAttribute('data-step'), 'Event target:', event.target.tagName);
            
            const stepNumber = parseInt(step.getAttribute('data-step'));
            const currentTime = new Date().getTime();
            const timeSinceLastClick = currentTime - lastClickTime;
            const isDoubleClick = timeSinceLastClick < 300; // 300ms threshold for double click
            
            console.log('Click timing:', {
                timeSinceLastClick,
                isDoubleClick
            });
            
            lastClickTime = currentTime;
            
            // Toggle test mode with Control+Click or Command+Click on any step
            if (event.ctrlKey || event.metaKey) {
                testMode = !testMode;
                state.setTestMode(testMode);
                updateTestModeStatus();
                return;
            }
            
            // Alternative: Toggle test mode with double-click on any step
            if (isDoubleClick) {
                testMode = !testMode;
                state.setTestMode(testMode);
                updateTestModeStatus();
                return;
            }
            
            // Normal navigation behavior
            if (testMode) {
                // In test mode, allow navigation to any step
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

    // Return the navigation API so it can be used by other modules
    return {
        navigateToStep,
        getTestMode: () => {
            testMode = state.isTestMode(); // Sync with state
            return testMode;
        },
        setTestMode: (mode) => {
            testMode = !!mode;
            state.setTestMode(testMode);
            updateTestModeStatus();
        }
    };
}