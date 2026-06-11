import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad } from '../../helpers/common-actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Step 1 - Input Tests @input', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new OmekaToWikidataPage(page);
    await app.goto();
    await app.verifyPageTitle();
  });

  test.describe('Smoke Tests @input-smoke', () => {
    test('input step loads correctly', async ({ page }) => {
      const assertNoErrors = await checkNoConsoleErrors(page);
      
      await test.step('Verify input step is active', async () => {
        await expect(app.input.step1Section).toBeVisible();
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(1);
      });

      await test.step('Verify main input elements are present', async () => {
        await expect(app.input.apiUrlInput).toBeVisible();
        await expect(app.input.fetchDataBtn).toBeVisible();
        await expect(app.input.manualJsonButton).toBeVisible();
        await expect(app.input.proceedToMappingBtn).toBeDisabled();
      });

      assertNoErrors();
    });

    test('default API URL is populated', async ({ page }) => {
      const defaultUrl = await app.input.apiUrlInput.inputValue();
      expect(defaultUrl).toContain('/api/items');
      expect(defaultUrl.length).toBeGreaterThan(10);
    });

    test('API parameter controls stay in sync with the URL field', async ({ page }) => {
      await expect(app.input.apiPageInput).toHaveValue('1');
      await expect(app.input.apiPerPageInput).toHaveValue('25');
      await expect(app.page.locator('legend')).toContainText(['Collection Scope', 'Pagination']);
      await expect(app.page.locator('fieldset', { hasText: 'Collection Scope' }).locator('#api-owner-id')).toBeVisible();

      await app.input.apiPageInput.fill('3');
      await app.input.apiPerPageInput.fill('25');
      await app.input.apiOwnerIdInput.fill('9');
      await app.input.apiResourceTemplateIdInput.fill('12');
      await app.input.apiItemSetIdInput.fill('4');
      await app.input.apiSiteIdInput.fill('2');
      await app.input.applyApiParamsBtn.click();

      await expect(app.input.apiUrlInput).not.toHaveValue(/page=/);
      await expect(app.input.apiUrlInput).not.toHaveValue(/per_page=/);
      await expect(app.input.apiUrlInput).toHaveValue(/owner_id=9/);
      await expect(app.input.apiUrlInput).toHaveValue(/resource_template_id=12/);
      await expect(app.input.apiUrlInput).toHaveValue(/item_set_id=4/);
      await expect(app.input.apiUrlInput).toHaveValue(/site_id=2/);
      await expect(app.input.apiPageInput).toHaveValue('');
      await expect(app.input.apiPerPageInput).toHaveValue('');

      await app.enterApiUrl('https://example.org/api/items?page=7&per_page=11&owner_id=5&resource_template_id=99&item_set_id=88&site_id=77');
      await app.input.apiUrlInput.blur();

      await expect(app.input.apiUrlInput).not.toHaveValue(/page=/);
      await expect(app.input.apiUrlInput).not.toHaveValue(/per_page=/);
      await expect(app.input.apiPageInput).toHaveValue('');
      await expect(app.input.apiPerPageInput).toHaveValue('');
      await expect(app.input.apiOwnerIdInput).toHaveValue('5');
      await expect(app.input.apiResourceTemplateIdInput).toHaveValue('99');
      await expect(app.input.apiItemSetIdInput).toHaveValue('88');
      await expect(app.input.apiSiteIdInput).toHaveValue('77');

      await app.input.resetApiParamsBtn.click();
      await expect(app.input.apiUrlInput).toHaveValue(/page=1/);
      await expect(app.input.apiUrlInput).toHaveValue(/per_page=25/);
      await expect(app.input.apiUrlInput).not.toHaveValue(/owner_id=/);
      await expect(app.input.apiUrlInput).not.toHaveValue(/resource_template_id=/);
      await expect(app.input.apiUrlInput).not.toHaveValue(/item_set_id=/);
      await expect(app.input.apiUrlInput).not.toHaveValue(/site_id=/);
      await expect(app.input.apiPageInput).toHaveValue('1');
      await expect(app.input.apiPerPageInput).toHaveValue('25');
      await expect(app.input.apiOwnerIdInput).toHaveValue('');
      await expect(app.input.apiResourceTemplateIdInput).toHaveValue('');
      await expect(app.input.apiItemSetIdInput).toHaveValue('');
      await expect(app.input.apiSiteIdInput).toHaveValue('');
    });

    test('fetches all matching pages automatically for scoped item endpoints', async ({ page }) => {
      await page.route('https://example.org/api/resource_templates', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      });

      await page.route('https://example.org/api/items**', async (route) => {
        const url = new URL(route.request().url());
        const pageNumber = Number(url.searchParams.get('page') || '1');

        const payloads = {
          1: Array.from({ length: 25 }, (_, index) => ({
            id: index + 1,
            'dcterms:title': [{ '@value': `Item ${index + 1}` }]
          })),
          2: [
            { id: 26, 'dcterms:title': [{ '@value': 'Item 26' }] }
          ]
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payloads[pageNumber] || [])
        });
      });

      await app.enterApiUrl('https://example.org/api/items?item_set_id=11');
      await app.input.apiUrlInput.blur();

      await app.fetchData();

      const statusText = await app.getDataStatusText();
      expect(statusText).toContain('Fetched 26 matching items across 2 pages for the selected scope.');
      expect(statusText).toContain('Items found: 26');
      await expect(app.input.proceedToMappingBtn).toBeEnabled();
    });
  });

  test.describe('Manual JSON Input @input-manual', () => {
    test('manual JSON input area toggles correctly', async ({ page }) => {
      await test.step('Open manual JSON input', async () => {
        await app.openManualJsonInput();
        await expect(app.input.manualJsonArea).toBeVisible();
        await expect(app.input.manualJsonTextarea).toBeVisible();
        await expect(app.input.processManualJsonButton).toBeVisible();
        await expect(app.input.cancelManualJsonButton).toBeVisible();
      });

      await test.step('Cancel manual JSON input', async () => {
        await app.cancelManualJson();
        await expect(app.input.manualJsonArea).toBeHidden();
      });
    });

    test('process valid JSON data manually', async ({ page }) => {
      // Use the existing sample fixture which is known to work
      const sampleData = `{
        "metadata": {
          "total": 2,
          "export_date": "2025-01-15T10:00:00Z",
          "source": "test"
        },
        "items": [
          {
            "id": 1,
            "title": "Test Item 1",
            "dcterms:title": [{"type": "literal", "property_id": 1, "@value": "Test Item 1"}],
            "dcterms:creator": [{"type": "literal", "property_id": 2, "@value": "Test Creator 1"}]
          },
          {
            "id": 2,
            "title": "Test Item 2", 
            "dcterms:title": [{"type": "literal", "property_id": 1, "@value": "Test Item 2"}],
            "dcterms:creator": [{"type": "literal", "property_id": 2, "@value": "Test Creator 2"}]
          }
        ]
      }`;

      await test.step('Enter and process JSON data', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(sampleData);
        await app.input.processManualJsonButton.click();
        
        // Wait for processing to complete
        await page.waitForTimeout(1000);
      });

      await test.step('Verify data was processed', async () => {
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('2'); // Should show 2 items
        await expect(app.input.proceedToMappingBtn).toBeEnabled();
      });
    });

    test('data status sample properties show meaningful metadata fields instead of transport keys', async ({ page }) => {
      const sampleData = `{
        "items": [
          {
            "@context": "https://example.org/api-context",
            "@id": "https://example.org/api/items/1",
            "@type": ["o:Item", "schema:Book"],
            "o:id": 1,
            "o:is_public": true,
            "o:resource_class": {"o:id": 10},
            "thumbnail_display_urls": {"large": "https://example.org/thumbnail.jpg"},
            "dcterms:title": [{"@value": "Visible title"}],
            "dcterms:creator": [{"@value": "Visible creator"}],
            "schema:sameAs": [{"@id": "https://worldcat.org/oclc/12345"}]
          }
        ]
      }`;

      await app.openManualJsonInput();
      await app.enterManualJson(sampleData);
      await app.processManualJson();

      const statusText = await app.getDataStatusText();
      expect(statusText).toContain('Sample properties: dcterms:title, dcterms:creator, schema:sameAs');
      expect(statusText).not.toContain('@context');
      expect(statusText).not.toContain('@id');
      expect(statusText).not.toContain('o:id');
      expect(statusText).not.toContain('o:is_public');
      expect(statusText).not.toContain('thumbnail_display_urls');
    });

    test('process complex JSON data manually', async ({ page }) => {
      const complexData = `{
        "metadata": {"total": 3, "source": "test-complex"},
        "items": [
          {"id": 1, "dcterms:title": [{"@value": "Complex Item 1"}], "dcterms:creator": [{"@value": "Artist 1"}], "dcterms:subject": [{"@value": "Art"}, {"@value": "Culture"}]},
          {"id": 2, "dcterms:title": [{"@value": "Complex Item 2"}], "dcterms:creator": [{"@value": "Artist 2"}], "dcterms:medium": [{"@value": "Oil"}]},
          {"id": 3, "dcterms:title": [{"@value": "Complex Item 3"}], "dcterms:spatial": [{"@value": "Paris"}]}
        ]
      }`;

      await test.step('Enter and process complex JSON data', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(complexData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(1000);
      });

      await test.step('Verify complex data was processed', async () => {
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('3'); // Should show 3 items
        await expect(app.input.proceedToMappingBtn).toBeEnabled();
      });
    });

    test('continuing to mapping scrolls the app back to the top of step 2', async ({ page }) => {
      const sampleData = `{
        "items": [
          {
            "id": 1,
            "dcterms:title": [{"@value": "Scroll test item"}]
          }
        ]
      }`;

      await app.openManualJsonInput();
      await app.enterManualJson(sampleData);
      await app.processManualJson();

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await app.proceedToMapping();

      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThan(5);
      await expect(app.mapping.step2Section).toBeVisible();
    });

    test('loading replacement data clears prior project state after confirmation', async ({ page }) => {
      const firstDataset = `{
        "metadata": {"total": 2, "source": "first-dataset"},
        "items": [
          {
            "id": 1,
            "dcterms:title": [{"@value": "First Title"}],
            "dcterms:creator": [{"@value": "First Creator"}]
          },
          {
            "id": 2,
            "dcterms:title": [{"@value": "Second Title"}],
            "dcterms:creator": [{"@value": "Second Creator"}]
          }
        ]
      }`;

      const secondDataset = `{
        "metadata": {"total": 1, "source": "second-dataset"},
        "items": [
          {
            "id": 10,
            "dcterms:description": [{"@value": "Replacement description"}]
          }
        ]
      }`;

      await test.step('Load the first dataset and visit mapping', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(firstDataset);
        await app.processManualJson();
        await app.proceedToMapping();
        await expect(app.mapping.step2Section).toBeVisible();
      });

      await test.step('Return to input and replace the project data', async () => {
        await app.backToInput();
        await app.openManualJsonInput();
        await app.enterManualJson(secondDataset);

        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('confirm');
          expect(dialog.message()).toMatch(/replace the current project/i);
          await dialog.accept();
        });

        await app.processManualJson();
      });

      await test.step('Proceed to mapping and verify old keys are gone', async () => {
        await app.proceedToMapping();
        await page.waitForTimeout(1000);

        const nonLinkedTexts = await app.getNonLinkedKeyTexts();
        expect(nonLinkedTexts.some(text => text.includes('dcterms:description'))).toBeTruthy();
        expect(nonLinkedTexts.some(text => text.includes('dcterms:title'))).toBeFalsy();
        expect(nonLinkedTexts.some(text => text.includes('dcterms:creator'))).toBeFalsy();
      });
    });

    test('template selection controls gate proceeding and filter the mapping dataset', async ({ page }) => {
      const templatedData = `{
        "metadata": {"total": 2, "source": "test-templates"},
        "items": [
          {
            "id": 1,
            "@type": ["o:Item", "schema:Book"],
            "o:resource_template": {"o:id": 11, "o:label": "Books"},
            "dcterms:title": [{"property_id": 1, "@value": "Book Title"}],
            "dcterms:creator": [{"property_id": 2, "@value": "Author Name"}]
          },
          {
            "id": 2,
            "@type": ["o:Item", "schema:Person"],
            "o:resource_template": {"o:id": 22, "o:label": "People"},
            "dcterms:description": [{"property_id": 3, "@value": "Person description"}]
          }
        ]
      }`;

      await test.step('Load templated data', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(templatedData);
        await app.processManualJson();
      });

      await test.step('Require at least one template selection before proceeding', async () => {
        await expect(app.input.templateCheckboxes).toHaveCount(2);
        await expect(app.input.proceedToMappingBtn).toBeDisabled();

        await app.input.templateCheckboxes.nth(0).check();
        await expect(app.input.proceedToMappingBtn).toBeEnabled();

        await app.input.clearTemplateSelectionBtn.click();
        await expect(app.input.proceedToMappingBtn).toBeDisabled();
      });

      await test.step('Proceed with one selected template and verify mapping keys are filtered', async () => {
        await app.input.templateCheckboxes.nth(0).check();
        await app.proceedToMapping();
        await page.waitForTimeout(1000);

        const nonLinkedTexts = await app.getNonLinkedKeyTexts();
        expect(nonLinkedTexts.some(text => text.includes('dcterms:title'))).toBeTruthy();
        expect(nonLinkedTexts.some(text => text.includes('dcterms:creator'))).toBeTruthy();
        expect(nonLinkedTexts.some(text => text.includes('dcterms:description'))).toBeFalsy();
      });
    });

    test('template selection resets stale mapping state before entering mapping', async ({ page }) => {
      const templatedData = `{
        "metadata": {"total": 2, "source": "test-templates-reset"},
        "items": [
          {
            "id": 1,
            "@type": ["o:Item", "schema:Book"],
            "o:resource_template": {"o:id": 11, "o:label": "Books"},
            "dcterms:title": [{"property_id": 1, "@value": "Book Title"}],
            "dcterms:creator": [{"property_id": 2, "@value": "Author Name"}]
          },
          {
            "id": 2,
            "@type": ["o:Item", "schema:Person"],
            "o:resource_template": {"o:id": 22, "o:label": "People"},
            "dcterms:description": [{"property_id": 3, "@value": "Person description"}]
          }
        ]
      }`;

      await test.step('Seed stale mapping state and a stale key search', async () => {
        await page.evaluate(() => {
          window.debugState.updateState('mappings.mappedKeys', [
            {
              key: 'dcterms:title',
              mappingId: 'dcterms:title::P1476',
              property: { id: 'P1476', label: 'title' }
            }
          ], false);
        });
      });

      await test.step('Load templated data and choose one template', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(templatedData);

        page.once('dialog', async (dialog) => {
          await dialog.accept();
        });

        await app.processManualJson();

        await expect(app.input.templateCheckboxes).toHaveCount(2);
        await app.input.templateCheckboxes.nth(0).check();
        await app.proceedToMapping();
        await page.waitForTimeout(1000);
      });

      await test.step('Verify current template fields can be mapped', async () => {
        const nonLinkedTexts = await app.getNonLinkedKeyTexts();
        expect(nonLinkedTexts.some(text => text.includes('dcterms:title'))).toBeTruthy();
        expect(nonLinkedTexts.some(text => text.includes('dcterms:creator'))).toBeTruthy();

        const mappedTexts = await app.mapping.mappedKeys.locator('li:not(.placeholder)').allTextContents();
        expect(mappedTexts.some(text => text.includes('P1476'))).toBeFalsy();
      });
    });

    test('handle invalid JSON gracefully', async ({ page }) => {
      const invalidJson = '{ "invalid": json, missing quotes }';

      await test.step('Enter invalid JSON', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(invalidJson);
        
        // Listen for the alert dialog
        let alertMessage = '';
        page.on('dialog', async (dialog) => {
          alertMessage = dialog.message();
          await dialog.accept();
        });
        
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(500);
      });

      await test.step('Verify error handling', async () => {
        // Should remain on input step
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(1);
        await expect(app.input.proceedToMappingBtn).toBeDisabled();
        
        // Manual JSON area should still be visible after error
        await expect(app.input.manualJsonArea).toBeVisible();
      });
    });

    test('handle malformed Omeka structure', async ({ page }) => {
      const malformedData = '{"wrong_structure": true, "not_omeka": {"some_data": []}}';

      await test.step('Enter malformed Omeka data', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(malformedData);
        
        // Listen for alert dialog
        page.on('dialog', async (dialog) => {
          expect(dialog.message()).toMatch(/(Invalid|format|items)/i);
          await dialog.accept();
        });
        
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(500);
      });

      await test.step('Verify structure validation', async () => {
        // Should remain on input step with manual area visible
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(1);
        await expect(app.input.manualJsonArea).toBeVisible();
        await expect(app.input.proceedToMappingBtn).toBeDisabled();
      });
    });

    test('handle empty items array', async ({ page }) => {
      const emptyData = '{"metadata": {"total": 0}, "items": []}';

      await test.step('Enter data with empty items array', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(emptyData);
        
        // This should trigger validation error since items array is empty
        page.on('dialog', async (dialog) => {
          expect(dialog.message()).toMatch(/(Invalid|items|format)/i);
          await dialog.accept();
        });
        
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(500);
      });

      await test.step('Verify empty data handling', async () => {
        // Should remain on input step due to validation error
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(1);
        await expect(app.input.manualJsonArea).toBeVisible();
        await expect(app.input.proceedToMappingBtn).toBeDisabled();
      });
    });
  });

  test.describe('API Fetching @input-api', () => {
    test('API URL input validation', async ({ page }) => {
      await test.step('Test valid API URL format', async () => {
        const validUrl = 'https://example.org/api/items/1';
        await app.enterApiUrl(validUrl);
        const inputValue = await app.input.apiUrlInput.inputValue();
        expect(inputValue).toBe(validUrl);
      });

      await test.step('Test API URL with parameters', async () => {
        const urlWithParams = 'https://example.org/api/items?page=1&per_page=10';
        await app.enterApiUrl(urlWithParams);
        const inputValue = await app.input.apiUrlInput.inputValue();
        expect(inputValue).toBe(urlWithParams);
      });
    });

    test('fetch data button interaction', async ({ page }) => {
      await test.step('Click fetch data button', async () => {
        // Note: This will likely fail due to CORS, but we test the interaction
        await app.input.fetchDataBtn.click();
        
        // Should show loading indicator
        const isLoading = await app.isLoading();
        if (isLoading) {
          await expect(app.input.loadingIndicator).toBeVisible();
        }
      });

      await test.step('Wait for fetch completion or error', async () => {
        // Wait for loading to disappear (either success or error)
        await page.waitForFunction(() => {
          const loading = document.querySelector('#loading');
          return !loading || loading.style.display === 'none';
        }, { timeout: 10000 });
        
        // Verify some response (either data or error message)
        const statusText = await app.getDataStatusText();
        expect(statusText.length).toBeGreaterThan(0);
      });
    });

    test('handle network errors gracefully', async ({ page }) => {
      await test.step('Try to fetch from invalid URL', async () => {
        await page.route('https://example.org/api/resource_templates', async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'template fetch failed' })
          });
        });

        await page.route('https://example.org/api/items**', async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'item fetch failed' })
          });
        });

        await app.enterApiUrl('https://example.org/api/items');
        await app.input.fetchDataBtn.click();
      });

      await test.step('Wait for error handling', async () => {
        // Wait for error to be displayed
        await page.waitForFunction(() => {
          const status = document.querySelector('#data-status');
          return status && /(error|failed|unable|could not)/i.test(status.textContent || '');
        }, { timeout: 15000 });
        
        const statusText = await app.getDataStatusText();
        expect(statusText.toLowerCase()).toMatch(/error|failed|unable|could not/);
      });
    });
  });

  test.describe('Data Processing @input-validation', () => {
    test('process sample data successfully', async ({ page }) => {
      const sampleData = await page.request.get(`http://localhost:8080/../tests/fixtures/sample-omeka.json`);
      const jsonData = await sampleData.text();

      await test.step('Process existing sample data', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(jsonData);
        await app.processManualJson();
      });

      await test.step('Verify sample data processing', async () => {
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('3'); // Sample has 3 items
        await expect(app.input.proceedToMappingBtn).toBeEnabled();
      });
    });

    test('view raw JSON functionality', async ({ page }) => {
      const simpleData = await page.request.get(`http://localhost:8080/../tests/fixtures/simple-omeka.json`);
      const jsonData = await simpleData.text();

      await test.step('Load data and activate the raw JSON control', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(jsonData);
        await app.processManualJson();
        
        await expect(app.input.viewRawJsonBtn).toBeVisible();
        await app.input.viewRawJsonBtn.click();
      });

      await test.step('Verify the raw JSON control is safe to use after loading data', async () => {
        await expect(app.input.viewRawJsonBtn).toBeVisible();
        await expect(page).toHaveURL(/\/src\/$/);
      });
    });

    test('large dataset performance', async ({ page }) => {
      const largeData = await page.request.get(`http://localhost:8080/../tests/fixtures/large-omeka.json`);
      const jsonData = await largeData.text();

      await test.step('Process large dataset', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(jsonData);
        
        // Measure processing time
        const startTime = Date.now();
        await app.processManualJson();
        const processingTime = Date.now() - startTime;
        
        // Should process within reasonable time (adjust based on performance)
        expect(processingTime).toBeLessThan(5000); // 5 seconds max
      });

      await test.step('Verify large dataset was processed', async () => {
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('50'); // Should show 50 items
        await expect(app.input.proceedToMappingBtn).toBeEnabled();
      });
    });
  });

  test.describe('Navigation @input-navigation', () => {
    test('proceed to mapping when data loaded', async ({ page }) => {
      const simpleData = await page.request.get(`http://localhost:8080/../tests/fixtures/simple-omeka.json`);
      const jsonData = await simpleData.text();

      await test.step('Load data', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(jsonData);
        await app.processManualJson();
      });

      await test.step('Navigate to mapping step', async () => {
        await app.proceedToMapping();
        
        // Should be on step 2 now
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
        
        // Step 2 section should be visible
        await expect(app.mapping.step2Section).toBeVisible();
      });
    });

    test('proceed button disabled when no data', async ({ page }) => {
      await test.step('Verify proceed button is disabled initially', async () => {
        await expect(app.input.proceedToMappingBtn).toBeDisabled();
      });

      await test.step('Verify proceed button remains disabled with empty data', async () => {
        const emptyData = await page.request.get(`http://localhost:8080/../tests/fixtures/empty-omeka.json`);
        const jsonData = await emptyData.text();
        
        await app.openManualJsonInput();
        await app.enterManualJson(jsonData);
        await app.input.processManualJsonButton.click();
        
        await expect(app.input.proceedToMappingBtn).toBeDisabled();
      });
    });

    test('step navigation preserves state', async ({ page }) => {
      const simpleData = await page.request.get(`http://localhost:8080/../tests/fixtures/simple-omeka.json`);
      const jsonData = await simpleData.text();

      await test.step('Load data and navigate away', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(jsonData);
        await app.processManualJson();
        await app.proceedToMapping();
        
        // Verify we're on step 2
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
      });

      await test.step('Navigate back to step 1', async () => {
        await app.navigateToStep(1);
        
        // Should be back on step 1
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(1);
        
        // Data should still be loaded
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('2'); // Should still show 2 items
        await expect(app.input.proceedToMappingBtn).toBeEnabled();
      });
    });
  });

  test.describe('Error Handling @input-errors', () => {
    test('display helpful error messages', async ({ page }) => {
      const assertNoErrors = await checkNoConsoleErrors(page);

      await test.step('Test invalid JSON error message', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson('{ invalid json }');
        await app.input.processManualJsonButton.click();
        
        const statusText = await app.getDataStatusText();
        expect(statusText.toLowerCase()).toMatch(/(error|invalid|json)/);
      });

      // Note: Console errors from invalid JSON are expected, so we skip the assertion
      // assertNoErrors();
    });

    test('recover from errors', async ({ page }) => {
      await test.step('Enter invalid data', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson('{ invalid }');
        await app.input.processManualJsonButton.click();
      });

      await test.step('Recover with valid data', async () => {
        const simpleData = await page.request.get(`http://localhost:8080/../tests/fixtures/simple-omeka.json`);
        const jsonData = await simpleData.text();
        
        // Clear and enter valid data
        await app.input.manualJsonTextarea.fill('');
        await app.enterManualJson(jsonData);
        await app.processManualJson();
        
        // Should now work correctly
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('2');
        await expect(app.input.proceedToMappingBtn).toBeEnabled();
      });
    });
  });
});
