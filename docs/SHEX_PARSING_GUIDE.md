# ShEx Parsing Guide: Converting ShExC to ShExJ

**[← Back to Technical Documentation](../DOCUMENTATION.md)**

**TL;DR**: Use @shexjs/parser in the browser to parse ShExC → ShExJ, passing a base IRI and (optionally) preloaded Wikidata prefixes. Wrap it in a Web Worker, validate/canonicalize with @shexjs/util, and (optionally) resolve IMPORT via @shexjs/loader. Add good DX: precise error surfaces (line/col), round-trip tests, caching by content hash, and TypeScript types. ShExJ is JSON-LD, so you can attach the official @context.

---

## Goal & Assumptions

You want a robust, entirely in-browser path from Wikidata EntitySchema (ShExC) to a plain JS object (ShExJ). Wikidata stores schemas in ShExC; our output is the ShEx JSON dialect (ShExJ / JSON-LD).

## Core Approach (minimal, reliable)

1. **Library**: @shexjs/parser — directly parses ShExC and returns ShExJ. It supports:
   - Base IRI to resolve relative IRIs.
   - Preloaded prefixes to supplement what's in the schema (useful for Wikidata).
   - An index option that exposes ._base, ._prefixes, and ._index metadata for downstream tooling.
2. **Output**: ShExJ (JSON-LD). You may add {"@context":"http://www.w3.org/ns/shex.jsonld"}; @shexjs/util has helpers to attach/remove internal indices and contexts.
3. **Validation & sanity checks** (optional but recommended):
   - @shexjs/util.isWellDefined(schema) to catch refs/negation issues.
   - @shexjs/util.canonicalize(schema) to stable-order/canonicalize for testing/diffs.

## Minimal Conversion Function (TypeScript)

```typescript
import Parser from "@shexjs/parser";
import * as ShexUtil from "@shexjs/util";

export type ShExJ = any; // or author a ShExJ type, see notes below.

export interface ConvertOptions {
  baseIRI?: string;                       // used to absolutize relative IRIs
  prefixes?: Record<string, string>;      // extra prefixes (e.g., Wikidata)
  wantIndex?: boolean;                    // expose _index/_base/_prefixes
  attachContext?: boolean;                // attach ShEx JSON-LD @context
  runSanityChecks?: boolean;              // isWellDefined + canonicalize
}

export function shexcToShexj(
  shexc: string,
  opts: ConvertOptions = {}
): ShExJ {
  const { baseIRI, prefixes, wantIndex, attachContext, runSanityChecks } = opts;
  const parser = (Parser as any).construct(
    baseIRI ?? undefined,
    prefixes ?? undefined,
    wantIndex ? { index: true } : undefined
  );

  const shexj: ShExJ = parser.parse(shexc);

  if (runSanityChecks) {
    if (!ShexUtil.isWellDefined(shexj)) {
      throw new Error("Schema is not well-defined (unresolved refs/negation).");
    }
    ShexUtil.canonicalize(shexj);
  }

  if (attachContext) {
    // Adds @context and removes internal indices if present:
    // ShExAStoJ removes _index/_prefixes and adds @context if absent.
    return (ShexUtil as any).ShExAStoJ(shexj);
  }

  return shexj;
}
```

## Why This Works

- @shexjs/parser.construct().parse(text) is the supported path from ShExC → ShExJ, with base IRI, preloaded prefixes, and index metadata.
- ShExJ is the official JSON form; it's JSON-LD.
- @shexjs/util provides the sanity checks and transformations we need.

## Handling Wikidata Specifics (recommended)

- **Prefixes**: Many Wikidata schemas rely on implicit prefixes. Supply a curated default map via the prefixes arg (e.g., wd:, wdt:, p:, ps:, pq:, psv:, pqv:, wdno:, wikibase:, wdata:, schema:, rdf:, rdfs:, xsd:). This lets the parser resolve CURIEs even if the schema omits them. (The parser supports preloaded prefixes out-of-the-box.)
- **Base IRI**: Use a stable base (e.g., the EntitySchema URL) so relative IRIs become absolute and reproducible. The parser documents how base affects resolution.

## IMPORT Resolution (optional / advanced)

If you want full import resolution (i.e., merge the imported shapes):

