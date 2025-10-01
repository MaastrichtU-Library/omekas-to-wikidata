# Testing Strategy

## Overview

This testing strategy focuses exclusively on **function testing** and **data testing** as specified. User interface testing is conducted manually by humans and is not covered by automated tests.

## Testing Scope

### Included (Automated Testing)
- **Function Testing**: All JavaScript functions and methods
- **Data Testing**: Data transformation, validation, and processing
- **Integration Testing**: API interactions and data flow
- **Edge Case Testing**: Boundary conditions and error scenarios

### Excluded (Manual Testing Only)
- **UI Testing**: Visual interface testing
- **User Experience Testing**: Workflow and usability testing
- **Browser Compatibility Testing**: Cross-browser verification
- **Accessibility Testing**: Screen reader and keyboard navigation

## Test Framework Setup

### Test Environment Configuration
```javascript
// test-setup.js
import { jest } from '@jest/globals';

// Global test configuration
global.fetch = jest.fn();
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn()
};

// Mock DOM APIs for Node.js environment
global.document = {
  createElement: jest.fn(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    }
  })),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => [])
};

global.window = {
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  },
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  }
};
```

### Test Utilities
```javascript
// test-utils.js
export class TestDataFactory {
  static createOmekaItem(id = 1, overrides = {}) {
    return {
      '@context': 'http://omeka.example.com/api-context',
      '@id': `http://omeka.example.com/api/items/${id}`,
      '@type': ['o:Item', 'dctype:Text'],
      'o:id': id,
      'dcterms:title': [
        {'@value': `Test Item ${id}`, 'type': 'literal', '@language': 'en'}
      ],
      'dcterms:creator': [
        {'@value': 'Test Creator', 'type': 'literal'}
      ],
      ...overrides
    };
  }
  
  static createOmekaCollection(itemCount = 10) {
    return {
      '@context': 'http://omeka.example.com/api-context',
      '@id': 'http://omeka.example.com/api/items',
      '@type': ['o:ResourceTemplateClass', 'hydra:Collection'],
      'hydra:member': Array(itemCount).fill(null).map((_, i) => 
        this.createOmekaItem(i + 1)
      ),
      'hydra:totalItems': itemCount,
      'hydra:view': {
        '@type': 'hydra:PartialCollectionView',
        'hydra:first': 'http://omeka.example.com/api/items?page=1',
        'hydra:next': itemCount > 10 ? 'http://omeka.example.com/api/items?page=2' : null,
        'hydra:last': `http://omeka.example.com/api/items?page=${Math.ceil(itemCount / 10)}`
      }
    };
  }
  
  static createWikidataProperty(id = 'P50', overrides = {}) {
    return {
      id,
      type: 'property',
      datatype: 'wikibase-item',
      labels: {
        en: {language: 'en', value: 'author'}
      },
      descriptions: {
        en: {language: 'en', value: 'main creator of a written work'}
      },
      claims: {},
      ...overrides
    };
  }
  
  static createReconciliationResult(confidence = 0.85, overrides = {}) {
    return {
      id: 'Q12345',
      name: 'John Smith',
      description: 'American author',
      score: confidence,
      match: confidence > 0.9,
      type: [{id: 'Q5', name: 'human'}],
      ...overrides
    };
  }
}

export class MockAPIClient {
  constructor(responses = {}) {
    this.responses = responses;
    this.requests = [];
  }
  
  async request(endpoint, options = {}) {
    this.requests.push({endpoint, options});
    
    const response = this.responses[endpoint];
    if (!response) {
      throw new Error(`No mock response for endpoint: ${endpoint}`);
    }
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data;
  }
  
  getRequests() {
    return this.requests;
  }
  
  reset() {
    this.requests = [];
  }
}
```

## Function Testing

### Data Transformation Functions
```javascript
// data-transformer.test.js
import { DataTransformer } from '../src/js/utils/data-transformer.js';
import { TestDataFactory } from './test-utils.js';

