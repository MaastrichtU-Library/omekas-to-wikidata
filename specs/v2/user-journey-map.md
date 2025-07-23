# 🧭 Proposed User Flow Structure

## PHASE 0: Getting Started

### Step 0 – Load / Start Project
This is the entry point, where the tool determines whether:
- The user starts a new project (via UI or pre-filled URL).
- Or loads a saved project (from browser cache or imported file).

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
- Allow additions like:
  - Fixed values (e.g. "instance of museum")
  - Split mappings (map one input property to multiple Wikidata ones)

### Step 4 – Define Property Settings
- For each mapped property:
  - Expected value type (QID, string, date…)
  - Qualifiers (e.g. language tags)
  - References required?
- Auto-fill these from Wikidata property constraints + schema when available.
- Let user override or refine.

---

## PHASE 3: Clean and Preprocess Values

### Step 5 – Data Cleaning & Transformation
- Operates per property (not per record).
- Features:
  - Find & replace / remove
  - RegEx tools for advanced users
  - Highlight Wikidata regex constraints to validate values
  - Preview effect on multiple records
- Helpful for monolingual strings, URLs, bad formatting, etc.

---

## PHASE 4: Reconciliation

### Step 6 – Reconcile Items (Entity-Level)
- Check if each record already exists in Wikidata
- Reconciliation API helps match
- If match found: choose action:
  - Ignore new
  - Add to existing
  - Replace existing
  - Merge and reuse references
- Let user define bulk default for known duplicates.

### Step 7 – Reconcile Values (Statement-Level)
- For each property:
  - Match to Wikidata items if value type is QID
  - Auto-match with reconciliation API
  - Allow user override:
    - Pick from suggestions
    - Manually set QID
    - Add monolingual language tag
    - Reuse references if available
- Allow batch reconciliation for identical values across records.

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