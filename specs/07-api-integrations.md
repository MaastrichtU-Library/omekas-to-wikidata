# API Integrations

## Overview

The application integrates with multiple external APIs to provide seamless data flow from Omeka S collections to Wikidata. All integrations are read-only and client-side, with no server-side proxying or API key management.

## Omeka S API Integration

### API Specification
- **Version**: Omeka S REST API v1
- **Authentication**: Public endpoints only (no authentication supported)
- **Format**: JSON-LD responses
- **Base Pattern**: `{omeka-instance}/api/{endpoint}`

### Supported Endpoints

#### Items Endpoint
```
GET /api/items?page={page}&per_page={limit}&item_set_id={collection}

Response Structure:
{
  "@context": "http://omeka.example.com/api-context",
  "@id": "http://omeka.example.com/api/items",
  "@type": ["o:ResourceTemplateClass", "hydra:Collection"],
  "hydra:member": [
    {
      "@id": "http://omeka.example.com/api/items/1",
      "@type": ["o:Item", "dctype:Text"],
      "o:id": 1,
      "dcterms:title": [{"@value": "Title", "type": "literal"}],
      "dcterms:creator": [{"@value": "Creator Name", "type": "literal"}]
      // ... additional properties
    }
  ],
  "hydra:totalItems": 150,
  "hydra:view": {
    "@type": "hydra:PartialCollectionView",
    "hydra:first": "...",
    "hydra:next": "...",
    "hydra:last": "..."
  }
}
```

#### Individual Item Endpoint
```
GET /api/items/{id}

Response Structure:
{
  "@context": "http://omeka.example.com/api-context",
  "@id": "http://omeka.example.com/api/items/1",
  "@type": ["o:Item", "dctype:Text"],
  "o:id": 1,
  "o:resource_class": {"@id": "http://purl.org/dc/dcmitype/Text"},
  "o:resource_template": {"@id": "http://omeka.example.com/api/resource_templates/1"},
  "dcterms:title": [
    {"@value": "Example Title", "type": "literal", "@language": "en"}
  ],
  "dcterms:creator": [
    {"@value": "John Smith", "type": "literal"}
  ]
  // ... complete item data
}
```

### Data Processing Pipeline

#### Property Extraction
```javascript
function extractProperties(omekaItem) {
  const properties = {};
  const excludeKeys = ['@context', '@id', '@type', 'o:id', 'o:resource_class'];
  
  Object.keys(omekaItem).forEach(key => {
    if (!excludeKeys.includes(key) && !key.startsWith('o:')) {
      properties[key] = omekaItem[key];
    }
  });
  
  return properties;
}
```

#### Value Normalization
```javascript
function normalizeValues(propertyArray) {
  return propertyArray.map(value => ({
    text: value['@value'] || value,
    language: value['@language'] || null,
    type: value['type'] || 'literal',
    uri: value['@id'] || null
  }));
}
```

### Error Handling

#### Common Error Scenarios
- **404 Not Found**: Invalid endpoint or item ID
- **403 Forbidden**: Private collection or restricted access
- **429 Too Many Requests**: Rate limiting by server
- **500 Server Error**: Omeka S installation issues

#### Recovery Strategies
```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      
      if (response.status === 429) {
        // Rate limiting - wait and retry
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await delay(1000 * attempt);
    }
  }
}
```

## Wikidata API Integration

### Query Service (SPARQL)

#### Endpoint Configuration
- **URL**: `https://query.wikidata.org/sparql`
- **Method**: GET with query parameter
- **Format**: JSON results
- **Rate Limiting**: Respect service limits (no more than 1 query per second)

#### Property Discovery Query
```sparql
# Find properties used in a specific collection
SELECT ?property ?propertyLabel (COUNT(?item) as ?usage) WHERE {
  ?item wdt:P195 wd:Q123456 .  # Collection QID
  ?item ?property ?value .
  ?prop wikibase:directClaim ?property .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
GROUP BY ?property ?propertyLabel
ORDER BY DESC(?usage)
LIMIT 50
```

#### Property Constraint Query
```sparql
# Get constraints for a specific property
SELECT ?constraint ?constraintType ?constraintValue WHERE {
  wd:P50 p:P2302 ?constraint .
  ?constraint ps:P2302 ?constraintType .
  OPTIONAL { ?constraint pq:P2308 ?constraintValue }
}
```

### Reconciliation API

#### Endpoint Configuration
- **URL**: `https://wikidata.reconci.link/`
- **Method**: POST for batch queries
- **Format**: JSON request/response
- **Rate Limiting**: Maximum 10 entities per request

#### Query Structure
```javascript
const reconciliationQuery = {
  queries: {
    "q0": {
      "query": "John Smith",
      "type": "Q5",  // Human
      "limit": 5,
      "properties": [
        {"pid": "P31", "v": "Q5"},  // instance of human
        {"pid": "P106", "v": "Q36180"}  // occupation: writer
      ]
    }
  }
};
```

#### Response Processing
```javascript
function processReconciliationResults(response) {
  return Object.entries(response.q0.result).map(([id, candidate]) => ({
    qid: candidate.id,
    name: candidate.name,
    description: candidate.description,
    score: candidate.score,
    match: candidate.match,
    types: candidate.type
  }));
}
```

### Property API

