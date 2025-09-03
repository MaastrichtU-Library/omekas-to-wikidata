# Wikidata Data Types Specification

## Overview

This document provides a comprehensive specification of Wikidata data types, their characteristics, validation requirements, and transformation components for the Omeka S to Wikidata mapping tool.

## Table of Contents

1. [Core Data Types](#core-data-types)
2. [Data Type Components](#data-type-components)
3. [Validation & Transformation](#validation--transformation)
4. [Implementation Guidelines](#implementation-guidelines)
5. [Component Reusability](#component-reusability)

---

## Core Data Types

Based on the official Wikidata data types documentation and practical usage patterns, we support the following data types in order of priority and usage frequency:

### 1. Item (Wikidata Item)
- **Description**: Link to a Wikidata item (QID)
- **Format**: `Q` followed by numeric ID (e.g., `Q5` for human)
- **Use Cases**: References to entities, concepts, objects
- **Validation**: QID format validation, existence verification
- **Components**: QID Detection & Search, Common Items, Reconciliation

### 2. String
- **Description**: Chain of characters, numbers and symbols that don't need translation
- **Maximum Length**: 1,500 characters
- **Example**: `B123`, `90928390-XLE`, `u29238`
- **Use Cases**: Identifiers, codes, short text values
- **Validation**: Character length, pattern matching
- **Components**: Find & Replace, Regex Validation

### 3. External Identifier
- **Description**: String representing an identifier used in an external system
- **Maximum Length**: 1,500 characters
- **Display**: Shows as external link if formatter URL is defined
- **Examples**: ISBN numbers, ORCID IDs, museum catalog numbers
- **Validation**: Pattern validation, prefix/suffix handling
- **Components**: Find & Replace, Regex Validation, Prefix/Suffix Management

### 4. Quantity
- **Description**: Decimal number with unit of measurement and optional bounds
- **Attributes**:
  - `amount`: Main numeric value
  - `unit`: Unit of measure item (QID or dimensionless Q199)
  - `lowerBound`: Optional lower bound
  - `upperBound`: Optional upper bound
- **Unit Integration**: 
  - Units are **predetermined Wikidata entities** (QIDs)
  - Retrieved via **Wikidata API** calls for real-time search and validation
  - Support for **dimensionless quantities** (Q199 - "1")
  - **Unit conversion** awareness through Wikidata unit relationships
- **Examples**: 
  - `762` (dimensionless - Q199)
  - `2500 km` (amount: 2500, unit: Q828 - kilometer)
  - `1.03 ± 0.02 g` (amount: 1.03, bounds: 1.01-1.05, unit: Q41803 - gram)
- **API Integration**: 
  - Search units via Wikidata Query Service
  - Validate unit QIDs against Wikidata
  - Fetch unit metadata (labels, conversion factors)
- **Components**: Unit Search & Detection, Precision Management, Bounds Configuration

### 5. URL
- **Description**: Generalized URL identifying external resources
- **Maximum Length**: 1,500 characters
- **Validation**: URL format validation, protocol handling
- **Components**: Find & Replace, URL Normalization

### 6. Commons Media File
- **Description**: References to files on Wikimedia Commons
- **Format**: Filename without "File:" namespace prefix
- **Examples**: `Wikidata-logo.svg`
- **Validation**: File extension validation, Commons existence check
- **Components**: Find & Replace, File Format Validation

### 7. Point in Time (Date)
- **Description**: Date in Gregorian or Julian calendar
- **Precision Levels**: Day, Month, Year, Decade, Century
- **Formats**: `2012`, `1780-05`, `1833-11-01`
- **Components**: Date Format Detection, Precision Configuration

### 8. Monolingual Text
- **Description**: Text in a specific language that doesn't require translation
- **Maximum Length**: 1,500 characters
- **Attributes**:
  - `text`: The actual text content
  - `language`: Language code (e.g., `en`, `de`, `la`)
- **Use Cases**: Geographic names, scientific names, local identifiers
- **Components**: Language Selection, Find & Replace

### 9. Geographic Coordinates
- **Description**: Latitude-longitude pair for geographical positions
- **Attributes**:
  - `latitude`: Decimal degrees
  - `longitude`: Decimal degrees
  - `precision`: Coordinate precision
  - `globe`: Celestial body (defaults to Earth - Q2)
- **Formats**: Decimal degrees, Degrees-Minutes-Seconds (DMS)
- **Components**: Coordinate Format Detection, Precision Management, Globe Selection

### 10. Metadata
- **Description**: Entity metadata including labels, descriptions, and aliases (not an official Wikidata data type)
- **Purpose**: Handle entity metadata that doesn't fit standard property values
- **Types**:
  - `label`: Primary name/title of the entity (can use multilingual string for universal default)
  - `description`: Brief description of the entity (requires language specification)
  - `alias`: Alternative names or synonyms (requires language specification)
- **Language Requirements**:
  - **Labels**: Can use multilingual string (same string used as default for all languages) OR specific language code
  - **Descriptions**: Always require specific language code (e.g., `en`, `de`, `fr`)
  - **Aliases**: Always require specific language code (e.g., `en`, `de`, `fr`)
- **Maximum Length**: 250 characters (labels), 250 characters (descriptions), no limit (aliases)
- **Examples**: 
  - Label (multilingual): "Leonardo da Vinci" (universal default)
  - Label (language-specific): "Leonardo da Vinci" (en), "Léonard de Vinci" (fr)
  - Description: "Italian polymath of the Renaissance" (en)
  - Aliases: "Leonardo di ser Piero da Vinci", "Leonardo" (en)
- **Use Cases**: Entity creation, metadata cleanup, multilingual content management
- **Validation**: Language code validation (except multilingual labels), length limits, duplicate detection
- **Components**: Find & Replace, Language Selection, Metadata Type Selection
- **Note**: More similar to Monolingual Text than String due to language requirements

---

## Data Type Components

Components are reusable UI/logic blocks that can be applied to multiple data types to handle common transformation and validation tasks.

### Shared Components

#### Find & Replace Operations
- **Used By**: String, External Identifier, URL, Commons Media, Point in Time, Monolingual Text, Geographic Coordinates
- **Purpose**: Text transformation and cleanup
- **Features**:
  - optional Case-sensitive replacement
  - Multiple rules with order precedence
  - Rule editing and reordering
  - Preview functionality

#### Regular Expression Validation
- **Used By**: String, External Identifier
- **Purpose**: Pattern-based validation
- **Features**:
  - Custom regex patterns
  - Pattern descriptions
  - Validation feedback
  - Common pattern library

### Specialized Components

#### QID Detection & Search (Item)
- **Purpose**: Find and validate Wikidata item references
- **Features**:
  - Intelligent QID detection in text
  - Wikidata search integration
  - Common items quick selection
  - Reconciliation workflow

#### Unit Search & Detection (Quantity)
- **Purpose**: Identify and assign measurement units from Wikidata's predetermined unit entities
- **API Integration**:
  - **Real-time Search**: Query Wikidata API for units matching user input
  - **SPARQL Queries**: Use Wikidata Query Service to find units by label/alias
  - **Unit Validation**: Verify selected units exist and are valid measurement units
  - **Metadata Retrieval**: Fetch unit labels, descriptions, and conversion factors
- **Features**:
  - **Live Unit Search**: Autocomplete with API-powered suggestions
  - **Common Units Library**: Pre-cached frequently used units (meter, gram, second, etc.)
  - **Automatic Detection**: Parse text patterns to suggest appropriate units
  - **Unit Relationships**: Understand unit hierarchies and conversions via Wikidata properties
  - **Dimensionless Support**: Handle quantities without units (Q199 - "1")
- **API Endpoints**:
  - Wikidata API: `https://www.wikidata.org/w/api.php`
  - Query Service: `https://query.wikidata.org/sparql`
  - Search for units with property P2370 (conversion to SI unit)
- **Example SPARQL**: 
  ```sparql
  SELECT ?unit ?unitLabel WHERE {
    ?unit wdt:P31/wdt:P279* wd:Q47574 .  # unit of measurement
    ?unit rdfs:label ?unitLabel .
    FILTER(LANG(?unitLabel) = "en")
    FILTER(CONTAINS(LCASE(?unitLabel), "meter"))
  }
  ```

#### Coordinate Format Detection (Geographic Coordinates)
- **Purpose**: Parse and validate coordinate formats
- **Features**:
  - Multiple format support (decimal, DMS)
  - Automatic format detection
  - Precision configuration
  - Globe selection

#### Date Format Detection (Point in Time)
- **Purpose**: Parse various date formats
- **Features**:
  - Multiple date format support
  - Automatic format detection
  - Precision level configuration
  - Calendar model selection

#### Language Selection (Monolingual Text)
- **Purpose**: Specify text language
- **Features**:
  - Language code search
  - Common languages quick selection
  - Language validation

#### URL Normalization (URL)
- **Purpose**: Standardize URL formats
- **Features**:
  - Protocol normalization (HTTP/HTTPS)
  - www prefix handling
  - Trailing slash removal
  - Query parameter management

#### File Format Validation (Commons Media)
- **Purpose**: Validate file types and formats
- **Features**:
  - File extension validation
  - Supported format checking
  - Automatic "File:" prefix handling

#### Prefix/Suffix Management (External Identifier)
- **Purpose**: Handle identifier prefixes and suffixes
- **Features**:
  - Automatic prefix/suffix removal
  - Prefix/suffix addition
  - Pattern-based transformation

#### Precision & Bounds (Quantity)
- **Purpose**: Configure numeric precision and boundaries
- **Features**:
  - Precision level setting
  - Automatic bounds calculation
  - Manual bounds override

#### Metadata Type Selection (Metadata)
- **Purpose**: Specify metadata type and language
- **Features**:
  - Metadata type selection (label, description, alias)
  - Language code specification
  - Multi-language support
  - Duplicate detection and merging

---

## Validation & Transformation

### Transformation Sequencing

**Critical Principle**: All transformations are applied **in sequential order**, and **order matters**. Components must support:

- **Sequential Processing**: Transformations are applied one after another in user-defined order
- **Dynamic Reordering**: Users can drag-and-drop components to change execution order
- **Multiple Instances**: Multiple instances of the same component type can be added (e.g., three different Find & Replace operations)
- **Chain Dependencies**: Later components receive the output of earlier components

**Example Transformation Chain**:
1. Find & Replace #1: Remove "Dr. " prefix
2. Find & Replace #2: Replace "&" with "and" 
3. Find & Replace #3: Standardize spacing
4. Regex Validation: Validate final format
5. Language Selection: Assign language code

### Validation Stages

1. **Format Validation**: Ensure data matches expected format
2. **Content Validation**: Verify semantic correctness
3. **External Validation**: Check against external systems (optional)

### Transformation Pipeline

1. **Input Preprocessing**: Clean and normalize input data
2. **Component Chain Execution**: Apply components sequentially in user-defined order
3. **Format Detection**: Identify data format automatically
4. **Value Extraction**: Extract relevant values from text
5. **Validation**: Apply validation rules after each transformation step
6. **Output Formatting**: Format for Wikidata consumption

### Component Management

- **Add Components**: Users can add multiple instances of any component
- **Reorder Components**: Drag-and-drop interface for changing execution order
- **Remove Components**: Individual components can be removed from the chain
- **Clone Components**: Duplicate existing component configurations
- **Conditional Components**: Components can be enabled/disabled without removal

### Error Handling

- **Validation Errors**: Clear error messages with suggestions
- **Partial Success**: Handle partially valid data
- **Fallback Options**: Provide alternative approaches
- **User Feedback**: Interactive error resolution
- **Chain Debugging**: Show intermediate results between component steps

---

## Implementation Guidelines

### Component Architecture

```
DataTypeManager
├── SharedComponents/
│   ├── FindReplaceComponent
│   ├── RegexValidationComponent
│   └── ...
├── SpecializedComponents/
│   ├── QIDDetectionComponent
│   ├── UnitSearchComponent
│   └── ...
└── DataTypeHandlers/
    ├── StringHandler
    ├── ItemHandler
    └── ...
```

### API Integration Patterns

For components requiring Wikidata API integration (especially Unit Search & Detection):

```javascript
// Unit Search Service
class WikidataUnitService {
  constructor() {
    this.cache = new Map();
    this.apiBase = 'https://www.wikidata.org/w/api.php';
    this.sparqlEndpoint = 'https://query.wikidata.org/sparql';
  }
  
  async searchUnits(query, limit = 10) {
    // Check cache first
    const cacheKey = `units_${query}_${limit}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // SPARQL query for units
    const sparql = `
      SELECT DISTINCT ?unit ?unitLabel ?description WHERE {
        ?unit wdt:P31/wdt:P279* wd:Q47574 .  # unit of measurement
        ?unit rdfs:label ?unitLabel .
        OPTIONAL { ?unit schema:description ?description . }
        FILTER(LANG(?unitLabel) = "en")
        FILTER(CONTAINS(LCASE(?unitLabel), "${query.toLowerCase()}"))
      } LIMIT ${limit}
    `;
    
    const results = await this.executeSparql(sparql);
    this.cache.set(cacheKey, results);
    return results;
  }
  
  async validateUnit(qid) {
    // Validate that QID is a valid unit
    const sparql = `
      ASK {
        wd:${qid} wdt:P31/wdt:P279* wd:Q47574 .
      }
    `;
    return await this.executeSparql(sparql);
  }
}
```

### Configuration Schema

```javascript
{
  "dataType": "string|external-id|item|quantity|metadata|...",
  "components": [
    {
      "type": "find-replace",
      "config": {
        "rules": [
          {"find": "text", "replace": "replacement"}
        ]
      }
    },
    {
      "type": "regex-validation",
      "config": {
        "patterns": [
          {"pattern": "^[A-Z]+$", "description": "Uppercase only"}
        ]
      }
    },
    {
      "type": "metadata-type-selection",
      "config": {
        "metadataType": "label|description|alias",
        "language": "en",
        "allowMultipleLanguages": true
      }
    }
  ],
  "validation": {
    "required": true,
    "maxLength": 250, // 250 for labels/descriptions, unlimited for aliases
    "customRules": []
  }
}
```

### State Management

- **Component State**: Individual component configurations
- **Validation State**: Current validation status
- **Preview State**: Real-time transformation preview
- **Error State**: Validation errors and warnings

---

## Component Reusability

### Shared Component Matrix

| Data Type | Find & Replace | Regex | QID Search | Unit Search | Date Format | Language | URL Norm | File Valid | Prefix/Suffix | Precision | Coord Format | Metadata Type |
|-----------|----------------|-------|------------|-------------|-------------|----------|----------|------------|---------------|-----------|--------------|---------------|
| Item | - | - | ✓ | - | - | - | - | - | - | - | - | - |
| String | ✓ | ✓ | - | - | - | - | - | - | - | - | - | - |
| External ID | ✓ | ✓ | - | - | - | - | - | - | ✓ | - | - | - |
| Quantity | - | - | - | ✓ | - | - | - | - | - | ✓ | - | - |
| URL | ✓ | - | - | - | - | - | ✓ | - | - | - | - | - |
| Commons Media | ✓ | - | - | - | - | - | - | ✓ | - | - | - | - |
| Point in Time | ✓ | - | - | - | ✓ | - | - | - | - | - | - | - |
| Monolingual Text | ✓ | - | - | - | - | ✓ | - | - | - | - | - | - |
| Geographic Coordinates | ✓ | - | - | - | - | - | - | - | - | ✓ | ✓ | - |
| Metadata | ✓ | - | - | - | - | ✓ | - | - | - | - | - | ✓ |

### Component Interfaces

```javascript
// Base Component Interface
class BaseComponent {
  constructor(config) {}
  render() {}
  validate() {}
  transform(input) {}
  getConfig() {}
  setConfig(config) {}
}

// Example: Find & Replace Component
class FindReplaceComponent extends BaseComponent {
  constructor(config = { rules: [] }) {
    super(config);
  }
  
  addRule(find, replace) {}
  removeRule(ruleId) {}
  transform(input) {
    // Apply all rules in order
  }
}

// Example: Metadata Type Selection Component
class MetadataTypeSelectionComponent extends BaseComponent {
  constructor(config = { metadataType: 'label', language: 'en' }) {
    super(config);
  }
  
  setMetadataType(type) {} // 'label', 'description', 'alias'
  setLanguage(languageCode) {}
  validateMetadata(value) {}
  formatForWikidata(value) {}
}
```

---

## Technical Considerations

### Performance
- **Lazy Loading**: Load components only when needed
- **Caching**: Cache validation results and transformations
- **Debouncing**: Debounce real-time validation
- **API Optimization**:
  - **Unit Caching**: Cache frequently used units locally to reduce API calls
  - **Batch Requests**: Group multiple unit lookups into single API calls
  - **Request Throttling**: Limit API request frequency to respect rate limits
  - **Offline Fallback**: Maintain cached unit database for offline functionality

### Accessibility
- **Screen Reader Support**: Proper ARIA labels
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast**: Support for high contrast themes

### Internationalization
- **Component Labels**: Translatable component titles
- **Error Messages**: Localized error messages
- **Language Support**: Multi-language data handling

### Testing
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **Validation Tests**: Comprehensive validation testing

---

## Future Enhancements

### Planned Data Types
- **Property**: Link to Wikidata properties
- **EntitySchema**: Link to entity schemas
- **Lexeme/Form/Sense**: Lexicographical data types

### Advanced Features
- **AI-Assisted Detection**: Machine learning for automatic data type detection
- **Bulk Operations**: Batch processing capabilities
- **Custom Components**: User-defined transformation components
- **Template System**: Reusable configuration templates

### Integration Points
- **Wikidata Query Service**: Enhanced validation through SPARQL
- **Commons API**: File existence validation
- **External APIs**: Third-party identifier validation

---

## Conclusion

This specification provides a comprehensive framework for implementing Wikidata data type support in the Omeka S to Wikidata mapping tool. The component-based architecture ensures reusability, maintainability, and extensibility while providing users with powerful data transformation and validation capabilities.

The modular design allows for incremental implementation, starting with core data types and shared components, then expanding to specialized functionality as needed.