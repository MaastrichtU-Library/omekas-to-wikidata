# Configuration System

## Overview

The configuration system provides a flexible, community-maintainable approach to customizing the application's behavior, content, and default settings. All configuration is hosted on GitHub for version control and community contributions.

## Configuration Architecture

### GitHub-Hosted Configuration
```
Configuration Repository Structure:
├── config/
│   ├── tooltips.json           # Context-sensitive help text
│   ├── placeholders.json       # UI placeholder content
│   ├── entity-schemas.json     # Default Entity Schema configurations
│   ├── property-mappings.json  # Common property mapping patterns
│   └── ui-settings.json        # Default UI behavior settings
├── content/
│   ├── help/                   # Markdown help documentation
│   ├── examples/               # Sample data and workflows
│   └── templates/              # Reusable content templates
└── schemas/                    # JSON schemas for validation
```

### Configuration Loading Strategy
- **Primary Source**: GitHub repository via raw content URLs
- **Fallback Strategy**: Embedded defaults when GitHub unavailable
- **Caching**: Session-based caching with TTL expiration
- **Version Control**: Git-based versioning for configuration changes

## Configuration File Specifications

### Tooltips Configuration (`tooltips.json`)

#### Structure
```json
{
  "version": "1.0.0",
  "updated": "2024-01-15T10:30:00Z",
  "tooltips": {
    "input": {
      "api-url": {
        "text": "Enter the complete Omeka S API URL including collection parameters",
        "example": "https://example.com/api/items?item_set_id=123",
        "moreInfo": "help/api-configuration.md"
      },
      "sample-selection": {
        "text": "Choose a representative item to guide the mapping process",
        "moreInfo": "help/sample-selection.md"
      }
    },
    "mapping": {
      "property-search": {
        "text": "Search Wikidata properties by label or description",
        "shortcut": "Type to search, Enter to select",
        "moreInfo": "help/property-search.md"
      },
      "entity-schema": {
        "text": "Entity Schema provides validation rules for your data type",
        "moreInfo": "help/entity-schemas.md"
      }
    },
    "reconciliation": {
      "confidence-score": {
        "text": "Match confidence: ★★★ High, ★★☆ Medium, ★☆☆ Low",
        "moreInfo": "help/reconciliation-scores.md"
      }
    }
  }
}
```

### UI Placeholders (`placeholders.json`)

#### Structure
```json
{
  "version": "1.0.0",
  "placeholders": {
    "input": {
      "api-url": "https://your-omeka.example.com/api/items?item_set_id=123",
      "api-description": "Enter your Omeka S collection API endpoint"
    },
    "mapping": {
      "property-search": "Search for Wikidata properties...",
      "no-suggestions": "No suggestions available. Try searching manually."
    },
    "reconciliation": {
      "entity-search": "Search for matching entities...",
      "creating-new": "This will create a new Wikidata item"
    },
    "export": {
      "quickstatements-intro": "Copy the QuickStatements below and paste them into the QuickStatements tool on Wikidata."
    }
  },
  "messages": {
    "success": {
      "mapping-complete": "✓ Property mapping completed successfully",
      "reconciliation-complete": "✓ All entities reconciled",
      "export-ready": "✓ QuickStatements generated and ready for use"
    },
    "warnings": {
      "unsaved-changes": "⚠ You have unsaved changes. Export your session before leaving.",
      "missing-required": "⚠ Some required properties are not mapped"
    }
  }
}
```

### Entity Schema Defaults (`entity-schemas.json`)

#### Structure
```json
{
  "version": "1.0.0",
  "default_schemas": [
    {
      "id": "E473",
      "label": "individual copy of a book - Maastricht University Library",
      "description": "schema to describe a single unique copy, or exemplar, of a book",
      "url": "https://www.wikidata.org/wiki/EntitySchema:E473",
      "domain": "library_materials",
      "priority": 1,
      "required_properties": [
        {"property": "P31", "label": "instance of", "required": true},
        {"property": "P1476", "label": "title", "required": true},
        {"property": "P50", "label": "author", "required": false}
      ],
      "recommended_properties": [
        {"property": "P577", "label": "publication date"},
        {"property": "P123", "label": "publisher"},
        {"property": "P195", "label": "collection"}
      ]
    }
  ],
  "schema_mappings": {
    "dctype:Text": ["E473"],
    "dctype:Image": ["E174"],
    "dctype:PhysicalObject": ["E22"]
  }
}
```

