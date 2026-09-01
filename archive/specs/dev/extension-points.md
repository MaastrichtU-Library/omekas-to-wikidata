# Extension Points

## Overview

This document outlines the key extension points in the application architecture that allow for future enhancements, customizations, and community contributions without requiring major refactoring.

## Plugin Architecture

### Plugin System Design
```javascript
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.initialized = false;
  }
  
  // Register a new plugin
  register(pluginName, pluginDefinition) {
    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin ${pluginName} is already registered`);
    }
    
    const plugin = this.createPluginInstance(pluginDefinition);
    this.plugins.set(pluginName, plugin);
    
    // Register plugin hooks
    if (plugin.hooks) {
      Object.entries(plugin.hooks).forEach(([hookName, hookFunction]) => {
        this.addHook(hookName, hookFunction);
      });
    }
    
    // Initialize plugin if system is already initialized
    if (this.initialized && plugin.init) {
      plugin.init();
    }
    
    return plugin;
  }
  
  // Create plugin instance with default methods
  createPluginInstance(definition) {
    return {
      name: definition.name,
      version: definition.version || '1.0.0',
      dependencies: definition.dependencies || [],
      init: definition.init || (() => {}),
      destroy: definition.destroy || (() => {}),
      hooks: definition.hooks || {},
      ...definition
    };
  }
  
  // Add hook function
  addHook(hookName, hookFunction) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push(hookFunction);
  }
  
  // Execute all hooks for a given hook name
  async executeHooks(hookName, data = {}, options = {}) {
    const hooks = this.hooks.get(hookName) || [];
    let result = data;
    
    for (const hook of hooks) {
      try {
        const hookResult = await hook(result, options);
        if (hookResult !== undefined) {
          result = hookResult;
        }
      } catch (error) {
        console.error(`Hook ${hookName} failed:`, error);
        if (options.stopOnError) {
          throw error;
        }
      }
    }
    
    return result;
  }
  
  // Initialize all plugins
  async initialize() {
    for (const plugin of this.plugins.values()) {
      if (plugin.init) {
        try {
          await plugin.init();
        } catch (error) {
          console.error(`Failed to initialize plugin ${plugin.name}:`, error);
        }
      }
    }
    this.initialized = true;
  }
}

// Global plugin manager
window.pluginManager = new PluginManager();
```

### Hook System
```javascript
// Standard hooks available throughout the application
const STANDARD_HOOKS = {
  // Data processing hooks
  'data:omeka:loaded': 'Called when Omeka data is loaded',
  'data:omeka:transformed': 'Called after Omeka data transformation',
  'data:property:mapped': 'Called when a property is mapped',
  'data:entity:reconciled': 'Called when an entity is reconciled',
  'data:export:generated': 'Called when export data is generated',
  
  // UI hooks
  'ui:step:changed': 'Called when navigation step changes',
  'ui:modal:opened': 'Called when a modal is opened',
  'ui:modal:closed': 'Called when a modal is closed',
  'ui:component:rendered': 'Called when a component renders',
  
  // Validation hooks
  'validation:property:mapping': 'Called to validate property mappings',
  'validation:entity:reconciliation': 'Called to validate reconciliations',
  'validation:export:data': 'Called to validate export data',
  
  // API hooks
  'api:request:before': 'Called before API requests',
  'api:request:after': 'Called after API requests',
  'api:error:handled': 'Called when API errors are handled'
};
```

## Data Processing Extensions

### Custom Data Transformers
```javascript
// Example: Custom Dublin Core to Wikidata transformer
const DublinCoreTransformerPlugin = {
  name: 'dublin-core-transformer',
  version: '1.0.0',
  
  hooks: {
    'data:property:mapped': async (mappingData) => {
      // Add specialized Dublin Core mappings
      if (mappingData.sourceProperty.startsWith('dcterms:')) {
        const enhancedMapping = await enhanceDublinCoreMapping(mappingData);
        return enhancedMapping;
      }
      return mappingData;
    }
  },
  
  init() {
    console.log('Dublin Core transformer plugin initialized');
  }
};

async function enhanceDublinCoreMapping(mappingData) {
  // Custom logic for Dublin Core enhancements
  const dcMappings = {
    'dcterms:title': {
      targetProperty: 'P1476',
      qualifiers: ['P407'], // language qualifier
      confidence: 0.95
    },
    'dcterms:creator': {
      targetProperty: 'P50',
      alternatives: ['P170', 'P86'],
      reconciliationType: 'entity'
    }
  };
  
  const enhancement = dcMappings[mappingData.sourceProperty];
  if (enhancement) {
    return {
      ...mappingData,
      ...enhancement
    };
  }
  
  return mappingData;
}

