# Testing Scenarios

## Testing Strategy

### Testing Scope
Based on user requirements, testing focuses on **function testing** and **data testing** only. User interface testing will be conducted manually by humans.

### Testing Categories
1. **Function Testing**: Verify that all application functions work correctly
2. **Data Testing**: Validate data processing, transformation, and export accuracy
3. **Integration Testing**: Ensure API integrations function properly
4. **Edge Case Testing**: Handle boundary conditions and error scenarios

### Testing Exclusions
- **UI Testing**: Manual testing only (no automated UI tests)
- **Visual Regression Testing**: Manual verification
- **User Experience Testing**: Manual usability testing
- **Browser Compatibility Testing**: Manual cross-browser verification

## Function Testing

### Core Workflow Functions

#### State Management Functions
```javascript
// Test state initialization
describe('Application State', () => {
  test('initializes with empty state', () => {
    const state = new ApplicationState();
    expect(state.currentStep).toBe(1);
    expect(state.datasources.omekaApiResponses).toHaveLength(0);
    expect(state.workflow.stepStates.mapping).toEqual({});
  });
  
  test('preserves state during step navigation', () => {
    const state = new ApplicationState();
    state.setCurrentStep(2);
    state.setMappingData({key: 'value'});
    
    expect(state.currentStep).toBe(2);
    expect(state.getMappingData()).toEqual({key: 'value'});
  });
  
  test('validates state before export', () => {
    const state = new ApplicationState();
    const validation = state.validateForExport();
    expect(validation.isValid).toBeFalsy();
    expect(validation.errors).toContain('No mapping data available');
  });
});
```

#### Property Mapping Functions
```javascript
describe('Property Mapping', () => {
  test('maps Omeka property to Wikidata property', () => {
    const mapper = new PropertyMapper();
    const result = mapper.mapProperty('dcterms:title', 'P1476');
    
    expect(result.sourceProperty).toBe('dcterms:title');
    expect(result.targetProperty).toBe('P1476');
    expect(result.mappingType).toBe('direct');
  });
  
  test('handles unmapped properties', () => {
    const mapper = new PropertyMapper();
    const result = mapper.getUnmappedProperties(['dcterms:title', 'custom:field']);
    
    expect(result).toContain('custom:field');
    expect(result).not.toContain('dcterms:title');
  });
  
  test('validates property mappings', () => {
    const mapper = new PropertyMapper();
    const validation = mapper.validateMapping('dcterms:title', 'P1476');
    
    expect(validation.isValid).toBeTruthy();
    expect(validation.confidence).toBeGreaterThan(0.8);
  });
});
```

#### Reconciliation Functions
```javascript
describe('Entity Reconciliation', () => {
  test('processes reconciliation suggestions', () => {
    const reconciler = new EntityReconciler();
    const suggestions = reconciler.processReconciliationResults(mockApiResponse);
    
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toHaveProperty('qid');
    expect(suggestions[0]).toHaveProperty('confidence');
  });
  
  test('filters suggestions by confidence threshold', () => {
    const reconciler = new EntityReconciler();
    const filtered = reconciler.filterByConfidence(mockSuggestions, 0.6);
    
    expect(filtered.every(s => s.confidence >= 0.6)).toBeTruthy();
  });
  
  test('handles no reconciliation matches', () => {
    const reconciler = new EntityReconciler();
    const result = reconciler.reconcileValue('nonexistent entity');
    
    expect(result.suggestions).toHaveLength(0);
    expect(result.requiresManualInput).toBeTruthy();
  });
});
```

