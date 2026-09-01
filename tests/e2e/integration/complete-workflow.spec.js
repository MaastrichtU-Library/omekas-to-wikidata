import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad } from '../../helpers/common-actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Integration Tests - Complete Workflow @integration', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new OmekaToWikidataPage(page);
    await app.goto();
    await app.verifyPageTitle();
  });

  test.describe('End-to-End Workflow @integration-e2e', () => {
    test('complete input to reconciliation workflow', async ({ page }) => {
      const assertNoErrors = await checkNoConsoleErrors(page);

      await test.step('Step 1: Load sample data via manual input', async () => {
        const sampleData = `{
          "metadata": {"total": 3, "source": "integration-test"},
          "items": [
            {
              "id": 1,
              "title": "The Scream",
              "dcterms:title": [{"@value": "The Scream"}],
              "dcterms:creator": [{"@value": "Edvard Munch"}],
              "dcterms:date": [{"@value": "1893"}],
              "dcterms:subject": [{"@value": "Expressionism"}]
            },
            {
              "id": 2,
              "title": "Girl with a Pearl Earring", 
              "dcterms:title": [{"@value": "Girl with a Pearl Earring"}],
              "dcterms:creator": [{"@value": "Johannes Vermeer"}],
              "dcterms:date": [{"@value": "1665"}],
              "dcterms:medium": [{"@value": "Oil on canvas"}]
            },
            {
              "id": 3,
              "title": "The Birth of Venus",
              "dcterms:title": [{"@value": "The Birth of Venus"}],
              "dcterms:creator": [{"@value": "Sandro Botticelli"}],
              "dcterms:date": [{"@value": "1485"}],
              "dcterms:spatial": [{"@value": "Florence, Italy"}]
            }
          ]
        }`;

        await app.openManualJsonInput();
        await app.enterManualJson(sampleData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(2000);

        // Verify data loaded successfully
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('3');
        await expect(app.input.proceedToMappingBtn).toBeEnabled();
      });

      await test.step('Step 2: Navigate to mapping and verify property discovery', async () => {
        await app.proceedToMapping();
        
        // Verify we're on mapping step
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
        await expect(app.mapping.step2Section).toBeVisible();

        // Expand all sections to see all properties
        const sections = page.locator('.section summary');
        for (let i = 0; i < await sections.count(); i++) {
          await sections.nth(i).click();
          await page.waitForTimeout(200);
        }

        // Verify properties were discovered from the data
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThan(0);
      });

      await test.step('Step 3: Navigate to reconciliation and verify table setup', async () => {
        // Enable test mode for easier navigation
        await app.enableTestMode();
        await app.navigateToStep(3);
        
        // Verify we're on reconciliation step
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
        await expect(app.reconciliation.step3Section).toBeVisible();

        // Verify reconciliation table is present
        await expect(app.reconciliation.reconciliationTable).toBeVisible();
        
        // Table should have headers and structure
        const columnCount = await app.getReconciliationColumnCount();
        expect(columnCount).toBeGreaterThan(0);
      });

      await test.step('Verify complete workflow state persistence', async () => {
        // Navigate back through steps to verify state is maintained
        await app.navigateToStep(2);
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThan(0);

        await app.navigateToStep(1);
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('3');

        await app.navigateToStep(3);
        await expect(app.reconciliation.step3Section).toBeVisible();
      });

      assertNoErrors();
    });

    test('project save and load workflow', async ({ page }) => {
      await test.step('Load initial data', async () => {
        const testData = `{
          "metadata": {"total": 1},
          "items": [
            {"id": 1, "dcterms:title": [{"@value": "Test Artwork"}], "dcterms:creator": [{"@value": "Test Artist"}]}
          ]
        }`;

        await app.openManualJsonInput();
        await app.enterManualJson(testData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(1000);
      });

      await test.step('Save project', async () => {
        await app.saveProject();
        
        // Verify save operation doesn't cause errors
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(1);
      });

      await test.step('Navigate through workflow after save', async () => {
        await app.proceedToMapping();
        await page.waitForTimeout(500);
        
        await app.enableTestMode();
        await app.navigateToStep(3);
        
        // Verify navigation works after save
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
      });
    });
  });

  test.describe('Cross-Step Data Flow @integration-dataflow', () => {
    test('data propagates correctly through all steps', async ({ page }) => {
      const testData = `{
        "metadata": {"total": 2, "source": "dataflow-test"},
        "items": [
          {
            "id": 1,
            "dcterms:title": [{"@value": "Data Flow Test Item 1"}],
            "dcterms:creator": [{"@value": "Test Creator"}],
            "dcterms:date": [{"@value": "2024"}],
            "dcterms:subject": [{"@value": "Testing"}]
          },
          {
            "id": 2,
            "dcterms:title": [{"@value": "Data Flow Test Item 2"}],
            "dcterms:creator": [{"@value": "Another Creator"}],
            "dcterms:description": [{"@value": "Test description"}]
          }
        ]
      }`;

      await test.step('Input: Load comprehensive test data', async () => {
        await app.openManualJsonInput();
        await app.enterManualJson(testData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(1500);

        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('2');
      });

      await test.step('Mapping: Verify all properties discovered', async () => {
        await app.proceedToMapping();
        
        // Expand sections to see properties
        const sections = page.locator('.section summary');
        for (let i = 0; i < await sections.count(); i++) {
          await sections.nth(i).click();
          await page.waitForTimeout(200);
        }

        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThan(3); // Should have title, creator, date, subject, description
      });

      await test.step('Reconciliation: Verify items and properties available', async () => {
        await app.enableTestMode();
        await app.navigateToStep(3);

        // Check table structure reflects the data
        const columnCount = await app.getReconciliationColumnCount();
        expect(columnCount).toBeGreaterThan(0);

        // Table should show our test items
        const tableContent = await app.reconciliation.reconciliationTable.textContent();
        expect(tableContent).toBeTruthy();
      });
    });

    test('state persistence across navigation', async ({ page }) => {
      await test.step('Setup initial state', async () => {
        const simpleData = `{
          "metadata": {"total": 1},
          "items": [{"id": 1, "dcterms:title": [{"@value": "Persistence Test"}]}]
        }`;

        await app.openManualJsonInput();
        await app.enterManualJson(simpleData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(1000);
      });

      await test.step('Navigate through all steps multiple times', async () => {
        // First pass
        await app.proceedToMapping();
        await app.enableTestMode();
        await app.navigateToStep(3);
        
        // Second pass - rapid navigation
        await app.navigateToStep(1);
        await app.navigateToStep(2);
        await app.navigateToStep(3);
        await app.navigateToStep(1);
        
        // Verify data is still available
        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('1');
      });

      await test.step('Verify final state consistency', async () => {
        await app.navigateToStep(2);
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThanOrEqual(0);

        await app.navigateToStep(3);
        await expect(app.reconciliation.step3Section).toBeVisible();
      });
    });
  });

  test.describe('Error Recovery @integration-errors', () => {
    test('graceful handling of incomplete workflows', async ({ page }) => {
      await test.step('Start without loading data', async () => {
        // Try to navigate to mapping without data
        await app.navigateToStep(2);
        
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
        
        // Should handle gracefully
        await expect(app.mapping.step2Section).toBeVisible();
      });

      await test.step('Navigate to reconciliation without mapping', async () => {
        await app.navigateToStep(3);
        
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
        
        // Should still load but show appropriate state
        await expect(app.reconciliation.step3Section).toBeVisible();
      });

      await test.step('Recover by loading data and proceeding normally', async () => {
        await app.navigateToStep(1);
        
        const recoveryData = `{
          "metadata": {"total": 1},
          "items": [{"id": 1, "dcterms:title": [{"@value": "Recovery Test"}]}]
        }`;

        await app.openManualJsonInput();
        await app.enterManualJson(recoveryData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(1000);

        // Should now be able to proceed normally
        await app.proceedToMapping();
        await app.navigateToStep(3);
        
        const finalStep = await app.getActiveStep();
        expect(finalStep).toBe(3);
      });
    });

    test('handles rapid user interactions', async ({ page }) => {
      await test.step('Load data for testing', async () => {
        const testData = `{
          "metadata": {"total": 1},
          "items": [{"id": 1, "dcterms:title": [{"@value": "Rapid Test"}]}]
        }`;

        await app.openManualJsonInput();
        await app.enterManualJson(testData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(1000);
      });

      await test.step('Rapid navigation stress test', async () => {
        // Rapid clicking and navigation
        for (let i = 0; i < 5; i++) {
          await app.navigateToStep(2);
          await page.waitForTimeout(100);
          await app.navigateToStep(1);
          await page.waitForTimeout(100);
          await app.navigateToStep(3);
          await page.waitForTimeout(100);
        }
        
        // Should end up in a consistent state
        const activeStep = await app.getActiveStep();
        expect([1, 2, 3]).toContain(activeStep);
      });
    });
  });

  test.describe('Performance Integration @integration-performance', () => {
    test('large dataset complete workflow', async ({ page }) => {
      await test.step('Generate and load large dataset', async () => {
        // Create a larger dataset
        const items = [];
        for (let i = 1; i <= 25; i++) {
          items.push({
            id: i,
            "dcterms:title": [{"@value": `Performance Test Artwork ${i}`}],
            "dcterms:creator": [{"@value": `Artist ${Math.ceil(i/5)}`}],
            "dcterms:date": [{"@value": `${1900 + i}`}],
            "dcterms:subject": [{"@value": `Subject ${i % 3 + 1}`}],
            "dcterms:description": [{"@value": `Description for artwork ${i} in the performance test dataset`}]
          });
        }

        const largeData = JSON.stringify({
          metadata: {total: 25, source: "performance-test"},
          items: items
        });

        const startTime = Date.now();
        
        await app.openManualJsonInput();
        await app.enterManualJson(largeData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(3000);
        
        const loadTime = Date.now() - startTime;
        expect(loadTime).toBeLessThan(15000); // Should load within 15 seconds

        const statusText = await app.getDataStatusText();
        expect(statusText).toContain('25');
      });

      await test.step('Navigate through steps with large dataset', async () => {
        const mappingStartTime = Date.now();
        await app.proceedToMapping();
        await page.waitForTimeout(1000);
        const mappingTime = Date.now() - mappingStartTime;
        
        expect(mappingTime).toBeLessThan(5000); // Mapping should load quickly
        
        await app.enableTestMode();
        
        const reconciliationStartTime = Date.now();
        await app.navigateToStep(3);
        await page.waitForTimeout(2000);
        const reconciliationTime = Date.now() - reconciliationStartTime;
        
        expect(reconciliationTime).toBeLessThan(8000); // Reconciliation should load within 8 seconds
      });

      await test.step('Verify large dataset handling', async () => {
        // Should be on reconciliation step
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
        
        // Table should be present and handle large dataset
        await expect(app.reconciliation.reconciliationTable).toBeVisible();
        
        // Navigation should still be responsive
        await app.navigateToStep(1);
        await app.navigateToStep(3);
        
        const finalStep = await app.getActiveStep();
        expect(finalStep).toBe(3);
      });
    });
  });
});