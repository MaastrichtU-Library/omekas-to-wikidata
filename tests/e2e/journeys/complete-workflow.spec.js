import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad, waitForElement } from '../../helpers/common-actions.js';
import { selectors } from '../../helpers/test-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Complete Workflow Journey @critical', () => {
  test('navigation through all workflow steps', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    const app = new OmekaToWikidataPage(page);
    
    await app.goto();
    
    // Enable test mode to allow navigation between all steps
    await app.enableTestMode();
    
    await test.step('Navigate through all 5 steps', async () => {
      // Test navigation through all steps
      for (let step = 1; step <= 5; step++) {
        await app.navigateToStep(step);
        await waitForDataLoad(page);
        
        // Verify we're on the correct step
        const currentStep = await app.getActiveStep();
        expect(currentStep).toBe(step);
        
        // Wait a bit for step content to load
        await page.waitForTimeout(300);
      }
    });

    // Assert no console errors throughout the workflow
    assertNoErrors();
  });

  test('project controls are accessible', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    const app = new OmekaToWikidataPage(page);
    
    await app.goto();
    
    await test.step('Verify project controls exist', async () => {
      // Check if save button exists and is visible
      await expect(app.saveProjectBtn).toBeVisible();
      
      // Check if load button exists and is visible  
      await expect(app.loadProjectBtn).toBeVisible();
    });

    assertNoErrors();
  });
});