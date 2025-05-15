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
    
    // Initialize test mode (default true for development, switch to false for production)
    let testMode = true;
    console.log('Navigation initialized with testMode:', testMode);
    
    // Get the test mode switch element
    const testModeSwitch = document.getElementById('test-mode-switch');
    const testModeStatus = document.getElementById('test-mode-status');
    console.log('Test mode DOM elements:', {
        'testModeSwitch': testModeSwitch ? 'Found' : 'Not found',
        'testModeStatus': testModeStatus ? 'Found' : 'Not found'
    });

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
        console.log('Updating test mode status. Current value:', testMode);
        
        // In test mode, ensure all step buttons are clickable by adding a visual indicator
        steps.forEach(step => {
            if (testMode) {
                step.classList.add('test-mode-enabled');
                console.log('Added test-mode-enabled class to step', step.getAttribute('data-step'));
            } else {
                step.classList.remove('test-mode-enabled');
                console.log('Removed test-mode-enabled class from step', step.getAttribute('data-step'));
            }
        });
        
        // Update button states based on test mode
        if (testMode) {
            // Enable all navigation buttons in test mode
            [proceedToMappingBtn, proceedToReconciliationBtn, proceedToDesignerBtn, proceedToExportBtn].forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                    console.log('Enabled button:', btn.id);
                }
            });
            
            console.log('⚠️ TEST MODE ENABLED: Step validation is bypassed and all steps are accessible');
        } else {
            // In normal mode, disable buttons based on validation state
            if (proceedToMappingBtn) {
                proceedToMappingBtn.disabled = !state.validateStep(1);
                console.log('Button proceedToMapping disabled state:', proceedToMappingBtn.disabled);
            }
            if (proceedToReconciliationBtn) {
                proceedToReconciliationBtn.disabled = !state.validateStep(2);
                console.log('Button proceedToReconciliation disabled state:', proceedToReconciliationBtn.disabled);
            }
            if (proceedToDesignerBtn) {
                proceedToDesignerBtn.disabled = !state.validateStep(3);
                console.log('Button proceedToDesigner disabled state:', proceedToDesignerBtn.disabled);
            }
            if (proceedToExportBtn) {
                proceedToExportBtn.disabled = !state.validateStep(4);
                console.log('Button proceedToExport disabled state:', proceedToExportBtn.disabled);
            }
            
            console.log('✅ TEST MODE DISABLED: Step validation is enabled');
        }
    }
    
    // Initialize test mode UI
    updateTestModeStatus();
    
    // Enable step navigation by clicking on step indicators
    steps.forEach(step => {
        // Track double-click timing
        let lastClickTime = 0;
        
        step.addEventListener('click', (event) => {
            console.log('Step clicked:', step.getAttribute('data-step'), 'Event target:', event.target.tagName, 'Event path:', event.composedPath().map(el => el.tagName || el.nodeName).join(' > '));
            
            const stepNumber = parseInt(step.getAttribute('data-step'));
            const currentTime = new Date().getTime();
            const timeSinceLastClick = currentTime - lastClickTime;
            const isDoubleClick = timeSinceLastClick < 300; // 300ms threshold for double click
            
            console.log('Click timing:', {
                currentTime,
                lastClickTime,
                timeSinceLastClick,
                isDoubleClick
            });
            
            lastClickTime = currentTime;
            
            // Toggle test mode with Control+Click or Command+Click on any step
            if (event.ctrlKey || event.metaKey) {
                console.log('Modifier key detected: ctrlKey=', event.ctrlKey, 'metaKey=', event.metaKey);
                testMode = !testMode;
                updateTestModeStatus();
                
                // Show a temporary message to indicate mode change
                const message = document.createElement('div');
                message.className = testMode ? 'test-mode-active' : 'test-mode-inactive';
                message.textContent = testMode ? 'Test Mode Enabled' : 'Test Mode Disabled';
                message.style.position = 'fixed';
                message.style.top = '10px';
                message.style.right = '10px';
                message.style.padding = '8px 16px';
                message.style.borderRadius = '4px';
                message.style.backgroundColor = '#f5f5f5';
                message.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
                message.style.zIndex = '1000';
                
                document.body.appendChild(message);
                
                // Remove the message after 2 seconds
                setTimeout(() => {
                    document.body.removeChild(message);
                }, 2000);
                
                return;
            }
            
            // Alternative: Toggle test mode with double-click on any step
            if (isDoubleClick) {
                console.log('Double-click detected on step', stepNumber, '- testMode toggled from', testMode, 'to', !testMode);
                testMode = !testMode;
                updateTestModeStatus();
                
                // Show a temporary message to indicate mode change
                const message = document.createElement('div');
                message.className = testMode ? 'test-mode-active' : 'test-mode-inactive';
                message.textContent = testMode ? 'Test Mode Enabled' : 'Test Mode Disabled';
                message.style.position = 'fixed';
                message.style.top = '10px';
                message.style.right = '10px';
                message.style.padding = '8px 16px';
                message.style.borderRadius = '4px';
                message.style.backgroundColor = '#f5f5f5';
                message.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
                message.style.zIndex = '1000';
                
                document.body.appendChild(message);
                
                // Remove the message after 2 seconds
                setTimeout(() => {
                    document.body.removeChild(message);
                }, 2000);
                
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
    
    // Check if testModeSwitch exists
    console.log('Testing for testModeSwitch element:', testModeSwitch ? 'Found' : 'Not found');
    
    // Add event listener for test mode toggle
    if (testModeSwitch) {
        testModeSwitch.addEventListener('change', updateTestMode);
        console.log('Added change event listener to testModeSwitch');
        
        // Initialize test mode
        updateTestMode();
    } else {
        console.log('testModeSwitch element not found, using default test mode state:', testMode);
        // Initialize with default test mode
        updateTestModeStatus();
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