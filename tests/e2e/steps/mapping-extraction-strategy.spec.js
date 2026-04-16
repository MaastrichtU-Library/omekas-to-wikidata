import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

test.describe('Mapping extraction strategy guidance @mapping', () => {
  test('shows datatype-aware extraction guidance for mixed Omeka values', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await page.addInitScript(() => {
      localStorage.clear();
    });

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();

    await page.evaluate(() => {
      window.debugState.updateState('selectedTemplates', ['7']);
      window.debugState.updateState('resourceTemplates', [
        {
          'o:id': 7,
          'o:resource_template_property': [
            {
              'o:property': { 'o:id': 8, 'o:term': 'schema:author' },
              'o:data_type': ['literal', 'uri', 'valuesuggest:oclc:viaf']
            }
          ]
        }
      ]);
      window.debugState.updateState('fetchedData', [
        {
          '@context': { schema: 'https://schema.org/' },
          'o:resource_template': { 'o:id': 7 },
          'schema:author': [
            {
              property_id: 8,
              type: 'literal',
              '@value': 'Anne Author'
            },
            {
              property_id: 8,
              type: 'valuesuggest:oclc:viaf',
              '@id': 'https://viaf.org/viaf/12345',
              'o:label': 'Author, Anne'
            }
          ]
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', [
        {
          key: 'schema:author',
          mappingId: 'schema:author::P50',
          property: {
            id: 'P50',
            label: 'author',
            datatype: 'wikibase-item'
          }
        }
      ]);
    });

    await app.navigateToStep(2);
    await page.locator('#mapped-keys li').filter({ hasText: 'schema:author' }).first().click();

    await expect(page.locator('.field-profile-summary')).toContainText('Recommended extraction: Display text.');
    await expect(page.locator('.field-profile-summary')).toContainText('template allows literal');
    await expect(page.locator('.extraction-mode-select')).toHaveValue('auto');
    await expect(page.locator('.extraction-mode-select option:checked')).toContainText('Automatic (recommended: Display text)');
    await expect(page.locator('.field-override-help')).toContainText('Leave this on Automatic unless you need to force one exact Omeka subfield.');
  });
});
