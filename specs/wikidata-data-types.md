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

Based on the official Wikidata data types documentation, we support the following data types in order of priority and usage frequency:

### 1. String
- **Description**: Chain of characters, numbers and symbols that don't need translation
- **Maximum Length**: 1,500 characters
- **Example**: `B123`, `90928390-XLE`, `u29238`
- **Use Cases**: Identifiers, codes, short text values
- **Validation**: Character length, pattern matching
- **Components**: Find & Replace, Regex Validation

### 2. External Identifier
- **Description**: String representing an identifier used in an external system
- **Maximum Length**: 1,500 characters
- **Display**: Shows as external link if formatter URL is defined
- **Examples**: ISBN numbers, ORCID IDs, museum catalog numbers
- **Validation**: Pattern validation, prefix/suffix handling
- **Components**: Find & Replace, Regex Validation, Prefix/Suffix Management

### 3. Item (Wikidata Item)
- **Description**: Link to a Wikidata item (QID)
- **Format**: `Q` followed by numeric ID (e.g., `Q5` for human)
- **Use Cases**: References to entities, concepts, objects
- **Validation**: QID format validation, existence verification
- **Components**: QID Detection & Search, Common Items, Reconciliation

### 4. Quantity
- **Description**: Decimal number with unit of measurement and optional bounds
- **Attributes**:
  - `amount`: Main numeric value
  - `unit`: Unit of measure item (QID or dimensionless)
  - `lowerBound`: Optional lower bound
  - `upperBound`: Optional upper bound
- **Examples**: `762` (dimensionless), `2500 km`, `1.03 ± 0.02 g`
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

---

## Data Type Components

Components are reusable UI/logic blocks that can be applied to multiple data types to handle common transformation and validation tasks.

### Shared Components

#### Find & Replace Operations
- **Used By**: String, External Identifier, URL, Commons Media, Point in Time, Monolingual Text, Geographic Coordinates
- **Purpose**: Text transformation and cleanup
- **Features**:
  - Case-sensitive replacement
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
- **Purpose**: Identify and assign measurement units
- **Features**:
  - Unit search with autocomplete
  - Common units quick selection
  - Automatic unit detection from text patterns
  - Unit conversion awareness

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

---

## Validation & Transformation

### Validation Stages

1. **Format Validation**: Ensure data matches expected format
2. **Content Validation**: Verify semantic correctness
3. **External Validation**: Check against external systems (optional)

### Transformation Pipeline

1. **Input Preprocessing**: Clean and normalize input data
2. **Pattern Matching**: Apply find/replace rules
3. **Format Detection**: Identify data format automatically
4. **Value Extraction**: Extract relevant values from text
5. **Validation**: Apply validation rules
6. **Output Formatting**: Format for Wikidata consumption

### Error Handling

- **Validation Errors**: Clear error messages with suggestions
- **Partial Success**: Handle partially valid data
- **Fallback Options**: Provide alternative approaches
- **User Feedback**: Interactive error resolution

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

### Configuration Schema

```javascript
{
  "dataType": "string|external-id|item|quantity|...",
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
    }
  ],
  "validation": {
    "required": true,
    "maxLength": 1500,
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

| Data Type | Find & Replace | Regex | QID Search | Unit Search | Date Format | Language | URL Norm | File Valid | Prefix/Suffix | Precision | Coord Format |
|-----------|----------------|-------|------------|-------------|-------------|----------|----------|------------|---------------|-----------|--------------|
| String | ✓ | ✓ | - | - | - | - | - | - | - | - | - |
| External ID | ✓ | ✓ | - | - | - | - | - | - | ✓ | - | - |
| Item | - | - | ✓ | - | - | - | - | - | - | - | - |
| Quantity | - | - | - | ✓ | - | - | - | - | - | ✓ | - |
| URL | ✓ | - | - | - | - | - | ✓ | - | - | - | - |
| Commons Media | ✓ | - | - | - | - | - | - | ✓ | - | - | - |
| Point in Time | ✓ | - | - | - | ✓ | - | - | - | - | - | - |
| Monolingual Text | ✓ | - | - | - | - | ✓ | - | - | - | - | - |
| Geographic Coordinates | ✓ | - | - | - | - | - | - | - | - | ✓ | ✓ |

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
```

---

## Technical Considerations

### Performance
- **Lazy Loading**: Load components only when needed
- **Caching**: Cache validation results and transformations
- **Debouncing**: Debounce real-time validation

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