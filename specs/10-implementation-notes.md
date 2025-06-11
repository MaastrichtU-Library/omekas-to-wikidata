# Implementation Notes

## Development Guidelines

### Code Organization Principles

#### Module Structure
```
src/js/
├── app.js                 # Application entry point and initialization
├── state.js               # Central state management
├── events.js              # Event handling and coordination
├── navigation.js          # Step navigation and routing
├── modals.js              # Modal management system
├── steps/                 # Step-specific implementation
│   ├── input.js           # Step 1: Data input and API configuration
│   ├── mapping.js         # Step 2: Property mapping workflow
│   ├── reconciliation.js  # Step 3: Entity reconciliation
│   ├── designer.js        # Step 4: Wikidata item design
│   └── export.js          # Step 5: QuickStatements export
├── ui/                    # Reusable UI components
│   ├── components.js      # Base component classes
│   ├── modal-ui.js        # Modal-specific UI components
│   ├── modal-content.js   # Modal content generators
│   └── navigation-ui.js   # Navigation UI components
├── utils/                 # Utility functions and helpers
│   └── property-types.js  # Property type definitions and validation
└── data/                  # Data processing and mock data
    └── mock-data.js       # Development and testing data
```

#### Component Design Pattern
```javascript
// Base component pattern for reusable UI elements
class BaseComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {...this.defaultOptions, ...options};
    this.state = {};
    this.eventListeners = [];
    
    this.init();
  }
  
  get defaultOptions() {
    return {};
  }
  
  init() {
    this.render();
    this.attachEventListeners();
  }
  
  render() {
    // Subclasses implement specific rendering logic
    throw new Error('render() must be implemented by subclass');
  }
  
  attachEventListeners() {
    // Override in subclasses for specific event handling
  }
  
  setState(newState) {
    this.state = {...this.state, ...newState};
    this.render();
  }
  
  destroy() {
    this.eventListeners.forEach(({element, event, handler}) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
  
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({element, event, handler});
  }
}
```

### State Management Implementation

#### Central State Object
```javascript
class ApplicationState {
  constructor() {
    this.data = this.getInitialState();
    this.listeners = new Map();
    this.history = [];
    this.maxHistorySize = 50;
  }
  
  getInitialState() {
    return {
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      },
      workflow: {
        currentStep: 1,
        completedSteps: [],
        stepStates: {
          input: {},
          mapping: {},
          reconciliation: {},
          designer: {},
          export: {}
        }
      },
      datasources: {
        omekaApiResponses: [],
        entitySchemas: []
      },
      ui: {
        activeModals: [],
        keyboardFocus: null,
        unsavedChanges: false
      }
    };
  }
  
  // State mutation methods with change tracking
  setState(path, value) {
    const oldValue = this.getState(path);
    if (oldValue === value) return; // No change
    
    // Save state to history before mutation
    this.saveToHistory();
    
    // Update state
    this.setNestedValue(this.data, path, value);
    this.data.metadata.modified = new Date().toISOString();
    this.data.ui.unsavedChanges = true;
    
    // Notify listeners
    this.notifyListeners(path, value, oldValue);
  }
  
  getState(path) {
    return this.getNestedValue(this.data, path);
  }
  
  // Observer pattern for state changes
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    this.listeners.get(path).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(path).delete(callback);
    };
  }
  
  notifyListeners(path, newValue, oldValue) {
    // Notify exact path listeners
    if (this.listeners.has(path)) {
      this.listeners.get(path).forEach(callback => {
        callback(newValue, oldValue, path);
      });
    }
    
    // Notify parent path listeners (for nested changes)
    const pathParts = path.split('.');
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.');
      if (this.listeners.has(parentPath)) {
        this.listeners.get(parentPath).forEach(callback => {
          callback(this.getState(parentPath), undefined, parentPath);
        });
      }
    }
  }
}
```

#### Step State Management
```javascript
class StepManager {
  constructor(applicationState) {
    this.appState = applicationState;
    this.currentStepComponent = null;
  }
  
  async navigateToStep(stepNumber) {
    // Validate navigation
    if (!this.canNavigateToStep(stepNumber)) {
      throw new Error(`Cannot navigate to step ${stepNumber}`);
    }
    
    // Cleanup current step
    if (this.currentStepComponent) {
      await this.currentStepComponent.onLeave();
      this.currentStepComponent.destroy();
    }
    
    // Update state
    this.appState.setState('workflow.currentStep', stepNumber);
    
    // Load new step
    this.currentStepComponent = await this.loadStepComponent(stepNumber);
    await this.currentStepComponent.onEnter();
    
    // Update UI
    this.updateNavigationUI();
  }
  
  canNavigateToStep(stepNumber) {
    const completedSteps = this.appState.getState('workflow.completedSteps');
    const currentStep = this.appState.getState('workflow.currentStep');
    
    // Can always go back to previous steps
    if (stepNumber < currentStep) return true;
    
    // Can go forward only if previous steps are completed
    return stepNumber <= Math.max(...completedSteps) + 1;
  }
  
  async loadStepComponent(stepNumber) {
    const stepModules = {
      1: () => import('./steps/input.js'),
      2: () => import('./steps/mapping.js'),
      3: () => import('./steps/reconciliation.js'),
      4: () => import('./steps/designer.js'),
      5: () => import('./steps/export.js')
    };
    
    const module = await stepModules[stepNumber]();
    return new module.default(this.appState);
  }
}
```

