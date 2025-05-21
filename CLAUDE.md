# CLAUDE.md – team conventions
## Workflow
- Only edit code inside the src/ directory
- After each successful file modification, run:
  git add "<file1> <file2> ..." && git commit -m "<concise message>"
- Use `git restore` (file) or `git revert` (commit) when the user says “undo”.