# Technical Architecture

## System Architecture

### Frontend-Only Design
The application runs entirely in the browser with no backend infrastructure:

```
Browser Environment
├── Static HTML/CSS/JS files served from GitHub Pages
├── In-memory JavaScript objects for state management  
├── External API calls to:
│   ├── Omeka S instances (user-provided endpoints)
│   ├── Wikidata Query Service (SPARQL)
│   ├── Wikidata Reconciliation API
│   └── GitHub-hosted configuration files
└── Local file downloads for data export/import
```

### Core Principles

#### Stateless Operation
- No server-side storage or user accounts
- All application state maintained in memory during session
- Users responsible for saving/loading their work via JSON export/import
- Page refresh clears all data (with user warnings)

#### Progressive Enhancement
- Basic functionality works without advanced features
- Graceful degradation when external APIs are unavailable
- Optional features clearly marked and skippable

#### Security by Design
- No sensitive data storage in browser
- All external API calls use HTTPS
- User data never transmitted to application servers
- GitHub-hosted configuration files are read-only

## Data Flow Architecture

### State Management Pattern

```javascript
// Central application state object
const AppState = {
    datasources: {
        omekaApiResponses: [],
        entitySchemas: []
    },
    workflow: {
        currentStep: 1,
        stepStates: {
            input: { ... },
            mapping: { ... },
            reconciliation: { ... },
            designer: { ... },
            export: { ... }
        }
    },
    ui: {
        activeModals: [],
        keyboardFocus: null,
        unsavedChanges: false
    }
}
```

### Component Communication
- **Event-driven architecture** for component communication
- **Unidirectional data flow** from state to UI components
- **Immutable state updates** through dedicated state management functions
- **Validation pipeline** that runs on every state change

## Module Structure

### Core Modules

#### `/src/js/state.js`
- Central state management
- State validation and migration
- Import/export functionality
- Change detection and dirty state tracking

#### `/src/js/api/`
- External API integration
- Rate limiting and error handling
- Response caching and optimization
- Offline capability detection

#### `/src/js/steps/`
- Step-specific business logic
- Data transformation pipelines
- Validation rules per step
- Progress tracking

#### `/src/js/ui/`
- Reusable UI components
- Modal management system
- Keyboard navigation handling
- Accessibility features

#### `/src/js/utils/`
- Pure utility functions
- Data validation helpers
- Type checking and conversion
- Common algorithm implementations

### Configuration System

#### GitHub-Hosted Configuration
```
Configuration Sources
├── tooltips.json - Context-sensitive help text
├── placeholders.json - UI placeholder content
├── entity-schemas.json - Default schema configurations
├── property-mappings.json - Common mapping patterns
└── ui-content.json - Static UI text and markdown
```

#### Runtime Configuration
- User preferences stored in memory only
- Dynamic feature toggling based on detected capabilities
- Responsive configuration based on data source analysis

## API Integration Architecture

### Omeka S Integration
- **RESTful API consumption** with configurable endpoints
- **Pagination handling** for large collections
- **Error recovery** for network issues
- **Data normalization** from various Omeka S versions

### Wikidata Integration
- **SPARQL queries** for property discovery and validation
- **Reconciliation API** for entity matching
- **Property constraint checking** via Wikidata API
- **Entity Schema validation** through dedicated endpoints

### GitHub Integration
- **Static file hosting** for configuration and documentation
- **Version-controlled content** enabling community contributions
- **CDN delivery** for optimal global performance

## Performance Considerations

### Memory Management
- **Lazy loading** of large datasets
- **Garbage collection** awareness in data processing
- **Memory limits** for browser compatibility
- **Progress indicators** for long-running operations

### Network Optimization
- **Request batching** where possible
- **Intelligent caching** of API responses
- **Retry logic** with exponential backoff
- **Graceful degradation** when APIs are slow

### Browser Compatibility
- **Modern ES6+** JavaScript with appropriate polyfills
- **Progressive enhancement** for older browsers
- **Feature detection** rather than browser sniffing
- **Accessible by default** with keyboard navigation

## Error Handling Strategy

### Error Categories
1. **Network Errors**: API unavailability, timeouts, rate limits
2. **Data Errors**: Invalid JSON, missing required fields, type mismatches
3. **Validation Errors**: Schema violations, constraint failures
4. **User Errors**: Invalid input, workflow violations

### Recovery Mechanisms
- **Graceful degradation** with reduced functionality
- **Retry strategies** with user feedback
- **Rollback capabilities** for invalid state changes
- **Export safeguards** to prevent data loss

## Security Architecture

### Data Protection
- **No persistent storage** of user data
- **HTTPS-only** external communications
- **Input sanitization** for all user data
- **XSS prevention** through proper templating

### API Security
- **CORS compliance** for cross-origin requests
- **Rate limiting** respect for external APIs
- **No API keys** stored in client code
- **Read-only access** to external data sources

## Deployment Architecture

### Static Hosting
- **GitHub Pages** for application hosting
- **CDN distribution** for global performance
- **Automatic deployment** from repository updates
- **Version management** through git tagging

### Development Workflow
- **Local development** with live reloading
- **Testing environment** with mock APIs
- **Staging deployment** for preview branches
- **Production deployment** from main branch

This architecture supports the project's goals of simplicity, reliability, and maintainability while providing a foundation for future enhancements and community contributions.