# Entity Schema Implementation Plan

## Overview
This document outlines the comprehensive plan for integrating Wikidata Entity Schemas into the Omeka S to Wikidata mapping tool. The implementation is divided into three main phases, with a fourth phase for validation and warnings.

## Project Status
- **Phase 1**: ✅ **COMPLETE** (2025-09-13)
- **Phase 2**: ⏳ Pending
- **Phase 3**: ⏳ Pending  
- **Phase 4**: ⏳ Pending

---

## Phase 1: Entity Schema Selection ✅ **COMPLETE**

### Objectives
Implement a user-friendly interface for selecting Entity Schemas in the mapping step.

### Implementation Details

#### 1.1 Custom Dropdown Component
- **Status**: ✅ Complete
- **Location**: Top-right of Step 2 (Mapping) header
- **Features Implemented**:
  - Custom-styled dropdown button (400-600px width)
  - Clean, borderless design with hover effects
  - Dropdown arrow indicator
  - Responsive design for mobile devices

#### 1.2 Default Schema Options
- **Status**: ✅ Complete
- **Schemas Available**:
  - E473: Maastricht University Library
  - E487: Radboud University  
  - E476: Manuscript
  - E488: Incunable
- **Display Format**: `Label (E-number)`
- **Interaction**:
  - Click on label: Selects the schema
  - Click on E-number: Opens Wikidata page in new tab

#### 1.3 Custom/Other Option
- **Status**: ✅ Complete
- **Features**:
  - "Custom/Other..." option in dropdown
  - Opens modal dialog for searching Entity Schemas
  - Search functionality with live results
  - Suggested schemas displayed below search results
  - Same label/E-number click behavior as dropdown

#### 1.4 State Management
- **Status**: ✅ Complete
- **Implementation**:
  - `selectedEntitySchema` state property
  - `entitySchemaHistory` for recent selections
  - Event system integration (`entitySchemaSelected` event)
  - LocalStorage persistence

#### 1.5 Technical Architecture
- **Status**: ✅ Complete
- **Files Created**:
  - `/src/js/entity-schemas/entity-schema-core.js` - Core logic and API calls
  - `/src/js/entity-schemas/entity-schema-selector.js` - UI components
- **Files Modified**:
  - `/src/js/state.js` - Added schema state management
  - `/src/js/steps/mapping.js` - Integrated selector component
  - `/src/index.html` - Added selector container
  - `/src/css/style.css` - Custom dropdown styles

#### 1.6 Testing
- **Status**: ✅ Complete
- **Playwright Tests**: 5/5 passing
  - Entity Schema selector visibility
  - Schema selection functionality
  - Custom modal opening
  - Search functionality
  - State updates

### Bugs Fixed During Implementation
1. ✅ `eventSystem.emit` error - Changed to `eventSystem.publish`
2. ✅ Dropdown click not working - Removed JavaScript positioning conflicts
3. ✅ All options not visible - Adjusted max-height to 200px

---

## Phase 2: Schema Overview and Mapping Status ⏳ **PENDING**

### Objectives
Display Entity Schema information and track mapping progress for required/optional properties.

### Planned Features

#### 2.1 Collapsible Section
- **Location**: Below "load" and "save mapping" buttons
- **Collapsed View**:
  - Entity label and number (linked to Wikidata)
  - Progress indicators:
    - Required properties: X/Y mapped
    - Optional properties: X/Y mapped
  - Visual progress bars

#### 2.2 Expanded View
- **Property List Display**:
  - Required properties first (sorted)
  - Optional properties second (sorted)
  - For each property:
    - Property label and PID
    - Mapping status indicator
    - Red indicator for unmapped required properties
    - Source requirement indicator
    - Click-through links to Wikidata

#### 2.3 Technical Requirements
- **New Components**:
  - `/src/js/entity-schemas/entity-schema-overview.js`
  - `/src/js/entity-schemas/schema-parser.js`
- **ShExC Parsing**:
  - Extract required/optional properties
  - Parse cardinality constraints
  - Identify source requirements
- **State Integration**:
  - Track mapping status per property
  - Update progress in real-time

---

## Phase 3: Interactive Mapping ⏳ **PENDING**

### Objectives
Enable direct property mapping from the Entity Schema overview.

### Planned Features

#### 3.1 Click-to-Map Interface
- **Interaction Flow**:
  1. Click on property in schema overview
  2. Modal opens for key selection
  3. Select input key from available keys
  4. Normal mapping modal opens with pre-filled values
  
