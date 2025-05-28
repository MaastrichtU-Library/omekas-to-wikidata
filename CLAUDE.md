# CLAUDE.md – Project Conventions

## Workflow
- Only edit code inside the `src/` directory
- After each successful file modification, run:
  ```
  git add "<file1> <file2> ..." && git commit -m "<concise message>"
  ```
- Use `git restore` (file) or `git revert` (commit) when the user says "undo"
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
gh issue list --json number,title,body,state,labels,createdAt,updatedAt,assignees,milestone,author,comments,closedAt,url,closed,stateReason,isPinned --limit 100 > .issues/all_issues.json
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
- Use async/await for asynchronous operations
- Use optional chaining and nullish coalescing when appropriate

### HTML/CSS
- Use semantic HTML elements
- Follow BEM naming convention for CSS classes
- Prefer CSS Grid and Flexbox for layouts

### Code Organization
- Keep related functions and components together
- Create modular components that can be reused
- Separate concerns: data management, UI rendering, and application logic

## Testing
- Test all new functionality in different browsers
- Test error cases and edge conditions

## Documentation
- Document APIs and complex functions
- Keep README up to date
- Add JSDoc comments to functions when appropriate