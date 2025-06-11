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
