/**
 * Defines content templates for modals used in the application
 * Separates the content definitions from the modal UI functionality
 * @module ui/modal-content
 */

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
                <h4>Reconciliation Data Structure</h4>
                <p>This is a preview of the internal reconciliation data structure that would be used to match Omeka S values to Wikidata entities.</p>
                <pre class="model-schema">
{
  "reconciliationProgress": {
    "total": 10,           // Total number of items to reconcile
    "completed": 3         // Number of completed reconciliations
  },
  "reconciliationData": [
    {
      "id": "item1",
      "properties": {
        "creator": {
          "original": "Leonardo da Vinci",
          "reconciled": {
            "id": "Q762",
            "label": "Leonardo da Vinci",
            "description": "Italian Renaissance polymath",
            "score": 0.98,
            "match": true
          }
        }
      }
    }
  ]
}
                </pre>
            </div>
        </div>
    `;
}