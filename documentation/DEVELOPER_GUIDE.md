# Developer Guide

## Branch Flow

Use the branch sequence below for all application and documentation changes:

`dev -> test -> main`

- `dev`: day-to-day integration work.
- `test`: shared validation branch for colleague and scenario testing.
- `main`: promoted release branch.

Push a coherent, tested change to `dev`. Merge it into `test` for review. Promote the tested merge to `main` only after the release checks are satisfactory. GitHub Actions deploys each branch to its matching GitHub Pages path.

## Documentation Flow

Write and edit current manuals in `documentation/`. These files use the same pull/merge/promotion process as code. Do not author manuals in `docs/`: deployment recreates that directory from `src/`. The maintained `docs/JS_MODULE_MAP.md` is the technical exception and is preserved by the deployment workflow.

Keep `archive/` read-only in spirit. Add an archival note when needed, but do not silently revise an old specification to make it look current.

## Local Setup

This is a static HTML, CSS, and JavaScript application.

1. Install the project dependencies with `npm install`.
2. Use the local static server configured by the project or run `python -m http.server 8080` from the repository root.
3. Open `http://127.0.0.1:8080/src/`.

The app calls public Omeka S and Wikidata endpoints from the browser. Test with realistic data when changing CORS behaviour, resource-template enrichment, Mapping, Reconciliation, References, or Export.

## Tests

- `npm run test:e2e:smoke`: quick application smoke coverage.
- `npm run test:e2e`: full Playwright suite.
- `npx playwright test tests/e2e/steps/step1-input.spec.js`: Step 1 coverage.
- `npx playwright test tests/e2e/steps/reconciliation-header-and-language.spec.js`: focused Reconciliation coverage.

Run the smallest relevant test first, then the appropriate scenario or smoke suite. Record known unrelated failures rather than weakening a test to make a release look green.

## Code and Documentation Conventions

- Application changes belong in `src/`.
- Use the component factory in `src/js/ui/components.js` for UI creation.
- Use state convenience methods instead of direct scattered state mutations.
- Keep JavaScript module responsibilities documented in `docs/JS_MODULE_MAP.md` when exports, dependencies, or responsibilities change.
- Update a user-facing guide whenever behaviour in a workflow step changes.
- Keep language plain and describe current behaviour rather than planned functionality.

## Issue Handling

Treat GitHub issues as evidence-based backlog items. After a release candidate reaches `test`, close issues confirmed by testing, keep partial items open, and create new issues for new feedback. Avoid a retrospective mass-close before validation.
