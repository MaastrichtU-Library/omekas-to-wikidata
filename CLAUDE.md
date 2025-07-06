# CLAUDE.md – Project Conventions

## Workflow
- Only edit code inside the `src/` directory
- After each successful file modification, run:
  ```
  git add "<file1> <file2> ..." && git commit -m "<concise message>"
  ```
- Use `git restore` (file) or `git revert` (commit) when the user says "undo"
- When making changes make sure to keep the documentation up to date.
- ALWAYS end by commiting the changes you have made!
### Github Issues
How to create edit view close open issues and update the JSON with all the issues (".issues/all_issues.json")

Commands:
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

Update the json with all the issues:
```bash
gh issue list --state all --json number,title,body,state,labels,createdAt,updatedAt,assignees,milestone,author,comments,closedAt,url,closed,stateReason,isPinned --limit 100 > .issues/all_issues.json
```


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

### UI Component Creation
- **ALWAYS use the component factory system** from `src/js/ui/components.js`
- **NEVER use `document.createElement()` directly** - use standardized factory functions instead
- **Integration Status:** 100% integrated across all core application files (as of 2025-07-02)
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
- Test all new functionality in different browsers
- Test error cases and edge conditions

## Documentation
- Document APIs and complex functions
- Keep README up to date
- Add JSDoc comments to functions when appropriate

## Code Replacement Guidelines
- **NEVER create fallback options or legacy code** when replacing functionality unless explicitly requested
- When asked to replace or change something, completely remove the old implementation
- Avoid keeping both old and new methods side by side as it creates confusion and code clutter
- Clean removal of old code prevents ambiguity about which method should be used
- If fallback options are needed, the user will explicitly ask for them