#### Property Metadata Endpoint
```
GET https://www.wikidata.org/w/api.php?action=wbgetentities&ids=P50&format=json

Response Structure:
{
  "entities": {
    "P50": {
      "id": "P50",
      "type": "property",
      "datatype": "wikibase-item",
      "labels": {
        "en": {"language": "en", "value": "author"}
      },
      "descriptions": {
        "en": {"language": "en", "value": "main creator of a written work"}
      },
      "claims": {
        "P2302": [/* constraint statements */]
      }
    }
  }
}
```

#### Property Search Endpoint
```
GET https://www.wikidata.org/w/api.php?action=wbsearchentities&search=author&type=property&language=en&format=json

Response Structure:
{
  "search": [
    {
      "id": "P50",
      "label": "author",
      "description": "main creator of a written work",
      "match": {"type": "label", "language": "en", "text": "author"}
    }
  ]
}
```

## Entity Schema Integration

### Schema Loading

#### Entity Schema Endpoint
```
GET https://www.wikidata.org/w/api.php?action=query&titles=EntitySchema:E473&format=json&prop=revisions&rvprop=content

Response Processing:
- Extract ShEx schema from page content
- Parse schema definitions for validation rules
- Convert to internal validation format
```

#### Schema Validation Structure
```javascript
const entitySchemaRules = {
  "E473": {
    "label": "individual copy of a book",
    "requiredProperties": [
      {"property": "P31", "values": ["Q3331189"]},  // instance of: version, edition, or translation
      {"property": "P50", "required": true},        // author (required)
      {"property": "P1476", "required": true}       // title (required)
    ],
    "recommendedProperties": [
      {"property": "P577", "recommended": true},     // publication date
      {"property": "P123", "recommended": true}      // publisher
    ],
    "constraints": {
      "sources": "required",
      "qualifiers": {
        "P50": ["P1810"]  // author can have "named as" qualifier
      }
    }
  }
};
```

### Validation Implementation

#### Real-time Validation
```javascript
function validateAgainstSchema(item, schemaId) {
  const schema = entitySchemaRules[schemaId];
  const errors = [];
  const warnings = [];
  
  // Check required properties
  schema.requiredProperties.forEach(requirement => {
    if (!item.properties[requirement.property]) {
      errors.push(`Missing required property: ${requirement.property}`);
    }
  });
  
  // Check recommended properties
  schema.recommendedProperties.forEach(recommendation => {
    if (!item.properties[recommendation.property]) {
      warnings.push(`Missing recommended property: ${recommendation.property}`);
    }
  });
  
  return {valid: errors.length === 0, errors, warnings};
}
```

## GitHub Configuration Integration

### Configuration File Structure

#### Repository Structure
```
github.com/username/omekas-to-wikidata-config/
├── tooltips.json
├── placeholders.json
├── entity-schemas.json
├── property-mappings.json
├── ui-content/
│   ├── help/
│   │   ├── mapping-guide.md
│   │   └── reconciliation-guide.md
│   └── examples/
└── README.md
```

#### Configuration Loading
```javascript
const CONFIG_BASE_URL = 'https://raw.githubusercontent.com/username/omekas-to-wikidata-config/main/';

async function loadConfiguration() {
  const config = {};
  
  try {
    config.tooltips = await fetchJSON(`${CONFIG_BASE_URL}tooltips.json`);
    config.placeholders = await fetchJSON(`${CONFIG_BASE_URL}placeholders.json`);
    config.entitySchemas = await fetchJSON(`${CONFIG_BASE_URL}entity-schemas.json`);
    config.propertyMappings = await fetchJSON(`${CONFIG_BASE_URL}property-mappings.json`);
  } catch (error) {
    console.warn('Configuration loading failed, using defaults:', error);
    config = getDefaultConfiguration();
  }
  
  return config;
}
```

## API Integration Patterns

### Request Management

#### Rate Limiting Implementation
```javascript
class RateLimitedClient {
  constructor(requestsPerSecond = 1) {
    this.interval = 1000 / requestsPerSecond;
    this.lastRequest = 0;
    this.queue = [];
  }
  
  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({url, options, resolve, reject});
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.queue.length === 0) return;
    
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest >= this.interval) {
      const {url, options, resolve, reject} = this.queue.shift();
      this.lastRequest = now;
      
      try {
        const response = await fetch(url, options);
        resolve(response);
      } catch (error) {
        reject(error);
      }
      
      // Continue processing queue
      setTimeout(() => this.processQueue(), this.interval);
    } else {
      // Wait for rate limit window
      setTimeout(() => this.processQueue(), this.interval - timeSinceLastRequest);
    }
  }
}
```

#### Caching Strategy
```javascript
class APICache {
  constructor(ttl = 300000) { // 5 minutes default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
}
```

### Error Recovery

#### Progressive Degradation
```javascript
async function fetchWithFallbacks(primaryUrl, fallbackUrls = []) {
  try {
    return await fetchJSON(primaryUrl);
  } catch (primaryError) {
    console.warn(`Primary API failed: ${primaryError.message}`);
    
    for (const fallbackUrl of fallbackUrls) {
      try {
        return await fetchJSON(fallbackUrl);
      } catch (fallbackError) {
        console.warn(`Fallback failed: ${fallbackError.message}`);
      }
    }
    
    throw new Error('All API endpoints failed');
  }
}
```

This comprehensive API integration strategy ensures reliable data flow while gracefully handling the various failure modes that can occur with external services.