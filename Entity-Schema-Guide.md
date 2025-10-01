# A Practical Guide to Wikidata Entity Schemas

**[← Back to Technical Documentation](DOCUMENTATION.md)**

**TL;DR:** Wikidata Entity Schemas are written in ShExC (Shape Expressions). Each schema defines a "start" shape and one or more helper shapes. Triples are constrained with `wdt:` (simple statements) or `p:/ps:/pq:` (full statement nodes with qualifiers/references). Cardinalities (`? * + {m,n}`) tell you what's required. IRI, rdf:langString, xsd:*, value sets like `[ wd:Q… ]`, and references to other shapes (`@<Name>`) specify what's allowed. Read a schema by (1) noting the prefixes, (2) finding `start = @<…>`, (3) scanning required vs optional constraints, (4) noticing whether the schema is CLOSED or uses EXTRA, and (5) understanding where qualifiers are modeled with separate shapes.

**Compare:** E473/E487 specialize edition/translation models to items held in specific library collections (Maastricht / Radboud) using p:P195 and an inventory-number qualifier; E476 models manuscripts with similar collection/inventory patterns; E488 (incunable) is the same pattern but restricted to incunabula (15th-century prints), often with extra identifiers like ISTC. Use the "check entities" link on each schema to validate items; use the sample SPARQL shown on the schema page to discover candidates.

---

## 0. What Entity Schemas Are (in Wikidata terms)

- **Entity Schemas** live in the EntitySchema namespace and are identified by E###. They store ShExC (compact Shape Expressions) used to document and validate how a class of items should be modeled on Wikidata.
- Wikidata has community guidance and a directory listing lots of schemas; your targets (E473, E487, E476, E488) are part of that ecosystem.

## 1. The Mental Model of ShExC You Need 95% of the Time

### Basic Components

- **Prefixes:** Lines like `PREFIX wdt: …`, `wd: …`, `p:/ps:/pq: …` map short names to IRIs.
- **Start shape:** `start = @<shapeName>` marks the entry point.
- **Shapes:** Named like `<#edition_of_a_written_work> { … }`.
- **Triple constraints:** `wdt:P31 [ wd:Q3331189 ] + ;` means "must have one or more P31 whose value is that Q-item."

### Cardinality

- `?` = 0–1
- `*` = 0–∞
- `+` = 1–∞
- `{m,n}` = exact/ranged

### Node Constraints

- **IRI**, **rdf:langString**, **xsd:dateTime**, **xsd:string**, etc.

### Values

- **Value set:** `[ wd:Q… wd:Q… ]` enumerates allowed items.
- **Shape reference:** `@<OtherShape>` means the value must itself satisfy another shape.

### Statement Nodes vs Direct Values

- **`wdt:P…`** = the direct (simplified) property (no qualifiers).
- **`p:P…`** opens the statement node so you can validate qualifiers (`pq:…`) and the main value (`ps:…`). Use `p:/ps:/pq:` whenever qualifiers/ref modeling matters (inventory numbers, roles, etc.).

### Permissiveness

- **`CLOSED { … }`** = only properties you listed are allowed.
- **`EXTRA wdt:P31 p:P195 { … }`** = allow those extra predicates beyond what you explicitly constrain (handy on Wikidata where items often have "extra" statements).

## 2. How to Read Any Schema Quickly (Checklist)

1. **Find the start shape** and skim its block.
2. **Underline required bits:** any line with `+` or without `?/*/{…}` is mandatory.
3. **Mark statement-node sections:** anything using `p:/ps:/pq:` defines how qualifiers must be modeled.
4. **Note EXTRA or CLOSED:** tells you how strict validation will be.
5. **Follow shape references** (`@<…>`) to understand embedded structures (e.g., collection statements).
6. **Use the schema's SPARQL hint** (they're included as comments on many Wikidata schemas) to find candidate items, then click the "check entities against this Schema" link on the page to validate.

---

## 3. When to Use Which Schema

**E473 (Maastricht University Library)**
- Items held in Maastricht University Library collections
- Requires P195 → Maastricht University Library + optional P217 inventory number
- Use for editions/translations in Maastricht collections

**E487 (Radboud University Library)** 
- Items held in Radboud University Library collections
- Same pattern as E473 but for Radboud collections
- Use for editions/translations in Radboud collections

**E476 (Manuscript)**
- Handwritten documents, illuminated manuscripts
- Use for any manuscript regardless of collection
- Includes collection/inventory patterns if held by institutions

**E488 (Incunable)**
- Printed works before 1501
- Often includes ISTC identifiers (P6494)
- Use for pre-1501 printed books, regardless of collection

## 4. How Entity Schemas Connect to Omeka S Mapping (Planned Integration)

Entity Schemas are intended to improve the Omeka S to Wikidata mapping process by:
- **Providing property suggestions** based on the selected schema
- **Indicating required vs. optional fields** for validation
- **Guiding the mapping process** with schema-specific constraints

