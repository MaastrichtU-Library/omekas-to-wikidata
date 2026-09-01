# Component Guidelines

## Component Architecture

### Component Types

#### UI Components
UI components handle user interface rendering and basic user interactions:

```javascript
// Base UI Component Pattern
class UIComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {...this.defaultOptions, ...options};
    this.state = {};
    this.eventListeners = [];
    
    this.init();
  }
  
  get defaultOptions() {
    return {
      className: '',
      autoRender: true,
      eventDelegation: true
    };
  }
  
  init() {
    this.setupContainer();
    if (this.options.autoRender) {
      this.render();
    }
    this.attachEventListeners();
  }
  
  setupContainer() {
    if (this.options.className) {
      this.container.classList.add(this.options.className);
    }
  }
  
  render() {
    // Override in subclasses
    throw new Error('render() must be implemented by subclass');
  }
  
  update(newState) {
    this.state = {...this.state, ...newState};
    this.render();
  }
  
  destroy() {
    this.removeEventListeners();
    this.container.innerHTML = '';
  }
}
```

#### Step Components
Step components manage the logic and UI for each workflow step:

```javascript
class StepComponent {
  constructor(appState) {
    this.appState = appState;
    this.container = null;
    this.components = new Map();
    this.isActive = false;
  }
  
  async onEnter() {
    this.isActive = true;
    this.container = document.querySelector('#main-content');
    await this.render();
    this.setupComponents();
    this.attachEventListeners();
  }
  
  async onLeave() {
    this.isActive = false;
    this.cleanup();
  }
  
  async render() {
    // Step-specific rendering
    throw new Error('render() must be implemented by subclass');
  }
  
  setupComponents() {
    // Initialize child components
  }
  
  cleanup() {
    this.components.forEach(component => component.destroy());
    this.components.clear();
  }
  
  // State management helpers
  getStepState() {
    return this.appState.getState(`workflow.stepStates.${this.stepName}`);
  }
  
  setStepState(data) {
    this.appState.setState(`workflow.stepStates.${this.stepName}`, data);
  }
}
```

#### Modal Components
Modal components provide focused task interfaces:

```javascript
class ModalComponent {
  constructor(config) {
    this.config = config;
    this.element = null;
    this.overlay = null;
    this.focusedElementBeforeModal = null;
    this.isOpen = false;
  }
  
  async open() {
    if (this.isOpen) return;
    
    this.focusedElementBeforeModal = document.activeElement;
    this.createModalElements();
    this.render();
    this.setupEventListeners();
    this.trapFocus();
    this.isOpen = true;
    
    // Animation
    requestAnimationFrame(() => {
      this.overlay.classList.add('modal-overlay--visible');
      this.element.classList.add('modal--visible');
    });
  }
  
  async close() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    this.element.classList.remove('modal--visible');
    this.overlay.classList.remove('modal-overlay--visible');
    
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.destroyModalElements();
    this.restoreFocus();
  }
  
  createModalElements() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    
    // Create modal
    this.element = document.createElement('div');
    this.element.className = 'modal';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    
    this.overlay.appendChild(this.element);
    document.body.appendChild(this.overlay);
  }
  
  trapFocus() {
    const focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });
    
    firstElement.focus();
  }
}
```

## Specific Component Implementations

### Property Mapping Component