#### 3.2 Reverse Mapping
- **Rules**:
  - Only add new mappings (no overwrites by default)
  - Warning system for conflicts
  - Options: Override, Create duplicate, Open existing
  
#### 3.3 Integration Points
- **With Existing Mapping System**:
  - Use existing mapping modal
  - Leverage current transformation engine
  - Maintain consistency with manual mapping

#### 3.4 Technical Requirements
- **New Components**:
  - `/src/js/entity-schemas/interactive-mapping.js`
  - Enhanced modal handlers
- **Event Handling**:
  - Property click events
  - Conflict resolution dialogs
  - State synchronization

---

## Phase 4: Validation and Warnings ⏳ **PENDING**

### Objectives
Provide informative warnings about schema compliance without blocking user actions.

### Planned Features

#### 4.1 Validation Triggers
- **Check Points**:
  - On save attempt
  - Before proceeding to next step
  - Manual validation button
  
#### 4.2 Warning Types
- **Non-Blocking Warnings**:
  - Missing required properties
  - Incorrect cardinality
  - Missing sources where required
  - Type mismatches
  
#### 4.3 User Interface
- **Warning Display**:
  - Toast notifications
  - Inline indicators in schema overview
  - Summary modal with all issues
  - Option to proceed anyway

#### 4.4 Technical Requirements
- **Validation Engine**:
  - `/src/js/entity-schemas/schema-validator.js`
  - ShExC constraint checking
  - Mapping completeness verification

---

## General Design Principles

### User Experience
- ✅ Keep interface simple and intuitive
- ✅ Non-intrusive integration with existing workflow
- ✅ Informative but non-blocking warnings
- ✅ Progressive disclosure of complexity

### Technical Principles
- ✅ Modular architecture
- ✅ Reuse existing components where possible
- ✅ Event-driven communication
- ✅ Comprehensive error handling
- ✅ Performance optimization for API calls

### Visual Design
- ✅ Consistent with existing application theme
- ✅ Clear visual hierarchy
- ✅ Accessible color choices
- ✅ Responsive design for various screen sizes

---

## Implementation Timeline

### Completed
- **Phase 1**: 2025-09-13
  - Planning and architecture
  - Core implementation
  - UI/UX refinements
  - Bug fixes and testing

### Upcoming
- **Phase 2**: Estimated 2-3 days
- **Phase 3**: Estimated 3-4 days
- **Phase 4**: Estimated 2 days

---

## Testing Strategy

### Unit Tests
- Core logic functions
- API integration
- State management

### Integration Tests
- Component interactions
- Event system
- State persistence

### E2E Tests ✅
- User workflows
- Schema selection
- Mapping flows
- Validation scenarios

### Manual Testing
- Cross-browser compatibility
- Performance testing
- Accessibility testing

---

## Dependencies

### External
- Wikidata Entity Schema API
- ShExC parser library (to be selected)

### Internal
- Existing mapping system
- State management
- Event system
- Modal UI components

---

## Risk Assessment

### Technical Risks
- ShExC parsing complexity
- API rate limiting
- Performance with large schemas

### Mitigation Strategies
- Caching for API responses ✅
- Progressive loading
- Optimized parsing algorithms
- Fallback mechanisms

---

## Documentation Requirements

### Code Documentation
- JSDoc comments for all functions
- README updates
- API documentation

### User Documentation
- Feature guide
- Video tutorials (optional)
- FAQ section

---

## Notes and Decisions

### Phase 1 Decisions
- Chose custom dropdown over native select for better UX control
- Implemented separate click areas for label (selection) vs E-number (external link)
- Used existing modal system rather than creating new modal components
- Cached API responses for 15 minutes to reduce load

### Future Considerations
- Consider adding schema validation preview
- Possible integration with Wikidata Query Service
- Schema template suggestions based on item type
- Bulk mapping from schema

---

## Appendix

### Related Files
- `Entity-Schema-Guide.md` - Technical guide to Wikidata Entity Schemas
- `CLAUDE.md` - Project conventions and guidelines
- `.issues/` - GitHub issues tracking

### Key Schema IDs
- **E473**: Maastricht University Library special collections
- **E487**: Radboud University Library special collections  
- **E476**: Medieval and modern manuscripts
- **E488**: Incunables (early printed books)

### API Endpoints
- Schema fetch: `https://www.wikidata.org/wiki/Special:EntitySchemaText/{schemaId}`
- Schema search: Wikidata API with EntitySchema namespace

---

*Last Updated: 2025-09-13*
*Phase 1 Completed: 2025-09-13*