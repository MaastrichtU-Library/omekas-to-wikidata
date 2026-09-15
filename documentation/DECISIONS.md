# Product Decisions

This record captures active product decisions. It explains the current direction; it is not a replacement for the historical specifications in `archive/`.

## Five-Step Workflow

**Decision:** the product flow is `Input -> Mapping -> Reconciliation -> References -> Export`.

**Why:** imported metadata should be shaped and understood before users review Wikidata matches. References then provide provenance for statements, and Export remains a final generation and safety step.

## Mapping and Reconciliation Are the Core

**Decision:** invest most interaction design and capability in Mapping and Reconciliation.

**Why:** these steps determine which Omeka data becomes Wikidata statements, how mixed values are separated, and how values are matched or corrected. A good result here minimizes downstream manual work.

## No Standalone Item Designer

**Decision:** do not revive the earlier Step 4 Item Designer as the default direction.

**Why:** its intended responsibilities are now better located in Mapping, Reconciliation, References, and Export. Step 4 remains lightweight and source-focused.

## Generic Omeka Value Handling

**Decision:** use generic, dataset-driven segment families and source provenance rather than endpoint-specific rules.

**Why:** Omeka S fields can mix literals, URLs, authority values, and direct Wikidata links. The tool must work across institutions and templates, not only known Radboud or Maastricht patterns.

## Manual JSON Is a First-Class Fallback

**Decision:** manual JSON import should retain the same downstream functionality as API import where data permits.

**Why:** public Omeka S APIs may be blocked by browser CORS even when users can open their JSON. Optional resource-template JSON restores custom field labels and datatype context when automated enrichment is unavailable.

## Validation Belongs Close to Correction

**Decision:** validate values as early as possible in Reconciliation, with Export as a final guard.

**Why:** users can understand and correct dates, identifiers, languages, and URLs more easily where the original value and property context are visible.

## Documentation Is Versioned Source

**Decision:** authored documentation lives in `documentation/` and moves through `dev -> test -> main` with the application.

**Why:** `docs/` is deployment output and can be regenerated. Current manuals need a stable, reviewable source location; historical project material remains in `archive/`.
