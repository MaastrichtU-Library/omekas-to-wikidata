/**
 * Handles modal functionality for the application
 */
export function setupModals(state) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalFooter = document.getElementById('modal-footer');
    const closeModalBtn = document.getElementById('close-modal');
    
    // Simple function to close the modal
    function closeModal() {
        if (modalContainer) {
            // Important: Set the style directly instead of using classList
            modalContainer.style.display = 'none';
        }
        
        // Clear content
        if (modalTitle) modalTitle.textContent = '';
        if (modalContent) modalContent.innerHTML = '';
        if (modalFooter) modalFooter.innerHTML = '';
    }
    
    /**
     * Open a modal with the given content
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
                const btn = document.createElement('button');
                btn.textContent = button.text;
                btn.className = button.type === 'primary' ? 'primary-button' : 'secondary-button';
                
                if (button.keyboardShortcut) {
                    // Add keyboard shortcut indicator
                    const shortcutSpan = document.createElement('span');
                    shortcutSpan.textContent = ` [${button.keyboardShortcut.toUpperCase()}]`;
                    shortcutSpan.className = 'shortcut-hint';
                    btn.appendChild(shortcutSpan);
                }
                
                btn.addEventListener('click', button.callback);
                modalFooter.appendChild(btn);
            });
        }
        
        // Show modal - important: set style directly
        if (modalContainer) {
            modalContainer.style.display = 'flex';
        }
        
        // Setup keyboard shortcuts
        function handleKeydown(e) {
            // Close on Escape
            if (e.key === 'Escape') {
                handleCloseModal();
            }
            
            // Button shortcuts
            buttons.forEach(button => {
                if (button.keyboardShortcut && 
                    e.key.toLowerCase() === button.keyboardShortcut.toLowerCase() && 
                    !e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    button.callback();
                }
            });
        }
        
        document.addEventListener('keydown', handleKeydown);
        
        // Close handler
        function handleCloseModal() {
            // Hide modal
            closeModal();
            
            // Remove event listener
            document.removeEventListener('keydown', handleKeydown);
            
            // Run callback if provided
            if (onClose && typeof onClose === 'function') {
                onClose();
            }
        }
        
        // Return close function
        return handleCloseModal;
    }
    
    // Setup close button
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            closeModal();
        });
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
    
    return {
        openModal,
        closeModal
    };
}