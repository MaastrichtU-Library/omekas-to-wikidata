# Q&A Brain Dump

## How This Works

This document serves as a comprehensive knowledge base for clarifications and design decisions. Each question and answer pair is numbered sequentially to create a structured reference that can be used for development guidance and documentation improvements.

The questions address various aspects of the process including workflow behavior, user experience patterns, technical implementation details, and edge case handling. Answers provided here represent authoritative decisions that should guide the implementation and future development of the features.

## Questions and Answers

### 1. Reconciliation Modal Display Strategy

**Question:** When a user clicks on a cell in the reconciliation table, should the modal show ALL possible reconciliation suggestions at once, or should it show the top 3-5 suggestions with an option to "search for more"?

**Answer:** Show suggestions with 80%+ confidence scores if there are multiple matches at that level. If no suggestions are above 80%, display the top 3 best matches. Users should have easy access to view all reconciliation options, not just the top suggestions.

### 2. Reconciliation State Persistence and Auto-Selection

**Question:** If a user reconciles "John Smith" to Q12345 in one cell, should the system automatically suggest Q12345 when "John Smith" appears in other cells, or should each cell be reconciled independently?

**Answer:** The system should automatically apply the same reconciliation (Q12345) to all cells containing identical original JSON values ("John Smith"). Additionally, when reconciliation confidence is 100%, the match should be automatically selected. No confirmation dialogs are needed at any point since users can always edit or change any reconciliation decision if it's incorrect.

### 3. Step Completion Requirements

**Question:** What exactly needs to be completed in each step before a user can proceed to the next? For example, does every mappable property need to be either mapped or explicitly ignored before proceeding to reconciliation?

**Answer:** For each field that requires reconciliation to a Wikidata item, users must choose one of three options: 1) Select an existing Wikidata item (QID) for direct reconciliation, 2) Create a new Wikidata item first and then reconcile to the newly created QID, or 3) Mark as "Ignore" (field will not be included in export).

### 4. Entity Creation Workflow

**Question:** When a user clicks "Create new Wikidata item", should this open Wikidata in a new tab and then require the user to manually enter the Q-ID back into the tool, or should there be some integration to detect when they return?

**Answer:** "Create new item" opens Wikidata's item creation page in a new tab. This is a completely manual process - users must create the item on Wikidata themselves and then copy-paste the new QID back into the search field in our tool. If technically feasible, the tool can pre-populate the label field on Wikidata since this value is already available from the Omeka S item.

### 5. Property-Specific Reconciliation Filtering

**Question:** For different property types (P50 for authors vs P131 for locations), should the reconciliation search be filtered to only show entities of the appropriate type (humans vs geographic locations)?

**Answer:** Yes, reconciliation should be property-aware. Values being reconciled should be coherent with the property they're being added to (e.g., humans for author properties, geographic locations for location properties). This filtering should be included in the reconciliation API request to improve result relevance and reduce user confusion.
