# Browser-Based Tests

This directory contains browser-based tests for the Omeka S to Wikidata Mapping Tool.

## Overview

These tests run directly in the browser, avoiding the need for Node.js or any server-side dependencies. This approach matches the client-side focus of the application.

## Running Tests

To run the tests:

1. Open `test-runner.html` in a web browser
2. The test results will appear in the page

## Test Structure

The tests use:
- **Mocha**: Test framework
- **Chai**: Assertion library

No build step or compilation is required - the tests run directly against the ES module code in the browser.

## Adding New Tests

To add new tests:

1. Create a new test file in the `tests/` directory
2. Import the module to test
3. Write your tests using Mocha's `describe` and `it` functions
4. Add a script import to `test-runner.html`

Example:

```js
// newFeature.test.js
import { myFeature } from '../../../src/js/myFeature.js';

describe('My Feature', () => {
  it('should do something', () => {
    const result = myFeature();
    expect(result).to.be.true;
  });
});
```

Then add to test-runner.html:

```html
<script type="module" src="tests/newFeature.test.js"></script>
```

## Benefits of Browser Testing

- **No Build Step**: Tests run directly in browser without transpilation
- **Real Environment**: Tests run in the actual environment the code will run in
- **Zero Dependencies**: No Node.js or npm required
- **Simple Setup**: Just open an HTML file in a browser

## Limitations

- **Limited Automation**: Manual browser refresh needed to run tests  
- **No Coverage Reports**: Built-in code coverage is not available
- **Limited Mocking**: Some advanced mocking capabilities may be limited