// Register the plugin
window.pluginManager.register('dublin-core-transformer', DublinCoreTransformerPlugin);
```

### Custom Reconciliation Providers
```javascript
// Extension point for additional reconciliation services
class ReconciliationProviderRegistry {
  constructor() {
    this.providers = new Map();
  }
  
  register(providerId, provider) {
    if (!provider.name || !provider.reconcile) {
      throw new Error('Provider must have name and reconcile method');
    }
    
    this.providers.set(providerId, provider);
  }
  
  async reconcile(query, providerId = null) {
    if (providerId) {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }
      return provider.reconcile(query);
    }
    
    // Try all providers and combine results
    const results = [];
    for (const provider of this.providers.values()) {
      try {
        const providerResults = await provider.reconcile(query);
        results.push(...providerResults);
      } catch (error) {
        console.warn(`Provider ${provider.name} failed:`, error);
      }
    }
    
    return this.deduplicateResults(results);
  }
  
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = result.id || result.uri;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// Example: Local authority reconciliation provider
const LocalAuthorityProvider = {
  name: 'Local Authority Files',
  
  async reconcile(query) {
    // Custom reconciliation logic for local authorities
    const response = await fetch(`/api/local-authority/search?q=${encodeURIComponent(query.text)}`);
    const data = await response.json();
    
    return data.results.map(result => ({
      id: result.uri,
      name: result.preferredLabel,
      description: result.note,
      score: result.confidence,
      source: 'local-authority'
    }));
  }
};

window.reconciliationRegistry = new ReconciliationProviderRegistry();
window.reconciliationRegistry.register('local-authority', LocalAuthorityProvider);
```

## UI Component Extensions

### Custom Step Components
```javascript
// Extension point for adding new workflow steps
class StepRegistry {
  constructor() {
    this.steps = new Map();
    this.defaultSteps = [
      {id: 1, name: 'input', component: 'InputStep'},
      {id: 2, name: 'mapping', component: 'MappingStep'},
      {id: 3, name: 'reconciliation', component: 'ReconciliationStep'},
      {id: 4, name: 'designer', component: 'DesignerStep'},
      {id: 5, name: 'export', component: 'ExportStep'}
    ];
    
    this.registerDefaultSteps();
  }
  
  registerDefaultSteps() {
    this.defaultSteps.forEach(step => {
      this.steps.set(step.id, step);
    });
  }
  
  // Add new step or replace existing
  registerStep(stepDefinition) {
    const step = {
      id: stepDefinition.id,
      name: stepDefinition.name,
      title: stepDefinition.title || stepDefinition.name,
      component: stepDefinition.component,
      dependencies: stepDefinition.dependencies || [],
      optional: stepDefinition.optional || false
    };
    
    this.steps.set(step.id, step);
    this.reorderSteps();
  }
  
  // Insert step between existing steps
  insertStep(afterStepId, stepDefinition) {
    const maxId = Math.max(...this.steps.keys());
    const newId = maxId + 1;
    
    // Shift subsequent step IDs
    const stepsArray = Array.from(this.steps.entries())
      .sort(([a], [b]) => a - b);
    
    for (const [id, step] of stepsArray) {
      if (id > afterStepId) {
        this.steps.delete(id);
        this.steps.set(id + 1, {...step, id: id + 1});
      }
    }
    
    // Insert new step
    stepDefinition.id = afterStepId + 1;
    this.registerStep(stepDefinition);
  }
  
  reorderSteps() {
    // Ensure step IDs are sequential
    const stepsArray = Array.from(this.steps.values())
      .sort((a, b) => a.id - b.id);
    
    this.steps.clear();
    stepsArray.forEach((step, index) => {
      step.id = index + 1;
      this.steps.set(step.id, step);
    });
  }
  
  getSteps() {
    return Array.from(this.steps.values()).sort((a, b) => a.id - b.id);
  }
}

// Example: Quality assurance step
const QualityAssuranceStep = {
  name: 'quality-assurance',
  title: 'Quality Assurance',
  component: class QualityAssuranceStepComponent {
    constructor(appState) {
      this.appState = appState;
      this.stepName = 'qualityAssurance';
    }
    
    async onEnter() {
      this.container = document.querySelector('#main-content');
      await this.render();
    }
    
    async render() {
      this.container.innerHTML = `
        <div class="quality-assurance-step">
          <h2>Quality Assurance</h2>
          <div class="qa-checks">
            <div class="qa-section">
              <h3>Data Completeness</h3>
              <div id="completeness-results"></div>
            </div>
            <div class="qa-section">
              <h3>Validation Errors</h3>
              <div id="validation-results"></div>
            </div>
            <div class="qa-section">
              <h3>Confidence Analysis</h3>
              <div id="confidence-results"></div>
            </div>
          </div>
        </div>
      `;
      
      await this.runQualityChecks();
    }
    
    async runQualityChecks() {
      // Implement quality assurance logic
      const data = this.appState.getState('workflow.stepStates');
      
      // Check data completeness
      const completeness = this.checkCompleteness(data);
      this.displayCompleteness(completeness);
      
      // Check validation errors
      const validationErrors = await this.checkValidation(data);
      this.displayValidationErrors(validationErrors);
      
      // Analyze confidence scores
      const confidenceAnalysis = this.analyzeConfidence(data);
      this.displayConfidenceAnalysis(confidenceAnalysis);
    }
  }
};

