import { expect } from '@playwright/test';

/**
 * Common test actions and utilities
 */

/**
 * Setup console error tracking for a page
 * @param {Page} page - Playwright page object
 * @returns {Function} Function to assert no console errors occurred
 */
export async function checkNoConsoleErrors(page) {
  const errors = [];
  const warnings = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      
      // Filter out expected errors that are not actual problems
      const expectedErrors = [
        'Designer - No reconciliation data found!',
        'No data to export',
        'No mapping data found', 
        'No reconciliation results found'
      ];
      
      if (!expectedErrors.some(expectedError => text.includes(expectedError))) {
        errors.push(text);
      }
    } else if (msg.type() === 'warning' && msg.text().includes('deprecated')) {
      warnings.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errors.push(String(err));
  });
  
  // Return function to assert at end of test
  return () => {
    expect(errors, `Console errors found: ${errors.join('\n')}`).toEqual([]);
    // Log warnings but don't fail tests
    if (warnings.length > 0) {
      console.log(`Warnings found: ${warnings.join('\n')}`);
    }
  };
}

/**
 * Wait for data to load completely
 * @param {Page} page - Playwright page object
 */
export async function waitForDataLoad(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Brief wait for JS rendering
}

/**
 * Capture test artifacts for debugging
 * @param {Page} page - Playwright page object  
 * @param {string} testName - Name of the test for artifact naming
 */
export async function captureTestArtifacts(page, testName) {
  const timestamp = Date.now();
  const safeName = testName.replace(/[^a-zA-Z0-9]/g, '-');
  
  try {
    await page.screenshot({ 
      path: `test-artifacts/${safeName}-${timestamp}.png`,
      fullPage: true 
    });
  } catch (error) {
    console.log(`Failed to capture screenshot: ${error.message}`);
  }
}

/**
 * Wait for a specific element to appear and be stable
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForElement(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
  await page.waitForTimeout(100); // Brief stabilization wait
}

/**
 * Fill a form field with proper waiting
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector for the input
 * @param {string} value - Value to fill
 */
export async function fillField(page, selector, value) {
  await page.waitForSelector(selector);
  await page.fill(selector, value);
  await page.waitForTimeout(100); // Brief wait for input processing
}

/**
 * Click an element with proper waiting
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector for the element
 */
export async function clickElement(page, selector) {
  await page.waitForSelector(selector, { state: 'visible' });
  await page.click(selector);
  await page.waitForTimeout(100); // Brief wait for click processing
}

/**
 * Wait for network requests to complete
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForNetwork(page, timeout = 10000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Scroll element into view
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector for the element
 */
export async function scrollToElement(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200); // Wait for scroll to complete
}

/**
 * Check if element exists (without waiting)
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector for the element
 * @returns {Promise<boolean>} True if element exists
 */
export async function elementExists(page, selector) {
  const count = await page.locator(selector).count();
  return count > 0;
}

/**
 * Get text content from element
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector for the element
 * @returns {Promise<string>} Text content of element
 */
export async function getText(page, selector) {
  await page.waitForSelector(selector);
  return await page.locator(selector).textContent();
}

/**
 * Wait for URL to match pattern
 * @param {Page} page - Playwright page object
 * @param {RegExp|string} pattern - Pattern to match against URL
 */
export async function waitForURL(page, pattern) {
  await page.waitForURL(pattern);
}