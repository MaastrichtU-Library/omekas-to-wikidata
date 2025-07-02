# GitHub Issues to Create for Code Enhancement

## Issue 1: Refactor large functions for better maintainability

**Title:** Refactor large functions for better maintainability
**Labels:** code enhancement
**Body:**
```markdown
## Problem
Several functions in the codebase are quite long and handle multiple responsibilities, making them difficult to read, test, and maintain.

## Specific Functions to Refactor
- `createInputHTML` in `src/js/utils/property-types.js:239` (125+ lines)
- Large event handlers in `src/js/steps/input.js`
- Complex mapping logic in `src/js/steps/mapping.js`

## Solution
Break down large functions into smaller, focused functions with single responsibilities.

## Acceptance Criteria
- [ ] No function should exceed 50 lines
- [ ] Each function should have a single, clear responsibility
- [ ] All new smaller functions should have JSDoc comments
- [ ] Existing functionality must remain unchanged
```

---

## Issue 2: Create constants configuration module

**Title:** Create constants configuration module to reduce magic numbers
**Labels:** code enhancement
**Body:**
```markdown
## Problem
Magic numbers and repeated configuration values are scattered throughout the codebase, making maintenance difficult.

## Solution
Create a dedicated configuration module to centralize constants:

```javascript
// src/js/config/constants.js
export const UI_CONFIG = {
    STEP_COUNT: 5,
    DEFAULT_PAGINATION: 10,
    DEFAULT_ENTITY_SCHEMA: 'E473',
    LOADING_DELAY: 100
};

export const API_CONFIG = {
    CONTENT_TYPE: 'application/json',
    DEFAULT_TIMEOUT: 5000
};
```

## Acceptance Criteria
- [ ] Create `src/js/config/constants.js`
- [ ] Replace magic numbers throughout codebase
- [ ] Import constants where needed
- [ ] Document all constants with JSDoc
```

---

## Issue 3: Implement standardized error handling system

**Title:** Implement standardized error handling across the application
**Labels:** code enhancement
**Body:**
```markdown
## Problem
Error handling is inconsistent across the application, with different patterns used in different modules.

## Solution
Create a unified error handling system:

```javascript
// src/js/utils/error-handler.js
export class AppError extends Error {
    constructor(message, type = 'GENERAL', details = null) {
        super(message);
        this.type = type;
        this.details = details;
    }
}

export function handleApiError(error, context = '') {
    console.error(`API Error ${context}:`, error);
    const userMessage = getUserFriendlyMessage(error);
    showMessage(userMessage, 'error');
}
```

## Acceptance Criteria
- [ ] Create `src/js/utils/error-handler.js`
- [ ] Define standard error types
- [ ] Replace inconsistent error handling patterns
- [ ] Add user-friendly error messages
- [ ] Ensure all async operations have proper error handling
```

---

## Issue 4: Ensure async/await consistency

**Title:** Convert remaining Promise chains to async/await pattern
**Labels:** code enhancement
**Body:**
```markdown
## Problem
Following the updated CLAUDE.md guidelines, all asynchronous operations should use async/await instead of Promise chains.

## Task
- [ ] Audit all JavaScript files for `.then()`, `.catch()`, and raw Promise usage
- [ ] Convert all Promise chains to async/await
- [ ] Ensure all async operations have proper try/catch blocks
- [ ] Update any callback-based async code to use async/await

## Files to Check
- All files in `src/js/steps/`
- All files in `src/js/utils/`
- `src/js/state.js`
- `src/js/navigation.js`

## Acceptance Criteria
- [ ] No `.then()` or `.catch()` calls remain in codebase
- [ ] All async functions use try/catch for error handling
- [ ] All async operations follow the pattern established in CLAUDE.md
```

---

## Issue 5: Create unified validation system

**Title:** Implement centralized validation system
**Labels:** code enhancement
**Body:**
```markdown
## Problem
Validation logic is scattered throughout the application with inconsistent patterns.

## Solution
Create a unified validation system:

```javascript
// src/js/utils/validators.js
export const validators = {
    apiUrl: (url) => ({
        isValid: /^https?:\/\/.+\/api\//.test(url),
        message: 'Please enter a valid Omeka S API URL'
    }),
    
    qid: (value) => ({
        isValid: /^Q\d+$/.test(value),
        message: 'Must be a valid Q-ID (e.g., Q123)'
    }),
    
    required: (value) => ({
        isValid: value && value.trim() !== '',
        message: 'This field is required'
    })
};
```

## Acceptance Criteria
- [ ] Create `src/js/utils/validators.js`
- [ ] Replace inline validation with centralized validators
- [ ] Ensure consistent validation error messages
- [ ] Add tests for validation functions
```

---

## Issue 6: Implement component factory pattern