### Modal System Implementation

#### Modal Management
```javascript
class ModalManager {
  constructor() {
    this.modals = new Map();
    this.modalStack = [];
    this.keyboardTrapEnabled = true;
  }
  
  async openModal(modalType, data = {}, options = {}) {
    const modalId = this.generateModalId();
    const modalConfig = {
      id: modalId,
      type: modalType,
      data,
      options: {
        closable: true,
        keyboardNavigation: true,
        autoFocus: true,
        ...options
      }
    };
    
    // Create modal instance
    const modal = await this.createModalInstance(modalConfig);
    
    // Add to stack and registry
    this.modals.set(modalId, modal);
    this.modalStack.push(modalId);
    
    // Setup modal
    await modal.open();
    this.setupKeyboardTrap(modal);
    this.setupEventListeners(modal);
    
    return {
      modalId,
      close: () => this.closeModal(modalId),
      update: (newData) => modal.updateData(newData)
    };
  }
  
  async closeModal(modalId) {
    const modal = this.modals.get(modalId);
    if (!modal) return;
    
    // Remove from stack
    const stackIndex = this.modalStack.indexOf(modalId);
    if (stackIndex > -1) {
      this.modalStack.splice(stackIndex, 1);
    }
    
    // Cleanup and close
    await modal.close();
    this.modals.delete(modalId);
    
    // Restore focus to previous modal or main content
    this.restoreFocus();
  }
  
  async createModalInstance(config) {
    const modalClasses = {
      'mapping': () => import('./ui/modals/mapping-modal.js'),
      'reconciliation': () => import('./ui/modals/reconciliation-modal.js'),
      'info': () => import('./ui/modals/info-modal.js')
    };
    
    const ModalClass = await modalClasses[config.type]();
    return new ModalClass.default(config);
  }
}
```

#### Keyboard Navigation Implementation
```javascript
class KeyboardNavigationManager {
  constructor() {
    this.shortcuts = new Map();
    this.contextStack = [];
    this.enabled = true;
  }
  
  registerShortcuts(context, shortcuts) {
    this.shortcuts.set(context, shortcuts);
  }
  
  pushContext(context) {
    this.contextStack.push(context);
    this.updateActiveShortcuts();
  }
  
  popContext() {
    this.contextStack.pop();
    this.updateActiveShortcuts();
  }
  
  handleKeydown(event) {
    if (!this.enabled) return;
    
    const currentContext = this.getCurrentContext();
    const shortcuts = this.shortcuts.get(currentContext);
    
    if (!shortcuts) return;
    
    const key = this.getKeySignature(event);
    const shortcut = shortcuts[key];
    
    if (shortcut && (!shortcut.condition || shortcut.condition())) {
      event.preventDefault();
      shortcut.action(event);
    }
  }
  
  getKeySignature(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }
  
  getCurrentContext() {
    return this.contextStack[this.contextStack.length - 1] || 'global';
  }
}
```

### API Integration Patterns

#### API Client Base Class
```javascript
class APIClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.options = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...options
    };
    this.cache = new Map();
  }
  
  async request(endpoint, options = {}) {
    const url = this.buildUrl(endpoint);
    const requestOptions = {
      ...this.options,
      ...options
    };
    
    // Check cache first
    if (requestOptions.cache && this.cache.has(url)) {
      const cached = this.cache.get(url);
      if (this.isCacheValid(cached)) {
        return cached.data;
      }
    }
    
    // Make request with retry logic
    const response = await this.requestWithRetry(url, requestOptions);
    const data = await this.processResponse(response);
    
    // Cache if appropriate
    if (requestOptions.cache) {
      this.cache.set(url, {
        data,
        timestamp: Date.now()
      });
    }
    
    return data;
  }
  
  async requestWithRetry(url, options) {
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
        
        if (response.ok) {
          return response;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error;
        
        if (attempt < options.retries) {
          await this.delay(options.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Specific API Implementations
```javascript
// Omeka S API Client
class OmekaSAPIClient extends APIClient {
  constructor(baseUrl) {
    super(baseUrl, {
      timeout: 15000,
      retries: 2,
      cache: true
    });
  }
  
  async getItems(params = {}) {
    const endpoint = 'items?' + new URLSearchParams(params).toString();
    return this.request(endpoint);
  }
  
  async getItem(id) {
    return this.request(`items/${id}`);
  }
  