```javascript
class PropertyMappingComponent extends UIComponent {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      autoSuggest: true,
      showExamples: true,
      maxSuggestions: 5
    };
  }
  
  render() {
    this.container.innerHTML = `
      <div class="property-mapping">
        <div class="mapping-sections">
          <div class="section section--collapsible" data-section="unmapped">
            <div class="section__header">
              <h3>Unmapped Properties</h3>
              <span class="section__count">(${this.getUnmappedCount()})</span>
              <button class="section__toggle" aria-expanded="true">▼</button>
            </div>
            <div class="section__content">
              ${this.renderUnmappedProperties()}
            </div>
          </div>
          
          <div class="section section--collapsible" data-section="mapped">
            <div class="section__header">
              <h3>Mapped Properties</h3>
              <span class="section__count">(${this.getMappedCount()})</span>
              <button class="section__toggle" aria-expanded="false">▶</button>
            </div>
            <div class="section__content" style="display: none;">
              ${this.renderMappedProperties()}
            </div>
          </div>
          
          <div class="section section--collapsible" data-section="ignored">
            <div class="section__header">
              <h3>Ignored Properties</h3>
              <span class="section__count">(${this.getIgnoredCount()})</span>
              <button class="section__toggle" aria-expanded="false">▶</button>
            </div>
            <div class="section__content" style="display: none;">
              ${this.renderIgnoredProperties()}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  renderUnmappedProperties() {
    const unmappedProperties = this.state.unmappedProperties || [];
    
    return unmappedProperties.map(property => `
      <div class="property-item" data-property="${property.name}">
        <div class="property-item__header">
          <span class="property-item__name">${property.name}</span>
          <span class="property-item__count">(${property.valueCount} values)</span>
          <button class="property-item__map-btn btn btn--primary" 
                  data-action="map" data-property="${property.name}">
            Map Property
          </button>
        </div>
        ${this.options.showExamples ? this.renderPropertyExamples(property) : ''}
      </div>
    `).join('');
  }
  
  renderPropertyExamples(property) {
    return `
      <div class="property-item__examples">
        <strong>Example values:</strong>
        <ul>
          ${property.examples.slice(0, 3).map(ex => `<li>${ex}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  attachEventListeners() {
    // Section toggle handling
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('section__toggle')) {
        this.toggleSection(e.target);
      }
    });
    
    // Property mapping handling
    this.container.addEventListener('click', (e) => {
      if (e.target.dataset.action === 'map') {
        this.openMappingModal(e.target.dataset.property);
      }
    });
  }
  
  toggleSection(toggleBtn) {
    const section = toggleBtn.closest('.section');
    const content = section.querySelector('.section__content');
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      content.style.display = 'none';
      toggleBtn.textContent = '▶';
      toggleBtn.setAttribute('aria-expanded', 'false');
    } else {
      content.style.display = 'block';
      toggleBtn.textContent = '▼';
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
  }
  
  async openMappingModal(propertyName) {
    const modalManager = window.app.modalManager;
    const property = this.state.unmappedProperties.find(p => p.name === propertyName);
    
    const modal = await modalManager.openModal('mapping', {
      propertyName: property.name,
      examples: property.examples,
      suggestions: await this.getSuggestions(property.name)
    });
    
    modal.onConfirm = (mapping) => {
      this.confirmMapping(propertyName, mapping);
      modal.close();
    };
  }
}
```

### Entity Reconciliation Component

```javascript
class EntityReconciliationComponent extends UIComponent {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      batchSize: 10,
      autoSuggest: true,
      confidenceThreshold: 0.6
    };
  }
  
  render() {
    this.container.innerHTML = `
      <div class="reconciliation-table">
        <div class="table-header">
          <div class="progress-indicator">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${this.getProgress()}%"></div>
            </div>
            <span class="progress-text">${this.getProgressText()}</span>
          </div>
        </div>
        
        <div class="table-container">
          <table class="reconciliation-grid">
            <thead>
              <tr>
                <th>Item</th>
                ${this.renderPropertyHeaders()}
              </tr>
            </thead>
            <tbody>
              ${this.renderTableRows()}
            </tbody>
          </table>
        </div>
        
        <div class="table-footer">
          <button class="btn btn--secondary" id="prev-batch" ${this.canGoPrevious() ? '' : 'disabled'}>
            Previous
          </button>
          <span class="batch-info">
            Items ${this.getCurrentBatchStart()}-${this.getCurrentBatchEnd()} 
            of ${this.getTotalItems()}
          </span>
          <button class="btn btn--secondary" id="next-batch" ${this.canGoNext() ? '' : 'disabled'}>
            Next
          </button>
        </div>
      </div>
    `;
  }
  
  renderTableRows() {
    const currentBatch = this.getCurrentBatch();
    
    return currentBatch.map((item, index) => `
      <tr class="reconciliation-row" data-item-id="${item.id}">
        <td class="item-info">
          <div class="item-title">${item.title || `Item ${item.id}`}</div>
          <button class="btn btn--small btn--outline expand-row" 
                  data-action="expand" data-item-id="${item.id}">
            Reconcile
          </button>
        </td>
        ${this.renderPropertyCells(item)}
      </tr>
    `).join('');
  }
  
  renderPropertyCells(item) {
    const mappedProperties = this.state.mappedProperties || [];
    
    return mappedProperties.map(property => {
      const value = item.properties[property.sourceProperty];
      const reconciliation = this.getReconciliation(item.id, property.targetProperty);
      
      return `
        <td class="property-cell" 
            data-item-id="${item.id}" 
            data-property="${property.targetProperty}">
          ${this.renderCellContent(value, reconciliation, property)}
        </td>
      `;
    }).join('');
  }
  
  renderCellContent(value, reconciliation, property) {
    if (!value) {
      return '<span class="cell-empty">—</span>';
    }
    
    if (reconciliation && reconciliation.status === 'completed') {
      return `
        <div class="cell-completed">
          <span class="reconciled-value">${reconciliation.result.label}</span>
          <span class="confidence-indicator confidence--${this.getConfidenceLevel(reconciliation.confidence)}">
            ${this.renderConfidenceStars(reconciliation.confidence)}
          </span>
        </div>
      `;
    }
    
    return `
      <div class="cell-pending">
        <span class="original-value">${Array.isArray(value) ? value[0].text : value.text}</span>
        <button class="btn btn--small btn--primary reconcile-btn" 
                data-action="reconcile">
          Reconcile
        </button>
      </div>
    `;
  }
  
  attachEventListeners() {
    // Row expansion for detailed reconciliation
    this.container.addEventListener('click', (e) => {
      if (e.target.dataset.action === 'expand') {
        this.expandRow(e.target.dataset.itemId);
      }
    });
    
    // Individual cell reconciliation
    this.container.addEventListener('click', (e) => {
      if (e.target.dataset.action === 'reconcile') {
        this.openReconciliationModal(e.target);
      }
    });
    
    // Batch navigation
    this.container.addEventListener('click', (e) => {
      if (e.target.id === 'prev-batch') {
        this.goToPreviousBatch();
      } else if (e.target.id === 'next-batch') {
        this.goToNextBatch();
      }
    });
  }
  
  async openReconciliationModal(button) {
    const cell = button.closest('.property-cell');
    const itemId = cell.dataset.itemId;
    const propertyId = cell.dataset.property;
    
    const item = this.getItem(itemId);
    const property = this.getProperty(propertyId);
    const value = this.getCellValue(itemId, propertyId);
    
    const modalManager = window.app.modalManager;
    const modal = await modalManager.openModal('reconciliation', {
      item,
      property,
      value,
      suggestions: await this.getReconciliationSuggestions(value, property)
    });
    
    modal.onComplete = (reconciliation) => {
      this.saveReconciliation(itemId, propertyId, reconciliation);
      this.updateCell(cell, reconciliation);
      modal.close();
    };
  }
}
```

### Navigation Component

```javascript
class NavigationComponent extends UIComponent {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      showProgress: true,
      allowBackNavigation: true,
      steps: [
        {id: 1, name: 'Input', title: 'Data Input'},
        {id: 2, name: 'Mapping', title: 'Property Mapping'},
        {id: 3, name: 'Reconciliation', title: 'Entity Reconciliation'},
        {id: 4, name: 'Designer', title: 'Wikidata Designer'},
        {id: 5, name: 'Export', title: 'Export'}
      ]
    };
  }
  
  render() {
    this.container.innerHTML = `
      <nav class="step-navigation" role="navigation" aria-label="Workflow steps">
        <div class="step-list">
          ${this.renderSteps()}
        </div>
        ${this.options.showProgress ? this.renderProgressIndicator() : ''}
      </nav>
    `;
  }
  
  renderSteps() {
    return this.options.steps.map((step, index) => {
      const isActive = step.id === this.state.currentStep;
      const isCompleted = this.state.completedSteps.includes(step.id);
      const isAccessible = this.canNavigateToStep(step.id);
      
      return `
        <div class="step-item ${isActive ? 'step-item--active' : ''} 
                              ${isCompleted ? 'step-item--completed' : ''}"
             data-step="${step.id}">
          <button class="step-button" 
                  ${isAccessible ? '' : 'disabled'}
                  aria-current="${isActive ? 'step' : 'false'}">
            <span class="step-number">${step.id}</span>
            <span class="step-name">${step.name}</span>
          </button>
          ${index < this.options.steps.length - 1 ? '<div class="step-separator">→</div>' : ''}
        </div>
      `;
    }).join('');
  }
  
  renderProgressIndicator() {
    const progress = this.calculateProgress();
    
    return `
      <div class="progress-indicator">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="progress-details">
          <span class="progress-text">${progress}% complete</span>
          <span class="progress-stats">${this.getProgressStats()}</span>
        </div>
      </div>
    `;
  }
  
  attachEventListeners() {
    this.container.addEventListener('click', (e) => {
      const stepButton = e.target.closest('.step-button');
      if (stepButton && !stepButton.disabled) {
        const stepId = parseInt(stepButton.closest('.step-item').dataset.step);
        this.navigateToStep(stepId);
      }
    });
    
    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.handleArrowNavigation(e);
      }
    });
  }
  
  canNavigateToStep(stepId) {
    if (!this.options.allowBackNavigation && stepId < this.state.currentStep) {
      return false;
    }
    
    // Can navigate forward only if previous steps are completed
    const maxAccessibleStep = Math.max(...this.state.completedSteps, this.state.currentStep);
    return stepId <= maxAccessibleStep + 1;
  }
  
  async navigateToStep(stepId) {
    if (!this.canNavigateToStep(stepId)) return;
    
    try {
      await window.app.stepManager.navigateToStep(stepId);
      this.update({currentStep: stepId});
    } catch (error) {
      console.error('Navigation failed:', error);
      window.app.showError('Failed to navigate to step');
    }
  }
}
```

## Component Communication Patterns

### Event-Driven Communication
```javascript
// Component publishes events
class PublisherComponent extends UIComponent {
  publishEvent(eventType, data) {
    const event = new CustomEvent(eventType, {
      detail: data,
      bubbles: true
    });
    this.container.dispatchEvent(event);
  }
  
