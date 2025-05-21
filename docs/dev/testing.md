# Testing Guide

This document provides instructions for running and writing tests for the Omeka S to Wikidata Mapping Tool.

## Overview

The application uses Jest for testing, with the following structure:

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test interactions between components
- **UI Tests**: Test DOM manipulation and event handling

The tests are located in the `tests/` directory, organized by test type and module.

## Running Tests

### Prerequisites

Before running tests, ensure you have the necessary dependencies installed:

```bash
npm install
```

### Running All Tests

To run all tests:

```bash
npm test
```

### Running Specific Tests

To run tests for a specific file or directory:

```bash
npm test -- tests/unit/ui/components.test.js
```

To run tests that match a specific pattern:

```bash
npm test -- -t "Modal UI"
```

### Continuous Testing

To run tests in watch mode (automatically re-run tests when files change):

```bash
npm run test:watch
```

### Code Coverage

To generate a code coverage report:

```bash
npm run test:coverage
```

The coverage report will be available in the `coverage/` directory.

## Writing Tests

### Test Structure

Tests are organized using Jest's `describe` and `test` functions:

```javascript
describe('Module Name', () => {
  describe('Function or Component Name', () => {
    test('should do something specific', () => {
      // Test code here
    });
  });
});
```

### DOM Testing

The testing environment includes a mock DOM with basic elements for the application. Use the global `setupTestDOM()` function to reset the DOM before each test:

```javascript
beforeEach(() => {
  setupTestDOM();
});
```

### Mocking Dependencies

Use Jest's mocking capabilities to mock dependencies:

```javascript
// Mock a module
jest.mock('../../../src/js/events.js', () => ({
  eventSystem: {
    Events: {
      STEP_CHANGED: 'step:changed'
    },
    publish: jest.fn(),
    subscribe: jest.fn(() => jest.fn())
  }
}));
```

### Testing UI Components

When testing UI components, focus on:

1. DOM manipulation (elements created, classes added/removed)
2. Event handling (clicks, keyboard events)
3. State changes (component state, attributes)

Example:

```javascript
test('updates UI for step 2', () => {
  navigationUI.updateStepUI(2);
  
  // Check if step 2 is active
  expect(steps[1].classList.contains('active')).toBe(true);
  
  // Check if step 2 content is visible
  expect(stepContents[1].classList.contains('active')).toBe(true);
  
  // Check progress bar
  expect(progressBar.style.width).toBe('25%');
});
```

### Testing Event Handling

For event-driven components, test the event handling logic:

```javascript
test('closes modal on escape key', () => {
  modalUI.openModal('Test Title', 'Test Content');
  
  // Simulate escape key press
  const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
  document.dispatchEvent(escapeEvent);
  
  // Check if modal is closed
  expect(modalContainer.style.display).toBe('none');
});
```

## Best Practices

1. **Test Isolation**: Each test should be independent of others
2. **Test Coverage**: Aim for high test coverage, especially for critical components
3. **Descriptive Names**: Use descriptive test names that explain what is being tested
4. **Small Tests**: Keep tests small and focused on one behavior
5. **Arrange-Act-Assert**: Follow the AAA pattern (Arrange, Act, Assert)
6. **Mock External Dependencies**: Mock external dependencies to isolate the component under test
7. **Don't Test Implementation Details**: Focus on testing behavior, not implementation details

## Adding New Tests

When adding new features or components:

1. Create a new test file in the appropriate directory
2. Import the component or function to test
3. Mock any dependencies
4. Write test cases covering the functionality
5. Run the tests to ensure they pass

## Troubleshooting

Common issues and solutions:

- **DOM Not Available**: Ensure `setupTestDOM()` is called before tests that require DOM elements
- **Mocks Not Working**: Check that mocks are defined before the tests that use them
- **Tests Affecting Each Other**: Ensure tests are properly isolated and cleanup is performed