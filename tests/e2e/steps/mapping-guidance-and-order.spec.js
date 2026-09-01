import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Mapping guidance and ordered required properties @mapping', () => {
  test('pins Label and Instance of first and disables duplicate quick-add buttons once they are mapped', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedExample', 'mapping-order-test');
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'schema:creator': [{ '@value': 'Author Name' }],
          'dcterms:title': [{ '@value': 'Example Title' }],
          'dcterms:type': [{ '@value': 'Book' }],
          'dcterms:date': [{ '@value': '1901' }]
        }
      ]);
      window.debugState.updateState('mappings.sortMode', 'template');
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'schema:creator',
          sortIndex: 0,
          mappingId: 'schema:creator::P50',
          property: {
            id: 'P50',
            label: 'author',
            datatype: 'wikibase-item'
          }
        },
        {
          key: 'dcterms:title',
          sortIndex: 1,
          mappingId: 'dcterms:title::label',
          property: {
            id: 'label',
            label: 'Labels',
            datatype: 'monolingualtext'
          }
        },
        {
          key: 'dcterms:type',
          sortIndex: 2,
          mappingId: 'dcterms:type::P31',
          property: {
            id: 'P31',
            label: 'instance of',
            datatype: 'wikibase-item'
          }
        },
        {
          key: 'dcterms:date',
          sortIndex: 3,
          mappingId: 'dcterms:date::P571',
          property: {
            id: 'P571',
            label: 'inception',
            datatype: 'time'
          }
        }
      ]);
    });

    await app.navigateToStep(2);

    await expect(page.locator('#add-label')).toBeDisabled();
    await expect(page.locator('#add-instance-of')).toBeDisabled();
    await expect(page.locator('.mapping-guidance')).toContainText('Add required Wikidata values only when they are missing from the imported fields.');

    const mappedEntries = await page.locator('#mapped-keys li:not(.placeholder)').allTextContents();
    expect(mappedEntries[0]).toContain('dcterms:title');
    expect(mappedEntries[0]).toContain('label');
    expect(mappedEntries[1]).toContain('dcterms:type');
    expect(mappedEntries[1]).toContain('P31');
  });
});
