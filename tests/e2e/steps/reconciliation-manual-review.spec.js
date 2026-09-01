import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation manual review and correction @reconciliation', () => {
  test('lets the user override and later correct a Wikidata reconciliation choice', async ({ page }) => {
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
                score: 100,
                type: [{ id: 'Q5' }]
              }
            ]
          }
        })
      });
    });

    await page.route('https://www.wikidata.org/w/api.php**', async (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search');

      if (search === 'Theo van Gogh') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            search: [
              {
                id: 'Q158546',
                label: 'Theo van Gogh',
                description: 'Dutch art dealer'
              }
            ]
          })
        });
        return;
      }

      if (search === 'Vincent van Gogh') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            search: [
              {
                id: 'Q5582',
                label: 'Vincent van Gogh',
                description: 'Dutch post-impressionist painter'
              }
            ]
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ search: [] })
      });
    });

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'manual-review-test');
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
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

    const creatorValue = page.locator('.property-cell .value-text').first();
    await expect(creatorValue).toHaveText('Vincent van Gogh');
    await creatorValue.click();

    await expect(page.locator('#modal-container .modal')).toBeVisible();
    await expect(page.locator('#existing-matches .wikidata-match-item')).toContainText(['Vincent van Gogh']);
    await expect(page.locator('#wikidata-search')).toBeVisible();

    await page.locator('#wikidata-search').fill('Theo van Gogh');
    await expect(page.locator('#search-results .wikidata-match-item')).toContainText(['Theo van Gogh']);
    await page.locator('#search-results .wikidata-match-item').first().click();

    let selectedMatch = await page.evaluate(() => {
      return window.debugState.getState().reconciliationData['item-0'].properties['dcterms:creator::P50'].reconciled[0].selectedMatch;
    });

    expect(selectedMatch).toMatchObject({
      type: 'wikidata',
      id: 'Q158546',
      label: 'Theo van Gogh'
    });

    await creatorValue.click();

    await expect(page.locator('button.reset-decision-btn')).toHaveText('Undo decision');
    await expect(page.locator('#current-wikidata-selection')).toContainText('Theo van Gogh');
    await expect(page.locator('#existing-matches .wikidata-match-item')).toContainText(['Vincent van Gogh']);
    await page.locator('#existing-matches .wikidata-match-item').first().click();

    selectedMatch = await page.evaluate(() => {
      return window.debugState.getState().reconciliationData['item-0'].properties['dcterms:creator::P50'].reconciled[0].selectedMatch;
    });

    expect(selectedMatch).toMatchObject({
      type: 'wikidata',
      id: 'Q5582',
      label: 'Vincent van Gogh'
    });
  });
});
