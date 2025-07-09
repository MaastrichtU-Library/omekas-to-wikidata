/**
 * Defines content templates for modals used in the application
 * Separates the content definitions from the modal UI functionality
 * @module ui/modal-content
 */
import { createElement, createFileInput } from './components.js';

/**
 * Returns the HTML content for the mapping modal
 * @returns {string} Modal content HTML
 */
export function getMappingModalContent() {
    return `
        <div class="mapping-model-preview">
            <div class="model-explanation">
                <h4>Mapping Data Structure</h4>
                <p>This is a preview of the internal mapping data structure that would be used to map Omeka S properties to Wikidata properties.</p>
                <pre class="model-schema">
{
  "mappings": {
    "nonLinkedKeys": ["title", "description", ...],  // Keys that need mapping
    "mappedKeys": ["creator", ...],                  // Keys already mapped to Wikidata properties
    "ignoredKeys": ["format", "rights", ...]         // Keys that will be ignored
  },
  "wikidataProperties": {
    "creator": {
      "property": "P170",
      "label": "creator",
      "datatype": "wikibase-item",
      "reconciliationService": "https://wikidata.reconci.link/en/api"
    },
    // Additional mapped properties would appear here
  }
}
                </pre>
            </div>
        </div>
    `;
}

/**
 * Returns the HTML content for the reconciliation modal
 * @returns {string} Modal content HTML
 */
export function getReconciliationModalContent() {
    return `
        <div class="reconciliation-model-preview">
            <div class="model-explanation">
                <h4>Reconciliation Functionality Overview</h4>
                <p>The reconciliation step allows you to match Omeka S data values with existing Wikidata entities using an OpenRefine-style interface.</p>
                
                <div class="feature-list">
                    <h5>Key Features:</h5>
                    <ul>
                        <li><strong>Interactive Table:</strong> Items displayed as rows, properties as columns</li>
                        <li><strong>Modal-based Workflow:</strong> Click any cell to open focused reconciliation modal</li>
                        <li><strong>Automatic Matching:</strong> Uses Wikidata Reconciliation API for intelligent suggestions</li>
                        <li><strong>Manual Search:</strong> Direct search of Wikidata when automatic matching fails</li>
                        <li><strong>Multiple Values:</strong> Support for properties with multiple values (e.g., multiple authors)</li>
                        <li><strong>Progress Tracking:</strong> Visual progress indicator and statistics</li>
                        <li><strong>Skip for Later:</strong> Temporarily skip difficult reconciliations</li>
                        <li><strong>Create New Items:</strong> Links to create new Wikidata items when no match exists</li>
                    </ul>
                </div>
                
                <div class="workflow-explanation">
                    <h5>Reconciliation Process:</h5>
                    <ol>
                        <li>Click on any property value in the table</li>
                        <li>Review automatic matches from Wikidata Reconciliation API</li>
                        <li>Use manual search if automatic matches aren't satisfactory</li>
                        <li>Select the best match or enter a custom value</li>
                        <li>Confirm selection to mark the cell as reconciled</li>
                        <li>Continue until all values are reconciled or skipped</li>
                    </ol>
                </div>
                
                <pre class="model-schema">
{
  "reconciliationProgress": {
    "total": 25,           // Total number of values to reconcile
    "completed": 18,       // Number of completed reconciliations
    "skipped": 2           // Number of skipped reconciliations
  },
  "reconciliationData": {
    "item-0": {
      "originalData": { /* Full Omeka S item data */ },
      "properties": {
        "creator": {
          "originalValues": ["Leonardo da Vinci"],
          "reconciled": [{
            "status": "reconciled",
            "selectedMatch": {
              "type": "wikidata",
              "id": "Q762",
              "label": "Leonardo da Vinci",
              "description": "Italian Renaissance polymath"
            },
            "confidence": 95
          }]
        },
        "publisher": {
          "originalValues": ["Penguin Books", "Random House"],
          "reconciled": [
            {
              "status": "reconciled",
              "selectedMatch": {
                "type": "wikidata",
                "id": "Q1757116",
                "label": "Penguin Books"
              }
            },
            {
              "status": "skipped"
            }
          ]
        }
      }
    }
  }
}
                </pre>
            </div>
        </div>
    `;
}