#### Export Functions
```javascript
describe('QuickStatements Export', () => {
  test('generates valid QuickStatements syntax', () => {
    const exporter = new QuickStatementsExporter();
    const statements = exporter.generateStatements(mockWikidataItems);
    
    expect(statements).toMatch(/^CREATE$/m);
    expect(statements).toMatch(/P\d+\s+"[^"]+"/);
    expect(statements).not.toMatch(/\t\t\t/); // No excessive tabs
  });
  
  test('handles multi-value properties', () => {
    const exporter = new QuickStatementsExporter();
    const item = {
      properties: {
        'P50': ['Q12345', 'Q67890'] // Multiple authors
      }
    };
    const statements = exporter.generateStatements([item]);
    
    expect(statements.split('\n').filter(line => line.includes('P50'))).toHaveLength(2);
  });
  
  test('includes proper source citations', () => {
    const exporter = new QuickStatementsExporter();
    const statements = exporter.generateStatements(mockItemsWithSources);
    
    expect(statements).toMatch(/S\d+/); // Source references
    expect(statements).toMatch(/P248/); // "stated in" property
  });
});
```

### API Integration Functions

#### Omeka S API Functions
```javascript
describe('Omeka S API Integration', () => {
  test('fetches collection data', async () => {
    const api = new OmekaSApi();
    const data = await api.fetchCollection(mockApiUrl);
    
    expect(data).toHaveProperty('hydra:member');
    expect(data['hydra:member']).toBeInstanceOf(Array);
  });
  
  test('handles API errors gracefully', async () => {
    const api = new OmekaSApi();
    const result = await api.fetchCollection('invalid-url');
    
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });
  
  test('normalizes property values', () => {
    const api = new OmekaSApi();
    const normalized = api.normalizePropertyValues(mockOmekaProperty);
    
    expect(normalized).toHaveProperty('text');
    expect(normalized).toHaveProperty('language');
    expect(normalized).toHaveProperty('type');
  });
});
```

#### Wikidata API Functions
```javascript
describe('Wikidata API Integration', () => {
  test('searches properties by label', async () => {
    const api = new WikidataApi();
    const results = await api.searchProperties('author');
    
    expect(results).toBeInstanceOf(Array);
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('label');
  });
  
  test('gets property constraints', async () => {
    const api = new WikidataApi();
    const constraints = await api.getPropertyConstraints('P50');
    
    expect(constraints).toHaveProperty('datatype');
    expect(constraints.datatype).toBe('wikibase-item');
  });
  
  test('queries collection properties via SPARQL', async () => {
    const api = new WikidataApi();
    const properties = await api.getCollectionProperties('Q123456');
    
    expect(properties).toBeInstanceOf(Array);
    expect(properties[0]).toHaveProperty('property');
    expect(properties[0]).toHaveProperty('usage');
  });
});
```

## Data Testing

### Data Transformation Testing

#### Omeka S to Internal Format
```javascript
describe('Data Transformation', () => {
  test('converts Omeka S item to internal format', () => {
    const transformer = new DataTransformer();
    const internal = transformer.omekaToInternal(mockOmekaItem);
    
    expect(internal).toHaveProperty('id');
    expect(internal).toHaveProperty('properties');
    expect(internal.properties['dcterms:title']).toBeDefined();
  });
  
  test('handles multi-language values', () => {
    const transformer = new DataTransformer();
    const internal = transformer.omekaToInternal(mockMultiLangItem);
    
    expect(internal.properties['dcterms:title']).toHaveLength(2);
    expect(internal.properties['dcterms:title'][0].language).toBe('en');
    expect(internal.properties['dcterms:title'][1].language).toBe('fr');
  });
  
  test('filters out custom properties', () => {
    const transformer = new DataTransformer();
    const internal = transformer.omekaToInternal(mockItemWithCustomFields);
    
    expect(internal.properties).not.toHaveProperty('custom:localField');
    expect(internal.properties).toHaveProperty('dcterms:title');
  });
});
```

