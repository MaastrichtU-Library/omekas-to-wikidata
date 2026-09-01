# Code Patterns and Standards

## JavaScript Coding Standards

### ES6+ Modern JavaScript
Use modern JavaScript features consistently throughout the codebase:

```javascript
// Use const by default, let when necessary, avoid var
const API_BASE_URL = 'https://api.example.com';
let currentStep = 1;

// Use arrow functions for callbacks and short functions
const processItems = items => items.filter(item => item.isValid);

// Use template literals for string interpolation
const apiUrl = `${API_BASE_URL}/items/${itemId}`;

// Use destructuring for objects and arrays
const {title, creator, date} = omekaItem;
const [firstItem, ...restItems] = itemCollection;

// Use async/await for asynchronous operations
async function fetchData(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}
```

### Function Design Patterns

#### Pure Functions (Preferred)
```javascript
// Pure function - predictable, testable, no side effects
function normalizePropertyValue(value, type = 'string') {
  if (value === null || value === undefined) {
    return null;
  }
  
  switch (type) {
    case 'string':
      return String(value).trim();
    case 'number':
      return Number(value);
    case 'date':
      return new Date(value).toISOString();
    default:
      return value;
  }
}

// Usage
const normalizedTitle = normalizePropertyValue(rawTitle, 'string');
```

#### Higher-Order Functions
```javascript
// Function factory pattern for creating specialized processors
function createPropertyProcessor(propertyType) {
  const processors = {
    qid: value => value.startsWith('Q') ? value : null,
    string: value => String(value).trim(),
    date: value => new Date(value).toISOString(),
    number: value => Number(value)
  };
  
  return processors[propertyType] || processors.string;
}

// Usage
const processQID = createPropertyProcessor('qid');
const validQID = processQID('Q12345');
```

#### Functional Composition
```javascript
// Compose functions for data transformation pipelines
const pipe = (...fns) => value => fns.reduce((acc, fn) => fn(acc), value);

const processOmekaItem = pipe(
  extractProperties,
  normalizeValues,
  validateRequired,
  addMetadata
);

// Usage
const processedItem = processOmekaItem(rawOmekaItem);
```

### Class Design Patterns

#### Component Base Class
```javascript
class BaseComponent {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {...this.defaultOptions, ...options};
    this.state = {};
    this.listeners = [];
    
    this.init();
  }
  
  // Template method pattern
  init() {
    this.validateElement();
    this.render();
    this.attachEventListeners();
  }
  
  // Abstract methods to be implemented by subclasses
  render() {
    throw new Error('render() must be implemented');
  }
  
  get defaultOptions() {
    return {};
  }
  
  // Event listener management
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.push({element, event, handler});
  }
  
  // Cleanup
  destroy() {
    this.listeners.forEach(({element, event, handler}) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
  }
}
```

#### Modal Component Pattern
```javascript
class MappingModal extends BaseComponent {
  get defaultOptions() {
    return {
      autoFocus: true,
      closable: true,
      keyboardNavigation: true
    };
  }
  
  render() {
    this.element.innerHTML = `
      <div class="modal-header">
        <h2>Map Property: ${this.options.propertyName}</h2>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        ${this.renderModalContent()}
      </div>
      <div class="modal-footer">
        ${this.renderModalActions()}
      </div>
    `;
  }
  
  renderModalContent() {
    return `
      <div class="property-examples">
        <strong>Example values:</strong>
        <ul>
          ${this.options.examples.map(ex => `<li>${ex}</li>`).join('')}
        </ul>
      </div>
      <div class="property-search">
        <input type="text" id="property-search" placeholder="Search Wikidata properties...">
        <div id="suggestions-list" class="suggestions-list"></div>
      </div>
    `;
  }
  
  attachEventListeners() {
    const searchInput = this.element.querySelector('#property-search');
    const closeButton = this.element.querySelector('.modal-close');
    
    this.addEventListener(searchInput, 'input', this.handleSearch.bind(this));
    this.addEventListener(closeButton, 'click', this.close.bind(this));
    this.addEventListener(document, 'keydown', this.handleKeydown.bind(this));
  }
  
  async handleSearch(event) {
    const query = event.target.value;
    if (query.length < 2) return;
    
    try {
      const suggestions = await this.searchProperties(query);
      this.displaySuggestions(suggestions);
    } catch (error) {
      this.showError('Property search failed');
    }
  }
}
```

### Error Handling Patterns

#### Custom Error Classes
```javascript
// Application-specific error types
class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

class APIError extends Error {
  constructor(message, status, endpoint) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

// Usage
function validateProperty(property, value) {
  if (!property) {
    throw new ValidationError('Property is required', 'property', property);
  }
  if (!value || value.trim() === '') {
    throw new ValidationError('Value cannot be empty', 'value', value);
  }
}
```

#### Error Boundary Pattern
```javascript
class ErrorHandler {
  constructor() {
    this.handlers = new Map();
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledPromise.bind(this));
  }
  
  register(errorType, handler) {
    this.handlers.set(errorType, handler);
  }
  
  handle(error, context = {}) {
    const handler = this.handlers.get(error.constructor.name);
    
    if (handler) {
      return handler(error, context);
    }
    
    // Default handling
    this.logError(error, context);
    this.showUserFriendlyMessage(error);
  }
  
  handleGlobalError(event) {
    this.handle(new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  }
  
  handleUnhandledPromise(event) {
    this.handle(event.reason, {type: 'unhandled_promise'});
  }
}
```

