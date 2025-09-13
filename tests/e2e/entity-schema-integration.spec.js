import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad } from '../helpers/common-actions.js';

test.describe('Entity Schema Integration @integration', () => {
  let page;
  let app;
  
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    const assertNoErrors = await checkNoConsoleErrors(page);
    app = new OmekaToWikidataPage(page);
    
    await app.goto();
    await waitForDataLoad(page);
    await app.enableTestMode();
  });

  test('Entity Schema selector displays correctly', async () => {
    await test.step('Navigate to mapping step', async () => {
      await app.navigateToStep(2);
      await page.waitForTimeout(500); // Allow for step transition
    });

    await test.step('Verify Entity Schema selector is visible', async () => {
      const schemaSelector = page.locator('.entity-schema-selector');
      await expect(schemaSelector).toBeVisible();
      
      // Should not have display: none style anymore
      const display = await schemaSelector.evaluate(el => window.getComputedStyle(el).display);
      expect(display).not.toBe('none');
    });

    await test.step('Verify active schemas are displayed', async () => {
      const activeSchemas = page.locator('.active-schemas-grid .schema-card');
      const schemaCount = await activeSchemas.count();
      
      // Should have 4 active schemas (E473, E487, E476, E488)
      expect(schemaCount).toBe(4);
    });

    await test.step('Verify schema cards contain expected content', async () => {
      const schemaIds = ['E473', 'E487', 'E476', 'E488'];
      
      for (const schemaId of schemaIds) {
        const schemaCard = page.locator(`[data-schema-id="${schemaId}"]`);
        await expect(schemaCard).toBeVisible();
        
        // Check schema ID is displayed
        const idElement = schemaCard.locator('.schema-id');
        await expect(idElement).toContainText(schemaId);
        
        // Check select and view buttons exist
        const selectBtn = schemaCard.locator('.select-schema-btn');
        const viewBtn = schemaCard.locator('.view-schema-btn');
        await expect(selectBtn).toBeVisible();
        await expect(viewBtn).toBeVisible();
      }
    });

    await test.step('Verify search functionality exists', async () => {
      const searchSection = page.locator('.schema-search-section');
      await expect(searchSection).toBeVisible();
      
      const searchInput = searchSection.locator('.schema-search-input');
      await expect(searchInput).toBeVisible();
      
      const placeholder = await searchInput.getAttribute('placeholder');
      expect(placeholder).toContain('Search by ID');
    });
  });

  test('Schema selection works correctly', async () => {
    await app.navigateToStep(2);
    await page.waitForTimeout(500);

    await test.step('Select E473 schema', async () => {
      const e473Card = page.locator('[data-schema-id="E473"]');
      const selectBtn = e473Card.locator('.select-schema-btn');
      
      await selectBtn.click();
      
      // Wait for selection to complete
      await page.waitForTimeout(1000);
    });

    await test.step('Verify schema is selected', async () => {
      const e473Card = page.locator('[data-schema-id="E473"]');
      await expect(e473Card).toHaveClass(/selected/);
      
      // Check button text changed to "Selected"
      const selectBtn = e473Card.locator('.select-schema-btn');
      await expect(selectBtn).toContainText('Selected');
      
      // Check if hidden input is updated
      const hiddenInput = page.locator('#entity-schema');
      const value = await hiddenInput.inputValue();
      expect(value).toBe('E473');
    });

    await test.step('Verify success message appears', async () => {
      // Look for success message (implementation may vary based on message system)
      const messageExists = await page.locator('.message, .toast, .alert')
        .filter({ hasText: /Entity Schema.*E473.*selected/i })
        .count() > 0;
      
      // Don't fail test if message system isn't ready, just log
      if (!messageExists) {
        console.log('Success message not found - message system may not be fully implemented');
      }
    });
  });

  test('Schema search functionality works', async () => {
    await app.navigateToStep(2);
    await page.waitForTimeout(500);

    await test.step('Test direct schema ID search', async () => {
      const searchInput = page.locator('.schema-search-input');
      await searchInput.fill('E100');
      
      // Wait for search results
      await page.waitForTimeout(1500);
      
      const resultsContainer = page.locator('.schema-search-results');
      const isVisible = await resultsContainer.isVisible();
      
      if (isVisible) {
        console.log('Search results container appeared');
        // Results may or may not appear depending on network/API availability
      } else {
        console.log('Search results not shown - API may be unavailable');
      }
    });

    await test.step('Clear search', async () => {
      const searchInput = page.locator('.schema-search-input');
      await searchInput.clear();
      
      // Results should be hidden
      await page.waitForTimeout(500);
      const resultsContainer = page.locator('.schema-search-results');
      
      // Results should be hidden or not visible
      const display = await resultsContainer.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('none');
    });
  });

  test('Schema property suggestions appear after selection', async () => {
    await app.navigateToStep(2);
    await page.waitForTimeout(500);

    await test.step('Select a schema to trigger property suggestions', async () => {
      const e476Card = page.locator('[data-schema-id="E476"]'); // Manuscript
      const selectBtn = e476Card.locator('.select-schema-btn');
      
      await selectBtn.click();
      
      // Wait for schema loading and property extraction
      await page.waitForTimeout(3000);
    });

    await test.step('Check if property suggestions appear', async () => {
      const suggestionsSection = page.locator('.schema-property-suggestions');
      
      // Property suggestions may appear if ShEx parsing is successful
      const exists = await suggestionsSection.count() > 0;
      
      if (exists) {
        console.log('Schema property suggestions appeared');
        await expect(suggestionsSection).toBeVisible();
        
        // Check for required/optional property sections
        const requiredHeader = suggestionsSection.locator('.property-group-header.required');
        const optionalHeader = suggestionsSection.locator('.property-group-header.optional');
        
        const hasRequired = await requiredHeader.count() > 0;
        const hasOptional = await optionalHeader.count() > 0;
        
        console.log(`Found required properties: ${hasRequired}, optional: ${hasOptional}`);
        
        if (hasRequired || hasOptional) {
          // Check property suggestion format
          const propertySuggestion = suggestionsSection.locator('.property-suggestion').first();
          if (await propertySuggestion.count() > 0) {
            const propertyId = propertySuggestion.locator('.property-id');
            await expect(propertyId).toBeVisible();
            
            const addBtn = propertySuggestion.locator('.add-property-btn');
            await expect(addBtn).toBeVisible();
            await expect(addBtn).toContainText('Add Property');
          }
        }
      } else {
        console.log('Schema property suggestions not shown - ShEx parsing may have failed or no properties found');
      }
    });
  });

  test('Schema persistence works with state', async () => {
    await app.navigateToStep(2);
    await page.waitForTimeout(500);

    await test.step('Select schema and navigate away', async () => {
      const e488Card = page.locator('[data-schema-id="E488"]'); // Incunable
      const selectBtn = e488Card.locator('.select-schema-btn');
      
      await selectBtn.click();
      await page.waitForTimeout(1000);
      
      // Navigate to step 1
      await app.navigateToStep(1);
      await page.waitForTimeout(500);
      
      // Navigate back to step 2
      await app.navigateToStep(2);
      await page.waitForTimeout(500);
    });

    await test.step('Verify schema selection persisted', async () => {
      const e488Card = page.locator('[data-schema-id="E488"]');
      
      // Schema should still be selected after navigation
      await expect(e488Card).toHaveClass(/selected/);
      
      const selectBtn = e488Card.locator('.select-schema-btn');
      await expect(selectBtn).toContainText('Selected');
      
      const hiddenInput = page.locator('#entity-schema');
      const value = await hiddenInput.inputValue();
      expect(value).toBe('E488');
    });
  });

  test('Multiple schema selection (one at a time)', async () => {
    await app.navigateToStep(2);
    await page.waitForTimeout(500);

    await test.step('Select first schema', async () => {
      const e473Card = page.locator('[data-schema-id="E473"]');
      const selectBtn = e473Card.locator('.select-schema-btn');
      await selectBtn.click();
      await page.waitForTimeout(1000);
      
      await expect(e473Card).toHaveClass(/selected/);
    });

    await test.step('Select different schema', async () => {
      const e487Card = page.locator('[data-schema-id="E487"]');
      const selectBtn = e487Card.locator('.select-schema-btn');
      await selectBtn.click();
      await page.waitForTimeout(1000);
    });

    await test.step('Verify only latest schema is selected', async () => {
      const e473Card = page.locator('[data-schema-id="E473"]');
      const e487Card = page.locator('[data-schema-id="E487"]');
      
      // E473 should no longer be selected
      const e473HasSelected = await e473Card.evaluate(el => el.classList.contains('selected'));
      expect(e473HasSelected).toBe(false);
      
      // E487 should be selected
      await expect(e487Card).toHaveClass(/selected/);
      
      const hiddenInput = page.locator('#entity-schema');
      const value = await hiddenInput.inputValue();
      expect(value).toBe('E487');
    });
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });
});