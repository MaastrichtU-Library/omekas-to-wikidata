import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation bulk apply and undo @reconciliation', () => {
  test('applies a match to identical values and lets the user undo a single decision safely', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await page.route('https://wikidata.reconci.link/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          q1: {
            result: [
              {
                id: 'Q5582',
                name: 'Vincent van Gogh',
                description: 'Dutch post-impressionist painter',
                score: 95,
                type: [{ id: 'Q5' }]
              }
            ]
          }
        })
      });
    });

    await app.goto();
    await app.verifyPageTitle();

    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'manual-test');
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:creator': [{ '@value': 'Vincent van Gogh' }]
        },
        {
          id: 2,
          'dcterms:creator': [{ '@value': 'Vincent van Gogh' }]
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:creator',
          mappingId: 'dcterms:creator::P50',
          linkedDataUri: 'http://purl.org/dc/terms/creator',
          property: {
            id: 'P50',
            label: 'author',
            description: 'author, painter or other creator',
            datatype: 'wikibase-item'
          }
        }
      ]);
    });

    await app.navigateToStep(3);
    await expect(page.locator('.property-cell .value-text').first()).toBeVisible();

    const firstValue = page.locator('.property-cell .value-text').first();
    await expect(firstValue).toHaveText('Vincent van Gogh');
    await firstValue.click();

    await expect(page.locator('#modal-container .modal')).toBeVisible();
    const applyToAllLabel = page.locator('.apply-identical-controls');
    await expect(applyToAllLabel).toContainText('Apply this choice to 2 identical values');

    await page.locator('#apply-identical-values').check();
    await page.locator('#existing-matches .wikidata-match-item').first().click();

    const reconciledStatuses = page.locator('.property-cell .value-status.reconciled');
    await expect(reconciledStatuses).toHaveCount(2);
    await expect(reconciledStatuses.nth(0)).toContainText('Q5582');
    await expect(reconciledStatuses.nth(1)).toContainText('Q5582');
    await expect(page.locator('#proceed-to-designer')).toBeEnabled();

    await firstValue.click();
    await expect(page.locator('button.reset-decision-btn')).toHaveText('Undo decision');
    await page.locator('button.reset-decision-btn').click();

    await expect(page.locator('.property-cell .value-status').first()).toHaveText('Click to reconcile');
    await expect(page.locator('#proceed-to-designer')).toBeDisabled();
  });
});
