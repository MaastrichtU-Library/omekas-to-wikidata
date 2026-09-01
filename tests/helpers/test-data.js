/**
 * Test data generators and utilities
 */

/**
 * Generate sample Omeka S JSON data for testing
 * @param {number} itemCount - Number of items to generate
 * @returns {Object} Sample Omeka S JSON structure
 */
export function generateSampleOmekaData(itemCount = 5) {
  const items = [];
  
  for (let i = 1; i <= itemCount; i++) {
    items.push({
      "id": i,
      "title": `Test Item ${i}`,
      "dcterms:title": [{
        "type": "literal",
        "property_id": 1,
        "@value": `Test Item ${i}`
      }],
      "dcterms:creator": [{
        "type": "literal", 
        "property_id": 2,
        "@value": `Creator ${i}`
      }],
      "dcterms:date": [{
        "type": "literal",
        "property_id": 4,
        "@value": `2024-01-${i.toString().padStart(2, '0')}`
      }],
      "dcterms:description": [{
        "type": "literal",
        "property_id": 3,
        "@value": `This is a description for test item ${i}`
      }]
    });
  }

  return {
    "metadata": {
      "total": itemCount,
      "export_date": new Date().toISOString(),
      "source": "test"
    },
    "items": items
  };
}

/**
 * Generate sample project save data
 * @returns {Object} Sample project structure
 */
export function generateSampleProject() {
  return {
    "version": "1.0",
    "created": new Date().toISOString(),
    "data": generateSampleOmekaData(3),
    "mappings": {
      "dcterms:title": {
        "wikidataProperty": "P1476",
        "propertyType": "string",
        "constraints": []
      },
      "dcterms:creator": {
        "wikidataProperty": "P170", 
        "propertyType": "wikibase-item",
        "constraints": []
      }
    },
    "reconciliations": {},
    "settings": {
      "language": "en",
      "instanceOf": "Q3331189"
    }
  };
}

/**
 * Generate expected QuickStatements output
 * @returns {string} Sample QuickStatements format
 */
export function generateExpectedQuickStatements() {
  return `CREATE
LAST|Len|"Test Item 1"
LAST|P1476|"Test Item 1"
LAST|P170|"Creator 1"

CREATE  
LAST|Len|"Test Item 2"
LAST|P1476|"Test Item 2"
LAST|P170|"Creator 2"

CREATE
LAST|Len|"Test Item 3" 
LAST|P1476|"Test Item 3"
LAST|P170|"Creator 3"`;
}

/**
 * Test data for different scenarios
 */
export const testScenarios = {
  simple: {
    name: "Simple data with basic properties",
    itemCount: 3,
    expectedMappings: 2
  },
  complex: {
    name: "Complex data with nested properties", 
    itemCount: 10,
    expectedMappings: 5
  },
  large: {
    name: "Large dataset for performance testing",
    itemCount: 100,
    expectedMappings: 8
  },
  minimal: {
    name: "Minimal data with required fields only",
    itemCount: 1,
    expectedMappings: 1
  }
};

/**
 * Common test selectors organized by functionality
 */
export const selectors = {
  // Navigation
  steps: {
    input: '[data-step="1"]',
    mapping: '[data-step="2"]', 
    reconciliation: '[data-step="3"]',
    designer: '[data-step="4"]',
    export: '[data-step="5"]'
  },
  
  // File operations
  fileUpload: 'input[type="file"]',
  saveProject: '#save-project',
  loadProject: '#load-project',
  
  // Modals
  modal: '.modal',
  modalClose: '.modal .close',
  modalSubmit: '.modal .btn-submit',
  
  // Forms
  propertySearch: '.property-search',
  searchResults: '.search-results',
  searchResult: '.search-result',
  
  // Status indicators
  processing: '.processing',
  loading: '.loading',
  progress: '.progress-bar',
  
  // Output
  quickstatements: '.quickstatements-output',
  exportButton: '.btn-export'
};

/**
 * Common test assertions
 */
export const assertions = {
  pageTitle: /Omeka S to Wikidata/,
  stepCount: 5,
  modalVisible: true,
  modalHidden: false,
  noConsoleErrors: []
};