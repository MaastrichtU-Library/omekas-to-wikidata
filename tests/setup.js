/**
 * Jest setup file
 * Configures the testing environment
 */

// Mock performance API for Node.js environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

// Mock console methods to reduce noise in tests if needed
// global.console = {
//   ...console,
//   warn: jest.fn(),
//   log: jest.fn()
// };

// Any other global test setup can go here