*Note: This integration is planned but not yet implemented in the current tool.*

---

## 5. Your Four Example Schemas, Decoded

### E473 — "Edition or Translation, Maastricht University Library" (Collection-Specific)

**Goal:** Constrain editions held by a specific institution (Maastricht University Library = wd:Q15734302).

**Key characteristics:**
- Requires P31 = edition and at least one collection statement: `p:P195 @<CollectionStatementUM> +`
- The helper shape `<CollectionStatementUM>` is a statement-node rule:
  - `ps:P195 [ wd:Q15734302 ]` — the collection value must be Maastricht University Library
  - `pq:P217` — optional inventory number as a qualifier on that same statement
- Keeps a large set of optional bibliographic fields (title, language, publisher, P629 link to the work, IIIF manifest, etc.)
- Uses `EXTRA wdt:P31 p:P195` → the item may also have other P31 and P195 statements without failing validation

**Takeaway:** E473 models editions held in Maastricht University Library, with required collection statements and optional inventory numbers. This pattern—institution-scoped editions—is exactly what you'll see mirrored for other repositories.

---

### E487 — "Edition or Translation, Radboud University Library" (Collection-Specific, Analogous to E473)

**What to expect:** The same pattern as E473 but with the collection fixed to Radboud University Library (the RADBOUD collection item) in the `ps:P195` position, and optional `pq:P217` inventory numbers. You'll again see a `p:P195` statement shape for qualifiers and the same bibliographic fields as optional `wdt:` lines.

**Why I'm asserting this:** E473 is explicitly scoped to Maastricht via `ps:P195 [wd:Q15734302]`. The Radboud schema is the same modeling idea for a different library. This specialization approach is standard practice in Wikidata schemas for GLAM collections.

**Practical use:** If you have an edition item you know is held at Radboud, make sure its collection (P195) statement targets the Radboud collection item and—if you have it—add P217 as a qualifier on that P195 statement. That will satisfy the collection-specific shape.

---

### E476 — "Manuscript"

**Goal:** Model manuscripts (handwritten, sometimes illuminated).

**Must-haves:** P31 one of `[ manuscript | illuminated manuscript ]` (at least one).

**Optional bibliographic bits:** Image, titles (`rdf:langString`), contributors (author/editor/illustrator), inception (`xsd:dateTime`), language, access URLs, rights, IIIF, catalog IDs, etc.

**Collection/inventory pairing:** Exactly the same statement-node pattern as E473:
- `p:P195 @<CollectionStatement>*` and `p:P217 @<InventoryNumberStatement>*`, so a manuscript can be modeled either from the collection side (with an P217 qualifier) or from the inventory number side (with a P195 qualifier)

**Permissiveness:** `EXTRA wdt:P31` etc., so the item can have more data without failing.

**Pattern to notice:** Items in a collection → qualify P195 with P217; items identified by inventory number → qualify P217 with P195. E476 encodes both; that design is reusable.

---

### E488 — "Incunable"

**What "incunable" means in modeling:** Printed works before 1501. On Wikidata they usually get P31 = incunable and commonly carry ISTC identifiers (P6494), plus the same library collection/inventory modeling (P195 with P217 qualifier) and often IIIF manifests.

**Schema expectations:** An incunable schema is typically the E476/E473 pattern with the P31 constraint set to incunable, and bibliographic/identifier lines (ISTC, maybe GW, etc.). If your E488 page follows current practice, expect:
- `wdt:P31 [ wd:<incunable> ] +`
- Optional bibliographic fields (P1476, P1680, P50, P577, P407, etc.)
- `p:P195` statement shape with optional `pq:P217`
- Optional `wdt:P6108` (IIIF), `wdt:P973/953` (URLs), and `wdt:P6494` (ISTC)

**Why this is consistent:** You can see incunable holdings and metadata style on many library items, and the collection/inventory pattern is now standard across the GLAM-oriented schemas.

---

### E36 — "Edition of a Written Work" (Generic Reference Model)

**Brief overview:** E36 provides a generic baseline model for edition/translation records without collection-specific constraints. It includes core bibliographic fields (P31=edition, P629 link to work, publisher, publication date, titles, languages) using direct `wdt:` statements. While not actively used in this project, E36 serves as the foundational pattern that collection-specific schemas like E473/E487 build upon.

---

## 4. wdt: vs p:/ps:/pq: — When to Use Which

- **Use `wdt:`** for direct values (titles, dates, linked entities) when qualifiers/references don't matter for validation.
- **Use `p:`** (with `ps:/pq:`) when you need to validate qualifiers on a statement (e.g., P195 with P217 inventory number; P2868 "subject has role/collection highlight" on a P195 statement; edition-specific roles).
- You'll see this clearly in E473/E476 where collection + inventory live inside helper shapes that constrain the statement node.

## 5. Cardinalities and Common Datatypes You'll See