describe('DataTransformer', () => {
  let transformer;
  
  beforeEach(() => {
    transformer = new DataTransformer();
  });
  
  describe('omekaToInternal', () => {
    test('converts basic Omeka item to internal format', () => {
      const omekaItem = TestDataFactory.createOmekaItem(1);
      const result = transformer.omekaToInternal(omekaItem);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('omekaId', 1);
      expect(result).toHaveProperty('properties');
      expect(result.properties).toHaveProperty('dcterms:title');
      expect(result.properties['dcterms:title']).toHaveLength(1);
    });
    
    test('normalizes property values correctly', () => {
      const omekaItem = TestDataFactory.createOmekaItem(1, {
        'dcterms:title': [
          {'@value': 'English Title', 'type': 'literal', '@language': 'en'},
          {'@value': 'French Title', 'type': 'literal', '@language': 'fr'}
        ]
      });
      
      const result = transformer.omekaToInternal(omekaItem);
      const titleValues = result.properties['dcterms:title'];
      
      expect(titleValues).toHaveLength(2);
      expect(titleValues[0]).toEqual({
        text: 'English Title',
        language: 'en',
        type: 'literal',
        uri: null
      });
      expect(titleValues[1]).toEqual({
        text: 'French Title',
        language: 'fr',
        type: 'literal',
        uri: null
      });
    });
    
    test('filters out Omeka internal properties', () => {
      const omekaItem = TestDataFactory.createOmekaItem(1, {
        'o:created': '2023-01-01T00:00:00Z',
        'o:modified': '2023-01-02T00:00:00Z',
        'custom:localField': 'should be filtered'
      });
      
      const result = transformer.omekaToInternal(omekaItem);
      
      expect(result.properties).not.toHaveProperty('o:created');
      expect(result.properties).not.toHaveProperty('o:modified');
      expect(result.properties).not.toHaveProperty('custom:localField');
    });
    
    test('handles empty or null values', () => {
      const omekaItem = TestDataFactory.createOmekaItem(1, {
        'dcterms:description': null,
        'dcterms:subject': []
      });
      
      const result = transformer.omekaToInternal(omekaItem);
      
      expect(result.properties).not.toHaveProperty('dcterms:description');
      expect(result.properties).not.toHaveProperty('dcterms:subject');
    });
  });
  
  describe('internalToQuickStatements', () => {
    test('generates basic QuickStatements syntax', () => {
      const internalItem = {
        id: 'test-item-1',
        properties: {
          'P1476': [{text: 'Test Title', type: 'string'}],
          'P50': [{text: 'Q12345', type: 'wikibase-item'}]
        },
        sources: [
          {property: 'P248', value: 'Q54919'}
        ]
      };
      
      const result = transformer.internalToQuickStatements([internalItem]);
      
      expect(result).toMatch(/^CREATE$/m);
      expect(result).toMatch(/P1476\s+"Test Title"/);
      expect(result).toMatch(/P50\s+Q12345/);
      expect(result).toMatch(/S\d+\s+P248\s+Q54919/);
    });
    
    test('handles multi-value properties', () => {
      const internalItem = {
        id: 'test-item-1',
        properties: {
          'P50': [
            {text: 'Q12345', type: 'wikibase-item'},
            {text: 'Q67890', type: 'wikibase-item'}
          ]
        }
      };
      
      const result = transformer.internalToQuickStatements([internalItem]);
      const lines = result.split('\n').filter(line => line.includes('P50'));
      
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatch(/P50\s+Q12345/);
      expect(lines[1]).toMatch(/P50\s+Q67890/);
    });
    
    test('includes qualifiers in correct format', () => {
      const internalItem = {
        id: 'test-item-1',
        properties: {
          'P50': [{
            text: 'Q12345',
            type: 'wikibase-item',
            qualifiers: {
              'P1810': 'John Smith'
            }
          }]
        }
      };
      
      const result = transformer.internalToQuickStatements([internalItem]);
      
      expect(result).toMatch(/P50\s+Q12345\s+P1810\s+"John Smith"/);
    });
  });
});
```

### Property Mapping Functions
```javascript
// property-mapper.test.js
import { PropertyMapper } from '../src/js/utils/property-mapper.js';

