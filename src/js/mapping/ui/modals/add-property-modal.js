/**
 * Add property modal functionality for creating new manual properties
 * Handles modal for adding additional custom Wikidata properties
 * @module mapping/ui/modals/add-property-modal
 */

// Import dependencies
import { showMessage } from '../../../ui/components.js';
import { populateLists } from '../mapping-lists.js';
import { createUnifiedPropertyModalContent, getUnifiedSelectedPropertyFromModal } from './manual-property-modal.js';

/**
 * Opens the add manual property modal
 */
export function openAddManualPropertyModal() {
    // Import modal functionality
    import('../../../ui/modal-ui.js').then(({ setupModalUI }) => {
        const modalUI = setupModalUI();
        
        // Create unified modal content for new properties (no preselected property)
        const modalContent = createUnifiedPropertyModalContent(null);
        
        // Create buttons
        const buttons = [
            {
                text: 'Cancel',
                type: 'secondary',
                keyboardShortcut: 'Escape',
                callback: () => {
                    modalUI.closeModal();
                }
            },
            {
                text: 'Add Property',
                type: 'primary',
                keyboardShortcut: 'Enter',
                callback: () => {
                    const selectedProperty = getUnifiedSelectedPropertyFromModal();
                    if (selectedProperty) {
                        addManualPropertyToState(selectedProperty, null, false);
                        modalUI.closeModal();
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            }
        ];
        
        // Open modal
        modalUI.openModal(
            'Add Additional Custom Wikidata Property',
            modalContent,
            buttons
        );
    });
}

/**
 * Add manual property to state
 */
export function addManualPropertyToState(property, defaultValue, isRequired) {
    const manualProperty = {
        property,
        defaultValue,
        isRequired
    };
    
    window.mappingStepState.addManualProperty(manualProperty);
    
    // Refresh the UI
    populateLists(window.mappingStepState);
    
    showMessage(`Added additional property: ${property.label} (${property.id})`, 'success', 3000);
}

/**
 * Remove manual property from UI and state
 */
export function removeManualPropertyFromUI(propertyId) {
    // Check if this property can be removed
    const currentState = window.mappingStepState.getState();
    const property = currentState.mappings.manualProperties.find(p => p.property.id === propertyId);
    
    if (property && property.cannotRemove) {
        showMessage('This property cannot be removed', 'warning', 2000);
        return;
    }
    
    window.mappingStepState.removeManualProperty(propertyId);
    populateLists(window.mappingStepState);
    showMessage('Additional property removed', 'success', 2000);
}