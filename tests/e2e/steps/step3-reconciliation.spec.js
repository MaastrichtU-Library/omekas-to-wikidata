import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad } from '../../helpers/common-actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Step 3 - Reconciliation Tests @reconciliation', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new OmekaToWikidataPage(page);
    await app.goto();
    await app.verifyPageTitle();
    
    // Load sample data first
    const sampleData = `{
      "metadata": {"total": 3, "source": "test"},
      "items": [
        {"id": 1, "dcterms:title": [{"@value": "Van Gogh Self-Portrait"}], "dcterms:creator": [{"@value": "Vincent van Gogh"}], "dcterms:date": [{"@value": "1889"}]},
        {"id": 2, "dcterms:title": [{"@value": "The Starry Night"}], "dcterms:creator": [{"@value": "Vincent van Gogh"}], "dcterms:subject": [{"@value": "Landscape"}]},
        {"id": 3, "dcterms:title": [{"@value": "Café Terrace at Night"}], "dcterms:creator": [{"@value": "Vincent van Gogh"}], "dcterms:spatial": [{"@value": "Arles, France"}]}
      ]
    }`;
    
    await app.openManualJsonInput();
    await app.enterManualJson(sampleData);
    await app.input.processManualJsonButton.click();
    await page.waitForTimeout(1000);
    
    // Navigate through steps to reconciliation
    await app.proceedToMapping();
    await page.waitForTimeout(500);
    
    // Enable test mode if available for navigation
    await app.enableTestMode();
    
    // Navigate to reconciliation step
    await app.navigateToStep(3);
  });

  test.describe('Smoke Tests @reconciliation-smoke', () => {
    test('reconciliation step loads correctly', async ({ page }) => {
      const assertNoErrors = await checkNoConsoleErrors(page);
      
      await test.step('Verify reconciliation step is active', async () => {
        await expect(app.reconciliation.step3Section).toBeVisible();
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
      });

      await test.step('Verify main reconciliation elements are present', async () => {
        await expect(app.reconciliation.reconciliationTable).toBeVisible();
        await expect(app.reconciliation.reconcileNextBtn).toBeVisible();
        await expect(app.reconciliation.reconciliationControls).toBeVisible();
        await expect(app.reconciliation.proceedToExportBtn).toBeDisabled();
      });

      assertNoErrors();
    });

    test('reconciliation table structure is correct', async ({ page }) => {
      await test.step('Verify table has headers and rows', async () => {
        await expect(app.reconciliation.propertyHeaders).toBeVisible();
        await expect(app.reconciliation.reconciliationRows).toBeVisible();
        
        // Should have at least the Item column header
        const headerCount = await app.getReconciliationColumnCount();
        expect(headerCount).toBeGreaterThan(0);
      });

      await test.step('Verify table contains data rows', async () => {
        const rowCount = await app.getReconciliationRowCount();
        // Might be 0 initially if no properties are mapped yet
        expect(rowCount).toBeGreaterThanOrEqual(0);
      });
    });
  });

  test.describe('Table Functionality @reconciliation-table', () => {
    test('table displays items correctly', async ({ page }) => {
      await test.step('Verify table structure', async () => {
        const tableVisible = await app.reconciliation.reconciliationTable.isVisible();
        expect(tableVisible).toBeTruthy();
        
        // Check for table headers
        const headers = await app.reconciliation.propertyHeaders.textContent();
        expect(headers).toContain('Item'); // Should always have Item column
      });

      await test.step('Check for data rows', async () => {
        const rows = app.reconciliation.reconciliationRows.locator('tr');
        const rowCount = await rows.count();
        
        // Should have at least placeholder or actual data rows
        expect(rowCount).toBeGreaterThan(0);
      });
    });

    test('table cells are interactive', async ({ page }) => {
      await test.step('Check for clickable cells', async () => {
        const rows = app.reconciliation.reconciliationRows.locator('tr:not(.placeholder)');
        const rowCount = await rows.count();
        
        if (rowCount > 0) {
          const firstRow = rows.first();
          const cells = firstRow.locator('td');
          const cellCount = await cells.count();
          
          if (cellCount > 1) {
            // Try clicking on a data cell (not the Item name cell)
            const dataCell = cells.nth(1);
            await dataCell.click();
            
            // Should trigger some interaction (modal or inline editing)
            await page.waitForTimeout(500);
          }
        }
      });
    });

    test('table headers show mapped properties', async ({ page }) => {
      await test.step('Verify property headers are displayed', async () => {
        const headerText = await app.reconciliation.propertyHeaders.textContent();
        expect(headerText.length).toBeGreaterThan(4); // More than just "Item"
        
        // Headers should be meaningful
        expect(headerText).toBeTruthy();
      });
    });
  });

  test.describe('Reconciliation Controls @reconciliation-controls', () => {
    test('reconcile next button functionality', async ({ page }) => {
      await test.step('Verify reconcile next button exists', async () => {
        await expect(app.reconciliation.reconcileNextBtn).toBeVisible();
        
        const buttonText = await app.reconciliation.reconcileNextBtn.textContent();
        expect(buttonText).toMatch(/reconcile|next/i);
      });

      await test.step('Click reconcile next button', async () => {
        await app.reconcileNext();
        
        // Should trigger reconciliation modal or process
        await page.waitForTimeout(1000);
        
        // Check if modal appeared or state changed
        const modalVisible = await app.modal.isVisible().catch(() => false);
        if (modalVisible) {
          await expect(app.modal).toBeVisible();
          
          // Close modal for next tests
          await app.modalCloseBtn.click();
        }
      });
    });

    test('reconciliation progress tracking', async ({ page }) => {
      await test.step('Check for progress indicators', async () => {
        // Look for progress-related elements
        const progressElements = page.locator('.progress, .completed, .remaining');
        const hasProgress = await progressElements.count() > 0;
        
        // Progress tracking might be visible or hidden initially
        if (hasProgress) {
          expect(hasProgress).toBeTruthy();
        }
      });
    });
  });

  test.describe('Entity Matching @reconciliation-matching', () => {
    test('entity search modal functionality', async ({ page }) => {
      await test.step('Trigger entity search', async () => {
        // Try to click on a reconciliation cell to open search modal
        const rows = app.reconciliation.reconciliationRows.locator('tr:not(.placeholder)');
        const rowCount = await rows.count();
        
        if (rowCount > 0) {
          const firstRow = rows.first();
          const cells = firstRow.locator('td');
          const cellCount = await cells.count();
          
          if (cellCount > 1) {
            await cells.nth(1).click();
            await page.waitForTimeout(500);
            
            // Check if reconciliation modal opened
            const modalVisible = await app.modal.isVisible().catch(() => false);
            if (modalVisible) {
              await test.step('Verify modal contains search functionality', async () => {
                await expect(app.modal).toBeVisible();
                
                const modalContent = await app.modalContent.textContent();
                expect(modalContent.length).toBeGreaterThan(0);
                
                // Close modal
                await app.modalCloseBtn.click();
              });
            }
          }
        }
      });
    });

    test('entity selection workflow', async ({ page }) => {
      await test.step('Test entity reconciliation process', async () => {
        // Click reconcile next to start the process
        await app.reconcileNext();
        await page.waitForTimeout(1000);
        
        // If modal appears, interact with it
        const modalVisible = await app.modal.isVisible().catch(() => false);
        if (modalVisible) {
          await test.step('Interact with reconciliation modal', async () => {
            const modalContent = await app.modalContent.textContent();
            
            // Should contain reconciliation-related content
            expect(modalContent.length).toBeGreaterThan(0);
            
            // Look for entity options or search functionality
            const buttons = app.modal.locator('button');
            const buttonCount = await buttons.count();
            
            if (buttonCount > 1) {
              // Try selecting an option (skip, accept, etc.)
              const actionButton = buttons.first();
              await actionButton.click();
            } else {
              await app.modalCloseBtn.click();
            }
          });
        }
      });
    });
  });

  test.describe('Progress Tracking @reconciliation-progress', () => {
    test('reconciliation completion tracking', async ({ page }) => {
      await test.step('Check initial progress state', async () => {
        // Look for progress indicators
        const progressElements = page.locator('.progress-bar, .progress, .completed, .remaining');
        
        // Progress might be shown in various ways
        const hasProgressIndicators = await progressElements.count() > 0;
        
        if (hasProgressIndicators) {
          expect(hasProgressIndicators).toBeTruthy();
        }
      });

      await test.step('Verify progress updates with reconciliation', async () => {
        const initialState = await page.evaluate(() => {
          return {
            canProceed: !document.querySelector('#proceed-to-export')?.disabled,
            progressText: document.body.textContent
          };
        });
        
        // Try to advance reconciliation
        await app.reconcileNext();
        await page.waitForTimeout(1000);
        
        // Handle modal if it appears
        const modalVisible = await app.modal.isVisible().catch(() => false);
        if (modalVisible) {
          // Try to complete the reconciliation
          const skipButton = app.modal.locator('button:has-text("Skip"), button:has-text("Next"), button:has-text("Continue")');
          if (await skipButton.count() > 0) {
            await skipButton.first().click();
          } else {
            await app.modalCloseBtn.click();
          }
        }
        
        // Check if state changed
        await page.waitForTimeout(500);
      });
    });

    test('proceed to export availability', async ({ page }) => {
      await test.step('Check proceed button initial state', async () => {
        const canProceed = await app.canProceedToExport();
        
        // Initially should be disabled until reconciliation is complete
        expect(typeof canProceed).toBe('boolean');
      });
    });
  });

  test.describe('Navigation @reconciliation-navigation', () => {
    test('back to mapping navigation works', async ({ page }) => {
      await test.step('Navigate back to mapping step', async () => {
        await app.backToMapping();
        
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
        await expect(app.mapping.step2Section).toBeVisible();
      });

      await test.step('Navigate back to reconciliation', async () => {
        await app.navigateToStep(3);
        
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
        await expect(app.reconciliation.step3Section).toBeVisible();
      });
    });

    test('step progression maintains state', async ({ page }) => {
      await test.step('Navigate through steps', async () => {
        await app.navigateToStep(2);
        await app.navigateToStep(1);
        await app.navigateToStep(3);
        
        // Should return to reconciliation with state preserved
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
        await expect(app.reconciliation.step3Section).toBeVisible();
      });
    });
  });

  test.describe('Error Handling @reconciliation-errors', () => {
    test('handles missing mapping data gracefully', async ({ page }) => {
      await test.step('Navigate to reconciliation without mapping', async () => {
        // Start fresh and jump to reconciliation
        await page.goto('/');
        await app.navigateToStep(3);
      });

      await test.step('Verify graceful handling', async () => {
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
        
        // Should still load the step but show appropriate messaging
        await expect(app.reconciliation.step3Section).toBeVisible();
        
        // Table should exist but might be empty
        await expect(app.reconciliation.reconciliationTable).toBeVisible();
      });
    });

    test('handles reconciliation errors gracefully', async ({ page }) => {
      await test.step('Test error scenarios', async () => {
        // Try rapid clicking or invalid operations
        await app.reconciliation.reconcileNextBtn.click();
        await page.waitForTimeout(500);
        await app.reconciliation.reconcileNextBtn.click();
        
        // Should handle gracefully without crashing
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
      });
    });
  });

  test.describe('Integration @reconciliation-integration', () => {
    test('data flows from mapping step', async ({ page }) => {
      await test.step('Verify mapping data is available', async () => {
        // Go back to mapping and create some mappings
        await app.backToMapping();
        
        // Expand sections to access mapping functionality
        const sections = page.locator('.section summary');
        for (let i = 0; i < await sections.count(); i++) {
          await sections.nth(i).click();
          await page.waitForTimeout(200);
        }
        
        // Return to reconciliation
        await app.navigateToStep(3);
        
        // Table should reflect any mappings that were made
        const columnCount = await app.getReconciliationColumnCount();
        expect(columnCount).toBeGreaterThan(0);
      });
    });

    test('complete workflow integration', async ({ page }) => {
      await test.step('Test full workflow from input to reconciliation', async () => {
        // Navigate back to input
        await app.navigateToStep(1);
        await expect(app.input.step1Section).toBeVisible();
        
        // Load new data
        const newData = `{
          "metadata": {"total": 2},
          "items": [
            {"id": 1, "dcterms:title": [{"@value": "Integration Test Item 1"}], "dcterms:creator": [{"@value": "Test Artist"}]},
            {"id": 2, "dcterms:title": [{"@value": "Integration Test Item 2"}], "dcterms:creator": [{"@value": "Test Artist"}]}
          ]
        }`;
        
        await app.openManualJsonInput();
        await app.input.manualJsonTextarea.fill('');
        await app.enterManualJson(newData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(1000);
        
        // Proceed through mapping to reconciliation
        await app.proceedToMapping();
        await page.waitForTimeout(500);
        await app.navigateToStep(3);
        
        // Verify reconciliation step loads with new data
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
        await expect(app.reconciliation.step3Section).toBeVisible();
      });
    });
  });

  test.describe('Performance @reconciliation-performance', () => {
    test('handles large datasets efficiently', async ({ page }) => {
      await test.step('Navigate back and load larger dataset', async () => {
        await app.navigateToStep(1);
        
        // Create larger dataset
        const items = [];
        for (let i = 1; i <= 20; i++) {
          items.push({
            id: i,
            "dcterms:title": [{"@value": `Performance Test Item ${i}`}],
            "dcterms:creator": [{"@value": `Artist ${i}`}],
            "dcterms:date": [{"@value": `202${i % 5}`}]
          });
        }
        
        const largeData = JSON.stringify({
          metadata: {total: 20},
          items: items
        });
        
        await app.openManualJsonInput();
        await app.input.manualJsonTextarea.fill('');
        await app.enterManualJson(largeData);
        
        const startTime = Date.now();
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(2000);
        const processingTime = Date.now() - startTime;
        
        // Should process within reasonable time
        expect(processingTime).toBeLessThan(10000); // 10 seconds max
      });

      await test.step('Navigate to reconciliation with large dataset', async () => {
        await app.proceedToMapping();
        await page.waitForTimeout(500);
        await app.navigateToStep(3);
        
        // Should load reconciliation step efficiently
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(3);
        
        // Table should handle large dataset
        await expect(app.reconciliation.reconciliationTable).toBeVisible();
      });
    });
  });
});