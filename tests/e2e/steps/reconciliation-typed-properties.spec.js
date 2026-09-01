import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation typed property handling @reconciliation', () => {
  test('resource-backed collection mappings reconcile as Wikidata items with readable values', async ({ page }) => {
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
                id: 'Q12345',
                name: 'Museum Collection',
                description: 'museum collection',
                score: 95,
                type: [{ id: 'Q2065736' }]
              }
            ]
          }
        })
      });
    });

    await app.goto();
    await app.verifyPageTitle();

    const providerDataset = `{
      "@type": ["o:Item"],
      "id": 1,
      "schema:provider": [
        {
          "type": "resource",
          "display_title": "Museum Collection",
          "@id": "https://example.org/api/items/42"
        }
      ]
    }`;

    await app.openManualJsonInput();
    await app.enterManualJson(providerDataset);
    await app.processManualJson();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'schema:provider',
          linkedDataUri: 'https://schema.org/provider',
          property: {
            id: 'P195',
            label: 'collection',
            description: 'art, museum, archival, or bibliographic collection the subject is part of',
            datatype: 'wikibase-item'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const firstValue = page.locator('.property-cell .value-text').first();
    await expect(firstValue).toHaveText('Museum Collection');

    await firstValue.click();

    const reconciliationModal = page.locator('#modal-container .modal');
    await expect(reconciliationModal).toBeVisible();
    await expect(page.locator('.data-type-value').first()).toHaveText(/Wikidata Item/i);
    await expect(page.locator('.original-value').first()).toHaveText('Museum Collection');
    await expect(page.locator('#existing-matches')).not.toContainText('Finding matches...');
    await expect(page.locator('#existing-matches .matches-list')).toContainText(/Q\d+/);
  });
});