- Prefer @shexjs/loader in the browser; it knows how to load ShExC/JSON schemas and handle IMPORT and relative IRIs (it's how the official webapp does it). You'll need to provide fetch (the browser's is fine).
- **Strategy**:
  1. If your input is a URL, pass it straight to the loader.
  2. If your input is a string, either:
     - publish it as a Blob URL (to give the loader a base), or
     - manually detect IMPORT <...> IRIs, fetch them, and merge with @shexjs/util.merge.
- The repo shows that the loader accepts arrays of ShExC sources and supports import demos (proving it resolves them).

## Runtime Architecture (robust UX)

- **Web Worker**: Parsing is fast, but large schemas/IMPORT chains can jank the UI. Run conversion in a Worker; communicate via postMessage, transfer only strings/objects.
- **Deterministic caching**: Cache by content hash (e.g., SHA-256 of the ShExC and base/prefix inputs) in IndexedDB. If resolving IMPORT, cache each fetched dependency by resolved absolute URL + ETag/Last-Modified.
- **Fail-soft error surfaces**:
  - Catch parse exceptions; surface line/column (parser errors include positions).
  - Show the offending line with a caret; offer a "copy minimal repro" button.
  - Include a diagnostic that lists missing prefixes if CURIE resolution fails.
- **Security**:
  - Don't execute semantic actions/extensions; you're only parsing.
  - Treat all inputs as untrusted; avoid DOM injection when rendering error messages.
  - Privacy: Default to no network. Only hit the network if the user selects "Resolve IMPORTs" and your code finds them.

## TypeScript & Types

- @shexjs/parser ships TS types; you can type the return as a ShExJ Schema shape if desired, or define your own ShExJ type from the spec. @shexjs/util.ShExJtoAS / ShExAStoJ helps when you want to move between internal/JSON-LD forms.
- ShExJ is JSON-LD; adding the official @context can make downstream JSON-LD tooling happier.

## Packaging for the Web (Vite/Webpack/Rollup)

- The parser is small and browser-friendly. Import it directly; no polyfills typically needed. Keep @shexjs/* packages in a separate chunk (code-split) so your main UI loads fast.
- If you add @shexjs/loader (for IMPORT), that may bring in Turtle parsing (n3) for data paths; use modern ESM builds and tree-shaking to keep bundles lean. The official repo shows how the webapp wires the loader.

## Test Strategy (confidence building)

1. **Golden tests**: ShExC → ShExJ, compare against checked-in JSON. Use canonicalize to avoid ordering noise.
2. **Round-trip**: ShExC → ShExJ → ShExC (via @shexjs/writer) and normalize whitespace; assert equivalence.
3. **Real-world**: Pull a few live Wikidata EntitySchemas (e.g., from the directory) and ensure they parse under your default prefixes/base, then again with "Resolve IMPORTs".
4. **Fuzz/edge cases**: Empty schemas, only START, many nested eachOf/oneOf, negation, relative IRIs, missing prefixes, Unicode IRIs.
5. **Perf smoke**: Large schemas under a threshold (e.g., <100 ms parse on your target device in a worker).

## Nice-to-have Developer Features

- Schema info panel using ._index and ._prefixes (when wantIndex is set) to help users navigate shapes/predicates.
- "Wikidata mode" toggle that injects a known prefix set and sets base IRI to the EntitySchema URL.
- Download buttons: "Save as ShExJ (.json)" or "Copy JSON-LD".
- Diff view: compare canonicalized outputs across edits.

## Example: Robust End-to-end Flow

```javascript
// UI → Worker API
type Job = {
  shexc: string;
  mode: "parse-only" | "parse-with-imports";
  baseIRI?: string;
  prefixes?: Record<string, string>;
  attachContext?: boolean;
  wantIndex?: boolean;
  runSanityChecks?: boolean;
};

// in worker:
self.onmessage = async (e: MessageEvent<Job>) => {
  try {
    const { shexc, mode, baseIRI, prefixes, attachContext, wantIndex, runSanityChecks } = e.data;

    // 1) Parse directly
    let shexj = shexcToShexj(shexc, { baseIRI, prefixes, attachContext, wantIndex, runSanityChecks });

    // 2) Optionally resolve IMPORTs via loader (only if requested)
    if (mode === "parse-with-imports") {
      // If you have a URL source, pass it straight to the loader.
      // If you only have text, publish a Blob URL to give it a base:
      const blob = new Blob([shexc], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const { default: ShExLoaderCtor } = await import("@shexjs/loader");
      const ShExLoader = (ShExLoaderCtor as any)({ fetch: fetch }); // browser fetch
      const loaded = await ShExLoader.load({ shexc: [url] }, null);
      shexj = loaded.schema; // fully merged, imports resolved
      URL.revokeObjectURL(url);
    }

    // 3) Optional final canonicalization for deterministic output
    // (this mutates in-place)
    // ShexUtil.canonicalize(shexj);

    postMessage({ ok: true, shexj });
  } catch (err: any) {
    // Normalize error to include line/col if available
    postMessage({ ok: false, error: err?.message ?? String(err) });
  }
};
```

## Pitfalls & How to Avoid Them

- **Relative IRIs**: Always pass a meaningful baseIRI to avoid environment-dependent results.
- **Missing prefixes**: Supply Wikidata defaults; highlight undefined prefixes in error UI. The parser supports preloaded prefixes.
- **IMPORT surprises**: The parser parses imports but doesn't fetch/merge; if you need resolved schemas, use the loader as shown.
- **Order instability**: Canonicalize before snapshot tests/diffs.
- **Context confusion**: ShExJ is JSON-LD; attach the standard @context if consumers expect JSON-LD documents.

## References (key capabilities)

- @shexjs/parser: ShExC → ShExJ; base IRI, preloaded prefixes, index option.
- ShExJ spec/primer: JSON-LD structure and semantics.
- @shexjs/util: isWellDefined, canonicalize, ShExJtoAS/ShExAStoJ, merging, dependency graph.
- @shexjs/loader & shex.js repo: import resolution and browser usage examples.
- Wikidata uses ShExC for EntitySchemas (context).

---

If you want, I can drop in a compact Wikidata-preset prefix map and a ready-to-use Worker file scaffold (Vite-friendly) next.