import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad } from '../../helpers/common-actions.js';

test.describe('Entity Schema Overview @smoke', () => {
  let app;
  
  test.beforeEach(async ({ page }) => {
    app = new OmekaToWikidataPage(page);
    await app.goto();
    await waitForDataLoad(page);
    
    // Enable test mode and navigate to Step 2 (Mapping)
    await app.enableTestMode();
    await app.navigateToStep(2);
  });

  test('Entity Schema Overview is hidden when no schema selected', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Verify overview is hidden initially', async () => {
      // Check if the overview container exists but might be empty
      const overviewContainer = page.locator('#entity-schema-overview-container');
      await expect(overviewContainer).toBeAttached();
      
      // The overview content should not be visible when no schema is selected
      const overview = overviewContainer.locator('.entity-schema-overview');
      const overviewCount = await overview.count();
      
      if (overviewCount > 0) {
        // If overview exists, it should be hidden
        await expect(overview).toBeHidden();
      }
      // If overview doesn't exist yet, that's also valid (no schema selected)
    });
    
    await assertNoErrors();
  });

  test('Entity Schema Overview appears when schema is selected', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Select an Entity Schema', async () => {
      // Click on the Entity Schema dropdown button
      await page.click('.entity-schema-selector-custom__button');
      
      // Select the first schema (E473 - Maastricht University Library)
      await page.click('.entity-schema-selector-custom__option:first-child .entity-schema-selector-custom__option-label');
      
      // Wait for the schema to be loaded
      await page.waitForTimeout(1000);
    });
    
    await test.step('Verify overview becomes visible', async () => {
      // Check if the overview is now visible
      const overview = page.locator('.entity-schema-overview');
      await expect(overview).toBeVisible();
      
      // Check if the header is visible
      const header = overview.locator('.schema-overview-header');
      await expect(header).toBeVisible();
    });
    
    await test.step('Verify collapsed view content', async () => {
      const collapsedView = page.locator('.schema-overview-collapsed');
      await expect(collapsedView).toBeVisible();
      
      // Check for schema label
      const schemaLabel = collapsedView.locator('.schema-label');
      await expect(schemaLabel).toBeVisible();
      await expect(schemaLabel).toContainText('Maastricht University Library');
      
      // Check for schema ID link
      const schemaIdLink = collapsedView.locator('.schema-id-link');
      await expect(schemaIdLink).toBeVisible();
      await expect(schemaIdLink).toContainText('(E473)');
      await expect(schemaIdLink).toHaveAttribute('href', 'https://www.wikidata.org/wiki/EntitySchema:E473');
      
      // Check for progress indicators
      const requiredProgress = collapsedView.locator('.required-progress');
      await expect(requiredProgress).toBeVisible();
      
      // Check for toggle indicator
      const toggleIndicator = page.locator('.toggle-indicator');
      await expect(toggleIndicator).toBeVisible();
      await expect(toggleIndicator).toContainText('▼');
    });
    
    await assertNoErrors();
  });

  test('Entity Schema Overview expansion and collapse functionality', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Select an Entity Schema', async () => {
      await page.click('.entity-schema-selector-custom__button');
      await page.click('.entity-schema-selector-custom__option:first-child .entity-schema-selector-custom__option-label');
      await page.waitForTimeout(1000);
    });
    
    await test.step('Expand the overview', async () => {
      // Initially expanded view should be hidden
      const expandedView = page.locator('.schema-overview-expanded');
      await expect(expandedView).toBeHidden();
      
      // Click on header to expand
      await page.click('.schema-overview-header');
      
      // Wait for animation
      await page.waitForTimeout(500);
      
      // Expanded view should now be visible
      await expect(expandedView).toBeVisible();
      
      // Toggle indicator should change
      const toggleIndicator = page.locator('.toggle-indicator');
      await expect(toggleIndicator).toContainText('▲');
    });
    
    await test.step('Verify expanded view content', async () => {
      const expandedView = page.locator('.schema-overview-expanded');
      
      // Check for required properties section
      const requiredSection = expandedView.locator('.required-section');
      if (await requiredSection.count() > 0) {
        await expect(requiredSection).toBeVisible();
        
        const requiredHeader = requiredSection.locator('.property-section-header');
        await expect(requiredHeader).toContainText('Required Properties');
        
        // Check for property items
        const propertyItems = requiredSection.locator('.property-item');
        const propertyCount = await propertyItems.count();
        
        if (propertyCount > 0) {
          // Check the first property item structure
          const firstProperty = propertyItems.first();
          await expect(firstProperty.locator('.status-indicator')).toBeVisible();
          await expect(firstProperty.locator('.property-label')).toBeVisible();
          await expect(firstProperty.locator('.property-id-link')).toBeVisible();
        }
      }
      
      // Check for optional properties section if it exists
      const optionalSection = expandedView.locator('.optional-section');
      if (await optionalSection.count() > 0) {
        await expect(optionalSection).toBeVisible();
        
        const optionalHeader = optionalSection.locator('.property-section-header');
        await expect(optionalHeader).toContainText('Optional Properties');
      }
    });
    
    await test.step('Collapse the overview', async () => {
      // Click on header to collapse
      await page.click('.schema-overview-header');
      
      // Wait for animation
      await page.waitForTimeout(500);
      
      // Expanded view should be hidden
      const expandedView = page.locator('.schema-overview-expanded');
      await expect(expandedView).toBeHidden();
      
      // Toggle indicator should change back
      const toggleIndicator = page.locator('.toggle-indicator');
      await expect(toggleIndicator).toContainText('▼');
    });
    
    await assertNoErrors();
  });

  test('Entity Schema Overview updates when different schema selected', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Select first Entity Schema', async () => {
      await page.click('.entity-schema-selector-custom__button');
      await page.click('.entity-schema-selector-custom__option:first-child .entity-schema-selector-custom__option-label');
      await page.waitForTimeout(1000);
      
      // Verify first schema is shown
      const schemaLabel = page.locator('.schema-label');
      await expect(schemaLabel).toContainText('Maastricht University Library');
      
      const schemaIdLink = page.locator('.schema-id-link');
      await expect(schemaIdLink).toContainText('(E473)');
    });
    
    await test.step('Select different Entity Schema', async () => {
      await page.click('.entity-schema-selector-custom__button');
      await page.click('.entity-schema-selector-custom__option:nth-child(2) .entity-schema-selector-custom__option-label');
      await page.waitForTimeout(1000);
      
      // Verify second schema is shown
      const schemaLabel = page.locator('.schema-label');
      await expect(schemaLabel).toContainText('Radboud University Library');
      
      const schemaIdLink = page.locator('.schema-id-link');
      await expect(schemaIdLink).toContainText('(E487)');
    });
    
    await assertNoErrors();
  });

  test('Entity Schema Overview property links work correctly', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Select an Entity Schema and expand', async () => {
      await page.click('.entity-schema-selector-custom__button');
      await page.click('.entity-schema-selector-custom__option:first-child .entity-schema-selector-custom__option-label');
      await page.waitForTimeout(1000);
      
      // Expand the overview
      await page.click('.schema-overview-header');
      await page.waitForTimeout(500);
    });
    
    await test.step('Verify schema ID link', async () => {
      const schemaIdLink = page.locator('.schema-id-link');
      await expect(schemaIdLink).toHaveAttribute('target', '_blank');
      await expect(schemaIdLink).toHaveAttribute('href', 'https://www.wikidata.org/wiki/EntitySchema:E473');
    });
    
    await test.step('Verify property ID links', async () => {
      const propertyIdLinks = page.locator('.property-id-link');
      const linkCount = await propertyIdLinks.count();
      
      if (linkCount > 0) {
        // Check the first property link
        const firstLink = propertyIdLinks.first();
        await expect(firstLink).toHaveAttribute('target', '_blank');
        
        const href = await firstLink.getAttribute('href');
        expect(href).toMatch(/https:\/\/www\.wikidata\.org\/wiki\/Property:P\d+/);
      }
    });
    
    await assertNoErrors();
  });

  test('Entity Schema Overview shows mapping status indicators correctly', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Select an Entity Schema', async () => {
      await page.click('.entity-schema-selector-custom__button');
      await page.click('.entity-schema-selector-custom__option:first-child .entity-schema-selector-custom__option-label');
      await page.waitForTimeout(1000);
    });
    
    await test.step('Verify initial mapping status', async () => {
      // Initially no properties should be mapped
      const requiredProgress = page.locator('.required-progress');
      
      // Should show incomplete status initially
      const progressText = await requiredProgress.textContent();
      expect(progressText).toMatch(/(⚠|All required)/);
    });
    
    await test.step('Expand and check status indicators', async () => {
      await page.click('.schema-overview-header');
      await page.waitForTimeout(500);
      
      const statusIndicators = page.locator('.status-indicator');
      const indicatorCount = await statusIndicators.count();
      
      if (indicatorCount > 0) {
        // Check that status indicators are present
        for (let i = 0; i < Math.min(3, indicatorCount); i++) {
          const indicator = statusIndicators.nth(i);
          await expect(indicator).toBeVisible();
          
          const text = await indicator.textContent();
          // Should be either ✓ (mapped), ● (unmapped required), or ○ (unmapped optional)
          expect(text).toMatch(/[✓●○]/);
        }
      }
    });
    
    await assertNoErrors();
  });

  test('Entity Schema Overview source indicators appear when properties require sources', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    await test.step('Select an Entity Schema and expand', async () => {
      await page.click('.entity-schema-selector-custom__button');
      await page.click('.entity-schema-selector-custom__option:first-child .entity-schema-selector-custom__option-label');
      await page.waitForTimeout(1000);
      
      await page.click('.schema-overview-header');
      await page.waitForTimeout(500);
    });
    
    await test.step('Check for source indicators', async () => {
      const sourceIndicators = page.locator('.source-indicator');
      const indicatorCount = await sourceIndicators.count();
      
      // If there are source indicators, verify they show the correct icon
      if (indicatorCount > 0) {
        const firstIndicator = sourceIndicators.first();
        await expect(firstIndicator).toBeVisible();
        await expect(firstIndicator).toContainText('📎');
        
        // Should have appropriate title attribute
        await expect(firstIndicator).toHaveAttribute('title', 'This property requires a source/reference');
      }
    });
    
    await assertNoErrors();
  });

  test('Entity Schema Overview handles schemas with no properties', async ({ page }) => {
    const assertNoErrors = await checkNoConsoleErrors(page);
    
    // This test would be relevant if we have schemas with no properties
    // For now, we'll test the fallback behavior
    
    await test.step('Select a schema and expand', async () => {
      await page.click('.entity-schema-selector-custom__button');
      await page.click('.entity-schema-selector-custom__option:first-child .entity-schema-selector-custom__option-label');
      await page.waitForTimeout(1000);
      
      await page.click('.schema-overview-header');
      await page.waitForTimeout(500);
    });
    
    await test.step('Verify content is displayed even with minimal properties', async () => {
      const expandedView = page.locator('.schema-overview-expanded');
      await expect(expandedView).toBeVisible();
      
      // Should either have property sections or a no-properties message
      const propertySections = expandedView.locator('.property-list-section');
      const noPropertiesMessage = expandedView.locator('.no-properties-message');
      
      const sectionCount = await propertySections.count();
      const messageCount = await noPropertiesMessage.count();
      
      // Should have either property sections OR no-properties message
      expect(sectionCount + messageCount).toBeGreaterThan(0);
      
      if (messageCount > 0) {
        await expect(noPropertiesMessage).toContainText('This Entity Schema has no defined properties.');
      }
    });
    
    await assertNoErrors();
  });
});