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
      window.debugState.updateState('resourceTemplates', [
        {
          'o:id': 11,
          'o:resource_template_property': [
            {
              'o:property': {
                'o:id': 1,
                'o:term': 'dcterms:title',
                'o:label': 'Title'
              },
              'o:alternate_label': 'Book title'
            }
          ]
        }
      ]);
      window.debugState.updateState('selectedTemplates', ['11']);
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
    await expect(header.locator('.property-source-label')).toHaveText('dcterms:title (Book title)');
    await expect(header.locator('.property-mapped-row')).toContainText('Wikidata: title (P1476)');
    await expect(header.locator('.property-language-indicator')).toHaveText('Language required');
  });

  test('keeps Label and Instance of at the start of the reconciliation table in mapping order', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'header-order-test');
      window.debugState.updateState('resourceTemplates', [
        {
          'o:id': 11,
          'o:resource_template_property': [
            {
              'o:property': {
                'o:id': 1,
                'o:term': 'dcterms:title',
                'o:label': 'Title'
              },
              'o:alternate_label': 'Book title'
            },
            {
              'o:property': {
                'o:id': 2,
                'o:term': 'dcterms:type',
                'o:label': 'Type'
              },
              'o:alternate_label': 'Object type'
            },
            {
              'o:property': {
                'o:id': 3,
                'o:term': 'schema:author',
                'o:label': 'Author'
              },
              'o:alternate_label': 'Author'
            }
          ]
        }
      ]);
      window.debugState.updateState('selectedTemplates', ['11']);
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:title': [{ '@value': 'Example title' }],
          'dcterms:type': [{ '@value': 'Book' }],
          'schema:author': [{ '@value': 'Anne Author' }]
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'dcterms:title',
          sortIndex: 0,
          mappingId: 'dcterms:title::label',
          property: {
            id: 'label',
            label: 'Labels',
            datatype: 'monolingualtext'
          }
        },
        {
          key: 'dcterms:type',
          sortIndex: 1,
          mappingId: 'dcterms:type::P31',
          property: {
            id: 'P31',
            label: 'instance of',
            datatype: 'wikibase-item'
          }
        },
        {
          key: 'schema:author',
          sortIndex: 2,
          mappingId: 'schema:author::P50',
          property: {
            id: 'P50',
            label: 'author',
            datatype: 'wikibase-item'
          }
        }
      ]);
    });

    await app.navigateToStep(3);

    const propertyHeaders = page.locator('#property-headers th');
    await expect(propertyHeaders.nth(1).locator('.property-mapped-row')).toContainText('Wikidata: Labels (label)');
    await expect(propertyHeaders.nth(2).locator('.property-mapped-row')).toContainText('Wikidata: instance of (P31)');
    await expect(propertyHeaders.nth(3).locator('.property-mapped-row')).toContainText('Wikidata: author (P50)');
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

  test('updates the table text after confirming an edited monolingual value', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'language-update-test');
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

    await page.locator('#string-editor').fill('Aangepaste titel');
    await page.locator('#confirm-btn').click();

    await expect(page.locator('.property-cell .value-text').first()).toHaveText('Aangepaste titel (nl)');
    await expect(page.locator('.property-cell .value-status').first()).toContainText('Custom value');
  });
});
