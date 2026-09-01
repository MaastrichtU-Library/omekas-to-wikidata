import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad } from '../../helpers/common-actions.js';

test.describe('Entity Schema Selector @smoke', () => {
  let app;
  
  test.beforeEach(async ({ page }) => {
    app = new OmekaToWikidataPage(page);
    await app.goto();
    await waitForDataLoad(page);
    
    // Enable test mode and navigate to Step 2 (Mapping)
    await app.enableTestMode();
    await app.navigateToStep(2);
  });

  test('Entity Schema selector is visible and functional', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Verify Entity Schema selector is present', async () => {
      // Check if the Entity Schema selector container exists
      const selectorContainer = page.locator('#entity-schema-selector-container');
      await expect(selectorContainer).toBeVisible();
      
      // Check if the Entity Schema selector exists within the container
      const selector = selectorContainer.locator('.entity-schema-selector-custom');
      await expect(selector).toBeVisible();
    });

    await test.step('Verify Entity Schema dropdown elements', async () => {
      // Check for the custom dropdown button
      const dropdownButton = page.locator('.entity-schema-selector-custom__button');
      await expect(dropdownButton).toBeVisible();
      await expect(dropdownButton).toContainText('Select Entity Schema');
    });

    await test.step('Verify default schema options are present', async () => {
      const dropdownButton = page.locator('.entity-schema-selector-custom__button');
      
      // Click to open dropdown
      await dropdownButton.click();
      
      // Wait for dropdown to open
      await page.waitForTimeout(200);
      
      // Check that dropdown options are visible
      const dropdownContent = page.locator('.entity-schema-selector-custom__content');
      await expect(dropdownContent).toBeVisible();
      
      // Verify specific default schemas are present
      await expect(page.locator('.entity-schema-selector-custom__option').filter({ hasText: 'E473' })).toBeVisible();
      await expect(page.locator('.entity-schema-selector-custom__option').filter({ hasText: 'E487' })).toBeVisible();
      await expect(page.locator('.entity-schema-selector-custom__option').filter({ hasText: 'E476' })).toBeVisible();
      await expect(page.locator('.entity-schema-selector-custom__option').filter({ hasText: 'E488' })).toBeVisible();
      await expect(page.locator('.entity-schema-selector-custom__option').filter({ hasText: 'Custom/Other' })).toBeVisible();
      
      // Click outside to close dropdown
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(200);
    });

    // Assert no console errors occurred
    assertNoErrors();
  });

  test('Entity Schema selection works correctly', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Select a default Entity Schema', async () => {
      const dropdownButton = page.locator('.entity-schema-selector-custom__button');
      
      // Click to open dropdown
      await dropdownButton.click();
      await page.waitForTimeout(200);
      
      // Select E473 (Maastricht University Library)
      const e473Option = page.locator('.entity-schema-selector-custom__option').filter({ hasText: 'E473' });
      await e473Option.click();
      
      // Wait for selection to complete
      await page.waitForTimeout(500);
      
      // Verify selection was made
      await expect(dropdownButton).toContainText('E473');
    });

    await test.step('Verify selection is persistent', async () => {
      // Just verify the dropdown button still shows the selected schema
      const dropdownButton = page.locator('.entity-schema-selector-custom__button');
      await expect(dropdownButton).toContainText('E473');
    });

    // Assert no console errors occurred
    assertNoErrors();
  });

  test('Custom Entity Schema modal opens correctly', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Open custom Entity Schema modal', async () => {
      const dropdownButton = page.locator('.entity-schema-selector-custom__button');
      
      // Click to open dropdown
      await dropdownButton.click();
      await page.waitForTimeout(200);
      
      // Select "Custom/Other" option
      const customOption = page.locator('.entity-schema-selector-custom__option--custom');
      await customOption.click();
      
      // Wait for modal to appear
      await page.waitForTimeout(500); // Give modal time to open
      
      // Check if modal container is visible
      const modalContainer = page.locator('#modal-container');
      await expect(modalContainer).toBeVisible();
    });

    await test.step('Verify modal content structure', async () => {
      // Check for modal title
      const modalTitle = page.locator('#modal-title');
      await expect(modalTitle).toContainText('Select Entity Schema');
      
      // Check for suggested schemas section
      const suggestedSection = page.locator('.entity-schema-search__suggested');
      await expect(suggestedSection).toBeVisible();
      
      // Check for search section
      const searchSection = page.locator('.entity-schema-search__section');
      await expect(searchSection).toBeVisible();
      
      // Check for search input
      const searchInput = page.locator('.entity-schema-search__input');
      await expect(searchInput).toBeVisible();
    });

    await test.step('Verify suggested schemas are displayed', async () => {
      // Check that default schemas are shown as cards
      const schemaCards = page.locator('.entity-schema-card');
      const cardCount = await schemaCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(4); // Should have at least 4 default schemas
      
      // Verify specific schema cards
      await expect(page.locator('.entity-schema-card').filter({ hasText: 'E473' })).toBeVisible();
      await expect(page.locator('.entity-schema-card').filter({ hasText: 'E487' })).toBeVisible();
      await expect(page.locator('.entity-schema-card').filter({ hasText: 'E476' })).toBeVisible();
      await expect(page.locator('.entity-schema-card').filter({ hasText: 'E488' })).toBeVisible();
    });

    await test.step('Close modal', async () => {
      // Close modal using the close button or cancel button
      const closeButton = page.locator('#close-modal');
      const cancelButton = page.locator('.button.button--secondary').filter({ hasText: 'Cancel' });
      
      // Try to click either close or cancel button
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
      
      // Verify modal is closed
      await page.waitForTimeout(500); // Give modal time to close
      const modalContainer = page.locator('#modal-container');
      await expect(modalContainer).not.toBeVisible();
    });

    // Assert no console errors occurred
    assertNoErrors();
  });

  test('Search functionality in modal works', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Open custom Entity Schema modal', async () => {
      const dropdownButton = page.locator('.entity-schema-selector-custom__button');
      
      // Click to open dropdown
      await dropdownButton.click();
      await page.waitForTimeout(200);
      
      // Select "Custom/Other" option
      const customOption = page.locator('.entity-schema-selector-custom__option--custom');
      await customOption.click();
      await page.waitForTimeout(500);
    });

    await test.step('Test search functionality', async () => {
      const searchInput = page.locator('.entity-schema-search__input');
      
      // Type a search query
      await searchInput.fill('E473');
      
      // Wait for search to complete
      await page.waitForTimeout(1000);
      
      // Check if search status is displayed
      const searchStatus = page.locator('.entity-schema-search__status');
      await expect(searchStatus).toBeVisible();
    });

    // Close modal
    await test.step('Close modal', async () => {
      const closeButton = page.locator('#close-modal');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    });

    // Assert no console errors occurred
    assertNoErrors();
  });

  test('Entity Schema selection updates application state', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Select Entity Schema and verify state update', async () => {
      const dropdownButton = page.locator('.entity-schema-selector-custom__button');
      
      // Click to open dropdown
      await dropdownButton.click();
      await page.waitForTimeout(200);
      
      // Select E476 (Manuscript)
      const e476Option = page.locator('.entity-schema-selector-custom__option').filter({ hasText: 'E476' });
      await e476Option.click();
      
      // Wait for state update
      await page.waitForTimeout(500);
      
      // Check if success message appears (if implemented)
      // This is a placeholder - in a real implementation, we might check for:
      // - Success toast message
      // - Updated state in local storage
      // - Changes in other UI elements that depend on schema selection
      
      // For now, just verify the selection persists
      await expect(dropdownButton).toContainText('E476');
    });

    // Assert no console errors occurred
    assertNoErrors();
  });
});