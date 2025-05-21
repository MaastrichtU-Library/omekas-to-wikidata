/**
 * Tests for the navigation UI module
 */

// Import the modules to test
import { setupNavigationUI } from '../../../src/js/ui/navigation-ui.js';
import { eventSystem } from '../../../src/js/events.js';

// Mock the event system
jest.mock('../../../src/js/events.js', () => ({
  eventSystem: {
    Events: {
      STEP_CHANGED: 'step:changed',
      UI_TEST_MODE_CHANGED: 'ui:testMode:changed',
      VALIDATION_SUCCEEDED: 'validation:succeeded',
      VALIDATION_FAILED: 'validation:failed'
    },
    subscribe: jest.fn(() => jest.fn())
  }
}));

describe('Navigation UI Module', () => {
  let navigationUI;
  let steps;
  let stepContents;
  let progressBar;
  let proceedToMappingBtn;
  
  beforeEach(() => {
    // Get DOM elements
    steps = document.querySelectorAll('.step');
    stepContents = document.querySelectorAll('.step-content');
    progressBar = document.querySelector('.progress');
    proceedToMappingBtn = document.getElementById('proceed-to-mapping');
    
    // Initialize the navigation UI
    navigationUI = setupNavigationUI();
  });

  describe('updateStepUI', () => {
    test('updates UI for step 1', () => {
      navigationUI.updateStepUI(1);
      
      // Step 1 should be active
      expect(steps[0].classList.contains('active')).toBe(true);
      expect(steps[0].classList.contains('step--active')).toBe(true);
      
      // Step content 1 should be active
      expect(stepContents[0].classList.contains('active')).toBe(true);
      
      // Progress bar should be at 0%
      expect(progressBar.style.width).toBe('0%');
    });
    
    test('updates UI for step 3', () => {
      navigationUI.updateStepUI(3);
      
      // Clear previous active steps
      steps.forEach(step => {
        expect(step.classList.contains('active')).toBe(step === steps[2]);
        expect(step.classList.contains('step--active')).toBe(step === steps[2]);
      });
      
      // Step content 3 should be active
      stepContents.forEach(content => {
        expect(content.classList.contains('active')).toBe(content === stepContents[2]);
      });
      
      // Progress bar should be at 50%
      expect(progressBar.style.width).toBe('50%');
    });
    
    test('updates UI for step 5', () => {
      navigationUI.updateStepUI(5);
      
      // Step 5 should be active
      expect(steps[4].classList.contains('active')).toBe(true);
      expect(steps[4].classList.contains('step--active')).toBe(true);
      
      // Step content 5 should be active
      expect(stepContents[4].classList.contains('active')).toBe(true);
      
      // Progress bar should be at 100%
      expect(progressBar.style.width).toBe('100%');
    });
    
    test('ignores invalid step numbers', () => {
      // First set a known state
      navigationUI.updateStepUI(2);
      
      // Then try to set an invalid step
      navigationUI.updateStepUI(0);
      
      // Step 2 should still be active
      expect(steps[1].classList.contains('active')).toBe(true);
      expect(stepContents[1].classList.contains('active')).toBe(true);
      
      // Try another invalid step
      navigationUI.updateStepUI(6);
      
      // Step 2 should still be active
      expect(steps[1].classList.contains('active')).toBe(true);
      expect(stepContents[1].classList.contains('active')).toBe(true);
    });
  });

  describe('updateTestModeUI', () => {
    test('enables test mode UI', () => {
      navigationUI.updateTestModeUI(true);
      
      // All steps should have test-mode-enabled class
      steps.forEach(step => {
        expect(step.classList.contains('test-mode-enabled')).toBe(true);
      });
      
      // Body should have test-mode-active class
      expect(document.body.classList.contains('test-mode-active')).toBe(true);
      
      // Test mode indicator should be present
      const indicator = document.getElementById('test-mode-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator.textContent).toBe('Test Mode');
      
      // All navigation buttons should be enabled
      expect(proceedToMappingBtn.disabled).toBe(false);
    });
    
    test('disables test mode UI', () => {
      // First enable test mode
      navigationUI.updateTestModeUI(true);
      
      // Then disable it
      navigationUI.updateTestModeUI(false);
      
      // No steps should have test-mode-enabled class
      steps.forEach(step => {
        expect(step.classList.contains('test-mode-enabled')).toBe(false);
      });
      
      // Body should not have test-mode-active class
      expect(document.body.classList.contains('test-mode-active')).toBe(false);
      
      // Test mode indicator should be removed
      const indicator = document.getElementById('test-mode-indicator');
      expect(indicator).toBeNull();
    });
  });

  describe('updateButtonState', () => {
    test('enables button when step is valid', () => {
      // Start with disabled button
      proceedToMappingBtn.disabled = true;
      
      navigationUI.updateButtonState(1, true);
      
      expect(proceedToMappingBtn.disabled).toBe(false);
    });
    
    test('disables button when step is invalid', () => {
      // Start with enabled button
      proceedToMappingBtn.disabled = false;
      
      navigationUI.updateButtonState(1, false);
      
      expect(proceedToMappingBtn.disabled).toBe(true);
    });
    
    test('does not change button state in test mode', () => {
      // First enable test mode
      navigationUI.updateTestModeUI(true);
      
      // Start with enabled button
      proceedToMappingBtn.disabled = false;
      
      navigationUI.updateButtonState(1, false);
      
      // Button should still be enabled because we're in test mode
      expect(proceedToMappingBtn.disabled).toBe(false);
    });
  });

  describe('Event Subscriptions', () => {
    test('subscribes to the correct events', () => {
      expect(eventSystem.subscribe).toHaveBeenCalledWith(
        eventSystem.Events.STEP_CHANGED, 
        expect.any(Function)
      );
      
      expect(eventSystem.subscribe).toHaveBeenCalledWith(
        eventSystem.Events.UI_TEST_MODE_CHANGED, 
        expect.any(Function)
      );
      
      expect(eventSystem.subscribe).toHaveBeenCalledWith(
        eventSystem.Events.VALIDATION_SUCCEEDED, 
        expect.any(Function)
      );
      
      expect(eventSystem.subscribe).toHaveBeenCalledWith(
        eventSystem.Events.VALIDATION_FAILED, 
        expect.any(Function)
      );
    });
  });
});