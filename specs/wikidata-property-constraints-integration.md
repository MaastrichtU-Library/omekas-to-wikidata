# Wikidata Property Constraints Integration Guide

## Overview

This document provides comprehensive guidance on implementing Wikidata property data type retrieval and leveraging constraints for data validation, form enhancement, and quality control. The Wikidata API provides rich metadata about properties that can significantly improve data entry workflows and ensure compliance with Wikidata standards.

## Table of Contents

1. [API Implementation](#api-implementation)
2. [Data Structure Analysis](#data-structure-analysis)
3. [Constraint Types Reference](#constraint-types-reference)
4. [Integration Patterns](#integration-patterns)
5. [Validation Framework](#validation-framework)
6. [UI Enhancement Strategies](#ui-enhancement-strategies)
7. [Error Handling](#error-handling)
8. [Performance Considerations](#performance-considerations)
9. [Example Implementations](#example-implementations)

## API Implementation

### Basic Property Data Retrieval

```javascript
/**
 * Fetches property metadata including data type and constraints
 * @param {string} propertyId - Wikidata property ID (e.g., 'P31', 'P21')
 * @returns {Promise<Object>} Property data with constraints
 */
async function fetchPropertyData(propertyId) {
    const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
    const url = `${WIKIDATA_API}?action=wbgetentities&ids=${propertyId}&format=json&origin=*&props=labels|descriptions|datatype|claims`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.entities[propertyId]?.missing) {
            throw new Error(`Property ${propertyId} not found`);
        }
        
        return parsePropertyData(data.entities[propertyId]);
    } catch (error) {
        console.error(`Error fetching property ${propertyId}:`, error);
        throw error;
    }
}
```

### Property Data Parser

```javascript
/**
 * Parses raw Wikidata API response into structured property data
 * @param {Object} rawProperty - Raw property data from API
 * @returns {Object} Structured property information
 */
function parsePropertyData(rawProperty) {
    const property = {
        id: rawProperty.id,
        label: rawProperty.labels?.en?.value || 'No label',
        description: rawProperty.descriptions?.en?.value || 'No description',
        dataType: rawProperty.datatype,
        constraints: []
    };
    
    // Parse constraints (P2302 claims)
    if (rawProperty.claims?.P2302) {
        property.constraints = rawProperty.claims.P2302.map(parseConstraint);
    }
    
    return property;
}

/**
 * Parses individual constraint from claims
 * @param {Object} constraint - Raw constraint claim
 * @returns {Object} Structured constraint data
 */
function parseConstraint(constraint) {
    const constraintId = constraint.mainsnak?.datavalue?.value?.id;
    
    const parsedConstraint = {
        id: constraintId,
        type: CONSTRAINT_TYPE_MAP[constraintId] || constraintId,
        qualifiers: {}
    };
    
    // Extract qualifier data for constraint parameters
    if (constraint.qualifiers) {
        for (const [qualProp, qualValues] of Object.entries(constraint.qualifiers)) {
            parsedConstraint.qualifiers[qualProp] = qualValues.map(extractQualifierValue);
        }
    }
    
    return parsedConstraint;
}
```

## Data Structure Analysis

### Property Response Structure

```json
{
  "id": "P31",
  "label": "instance of",
  "description": "that class of which this subject is a particular example and member",
  "dataType": "wikibase-item",
  "constraints": [
    {
      "id": "Q21510865",
      "type": "Value type constraint",
      "qualifiers": {
        "P2308": ["Q16889133"],
        "P2309": ["Q21503252"]
      }
    }
  ]
}
```

### Common Data Types

| Data Type | Description | Examples |
|-----------|-------------|----------|
| `wikibase-item` | Links to Wikidata items | P31 (instance of), P21 (sex or gender) |
| `string` | Text values | P373 (Commons category), P1476 (title) |
| `external-id` | External identifiers | P227 (GND ID), P213 (ISNI) |
| `time` | Date/time values | P569 (date of birth), P571 (inception) |
| `quantity` | Numeric values with units | P1082 (population), P2046 (area) |
| `globe-coordinate` | Geographic coordinates | P625 (coordinate location) |
| `commonsMedia` | Wikimedia Commons files | P18 (image), P51 (audio) |
| `url` | Web addresses | P856 (official website) |
| `monolingualtext` | Language-tagged text | P1705 (native label) |

## Constraint Types Reference

### Format Constraints (Q21502404)

**Purpose**: Define regex patterns for string validation

**Qualifier Properties**:
- `P1793`: Regular expression pattern
- `P2916`: Exception to constraint (optional)

**Implementation**:
```javascript
function validateFormat(value, formatConstraint) {
    const pattern = formatConstraint.qualifiers.P1793?.[0];
    if (!pattern) return { valid: true };
    
    const regex = new RegExp(pattern);
    return {
        valid: regex.test(value),
        pattern: pattern,
        message: `Value must match pattern: ${pattern}`
    };
}
```

**Use Cases**:
- External ID validation (ISBN, DOI, etc.)
- Username/handle format checking
- Structured text validation

### Value Type Constraints (Q21510865)

**Purpose**: Restrict what types of items can be linked

**Qualifier Properties**:
- `P2308`: Class (allowed item types)
- `P2309`: Relation (instance/subclass)

**Implementation**:
```javascript
async function validateValueType(itemId, valueTypeConstraint) {
    const allowedClasses = valueTypeConstraint.qualifiers.P2308 || [];
    const relation = valueTypeConstraint.qualifiers.P2309?.[0] || 'Q21503252'; // default: instance of
    
    // Check if item is instance of or subclass of allowed classes
    for (const allowedClass of allowedClasses) {
        if (await isInstanceOrSubclassOf(itemId, allowedClass, relation)) {
            return { valid: true };
        }
    }
    
    return {
        valid: false,
        message: `Item must be instance of: ${allowedClasses.join(', ')}`
    };
}
```

**Use Cases**:
- Ensure occupations link to occupation items
- Validate that places link to geographic entities
- Restrict award properties to award items

### Allowed Values Constraints (Q52004125)

**Purpose**: Whitelist specific permitted values

**Qualifier Properties**:
- `P2305`: Item/value (list of allowed items)

**Implementation**:
```javascript
function validateAllowedValues(value, allowedValuesConstraint) {
    const allowedValues = allowedValuesConstraint.qualifiers.P2305 || [];
    
    return {
        valid: allowedValues.includes(value),
        allowedValues: allowedValues,
        message: allowedValues.length > 0 
            ? `Must be one of: ${allowedValues.join(', ')}`
            : 'No allowed values defined'
    };
}
```

**Use Cases**:
- Gender selection (male/female/intersex/etc.)
- Status fields with fixed options
- Classification with controlled vocabulary

### Unit Constraints (Q21514353)

**Purpose**: Define allowed measurement units for quantities

**Qualifier Properties**:
- `P2305`: Allowed units

**Implementation**:
```javascript
function validateUnit(unit, unitConstraint) {
    const allowedUnits = unitConstraint.qualifiers.P2305 || [];
    
    return {
        valid: allowedUnits.includes(unit) || allowedUnits.length === 0,
        allowedUnits: allowedUnits,
        message: `Unit must be one of: ${allowedUnits.join(', ')}`
    };
}
```

**Use Cases**:
- Population figures (persons, thousands)
- Area measurements (km², m², hectares)
- Weight/mass values (kg, g, tonnes)

### Cardinality Constraints

**Single Value Constraint (Q21502410)**:
- Property should have only one value
- Examples: Date of birth, date of death

**Multi-Value Constraint (Q21510857)**:
- Property can have multiple values
- Examples: Instance of, occupation

**Implementation**:
```javascript
function validateCardinality(values, constraints) {
    const hasSingleValueConstraint = constraints.some(c => c.id === 'Q21502410');
    const hasMultiValueConstraint = constraints.some(c => c.id === 'Q21510857');
    
    if (hasSingleValueConstraint && values.length > 1) {
        return {
            valid: false,
            message: 'This property allows only one value'
        };
    }
    
    return { valid: true };
}
```

## Integration Patterns

### 1. Form Field Enhancement

```javascript
class ConstraintEnhancedField {
    constructor(propertyId, fieldElement) {
        this.propertyId = propertyId;
        this.field = fieldElement;
        this.constraints = [];
        this.validators = [];
        
        this.initialize();
    }
    
    async initialize() {
        const propertyData = await fetchPropertyData(this.propertyId);
        this.constraints = propertyData.constraints;
        this.setupValidators();
        this.enhanceUI();
    }
    
    setupValidators() {
        for (const constraint of this.constraints) {
            switch (constraint.type) {
                case 'Format constraint':
                    this.validators.push(value => validateFormat(value, constraint));
                    break;
                case 'Allowed values constraint':
                    this.validators.push(value => validateAllowedValues(value, constraint));
                    this.convertToSelect(constraint.qualifiers.P2305);
                    break;
                // Add more constraint handlers...
            }
        }
    }
    
    enhanceUI() {
        this.field.addEventListener('blur', () => this.validateField());
        this.field.addEventListener('input', () => this.clearErrors());
    }
    
    async validateField() {
        const value = this.field.value;
        const results = await Promise.all(
            this.validators.map(validator => validator(value))
        );
        
        const errors = results.filter(r => !r.valid);
        this.displayValidationResults(errors);
        
        return errors.length === 0;
    }
}
```

### 2. Batch Property Loading

```javascript
class PropertyConstraintManager {
    constructor() {
        this.cache = new Map();
        this.loadingPromises = new Map();
    }
    
    async getPropertyConstraints(propertyId) {
        if (this.cache.has(propertyId)) {
            return this.cache.get(propertyId);
        }
        
        if (this.loadingPromises.has(propertyId)) {
            return this.loadingPromises.get(propertyId);
        }
        
        const promise = this.loadProperty(propertyId);
        this.loadingPromises.set(propertyId, promise);
        
        try {
            const result = await promise;
            this.cache.set(propertyId, result);
            return result;
        } finally {
            this.loadingPromises.delete(propertyId);
        }
    }
    
    async loadMultipleProperties(propertyIds) {
        const BATCH_SIZE = 10; // Wikidata API limit
        const results = new Map();
        
        for (let i = 0; i < propertyIds.length; i += BATCH_SIZE) {
            const batch = propertyIds.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(id => this.getPropertyConstraints(id));
            const batchResults = await Promise.allSettled(batchPromises);
            
            batch.forEach((id, index) => {
                if (batchResults[index].status === 'fulfilled') {
                    results.set(id, batchResults[index].value);
                }
            });
        }
        
        return results;
    }
}
```

### 3. Dynamic Form Generation

```javascript
class ConstraintBasedFormBuilder {
    constructor(propertyManager) {
        this.propertyManager = propertyManager;
    }
    
    async createField(propertyId, container) {
        const propertyData = await this.propertyManager.getPropertyConstraints(propertyId);
        const field = this.createBaseField(propertyData);
        
        // Apply constraint-based enhancements
        for (const constraint of propertyData.constraints) {
            this.applyConstraintToField(field, constraint, propertyData.dataType);
        }
        
        container.appendChild(field.element);
        return field;
    }
    
    createBaseField(propertyData) {
        const fieldType = this.getFieldTypeFromDataType(propertyData.dataType);
        
        return {
            element: this.createElement(fieldType, propertyData),
            validators: [],
            propertyData: propertyData
        };
    }
    
    applyConstraintToField(field, constraint, dataType) {
        switch (constraint.type) {
            case 'Format constraint':
                this.addFormatValidation(field, constraint);
                break;
            case 'Allowed values constraint':
                this.convertToSelect(field, constraint);
                break;
            case 'Single value constraint':
                this.ensureSingleValue(field);
                break;
            case 'Value type constraint':
                this.addAutocomplete(field, constraint);
                break;
        }
    }
}
```

## Validation Framework

### Comprehensive Validator

```javascript
class WikidataPropertyValidator {
    constructor(propertyManager) {
        this.propertyManager = propertyManager;
    }
    
    async validateProperty(propertyId, value, options = {}) {
        const propertyData = await this.propertyManager.getPropertyConstraints(propertyId);
        const results = {
            valid: true,
            errors: [],
            warnings: [],
            propertyData: propertyData
        };
        
        // Data type validation
        const dataTypeResult = this.validateDataType(value, propertyData.dataType);
        if (!dataTypeResult.valid) {
            results.valid = false;
            results.errors.push(dataTypeResult.error);
        }
        
        // Constraint validation
        for (const constraint of propertyData.constraints) {
            const constraintResult = await this.validateConstraint(value, constraint, options);
            
            if (!constraintResult.valid) {
                if (constraintResult.severity === 'error') {
                    results.valid = false;
                    results.errors.push(constraintResult.message);
                } else {
                    results.warnings.push(constraintResult.message);
                }
            }
        }
        
        return results;
    }
    
    async validateConstraint(value, constraint, options) {
        switch (constraint.type) {
            case 'Format constraint':
                return this.validateFormat(value, constraint);
            case 'Allowed values constraint':
                return this.validateAllowedValues(value, constraint);
            case 'Value type constraint':
                return this.validateValueType(value, constraint);
            case 'Single value constraint':
                return this.validateSingleValue(value, constraint, options.existingValues);
            default:
                return { valid: true };
        }
    }
}
```

### Validation Pipeline

```javascript
class ValidationPipeline {
    constructor(validator) {
        this.validator = validator;
        this.rules = [];
    }
    
    addValidationRule(propertyId, customValidator) {
        this.rules.push({ propertyId, validator: customValidator });
    }
    
    async validateDataset(dataset) {
        const results = {
            valid: true,
            itemResults: [],
            summary: {
                totalItems: dataset.length,
                validItems: 0,
                errorCount: 0,
                warningCount: 0
            }
        };
        
        for (const item of dataset) {
            const itemResult = await this.validateItem(item);
            results.itemResults.push(itemResult);
            
            if (itemResult.valid) {
                results.summary.validItems++;
            } else {
                results.valid = false;
            }
            
            results.summary.errorCount += itemResult.errors.length;
            results.summary.warningCount += itemResult.warnings.length;
        }
        
        return results;
    }
    
    async validateItem(item) {
        const itemResult = {
            itemId: item.id,
            valid: true,
            errors: [],
            warnings: [],
            propertyResults: []
        };
        
        for (const [propertyId, values] of Object.entries(item.claims || {})) {
            const valuesArray = Array.isArray(values) ? values : [values];
            
            for (const value of valuesArray) {
                const propResult = await this.validator.validateProperty(propertyId, value, {
                    existingValues: valuesArray
                });
                
                itemResult.propertyResults.push({
                    propertyId: propertyId,
                    value: value,
                    ...propResult
                });
                
                if (!propResult.valid) {
                    itemResult.valid = false;
                    itemResult.errors.push(...propResult.errors);
                }
                
                itemResult.warnings.push(...propResult.warnings);
            }
        }
        
        return itemResult;
    }
}
```

## UI Enhancement Strategies

### 1. Smart Autocomplete

```javascript
class ConstraintBasedAutocomplete {
    constructor(field, propertyData) {
        this.field = field;
        this.propertyData = propertyData;
        this.setupAutocomplete();
    }
    
    setupAutocomplete() {
        const valueTypeConstraints = this.propertyData.constraints
            .filter(c => c.type === 'Value type constraint');
        
        if (valueTypeConstraints.length > 0) {
            this.enableSmartSearch(valueTypeConstraints);
        }
        
        const allowedValues = this.propertyData.constraints
            .find(c => c.type === 'Allowed values constraint');
        
        if (allowedValues) {
            this.enableFixedOptions(allowedValues);
        }
    }
    
    async enableSmartSearch(valueTypeConstraints) {
        this.field.addEventListener('input', debounce(async (e) => {
            const query = e.target.value;
            if (query.length < 2) return;
            
            const suggestions = await this.searchConstrainedItems(query, valueTypeConstraints);
            this.displaySuggestions(suggestions);
        }, 300));
    }
    
    async searchConstrainedItems(query, constraints) {
        // Use Wikidata search API with type constraints
        const classFilters = constraints.flatMap(c => c.qualifiers.P2308 || []);
        const sparqlQuery = this.buildTypeConstrainedQuery(query, classFilters);
        
        return await executeWikidataQuery(sparqlQuery);
    }
}
```

### 2. Visual Constraint Indicators

```javascript
class ConstraintIndicators {
    static addToField(field, constraints) {
        const indicator = document.createElement('div');
        indicator.className = 'constraint-indicators';
        
        constraints.forEach(constraint => {
            const badge = this.createConstraintBadge(constraint);
            indicator.appendChild(badge);
        });
        
        field.parentNode.appendChild(indicator);
    }
    
    static createConstraintBadge(constraint) {
        const badge = document.createElement('span');
        badge.className = `constraint-badge constraint-${constraint.type.toLowerCase().replace(/\s+/g, '-')}`;
        badge.textContent = this.getConstraintSymbol(constraint.type);
        badge.title = this.getConstraintDescription(constraint);
        
        return badge;
    }
    
    static getConstraintSymbol(type) {
        const symbols = {
            'Format constraint': '📝',
            'Allowed values constraint': '📋',
            'Value type constraint': '🔗',
            'Single value constraint': '1️⃣',
            'Multi-value constraint': '🔢',
            'Required constraint': '❗',
            'Distinct values constraint': '🔄'
        };
        
        return symbols[type] || '⚙️';
    }
}
```

### 3. Real-time Validation Feedback

```javascript
class RealTimeValidator {
    constructor(field, validator, propertyId) {
        this.field = field;
        this.validator = validator;
        this.propertyId = propertyId;
        this.setupRealTimeValidation();
    }
    
    setupRealTimeValidation() {
        this.field.addEventListener('input', debounce(() => {
            this.validateAndShowFeedback();
        }, 500));
        
        this.field.addEventListener('blur', () => {
            this.validateAndShowFeedback(true); // Show all errors on blur
        });
    }
    
    async validateAndShowFeedback(showAll = false) {
        const value = this.field.value;
        if (!value && !showAll) return;
        
        const result = await this.validator.validateProperty(this.propertyId, value);
        this.displayFeedback(result, showAll);
    }
    
    displayFeedback(result, showAll) {
        this.clearFeedback();
        
        const feedbackContainer = this.getOrCreateFeedbackContainer();
        
        if (result.valid) {
            this.showSuccess(feedbackContainer);
        } else {
            if (showAll || result.errors.some(e => e.severity === 'error')) {
                this.showErrors(feedbackContainer, result.errors);
            }
        }
        
        if (result.warnings.length > 0 && showAll) {
            this.showWarnings(feedbackContainer, result.warnings);
        }
    }
}
```

## Error Handling

### API Error Management

```javascript
class WikidataAPIError extends Error {
    constructor(message, propertyId, apiResponse) {
        super(message);
        this.name = 'WikidataAPIError';
        this.propertyId = propertyId;
        this.apiResponse = apiResponse;
    }
}

class ErrorHandlingWrapper {
    constructor(baseValidator) {
        this.baseValidator = baseValidator;
        this.retryCount = 3;
        this.retryDelay = 1000;
    }
    
    async validateProperty(propertyId, value, options = {}) {
        for (let attempt = 1; attempt <= this.retryCount; attempt++) {
            try {
                return await this.baseValidator.validateProperty(propertyId, value, options);
            } catch (error) {
                if (attempt === this.retryCount) {
                    return this.handleFinalError(error, propertyId, value);
                }
                
                if (this.shouldRetry(error)) {
                    await this.delay(this.retryDelay * attempt);
                    continue;
                }
                
                throw error;
            }
        }
    }
    
    shouldRetry(error) {
        return error.name === 'WikidataAPIError' ||
               error.message.includes('network') ||
               error.message.includes('timeout');
    }
    
    handleFinalError(error, propertyId, value) {
        console.error(`Final validation error for ${propertyId}:`, error);
        
        return {
            valid: false,
            errors: [`Unable to validate ${propertyId}: ${error.message}`],
            warnings: ['Validation service temporarily unavailable'],
            fallbackMode: true
        };
    }
}
```

## Performance Considerations

### Caching Strategy

```javascript
class ConstraintCache {
    constructor(ttlMs = 1000 * 60 * 60) { // 1 hour default TTL
        this.cache = new Map();
        this.ttl = ttlMs;
    }
    
    set(key, value) {
        this.cache.set(key, {
            value: value,
            timestamp: Date.now()
        });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    clear() {
        this.cache.clear();
    }
    
    size() {
        return this.cache.size;
    }
}
```

### Batch Processing

```javascript
class BatchConstraintLoader {
    constructor(maxConcurrent = 5) {
        this.maxConcurrent = maxConcurrent;
        this.queue = [];
        this.active = 0;
    }
    
    async loadConstraints(propertyIds) {
        const promises = propertyIds.map(id => this.queueLoad(id));
        return Promise.all(promises);
    }
    
    queueLoad(propertyId) {
        return new Promise((resolve, reject) => {
            this.queue.push({ propertyId, resolve, reject });
            this.processQueue();
        });
    }
    
    async processQueue() {
        if (this.active >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }
        
        this.active++;
        const { propertyId, resolve, reject } = this.queue.shift();
        
        try {
            const result = await fetchPropertyData(propertyId);
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.active--;
            this.processQueue();
        }
    }
}
```

## Example Implementations

### Complete Form Integration

```javascript
// Complete example: Property-aware form field
class WikidataPropertyField extends HTMLElement {
    constructor() {
        super();
        this.propertyId = this.getAttribute('property-id');
        this.validator = new WikidataPropertyValidator(new PropertyConstraintManager());
    }
    
    async connectedCallback() {
        await this.initialize();
    }
    
    async initialize() {
        const propertyData = await this.validator.propertyManager.getPropertyConstraints(this.propertyId);
        
        this.innerHTML = `
            <label>${propertyData.label}</label>
            <div class="field-container">
                ${this.createFieldHTML(propertyData)}
                <div class="constraint-indicators"></div>
                <div class="validation-feedback"></div>
            </div>
        `;
        
        this.setupValidation(propertyData);
        this.setupConstraintIndicators(propertyData.constraints);
    }
    
    createFieldHTML(propertyData) {
        // Create appropriate field type based on data type and constraints
        const allowedValues = propertyData.constraints.find(c => c.type === 'Allowed values constraint');
        
        if (allowedValues) {
            return this.createSelectField(allowedValues.qualifiers.P2305);
        }
        
        switch (propertyData.dataType) {
            case 'time':
                return '<input type="date" class="property-field" />';
            case 'url':
                return '<input type="url" class="property-field" />';
            case 'quantity':
                return this.createQuantityField(propertyData.constraints);
            default:
                return '<input type="text" class="property-field" />';
        }
    }
}

// Register the custom element
customElements.define('wikidata-property-field', WikidataPropertyField);
```

### Usage in HTML

```html
<!-- Automatic property-aware fields -->
<form id="wikidata-form">
    <wikidata-property-field property-id="P31"></wikidata-property-field>
    <wikidata-property-field property-id="P21"></wikidata-property-field>
    <wikidata-property-field property-id="P569"></wikidata-property-field>
    <wikidata-property-field property-id="P625"></wikidata-property-field>
</form>
```

## Integration Benefits Summary

### Data Quality Improvements
- **Reduced validation errors**: Pre-validate data against Wikidata standards
- **Consistency enforcement**: Ensure uniform data formats across entries
- **Error prevention**: Block invalid inputs before submission
- **Quality scoring**: Assess data quality based on constraint compliance

### User Experience Enhancements
- **Smart suggestions**: Context-aware autocomplete based on constraints
- **Visual guidance**: Clear indicators of field requirements and restrictions
- **Real-time feedback**: Immediate validation without form submission
- **Reduced cognitive load**: Pre-populated options and guided inputs

### Developer Benefits
- **Standardized validation**: Reusable validation logic across applications
- **Future-proof**: Automatically adapts to Wikidata constraint changes
- **Comprehensive coverage**: Handles all major constraint types
- **Performance optimized**: Caching and batching for efficient API usage

### Compliance Advantages
- **Wikidata compatibility**: Ensures data meets Wikidata requirements
- **Automated compliance**: Reduces manual review requirements
- **Audit trails**: Track constraint violations and compliance metrics
- **Quality metrics**: Quantifiable data quality measurements

This comprehensive integration approach transforms basic form fields into intelligent, constraint-aware components that significantly improve data quality and user experience while ensuring compliance with Wikidata standards.