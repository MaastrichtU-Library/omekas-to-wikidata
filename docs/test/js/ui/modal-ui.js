/**
 * UI-specific functionality for the modal system
 * Handles DOM manipulation and event handling for modals
 * @module ui/modal-ui
 */
import { eventSystem } from '../events.js';
import { createElement, createButton } from './components.js';

export function setupModalUI() {
    // Core modal elements
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalFooter = document.getElementById('modal-footer');
    const closeModalBtn = document.getElementById('close-modal');
    
    // Track active modal state
    let activeModalCloseHandler = null;
    
    /**
     * Closes the current modal
     */
    function closeModal() {
        if (modalContainer) {
            // Important: Set the style directly instead of using classList
            modalContainer.style.display = 'none';
        }
        
        // Clear content
        if (modalTitle) modalTitle.textContent = '';
        if (modalContent) modalContent.innerHTML = '';
        if (modalFooter) modalFooter.innerHTML = '';
        
        
        // Notify listeners that modal was closed
        eventSystem.publish(eventSystem.Events.UI_MODAL_CLOSED, {});
        
        // Execute close handler if exists
        if (activeModalCloseHandler) {
            activeModalCloseHandler();
            activeModalCloseHandler = null;
        }
    }
    
    /**
     * Opens a modal with the given content
     * @param {string} title - The title of the modal
     * @param {string|HTMLElement} content - The content to display in the modal
     * @param {Array} buttons - Array of button configurations
     * @param {Function} onClose - Callback to execute when the modal is closed
     * @returns {Function} Function to close the modal
     */
    function openModal(title, content, buttons = [], onClose = null) {
        // Set title
        if (modalTitle) {
            modalTitle.textContent = title;
        }
        
        // Set content
        if (modalContent) {
            if (typeof content === 'string') {
                modalContent.innerHTML = content;
            } else {
                modalContent.innerHTML = '';
                modalContent.appendChild(content);
            }
        }
        
        // Add buttons
        if (modalFooter) {
            modalFooter.innerHTML = '';
            buttons.forEach(button => {
                const btn = createButton(button.text, {
                    type: button.type || 'secondary',
                    onClick: button.callback
                });
                
                modalFooter.appendChild(btn);
            });
        }
        
        // Show modal - important: set style directly
        if (modalContainer) {
            modalContainer.style.display = 'flex';
        }
        
        
        // Save the close handler
        activeModalCloseHandler = onClose;
        
        // Notify listeners that modal was opened
        eventSystem.publish(eventSystem.Events.UI_MODAL_OPENED, { title });
        
        // Return close function
        return closeModal;
    }
    
    // Initialize modal UI
    function init() {
        // Setup close button
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }
        
        // Setup clicking outside modal to close
        if (modalContainer) {
            modalContainer.addEventListener('click', (e) => {
                if (e.target === modalContainer) {
                    closeModal();
                }
            });
        }
        
        // Ensure modal is hidden initially by setting the style directly
        if (modalContainer) {
            modalContainer.style.display = 'none';
        }
    }
    
    // Initialize
    init();
    
    // Return the UI API
    return {
        openModal,
        closeModal
    };
}