**Title:** Create component factory for consistent UI component creation
**Labels:** code enhancement
**Body:**
```markdown
## Problem
UI component creation is inconsistent across the application.

## Solution
Implement a factory pattern for UI components:

```javascript
// src/js/ui/component-factory.js
export class ComponentFactory {
    static createButton(type, text, options = {}) {
        const baseClasses = 'button';
        const typeClasses = {
            primary: 'button--primary primary-button',
            secondary: 'button--secondary secondary-button',
            test: 'button--test test-button'
        };
        
        return createElement('button', {
            className: `${baseClasses} ${typeClasses[type] || typeClasses.secondary}`,
            ...options
        }, text);
    }
}
```

## Acceptance Criteria
- [ ] Create `src/js/ui/component-factory.js`
- [ ] Implement factory methods for common components
- [ ] Replace inline component creation with factory calls
- [ ] Ensure consistent styling and behavior
```

---

## Issue 7: Add state helper methods

**Title:** Add convenience methods to state management
**Labels:** code enhancement
**Body:**
```markdown
## Problem
Common state operations require verbose updateState calls.

## Solution
Add helper methods for common state operations:

```javascript
// Add to state.js
setStepData(step, data) {
    this.updateState(`step${step}Data`, data);
},

getStepData(step) {
    const state = this.getState();
    return state[`step${step}Data`] || null;
},

updateMapping(type, items) {
    this.updateState(`mappings.${type}`, items);
}
```

## Acceptance Criteria
- [ ] Add convenience methods to state.js
- [ ] Update existing code to use new helper methods
- [ ] Add JSDoc documentation for new methods
- [ ] Ensure backward compatibility
```

---

## Issue 8: Improve file organization structure

**Title:** Reorganize file structure for better maintainability
**Labels:** code enhancement
**Body:**
```markdown
## Problem
Current file organization could be improved for better code discoverability.

## Proposed Structure
```
src/js/
├── core/           # Core application logic
│   ├── app.js
│   ├── state.js
│   └── events.js
├── services/       # External service interactions
│   ├── api-client.js
│   └── wikidata-service.js
├── components/     # Reusable UI components
├── steps/          # Step-specific logic
├── utils/          # Utility functions
│   ├── validators.js
│   ├── error-handler.js
│   └── constants.js
└── config/         # Configuration files
```

## Acceptance Criteria
- [ ] Create new directory structure
- [ ] Move existing files to appropriate locations
- [ ] Update all import statements
- [ ] Ensure no functionality is broken
- [ ] Update documentation to reflect new structure
```

---

## Commands to Create Issues

After restart, run these commands:

```bash
gh issue create --title "Refactor large functions for better maintainability" --body "Problem: Several functions are too long and handle multiple responsibilities. Key functions to refactor: createInputHTML in src/js/utils/property-types.js (125+ lines), large event handlers in src/js/steps/input.js, complex mapping logic in src/js/steps/mapping.js. Solution: Break down large functions into smaller focused functions with single responsibilities. Acceptance: No function should exceed 50 lines, each should have single responsibility, add JSDoc comments, maintain existing functionality." --label "code enhancement"

gh issue create --title "Create constants configuration module to reduce magic numbers" --body "Problem: Magic numbers and repeated configuration values are scattered throughout the codebase. Solution: Create src/js/config/constants.js to centralize UI_CONFIG and API_CONFIG constants. Replace magic numbers throughout codebase and import constants where needed. Document all constants with JSDoc." --label "code enhancement"

gh issue create --title "Implement standardized error handling across the application" --body "Problem: Error handling is inconsistent across the application. Solution: Create src/js/utils/error-handler.js with AppError class and handleApiError function. Define standard error types, replace inconsistent error handling patterns, add user-friendly error messages, ensure all async operations have proper error handling." --label "code enhancement"

gh issue create --title "Convert remaining Promise chains to async/await pattern" --body "Problem: Following updated CLAUDE.md guidelines, all asynchronous operations should use async/await. Task: Audit all JavaScript files for .then(), .catch(), and raw Promise usage. Convert all Promise chains to async/await. Ensure all async operations have proper try/catch blocks. Files to check: All files in src/js/steps/, src/js/utils/, src/js/state.js, src/js/navigation.js." --label "code enhancement"

gh issue create --title "Implement centralized validation system" --body "Problem: Validation logic is scattered throughout the application with inconsistent patterns. Solution: Create src/js/utils/validators.js with unified validation system including apiUrl, qid, and required validators. Replace inline validation with centralized validators. Ensure consistent validation error messages. Add tests for validation functions." --label "code enhancement"

gh issue create --title "Create component factory for consistent UI component creation" --body "Problem: UI component creation is inconsistent across the application. Solution: Create src/js/ui/component-factory.js with ComponentFactory class. Implement factory methods for common components like buttons. Replace inline component creation with factory calls. Ensure consistent styling and behavior across components." --label "code enhancement"

gh issue create --title "Add convenience methods to state management" --body "Problem: Common state operations require verbose updateState calls. Solution: Add helper methods for common state operations like setStepData, getStepData, updateMapping. Update existing code to use new helper methods. Add JSDoc documentation for new methods. Ensure backward compatibility with existing state API." --label "code enhancement"

gh issue create --title "Reorganize file structure for better maintainability" --body "Problem: Current file organization could be improved for better code discoverability. Solution: Create new directory structure with core/, services/, components/, steps/, utils/, and config/ directories. Move existing files to appropriate locations. Update all import statements. Ensure no functionality is broken. Update documentation to reflect new structure." --label "code enhancement"
```