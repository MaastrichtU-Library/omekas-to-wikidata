# Debugging Guide

## Development Debugging Setup

### Browser Developer Tools Configuration

#### Console Logging Setup
```javascript
// debug.js - Development debugging utilities
class DebugLogger {
  constructor() {
    this.isEnabled = this.checkDebugMode();
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4
    };
    this.currentLevel = this.getLogLevel();
  }
  
  checkDebugMode() {
    return window.location.search.includes('debug=true') ||
           localStorage.getItem('debugMode') === 'true' ||
           process.env.NODE_ENV === 'development';
  }
  
  getLogLevel() {
    const urlParams = new URLSearchParams(window.location.search);
    const levelParam = urlParams.get('logLevel') || 
                      localStorage.getItem('logLevel') || 
                      'INFO';
    return this.logLevels[levelParam.toUpperCase()] || this.logLevels.INFO;
  }
  
  log(level, message, data = null) {
    if (!this.isEnabled || this.logLevels[level] > this.currentLevel) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logMethod = level === 'ERROR' ? console.error :
                     level === 'WARN' ? console.warn :
                     console.log;
    
    if (data) {
      logMethod(`[${timestamp}] ${level}: ${message}`, data);
    } else {
      logMethod(`[${timestamp}] ${level}: ${message}`);
    }
  }
  
  error(message, data) { this.log('ERROR', message, data); }
  warn(message, data) { this.log('WARN', message, data); }
  info(message, data) { this.log('INFO', message, data); }
  debug(message, data) { this.log('DEBUG', message, data); }
  trace(message, data) { this.log('TRACE', message, data); }
}

// Global debug instance
window.debug = new DebugLogger();
```

#### State Inspector
```javascript
// State debugging utilities
class StateInspector {
  constructor(appState) {
    this.appState = appState;
    this.snapshots = [];
    this.maxSnapshots = 50;
    
    if (window.debug.isEnabled) {
      this.setupStateMonitoring();
      this.exposeToGlobal();
    }
  }
  
  setupStateMonitoring() {
    // Monitor all state changes
    this.appState.subscribe('*', (value, oldValue, path) => {
      this.logStateChange(path, oldValue, value);
      this.takeSnapshot(path);
    });
  }
  
  logStateChange(path, oldValue, newValue) {
    window.debug.debug(`State changed: ${path}`, {
      old: oldValue,
      new: newValue,
      timestamp: Date.now()
    });
  }
  
  takeSnapshot(path) {
    const snapshot = {
      timestamp: Date.now(),
      path,
      fullState: JSON.parse(JSON.stringify(this.appState.data))
    };
    
    this.snapshots.push(snapshot);
    
    // Keep only recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }
  
  getSnapshot(index = -1) {
    if (index < 0) {
      return this.snapshots[this.snapshots.length + index];
    }
    return this.snapshots[index];
  }
  
  compareSnapshots(index1, index2) {
    const snap1 = this.getSnapshot(index1);
    const snap2 = this.getSnapshot(index2);
    
    if (!snap1 || !snap2) {
      console.error('Invalid snapshot indices');
      return null;
    }
    
    return this.deepDiff(snap1.fullState, snap2.fullState);
  }
  
  deepDiff(obj1, obj2, path = '') {
    const differences = [];
    
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    
    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (!(key in obj1)) {
        differences.push({path: currentPath, type: 'added', value: obj2[key]});
      } else if (!(key in obj2)) {
        differences.push({path: currentPath, type: 'removed', value: obj1[key]});
      } else if (typeof obj1[key] !== typeof obj2[key]) {
        differences.push({
          path: currentPath,
          type: 'type_changed',
          oldValue: obj1[key],
          newValue: obj2[key]
        });
      } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
        differences.push(...this.deepDiff(obj1[key], obj2[key], currentPath));
      } else if (obj1[key] !== obj2[key]) {
        differences.push({
          path: currentPath,
          type: 'changed',
          oldValue: obj1[key],
          newValue: obj2[key]
        });
      }
    }
    
    return differences;
  }
  
  exposeToGlobal() {
    window.stateInspector = {
      getState: (path) => this.appState.getState(path),
      getFullState: () => this.appState.data,
      getSnapshots: () => this.snapshots,
      getSnapshot: (index) => this.getSnapshot(index),
      compare: (index1, index2) => this.compareSnapshots(index1, index2),
      export: () => JSON.stringify(this.appState.data, null, 2)
    };
  }
}
```

### API Request Debugging

