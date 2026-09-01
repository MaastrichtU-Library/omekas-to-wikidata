import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Reconciliation provenance badges @reconciliation-provenance', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('shows source badges for literal, authority, and direct Wikidata segments based on the actual Omeka source', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'source-badge-test');
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:creator': [
            {
              '@value': 'Literal author'
            },
            {
              '@id': 'https://viaf.org/viaf/123456',
              'o:label': 'Authority author',
              type: 'valuesuggest:oclc:viaf'
            },
            {
              '@id': 'https://www.geonames.org/2759794',
              'o:label': 'Amsterdam',
              type: 'valuesuggest:ndeterms:geonames'
            },
            {
              '@id': 'https://www.wikidata.org/entity/Q42',
              'o:label': 'Douglas Adams',
              type: 'uri'
            }
          ]
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:creator',
          mappingId: 'dcterms:creator::P50',
          property: {
            id: 'P50',
            label: 'author',
            datatype: 'wikibase-item'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const badges = page.locator('.property-cell .value-source-badge');
    await expect(badges).toHaveCount(4);
    await expect(badges.nth(0)).toHaveText('Literal');
    await expect(badges.nth(1)).toHaveText('ValueSuggest: VIAF');
    await expect(badges.nth(2)).toHaveText('ValueSuggest: GeoNames');
    await expect(badges.nth(3)).toHaveText('Wikidata');
  });

  test('renders the apply-identical-values control inline when duplicate values exist in the same mapped field', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'apply-identical-layout-test');
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:title': [{ '@value': 'Shared title' }]
        },
        {
          id: 2,
          'dcterms:title': [{ '@value': 'Shared title' }]
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
    await page.locator('.property-cell .value-text').first().click();

    const applyControl = page.locator('.apply-identical-controls');
    const checkbox = page.locator('#apply-identical-values');
    const labelText = page.locator('.apply-identical-controls__text');
    const contextArea = page.locator('.reconciliation-modal-context .apply-identical-controls');

    await expect(applyControl).toBeVisible();
    await expect(contextArea).toBeVisible();
    await expect(labelText).toContainText('Apply this choice to 2 identical values in this row');

    const checkboxBox = await checkbox.boundingBox();
    const labelTextBox = await labelText.boundingBox();

    expect(checkboxBox).not.toBeNull();
    expect(labelTextBox).not.toBeNull();
    expect(Math.abs((checkboxBox.y + checkboxBox.height / 2) - (labelTextBox.y + labelTextBox.height / 2))).toBeLessThan(12);
  });

  test('preserves unchanged reconciled rows when a new mapping is added after returning from mapping', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      const item = {
        id: 1,
        'dcterms:title': [{ '@value': 'Shared title' }],
        'dcterms:creator': [{ '@value': 'Jane Doe' }]
      };

      window.debugState.updateState('fetchedData', [item]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:title',
          mappingId: 'dcterms:title::P1476',
          templateDisplayLabel: 'Title',
          property: {
            id: 'P1476',
            label: 'title',
            datatype: 'monolingualtext'
          }
        }
      ]);
      window.debugState.updateState('reconciliationData', {
        'item-0': {
          originalData: item,
          properties: {
            'dcterms:title::P1476': {
              mappingId: 'dcterms:title::P1476',
              keyName: 'dcterms:title',
              originalValues: ['Shared title'],
              reconciled: [
                {
                  status: 'reconciled',
                  type: 'string',
                  value: 'Shared title',
                  language: 'en',
                  selectedMatch: {
                    type: 'string',
                    value: 'Shared title',
                    language: 'en'
                  }
                }
              ],
              references: []
            }
          }
        }
      });
    });

    await app.navigateToStep(3);
    await expect(page.locator('.reconciliation-table tbody tr').first().locator('.value-status')).toContainText('String value');

    await app.navigateToStep(2);
    await page.evaluate(() => {
      const currentMapped = window.debugState.getState().mappings.mappedKeys;
      window.debugState.updateState('mappings.mappedKeys', [
        ...currentMapped,
        {
          key: 'dcterms:creator',
          mappingId: 'dcterms:creator::P50',
          templateDisplayLabel: 'Author',
          property: {
            id: 'P50',
            label: 'author',
            datatype: 'wikibase-item'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const rows = page.locator('.reconciliation-table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.value-status')).toContainText('String value');
    await expect(rows.nth(1).locator('.value-status')).toContainText('Click to reconcile');
  });

  test('respects included source groups by excluding standalone literal entries when only authority entries are allowed', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'source-group-filter-test');
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:subject': [
            {
              '@value': 'Standalone literal subject'
            },
            {
              '@id': 'https://viaf.org/viaf/98765',
              'o:label': 'Authority subject',
              type: 'valuesuggest:oclc:viaf'
            }
          ]
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:subject',
          mappingId: 'dcterms:subject::P921',
          includedValueSources: ['authority'],
          property: {
            id: 'P921',
            label: 'main subject',
            datatype: 'wikibase-item'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const valueTexts = await page.locator('.property-cell .value-text').allTextContents();
    expect(valueTexts).toEqual(['Authority subject']);

    const badges = page.locator('.property-cell .value-source-badge');
    await expect(badges).toHaveCount(1);
    await expect(badges.first()).toHaveText('ValueSuggest: VIAF');
  });

  test('uses equal item-column widths across the reconciliation table', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      const items = Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        'dcterms:title': [{ '@value': `Title ${index + 1}` }]
      }));

      window.debugState.updateState('selectedExample', 'static-width-test');
      window.debugState.updateState('fetchedData', items);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:title',
          mappingId: 'dcterms:title::P1476',
          templateDisplayLabel: 'Title',
          property: {
            id: 'P1476',
            label: 'title',
            datatype: 'monolingualtext'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const headerWidths = await page.locator('.reconciliation-table .item-header').evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().width))
    );

    expect(headerWidths.length).toBe(10);
    expect(new Set(headerWidths).size).toBe(1);
  });

  test('ignoring a mapped field from reconciliation removes it immediately and keeps it ignored across step navigation', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:title': [{ '@value': 'Shared title' }],
          'dcterms:creator': [{ '@value': 'Jane Doe' }]
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:title',
          mappingId: 'dcterms:title::P1476',
          templateDisplayLabel: 'Title',
          property: {
            id: 'P1476',
            label: 'title',
            datatype: 'monolingualtext'
          }
        },
        {
          key: 'dcterms:creator',
          mappingId: 'dcterms:creator::P50',
          templateDisplayLabel: 'Author',
          property: {
            id: 'P50',
            label: 'author',
            datatype: 'wikibase-item'
          }
        }
      ]);
      window.debugState.updateState('mappings.ignoredKeys', []);
      window.debugState.updateState('mappings.nonLinkedKeys', []);
    });

    await app.navigateToStep(3);

    const tableRows = page.locator('.reconciliation-table tbody tr');
    await expect(tableRows).toHaveCount(2);

    await page.locator('.field-row-header').filter({ hasText: 'author' }).click();
    await page.getByRole('button', { name: 'Ignore', exact: true }).click();

    await expect(page.locator('.reconciliation-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.field-row-header')).not.toContainText('author');

    await app.navigateToStep(2);
    await app.navigateToStep(3);

    await expect(page.locator('.reconciliation-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.field-row-header')).not.toContainText('author');
  });
});