### Property Mappings (`property-mappings.json`)

#### Common Mapping Patterns
```json
{
  "version": "1.0.0",
  "common_mappings": {
    "dublin_core": {
      "dcterms:title": ["P1476", "P1813"],
      "dcterms:creator": ["P50", "P170", "P86"],
      "dcterms:date": ["P577", "P571"],
      "dcterms:publisher": ["P123"],
      "dcterms:subject": ["P921"],
      "dcterms:description": ["P1684"],
      "dcterms:identifier": ["P217", "P854"],
      "dcterms:language": ["P407"],
      "dcterms:type": ["P31"],
      "dcterms:format": ["P2701"]
    },
    "omeka_s_common": {
      "bibo:isbn": ["P212"],
      "bibo:issn": ["P236"],
      "foaf:name": ["P1476", "P2561"],
      "schema:author": ["P50"],
      "schema:datePublished": ["P577"],
      "schema:publisher": ["P123"]
    }
  },
  "confidence_scores": {
    "exact_match": 1.0,
    "common_mapping": 0.8,
    "semantic_match": 0.6,
    "suggested": 0.4
  }
}
```

### UI Settings (`ui-settings.json`)

#### Default Behavior Configuration
```json
{
  "version": "1.0.0",
  "ui_defaults": {
    "workflow": {
      "auto_advance_modals": true,
      "show_progress_details": true,
      "remember_step_positions": true
    },
    "input_step": {
      "hide_custom_keys": true,
      "default_page_size": 50,
      "preview_items": 3
    },
    "mapping_step": {
      "auto_suggest_from_schema": true,
      "show_mapping_confidence": true,
      "collapse_mapped_sections": false
    },
    "reconciliation_step": {
      "min_confidence_threshold": 0.6,
      "max_suggestions_per_value": 5,
      "auto_accept_high_confidence": false
    },
    "designer_step": {
      "require_sources": true,
      "show_wikidata_preview": true,
      "validate_in_real_time": true
    },
    "keyboard": {
      "enable_shortcuts": true,
      "modal_shortcuts": true,
      "navigation_shortcuts": true
    }
  },
  "performance": {
    "api_request_delay": 1000,
    "max_concurrent_requests": 3,
    "cache_ttl_seconds": 300
  }
}
```

## Dynamic Configuration Loading

### Configuration Manager
```javascript
class ConfigurationManager {
  constructor() {
    this.config = {};
    this.cache = new Map();
    this.baseUrl = 'https://raw.githubusercontent.com/user/config-repo/main/';
    this.fallbacks = this.getEmbeddedDefaults();
  }
  
  async loadAll() {
    const configFiles = [
      'config/tooltips.json',
      'config/placeholders.json', 
      'config/entity-schemas.json',
      'config/property-mappings.json',
      'config/ui-settings.json'
    ];
    
    for (const file of configFiles) {
      try {
        const data = await this.loadConfigFile(file);
        const configKey = file.split('/')[1].replace('.json', '');
        this.config[configKey] = data;
      } catch (error) {
        console.warn(`Failed to load ${file}, using fallback:`, error);
        this.config[configKey] = this.fallbacks[configKey];
      }
    }
    
    return this.config;
  }
  
  async loadConfigFile(path) {
    const cacheKey = path;
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached)) {
      return cached.data;
    }
    
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
  
  isCacheValid(cached, ttl = 300000) { // 5 minutes
    return Date.now() - cached.timestamp < ttl;
  }
}
```

### Context-Aware Configuration

