# API Interaction Patterns

## Base API Client Architecture

### Generic API Client
```javascript
class APIClient {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.defaultOptions = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json'
      },
      ...options
    };
    this.interceptors = {
      request: [],
      response: []
    };
  }
  
  // Request interceptor for adding auth, logging, etc.
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }
  
  // Response interceptor for error handling, data transformation
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }
  
  async request(endpoint, options = {}) {
    const url = this.buildURL(endpoint);
    let requestOptions = this.mergeOptions(options);
    
    // Apply request interceptors
    for (const interceptor of this.interceptors.request) {
      requestOptions = await interceptor(requestOptions);
    }
    
    try {
      const response = await this.executeRequest(url, requestOptions);
      
      // Apply response interceptors
      let processedResponse = response;
      for (const interceptor of this.interceptors.response) {
        processedResponse = await interceptor(processedResponse);
      }
      
      return processedResponse;
    } catch (error) {
      return this.handleError(error, url, requestOptions);
    }
  }
  
  async executeRequest(url, options) {
    let lastError;
    
    for (let attempt = 1; attempt <= options.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new APIError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            url
          );
        }
        
        return await this.parseResponse(response);
      } catch (error) {
        lastError = error;
        
        if (attempt < options.retries && this.shouldRetry(error)) {
          await this.delay(options.retryDelay * attempt);
          console.warn(`Request failed, retrying (${attempt}/${options.retries}):`, error.message);
        } else {
          break;
        }
      }
    }
    
    throw lastError;
  }
  
  shouldRetry(error) {
    // Retry on network errors, timeouts, and 5xx server errors
    return error.name === 'AbortError' || 
           error.name === 'TypeError' || 
           (error instanceof APIError && error.status >= 500);
  }
  
  async parseResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType && contentType.includes('text/')) {
      return await response.text();
    } else {
      return response;
    }
  }
  
  buildURL(endpoint) {
    if (endpoint.startsWith('http')) {
      return endpoint; // Full URL provided
    }
    return `${this.baseURL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Error Classes
```javascript
class APIError extends Error {
  constructor(message, status, url, response = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.url = url;
    this.response = response;
    this.timestamp = new Date().toISOString();
  }
}

class NetworkError extends Error {
  constructor(message, url) {
    super(message);
    this.name = 'NetworkError';
    this.url = url;
    this.timestamp = new Date().toISOString();
  }
}

class TimeoutError extends Error {
  constructor(message, url, timeout) {
    super(message);
    this.name = 'TimeoutError';
    this.url = url;
    this.timeout = timeout;
    this.timestamp = new Date().toISOString();
  }
}
```

## Omeka S API Client

### Implementation
```javascript
class OmekaSAPIClient extends APIClient {
  constructor(baseURL) {
    super(baseURL, {
      timeout: 15000,
      retries: 2,
      headers: {
        'Accept': 'application/ld+json'
      }
    });
    
    this.addResponseInterceptor(this.processOmekaResponse.bind(this));
  }
  
  // Get collection items with pagination
  async getItems(params = {}) {
    const defaultParams = {
      page: 1,
      per_page: 50
    };
    
    const queryParams = new URLSearchParams({...defaultParams, ...params});
    return this.request(`items?${queryParams}`);
  }
  
  // Get specific item by ID
  async getItem(id) {
    return this.request(`items/${id}`);
  }
  
  // Get item sets (collections)
  async getItemSets(params = {}) {
    const queryParams = new URLSearchParams(params);
    return this.request(`item_sets?${queryParams}`);
  }
  
  // Get available properties
  async getProperties(params = {}) {
    const queryParams = new URLSearchParams(params);
    return this.request(`properties?${queryParams}`);
  }
  
  // Process Omeka S specific response format
  async processOmekaResponse(response) {
    if (!response) return response;
    
    // Handle paginated responses
    if (response['hydra:member']) {
      return {
        items: response['hydra:member'].map(this.normalizeOmekaItem),
        totalItems: response['hydra:totalItems'],
        pagination: this.extractPaginationInfo(response)
      };
    }
    
    // Handle single item response
    if (response['@type'] && response['@type'].includes('o:Item')) {
      return this.normalizeOmekaItem(response);
    }
    
    return response;
  }
  
  normalizeOmekaItem(item) {
    const {
      '@context': context,
      '@id': id,
      '@type': type,
      'o:id': omekaId,
      'o:resource_class': resourceClass,
      'o:resource_template': resourceTemplate,
      ...properties
    } = item;
    
    return {
      id,
      omekaId,
      type,
      resourceClass,
      resourceTemplate,
      properties: this.normalizeProperties(properties)
    };
  }
  
  normalizeProperties(properties) {
    const normalized = {};
    
    Object.entries(properties).forEach(([key, values]) => {
      // Skip internal Omeka properties
      if (key.startsWith('o:')) return;
      
      normalized[key] = Array.isArray(values) 
        ? values.map(this.normalizeValue)
        : [this.normalizeValue(values)];
    });
    
    return normalized;
  }
  
  normalizeValue(value) {
    if (typeof value === 'string') {
      return {text: value, type: 'literal'};
    }
    
    return {
      text: value['@value'] || value.toString(),
      language: value['@language'] || null,
      type: value['type'] || 'literal',
      uri: value['@id'] || null
    };
  }
  
  extractPaginationInfo(response) {
    const view = response['hydra:view'];
    if (!view) return null;
    
    return {
      first: view['hydra:first'],
      previous: view['hydra:previous'],
      next: view['hydra:next'],
      last: view['hydra:last']
    };
  }
}
```

### Usage Patterns
```javascript
// Initialize client
const omekaClient = new OmekaSAPIClient('https://omeka.example.com/api');

// Get collection with error handling
async function loadOmekaCollection(collectionId) {
  try {
    const result = await omekaClient.getItems({
      item_set_id: collectionId,
      per_page: 20
    });
    
    return {
      success: true,
      data: result,
      error: null
    };
  } catch (error) {
    console.error('Failed to load Omeka collection:', error);
    
    return {
      success: false,
      data: null,
      error: {
        type: error.name,
        message: error.message,
        status: error.status
      }
    };
  }
}

// Progressive loading for large collections
async function* loadAllItems(collectionId) {
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const result = await omekaClient.getItems({
        item_set_id: collectionId,
        page,
        per_page: 50
      });
      
      yield result.items;
      
      hasMore = result.pagination && result.pagination.next;
      page++;
    } catch (error) {
      console.error(`Failed to load page ${page}:`, error);
      break;
    }
  }
}
```

## Wikidata API Client

### Implementation
```javascript
class WikidataAPIClient extends APIClient {
  constructor() {
    super('https://www.wikidata.org/w/api.php', {
      timeout: 10000,
      retries: 3,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    this.sparqlEndpoint = 'https://query.wikidata.org/sparql';
    this.reconciliationEndpoint = 'https://wikidata.reconci.link/';
    
    this.addResponseInterceptor(this.processWikidataResponse.bind(this));
  }
  
  // Search entities (items, properties, etc.)
  async searchEntities(query, type = 'item', language = 'en', limit = 10) {
    return this.request('', {
      method: 'GET',
      params: {
        action: 'wbsearchentities',
        search: query,
        type,
        language,
        limit,
        format: 'json'
      }
    });
  }
  
  // Get entity data
  async getEntities(ids, props = 'info|labels|descriptions|claims') {
    const entityIds = Array.isArray(ids) ? ids.join('|') : ids;
    
    return this.request('', {
      method: 'GET',
      params: {
        action: 'wbgetentities',
        ids: entityIds,
        props,
        format: 'json'
      }
    });
  }
  
  // SPARQL query
  async sparqlQuery(query) {
    try {
      const response = await fetch(this.sparqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/sparql-results+json'
        },
        body: query
      });
      
      if (!response.ok) {
        throw new APIError(`SPARQL query failed: ${response.statusText}`, response.status, this.sparqlEndpoint);
      }
      
      return await response.json();
    } catch (error) {
      throw new NetworkError(`SPARQL query failed: ${error.message}`, this.sparqlEndpoint);
    }
  }
  
  // Reconciliation API
  async reconcileEntities(queries) {
    const requestBody = {queries};
    
    try {
      const response = await fetch(this.reconciliationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new APIError(`Reconciliation failed: ${response.statusText}`, response.status, this.reconciliationEndpoint);
      }
      
      return await response.json();
    } catch (error) {
      throw new NetworkError(`Reconciliation failed: ${error.message}`, this.reconciliationEndpoint);
    }
  }
  
  // Get property constraints
  async getPropertyConstraints(propertyId) {
    const query = `
      SELECT ?constraint ?constraintType ?value WHERE {
        wd:${propertyId} p:P2302 ?constraint .
        ?constraint ps:P2302 ?constraintType .
        OPTIONAL { ?constraint pq:P2308 ?value }
      }
    `;
    
    return this.sparqlQuery(query);
  }
  
  // Process Wikidata API responses
  async processWikidataResponse(response) {
    if (!response) return response;
    
    // Handle search results
    if (response.search) {
      return response.search.map(entity => ({
        id: entity.id,
        label: entity.label,
        description: entity.description,
        url: entity.concepturi
      }));
    }
    
    // Handle entity data
    if (response.entities) {
      return Object.values(response.entities).map(this.normalizeEntity);
    }
    
    return response;
  }
  
  normalizeEntity(entity) {
    return {
      id: entity.id,
      type: entity.type,
      labels: entity.labels,
      descriptions: entity.descriptions,
      claims: entity.claims,
      sitelinks: entity.sitelinks
    };
  }
}
```

### Specialized Query Methods
```javascript
// Property search with filtering
async function searchWikidataProperties(query, filters = {}) {
  const wikidataClient = new WikidataAPIClient();
  
  try {
    const results = await wikidataClient.searchEntities(query, 'property');
    
    // Apply filters
    let filteredResults = results;
    
    if (filters.datatype) {
      const propertyIds = results.map(r => r.id);
      const propertyData = await wikidataClient.getEntities(propertyIds, 'claims');
      
      filteredResults = results.filter((result, index) => {
        const entity = propertyData[index];
        return entity.datatype === filters.datatype;
      });
    }
    
    return filteredResults;
  } catch (error) {
    console.error('Property search failed:', error);
    return [];
  }
}

// Get frequently used properties in a collection
async function getCollectionProperties(collectionQID, limit = 50) {
  const wikidataClient = new WikidataAPIClient();
  
  const query = `
    SELECT ?property ?propertyLabel (COUNT(?item) as ?usage) WHERE {
      ?item wdt:P195 wd:${collectionQID} .
      ?item ?property ?value .
      ?prop wikibase:directClaim ?property .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    GROUP BY ?property ?propertyLabel
    ORDER BY DESC(?usage)
    LIMIT ${limit}
  `;
  
  try {
    const result = await wikidataClient.sparqlQuery(query);
    
    return result.results.bindings.map(binding => ({
      property: binding.property.value.split('/').pop(),
      label: binding.propertyLabel.value,
      usage: parseInt(binding.usage.value)
    }));
  } catch (error) {
    console.error('Collection properties query failed:', error);
    return [];
  }
}
```

## Rate Limiting and Caching

### Rate Limiter
```javascript
class RateLimiter {
  constructor(requestsPerSecond = 1) {
    this.interval = 1000 / requestsPerSecond;
    this.lastRequest = 0;
    this.queue = [];
    this.processing = false;
  }
  
  async execute(requestFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({requestFunction, resolve, reject});
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const timeSinceLastRequest = Date.now() - this.lastRequest;
      
      if (timeSinceLastRequest < this.interval) {
        await this.delay(this.interval - timeSinceLastRequest);
      }
      
      const {requestFunction, resolve, reject} = this.queue.shift();
      this.lastRequest = Date.now();
      
      try {
        const result = await requestFunction();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Response Cache
```javascript
class APICache {
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultTTL = options.ttl || 300000; // 5 minutes
    this.maxSize = options.maxSize || 100;
  }
  
  set(key, data, ttl = this.defaultTTL) {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear() {
    this.cache.clear();
  }
  
  // Generate cache key from request parameters
  static generateKey(url, options = {}) {
    const keyData = {
      url,
      method: options.method || 'GET',
      params: options.params || {},
      body: options.body
    };
    
    return btoa(JSON.stringify(keyData));
  }
}
```

### Cached API Client
```javascript
class CachedAPIClient extends APIClient {
  constructor(baseURL, options = {}) {
    super(baseURL, options);
    this.cache = new APICache(options.cache);
    this.rateLimiter = new RateLimiter(options.requestsPerSecond || 1);
  }
  
  async request(endpoint, options = {}) {
    const cacheKey = APICache.generateKey(this.buildURL(endpoint), options);
    
    // Check cache first
    if (options.cache !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }
    
    // Execute request with rate limiting
    const result = await this.rateLimiter.execute(async () => {
      return super.request(endpoint, options);
    });
    
    // Cache successful responses
    if (options.cache !== false && result) {
      this.cache.set(cacheKey, result, options.cacheTTL);
    }
    
    return result;
  }
}
```

These API interaction patterns provide a robust foundation for reliable communication with external services while handling errors gracefully and optimizing performance through caching and rate limiting.