#### Internal to QuickStatements Format
```javascript
describe('QuickStatements Data Format', () => {
  test('formats basic statements correctly', () => {
    const formatter = new QuickStatementsFormatter();
    const qs = formatter.formatItem(mockInternalItem);
    
    expect(qs).toMatch(/^CREATE$/);
    expect(qs).toMatch(/P1476\s+"Test Title"/);
    expect(qs).toMatch(/P50\s+Q12345/);
  });
  
  test('handles qualifiers correctly', () => {
    const formatter = new QuickStatementsFormatter();
    const item = {
      properties: {
        'P50': {
          value: 'Q12345',
          qualifiers: {
            'P1810': 'John Smith' // named as
          }
        }
      }
    };
    const qs = formatter.formatItem(item);
    
    expect(qs).toMatch(/P50\s+Q12345\s+P1810\s+"John Smith"/);
  });
  
  test('includes source references', () => {
    const formatter = new QuickStatementsFormatter();
    const qs = formatter.formatItem(mockItemWithSources);
    
    expect(qs).toMatch(/S\d+\s+P248\s+Q\d+/); // stated in source
    expect(qs).toMatch(/S\d+\s+P854\s+"https?:\/\//); // reference URL
  });
});
```

### Data Validation Testing

#### Entity Schema Validation
```javascript
describe('Entity Schema Validation', () => {
  test('validates required properties', () => {
    const validator = new EntitySchemaValidator();
    const result = validator.validate(mockItemMissingRequired, 'E473');
    
    expect(result.isValid).toBeFalsy();
    expect(result.errors).toContain('Missing required property: P31');
  });
  
  test('validates property data types', () => {
    const validator = new EntitySchemaValidator();
    const result = validator.validate(mockItemWrongDataType, 'E473');
    
    expect(result.isValid).toBeFalsy();
    expect(result.errors).toContain('P50 requires wikibase-item, got string');
  });
  
  test('allows valid items to pass', () => {
    const validator = new EntitySchemaValidator();
    const result = validator.validate(mockValidItem, 'E473');
    
    expect(result.isValid).toBeTruthy();
    expect(result.errors).toHaveLength(0);
  });
});
```

#### Property Constraint Validation
```javascript
describe('Property Constraint Validation', () => {
  test('validates value type constraints', () => {
    const validator = new PropertyConstraintValidator();
    const result = validator.validateProperty('P50', 'string value'); // Should be QID
    
    expect(result.isValid).toBeFalsy();
    expect(result.violations).toContain('Expected wikibase-item, got string');
  });
  
  test('validates allowed values constraints', () => {
    const validator = new PropertyConstraintValidator();
    const result = validator.validateProperty('P31', 'Q999999'); // Invalid instance
    
    expect(result.warnings).toContain('Value not in allowed values list');
  });
  
  test('validates format constraints', () => {
    const validator = new PropertyConstraintValidator();
    const result = validator.validateProperty('P212', 'invalid-isbn'); // ISBN format
    
    expect(result.isValid).toBeFalsy();
    expect(result.violations).toContain('Invalid ISBN format');
  });
});
```

## Integration Testing

### End-to-End Workflow Testing
```javascript
describe('Complete Workflow', () => {
  test('processes full collection workflow', async () => {
    const workflow = new WorkflowProcessor();
    
    // Step 1: Load data
    const loadResult = await workflow.loadOmekaCollection(mockApiUrl);
    expect(loadResult.success).toBeTruthy();
    
    // Step 2: Apply mappings
    const mappingResult = workflow.applyPropertyMappings(mockMappings);
    expect(mappingResult.success).toBeTruthy();
    
    // Step 3: Reconcile entities
    const reconcileResult = await workflow.reconcileEntities(mockReconciliations);
    expect(reconcileResult.success).toBeTruthy();
    
    // Step 4: Design items
    const designResult = workflow.designWikidataItems(mockSources);
    expect(designResult.success).toBeTruthy();
    
    // Step 5: Export
    const exportResult = workflow.exportQuickStatements();
    expect(exportResult.success).toBeTruthy();
    expect(exportResult.statements).toMatch(/^CREATE$/m);
  });
});
```