#### Tooltip System
```javascript
class TooltipManager {
  constructor(config) {
    this.tooltips = config.tooltips;
  }
  
  getTooltip(context, elementId) {
    const contextConfig = this.tooltips[context];
    if (!contextConfig || !contextConfig[elementId]) {
      return null;
    }
    
    return {
      text: contextConfig[elementId].text,
      example: contextConfig[elementId].example,
      shortcut: contextConfig[elementId].shortcut,
      moreInfo: contextConfig[elementId].moreInfo
    };
  }
  
  attachTooltips(context) {
    document.querySelectorAll(`[data-tooltip]`).forEach(element => {
      const tooltipId = element.dataset.tooltip;
      const tooltip = this.getTooltip(context, tooltipId);
      
      if (tooltip) {
        this.createTooltipElement(element, tooltip);
      }
    });
  }
}
```

### User Customization Support

#### Runtime Configuration Override
```javascript
class UserPreferences {
  constructor(defaultConfig) {
    this.defaults = defaultConfig;
    this.overrides = {};
  }
  
  setPreference(path, value) {
    this.setNestedValue(this.overrides, path, value);
    this.saveToSessionStorage();
  }
  
  getPreference(path) {
    const override = this.getNestedValue(this.overrides, path);
    if (override !== undefined) return override;
    
    return this.getNestedValue(this.defaults, path);
  }
  
  resetToDefaults() {
    this.overrides = {};
    this.saveToSessionStorage();
  }
  
  saveToSessionStorage() {
    sessionStorage.setItem('user_preferences', JSON.stringify(this.overrides));
  }
  
  loadFromSessionStorage() {
    const stored = sessionStorage.getItem('user_preferences');
    if (stored) {
      this.overrides = JSON.parse(stored);
    }
  }
}
```

## Content Management

### Markdown Content Loading
```javascript
class ContentManager {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.contentCache = new Map();
  }
  
  async loadMarkdownContent(path) {
    const cached = this.contentCache.get(path);
    if (cached) return cached;
    
    try {
      const response = await fetch(`${this.baseUrl}content/${path}`);
      const markdown = await response.text();
      const html = this.convertMarkdownToHTML(markdown);
      
      this.contentCache.set(path, html);
      return html;
    } catch (error) {
      console.warn(`Failed to load content: ${path}`, error);
      return `<p>Content not available: ${path}</p>`;
    }
  }
  
  convertMarkdownToHTML(markdown) {
    // Simple markdown parser or use library like marked.js
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2">$1</a>');
  }
}
```

## Configuration Validation

### Schema Validation
```javascript
class ConfigValidator {
  constructor() {
    this.schemas = {
      tooltips: {
        type: 'object',
        required: ['version', 'tooltips'],
        properties: {
          version: {type: 'string'},
          tooltips: {
            type: 'object',
            patternProperties: {
              '^[a-z_]+$': {
                type: 'object',
                patternProperties: {
                  '^[a-z_-]+$': {
                    type: 'object',
                    required: ['text'],
                    properties: {
                      text: {type: 'string'},
                      example: {type: 'string'},
                      shortcut: {type: 'string'},
                      moreInfo: {type: 'string'}
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }
  
  validate(configType, data) {
    const schema = this.schemas[configType];
    if (!schema) {
      throw new Error(`No validation schema for config type: ${configType}`);
    }
    
    return this.validateAgainstSchema(data, schema);
  }
  
  validateAgainstSchema(data, schema) {
    // Implementation of JSON schema validation
    // Could use a library like ajv for production
    return {valid: true, errors: []};
  }
}
```

## Community Contribution Workflow

### Configuration Updates
1. **Pull Request Process**: Community members submit changes via GitHub PR
2. **Validation**: Automated testing ensures configuration validity
3. **Review**: Maintainers review changes for quality and consistency
4. **Deployment**: Approved changes automatically available to application

### Version Management
- **Semantic Versioning**: Configuration follows semver for compatibility
- **Migration Support**: Automated migration for configuration changes
- **Rollback Capability**: Easy reversion to previous configuration versions

This configuration system provides a flexible foundation for customizing the application while maintaining community governance and quality control.