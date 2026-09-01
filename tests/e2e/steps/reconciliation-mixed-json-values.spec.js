import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation mixed JSON value selection @reconciliation', () => {
  test('duplicate mappings can target different objects inside one Omeka value array', async ({ page }) => {
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
                name: 'Special Collections',
                description: 'special collection',
                score: 97,
                type: [{ id: 'Q2065736' }]
              }
            ]
          }
        })
      });
    });

    await app.goto();
    await app.verifyPageTitle();

    const dataset = `{
      "@type": ["o:Item"],
      "@id": "https://example.org/api/items/1",
      "schema:itemLocation": [
        {
          "type": "literal",
          "@value": "INV-602"
        },
        {
          "type": "resource",
          "o:label": "Special Collections",
          "@id": "https://example.org/api/items/88"
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
          key: 'schema:itemLocation',
          mappingId: 'schema:itemLocation::@value::obj0::P217',
          selectedAtField: '@value',
          selectedObjectIndex: 0,
          property: {
            id: 'P217',
            label: 'inventory number',
            datatype: 'external-id'
          }
        },
        {
          key: 'schema:itemLocation',
          mappingId: 'schema:itemLocation::o:label::obj1::P195',
          selectedAtField: 'o:label',
          selectedObjectIndex: 1,
          property: {
            id: 'P195',
            label: 'collection',
            datatype: 'wikibase-item'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const headers = page.locator('#property-headers th');
    await expect(headers).toHaveCount(3);
    await expect(headers.nth(1)).toContainText('@value (object 1)');
    await expect(headers.nth(2)).toContainText('o:label (object 2)');

    const inventoryValue = page.locator('[data-mapping-id="schema:itemLocation::@value::obj0::P217"] .value-text').first();
    const collectionValue = page.locator('[data-mapping-id="schema:itemLocation::o:label::obj1::P195"] .value-text').first();

    await expect(inventoryValue).toHaveText('INV-602');
    await expect(collectionValue).toHaveText('Special Collections');
  });
});
