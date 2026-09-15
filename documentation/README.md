# Project Documentation

This folder is the authored, current documentation for Omeka S to Wikidata. It is versioned with the application and follows the normal `dev -> test -> main` release path.

The repository's `docs/` folder is generated deployment output for GitHub Pages. Do not use it as the source location for manuals or project records. The maintained JavaScript module map is the one technical exception and remains at `docs/JS_MODULE_MAP.md` because project conventions require that path.

## Current Guides

- [User Guide](USER_GUIDE.md): use the five-step application workflow.
- [Developer Guide](DEVELOPER_GUIDE.md): set up the project, make changes, and work with the branches.
- [Architecture](ARCHITECTURE.md): understand the client-side design and the Mapping/Reconciliation data model.
- [Testing and Release](TESTING_AND_RELEASE.md): choose tests and promote a release safely.
- [Product Decisions](DECISIONS.md): understand the current product direction and important trade-offs.

## Historical Material

Older specifications and explorations are preserved in [`../archive/`](../archive/README.md). They are useful context, but do not describe the current product by default.
