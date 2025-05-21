/**
 * Handles modal functionality for the application
 * Provides methods for opening and closing modals, as well as pre-defined modal templates
 */
export function setupModals(state) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalFooter = document.getElementById('modal-footer');
    const closeModalBtn = document.getElementById('close-modal');
    
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
                const btn = document.createElement('button');
                btn.textContent = button.text;
                // Use both BEM and legacy class names for compatibility
                btn.className = button.type === 'primary' 
                    ? 'button button--primary primary-button' 
                    : 'button button--secondary secondary-button';
                
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
    
    /**
     * Shows a simple mapping modal with example data structure
     */
    function showMappingModal() {
        const content = `
            <div class="mapping-model-preview">
                <div class="model-explanation">
                    <h4>Mapping Data Structure</h4>
                    <p>This is a preview of the internal mapping data structure that would be used to map Omeka S properties to Wikidata properties.</p>
                    <pre class="model-schema">
{
  "mappings": {
    "nonLinkedKeys": ["title", "description", ...],  // Keys that need mapping
    "mappedKeys": ["creator", ...],                  // Keys already mapped to Wikidata properties
    "ignoredKeys": ["format", "rights", ...]         // Keys that will be ignored
  },
  "wikidataProperties": {
    "creator": {
      "property": "P170",
      "label": "creator",
      "datatype": "wikibase-item",
      "reconciliationService": "https://wikidata.reconci.link/en/api"
    },
    // Additional mapped properties would appear here
  }
}
                    </pre>
                </div>
            </div>
        `;
        
        return openModal('Mapping Data Preview', content, [
            { text: 'Close', type: 'secondary', callback: closeModal }
        ]);
    }
    
    /**
     * Shows a simple reconciliation modal with example data structure
     */
    function showReconciliationModal() {
        const content = `
            <div class="reconciliation-model-preview">
                <div class="model-explanation">
                    <h4>Reconciliation Data Structure</h4>
                    <p>This is a preview of the internal reconciliation data structure that would be used to match Omeka S values to Wikidata entities.</p>
                    <pre class="model-schema">
{
  "reconciliationProgress": {
    "total": 10,           // Total number of items to reconcile
    "completed": 3         // Number of completed reconciliations
  },
  "reconciliationData": [
    {
      "id": "item1",
      "properties": {
        "creator": {
          "original": "Leonardo da Vinci",
          "reconciled": {
            "id": "Q762",
            "label": "Leonardo da Vinci",
            "description": "Italian Renaissance polymath",
            "score": 0.98,
            "match": true
          }
        }
      }
    }
  ]
}
                    </pre>
                </div>
            </div>
        `;
        
        return openModal('Reconciliation Data Preview', content, [
            { text: 'Close', type: 'secondary', callback: closeModal }
        ]);
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
    
    // Set up event listeners for test modal buttons
    const testMappingBtn = document.getElementById('test-mapping-model');
    const testReconciliationBtn = document.getElementById('test-reconciliation-model');
    
    if (testMappingBtn) {
        testMappingBtn.addEventListener('click', showMappingModal);
    }
    
    if (testReconciliationBtn) {
        testReconciliationBtn.addEventListener('click', showReconciliationModal);
    }
    
    // Also create global functions for direct access (helpful for debugging)
    window.showModalMapping = showMappingModal;
    window.showModalReconciliation = showReconciliationModal;
    
    // Return the modal API so it can be used by other modules
    return {
        openModal,
        closeModal,
        showMappingModal,
        showReconciliationModal
    };
}