describe('PropertyMapper', () => {
  let mapper;
  
  beforeEach(() => {
    mapper = new PropertyMapper();
  });
  
  describe('mapProperty', () => {
    test('creates valid mapping between properties', () => {
      const result = mapper.mapProperty('dcterms:title', 'P1476');
      
      expect(result).toEqual({
        sourceProperty: 'dcterms:title',
        targetProperty: 'P1476',
        mappingType: 'direct',
        confidence: 1.0,
        source: 'manual'
      });
    });
    
    test('validates property names', () => {
      expect(() => {
        mapper.mapProperty('', 'P1476');
      }).toThrow('Source property cannot be empty');
      
      expect(() => {
        mapper.mapProperty('dcterms:title', 'invalid');
      }).toThrow('Target property must be valid Wikidata property ID');
    });
    
    test('detects existing mappings', () => {
      mapper.mapProperty('dcterms:title', 'P1476');
      
      expect(() => {
        mapper.mapProperty('dcterms:title', 'P1813');
      }).toThrow('Property already mapped');
    });
  });
  
  describe('suggestMappings', () => {
    test('suggests mappings based on property names', () => {
      const suggestions = mapper.suggestMappings(['dcterms:title', 'dcterms:creator']);
      
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toMatchObject({
        sourceProperty: 'dcterms:title',
        suggestions: expect.arrayContaining([
          expect.objectContaining({targetProperty: 'P1476'})
        ])
      });
    });
    
    test('filters suggestions by confidence threshold', () => {
      const suggestions = mapper.suggestMappings(['unknown:property'], {
        minConfidence: 0.8
      });
      
      expect(suggestions[0].suggestions).toHaveLength(0);
    });
  });
  
  describe('validateMapping', () => {
    test('validates compatible data types', () => {
      const result = mapper.validateMapping('dcterms:title', 'P1476');
      
      expect(result.isValid).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0.8);
    });
    
    test('warns about incompatible data types', () => {
      const result = mapper.validateMapping('dcterms:title', 'P50'); // title -> author
      
      expect(result.isValid).toBeTruthy(); // Still valid but not ideal
      expect(result.warnings).toContain('Data type mismatch detected');
    });
  });
});
```

### Validation Functions
```javascript
// validation.test.js
import { EntitySchemaValidator, PropertyConstraintValidator } from '../src/js/utils/validation.js';
import { TestDataFactory } from './test-utils.js';

describe('EntitySchemaValidator', () => {
  let validator;
  
  beforeEach(() => {
    validator = new EntitySchemaValidator();
  });
  
  test('validates required properties', () => {
    const schema = {
      id: 'E473',
      requiredProperties: ['P31', 'P1476'],
      recommendedProperties: ['P50']
    };
    
    const item = {
      properties: {
        'P31': [{text: 'Q3331189', type: 'wikibase-item'}],
        'P1476': [{text: 'Test Title', type: 'string'}]
      }
    };
    
    const result = validator.validate(item, schema);
    
    expect(result.isValid).toBeTruthy();
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain('Missing recommended property: P50');
  });
  
  test('detects missing required properties', () => {
    const schema = {
      id: 'E473',
      requiredProperties: ['P31', 'P1476']
    };
    
    const item = {
      properties: {
        'P31': [{text: 'Q3331189', type: 'wikibase-item'}]
        // Missing P1476
      }
    };
    
    const result = validator.validate(item, schema);
    
    expect(result.isValid).toBeFalsy();
    expect(result.errors).toContain('Missing required property: P1476');
  });
  
  test('validates property value types', () => {
    const schema = {
      id: 'E473',
      requiredProperties: [{
        property: 'P50',
        datatype: 'wikibase-item'
      }]
    };
    
    const item = {
      properties: {
        'P50': [{text: 'John Smith', type: 'string'}] // Should be QID
      }
    };
    
    const result = validator.validate(item, schema);
    
    expect(result.isValid).toBeFalsy();
    expect(result.errors).toContain('P50 requires wikibase-item, got string');
  });
});

describe('PropertyConstraintValidator', () => {
  let validator;
  
  beforeEach(() => {
    validator = new PropertyConstraintValidator();
  });
  
  test('validates format constraints', () => {
    // Mock ISBN property constraints
    const constraints = {
      'P212': {
        datatype: 'string',
        format: /^(?:ISBN[-\s]?)?(?:\d[-\s]?){9}[\dX]$/
      }
    };
    
    validator.setConstraints(constraints);
    
    const validResult = validator.validateProperty('P212', '978-0-123456-78-9');
    expect(validResult.isValid).toBeTruthy();
    
    const invalidResult = validator.validateProperty('P212', 'invalid-isbn');
    expect(invalidResult.isValid).toBeFalsy();
    expect(invalidResult.violations).toContain('Invalid format for P212');
  });
  
  test('validates allowed values constraints', () => {
    const constraints = {
      'P31': {
        datatype: 'wikibase-item',
        allowedValues: ['Q5', 'Q101352', 'Q3331189']
      }
    };
    
    validator.setConstraints(constraints);
    
    const validResult = validator.validateProperty('P31', 'Q5');
    expect(validResult.isValid).toBeTruthy();
    
    const invalidResult = validator.validateProperty('P31', 'Q999999');
    expect(invalidResult.warnings).toContain('Value not in allowed values list for P31');
  });
});
```

## Data Testing

### API Response Processing
```javascript
// api-processing.test.js
import { OmekaSAPIClient, WikidataAPIClient } from '../src/js/api/clients.js';
import { MockAPIClient, TestDataFactory } from './test-utils.js';