#### Request/Response Interceptor
```javascript
class APIDebugger {
  constructor() {
    this.requests = [];
    this.maxRequests = 100;
    
    if (window.debug.isEnabled) {
      this.setupInterception();
      this.exposeToGlobal();
    }
  }
  
  setupInterception() {
    const originalFetch = window.fetch;
    
    window.fetch = async (url, options = {}) => {
      const requestId = this.generateRequestId();
      const startTime = performance.now();
      
      this.logRequest(requestId, url, options);
      
      try {
        const response = await originalFetch(url, options);
        const endTime = performance.now();
        
        this.logResponse(requestId, response, endTime - startTime);
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        this.logError(requestId, error, endTime - startTime);
        throw error;
      }
    };
  }
  
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  logRequest(requestId, url, options) {
    const requestLog = {
      id: requestId,
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      timestamp: new Date().toISOString(),
      type: 'request'
    };
    
    this.requests.push(requestLog);
    this.trimRequests();
    
    window.debug.debug(`API Request: ${requestLog.method} ${url}`, {
      id: requestId,
      headers: options.headers,
      body: options.body
    });
  }
  
  logResponse(requestId, response, duration) {
    const responseLog = {
      id: requestId,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      duration,
      timestamp: new Date().toISOString(),
      type: 'response'
    };
    
    this.requests.push(responseLog);
    
    const logLevel = response.ok ? 'DEBUG' : 'WARN';
    window.debug.log(logLevel, `API Response: ${response.status} (${duration.toFixed(2)}ms)`, {
      id: requestId,
      status: response.status,
      duration
    });
  }
  
  logError(requestId, error, duration) {
    const errorLog = {
      id: requestId,
      error: error.message,
      stack: error.stack,
      duration,
      timestamp: new Date().toISOString(),
      type: 'error'
    };
    
    this.requests.push(errorLog);
    
    window.debug.error(`API Error: ${error.message} (${duration.toFixed(2)}ms)`, {
      id: requestId,
      error: error.message,
      stack: error.stack
    });
  }
  
  trimRequests() {
    if (this.requests.length > this.maxRequests) {
      this.requests.splice(0, this.requests.length - this.maxRequests);
    }
  }
  
  exposeToGlobal() {
    window.apiDebugger = {
      getRequests: () => this.requests,
      getRequest: (id) => this.requests.find(r => r.id === id),
      clearRequests: () => { this.requests = []; },
      getStats: () => this.getRequestStats()
    };
  }
  
  getRequestStats() {
    const requests = this.requests.filter(r => r.type === 'request');
    const responses = this.requests.filter(r => r.type === 'response');
    const errors = this.requests.filter(r => r.type === 'error');
    
    const avgDuration = responses.reduce((sum, r) => sum + r.duration, 0) / responses.length;
    
    return {
      totalRequests: requests.length,
      successfulResponses: responses.filter(r => r.status < 400).length,
      failedResponses: responses.filter(r => r.status >= 400).length,
      errors: errors.length,
      averageDuration: avgDuration || 0
    };
  }
}
```

## Common Debugging Scenarios

### Step Navigation Issues
```javascript
// Debug step navigation problems
function debugStepNavigation() {
  console.group('Step Navigation Debug');
  
  const currentStep = window.stateInspector.getState('workflow.currentStep');
  const completedSteps = window.stateInspector.getState('workflow.completedSteps');
  const stepStates = window.stateInspector.getState('workflow.stepStates');
  
  console.log('Current Step:', currentStep);
  console.log('Completed Steps:', completedSteps);
  console.log('Step States:', stepStates);
  
  // Check for common issues
  if (completedSteps.length === 0 && currentStep > 1) {
    console.warn('⚠️ Current step > 1 but no steps marked as completed');
  }
  
  if (currentStep > Math.max(...completedSteps) + 1) {
    console.warn('⚠️ Current step skips uncompleted steps');
  }
  
  // Check step state completeness
  Object.entries(stepStates).forEach(([stepName, state]) => {
    if (Object.keys(state).length === 0) {
      console.log(`ℹ️ Step ${stepName} has empty state`);
    }
  });
  
  console.groupEnd();
}
```