### Cardinalities
- `+` = required (≥1)
- `?` = optional single
- `*` = optional repeatable
- `{m,n}` = exact bounds

### Common Datatypes
- **Strings:** `xsd:string` (plain), `rdf:langString` (with language tag) — titles/subtitles are often `rdf:langString`
- **Numbers:** `xsd:integer`, `xsd:decimal`
- **Dates:** `xsd:dateTime` (how WDQS exports time values)
- **Links:** `IRI` for values that must be items/URIs

## 6. "EXTRA" and "CLOSED"

- Wikidata items often carry more statements than your model lists.
- **EXTRA** lets you specify which extra predicates can appear without failing validation; E473/E476 use it to be practical.
- Reserve **CLOSED** when you want strict conformance (useful for tightly curated datasets but can be hostile to organic Wikidata growth).

## 7. Validating and Discovering Data

- Every schema page has a **"check entities against this Schema"** link to the ShEx2 Simple Online Validator. Paste Q-IDs or a SPARQL result set to validate.
- Many schemas include a commented SPARQL snippet you can run on WDQS to find candidates. E473/E476/E487 show examples (e.g., "items with P31=edition" or "items with P31=edition and P195=MU Library").
- If you're modeling incunabula, add filters like `wdt:P6494` (ISTC).

## 8. How the Wikidata Flavor of ShEx Differs from Generic Docs

- You'll see heavy use of `wdt:` and `p:/ps:/pq:` prefixes that mirror Wikidata's RDF export model (direct vs reified statements). Generic ShEx primers don't talk about those prefixes specifically; Wikidata's extension embraces them.
- Wikidata schemas are typically documentation + validation: e.g., E473/E487 encode local GLAM constraints (which collection) while staying permissive about other fields; E476/E488 provide models for specific document types.

## 9. Typical Pitfalls (and How to Avoid Them)

- **Forgetting qualifiers:** If a schema expects P217 as a qualifier on the P195 statement, adding P217 as a top-level `wdt:P217` will fail validation. Use `p:P195/ps:P195 … ; pq:P217 ….` (See `<CollectionStatementUM>` in E473 and the analogous shapes in E476.)
- **Wrong datatypes:** P577 must match `xsd:dateTime` in the RDF; titles are `rdf:langString`, not bare strings.
- **Over-strict models:** Using CLOSED without need makes many real items fail. Prefer EXTRA for evolving datasets.
- **Mixing "work" vs "edition":** Edition schemas expect P629 to link to the work. Model the work (authors, series) separately from the edition (publisher, publication date, ISBN).

## 10. Reading Your Examples Line-by-Line (A Compact "Decoder Ring")

### E473 (MU Library Edition)
- `EXTRA wdt:P31 p:P195` → don't fail on extra classification/collection statements.
- `wdt:P31 [wd:Q3331189] +` → must be an edition.
- `p:P195 @<CollectionStatementUM> +` → must have at least one P195 statement that (a) points to MU Library and (b) may carry an P217 inventory number qualifier.
- Optional bibliographic fields (title, language, publisher, P629 link to work, etc.)

### E487 (Radboud Edition)
- Same as E473 but `ps:P195` fixed to Radboud University Library instead of MU. (Check E487 to see the exact Q-ID.)

### E476 (Manuscript)
- `wdt:P31 [wd:Q87167 wd:Q48498] +` → must be manuscript or illuminated manuscript.
- Bibliographic, rights, and access fields as optional `wdt:`.
- Two helper statement shapes so you can validate collection→inventory and inventory→collection directions.

### E488 (Incunable)
- Expect the manuscript/edition pattern, but with P31 = incunable and common identifiers (e.g., ISTC P6494). Also expect the same collection/inventory statement-node shape(s).

## 11. Handy References & Where to Click Next

- **E473 (MU Library edition)** — Collection-specific edition model with inventory qualifier patterns.
- **E487 (Radboud edition)** — Same pattern as E473 but for Radboud University Library.
- **E476 (manuscript)** — Manuscript model with collection/inventory patterns.
- **E488 (incunable)** — Pre-1501 printed works with ISTC identifiers.
- **Schemas overview (Wikidata)** and **WikiProject Schemas** — context, tutorials, directory.
- **ShExC primers** — the language behind all of this.
- **ISTC property** — incunable identifier (P6494).

## 12. If You Want to Build or Adapt One

- Start from E473's pattern for collection-specific editions; use E476's approach for manuscripts and other document types.
- Keep schemas permissive with EXTRA for widely-used classes (let organic data grow).
- Encapsulate qualifier logic in helper shapes (like `<CollectionStatement…>`).
- Add commented SPARQL to help others discover items to validate (see E473/E476/E487).

---

*If you want, I can draft an E487-like schema for Radboud (or refine E488 for incunabula) and tailor the helper shapes to the way you record roles (e.g., "collection highlight" as a qualifier) and access (IIIF, full-text URLs).*