### Error Handling Testing
```javascript
describe('Error Handling', () => {
  test('handles API timeouts gracefully', async () => {
    const api = new OmekaSApi();
    jest.setTimeout(1000); // Short timeout
    
    const result = await api.fetchCollection(mockSlowApiUrl);
    expect(result.error).toBeTruthy();
    expect(result.error.type).toBe('timeout');
  });
  
  test('recovers from network failures', async () => {
    const api = new WikidataApi();
    
    // Mock network failure then recovery
    const result = await api.searchPropertiesWithRetry('author');
    expect(result.attempts).toBeGreaterThan(1);
    expect(result.success).toBeTruthy();
  });
  
  test('handles malformed JSON responses', () => {
    const parser = new ResponseParser();
    const result = parser.parseOmekaResponse('invalid json');
    
    expect(result.error).toBeTruthy();
    expect(result.error.type).toBe('parse_error');
  });
});
```

## Test Data Management

### Mock Data Structure
```javascript
// Mock Omeka S API Response
const mockOmekaItem = {
  "@context": "http://omeka.example.com/api-context",
  "@id": "http://omeka.example.com/api/items/1",
  "@type": ["o:Item", "dctype:Text"],
  "o:id": 1,
  "dcterms:title": [
    {"@value": "Example Book", "type": "literal", "@language": "en"}
  ],
  "dcterms:creator": [
    {"@value": "John Smith", "type": "literal"}
  ]
};

// Mock Wikidata Reconciliation Response
const mockReconciliationResponse = {
  "q0": {
    "result": [
      {
        "id": "Q12345",
        "name": "John Smith",
        "description": "American author",
        "score": 0.85,
        "match": false,
        "type": [{"id": "Q5", "name": "human"}]
      }
    ]
  }
};

// Mock Entity Schema
const mockEntitySchema = {
  "id": "E473",
  "required_properties": [
    {"property": "P31", "values": ["Q3331189"]},
    {"property": "P1476", "required": true}
  ],
  "recommended_properties": [
    {"property": "P50"},
    {"property": "P577"}
  ]
};
```

### Test Environment Setup
```javascript
// Test configuration
const testConfig = {
  apiEndpoints: {
    omeka: 'http://test-omeka.example.com/api',
    wikidata: 'https://test.wikidata.org/w/api.php',
    sparql: 'https://query.wikidata.org/sparql'
  },
  timeouts: {
    api: 5000,
    reconciliation: 10000
  },
  retries: {
    maxAttempts: 3,
    backoffMs: 1000
  }
};

// Test utilities
class TestDataFactory {
  static createOmekaCollection(itemCount = 10) {
    return {
      "hydra:member": Array(itemCount).fill(null).map((_, i) => 
        this.createOmekaItem(i + 1)
      ),
      "hydra:totalItems": itemCount
    };
  }
  
  static createOmekaItem(id) {
    return {
      "@id": `http://test.example.com/api/items/${id}`,
      "o:id": id,
      "dcterms:title": [{"@value": `Test Item ${id}`, "type": "literal"}]
    };
  }
}
```

## Test Execution Strategy

### Continuous Integration
```yaml
# CI Pipeline for Function and Data Testing
test_pipeline:
  stages:
    - unit_tests:
        - function_tests
        - data_transformation_tests
        - validation_tests
    - integration_tests:
        - api_integration_tests
        - workflow_tests
    - edge_case_tests:
        - error_handling_tests
        - boundary_condition_tests
  
  coverage_requirements:
    functions: 90%
    data_processing: 95%
    api_integration: 80%
```

### Manual Testing Coordination
- **Function Testing**: Automated via test suite
- **Data Testing**: Automated validation with sample datasets
- **UI Testing**: Manual testing protocols for human verification
- **Integration Testing**: Combination of automated API tests and manual workflow verification

This comprehensive testing strategy ensures data integrity and functional reliability while respecting the requirement for manual UI testing.