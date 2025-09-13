# CLAUDE.md – Project Conventions

## JavaScript Module Navigation
- **ALWAYS consult `JS_MODULE_MAP.md`** to find the right JavaScript module for any task
- This file contains a complete map of all `.js` files, their purposes, and key exports
- Use the Quick Reference table to instantly locate functionality

## Workflow
- Only edit code inside the `src/` directory
- After each successful file modification, run:
  ```
  git add "<file1> <file2> ..." && git commit -m "<concise message>"
  ```
- Use `git restore` (file) or `git revert` (commit) when the user says "undo"
- When making changes make sure to keep the documentation up to date.
- **When modifying any `.js` file:** Update `JS_MODULE_MAP.md` if you:
  - Add/remove exported functions
  - Create new modules or files
  - Change module responsibilities
  - Add new dependencies
- Commit changes when logical units of work are complete
### GitHub Issues Management
The project uses an automated local synchronization system for GitHub issues with smart timestamp-based change detection.

#### Basic GitHub Commands:
```bash
# Create
gh issue create --title "Title" --body "Body" --label "bug,documentation" --assignee "daanvr" --milestone "MVP"

# Edit  
gh issue edit NUMBER --title "Edited Title" --body "edited Body" --add-label "documentation" --remove-label "bug" --add-assignee "daanvr" --remove-assignee "daanvr" --milestone "MVP"

# View
gh issue view NUMBER --json "number,title,body,state,labels,assignees,milestone,author,createdAt,updatedAt,closedAt,url"

# Close and reopen
gh issue close NUMBER
gh issue reopen NUMBER
```

#### Local Issue Synchronization:
```bash
# Full sync (initial setup or force refresh all issues)
node .issues/sync-issues.js --full

# Incremental sync (only changed issues since last sync)
node .issues/sync-issues.js

# Sync specific issue
node .issues/sync-issues.js --issue 42
```

#### Directory Structure:
- `.issues/all_issues.json` - Complete GitHub issues data
- `.issues/sync-metadata.json` - Timestamp tracking for efficient syncing
- `.issues/issues/NUMBER.md` - Human-readable markdown files
- `.issues/issues/NUMBER.json` - Complete issue data in JSON format
- `.issues/README.md` - Full documentation

#### Benefits:
- **Smart Sync**: Only updates issues modified since last sync using `updatedAt` timestamps
- **Dual Format**: Both human-readable (.md) and machine-readable (.json) files
- **Automatic Cleanup**: Removes local files for deleted GitHub issues
- **Offline Access**: Complete local archive of all issues


## Code Quality Guidelines

### General
- Write modern, clean, and reusable JavaScript (ES6+)
- Maintain client-side only architecture
- This tool is desktop browser only. No responsiveness or mobile friendliness needed
- Use descriptive variable and function names
- Keep functions small and focused on a single responsibility
- Document complex logic with clear comments
- Prioritize comments that describe context and information that is not clear from reading the code itself

### JavaScript
- Use `const` by default, `let` when necessary, avoid `var`
- Use arrow functions for callbacks
- Use template literals instead of string concatenation
- Use destructuring for objects and arrays
- Always use async/await for asynchronous operations
- Use optional chaining and nullish coalescing when appropriate
- Wrap async operations in try/catch blocks for proper error handling

### HTML/CSS
- Use semantic HTML elements
- Follow BEM naming convention for CSS classes
- Prefer CSS Grid and Flexbox for layouts

### Code Organization
- Keep related functions and components together
- Create modular components that can be reused
- Separate concerns: data management, UI rendering, and application logic
- **File size limit:** Maximum 1000 lines per JavaScript file

### Module Organization
- **Feature-based structure:** Group by domain (`mapping/`, `reconciliation/`, `steps/`)
- **Layer separation:** 
  - `core/` - Business logic and data processing
  - `ui/` - Interface components and interactions
  - `utils/` - Helper functions and utilities
- **Shared modules:** Place at root level (`state.js`, `events.js`, `api/`)
- **File naming:** Use kebab-case with descriptive names
- **Import paths:** Use relative imports within features, absolute for shared modules
- **Index files:** Create `index.js` files to expose public APIs from modules

