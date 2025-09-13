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
    this.stepNavigation = page.locator('.steps-navigation');
    this.progressBar = page.locator('.progress-bar .progress');
    
    // Modal elements  
    this.modal = page.locator('.modal');
    this.modalContainer = page.locator('.modal-container');
    this.modalTitle = page.locator('#modal-title');
    this.modalContent = page.locator('#modal-content');
    this.modalFooter = page.locator('#modal-footer');
    this.modalCloseBtn = page.locator('#close-modal');
    
    // Session restore modal
    this.sessionRestoreModal = page.locator('#restore-session-modal');
    this.restoreSessionBtn = page.locator('#restore-session-btn');
    this.startFreshBtn = page.locator('#start-fresh-btn');
    
    // Step 1 - Input elements
    this.input = {
      apiUrlInput: page.locator('#api-url'),
      fetchDataBtn: page.locator('#fetch-data'),
      loadingIndicator: page.locator('#loading'),
      dataStatus: page.locator('#data-status'),
      viewRawJsonBtn: page.locator('#view-raw-json'),
      proceedToMappingBtn: page.locator('#proceed-to-mapping'),
      manualJsonButton: page.locator('#manual-json-button'),
      manualJsonArea: page.locator('#manual-json-area'),
      manualJsonTextarea: page.locator('#manual-json-textarea'),
      processManualJsonButton: page.locator('#process-manual-json-button'),
      cancelManualJsonButton: page.locator('#cancel-manual-json'),
      step1Section: page.locator('#step1')
    };
    
    // Step 2 - Mapping elements
    this.mapping = {
      entitySchemaInput: page.locator('#entity-schema'),
      nonLinkedKeys: page.locator('#non-linked-keys'),
      mappedKeys: page.locator('#mapped-keys'),
      ignoredKeys: page.locator('#ignored-keys'),
      manualProperties: page.locator('#manual-properties'),
      addManualPropertyBtn: page.locator('#add-manual-property'),
      loadMappingBtn: page.locator('#load-mapping'),
      saveMappingBtn: page.locator('#save-mapping'),
      loadMappingFileInput: page.locator('#load-mapping-file'),
      backToInputBtn: page.locator('#back-to-input'),
      proceedToReconciliationBtn: page.locator('#proceed-to-reconciliation'),
      testMappingModelBtn: page.locator('#test-mapping-model'),
      step2Section: page.locator('#step2'),
      keySections: page.locator('.key-sections'),
      keyListItems: page.locator('.key-list li'),
      mappingActions: page.locator('.mapping-actions')
    };
    
    // Step 3 - Reconciliation elements
    this.reconciliation = {
      reconciliationTable: page.locator('.reconciliation-table'),
      propertyHeaders: page.locator('#property-headers'),
      reconciliationRows: page.locator('#reconciliation-rows'),
      reconcileNextBtn: page.locator('#reconcile-next'),
      backToMappingBtn: page.locator('#back-to-mapping'),
      proceedToDesignerBtn: page.locator('#proceed-to-designer'),
      testReconciliationModelBtn: page.locator('#test-reconciliation-model'),
      step3Section: page.locator('#step3'),
      reconciliationControls: page.locator('.reconciliation-controls'),
      tableContainer: page.locator('.reconciliation-table-container')
    };
    
    // Common form elements
    this.submitButton = page.locator('[type="submit"]');
    this.cancelButton = page.locator('.btn-cancel');
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

  // ========== STEP 1 - INPUT METHODS ==========

  /**
   * Enter an API URL in the input field
   * @param {string} url - The API URL to enter
   */
  async enterApiUrl(url) {
    await this.input.apiUrlInput.fill(url);
  }

  /**
   * Click the fetch data button and wait for completion
   */
  async fetchData() {
    await this.input.fetchDataBtn.click();
    await this.waitForDataLoad();
  }

  /**
   * Open manual JSON input area
   */
  async openManualJsonInput() {
    await this.input.manualJsonButton.click();
    await expect(this.input.manualJsonArea).toBeVisible();
  }

  /**
   * Enter JSON data manually
   * @param {string} jsonData - JSON string to enter
   */
  async enterManualJson(jsonData) {
    await this.input.manualJsonTextarea.fill(jsonData);
  }

  /**
   * Process manually entered JSON data
   */
  async processManualJson() {
    await this.input.processManualJsonButton.click();
    await this.waitForDataLoad();
  }

  /**
   * Cancel manual JSON input
   */
  async cancelManualJson() {
    await this.input.cancelManualJsonButton.click();
    await expect(this.input.manualJsonArea).toBeHidden();
  }

  /**
   * Wait for data to load in input step
   */
  async waitForDataLoad() {
    await this.page.waitForSelector('#loading', { state: 'hidden', timeout: 30000 }).catch(() => {});
    // Wait a bit for UI to update after processing
    await this.page.waitForTimeout(1000);
  }

  /**
   * Proceed from input to mapping step
   */
  async proceedToMapping() {
    await this.input.proceedToMappingBtn.click();
    await this.waitForStepLoad();
  }

  // ========== STEP 2 - MAPPING METHODS ==========

  /**
   * Set entity schema value
   * @param {string} qid - Wikidata Q-identifier (e.g., 'Q5')
   */
  async setEntitySchema(qid) {
    await this.mapping.entitySchemaInput.fill(qid);
  }

  /**
   * Add a manual property
   */
  async addManualProperty() {
    await this.mapping.addManualPropertyBtn.click();
    // Wait for modal to appear
    await expect(this.modal).toBeVisible();
  }

  /**
   * Save current mapping to file
   */
  async saveMapping() {
    await this.mapping.saveMappingBtn.click();
  }

  /**
   * Load mapping from file
   * @param {string} filePath - Path to mapping file
   */
  async loadMapping(filePath) {
    await this.mapping.loadMappingBtn.click();
    await this.mapping.loadMappingFileInput.setInputFiles(filePath);
    await this.waitForProcessing();
  }

  /**
   * Get count of non-linked keys
   * @returns {Promise<number>} Number of non-linked keys
   */
  async getNonLinkedKeysCount() {
    const items = this.mapping.nonLinkedKeys.locator('li:not(.placeholder)');
    return await items.count();
  }

  /**
   * Get count of mapped keys
   * @returns {Promise<number>} Number of mapped keys
   */
  async getMappedKeysCount() {
    const items = this.mapping.mappedKeys.locator('li:not(.placeholder)');
    return await items.count();
  }

  /**
   * Get count of ignored keys
   * @returns {Promise<number>} Number of ignored keys
   */
  async getIgnoredKeysCount() {
    const items = this.mapping.ignoredKeys.locator('li:not(.placeholder)');
    return await items.count();
  }

  /**
   * Check if proceed to reconciliation button is enabled
   */
  async canProceedToReconciliation() {
    return await this.mapping.proceedToReconciliationBtn.isEnabled();
  }

  /**
   * Proceed from mapping to reconciliation step
   */
  async proceedToReconciliation() {
    await this.mapping.proceedToReconciliationBtn.click();
    await this.waitForStepLoad();
  }

  /**
   * Go back to input step from mapping
   */
  async backToInput() {
    await this.mapping.backToInputBtn.click();
    await this.waitForStepLoad();
  }

  // ========== STEP 3 - RECONCILIATION METHODS ==========

  /**
   * Get reconciliation table row count
   * @returns {Promise<number>} Number of data rows in reconciliation table
   */
  async getReconciliationRowCount() {
    const rows = this.reconciliation.reconciliationRows.locator('tr:not(.placeholder)');
    return await rows.count();
  }

  /**
   * Get reconciliation table column count
   * @returns {Promise<number>} Number of property columns
   */
  async getReconciliationColumnCount() {
    const headers = this.reconciliation.propertyHeaders.locator('th');
    return await headers.count();
  }

  /**
   * Click reconcile next item button
   */
  async reconcileNext() {
    await this.reconciliation.reconcileNextBtn.click();
    // Wait for any modal or processing to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if proceed to designer button is enabled
   */
  async canProceedToDesigner() {
    return await this.reconciliation.proceedToDesignerBtn.isEnabled();
  }

  /**
   * Proceed from reconciliation to designer step
   */
  async proceedToDesigner() {
    await this.reconciliation.proceedToDesignerBtn.click();
    await this.waitForStepLoad();
  }

  /**
   * Go back to mapping step from reconciliation
   */
  async backToMapping() {
    await this.reconciliation.backToMappingBtn.click();
    await this.waitForStepLoad();
  }

  /**
   * Click on a specific reconciliation table cell
   * @param {number} row - Row index (0-based)
   * @param {number} col - Column index (0-based)
   */
  async clickReconciliationCell(row, col) {
    const cell = this.reconciliation.reconciliationRows
      .locator('tr').nth(row)
      .locator('td').nth(col);
    await cell.click();
  }

  // ========== GENERAL HELPER METHODS ==========

  /**
   * Wait for a specific step to become active
   * @param {number} stepNumber - Step number (1-5)
   */
  async waitForStepActive(stepNumber) {
    await expect(this.stepIndicators.nth(stepNumber - 1)).toHaveClass(/active/);
    await this.waitForStepLoad();
  }

  /**
   * Get text content from data status area
   * @returns {Promise<string>} Data status text
   */
  async getDataStatusText() {
    return await this.input.dataStatus.textContent();
  }

  /**
   * Check if loading indicator is visible
   * @returns {Promise<boolean>} True if loading is visible
   */
  async isLoading() {
    try {
      return await this.input.loadingIndicator.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Verify page title
   */
  async verifyPageTitle() {
    await expect(this.page).toHaveTitle(/Omeka S to Wikidata/);
  }

  /**
   * Take a screenshot for debugging
   * @param {string} name - Screenshot name
   */
  async takeScreenshot(name) {
    await this.page.screenshot({ 
      path: `test-artifacts/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }
}