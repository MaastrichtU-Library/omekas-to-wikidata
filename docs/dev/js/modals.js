/**
 * Handles modal functionality for the application
 * Provides methods for opening and closing modals with various content
 * @module modals
 */
import { eventSystem } from './events.js';
import { setupModalUI } from './ui/modal-ui.js';
import { getMappingModalContent, getReconciliationModalContent } from './ui/modal-content.js';

export function setupModals(state) {
    // Set up the modal UI component
    const modalUI = setupModalUI();
    
    /**
     * Shows a mapping modal with example data structure
     */
    function showMappingModal() {
        const content = getMappingModalContent();
        
        return modalUI.openModal('Mapping Data Preview', content, [
            { text: 'Close', type: 'secondary', callback: modalUI.closeModal }
        ]);
    }
    
    /**
     * Shows a reconciliation modal with example data structure
     */
    function showReconciliationModal() {
        const content = getReconciliationModalContent();
        
        return modalUI.openModal('Reconciliation Data Preview', content, [
            { text: 'Close', type: 'secondary', callback: modalUI.closeModal }
        ]);
    }
    
    // Set up event listeners for test modal buttons
    function setupTestButtons() {
        const testMappingBtn = document.getElementById('test-mapping-model');
        const testReconciliationBtn = document.getElementById('test-reconciliation-model');
        
        if (testMappingBtn) {
            testMappingBtn.addEventListener('click', showMappingModal);
        }
        
        if (testReconciliationBtn) {
            testReconciliationBtn.addEventListener('click', showReconciliationModal);
        }
    }
    
    // Initialize
    setupTestButtons();
    
    // Return the modal API so it can be used by other modules
    return {
        /**
         * Opens a modal with the given content
         * @param {string} title - The title of the modal
         * @param {string|HTMLElement} content - The content to display in the modal
         * @param {Array} buttons - Array of button configurations
         * @param {Function} onClose - Callback to execute when the modal is closed
         * @returns {Function} Function to close the modal
         */
        openModal: modalUI.openModal,
        
        /**
         * Closes the current modal
         */
        closeModal: modalUI.closeModal,
        
        /**
         * Shows a mapping modal with example data structure
         */
        showMappingModal,
        
        /**
         * Shows a reconciliation modal with example data structure
         */
        showReconciliationModal
    };
}