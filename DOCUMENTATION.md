# Technical Documentation

This page serves as a hub for all technical and developer documentation. For general project information and usage instructions, see [README.md](README.md).

## Core Documentation

### [README.md](README.md)
General project documentation including:
- Project overview and purpose
- How to use the tool (live demo links)
- 5-step workflow explanation
- Load/save mapping functionality
- CORS proxy system for Omeka S integration

### [CLAUDE.md](CLAUDE.md)
Development conventions and workflow for contributors:
- JavaScript module navigation
- Workflow and git procedures
- GitHub issues management system
- Code quality guidelines (JavaScript, HTML/CSS, modules)
- UI component creation patterns
- State management conventions
- Testing setup and Playwright E2E testing
- Documentation standards

### [JS_MODULE_MAP.md](JS_MODULE_MAP.md)
Complete reference map of all JavaScript modules:
- Quick reference table for finding functionality
- Architecture overview (event-driven, modular)
- Core infrastructure (app.js, state.js, events.js, navigation.js)
- Workflow steps (input, mapping, reconciliation, references, export)
- Feature modules (mapping/, reconciliation/, references/)
- Utilities and helpers
- Common tasks and dependency graph

### [specs/QuickStatements-documentation.md](specs/QuickStatements-documentation.md)
QuickStatements export format reference:
- How the tool generates Wikidata import commands
- QuickStatements syntax and structure
- Export workflow and format

## Additional Technical Documentation

### [docs/SHEX_PARSING_GUIDE.md](docs/SHEX_PARSING_GUIDE.md)
Guide for converting ShExC to ShExJ for Wikidata Entity Schemas:
- ShEx parsing implementation details
- Browser-based parsing approach
- Wikidata-specific handling

### [src/js/mapping/README.md](src/js/mapping/README.md)
Mapping module architecture documentation:
- Module structure (core/ and ui/ layers)
- API reference and exports
- State management and event integration
- Architecture patterns and testing strategy

### [Entity-Schema-Guide.md](Entity-Schema-Guide.md)
Practical guide to Wikidata Entity Schemas:
- Understanding ShExC (Shape Expressions)
- How to read schemas (E473, E487, E476, E488)
- When to use which schema
- Schema validation and discovery

### [PLAYWRIGHT_MULTI_BRANCH_SETUP.md](PLAYWRIGHT_MULTI_BRANCH_SETUP.md)
Multi-branch Playwright testing setup:
- Global installation with symlinks
- Concurrent branch development
- Available test commands
- Troubleshooting guide

## Archived Specifications

The [archive/specs/](archive/specs/) directory contains historical project specifications and planning documents from the initial development phase. These documents provide context about original design decisions and requirements but may not reflect the current implementation.

Key archived documents include:
- Original project overview and architecture plans
- User workflow specifications
- Technical requirements and API integration docs
- MVP roadmap and implementation notes
- Development patterns and debugging guides

**Note:** For current implementation details, always refer to the main documentation files listed above and the inline code documentation.

---

**Quick Links:**
- [User Story](USER_STORY.md) - Complete user journey through the tool
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute to this project
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
