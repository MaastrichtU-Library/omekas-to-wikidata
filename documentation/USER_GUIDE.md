# User Guide

## What This Tool Does

Omeka S to Wikidata prepares Omeka S item metadata for [QuickStatements](https://quickstatements.toolforge.org/). It is a browser-based, five-step workflow:

`Input -> Mapping -> Reconciliation -> References -> Export`

The tool helps prepare data; review every proposed Wikidata match and the final QuickStatements before publishing changes to Wikidata.

## 1. Input

Enter an Omeka S `/api/items` URL, then fetch the data. The tool first tries a direct request and uses CORS fallbacks when the Omeka server does not permit browser access.

### Scope and pagination

Use a collection scope to work with a defined group of items:

- `resource_template_id`: items using one resource template.
- `item_set_id`: items in one item set.
- `site_id`: items associated with one Omeka site.
- `owner_id`: items created by one user.

Unscoped browsing defaults to page 1 with 25 items. A scoped request retrieves all matching pages by default. Turn on **Limit a selected scope to one page** when you want to inspect a particular page and page size instead.

### If API access fails

Use **Enter JSON manually**. The panel provides a link for the current items selection, so you can open its JSON in a browser, copy the response, and paste it into the tool.

For custom field labels, also paste matching resource-template JSON in the optional section. The panel supplies the resource-template API link when it can derive the Omeka S instance. This is particularly useful when a public API can be opened in a browser but cannot be requested by the application because of CORS.

Select the resource templates and items you intend to process, then continue to Mapping.

## 2. Mapping

Mapping decides which Omeka S values become Wikidata statements. A field does not need to be mapped merely because it was imported: only map it when you want to reconcile its values and send them to Wikidata.

### Start with the essentials

1. **Label**: choose the imported title or name field that should become the main Wikidata label.
2. **Instance of**: use the Omeka resource-template class as the starting point, or enter a type manually. The class label, not its numeric Omeka ID, is the value reconciled to Wikidata.
3. Optionally choose fields for **Description** and **Aliases**.

These four mappings have fixed Wikidata destinations, so their dialogs focus on choosing a suitable Omeka source rather than a generic Wikidata property.

### Map other fields

For every other field, choose the Wikidata property that describes the intended statement. The Entity Schema panel can keep required and optional properties visible while you map. Treat its suggestions as guidance: a source term such as `schema:provider` may mean a collection, publisher, or another relationship depending on the collection's data model.

The field list shows the Omeka template label prominently and the technical property term underneath. Search works with either name.

### Mixed values: segments and sources

One Omeka field can contain more than one kind of value. For example, an author field may contain literal text, a VIAF-backed value, and a Wikidata-backed value; a `sameAs` field may contain links from several services.

Use **Observed segments in this field** first. A segment is a reusable family of values, such as literal entries, one authority family, or URLs from a particular domain. This lets the same Omeka field be mapped more than once when different families should go to different Wikidata properties.

When a selected segment still contains several source kinds, **Value sources to include** appears as a secondary filter. The order is:

1. Literal entries
2. Standalone URL entries
3. ValueSuggest / authority-linked entries
4. Direct Wikidata-linked entries

The sample column is the source of truth for this choice. It shows up to five extracted values, their source badges, and active transformations. Change segment or source selections until these samples represent what you want to review in Reconciliation.

### Transformations

Use transformations only when an imported value needs a predictable adjustment before reconciliation or export, such as adding a prefix, removing a known fragment, or extracting an identifier. The sample preview updates as transformations are edited.

## 3. Reconciliation

Reconciliation turns mapped values into Wikidata-ready values. The table keeps mapped fields vertical and items horizontal, in the same field order as Mapping. Label and Instance of remain first.

Each value shows a source badge, for example `Literal`, `ValueSuggest: VIAF`, or `Wikidata`. This explains which part of the Omeka value is being reconciled without exposing raw implementation details.

### Reviewing entity matches

- Click a suggested result to select it.
- Click a QID to open that item in Wikidata for verification.
- Press `1` to `9` to select the matching visible result by its number.
- Press `I` to skip the current value.
- Use **Apply this choice to identical values in this row** when the same value occurs repeatedly in the mapped field.

The tool also tries a safe name-order variant for personal names. A value such as `Titsingh, Isaac` is searched as entered and as `Isaac Titsingh`; duplicate QIDs are merged.

Choose a default label language when the imported labels share one language. You can return to Mapping to add, ignore, or adjust fields; unchanged reconciled rows are retained, while changed mappings are refreshed.

## 4. References

Wikidata statements should state where the information came from. This step detects useful source links, including Omeka item URLs, OCLC WorldCat links, ARK identifiers, and compatible `sameAs` links.

Assign detected reference types to the mapped properties they support. Add a custom reference when the collection uses another stable source URL. Keep this step lightweight: it adds evidence to the statements produced by the Mapping and Reconciliation work rather than acting as a separate item designer.

## 5. Export

Export generates QuickStatements from the imported data, mappings, reconciliation decisions, and assigned references. The export performs a final format check, but resolve validation warnings in Reconciliation whenever possible.

Review the generated text, then copy it, download it, or open QuickStatements. Start with a small, representative batch or the Wikidata sandbox before applying a larger import.

## Practical Checklist

Before export, check that:

- The selected items are the intended Omeka S scope.
- Label and Instance of are meaningful for every item.
- Mapping samples show the value families you actually want to send.
- Important entity matches were verified through their QID links.
- Dates and external identifiers have no unresolved validation warnings.
- References are assigned where your data requires provenance.
- The generated QuickStatements are reviewed before submission.
