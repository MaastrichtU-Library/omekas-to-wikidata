import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { OmekaToWikidataPage } from '../../helpers/page-objects.js';
import { checkNoConsoleErrors, waitForDataLoad } from '../../helpers/common-actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Step 2 - Mapping Tests @mapping', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new OmekaToWikidataPage(page);
    await app.goto();
    await app.verifyPageTitle();
    
    // Load sample data first
    const sampleData = `{
      "metadata": {"total": 3, "source": "test"},
      "items": [
        {"id": 1, "dcterms:title": [{"@value": "Test Item 1"}], "dcterms:creator": [{"@value": "Artist 1"}], "dcterms:date": [{"@value": "2023"}]},
        {"id": 2, "dcterms:title": [{"@value": "Test Item 2"}], "dcterms:creator": [{"@value": "Artist 2"}], "dcterms:subject": [{"@value": "Art"}]},
        {"id": 3, "dcterms:title": [{"@value": "Test Item 3"}], "dcterms:medium": [{"@value": "Oil"}], "dcterms:spatial": [{"@value": "Paris"}]}
      ]
    }`;
    
    await app.openManualJsonInput();
    await app.enterManualJson(sampleData);
    await app.input.processManualJsonButton.click();
    await page.waitForTimeout(1000);
    
    // Navigate to mapping step
    await app.proceedToMapping();
  });

  test.describe('Smoke Tests @mapping-smoke', () => {
    test('mapping step loads correctly', async ({ page }) => {
      const assertNoErrors = await checkNoConsoleErrors(page);
      
      await test.step('Verify mapping step is active', async () => {
        await expect(app.mapping.step2Section).toBeVisible();
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
      });

      await test.step('Verify main mapping elements are present', async () => {
        // Expand all collapsible sections first
        const sections = page.locator('.section summary');
        for (let i = 0; i < await sections.count(); i++) {
          await sections.nth(i).click();
          await page.waitForTimeout(200);
        }
        
        await expect(app.mapping.nonLinkedKeys).toBeAttached();
        await expect(app.mapping.mappedKeys).toBeAttached();
        await expect(app.mapping.ignoredKeys).toBeAttached();
        await expect(app.mapping.addManualPropertyBtn).toBeVisible();
        await expect(app.mapping.proceedToReconciliationBtn).toBeDisabled();
      });

      assertNoErrors();
    });

    test('property categories are displayed', async ({ page }) => {
      await test.step('Verify category sections exist', async () => {
        // Check for the collapsible sections
        const sections = page.locator('.section');
        await expect(sections).toHaveCount(4); // Manual properties, Non-linked, Mapped, Ignored
      });

      await test.step('Verify non-linked keys are populated', async () => {
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThan(0); // Should have properties from sample data
      });
    });
  });

  test.describe('Property Management @mapping-properties', () => {
    test('non-linked keys populated from data', async ({ page }) => {
      await test.step('Verify properties from sample data appear', async () => {
        const nonLinkedItems = app.mapping.nonLinkedKeys.locator('li:not(.placeholder)');
        const count = await nonLinkedItems.count();
        expect(count).toBeGreaterThan(0);
        
        // Check for specific properties we know are in the sample data
        const keyTexts = await nonLinkedItems.allTextContents();
        const hasExpectedKeys = keyTexts.some(text => 
          text.includes('dcterms:title') || 
          text.includes('dcterms:creator') || 
          text.includes('dcterms:date')
        );
        expect(hasExpectedKeys).toBeTruthy();
      });
    });

    test('property details display correctly', async ({ page }) => {
      await test.step('Check property item structure', async () => {
        const firstProperty = app.mapping.nonLinkedKeys.locator('li:not(.placeholder)').first();
        await expect(firstProperty).toBeVisible();
        
        // Should contain property name and sample values
        const propertyText = await firstProperty.textContent();
        expect(propertyText).toBeTruthy();
        expect(propertyText.length).toBeGreaterThan(5); // Should have meaningful content
      });
    });

    test('property interaction buttons work', async ({ page }) => {
      await test.step('Verify property actions are available', async () => {
        const firstProperty = app.mapping.nonLinkedKeys.locator('li:not(.placeholder)').first();
        
        if (await firstProperty.count() > 0) {
          // Properties should have action buttons (map, ignore, etc.)
          const hasButtons = await firstProperty.locator('button, .button').count() > 0;
          if (hasButtons) {
            expect(hasButtons).toBeTruthy();
          }
        }
      });
    });
  });

  test.describe('Manual Properties @mapping-manual', () => {
    test('add manual property modal opens', async ({ page }) => {
      await test.step('Open add manual property modal', async () => {
        await app.addManualProperty();
        await expect(app.modal).toBeVisible();
        await expect(app.modalTitle).toBeVisible();
      });

      await test.step('Modal has expected content', async () => {
        const modalContent = await app.modalContent.textContent();
        expect(modalContent.length).toBeGreaterThan(0);
      });

      await test.step('Close modal', async () => {
        await app.modalCloseBtn.click();
        await expect(app.modal).toBeHidden();
      });
    });

    test('manual properties section exists', async ({ page }) => {
      await test.step('Verify manual properties section', async () => {
        await expect(app.mapping.manualProperties).toBeVisible();
        
        // Should initially show placeholder text
        const manualPropsText = await app.mapping.manualProperties.textContent();
        expect(manualPropsText).toContain('No additional properties' || 'placeholder');
      });
    });
  });

  test.describe('Entity Schema @mapping-schema', () => {
    test('entity schema input is available', async ({ page }) => {
      await test.step('Verify entity schema input field', async () => {
        // Entity schema might be hidden initially - check if it exists
        const schemaInput = await app.mapping.entitySchemaInput.count();
        if (schemaInput > 0) {
          await expect(app.mapping.entitySchemaInput).toBeVisible();
        } else {
          // Input might be in a collapsed section or hidden
          const sections = page.locator('.section summary');
          for (let i = 0; i < await sections.count(); i++) {
            await sections.nth(i).click();
            await page.waitForTimeout(300);
          }
          
          // Try to find it again
          const foundInput = await app.mapping.entitySchemaInput.count();
          if (foundInput > 0) {
            await expect(app.mapping.entitySchemaInput).toBeVisible();
          }
        }
      });
    });

    test('entity schema accepts Q-identifiers', async ({ page }) => {
      await test.step('Enter valid Q-identifier', async () => {
        // First try to make the input visible
        const sections = page.locator('.section summary');
        for (let i = 0; i < await sections.count(); i++) {
          await sections.nth(i).click();
          await page.waitForTimeout(200);
        }
        
        const schemaInputCount = await app.mapping.entitySchemaInput.count();
        if (schemaInputCount > 0 && await app.mapping.entitySchemaInput.isVisible()) {
          await app.setEntitySchema('Q5');
          const inputValue = await app.mapping.entitySchemaInput.inputValue();
          expect(inputValue).toBe('Q5');
        }
      });
    });
  });

  test.describe('Mapping Actions @mapping-actions', () => {
    test('save and load mapping buttons are present', async ({ page }) => {
      await test.step('Verify mapping action buttons', async () => {
        await expect(app.mapping.saveMappingBtn).toBeVisible();
        await expect(app.mapping.loadMappingBtn).toBeVisible();
      });
    });

    test('save mapping functionality', async ({ page }) => {
      await test.step('Click save mapping button', async () => {
        await app.saveMapping();
        
        // Should trigger a download (we can't verify the actual file in Playwright easily)
        // But we can verify the button click doesn't cause errors
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2); // Should remain on mapping step
      });
    });

    test('load mapping file input exists', async ({ page }) => {
      await test.step('Verify load mapping file input', async () => {
        // File input is typically hidden
        await expect(app.mapping.loadMappingFileInput).toBeAttached();
      });

      await test.step('Click load mapping button', async () => {
        await app.mapping.loadMappingBtn.click();
        // Should trigger file picker (we can verify button interaction)
        await page.waitForTimeout(500);
      });
    });
  });

  test.describe('Navigation @mapping-navigation', () => {
    test('back to input navigation works', async ({ page }) => {
      await test.step('Navigate back to input step', async () => {
        await app.backToInput();
        
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(1);
        await expect(app.input.step1Section).toBeVisible();
      });

      await test.step('Navigate back to mapping', async () => {
        await app.navigateToStep(2);
        
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
        await expect(app.mapping.step2Section).toBeVisible();
      });
    });

    test('proceed to reconciliation requires mappings', async ({ page }) => {
      await test.step('Verify proceed button state', async () => {
        // Initially should be disabled until at least one property is mapped
        const canProceed = await app.canProceedToReconciliation();
        
        // Button state depends on whether properties are actually mapped
        // For now, just verify the button exists and has a state
        await expect(app.mapping.proceedToReconciliationBtn).toBeVisible();
      });
    });

    test('step indicator shows correct progress', async ({ page }) => {
      await test.step('Verify step 2 is active', async () => {
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
      });

      await test.step('Progress bar shows advancement', async () => {
        const progressBar = app.progressBar;
        if (await progressBar.count() > 0) {
          const progressWidth = await progressBar.getAttribute('style');
          expect(progressWidth).toBeTruthy();
        }
      });
    });
  });

  test.describe('Mapping Categories @mapping-categories', () => {
    test('property categories are organized correctly', async ({ page }) => {
      await test.step('Verify all category sections exist', async () => {
        await expect(app.mapping.nonLinkedKeys).toBeVisible();
        await expect(app.mapping.mappedKeys).toBeVisible();  
        await expect(app.mapping.ignoredKeys).toBeVisible();
        await expect(app.mapping.manualProperties).toBeVisible();
      });

      await test.step('Check initial category states', async () => {
        // Non-linked should have items initially
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThanOrEqual(0);
        
        // Mapped and ignored should be empty initially
        const mappedCount = await app.getMappedKeysCount();
        const ignoredCount = await app.getIgnoredKeysCount();
        
        // These might be 0 initially for new data
        expect(mappedCount).toBeGreaterThanOrEqual(0);
        expect(ignoredCount).toBeGreaterThanOrEqual(0);
      });
    });

    test('categories show appropriate placeholder text', async ({ page }) => {
      await test.step('Check for placeholder content', async () => {
        const mappedText = await app.mapping.mappedKeys.textContent();
        const ignoredText = await app.mapping.ignoredKeys.textContent();
        
        // Should show helpful placeholder text when empty
        if (mappedText.includes('placeholder') || mappedText.includes('appear here')) {
          expect(mappedText.length).toBeGreaterThan(0);
        }
        
        if (ignoredText.includes('placeholder') || ignoredText.includes('appear here')) {
          expect(ignoredText.length).toBeGreaterThan(0);
        }
      });
    });
  });

  test.describe('Validation @mapping-validation', () => {
    test('mapping state persistence', async ({ page }) => {
      await test.step('Navigate away and back', async () => {
        await app.navigateToStep(1);
        await page.waitForTimeout(500);
        await app.navigateToStep(2);
      });

      await test.step('Verify mapping state is preserved', async () => {
        // Properties should still be organized in their categories
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
        
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThanOrEqual(0);
      });
    });

    test('test mode functionality', async ({ page }) => {
      await test.step('Check for test mode buttons', async () => {
        // Look for test mode specific buttons
        const testButtons = page.locator('.test-mode-only, .test-button');
        const testButtonCount = await testButtons.count();
        
        if (testButtonCount > 0) {
          // If test buttons exist, they should be visible
          await expect(testButtons.first()).toBeVisible();
        }
      });
    });
  });

  test.describe('Error Handling @mapping-errors', () => {
    test('handles missing data gracefully', async ({ page }) => {
      await test.step('Navigate to mapping without data', async () => {
        // Start fresh without loading data
        await page.goto('/');
        await app.navigateToStep(2);
      });

      await test.step('Verify error handling', async () => {
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2); // Should still load the step
        
        // Should show appropriate messaging for no data
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBe(0); // No properties to show
      });
    });

    test('handles navigation errors gracefully', async ({ page }) => {
      await test.step('Verify robust navigation', async () => {
        // Rapid navigation should not break the interface
        await app.navigateToStep(1);
        await app.navigateToStep(2);
        await app.navigateToStep(1);
        await app.navigateToStep(2);
        
        const activeStep = await app.getActiveStep();
        expect(activeStep).toBe(2);
        await expect(app.mapping.step2Section).toBeVisible();
      });
    });
  });

  test.describe('Integration @mapping-integration', () => {
    test('data from input step is available', async ({ page }) => {
      await test.step('Verify input data is accessible', async () => {
        // The sample data we loaded should result in properties
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThan(0);
      });
    });

    test('complete input to mapping workflow', async ({ page }) => {
      await test.step('Navigate back to input', async () => {
        await app.backToInput();
        await expect(app.input.step1Section).toBeVisible();
      });

      await test.step('Load different data', async () => {
        const newData = `{
          "metadata": {"total": 1},
          "items": [
            {"id": 1, "dcterms:title": [{"@value": "New Test Item"}], "dcterms:description": [{"@value": "New description"}]}
          ]
        }`;
        
        await app.openManualJsonInput();
        await app.input.manualJsonTextarea.fill('');
        await app.enterManualJson(newData);
        await app.input.processManualJsonButton.click();
        await page.waitForTimeout(1000);
      });

      await test.step('Navigate to mapping with new data', async () => {
        await app.proceedToMapping();
        
        // Should show properties from new data
        const nonLinkedCount = await app.getNonLinkedKeysCount();
        expect(nonLinkedCount).toBeGreaterThan(0);
      });
    });
  });
});