describe('OmekaSAPIClient', () => {
  let client;
  let mockFetch;
  
  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    client = new OmekaSAPIClient('https://test.omeka.com/api');
  });
  
  test('processes collection response correctly', async () => {
    const mockResponse = TestDataFactory.createOmekaCollection(5);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    const result = await client.getItems();
    
    expect(result.items).toHaveLength(5);
    expect(result.totalItems).toBe(5);
    expect(result.pagination).toBeDefined();
    
    // Check normalization
    const firstItem = result.items[0];
    expect(firstItem).toHaveProperty('id');
    expect(firstItem).toHaveProperty('omekaId');
    expect(firstItem).toHaveProperty('properties');
    expect(firstItem.properties['dcterms:title']).toHaveLength(1);
  });
  
  test('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });
    
    await expect(client.getItems()).rejects.toThrow('HTTP 404: Not Found');
  });
  
  test('normalizes property values consistently', () => {
    const testValue = {'@value': 'Test Value', '@language': 'en', 'type': 'literal'};
    const normalized = client.normalizeValue(testValue);
    
    expect(normalized).toEqual({
      text: 'Test Value',
      language: 'en',
      type: 'literal',
      uri: null
    });
  });
});

describe('WikidataAPIClient', () => {
  let client;
  let mockFetch;
  
  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    client = new WikidataAPIClient();
  });
  
  test('processes search results correctly', async () => {
    const mockResponse = {
      search: [
        {
          id: 'P50',
          label: 'author',
          description: 'main creator of a written work',
          concepturi: 'http://www.wikidata.org/entity/P50'
        }
      ]
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    const result = await client.searchEntities('author', 'property');
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'P50',
      label: 'author',
      description: 'main creator of a written work',
      url: 'http://www.wikidata.org/entity/P50'
    });
  });
  
  test('executes SPARQL queries correctly', async () => {
    const mockSparqlResponse = {
      results: {
        bindings: [
          {
            property: {value: 'http://www.wikidata.org/prop/direct/P50'},
            propertyLabel: {value: 'author'},
            usage: {value: '150'}
          }
        ]
      }
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSparqlResponse)
    });
    
    const query = 'SELECT ?property ?propertyLabel WHERE { ?item ?property ?value }';
    const result = await client.sparqlQuery(query);
    
    expect(result.results.bindings).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://query.wikidata.org/sparql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/sparql-query'
        }),
        body: query
      })
    );
  });
});
```

### State Management Testing
```javascript
// state-management.test.js
import { ApplicationState } from '../src/js/state.js';

describe('ApplicationState', () => {
  let state;
  
  beforeEach(() => {
    state = new ApplicationState();
  });
  
  test('initializes with default state', () => {
    expect(state.getState('workflow.currentStep')).toBe(1);
    expect(state.getState('workflow.completedSteps')).toEqual([]);
    expect(state.getState('datasources.omekaApiResponses')).toEqual([]);
  });
  
  test('updates state and notifies listeners', () => {
    const listener = jest.fn();
    const unsubscribe = state.subscribe('workflow.currentStep', listener);
    
    state.setState('workflow.currentStep', 2);
    
    expect(state.getState('workflow.currentStep')).toBe(2);
    expect(listener).toHaveBeenCalledWith(2, 1, 'workflow.currentStep');
    
    unsubscribe();
  });
  
  test('saves state history for undo functionality', () => {
    state.setState('workflow.currentStep', 2);
    state.setState('workflow.currentStep', 3);
    
    expect(state.history).toHaveLength(2);
    
    const previousState = state.undo();
    expect(previousState.workflow.currentStep).toBe(2);
  });
  
  test('validates state before transitions', () => {
    const validation = state.validateStepTransition(1, 3);
    
    expect(validation.isValid).toBeFalsy();
    expect(validation.errors).toContain('Cannot skip steps');
  });
  
  test('exports and imports state correctly', () => {
    state.setState('workflow.currentStep', 3);
    state.setState('workflow.completedSteps', [1, 2]);
    
    const exported = state.exportState();
    const newState = new ApplicationState();
    newState.importState(exported);
    
    expect(newState.getState('workflow.currentStep')).toBe(3);
    expect(newState.getState('workflow.completedSteps')).toEqual([1, 2]);
  });
});
```

## Integration Testing

### End-to-End Data Flow
```javascript
// integration.test.js
import { WorkflowProcessor } from '../src/js/workflow-processor.js';
import { TestDataFactory, MockAPIClient } from './test-utils.js';