  processResponse(response) {
    // Omeka S specific response processing
    return response.json();
  }
}

// Wikidata API Client
class WikidataAPIClient extends APIClient {
  constructor() {
    super('https://www.wikidata.org/w/api.php', {
      timeout: 10000,
      retries: 3,
      cache: true
    });
  }
  
  async searchEntities(query, type = 'item', language = 'en') {
    return this.request('', {
      method: 'GET',
      params: {
        action: 'wbsearchentities',
        search: query,
        type,
        language,
        format: 'json'
      }
    });
  }
  
  async getEntities(ids) {
    return this.request('', {
      method: 'GET',
      params: {
        action: 'wbgetentities',
        ids: Array.isArray(ids) ? ids.join('|') : ids,
        format: 'json'
      }
    });
  }
}
```

### Error Handling Patterns

#### Error Classes
```javascript
class ApplicationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class APIError extends ApplicationError {
  constructor(message, status, url, details = {}) {
    super(message, 'API_ERROR', {...details, status, url});
  }
}

class ValidationError extends ApplicationError {
  constructor(message, field, value, details = {}) {
    super(message, 'VALIDATION_ERROR', {...details, field, value});
  }
}
```

#### Error Handler
```javascript
class ErrorHandler {
  constructor() {
    this.handlers = new Map();
    this.fallbackHandler = this.defaultHandler.bind(this);
  }
  
  register(errorType, handler) {
    this.handlers.set(errorType, handler);
  }
  
  handle(error, context = {}) {
    const handler = this.handlers.get(error.constructor.name) || this.fallbackHandler;
    
    try {
      return handler(error, context);
    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);
      return this.defaultHandler(error, context);
    }
  }
  
  defaultHandler(error, context) {
    console.error('Unhandled error:', error, context);
    
    // Show user-friendly error message
    this.showErrorToUser({
      title: 'An error occurred',
      message: 'Something went wrong. Please try again.',
      details: error.message,
      actions: ['retry', 'report']
    });
  }
}
```

### Performance Optimization

#### Lazy Loading Implementation
```javascript
class LazyLoader {
  constructor() {
    this.loadedModules = new Map();
    this.loadingPromises = new Map();
  }
  
  async loadModule(modulePath) {
    // Return cached module if already loaded
    if (this.loadedModules.has(modulePath)) {
      return this.loadedModules.get(modulePath);
    }
    
    // Return existing loading promise if already loading
    if (this.loadingPromises.has(modulePath)) {
      return this.loadingPromises.get(modulePath);
    }
    
    // Start loading
    const loadingPromise = this.loadModuleImpl(modulePath);
    this.loadingPromises.set(modulePath, loadingPromise);
    
    try {
      const module = await loadingPromise;
      this.loadedModules.set(modulePath, module);
      this.loadingPromises.delete(modulePath);
      return module;
    } catch (error) {
      this.loadingPromises.delete(modulePath);
      throw error;
    }
  }
  
  async loadModuleImpl(modulePath) {
    return import(modulePath);
  }
}
```

#### Memory Management
```javascript
class MemoryManager {
  constructor() {
    this.memoryThreshold = 100 * 1024 * 1024; // 100MB
    this.checkInterval = 30000; // 30 seconds
    this.cleanupCallbacks = [];
    
    this.startMemoryMonitoring();
  }
  
  registerCleanupCallback(callback) {
    this.cleanupCallbacks.push(callback);
  }
  
  startMemoryMonitoring() {
    setInterval(() => {
      if (this.getMemoryUsage() > this.memoryThreshold) {
        this.performCleanup();
      }
    }, this.checkInterval);
  }
  
  getMemoryUsage() {
    // Estimate memory usage (browser-dependent)
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0; // Fallback when performance.memory not available
  }
  
  performCleanup() {
    console.log('Performing memory cleanup...');
    
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Cleanup callback failed:', error);
      }
    });
  }
}
```

## Development Workflow

### Build Process
```javascript
// Simple build process for frontend-only application
const buildProcess = {
  development: {
    // No bundling, direct file serving for development
    serve: 'http-server src/',
    watch: 'watch "echo File changed" src/',
    lint: 'eslint src/**/*.js'
  },
  
  production: {
    // Minimal bundling for deployment
    bundle: 'concat src/js/**/*.js > dist/app.js',
    minify: 'terser dist/app.js -o dist/app.min.js',
    optimize: 'optimize-css src/css/style.css dist/style.min.css'
  }
};
```

### Code Quality Guidelines
- **ES6+ Features**: Use modern JavaScript features with appropriate fallbacks
- **Error Handling**: Comprehensive error handling at all levels
- **Documentation**: JSDoc comments for all public methods
- **Testing**: Unit tests for all utility functions and data processing
- **Performance**: Optimize for large datasets and slow networks

This implementation guide provides a solid foundation for building a maintainable, scalable frontend application while adhering to the project's architectural principles.