### Data Processing Patterns

#### Transformation Pipeline
```javascript
// Data transformation pipeline for Omeka S to internal format
class DataTransformer {
  constructor() {
    this.transformers = [
      this.extractBasicProperties,
      this.normalizeValues,
      this.filterCustomFields,
      this.addMetadata
    ];
  }
  
  transform(omekaItem) {
    return this.transformers.reduce((item, transformer) => {
      return transformer.call(this, item);
    }, omekaItem);
  }
  
  extractBasicProperties(item) {
    const {
      '@id': id,
      'o:id': omekaId,
      '@type': type,
      ...properties
    } = item;
    
    return {
      id,
      omekaId,
      type,
      properties: this.filterLODProperties(properties)
    };
  }
  
  normalizeValues(item) {
    const normalizedProperties = {};
    
    Object.entries(item.properties).forEach(([key, values]) => {
      normalizedProperties[key] = Array.isArray(values) 
        ? values.map(this.normalizeValue)
        : [this.normalizeValue(values)];
    });
    
    return {...item, properties: normalizedProperties};
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
}
```

#### Validation Chain Pattern
```javascript
class ValidationChain {
  constructor() {
    this.validators = [];
  }
  
  add(validator) {
    this.validators.push(validator);
    return this; // Fluent interface
  }
  
  validate(data) {
    const errors = [];
    const warnings = [];
    
    for (const validator of this.validators) {
      const result = validator(data);
      
      if (result.errors) {
        errors.push(...result.errors);
      }
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
      
      // Stop on critical errors
      if (result.critical) {
        break;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Usage
const propertyValidator = new ValidationChain()
  .add(validateRequired)
  .add(validateDataType)
  .add(validateConstraints)
  .add(validateEntitySchema);

const result = propertyValidator.validate(propertyData);
```

### State Management Patterns

#### Observer Pattern for State Changes
```javascript
class StateManager {
  constructor() {
    this.state = {};
    this.observers = new Map();
  }
  
  subscribe(path, callback) {
    if (!this.observers.has(path)) {
      this.observers.set(path, new Set());
    }
    
    this.observers.get(path).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.observers.get(path).delete(callback);
    };
  }
  
  setState(path, value) {
    const oldValue = this.getState(path);
    this.setNestedValue(this.state, path, value);
    
    // Notify observers
    this.notify(path, value, oldValue);
  }
  
  notify(path, newValue, oldValue) {
    // Notify direct path observers
    if (this.observers.has(path)) {
      this.observers.get(path).forEach(callback => {
        callback(newValue, oldValue, path);
      });
    }
    
    // Notify parent path observers
    const pathParts = path.split('.');
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.');
      if (this.observers.has(parentPath)) {
        this.observers.get(parentPath).forEach(callback => {
          callback(this.getState(parentPath), undefined, parentPath);
        });
      }
    }
  }
}
```

### Performance Optimization Patterns

#### Debouncing for User Input
```javascript
function debounce(func, wait, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(this, args);
  };
}

// Usage for search input
const debouncedSearch = debounce(async (query) => {
  const results = await searchWikidataProperties(query);
  displaySearchResults(results);
}, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

#### Lazy Loading Pattern
```javascript
class LazyLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }
  
  async load(key, loader) {
    // Return cached result if available
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Return existing promise if already loading
    if (this.loading.has(key)) {
      return this.loading.get(key);
    }
    
    // Start loading
    const promise = loader()
      .then(result => {
        this.cache.set(key, result);
        this.loading.delete(key);
        return result;
      })
      .catch(error => {
        this.loading.delete(key);
        throw error;
      });
    
    this.loading.set(key, promise);
    return promise;
  }
}

// Usage
const lazyLoader = new LazyLoader();

async function loadEntitySchema(schemaId) {
  return lazyLoader.load(`schema:${schemaId}`, async () => {
    const response = await fetch(`/api/schemas/${schemaId}`);
    return response.json();
  });
}
```

## Code Organization Standards

### File Naming Conventions
- **kebab-case** for file names: `property-mapper.js`, `entity-schema.js`
- **PascalCase** for class names: `PropertyMapper`, `EntitySchema`
- **camelCase** for function and variable names: `mapProperty`, `currentStep`
- **UPPER_SNAKE_CASE** for constants: `API_BASE_URL`, `MAX_RETRIES`

### Import/Export Patterns
```javascript
// Named exports for utilities and classes
export class PropertyMapper {
  // implementation
}

export function normalizeValue(value) {
  // implementation
}

// Default exports for main components
export default class MappingStep {
  // implementation
}

// Import patterns
import MappingStep from './steps/mapping.js';
import {PropertyMapper, normalizeValue} from './utils/property-mapper.js';
```

### Documentation Standards
```javascript
/**
 * Maps an Omeka S property to a Wikidata property
 * @param {string} sourceProperty - The Omeka S property name (e.g., 'dcterms:title')
 * @param {string} targetProperty - The Wikidata property ID (e.g., 'P1476')
 * @param {Object} options - Additional mapping options
 * @param {number} options.confidence - Confidence score (0-1)
 * @param {string} options.source - Source of the mapping suggestion
 * @returns {Object} Mapping result with validation status
 * @throws {ValidationError} When property names are invalid
 */
function mapProperty(sourceProperty, targetProperty, options = {}) {
  // implementation
}
```

These code patterns ensure consistency, maintainability, and clarity throughout the codebase while following modern JavaScript best practices.