describe('Workflow Integration', () => {
  let processor;
  let mockOmekaClient;
  let mockWikidataClient;
  
  beforeEach(() => {
    mockOmekaClient = new MockAPIClient({
      'items?item_set_id=123': {
        data: TestDataFactory.createOmekaCollection(3)
      }
    });
    
    mockWikidataClient = new MockAPIClient({
      'search?query=author': {
        data: [TestDataFactory.createWikidataProperty('P50')]
      }
    });
    
    processor = new WorkflowProcessor({
      omekaClient: mockOmekaClient,
      wikidataClient: mockWikidataClient
    });
  });
  
  test('processes complete workflow from input to export', async () => {
    // Step 1: Load data
    const loadResult = await processor.loadCollection('items?item_set_id=123');
    expect(loadResult.success).toBeTruthy();
    expect(loadResult.data.items).toHaveLength(3);
    
    // Step 2: Apply mappings
    const mappings = [
      {sourceProperty: 'dcterms:title', targetProperty: 'P1476'},
      {sourceProperty: 'dcterms:creator', targetProperty: 'P50'}
    ];
    
    const mappingResult = processor.applyMappings(mappings);
    expect(mappingResult.success).toBeTruthy();
    
    // Step 3: Reconcile entities
    const reconciliations = {
      'item-1': {
        'P50': {result: 'Q12345', confidence: 0.9}
      }
    };
    
    const reconcileResult = processor.applyReconciliations(reconciliations);
    expect(reconcileResult.success).toBeTruthy();
    
    // Step 4: Add sources
    const sources = [
      {property: 'P248', value: 'Q54919'} // Collection QID
    ];
    
    const sourceResult = processor.addSources(sources);
    expect(sourceResult.success).toBeTruthy();
    
    // Step 5: Export
    const exportResult = processor.exportQuickStatements();
    expect(exportResult.success).toBeTruthy();
    expect(exportResult.statements).toMatch(/^CREATE$/m);
    expect(exportResult.statements).toMatch(/P1476/);
    expect(exportResult.statements).toMatch(/P50/);
  });
  
  test('handles errors gracefully throughout workflow', async () => {
    // Simulate API failure
    mockOmekaClient.responses['items?item_set_id=invalid'] = {
      error: 'Collection not found'
    };
    
    const result = await processor.loadCollection('items?item_set_id=invalid');
    
    expect(result.success).toBeFalsy();
    expect(result.error.message).toBe('Collection not found');
  });
});
```

## Performance Testing

### Data Processing Performance
```javascript
// performance.test.js
describe('Performance Tests', () => {
  test('handles large collections efficiently', async () => {
    const startTime = performance.now();
    
    const largeCollection = TestDataFactory.createOmekaCollection(500);
    const transformer = new DataTransformer();
    
    const processed = largeCollection['hydra:member'].map(item => 
      transformer.omekaToInternal(item)
    );
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(processed).toHaveLength(500);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });
  
  test('memory usage stays within limits', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process large dataset
    const largeCollection = TestDataFactory.createOmekaCollection(1000);
    const transformer = new DataTransformer();
    
    largeCollection['hydra:member'].forEach(item => {
      transformer.omekaToInternal(item);
    });
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable (less than 100MB)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });
});
```

## Test Execution Configuration

### Jest Configuration
```javascript
// jest.config.js
export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/test-setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/js/**/*.js',
    '!src/js/**/*.test.js',
    '!src/js/data/mock-data.js'
  ],
  coverageThreshold: {
    global: {
      functions: 90,
      lines: 85,
      statements: 85
    }
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/js/$1'
  }
};
```

### Test Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

This testing strategy ensures comprehensive coverage of all functions and data processing while maintaining the requirement that UI testing be conducted manually.