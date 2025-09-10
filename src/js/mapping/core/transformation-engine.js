/**
 * Value transformation engine - business logic only
 * Handles transformation blocks management and orchestration
 * UI rendering has been moved to transformation-ui.js
 * @module mapping/core/transformation-engine
 */

// Import dependencies
import { createTransformationBlock, getTransformationPreview } from '../../transformations.js';
import { getFieldValueFromSample } from './data-analyzer.js';

/**
 * Refreshes the transformation field preview when field selection changes
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function refreshTransformationFieldPreview(propertyId, state) {
    try {
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
    } catch (error) {
        console.error('Error refreshing transformation field preview:', error);
    }
}

/**
 * Adds a new transformation block to a property
 * @param {string} propertyId - The property ID
 * @param {string} blockType - The type of block to add
 * @param {Object} state - Application state
 */
export function addTransformationBlock(propertyId, blockType, state) {
    try {
        const newBlock = createTransformationBlock(blockType);
        state.addTransformationBlock(propertyId, newBlock);
        refreshTransformationUI(propertyId, state);
    } catch (error) {
        console.error('Error adding transformation block:', error);
        // Import showMessage for user notification
        import('../../ui/components.js').then(({ showMessage }) => {
            showMessage('Failed to add transformation block', 'error', 3000);
        });
    }
}

/**
 * Updates only the transformation preview values without re-rendering the entire UI
 * This prevents input fields from losing focus on every keystroke
 * @param {string} propertyId - The property ID
 * @param {Object} state - Application state
 */
export function updateTransformationPreview(propertyId, state) {
    try {
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
    } catch (error) {
        console.error('Error updating transformation preview:', error);
    }
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
        // Trigger a custom event that the UI module can listen to
        const event = new CustomEvent('refresh-transformation-ui', {
            detail: { propertyId, state, sampleValue: container.dataset.sampleValue }
        });
        container.dispatchEvent(event);
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
            // Clear and rebuild the transformation UI
            transformationContainer.innerHTML = '';
            // Trigger a custom event that the UI module can listen to
            const event = new CustomEvent('refresh-stage3-ui', {
                detail: { keyData, state, container: transformationContainer },
                bubbles: true
            });
            document.dispatchEvent(event);
        }
    }
}