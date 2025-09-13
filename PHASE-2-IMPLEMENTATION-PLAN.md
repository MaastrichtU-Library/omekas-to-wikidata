# Phase 2: Schema Overview and Mapping Status - Implementation Plan

## Overview
Phase 2 implements a collapsible section that displays Entity Schema information and tracks mapping progress for required and optional properties. This provides users with clear visibility into their mapping completeness against the selected Entity Schema.

## Objectives
- Display selected Entity Schema information in a clean, collapsible interface
- Track and visualize mapping progress for required and optional properties
- Provide real-time updates when mappings change
- Hide the entire section when no Entity Schema is selected
- Prepare foundation for Phase 3 interactive mapping

---

## Implementation Strategy

### Core Behavior
- **When NO Entity Schema is selected**: Entire overview section is hidden (`display: none`)
- **When Entity Schema IS selected**: Overview section appears below the mapping action buttons
- **Real-time updates**: Automatically refresh when mappings change or schema is selected

### Mapping Detection Logic
- A property is considered "mapped" if there's any mapping with that exact property ID (e.g., P31)
- Source requirements are parsed from ShEx constraints looking for reference/source patterns
- Progress indicators show simple text with visual indicators (not full progress bars)

---

## Files to Create

### 1. `/src/js/entity-schemas/entity-schema-overview.js`
**Purpose**: Main component managing the collapsible schema overview section.

**Key Functions**:
- `initializeSchemaOverview(state)` - Initialize and return the overview component
- `createCollapsedView(schema, mappingStatus)` - Generate collapsed summary
- `createExpandedView(schema, mappingStatus)` - Generate detailed property list
- `updateMappingStatus(schema, mappedKeys)` - Recalculate mapping progress
- `toggleExpansion()` - Handle expand/collapse behavior

**Event Listeners**:
- `entitySchemaSelected` - Show/hide and refresh overview when schema changes
- `STATE_CHANGED` for `mappings.mappedKeys` - Update mapping status in real-time
- Click handlers for expand/collapse toggle

### 2. `/src/js/entity-schemas/schema-property-mapper.js`
**Purpose**: Helper module to analyze and categorize schema properties vs current mappings.

**Key Functions**:
- `getMappingStatus(schema, mappedKeys)` - Categorize properties as mapped/unmapped
- `detectSourceRequirement(constraint)` - Parse ShEx constraints for source requirements
- `categorizeProperties(schema, mappedKeys)` - Return categorized property arrays
- `calculateProgress(requiredMapped, requiredTotal, optionalMapped, optionalTotal)` - Generate progress text

---

## Files to Modify

### 1. `/src/index.html`
**Location**: After line 160, below `.mapping-actions` div

**Addition**:
```html
<!-- Entity Schema Overview Section -->
<div id="entity-schema-overview-container"></div>
```

### 2. `/src/js/steps/mapping.js`
**Changes**:
- Import `initializeSchemaOverview` from entity-schema-overview.js
- Initialize overview component after entity schema selector
- Pass state reference for real-time updates

**Code Addition** (around line 120):
```javascript
// Initialize Entity Schema Overview
const overviewContainer = document.getElementById('entity-schema-overview-container');
if (overviewContainer) {
    const overview = initializeSchemaOverview(state);
    overviewContainer.appendChild(overview);
}
```

### 3. `/src/css/style.css`
**New Sections**:
- `.entity-schema-overview` - Main container styles
- `.schema-overview-header` - Collapsed view header
- `.schema-overview-collapsed` - Collapsed summary content
- `.schema-overview-expanded` - Expanded property list
- `.property-list-section` - Required/optional property sections
- `.property-item` - Individual property styling
- `.status-indicator` - Visual mapping status indicators
- `.progress-text` - Progress summary styling

**Visual Design**:
- Collapsed: Single line summary with toggle arrow
- Expanded: Clear hierarchy with required properties first
- Colors: Green checkmarks, red dots for unmapped required, blue Wikidata links
- Smooth expand/collapse animations

### 4. `/src/js/entity-schemas/entity-schema-core.js`
**Enhancement to `parseShExProperties()` function**:
- Add `requiresSource` detection from ShEx constraints
- Look for patterns like `prov:wasDerivedFrom`, reference constraints
- Add `requiresSource: boolean` to property objects

### 5. `/src/js/state.js`
**New State Properties**:
```javascript
// Entity Schema mapping status tracking
schemaMappingStatus: {
    requiredMapped: [],
    requiredUnmapped: [],
    optionalMapped: [],
    optionalUnmapped: [],
    lastUpdated: null
}
```

**New Helper Methods**:
- `updateSchemaMappingStatus(status)` - Update mapping status state
- `getSchemaMappingStatus()` - Get current mapping status

---

## Component Structure

