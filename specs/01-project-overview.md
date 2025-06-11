# Project Overview

## Vision Statement

The Omekas-to-Wikidata tool is a browser-based application that bridges the gap between Omeka S collections and Wikidata by providing a structured, user-friendly workflow for mapping, reconciling, and exporting linked open data to Wikidata via QuickStatements.

## Project Goals

### Primary Objectives
- **Data Liberation**: Enable heritage institutions to contribute their Omeka S collections to the global knowledge graph
- **Quality Assurance**: Ensure data mapping follows Wikidata best practices and Entity Schema validation
- **Accessibility**: Provide a tool that requires no technical backend knowledge or installation
- **Community Building**: Foster reuse of mapping patterns and reconciliation strategies

### Success Metrics
- Successful export of complete item collections to QuickStatements format
- High-quality mappings that pass Entity Schema validation
- Reusable mapping configurations for common heritage metadata patterns
- Positive user feedback on workflow clarity and efficiency

## Target Users

### Primary Users
- **Digital Heritage Professionals**: Librarians, archivists, museum professionals managing Omeka S collections
- **Wikidata Contributors**: Experienced editors looking to bulk-import structured heritage data
- **GLAM Coordinators**: Institution representatives coordinating Wikidata contribution projects

### User Expertise Levels
- **Beginner**: Familiar with Omeka S but new to Wikidata concepts
- **Intermediate**: Understands both platforms but needs guidance on best practices
- **Advanced**: Experienced with both platforms, needs efficient workflow tools

## Project Scope

### In Scope
- Frontend-only web application (no backend infrastructure required)
- Support for standard Omeka S API endpoints and responses
- Integration with Wikidata APIs (property search, reconciliation, validation)
- Entity Schema integration for validation and guidance
- Export to QuickStatements format
- Keyboard-driven workflow optimized for efficiency
- Comprehensive help system with contextual guidance

### Out of Scope
- Direct publishing to Wikidata (QuickStatements provides this functionality)
- Backend data storage or user account management
- Mobile or responsive design (desktop browser tool only)
- Custom Omeka S module development
- Automated bulk processing without human review

## Technical Principles

### Architecture Principles
- **Client-Side Only**: No server infrastructure, all processing in browser
- **Stateless**: No persistent storage, users manage their own data exports
- **Progressive**: Works step-by-step, allowing users to save and resume
- **Modular**: Clear separation between data processing, UI, and API integration

### Design Principles
- **Microtask-Oriented**: Break complex operations into focused, manageable tasks
- **Keyboard-First**: Optimize for power users with extensive keyboard navigation
- **Transparent**: Show users exactly what data transformations are happening
- **Recoverable**: Allow users to revise decisions and backtrack through workflow

## Success Factors

### Technical Success
- Reliable API integration with both Omeka S and Wikidata services
- Robust data validation preventing invalid QuickStatements output
- Efficient handling of large collections (hundreds of items)
- Cross-browser compatibility on modern desktop browsers

### User Experience Success
- Clear workflow progression with obvious next steps
- Helpful guidance without overwhelming novice users
- Efficient workflows that scale for power users
- Comprehensive error handling with actionable messages

## Related Projects and Standards

### Standards Compliance
- **Linked Open Data**: Full compatibility with JSON-LD and RDF principles
- **Dublin Core**: Support for standard metadata mappings
- **Wikidata Data Model**: Adherence to property types, qualifiers, and references
- **Entity Schemas**: Integration with community-defined data quality standards

### Integration Points
- **Omeka S API**: RESTful API for collection and item data
- **Wikidata Query Service**: SPARQL endpoint for property discovery and validation
- **Wikidata Reconciliation API**: Entity matching and suggestion services
- **QuickStatements**: Batch editing tool for Wikidata contributions

## Project Context

This tool addresses the gap between cultural heritage institutions using Omeka S for digital collections and the global Wikidata knowledge base. By providing structured workflows and validation, it enables high-quality contributions that benefit both institutional visibility and global knowledge access.

The project prioritizes sustainability through its frontend-only architecture, extensive documentation, and community-oriented design patterns that encourage reuse and extension.