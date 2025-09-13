import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad, waitForElement } from '../../helpers/common-actions.js';
import { selectors } from '../../helpers/test-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Complete Workflow Journey @critical', () => {
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