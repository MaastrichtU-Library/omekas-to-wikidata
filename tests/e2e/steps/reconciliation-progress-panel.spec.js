import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation progress panel @reconciliation', () => {
  test('shows visible progress updates as reconciliation decisions are made', async ({ page }) => {
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
      window.debugState.updateState('selectedExample', 'progress-test');
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

    await expect(page.locator('#reconciliation-progress-summary')).toHaveText('0 of 2 values reviewed');
    await expect(page.locator('#reconciliation-progress-percent')).toHaveText('0%');
    await expect(page.locator('#reconciliation-progress-details')).toHaveText('0 reconciled • 0 skipped • 2 remaining');

    const values = page.locator('.property-cell .value-text');

    await values.first().click();
    await page.locator('#existing-matches .wikidata-match-item').first().click();

    await expect(page.locator('#reconciliation-progress-summary')).toHaveText('1 of 2 values reviewed');
    await expect(page.locator('#reconciliation-progress-percent')).toHaveText('50%');
    await expect(page.locator('#reconciliation-progress-details')).toHaveText('1 reconciled • 0 skipped • 1 remaining');

    await values.nth(1).click();
    await page.getByRole('button', { name: 'Skip' }).click();

    await expect(page.locator('#reconciliation-progress-summary')).toHaveText('2 of 2 values reviewed');
    await expect(page.locator('#reconciliation-progress-percent')).toHaveText('100%');
    await expect(page.locator('#reconciliation-progress-details')).toHaveText('1 reconciled • 1 skipped • 0 remaining');
    await expect(page.locator('#proceed-to-designer')).toBeEnabled();
  });
});