  onActionComplete(result) {
    this.publishEvent('action:complete', {
      componentId: this.id,
      result
    });
  }
}

// Component subscribes to events
class SubscriberComponent extends UIComponent {
  attachEventListeners() {
    super.attachEventListeners();
    
    document.addEventListener('action:complete', (e) => {
      if (e.detail.componentId !== this.id) {
        this.handleExternalAction(e.detail);
      }
    });
  }
}
```

### State-Based Communication
```javascript
class StateAwareComponent extends UIComponent {
  constructor(container, options, appState) {
    super(container, options);
    this.appState = appState;
    this.unsubscribe = [];
  }
  
  init() {
    super.init();
    this.subscribeToState();
  }
  
  subscribeToState() {
    // Subscribe to relevant state changes
    this.unsubscribe.push(
      this.appState.subscribe('workflow.currentStep', (step) => {
        this.onStepChange(step);
      })
    );
    
    this.unsubscribe.push(
      this.appState.subscribe('workflow.stepStates.mapping', (mappingState) => {
        this.onMappingStateChange(mappingState);
      })
    );
  }
  
  destroy() {
    // Unsubscribe from state changes
    this.unsubscribe.forEach(fn => fn());
    super.destroy();
  }
}
```

These component guidelines ensure consistent, maintainable, and reusable UI components throughout the application.