/**
 * Jest setup file
 * Sets up a standardized test environment for all tests
 */

// Mock browser globals that might be used in UI tests
global.console.debug = jest.fn();
global.console.log = jest.fn();

// Set up a basic DOM to test against
global.setupTestDOM = () => {
  document.body.innerHTML = `
    <div class="container">
      <!-- Step Navigation -->
      <nav class="steps-navigation">
        <ul>
          <li class="step step--active active" data-step="1">
            <div class="step__number">1</div>
            <div class="step__label">Input</div>
          </li>
          <li class="step" data-step="2">
            <div class="step__number">2</div>
            <div class="step__label">Mapping</div>
          </li>
          <li class="step" data-step="3">
            <div class="step__number">3</div>
            <div class="step__label">Reconciliation</div>
          </li>
          <li class="step" data-step="4">
            <div class="step__number">4</div>
            <div class="step__label">Wikidata Designer</div>
          </li>
          <li class="step" data-step="5">
            <div class="step__number">5</div>
            <div class="step__label">Export</div>
          </li>
        </ul>
        <div class="progress-bar">
          <div class="progress" style="width: 0%;"></div>
        </div>
      </nav>

      <!-- Main Content Container -->
      <main>
        <!-- Step 1: Input -->
        <section id="step1" class="step-content active">
          Step 1 content
        </section>
        <section id="step2" class="step-content">
          Step 2 content
        </section>
        <section id="step3" class="step-content">
          Step 3 content
        </section>
        <section id="step4" class="step-content">
          Step 4 content
        </section>
        <section id="step5" class="step-content">
          Step 5 content
        </section>
      </main>

      <!-- Modal Container -->
      <div class="modal-container" id="modal-container" style="display: none;">
        <div class="modal">
          <div class="modal-header">
            <h3 id="modal-title">Modal Title</h3>
            <button class="close-button" id="close-modal">×</button>
          </div>
          <div class="modal-content" id="modal-content">
            <!-- Modal content will be inserted here dynamically -->
          </div>
          <div class="modal-footer" id="modal-footer">
            <!-- Footer buttons will be inserted here dynamically -->
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add navigation buttons
  document.body.innerHTML += `
    <button id="proceed-to-mapping" class="button button--primary">Continue to Mapping</button>
    <button id="back-to-input" class="button button--secondary">Back to Input</button>
    <button id="proceed-to-reconciliation" class="button button--primary">Continue to Reconciliation</button>
    <button id="back-to-mapping" class="button button--secondary">Back to Mapping</button>
    <button id="proceed-to-designer" class="button button--primary">Continue to Wikidata Designer</button>
    <button id="back-to-reconciliation" class="button button--secondary">Back to Reconciliation</button>
    <button id="proceed-to-export" class="button button--primary">Continue to Export</button>
    <button id="back-to-designer" class="button button--secondary">Back to Designer</button>
    <button id="start-new-project" class="button button--primary">Start New Project</button>
    <button id="test-mapping-model" class="button button--test">Test Mapping Modal</button>
    <button id="test-reconciliation-model" class="button button--test">Test Reconciliation Modal</button>
  `;
};

// Cleanup after each test
global.cleanupTestDOM = () => {
  document.body.innerHTML = '';
};

// Run before each test
beforeEach(() => {
  global.setupTestDOM();
});

// Run after each test
afterEach(() => {
  global.cleanupTestDOM();
  jest.clearAllMocks();
});