window.stepRegistry = new StepRegistry();
window.stepRegistry.insertStep(4, QualityAssuranceStep); // Insert before export
```

### Custom Modal Types
```javascript
// Extension point for custom modal types
class ModalTypeRegistry {
  constructor() {
    this.modalTypes = new Map();
  }
  
  register(typeName, modalClass) {
    this.modalTypes.set(typeName, modalClass);
  }
  
  create(typeName, config) {
    const ModalClass = this.modalTypes.get(typeName);
    if (!ModalClass) {
      throw new Error(`Modal type ${typeName} not registered`);
    }
    
    return new ModalClass(config);
  }
  
  getAvailableTypes() {
    return Array.from(this.modalTypes.keys());
  }
}

// Example: Batch processing modal
class BatchProcessingModal {
  constructor(config) {
    this.config = config;
    this.element = null;
  }
  
  async open() {
    this.createElement();
    this.render();
    this.attachEventListeners();
    document.body.appendChild(this.element);
  }
  
  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'modal batch-processing-modal';
  }
  
  render() {
    this.element.innerHTML = `
      <div class="modal-content">
        <h2>Batch Processing</h2>
        <div class="batch-options">
          <label>
            <input type="checkbox" id="auto-accept-high-confidence">
            Auto-accept high confidence matches (>90%)
          </label>
          <label>
            <input type="checkbox" id="skip-low-confidence">
            Skip low confidence matches (<50%)
          </label>
        </div>
        <div class="batch-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-text">0 of 0 processed</div>
        </div>
        <div class="modal-actions">
          <button id="start-batch">Start Batch Processing</button>
          <button id="cancel-batch">Cancel</button>
        </div>
      </div>
    `;
  }
  
  attachEventListeners() {
    const startButton = this.element.querySelector('#start-batch');
    const cancelButton = this.element.querySelector('#cancel-batch');
    
    startButton.addEventListener('click', () => this.startBatchProcessing());
    cancelButton.addEventListener('click', () => this.close());
  }
  
  async startBatchProcessing() {
    // Implement batch processing logic
    const options = {
      autoAcceptHighConfidence: this.element.querySelector('#auto-accept-high-confidence').checked,
      skipLowConfidence: this.element.querySelector('#skip-low-confidence').checked
    };
    
    await this.processBatch(options);
  }
}

window.modalRegistry = new ModalTypeRegistry();
window.modalRegistry.register('batch-processing', BatchProcessingModal);
```

## Configuration Extensions

### Custom Configuration Providers
```javascript
// Extension point for additional configuration sources
class ConfigurationProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.priority = new Map();
  }
  
  register(providerId, provider, priority = 1) {
    this.providers.set(providerId, provider);
    this.priority.set(providerId, priority);
  }
  
  async loadConfiguration(configType) {
    const providers = Array.from(this.providers.entries())
      .sort(([, , a], [, , b]) => this.priority.get(b) - this.priority.get(a));
    
    let mergedConfig = {};
    
    for (const [providerId, provider] of providers) {
      try {
        const config = await provider.load(configType);
        mergedConfig = this.mergeConfigurations(mergedConfig, config);
      } catch (error) {
        console.warn(`Configuration provider ${providerId} failed:`, error);
      }
    }
    
    return mergedConfig;
  }
  
  mergeConfigurations(base, overlay) {
    // Deep merge configuration objects
    const result = {...base};
    
    Object.keys(overlay).forEach(key => {
      if (typeof overlay[key] === 'object' && overlay[key] !== null && !Array.isArray(overlay[key])) {
        result[key] = this.mergeConfigurations(result[key] || {}, overlay[key]);
      } else {
        result[key] = overlay[key];
      }
    });
    
    return result;
  }
}

// Example: Institution-specific configuration provider
const InstitutionConfigProvider = {
  async load(configType) {
    const institutionId = this.detectInstitution();
    const response = await fetch(`/api/config/${institutionId}/${configType}.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to load ${configType} config for ${institutionId}`);
    }
    
    return response.json();
  },
  
  detectInstitution() {
    // Detect institution based on URL, user settings, etc.
    const hostname = window.location.hostname;
    const institutionMap = {
      'library.example.edu': 'university-library',
      'museum.example.org': 'art-museum'
    };
    
    return institutionMap[hostname] || 'default';
  }
};

