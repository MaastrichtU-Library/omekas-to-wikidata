# MVP Roadmap

## MVP Definition

The Minimum Viable Product (MVP) focuses on the core workflow functionality that enables users to successfully map Omeka S data to Wikidata and export it as QuickStatements. The MVP prioritizes essential features over convenience features.

## MVP Scope

### Core Functionality (Must Have)

#### Foundation Features
- **Frontend-only application** with no backend dependencies
- **Five-step workflow navigation** with clear progress indicators
- **Session state management** in memory with manual save/load
- **Data loss warnings** when refreshing or navigating away

#### Step 1: Input (MVP)
- **API endpoint configuration** with complete URL input
- **Basic data fetching** from Omeka S REST API
- **JSON structure preview** with raw data toggle
- **Sample item selection** for workflow design

#### Step 2: Mapping (MVP)
- **Three-section interface**: Non-linked, Mapped, Ignored keys
- **Mapping modal** with property search and suggestions
- **Basic Entity Schema integration** (hardcoded schema for testing)
- **Property confirmation workflow** with skip/ignore options

#### Step 3: Reconciliation (MVP)
- **Table interface** showing items × properties
- **Row-by-row reconciliation** with modal workflow
- **Manual entity search** for QID properties
- **Multiple value property support**
- **Basic validation** for string/numeric/date fields

#### Step 4: Wikidata Designer (MVP)
- **Fixed example item** for preview
- **Source addition interface** with reusable references
- **Basic Wikidata preview** styling
- **Property completion tracking**

#### Step 5: Export (MVP)
- **QuickStatements generation** with proper syntax
- **Copy to clipboard** functionality
- **Basic usage instructions** and links to documentation
- **Session export** as JSON file

### Technical Requirements (MVP)
- **Modern browser support** (Chrome, Firefox, Safari, Edge)
- **ES6+ JavaScript** with async/await
- **Responsive to 1024px minimum** width
- **Basic error handling** with user-friendly messages
- **API integration** with Omeka S and Wikidata services

### User Experience (MVP)
- **Linear workflow progression** with step validation
- **Modal-based task completion** for focused work
- **Keyboard navigation** for primary actions
- **Basic help system** with essential information

## Post-MVP Features (Phase 2)

### Enhanced User Experience
- **Advanced keyboard navigation** with full shortcut system
- **Comprehensive help system** with search functionality
- **Detailed progress indicators** and time estimation
- **Advanced JSON viewer** with syntax highlighting
- **Universal info modal** system with markdown content

### Advanced Functionality
- **Multiple Entity Schema support** with selection interface
- **Advanced API parameters** and pagination handling
- **Reconciliation API integration** for automatic suggestions
- **Column-based reconciliation** workflow option
- **Bulk value application** and pattern recognition

### Configuration and Customization
- **GitHub-hosted configuration** files for tooltips and content
- **Community mapping reuse** via shared configuration files
- **SPARQL-based suggestions** from collection analysis
- **Custom Entity Schema** upload and validation

### Quality Assurance
- **Advanced validation** with Entity Schema enforcement
- **Property constraint checking** against Wikidata rules
- **Cross-reference validation** between related properties
- **Quality scoring** and confidence indicators

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
```
Priority: P0 (Critical)
├── Application shell with step navigation
├── Basic state management system
├── Modal framework and keyboard handling
├── API integration foundation
└── Error handling framework
```

### Phase 2: Step Implementation (Weeks 3-6)
```
Priority: P0 (Critical)
├── Week 3: Input step with API configuration
├── Week 4: Mapping step with property selection
├── Week 5: Reconciliation step with entity matching
├── Week 6: Designer and Export steps
```

### Phase 3: Integration and Testing (Weeks 7-8)
```
Priority: P0 (Critical)
├── End-to-end workflow testing
├── API integration refinement
├── Error handling improvement
├── Basic documentation completion
```

### Phase 4: Polish and Enhancement (Weeks 9-12)
```
Priority: P1 (Important)
├── UI/UX refinements
├── Performance optimization
├── Advanced keyboard navigation
├── Comprehensive help system
```

## Success Criteria

### MVP Success Metrics
- **Complete workflow**: User can progress from Omeka S URL to QuickStatements output
- **Data integrity**: Generated QuickStatements are syntactically valid
- **Error handling**: Graceful handling of common error scenarios
- **User comprehension**: Clear understanding of each step's purpose
- **Performance**: Handles collections of 50+ items efficiently

### User Acceptance Criteria

#### For Each Step:
1. **Clear purpose**: User understands what the step accomplishes
2. **Progress indication**: User knows how much work remains
3. **Error recovery**: User can correct mistakes and continue
4. **Data preservation**: User's work is not lost unexpectedly

#### For Overall Tool:
1. **Complete mapping**: All relevant properties can be mapped to Wikidata
2. **Quality validation**: Invalid data is caught before export
3. **Export functionality**: QuickStatements can be successfully used on Wikidata
4. **Documentation**: Sufficient help to complete the workflow independently

## Risk Mitigation

### Technical Risks
- **API reliability**: Implement retry logic and graceful degradation
- **Browser compatibility**: Test on major browsers, provide fallbacks
- **Performance**: Optimize for larger collections, implement pagination
- **Data validation**: Comprehensive validation prevents invalid exports

### User Experience Risks
- **Complexity**: Provide clear guidance and examples at each step
- **Learning curve**: Include contextual help and terminology explanations
- **Error recovery**: Allow users to backtrack and correct mistakes
- **Data loss**: Prominent warnings and export recommendations

### Integration Risks
- **Wikidata changes**: Monitor API changes, implement version detection
- **Omeka S variations**: Test with multiple Omeka S installations
- **Entity Schema evolution**: Design flexible schema integration
- **QuickStatements compatibility**: Validate against current syntax requirements

## Post-MVP Roadmap

### Phase 5: Advanced Features (Months 4-6)
- Advanced Entity Schema integration
- Community configuration sharing
- Bulk processing optimizations
- Advanced validation and quality assurance

### Phase 6: Community Features (Months 7-9)
- Mapping pattern sharing
- Community feedback integration
- Multi-language support
- Institutional configuration management

### Phase 7: Integration Expansion (Months 10-12)
- Additional LOD platform support
- Advanced Wikidata integration features
- Automated quality assessment
- Advanced export options

This roadmap ensures the MVP delivers core value while establishing a foundation for advanced features that enhance efficiency and quality for experienced users.