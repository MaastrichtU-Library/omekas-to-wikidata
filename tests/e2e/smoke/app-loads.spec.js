import { test, expect } from '@playwright/test';

test.describe('Smoke Tests @smoke', () => {
  test('application loads without errors', async ({ page }) => {
    // Navigate to the application
    await test.step('Navigate to application', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Omeka S to Wikidata/);
    });

    // Verify main UI elements are visible
    await test.step('Verify main UI elements', async () => {
      // Check for the main heading
      await expect(page.locator('h1')).toContainText('Omeka S to Wikidata');
      
      // Check for step navigation (should have 5 steps based on the plan)
      const steps = page.locator('.step');
      const stepCount = await steps.count();
      expect(stepCount).toBeGreaterThanOrEqual(1);
      
      // Verify no console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Wait a moment for any JS errors to surface
      await page.waitForTimeout(1000);
      expect(errors, `Console errors found: ${errors.join('\n')}`).toEqual([]);
    });
  });

  test('page has expected structure', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page has basic HTML structure
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/Omeka S to Wikidata/);
  });
});