# Architecture

## Product Model

The application is a static, client-side browser tool. It does not require a project backend or user accounts. It reads public Omeka S data, requests Wikidata services, stores working state in the browser, and generates QuickStatements for the user to review and run.

The implemented product flow is:

`Input -> Mapping -> Reconciliation -> References -> Export`

## Main Components

- `src/index.html`: the five-step interface and static controls.
- `src/js/state.js`: central application state, persistence, and workflow notifications.
- `src/js/steps/`: entry points for Input, Mapping, Reconciliation, References, and Export.
- `src/js/mapping/`: field analysis, property selection, transformations, and mapping UI.
- `src/js/reconciliation/`: extracted values, matching, validation, table rendering, and dialogs.
- `src/js/references/`: detected and custom source links plus property assignment.
- `src/js/utils/`: shared CORS, datatype, identifier, and Wikidata-search helpers.

For detailed JavaScript ownership, use the maintained [module map](../docs/JS_MODULE_MAP.md) on development branches.

## Input and Metadata Enrichment

API and manual JSON imports converge on the same normalized application state. Both paths attempt to load the selected Omeka resource templates so Mapping can show template display labels and datatype information.

If CORS blocks this enrichment, imported item JSON still works. Users can paste matching resource-template JSON to restore custom labels. This keeps manual import a functional fallback rather than a reduced feature set.

## Mapping and Value Resolution

Omeka values vary between datasets and even between items in one field. The mapping layer therefore resolves values as separate segments with provenance rather than reducing every field to a single string.

Each resolved segment can carry readable reconciliation text, source metadata for a UI badge, a reusable segment-family key and label, and a deduplication key.

The generic segment-family model uses signals such as source type, authority identity, URI host, identifier shape, and selected readable text. It is intentionally not tied to a Radboud or Maastricht endpoint.

Users first choose the segment families that belong in a mapping, then optionally narrow source groups within those families. A mapping signature records decisions that affect downstream values, including source key, target property, selected segments, source groups, guided source choice, and relevant transformations.

## Reconciliation

Reconciliation receives the same extracted and transformed values shown in Mapping samples. It preserves decisions for rows whose signatures have not changed, adds new mappings as pending rows, removes ignored rows, and resets only affected rows.

For Wikidata item lookups, the shared search utility searches both a comma-separated personal name and its normal display order, then deduplicates QIDs. Direct Wikidata links, authority/value-suggest values, literals, standalone URLs, dates, external IDs, and monolingual text use their appropriate reconciliation or validation paths.

## References and Export

References are detected from source URLs and may be assigned per Wikidata property. Export combines mapped properties, reconciled decisions, original item identifiers, and assigned references to generate QuickStatements. It retains final validation as a safeguard, while most user-facing correction should occur in Reconciliation.

## Deployment Boundary

The GitHub Actions deployment workflow copies `src/` into `docs/` on `main` and into branch subfolders for `dev` and `test`. Therefore:

- `src/` is deployable application source.
- `docs/` is generated GitHub Pages output, except for the maintained `docs/JS_MODULE_MAP.md` technical map.
- `documentation/` is the canonical authored documentation source.
