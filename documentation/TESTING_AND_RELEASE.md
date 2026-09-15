# Testing and Release

## Testing Principle

Test the user journey, not only isolated controls. The critical path is:

`Input -> Mapping -> Reconciliation -> References -> Export`

Use a small, representative Omeka S scope first. Test large or unscoped imports only after the scoped flow behaves as expected.

## Step Checklist

### Input

- Fetch an API URL with a resource template, item set, site, or owner scope.
- Check both all-pages scoped retrieval and one-page scoped retrieval.
- Select the intended resource template and items.
- Test Manual JSON input, including optional resource-template JSON when custom labels matter.
- Confirm API and manual JSON imports produce the same Mapping labels and capabilities.

### Mapping

- Choose Label and Instance of from appropriate sources.
- Verify template labels and technical terms are understandable.
- Select an Entity Schema and examine its required properties.
- Map a normal field and check sample values.
- Test a mixed field with more than one observed segment family.
- Confirm source-group changes and transformations update samples immediately.
- Map one Omeka field twice only when different value families genuinely need different Wikidata properties.

### Reconciliation

- Confirm Mapping order, with Label and Instance of first.
- Check source badges and readable property labels.
- Reconcile an entity, open its QID link, and apply a decision to identical values where appropriate.
- Test `1` to `9` result shortcuts and `I` to skip.
- Set a label language when required.
- Go back to Mapping, add or ignore a field, and return; unchanged rows should stay reconciled.
- Validate dates, external IDs, URLs, and monolingual text before export.

### References and Export

- Check detected Omeka, OCLC, ARK, and compatible source links.
- Assign a reference type to at least one mapped property.
- Generate QuickStatements and inspect a small sample.
- Confirm identifier and date values are accepted.
- Test the result in the QuickStatements sandbox or with a deliberately small batch before a full import.

## Promotion Checklist

1. Commit logical changes on `dev`.
2. Run targeted checks and record any known unrelated failures.
3. Perform a manual scenario pass on `dev`.
4. Push and merge `dev` into `test`.
5. Ask colleagues to report findings as either `Broken / incorrect` or `Confusing / polish / UX`.
6. Fix confirmed problems on `dev` and repeat the promotion when needed.
7. Merge `test` into `main` after acceptance.
8. Confirm the GitHub Actions deployment and GitHub Pages publication complete successfully.

## Release Notes and Issues

Use release-level notes for a cross-cutting batch of Mapping/Reconciliation improvements. Keep individual GitHub issues open while test validation is still in progress. Close only items confirmed fixed, and explain any re-scoping in the closing comment.
