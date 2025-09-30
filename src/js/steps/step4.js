/**
 * Step 4: References
 * Detects and displays reference links from API data
 *
 * This step automatically detects three types of references:
 * - Omeka Item API Links (from top-level @id field)
 * - OCLC WorldCat Links (from schema:sameAs field)
 * - ARK Identifiers (from dcterms:identifier field)
 *
 * These references are different from identifiers in Step 2 (which are used for reconciliation).
 * References are complete URLs that will be added to Wikidata statements in the future.
 *
 * @module steps/step4
 */

import { eventSystem } from '../events.js';
import { detectReferences } from '../references/core/detector.js';
import { renderReferencesSection } from '../references/ui/display.js';

/**
 * Initializes Step 4: References
 * Sets up automatic reference detection and display
 *
 * @param {Object} state - Application state management instance
 */
export function setupStep4(state) {
    const proceedToExportBtn = document.getElementById('proceed-to-export');
    const backToReconciliationBtn = document.getElementById('back-to-reconciliation');
    const referencesContainer = document.getElementById('references-list');

    // Enable proceed button by default
    if (proceedToExportBtn) {
        proceedToExportBtn.disabled = false;
    }

    // Listen for step changes to detect when entering step 4
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 4) {
            handleStep4Entry(state, referencesContainer);
        }
    });

    // Also check if we're already on step 4 (for page refresh scenarios)
    const currentState = state.getState();
    if (currentState.currentStep === 4) {
        handleStep4Entry(state, referencesContainer);
    }
}

/**
 * Handles entry into Step 4
 * Detects references and updates the display
 *
 * @param {Object} state - Application state management instance
 * @param {HTMLElement} container - Container element for references display
 */
function handleStep4Entry(state, container) {
    const currentState = state.getState();

    // Check if we have fetched data
    if (!currentState.fetchedData) {
        if (container) {
            container.innerHTML = '<p class="placeholder">No data available. Please complete Step 1 first.</p>';
        }
        return;
    }

    // Detect references from the fetched data
    const detectionResults = detectReferences(currentState.fetchedData);

    // Store results in state
    state.updateState('references.itemReferences', detectionResults.itemReferences, false);
    state.updateState('references.summary', detectionResults.summary, false);

    // Render the references section
    if (container) {
        renderReferencesSection(detectionResults.summary, container);
    }

    // Log detection results for debugging
    console.log('References detected:', {
        itemCount: Object.keys(detectionResults.itemReferences).length,
        summary: detectionResults.summary
    });
}

/**
 * Gets the current reference detection results from state
 *
 * @param {Object} state - Application state management instance
 * @returns {Object} Current reference data
 */
export function getReferences(state) {
    const currentState = state.getState();
    return {
        itemReferences: currentState.references?.itemReferences || {},
        summary: currentState.references?.summary || {}
    };
}
