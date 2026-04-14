import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation literal datatype handling @reconciliation', () => {
  test('property-id fallback opens the time modal for date properties instead of item reconciliation', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await app.goto();
    await app.verifyPageTitle();

    const dataset = `{
      "@type": ["o:Item"],
      "@id": "https://example.org/api/items/1",
      "dcterms:date": [
        {
          "@value": "2023"
        }
      ]
    }`;

    await app.openManualJsonInput();
    await app.enterManualJson(dataset);
    await app.processManualJson();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:date',
          mappingId: 'dcterms:date::P577',
          property: {
            id: 'P577',
            label: 'publication date'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const dateValue = page.locator('.property-cell .value-text').first();
    await expect(dateValue).toHaveText('2023');
    await dateValue.click();

    await expect(page.locator('#date-editor')).toBeVisible();
    await expect(page.locator('.data-type-value').first()).toContainText('Point in Time');
    await expect(page.locator('#precision-select')).toHaveValue('year');
    await expect(page.locator('#existing-matches')).toHaveCount(0);
  });

  test('property-id fallback opens monolingual text entry and requires a language selection', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await page.route('https://www.wikidata.org/w/api.php**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ search: [] })
      });
    });

    await app.goto();
    await app.verifyPageTitle();

    const dataset = `{
      "@type": ["o:Item"],
      "@id": "https://example.org/api/items/1",
      "dcterms:title": [
        {
          "@value": "Example Title"
        }
      ]
    }`;

    await app.openManualJsonInput();
    await app.enterManualJson(dataset);
    await app.processManualJson();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:title',
          mappingId: 'dcterms:title::P1476',
          property: {
            id: 'P1476',
            label: 'title'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const titleValue = page.locator('.property-cell .value-text').first();
    await expect(titleValue).toHaveText('Example Title');
    await titleValue.click();

    await expect(page.locator('.data-type-value').first()).toContainText('Monolingual Text');
    await expect(page.locator('#language-search')).toBeVisible();
    await expect(page.locator('#confirm-btn')).toBeDisabled();

    await page.locator('#language-search').fill('English');
    await expect(page.locator('.language-option')).toBeVisible();
    await page.locator('.language-option').first().click();

    await expect(page.locator('#confirm-btn')).toBeEnabled();
    await page.locator('#confirm-btn').click();
    await expect(page.locator('#modal-container')).toBeHidden();

    const selectedMatch = await page.evaluate(() => {
      return window.debugState.getState().reconciliationData['item-0'].properties['dcterms:title::P1476'].reconciled[0].selectedMatch;
    });

    expect(selectedMatch).toMatchObject({
      type: 'custom',
      datatype: 'monolingualtext',
      language: 'en',
      value: 'Example Title'
    });
  });
});
