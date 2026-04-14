import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation headers and source language hints @reconciliation', () => {
  test('shows both the Omeka source field and mapped Wikidata property in the Step 3 header', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'header-test');
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:title': [{ '@value': 'Example Title' }]
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:title',
          mappingId: 'dcterms:title::P1476',
          property: {
            id: 'P1476',
            label: 'title',
            datatype: 'monolingualtext'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const header = page.locator('[data-mapping-id="dcterms:title::P1476"]');
    await expect(header.locator('.property-source-label')).toHaveText('dcterms:title');
    await expect(header.locator('.property-mapped-row')).toContainText('Wikidata: title (P1476)');
    await expect(header.locator('.property-language-indicator')).toHaveText('Language required');
  });

  test('prefills monolingual text language from Omeka source data when available', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'language-prefill-test');
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:title': [
            {
              '@value': 'Voorbeeldtitel',
              '@language': 'nl'
            }
          ]
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:title',
          mappingId: 'dcterms:title::P1476',
          property: {
            id: 'P1476',
            label: 'title',
            datatype: 'monolingualtext'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const titleValue = page.locator('.property-cell .value-text').first();
    await titleValue.click();

    await expect(page.locator('#language-search')).toHaveValue('nl');
    await expect(page.locator('#selected-language-code')).toHaveValue('nl');
    await expect(page.locator('#confirm-btn')).toBeEnabled();
  });
});