window.configRegistry = new ConfigurationProviderRegistry();
window.configRegistry.register('institution', InstitutionConfigProvider, 2);
```

## API Integration Extensions

### Custom API Clients
```javascript
// Extension point for additional API integrations
class APIClientRegistry {
  constructor() {
    this.clients = new Map();
  }
  
  register(clientId, clientFactory) {
    this.clients.set(clientId, clientFactory);
  }
  
  create(clientId, config) {
    const factory = this.clients.get(clientId);
    if (!factory) {
      throw new Error(`API client ${clientId} not registered`);
    }
    
    return factory(config);
  }
  
  getAvailableClients() {
    return Array.from(this.clients.keys());
  }
}

// Example: DPLA API client
const DPLAClientFactory = (config) => {
  return {
    name: 'Digital Public Library of America',
    
    async search(query, options = {}) {
      const params = new URLSearchParams({
        q: query,
        api_key: config.apiKey,
        page_size: options.limit || 20,
        page: options.page || 1
      });
      
      const response = await fetch(`https://api.dp.la/v2/items?${params}`);
      return response.json();
    },
    
    async getItem(id) {
      const response = await fetch(`https://api.dp.la/v2/items/${id}?api_key=${config.apiKey}`);
      return response.json();
    },
    
    normalizeItem(dplaItem) {
      // Convert DPLA format to internal format
      return {
        id: dplaItem.id,
        title: dplaItem.sourceResource?.title,
        creator: dplaItem.sourceResource?.creator,
        date: dplaItem.sourceResource?.date,
        description: dplaItem.sourceResource?.description,
        type: dplaItem.sourceResource?.type,
        source: 'dpla'
      };
    }
  };
};

window.apiRegistry = new APIClientRegistry();
window.apiRegistry.register('dpla', DPLAClientFactory);
```

## Validation Extensions

### Custom Validators
```javascript
// Extension point for custom validation rules
class ValidatorRegistry {
  constructor() {
    this.validators = new Map();
  }
  
  register(validatorId, validator) {
    this.validators.set(validatorId, validator);
  }
  
  async validate(data, validatorId, options = {}) {
    const validator = this.validators.get(validatorId);
    if (!validator) {
      throw new Error(`Validator ${validatorId} not registered`);
    }
    
    return validator.validate(data, options);
  }
  
  async validateAll(data, validatorIds, options = {}) {
    const results = {};
    
    for (const validatorId of validatorIds) {
      try {
        results[validatorId] = await this.validate(data, validatorId, options);
      } catch (error) {
        results[validatorId] = {
          isValid: false,
          errors: [error.message]
        };
      }
    }
    
    return results;
  }
}

// Example: LCSH (Library of Congress Subject Headings) validator
const LCSHValidator = {
  async validate(data, options) {
    const errors = [];
    const warnings = [];
    
    if (data.property === 'P921' && data.values) { // subject heading property
      for (const value of data.values) {
        if (!await this.isValidLCSH(value.text)) {
          warnings.push(`"${value.text}" is not a standard LCSH term`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },
  
  async isValidLCSH(term) {
    // Check against LCSH authority file
    try {
      const response = await fetch(`https://id.loc.gov/search/?q=${encodeURIComponent(term)}&format=json`);
      const data = await response.json();
      return data.length > 0;
    } catch (error) {
      console.warn('LCSH validation failed:', error);
      return true; // Don't fail validation on API errors
    }
  }
};

window.validatorRegistry = new ValidatorRegistry();
window.validatorRegistry.register('lcsh', LCSHValidator);
```

## Usage Examples

### Loading Extensions
```javascript
// Example of how to load and use extensions
async function loadExtensions() {
  // Load institution-specific configurations
  const tooltips = await window.configRegistry.loadConfiguration('tooltips');
  const mappings = await window.configRegistry.loadConfiguration('property-mappings');
  
  // Initialize custom API clients
  const dplaClient = window.apiRegistry.create('dpla', {
    apiKey: 'your-dpla-api-key'
  });
  
  // Use custom validation
  const validationResults = await window.validatorRegistry.validateAll(
    exportData,
    ['lcsh', 'entity-schema', 'property-constraints']
  );
  
  console.log('Extensions loaded and configured');
}

// Execute hooks at appropriate points
async function processPropertyMapping(mapping) {
  // Execute pre-processing hooks
  const enhancedMapping = await window.pluginManager.executeHooks(
    'data:property:mapped',
    mapping
  );
  
  // Process the mapping
  const result = await processMapping(enhancedMapping);
  
  // Execute post-processing hooks
  await window.pluginManager.executeHooks(
    'data:mapping:processed',
    result
  );
  
  return result;
}
```

These extension points provide a flexible foundation for customizing and extending the application to meet specific institutional needs, integrate with additional services, and add specialized functionality without modifying the core codebase.