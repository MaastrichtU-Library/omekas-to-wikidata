import { expect } from '@playwright/test';

/**
 * Page Object Model for Omeka S to Wikidata application
 * Provides consistent interface for interacting with the application
 */
export class OmekaToWikidataPage {
  constructor(page) {
    this.page = page;
    
    // Main UI elements
    this.saveProjectBtn = page.locator('#save-project');
    this.loadProjectBtn = page.locator('#load-project');
    this.fileInput = page.locator('input[type="file"]');
    this.stepIndicators = page.locator('.steps-navigation .step');
    
    // Navigation elements
    this.stepNavigation = page.locator('.step-navigation');
    this.nextButton = page.locator('.btn-next');
    this.prevButton = page.locator('.btn-prev');
    
    // Modal elements  
    this.modal = page.locator('.modal');
    this.modalCloseBtn = page.locator('.modal .close');
    
    // Common form elements
    this.submitButton = page.locator('[type="submit"]');
    this.cancelButton = page.locator('.btn-cancel');
    
    // Progress indicators
    this.progressBar = page.locator('.progress-bar');
    this.loadingSpinner = page.locator('.loading');
  }

  /**
   * Navigate to the application homepage
   */
  async goto() {
    await this.page.goto('/');
  }

  /**
   * Enable test mode for easier navigation
   */
  async enableTestMode() {
    await this.page.evaluate(() => {
      // Enable test mode via the global navigation API if available
      if (window.navigation && window.navigation.setTestMode) {
        window.navigation.setTestMode(true);
      }
    });
  }

  /**
   * Navigate to a specific step by number (1-5)
   * @param {number} stepNumber - Step number (1-5)
   */
  async navigateToStep(stepNumber) {
    await this.stepIndicators.nth(stepNumber - 1).click();
    await this.waitForStepLoad();
  }

  /**
   * Upload a file using the file input
   * @param {string} filePath - Path to the file to upload
   */
  async uploadFile(filePath) {
    await this.fileInput.setInputFiles(filePath);
    await this.waitForProcessing();
  }

  /**
   * Wait for any processing indicators to disappear
   */
  async waitForProcessing() {
    await this.page.waitForSelector('.processing', { state: 'hidden', timeout: 30000 }).catch(() => {
      // Processing indicator might not exist, which is fine
    });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for step content to load
   */
  async waitForStepLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500); // Brief wait for animations
  }

  /**
   * Get the currently active step
   * @returns {Promise<number>} Active step number (1-5)
   */
  async getActiveStep() {
    // Look for the step with 'active' class
    const activeStep = this.page.locator('.steps-navigation .step.active');
    if (await activeStep.count() === 0) {
      // Fall back to step--active class
      const activeStepAlt = this.page.locator('.steps-navigation .step.step--active');
      if (await activeStepAlt.count() === 0) return 1;
      
      const stepNumber = await activeStepAlt.getAttribute('data-step');
      return parseInt(stepNumber, 10);
    }
    
    const stepNumber = await activeStep.getAttribute('data-step');
    return parseInt(stepNumber, 10);
  }

  /**
   * Close any open modal
   */
  async closeModal() {
    if (await this.modal.count() > 0 && await this.modal.isVisible()) {
      await this.modalCloseBtn.click();
    }
  }

  /**
   * Save the current project
   */
  async saveProject(filename = 'test-project') {
    await this.saveProjectBtn.click();
    // Handle save dialog if it appears
    await this.page.waitForTimeout(1000);
  }

  /**
   * Load a project from file
   * @param {string} filePath - Path to project file
   */
  async loadProject(filePath) {
    await this.loadProjectBtn.click();
    await this.fileInput.setInputFiles(filePath);
    await this.waitForProcessing();
  }
}