```
entity-schema-overview-container
└── entity-schema-overview
    ├── schema-overview-header (clickable to toggle)
    │   ├── schema-info
    │   │   ├── schema-label (e.g., "Manuscript")
    │   │   ├── schema-id-link ((E476) - links to Wikidata)
    │   │   ├── required-progress (✓ All required or ⚠ 2/5 required)
    │   │   └── optional-progress (3/8 optional - subdued)
    │   └── toggle-indicator (▼/▲ arrow)
    └── schema-overview-expanded (hidden by default)
        ├── required-properties-section
        │   ├── section-header ("Required Properties")
        │   └── property-list
        │       └── property-item (for each required property)
        │           ├── status-indicator (✓ mapped / ● unmapped)
        │           ├── property-label
        │           ├── property-id-link ((P123) - links to Wikidata)
        │           └── source-indicator (📎 if source required)
        └── optional-properties-section
            ├── section-header ("Optional Properties")
            └── property-list
                └── property-item (same structure as required)
```

---

## Implementation Steps

### Step 1: Create Core Components
1. Create `entity-schema-overview.js` with basic structure
2. Create `schema-property-mapper.js` with mapping analysis logic
3. Add HTML container to `index.html`

### Step 2: Integrate with Existing System
1. Update `mapping.js` to initialize overview component
2. Connect to state management and event system
3. Implement real-time updates

### Step 3: Visual Implementation
1. Add comprehensive CSS styles
2. Implement expand/collapse animations
3. Add visual indicators and proper spacing

### Step 4: Enhanced Property Parsing
1. Update `entity-schema-core.js` to detect source requirements
2. Enhance property objects with additional metadata
3. Improve ShEx parsing accuracy

### Step 5: State Management
1. Add mapping status tracking to state
2. Implement helper methods for status updates
3. Ensure persistence across page reloads

### Step 6: Testing and Refinement
1. Write comprehensive Playwright tests
2. Test real-time updates and edge cases
3. Verify cross-browser compatibility
4. Polish animations and user experience

---

## Testing Strategy

### Playwright Test Cases
1. **Visibility Tests**:
   - Overview hidden when no schema selected
   - Overview appears when schema selected
   - Proper content display in collapsed/expanded states

2. **Functionality Tests**:
   - Expand/collapse toggle works correctly
   - Progress indicators update when mappings change
   - Links to Wikidata properties work
   - Real-time updates when adding/removing mappings

3. **Integration Tests**:
   - Works correctly with all four default schemas
   - Works with custom schemas from search
   - Persists state across page reloads
   - Updates when loading mappings from file

4. **Edge Cases**:
   - Schemas with no properties
   - Schemas with only required or only optional properties
   - Large numbers of properties (performance)
   - Invalid or malformed ShEx code

### Manual Testing
- Cross-browser compatibility (Chrome, Firefox, Safari)
- Responsive design on different screen sizes
- Accessibility with keyboard navigation
- Performance with large schemas

---

## Success Criteria

### Functional Requirements ✅
- [ ] Overview section appears only when Entity Schema selected
- [ ] Collapsed view shows schema info and progress summary
- [ ] Expanded view lists all required and optional properties
- [ ] Real-time updates when mappings change
- [ ] Visual indicators for mapping status
- [ ] Links to Wikidata work correctly

### User Experience Requirements ✅
- [ ] Smooth expand/collapse animations
- [ ] Clear visual hierarchy (required vs optional)
- [ ] Intuitive progress indicators
- [ ] Non-intrusive integration with existing UI
- [ ] Responsive design for different screen sizes

### Technical Requirements ✅
- [ ] Modular, maintainable code structure
- [ ] Proper event handling and state management
- [ ] Comprehensive error handling
- [ ] Performance optimization for large schemas
- [ ] All Playwright tests passing

---

## Timeline

### Day 1: Core Implementation
- Create main components and helper modules
- Integrate with existing system
- Basic functionality working

### Day 2: Polish and Testing
- Complete CSS styling and animations
- Write comprehensive tests
- Bug fixes and edge case handling

**Total Estimated Time**: 2 days

---

## Dependencies

### Internal Dependencies
- Entity Schema selector (Phase 1) ✅
- Existing mapping system
- State management infrastructure
- Event system for real-time updates

### External Dependencies
- Wikidata API for property labels
- ShEx parsing for constraint analysis
- Playwright for testing

---

## Risk Mitigation

### Identified Risks
1. **Performance**: Large schemas with many properties
2. **API Limits**: Fetching too many property labels at once
3. **ShEx Parsing**: Complex constraints might not parse correctly
4. **State Synchronization**: Mapping status getting out of sync

### Mitigation Strategies
1. **Performance**: Implement lazy loading and virtualization for large property lists
2. **API Limits**: Batch requests and implement caching with reasonable TTL
3. **ShEx Parsing**: Implement fallback parsing and graceful degradation
4. **State Sync**: Use event-driven updates and validation checks

---

## Future Considerations

### Phase 3 Preparation
- Property click handlers ready for interactive mapping
- Modal integration points identified
- Conflict resolution UI foundation

### Potential Enhancements
- Sorting options for property lists
- Filtering (mapped/unmapped only)
- Property search within schema
- Bulk mapping suggestions
- Export mapping completeness report

---

*Implementation Start Date: 2025-09-13*
*Target Completion: 2025-09-15*