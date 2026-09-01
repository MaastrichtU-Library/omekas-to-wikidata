import { test, expect } from '@playwright/test';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';

const literalProfile = {
  templateAllowedTypes: [],
  observedTypes: ['literal'],
  availableValueParts: ['@value'],
  valueSourceTypes: ['literal'],
  hasMixedTypes: false,
  hasAuthorityLabels: false,
  hasUris: false,
  hasLiterals: true
};

test.describe('Guided mapping refinements @mapping-guided-refinements', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('guided label modal focuses on source-field selection and excludes media-heavy fields', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.evaluate((profile) => {
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
                'o:term': 'schema:name',
                'o:label': 'Name'
              },
              'o:alternate_label': 'Preferred name'
            }
          ]
        }
      ]);
      window.debugState.updateState('selectedTemplates', ['11']);
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:title': [{ '@value': 'Main record title' }],
          'schema:name': [{ '@value': 'Fallback name' }],
          'o:media': [{ '@id': 'https://example.org/media/1' }]
        }
      ]);
      window.debugState.updateState('mappings.nonLinkedKeys', [
        {
          key: 'dcterms:title',
          templateDisplayLabel: 'Book title',
          sampleValue: 'Main record title',
          frequency: 1,
          totalItems: 1,
          sortIndex: 0,
          fieldProfile: profile
        },
        {
          key: 'schema:name',
          templateDisplayLabel: 'Preferred name',
          sampleValue: 'Fallback name',
          frequency: 1,
          totalItems: 1,
          sortIndex: 1,
          fieldProfile: profile
        },
        {
          key: 'o:media',
          templateDisplayLabel: 'Media',
          sampleValue: 'Media sample',
          frequency: 1,
          totalItems: 1,
          sortIndex: 2,
          fieldProfile: profile
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', []);
      window.debugState.updateState('mappings.ignoredKeys', []);
    }, literalProfile);

    await page.locator('#add-label').click();

    const modal = page.locator('.modal.mapping-modal-wide .guided-mapping-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#property-search-input')).toHaveCount(0);
    await expect(modal.locator('.pattern-input')).toHaveCount(0);
    await expect(modal.locator('.wikidata-item-search-input')).toHaveCount(0);

    const selector = modal.locator('.guided-field-selector__select');
    await expect(selector).toHaveValue('dcterms:title');

    const optionTexts = await selector.locator('option').allTextContents();
    expect(optionTexts.some(text => text.includes('o:media'))).toBeFalsy();

    const searchInput = modal.locator('.guided-field-selector .field-search-input');
    await searchInput.fill('Book title');
    await expect(selector.locator('option')).toHaveCount(1);
    await expect(selector).toHaveValue('dcterms:title');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Sample value:');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Main record title');

    await searchInput.fill('schema:name');
    await expect(selector.locator('option')).toHaveCount(1);
    await expect(selector).toHaveValue('schema:name');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Fallback name');
  });

  test('guided label modal can populate directly from fetched data before mapping lists finish populating', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.evaluate(() => {
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
          'dcterms:title': [{ '@value': 'Immediate title' }],
          'o:media': [{ '@id': 'https://example.org/media/1' }]
        }
      ]);
      window.debugState.updateState('mappings.nonLinkedKeys', []);
      window.debugState.updateState('mappings.mappedKeys', []);
      window.debugState.updateState('mappings.ignoredKeys', []);
    });

    await page.locator('#add-label').click();

    const modal = page.locator('.modal.mapping-modal-wide .guided-mapping-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.guided-field-selector__select')).toHaveValue('dcterms:title');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Immediate title');

    const optionTexts = await modal.locator('.guided-field-selector__select option').allTextContents();
    expect(optionTexts.some(text => text.includes('Book title'))).toBeTruthy();
    expect(optionTexts.some(text => text.includes('o:media'))).toBeFalsy();
  });

  test('guided instance of modal starts from the detected Omeka resource class', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.route('https://radboudcollections.omeka.net/api/resource_classes/324', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          '@id': 'https://radboudcollections.omeka.net/api/resource_classes/324',
          'o:id': 324,
          'o:label': 'Manuscript',
          'o:term': 'schema:Manuscript',
          'o:local_name': 'Manuscript'
        })
      });
    });

    await page.evaluate((profile) => {
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:title': [{ '@value': 'Topstuk manuscript' }],
          'o:resource_class': {
            '@id': 'https://radboudcollections.omeka.net/api/resource_classes/324'
          }
        }
      ]);
      window.debugState.updateState('mappings.nonLinkedKeys', [
        {
          key: 'dcterms:title',
          templateDisplayLabel: 'Title',
          sampleValue: 'Topstuk manuscript',
          frequency: 1,
          totalItems: 1,
          sortIndex: 0,
          fieldProfile: profile
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', []);
      window.debugState.updateState('mappings.ignoredKeys', []);
    }, literalProfile);

    await page.locator('#add-instance-of').click();

    const modal = page.locator('.modal.mapping-modal-wide .guided-mapping-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.guided-target-card')).toContainText('instance of (P31)');
    await expect(modal.locator('.guided-field-selector__select')).toHaveValue('o:resource_class');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Resource class');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Label:');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Manuscript');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Term:');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('schema:Manuscript');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Sample value used for reconciliation:');
  });

  test('guided instance of modal supports manual text mode and reopens with the saved text', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.route('https://radboudcollections.omeka.net/api/resource_classes/324', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          '@id': 'https://radboudcollections.omeka.net/api/resource_classes/324',
          'o:id': 324,
          'o:label': 'Manuscript',
          'o:term': 'schema:Manuscript'
        })
      });
    });

    await page.evaluate((profile) => {
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'o:resource_class': {
            '@id': 'https://radboudcollections.omeka.net/api/resource_classes/324'
          }
        }
      ]);
      window.debugState.updateState('mappings.nonLinkedKeys', [
        {
          key: 'dcterms:title',
          templateDisplayLabel: 'Title',
          sampleValue: 'Saved title',
          frequency: 1,
          totalItems: 1,
          sortIndex: 0,
          fieldProfile: profile
        }
      ]);
      window.debugState.updateState('mappings.mappedKeys', []);
      window.debugState.updateState('mappings.ignoredKeys', []);
    }, literalProfile);

    await page.locator('#add-instance-of').click();

    const modal = page.locator('.modal.mapping-modal-wide .guided-mapping-modal');
    await expect(modal).toBeVisible();
    await modal.locator('label', { hasText: 'Enter instance-of text manually' }).locator('input').check();
    await modal.locator('.guided-instance-mode__textarea').fill('Printed book');
    await page.locator('#modal-footer button', { hasText: 'Confirm' }).click();

    const savedMapping = await page.evaluate(() => window.debugState.getState().mappings.mappedKeys[0]);
    expect(savedMapping.guidedSourceMode).toBe('manual_text');
    expect(savedMapping.guidedManualText).toBe('Printed book');

    await page.evaluate(() => {
      const savedKey = window.debugState.getState().mappings.mappedKeys[0];
      window.openMappingModal(savedKey);
    });

    await expect(modal).toBeVisible();
    await expect(modal.locator('label', { hasText: 'Enter instance-of text manually' }).locator('input')).toBeChecked();
    await expect(modal.locator('.guided-instance-mode__textarea')).toHaveValue('Printed book');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Manual instance-of text');
    await expect(modal.locator('.guided-field-selector__preview')).toContainText('Printed book');
  });

  test('custom mapping field search uses template labels and keeps media fields out of the results', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.evaluate(() => {
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
                'o:term': 'dcterms:creator',
                'o:label': 'Creator'
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
          'dcterms:title': [{ '@value': 'Main record title' }],
          'dcterms:creator': [{ '@value': 'Anne Author' }],
          'o:media': [
            {
              '@id': 'https://example.org/media/1',
              'o:original_url': 'https://example.org/files/media-1.jpg'
            }
          ]
        }
      ]);
      window.openMappingModal({
        key: 'custom_extra_property',
        sampleValue: '',
        frequency: 0,
        totalItems: 1,
        isCustomProperty: true
      });
    });

    const modal = page.locator('.modal.mapping-modal-wide');
    await expect(modal).toBeVisible();

    const fieldSearchInput = modal.locator('.field-search-section .field-search-input');
    await fieldSearchInput.fill('Book title');
    await expect(modal.locator('.field-results .field-result-item').first().locator('.field-path')).toContainText('Book title (dcterms:title');

    const resultsText = await modal.locator('.field-results').textContent();
    expect(resultsText).not.toContain('o:media');

    await fieldSearchInput.fill('dcterms:title');
    await expect(modal.locator('.field-results .field-result-item').first().locator('.field-path')).toContainText('Book title (dcterms:title');
  });

  test('mapping source groups use the planned order and sample values update immediately when a group is deselected', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.evaluate(() => {
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:creator': [
            { '@value': 'Literal creator' },
            { '@id': 'https://example.org/page/about-author', 'o:label': 'About author page', type: 'uri' },
            { '@id': 'https://viaf.org/viaf/123456', 'o:label': 'Authority creator', type: 'valuesuggest:oclc:viaf' },
            { '@id': 'https://www.wikidata.org/entity/Q42', 'o:label': 'Douglas Adams', type: 'uri' }
          ]
        }
      ]);
      window.openMappingModal({
        key: 'dcterms:creator',
        templateDisplayLabel: 'Author',
        sampleValue: 'Literal creator',
        frequency: 1,
        totalItems: 1,
        property: {
          id: 'P50',
          label: 'author',
          datatype: 'wikibase-item'
        },
        fieldProfile: {
          templateAllowedTypes: [],
          observedTypes: ['literal', 'uri', 'valuesuggest:oclc:viaf'],
          availableValueParts: ['@value', '@id', 'o:label'],
          valueSourceTypes: ['authority', 'literal', 'uri', 'wikidata'],
          hasMixedTypes: true,
          hasAuthorityLabels: true,
          hasUris: true,
          hasLiterals: true
        }
      });
    });

    const modal = page.locator('.modal.mapping-modal-wide');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.mapping-modal-content.three-column-layout')).toBeVisible();
    await expect(modal.locator('.extraction-mode-select')).toHaveCount(0);
    await expect(modal.locator('#at-field-select-dcterms_creator')).toHaveCount(0);

    const sourceLabels = await modal.locator('.value-source-section .value-source-option span').allTextContents();
    expect(sourceLabels).toEqual([
      'Literal entries',
      'Standalone URL entries',
      'ValueSuggest / authority-linked entries',
      'Direct Wikidata-linked entries'
    ]);

    await expect(modal.locator('.value-source-option').filter({ hasText: 'Literal entries' })).toContainText('1 values across 1 items');
    await expect(modal.locator('.value-source-option').filter({ hasText: 'Standalone URL entries' })).toContainText('1 values across 1 items');
    await expect(modal.locator('.value-source-option').filter({ hasText: 'ValueSuggest / authority-linked entries' })).toContainText('1 values across 1 items');
    await expect(modal.locator('.value-source-option').filter({ hasText: 'Direct Wikidata-linked entries' })).toContainText('1 values across 1 items');

    await expect(modal.locator('.samples-content')).toContainText('Literal creator');
    await expect(modal.locator('.samples-content')).toContainText('Authority creator');
    await expect(modal.locator('.samples-content')).toContainText('Douglas Adams');

    await modal.locator('.value-source-option').filter({ hasText: 'Literal entries' }).locator('input').uncheck();
    await expect(modal.locator('.samples-content')).not.toContainText('Literal creator');
    await expect(modal.locator('.samples-content')).toContainText('Authority creator');
    await expect(modal.locator('.samples-content')).toContainText('Douglas Adams');

    await modal.locator('.value-source-option').filter({ hasText: 'Direct Wikidata-linked entries' }).locator('input').uncheck();
    await expect(modal.locator('.samples-content')).not.toContainText('Douglas Adams');
    await modal.locator('.segment-family-option').filter({ hasText: 'Direct Wikidata-linked values' }).locator('input').uncheck();
    await modal.locator('.segment-family-option').filter({ hasText: 'Direct Wikidata-linked values' }).locator('input').check();
    await expect(modal.locator('.value-source-option').filter({ hasText: 'Direct Wikidata-linked entries' }).locator('input')).toBeChecked();
    await expect(modal.locator('.samples-content')).toContainText('Douglas Adams');

    await modal.locator('.segment-family-option').filter({ hasText: 'VIAF' }).locator('input').check();
    await modal.locator('.segment-family-option').filter({ hasText: 'Literal text values' }).locator('input').uncheck();
    await modal.locator('.segment-family-option').filter({ hasText: 'example.org URLs' }).locator('input').uncheck();
    await modal.locator('.segment-family-option').filter({ hasText: 'Direct Wikidata-linked values' }).locator('input').uncheck();

    await expect(modal.locator('.value-source-section')).toBeHidden();
    await expect(modal.locator('.samples-content')).toContainText('Authority creator');
    await expect(modal.locator('.samples-content')).not.toContainText('Douglas Adams');
  });

  test('standard mapping modal shows observed segment families above source groups and uses the wider three-column layout', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.evaluate(() => {
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'schema:sameAs': [
            { '@id': 'https://worldcat.org/oclc/12345', type: 'uri' }
          ]
        },
        {
          id: 2,
          'schema:sameAs': [
            { '@id': 'https://repository.example.org/item/12345', type: 'uri' }
          ]
        }
      ]);
      window.openMappingModal({
        key: 'schema:sameAs',
        templateDisplayLabel: 'Link to',
        sampleValue: 'https://worldcat.org/oclc/12345',
        frequency: 1,
        totalItems: 1,
        property: {
          id: 'P243',
          label: 'OCLC control number',
          datatype: 'external-id'
        },
        fieldProfile: {
          templateAllowedTypes: ['uri', 'valuesuggest:oclc:viaf'],
          observedTypes: ['uri'],
          availableValueParts: ['@id'],
          valueSourceTypes: ['authority', 'uri'],
          hasMixedTypes: false,
          hasAuthorityLabels: true,
          hasUris: true,
          hasLiterals: false
        }
      });
    });

    const modal = page.locator('.modal.mapping-modal-wide');
    await expect(modal).toBeVisible();

    const modalBox = await modal.boundingBox();
    expect(modalBox?.width ?? 0).toBeGreaterThan(1100);

    const segmentSection = modal.locator('.segment-family-section');
    const sourceSection = modal.locator('.value-source-section');
    await expect(segmentSection).toBeVisible();
    await expect(segmentSection).toContainText('Observed segments in this field');
    await expect(segmentSection).toContainText('OCLC / WorldCat');
    await expect(segmentSection).toContainText('repository.example.org URLs');
    const segmentLabels = await segmentSection.locator('.segment-family-option .value-source-option__content > span').allTextContents();
    expect(new Set(segmentLabels)).toEqual(new Set([
      'OCLC / WorldCat',
      'repository.example.org URLs'
    ]));

    const segmentBox = await segmentSection.boundingBox();
    const sourceBox = await sourceSection.boundingBox();
    expect(segmentBox?.y ?? 0).toBeLessThan(sourceBox?.y ?? 0);

    await expect(modal.locator('.samples-content')).toContainText('OCLC / WorldCat');
    await expect(modal.locator('.samples-content')).toContainText('repository.example.org URLs');

    const firstBadges = modal.locator('.sample-value-badges').first();
    const firstValue = modal.locator('.sample-value-text').first();
    await expect(firstValue).toBeVisible();
    const badgesBox = await firstBadges.boundingBox();
    const valueBox = await firstValue.boundingBox();
    expect(badgesBox).not.toBeNull();
    expect(valueBox).not.toBeNull();
    expect((valueBox?.y ?? 0)).toBeGreaterThan((badgesBox?.y ?? 0) + (badgesBox?.height ?? 0) - 1);

    await segmentSection.locator('.segment-family-option').filter({ hasText: 'repository.example.org URLs' }).locator('input').uncheck();
    await expect(modal.locator('.samples-content')).toContainText('OCLC / WorldCat');
    await expect(modal.locator('.samples-content')).not.toContainText('repository.example.org URLs');
  });

  test('mapping samples use transformed and normalized values when that is what reconciliation will see', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.evaluate(() => {
      const keyData = {
        key: 'schema:sameAs',
        templateDisplayLabel: 'Link to',
        sampleValue: 'https://worldcat.org/oclc/12345',
        frequency: 1,
        totalItems: 1,
        property: {
          id: 'P243',
          label: 'OCLC control number',
          datatype: 'external-id'
        },
        fieldProfile: {
          templateAllowedTypes: ['uri'],
          observedTypes: ['uri'],
          availableValueParts: ['@id'],
          valueSourceTypes: ['authority'],
          hasMixedTypes: false,
          hasAuthorityLabels: true,
          hasUris: true,
          hasLiterals: false
        }
      };

      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'schema:sameAs': [
            { '@id': 'https://worldcat.org/oclc/12345', 'o:label': 'RUQuest', type: 'valuesuggest:oclc:viaf' }
          ]
        }
      ]);

      [
        encodeURIComponent('uri::oclc-worldcat'),
        encodeURIComponent('authority::oclc-worldcat')
      ].forEach((segmentSignature) => {
        const mappingId = window.debugState.generateMappingId(
          'schema:sameAs',
          'P243',
          null,
          null,
          segmentSignature
        );
        window.debugState.addTransformationBlock(mappingId, {
          type: 'prefix',
          config: { text: 'OCLC ' }
        });
      });

      window.openMappingModal(keyData);
    });

    const modal = page.locator('.modal.mapping-modal-wide');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.samples-content')).toContainText('OCLC 12345');
    await expect(modal.locator('.samples-content')).not.toContainText('RUQuest');
  });

  test('mapping samples update live when a value transformation changes', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.evaluate(() => {
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'schema:sameAs': [
            { '@id': 'https://worldcat.org/oclc/12345', 'o:label': 'RUQuest', type: 'valuesuggest:oclc:viaf' }
          ]
        }
      ]);

      window.openMappingModal({
        key: 'schema:sameAs',
        templateDisplayLabel: 'Link to',
        sampleValue: 'https://worldcat.org/oclc/12345',
        frequency: 1,
        totalItems: 1,
        property: {
          id: 'P243',
          label: 'OCLC control number',
          datatype: 'external-id'
        },
        fieldProfile: {
          templateAllowedTypes: ['uri'],
          observedTypes: ['uri'],
          availableValueParts: ['@id'],
          valueSourceTypes: ['authority'],
          hasMixedTypes: false,
          hasAuthorityLabels: true,
          hasUris: true,
          hasLiterals: false
        },
        includedSegments: ['authority::oclc-worldcat'],
        segmentSignature: encodeURIComponent('authority::oclc-worldcat')
      });
    });

    const modal = page.locator('.modal.mapping-modal-wide');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.samples-content')).toContainText('12345');

    await modal.locator('.transformation-toggle').click();
    await modal.locator('.block-type-select').selectOption('prefix');
    await modal.getByRole('button', { name: '+ Add Transformation' }).click();
    await modal.locator('.transformation-block--prefix .config-field input').fill('OCLC ');

    await expect(modal.locator('.samples-content')).toContainText('OCLC 12345');
  });

  test('mapping samples also update live while transformations are still on the temporary mapping id', async ({ page }) => {
    const app = new OmekaToWikidataPage(page);

    await app.goto();
    await app.verifyPageTitle();
    await app.enableTestMode();
    await app.navigateToStep(2);

    await page.evaluate(() => {
      window.debugState.updateState('fetchedData', [
        {
          id: 1,
          'dcterms:title': [
            { '@value': 'Main title' }
          ]
        }
      ]);

      window.openMappingModal({
        key: 'dcterms:title',
        templateDisplayLabel: 'Title',
        sampleValue: { '@value': 'Main title' },
        frequency: 1,
        totalItems: 1,
        fieldProfile: {
          templateAllowedTypes: ['literal'],
          observedTypes: ['literal'],
          availableValueParts: ['@value'],
          valueSourceTypes: ['literal'],
          hasMixedTypes: false,
          hasAuthorityLabels: false,
          hasUris: false,
          hasLiterals: true
        }
      });
    });

    const modal = page.locator('.modal.mapping-modal-wide');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.samples-content')).toContainText('Main title');

    await modal.locator('.transformation-toggle').click();
    await modal.locator('.block-type-select').selectOption('prefix');
    await modal.getByRole('button', { name: '+ Add Transformation' }).click();
    await modal.locator('.transformation-block--prefix .config-field input').fill('Prefixed ');

    await expect(modal.locator('.samples-content')).toContainText('Prefixed Main title');
  });
});
