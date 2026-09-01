# 🧭 Proposed User Flow Structure

## PHASE 0: Getting Started

### Step 0 – Load / Start Project
This is the entry point, where the tool determines whether:
- The user starts a new project (via UI or pre-filled URL).
- Or loads a saved project (from browser cache or imported file).
- URL parameters can pre-configure source and skip directly to Step 1.
- Browser cache auto-suggests reloading previous session.

**Substeps (conditional UI):**
- Confirm source URL or API endpoint.
- Show metadata preview (source type, number of records, etc.).
- Possibly configure endpoint parameters here.

---

## PHASE 1: Understanding and Preparing the Data

### Step 1 – Choose Data Source
- User provides a front-end URL or OmegaS API endpoint.
- Tool resolves this to a data feed and previews record count, structure, etc.
- Optional: advanced controls to tweak the API query.

### Step 2 – Load Existing Resources (Optional)
- Select existing property mappings and/or entity schemas to speed up work.
- Allow multiple resources to be merged (mapping + schema).
- Show preview of what the mappings/schema will affect.

---

## PHASE 2: Map the Structure

### Step 3 – Map Properties to Wikidata
- Show all linked data properties found.
- Allow user to confirm or correct auto-mapped Wikidata properties.
- Include pseudo-properties like label and description.
- Mandatory mappings: 'label' pseudo-property always present.
- Requires at least one 'instance of' or 'subclass of' fixed value.
- Allow additions like:
  - Fixed values (e.g. "instance of museum")
  - Split mappings (map one input property to multiple Wikidata ones)
  - One input property can map to multiple (2+) Wikidata properties

### Step 4 – Define Property Settings
- For each mapped property:
  - Expected value type (QID, string, date…)
  - Qualifiers (e.g. language tags)
  - References required?
- Auto-fill from Wikidata property constraints AND entity schemas.
- Entity schemas can define required references.
- Let user override or refine.

### Step 4.5 – Reference Configuration
- Define references for entire items or specific properties.
- Track reference origins (e.g., from source URL).
- Configure reference reuse within items.
- Set reference values per item.
- References unique to items but reusable across properties within same item.

---

## PHASE 3: Clean and Preprocess Values

### Step 5 – Data Cleaning & Transformation
- Property-centric view (all values for one property at once).
- Features:
  - Find & replace / remove
  - RegEx tools for advanced users
  - Shows Wikidata regex constraints for validation feedback
  - Preview effect on multiple records
- Helpful for monolingual strings, URLs, bad formatting, etc.
- Value type constraints actively guide user input.

---

## PHASE 4: Reconciliation

### Step 6 – Duplicate Search / Item Reconciliation
- Check if each record already exists in Wikidata
- Reconciliation API helps match
- If match found: choose action:
  - Ignore new item/value
  - Replace existing with new
  - Add new alongside existing
  - Merge (reuse references only)
- Let user define bulk default for known duplicates.
- Apply choice as default to all existing items.

### Step 7 – Reconcile Values (Statement-Level)
- For each property:
  - Match to Wikidata items if value type is QID
  - Auto-match with reconciliation API
  - Allow user override:
    - Pick from suggestions
    - Manually set QID
    - Add monolingual language tag
    - Direct string editing for individual values
    - Reuse references if available
- Batch apply reconciliation to all identical values.
- Value type constraints guide valid selections.
- Option to add references to existing statements even if value is ignored.

---

## PHASE 5: Final Review & Export

### Step 8 – Quality Control & Review
- Preview final statements: subject → property → value
- Show qualifiers, references
- Highlight errors, missing values, unconfirmed mappings
- Optional filters: show only warnings/errors

### Step 9 – Export to QuickStatements
- Compile confirmed data into QuickStatements syntax
- Offer:
  - Copy/paste
  - Download
  - Link to QuickStatements UI preloaded
- Remind user to save/export project state

---

## 🔄 Global Features Across All Steps
- Project Autosave to local storage
- Manual Save/Export of project config (for later reuse or sharing)
- Undo/Redo, step history
- Help / Tooltips contextual for each step
- Non-linear Navigation (with warning dialogs if prerequisites are missing)