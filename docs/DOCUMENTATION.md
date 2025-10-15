# Technical Documentation

**[← Back to README](../README.md)**

This page serves as a hub for all technical and developer documentation. For general project information and usage instructions, see the [README](../README.md).

## Project Overview

The Omeka S to Wikidata tool is a web-based application that guides users through the process of importing linked data from Omeka S systems into Wikidata. It was developed as part of the 2025 "Open Topstukken" (Open Collection Highlights) project by Maastricht University Library and Radboud University Library.

### Core Purpose
This tool bridges the gap between cultural heritage collections managed in Omeka S and the global knowledge base of Wikidata, enabling institutions to contribute their collection data to the semantic web while maintaining proper attribution and data quality standards.

### Target Users
- **Primary Users**: Librarians, archivists, and collection managers at cultural heritage institutions
- **Secondary Users**: Digital humanities researchers and data curators
- **Technical Level**: Users with basic understanding of metadata and web interfaces, but no programming skills required

## Core Documentation

### [USER-MANUAL.md](USER-MANUAL.md)
Comprehensive user guide for the tool:
- Complete walkthrough of all five steps
- Detailed explanations of features and options
- Project and mapping file management
- Best practices and troubleshooting
- Tips for data quality and testing

### [README.md](../README.md)
General project documentation including:
- Project overview and purpose
- How to use the tool (live demo links)
- 5-step workflow explanation
- Load/save mapping functionality
- CORS proxy system for Omeka S integration

### [CLAUDE.md](../CLAUDE.md)
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

### [specs/QuickStatements-documentation.md](../specs/QuickStatements-documentation.md)
QuickStatements export format reference:
- How the tool generates Wikidata import commands
- QuickStatements syntax and structure
- Export workflow and format

## Additional Technical Documentation

### [Entity-Schema-Guide.md](Entity-Schema-Guide.md)
Practical guide to Wikidata Entity Schemas:
- Understanding ShExC (Shape Expressions)
- How to read schemas (E473, E487, E476, E488)
- When to use which schema
- Schema validation and discovery

### [src/js/mapping/README.md](../src/js/mapping/README.md)
Mapping module architecture documentation:
- Module structure (core/ and ui/ layers)
- API reference and exports
- State management and event integration
- Architecture patterns and testing strategy

## Archived Specifications

The [archive/specs/](../archive/specs/) directory contains historical project specifications and planning documents from the initial development phase. These documents provide context about original design decisions and requirements but may not reflect the current implementation.

Key archived documents include:
- Original project overview and architecture plans
- User workflow specifications
- Technical requirements and API integration docs
- MVP roadmap and implementation notes
- Development patterns and debugging guides

**Note:** For current implementation details, always refer to the main documentation files listed above and the inline code documentation.

---

**[← Back to README](../README.md)**