**Example structure:**
```
src/js/
├── mapping/
│   ├── core/           # Business logic
│   ├── ui/             # Interface components
│   │   └── modals/     # Modal-specific components
│   └── index.js        # Public API
├── reconciliation/
│   ├── core/
│   ├── ui/
│   └── index.js
├── steps/              # Workflow step handlers
├── ui/                 # Shared UI components
├── utils/              # Cross-cutting utilities
└── api/                # External service interfaces
```

### UI Component Creation
- **ALWAYS use the component factory system** from `src/js/ui/components.js`
- **NEVER use `document.createElement()` directly** - use standardized factory functions instead
- **Integration Status:** Fully integrated across all core application files
- **Available factory functions:**
  - `createElement(tag, attrs, content)` - Base element creation with attributes and content
  - `createButton(text, options)` - Standardized buttons with consistent styling
  - `createInput(type, options)` - Input elements with validation and options
  - `createListItem(content, options)` - List items with click handlers and styling
  - `createModal(options)` - Modal containers with overlay and close behavior
  - `createFileInput(options)` - File inputs with accept types and change handlers
  - `createDownloadLink(href, filename, options)` - Download anchors with cleanup
  - `showMessage(message, type, duration)` - Toast notifications
- **Import pattern:** `import { createElement, createButton } from '../ui/components.js';`
- **Usage examples:**
  ```javascript
  // Instead of: const div = document.createElement('div');
  const div = createElement('div', { className: 'my-class' }, 'content');
  
  // Instead of: const th = document.createElement('th');
  const th = createElement('th', { className: 'header' }, 'Header Text');
  ```
- **Benefits:** Consistent styling, centralized behavior, easier maintenance, better testing

### State Management
- **ALWAYS use convenience methods** from `src/js/state.js` for common operations
- **NEVER use verbose `updateState` calls** when convenience methods exist  
- **Available convenience methods:**
  - `updateMappings(nonLinked, mapped, ignored)` - Atomic mapping category updates
  - `addToMappingCategory(category, items)` / `removeFromMappingCategory(category, items)` - Category-specific operations
  - `incrementReconciliationCompleted()` / `incrementReconciliationSkipped()` - Progress tracking
  - `setReconciliationProgress(completed, total)` - Direct progress setting
  - `ensureMappingArrays()` - Array initialization
  - `loadMockData(mockItems, mockMapping)` - Testing data loader
- **Import pattern:** All methods available from state instance passed to step modules
- **Usage examples:**
  ```javascript
  // Instead of: 
  state.updateState('mappings.nonLinkedKeys', nonLinked);
  state.updateState('mappings.mappedKeys', mapped);
  state.updateState('mappings.ignoredKeys', ignored);
  
  // Use: 
  state.updateMappings(nonLinked, mapped, ignored);
  
  // Instead of:
  const currentState = state.getState();
  state.updateState('reconciliationProgress.completed', currentState.reconciliationProgress.completed + 1);
  
  // Use:
  state.incrementReconciliationCompleted();
  ```
- **Benefits:** Atomic operations, cleaner code, consistent state changes, proper event notifications

## Testing

### Test Environment Setup
- Uses Python local server with automatic port rotation for concurrent branch development
- Run `./setup-playwright.sh` to create symlinks to global Playwright installation
- Server automatically starts on available port (default 8080, rotates if busy)
- Multiple branches can run tests simultaneously without conflicts

### Playwright E2E Testing
- **Test everything built** - All new functionality requires E2E test coverage
- **Available commands:**
  - `npm run test:e2e:smoke` - Quick smoke tests
  - `npm run test:e2e` - Full test suite
  - `npm run test:e2e:ui` - Interactive test runner
  - `npm run test:e2e:codegen` - Record new tests
- **Test organization:**
  - Place tests in `tests/e2e/`
  - Use `@smoke` and `@critical` tags for test categorization
  - Test error cases and edge conditions
  - Test across different browser contexts

## Documentation
- Document APIs and complex functions
- Keep README up to date
- Add JSDoc comments to functions when appropriate
- **Keep JS_MODULE_MAP.md synchronized** - Update whenever JavaScript module structure changes

## Code Replacement Policy
- **ALWAYS fully replace code** - no fallbacks, no legacy methods, no side-by-side implementations
- Remove old code completely when making changes
- Only keep old code if user explicitly asks for backward compatibility