### Property Mapping Issues
```javascript
function debugPropertyMapping() {
  console.group('Property Mapping Debug');
  
  const mappingState = window.stateInspector.getState('workflow.stepStates.mapping');
  const omekaData = window.stateInspector.getState('datasources.omekaApiResponses');
  
  console.log('Mapping State:', mappingState);
  console.log('Omeka Data:', omekaData);
  
  if (omekaData.length === 0) {
    console.error('❌ No Omeka data loaded');
    return;
  }
  
  // Analyze property distribution
  const allProperties = new Set();
  omekaData[0].items?.forEach(item => {
    Object.keys(item.properties || {}).forEach(prop => allProperties.add(prop));
  });
  
  console.log('Available Properties:', Array.from(allProperties));
  
  // Check mapping completeness
  const mappedProperties = mappingState.mappedProperties || [];
  const unmappedProperties = Array.from(allProperties).filter(prop => 
    !mappedProperties.some(m => m.sourceProperty === prop)
  );
  
  console.log('Mapped Properties:', mappedProperties.length);
  console.log('Unmapped Properties:', unmappedProperties);
  
  if (unmappedProperties.length > 0) {
    console.warn('⚠️ Unmapped properties:', unmappedProperties);
  }
  
  console.groupEnd();
}
```

### Entity Reconciliation Issues
```javascript
function debugReconciliation() {
  console.group('Entity Reconciliation Debug');
  
  const reconciliationState = window.stateInspector.getState('workflow.stepStates.reconciliation');
  const mappingState = window.stateInspector.getState('workflow.stepStates.mapping');
  
  console.log('Reconciliation State:', reconciliationState);
  
  if (!mappingState.mappedProperties || mappingState.mappedProperties.length === 0) {
    console.error('❌ No properties mapped - cannot reconcile');
    return;
  }
  
  // Check reconciliation progress
  const reconciliations = reconciliationState.reconciliations || {};
  const totalCells = Object.keys(reconciliations).reduce((total, itemId) => {
    return total + Object.keys(reconciliations[itemId] || {}).length;
  }, 0);
  
  const completedCells = Object.keys(reconciliations).reduce((total, itemId) => {
    const itemReconciliations = reconciliations[itemId] || {};
    return total + Object.values(itemReconciliations).filter(r => r.status === 'completed').length;
  }, 0);
  
  console.log(`Progress: ${completedCells}/${totalCells} cells reconciled`);
  
  // Check for common issues
  Object.entries(reconciliations).forEach(([itemId, itemReconciliations]) => {
    Object.entries(itemReconciliations).forEach(([propertyId, reconciliation]) => {
      if (reconciliation.status === 'error') {
        console.error(`❌ Reconciliation error for ${itemId}.${propertyId}:`, reconciliation.error);
      } else if (reconciliation.confidence < 0.5) {
        console.warn(`⚠️ Low confidence reconciliation for ${itemId}.${propertyId}:`, reconciliation.confidence);
      }
    });
  });
  
  console.groupEnd();
}
```

### API Integration Issues
```javascript
function debugAPIIntegration() {
  console.group('API Integration Debug');
  
  const apiStats = window.apiDebugger.getStats();
  console.log('API Statistics:', apiStats);
  
  // Recent failed requests
  const recentErrors = window.apiDebugger.getRequests()
    .filter(r => r.type === 'error' || (r.type === 'response' && r.status >= 400))
    .slice(-10);
  
  if (recentErrors.length > 0) {
    console.warn('Recent API Errors:');
    recentErrors.forEach(error => {
      console.log(`- ${error.timestamp}: ${error.error || `HTTP ${error.status}`}`);
    });
  }
  
  // Slow requests
  const slowRequests = window.apiDebugger.getRequests()
    .filter(r => r.type === 'response' && r.duration > 5000);
  
  if (slowRequests.length > 0) {
    console.warn('Slow Requests (>5s):');
    slowRequests.forEach(req => {
      console.log(`- ${req.duration.toFixed(2)}ms: ${req.id}`);
    });
  }
  
  // Check for network issues
  if (apiStats.errors > apiStats.successfulResponses * 0.1) {
    console.error('❌ High error rate detected - check network connectivity');
  }
  
  console.groupEnd();
}
```

## Performance Debugging

