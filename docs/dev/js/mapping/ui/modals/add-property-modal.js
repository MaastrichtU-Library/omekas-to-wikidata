/**
 * Add property modal functionality for creating new manual properties
 * Handles modal for adding additional custom Wikidata properties
 * @module mapping/ui/modals/add-property-modal
 */

// Import dependencies
import { showMessage } from '../../../ui/components.js';
import { populateLists } from '../mapping-lists.js';
import { createUnifiedPropertyModalContent, getUnifiedSelectedPropertyFromModal } from './manual-property-modal.js';
import { extractAllFields } from '../../../transformations.js';

/**
 * Opens the add manual property modal
 */
export function openAddManualPropertyModal() {
    // Extract fields once for the entire modal session to optimize performance
    // Manual properties can still use fields from the dataset in transformations
    if (window.mappingStepState) {
        const currentState = window.mappingStepState.getState();
        
        if (currentState.fetchedData) {
            const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
            
            // Use first item that has any meaningful data
            let fullItemData = items.find(item => {
                return typeof item === 'object' && item !== null && Object.keys(item).length > 0;
            });
            
            if (fullItemData) {
                const extractedFields = extractAllFields(fullItemData);
                
                // Store extracted fields globally for the transformation UI to use
                // Create a synthetic keyData object for new manual property
                window.currentMappingKeyData = {
                    key: 'new-manual-property',
                    sampleValue: 'New manual property transformation',
                    property: null, // No property selected yet
                    extractedFields: extractedFields,
                    isManualProperty: true,
                    isNewProperty: true
                };
            }
        }
    }
    
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
            buttons,
            () => {
                // Remove the wide class when modal closes
                const modal = document.querySelector('.modal');
                if (modal) {
                    modal.classList.remove('mapping-modal-wide');
                }
            }
        );
        
        // Add class to modal for wider display after opening
        setTimeout(() => {
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.classList.add('mapping-modal-wide');
            }
        }, 0);
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