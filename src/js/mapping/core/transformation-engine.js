/**
 * Value transformation engine - business logic only
 * Handles transformation blocks management and orchestration
 * UI rendering has been moved to transformation-ui.js
 * @module mapping/core/transformation-engine
 */

// Import dependencies
import { createTransformationBlock, getTransformationPreview } from '../../transformations.js';
import { getFieldValueFromSample } from './data-analyzer.js';

// Re-export all UI functions for backward compatibility
export * from '../ui/transformation-ui.js';

/**
 * Refreshes the transformation field preview when field selection changes
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function refreshTransformationFieldPreview(propertyId, state) {
    const fieldSelector = document.getElementById(`field-selector-${propertyId}`);
    const container = document.getElementById(`transformation-blocks-${propertyId}`);
    
    if (!fieldSelector || !container) return;

    const keyData = window.currentMappingKeyData;
    if (!keyData) return;

    const selectedField = fieldSelector.value;
    const newSampleValue = getFieldValueFromSample(keyData.sampleValue, selectedField);
    
    // Update stored sample value
    container.dataset.sampleValue = newSampleValue;
    
    // Update the preview
    updateTransformationPreview(propertyId, state);
}

/**
 * Adds a new transformation block to a property
 * @param {string} propertyId - The property ID
 * @param {string} blockType - The type of block to add
 * @param {Object} state - Application state
 */
export function addTransformationBlock(propertyId, blockType, state) {
    const newBlock = createTransformationBlock(blockType);
    state.addTransformationBlock(propertyId, newBlock);
    refreshTransformationUI(propertyId, state);
}

/**
 * Updates only the transformation preview values without re-rendering the entire UI
 * This prevents input fields from losing focus on every keystroke
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function updateTransformationPreview(propertyId, state) {
    const container = document.getElementById(`transformation-blocks-${propertyId}`);
    if (!container || !container.dataset.sampleValue) return;

    const sampleValue = container.dataset.sampleValue;
    const blocks = state.getTransformationBlocks(propertyId);
    const preview = getTransformationPreview(sampleValue, blocks);

    // Update each value state display
    const valueStates = container.querySelectorAll('.transformation-value-state');
    preview.steps.forEach((step, index) => {
        if (valueStates[index]) {
            const valueContent = valueStates[index].querySelector('.value-content');
            if (valueContent) {
                valueContent.textContent = step.value || '(empty)';
            }
        }
    });
}

/**
 * Refreshes the transformation UI for a property (full re-render)
 * Use sparingly as this will cause input fields to lose focus
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function refreshTransformationUI(propertyId, state) {
    const container = document.getElementById(`transformation-blocks-${propertyId}`);
    if (container && container.dataset.sampleValue) {
        // Import UI function to avoid circular dependency
        import('../ui/transformation-ui.js').then(({ renderTransformationBlocks }) => {
            renderTransformationBlocks(propertyId, container.dataset.sampleValue, container, state);
        });
    }
}

/**
 * Refreshes the Stage 3 transformation UI when keyData changes
 * @param {Object} keyData - The key data
 * @param {Object} state - Application state
 */
export function refreshStage3TransformationUI(keyData, state) {
    const stage3Container = document.getElementById('stage-3-value-transformation');
    if (stage3Container) {
        const transformationContainer = stage3Container.querySelector('.stage-content');
        if (transformationContainer) {
            transformationContainer.innerHTML = '';
            // Import UI function to avoid circular dependency
            import('../ui/transformation-ui.js').then(({ renderValueTransformationUI }) => {
                const newUI = renderValueTransformationUI(keyData, state);
                transformationContainer.appendChild(newUI);
            });
        }
    }
}