### Memory Usage Monitoring
```javascript
class MemoryMonitor {
  constructor() {
    this.measurements = [];
    this.isEnabled = window.debug.isEnabled && 'memory' in performance;
    
    if (this.isEnabled) {
      this.startMonitoring();
      this.exposeToGlobal();
    }
  }
  
  startMonitoring() {
    setInterval(() => {
      this.takeMeasurement();
    }, 5000); // Every 5 seconds
  }
  
  takeMeasurement() {
    if (!this.isEnabled) return;
    
    const memory = performance.memory;
    const measurement = {
      timestamp: Date.now(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
    
    this.measurements.push(measurement);
    
    // Keep only recent measurements
    if (this.measurements.length > 100) {
      this.measurements.shift();
    }
    
    // Warn about memory issues
    const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    if (usagePercent > 80) {
      window.debug.warn(`High memory usage: ${usagePercent.toFixed(1)}%`);
    }
  }
  
  getMemoryTrend() {
    if (this.measurements.length < 2) return null;
    
    const recent = this.measurements.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiff = newest.timestamp - oldest.timestamp;
    const memoryDiff = newest.usedJSHeapSize - oldest.usedJSHeapSize;
    
    return {
      timespan: timeDiff,
      memoryChange: memoryDiff,
      rate: memoryDiff / timeDiff, // bytes per millisecond
      trend: memoryDiff > 0 ? 'increasing' : 'decreasing'
    };
  }
  
  exposeToGlobal() {
    window.memoryMonitor = {
      getMeasurements: () => this.measurements,
      getTrend: () => this.getMemoryTrend(),
      getCurrentUsage: () => performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }
}
```

### Performance Profiling
```javascript
class PerformanceProfiler {
  constructor() {
    this.profiles = new Map();
    this.isEnabled = window.debug.isEnabled;
  }
  
  start(profileName) {
    if (!this.isEnabled) return;
    
    this.profiles.set(profileName, {
      startTime: performance.now(),
      marks: []
    });
    
    window.debug.trace(`Started profiling: ${profileName}`);
  }
  
  mark(profileName, markName) {
    if (!this.isEnabled || !this.profiles.has(profileName)) return;
    
    const profile = this.profiles.get(profileName);
    const currentTime = performance.now();
    
    profile.marks.push({
      name: markName,
      time: currentTime,
      duration: currentTime - profile.startTime
    });
    
    window.debug.trace(`Mark ${markName}: ${(currentTime - profile.startTime).toFixed(2)}ms`);
  }
  
  end(profileName) {
    if (!this.isEnabled || !this.profiles.has(profileName)) return;
    
    const profile = this.profiles.get(profileName);
    const endTime = performance.now();
    const totalDuration = endTime - profile.startTime;
    
    window.debug.info(`Finished profiling ${profileName}: ${totalDuration.toFixed(2)}ms`, {
      totalDuration,
      marks: profile.marks
    });
    
    this.profiles.delete(profileName);
    return {
      name: profileName,
      totalDuration,
      marks: profile.marks
    };
  }
}

// Global profiler instance
window.profiler = new PerformanceProfiler();
```

## Debug Console Commands

### Setup Global Debug Functions
```javascript
// Expose debug functions globally for console use
window.debugUtils = {
  // State debugging
  inspectState: (path) => {
    if (path) {
      return window.stateInspector.getState(path);
    }
    return window.stateInspector.getFullState();
  },
  
  // Step debugging
  debugStep: debugStepNavigation,
  debugMapping: debugPropertyMapping,
  debugReconciliation: debugReconciliation,
  
  // API debugging
  debugAPI: debugAPIIntegration,
  getAPIRequests: () => window.apiDebugger.getRequests(),
  
  // Performance debugging
  profileMemory: () => window.memoryMonitor.getCurrentUsage(),
  getMemoryTrend: () => window.memoryMonitor.getTrend(),
  
  // Utility functions
  exportState: () => window.stateInspector.export(),
  clearLogs: () => {
    console.clear();
    window.apiDebugger.clearRequests();
  },
  
  // Test data helpers
  loadTestData: () => {
    // Load mock data for testing
    const mockData = {
      items: [
        {
          id: 'test-1',
          properties: {
            'dcterms:title': [{text: 'Test Item 1', type: 'literal'}],
            'dcterms:creator': [{text: 'Test Creator', type: 'literal'}]
          }
        }
      ]
    };
    
    window.app.setState('datasources.omekaApiResponses', [mockData]);
    console.log('Test data loaded');
  }
};

// Auto-initialize debugging tools
if (window.debug.isEnabled) {
  document.addEventListener('DOMContentLoaded', () => {
    new StateInspector(window.app.state);
    new APIDebugger();
    new MemoryMonitor();
    
    console.log('🔧 Debug mode enabled');
    console.log('Available debug commands:', Object.keys(window.debugUtils));
  });
}
```

This debugging guide provides comprehensive tools for identifying and resolving issues during development, with special focus on the complex data transformations and API interactions that are central to the application.