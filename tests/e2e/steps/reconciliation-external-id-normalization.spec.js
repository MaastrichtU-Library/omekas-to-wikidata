import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation external-id normalization @reconciliation', () => {
  test('recognized identifier URLs are reduced to bare IDs during reconciliation', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await app.goto();
    await app.verifyPageTitle();

    const dataset = `{
      "@type": ["o:Item"],
      "@id": "https://example.org/api/items/1",
      "schema:sameAs": [
        {
          "type": "uri",
          "@id": "https://maastrichtuniversity.on.worldcat.org/oclc/1453617041"
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
          key: 'schema:sameAs',
          mappingId: 'schema:sameAs::@id::obj0::P243',
          selectedAtField: '@id',
          selectedObjectIndex: 0,
          property: {
            id: 'P243',
            label: 'OCLC control number',
            datatype: 'external-id'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const firstValue = page.locator('.property-cell .value-text').first();
    await expect(firstValue).toHaveText('1453617041');

    await firstValue.click();
    await expect(page.locator('#external-id-input')).toHaveValue('1453617041');
    await page.locator('#confirm-btn').click();
    await expect(page.locator('#modal-container')).toBeHidden();

    const selectedMatch = await page.evaluate(() => {
      const state = window.debugState.getState();
      return state.reconciliationData['item-0'].properties['schema:sameAs::@id::obj0::P243'].reconciled[0].selectedMatch;
    });

    expect(selectedMatch).toMatchObject({
      type: 'custom',
      datatype: 'external-id',
      value: '1453617041'
    });
  });
});
