/**
 * Handles modal functionality for the application
 * Provides methods for opening and closing modals with various content
 * @module modals
 */
import { eventSystem } from './events.js';
import { setupModalUI } from './ui/modal-ui.js';
import { getMappingModalContent, getReconciliationModalContent } from './ui/modal-content.js';
import { getSaveProjectModalContent, getLoadProjectModalContent } from './ui/project-modal-content.js';
import { createDownloadLink, showMessage } from './ui/components.js';

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

    /**
     * Shows a save project modal
     */
    function showSaveProjectModal() {
        const content = getSaveProjectModalContent(state);
        
        return modalUI.openModal('Save Project', content, [
            { text: 'Cancel', type: 'secondary', callback: modalUI.closeModal },
            { text: 'Save', type: 'primary', callback: handleSaveProject }
        ]);
    }

    /**
     * Shows a load project modal
     */
    function showLoadProjectModal() {
        const content = getLoadProjectModalContent();
        
        modalUI.openModal('Load Project', content, [
            { text: 'Cancel', type: 'secondary', callback: modalUI.closeModal },
            { text: 'Load', type: 'primary', callback: handleLoadProject, disabled: true, id: 'load-project-btn' }
        ]);

        // Set up file upload functionality
        setupFileUpload();
    }

    /**
     * Handles saving the project to JSON file
     */
    function handleSaveProject() {
        const fileNameInput = document.getElementById('save-filename');
        const fileName = fileNameInput?.value || 'omeka-wikidata-project.json';
        
        try {
            // Export state with metadata
            const projectData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                appName: 'Omeka S to Wikidata Mapping Tool',
                ...state.exportState()
            };
            
            // Create and trigger download
            const dataStr = JSON.stringify(projectData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const downloadLink = createDownloadLink(URL.createObjectURL(dataBlob), fileName);
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Clean up blob URL
            setTimeout(() => URL.revokeObjectURL(downloadLink.href), 100);
            
            modalUI.closeModal();
            showMessage('Project saved successfully', 'success');
            
        } catch (error) {
            console.error('Error saving project:', error);
            showMessage('Error saving project: ' + error.message, 'error');
        }
    }

    /**
     * Handles loading a project from JSON file
     */
    function handleLoadProject() {
        const fileInput = document.getElementById('project-file-input');
        const file = fileInput?.files[0];
        
        if (!file) {
            showMessage('Please select a file to load', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const projectData = JSON.parse(e.target.result);
                
                // Validate project data
                if (!projectData.version || !projectData.currentStep) {
                    throw new Error('Invalid project file format');
                }
                
                // Import state - but use a modified approach to trigger proper navigation
                const oldState = state.getState();
                const success = state.importState(JSON.stringify(projectData));
                
                if (success) {
                    // Trigger step navigation like session restore does
                    // First, publish the STATE_CHANGED event with restored flag
                    eventSystem.publish(eventSystem.Events.STATE_CHANGED, {
                        path: 'entire-state',
                        oldValue: oldState,
                        newValue: state.getState(),
                        restored: true
                    });
                    
                    // Then trigger step change event to initialize the current step properly
                    eventSystem.publish(eventSystem.Events.STEP_CHANGED, {
                        oldStep: oldState.currentStep,
                        newStep: state.getState().currentStep
                    });
                    
                    modalUI.closeModal();
                    showMessage(`Project loaded successfully - jumped to step ${state.getState().currentStep}`, 'success');
                } else {
                    throw new Error('Failed to import project data');
                }
                
            } catch (error) {
                console.error('Error loading project:', error);
                showMessage('Error loading project: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    }

    /**
     * Sets up file upload functionality for load modal
     */
    function setupFileUpload() {
        const uploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('project-file-input');
        const projectPreview = document.getElementById('project-preview');
        const previewContent = document.getElementById('preview-content');
        const loadBtn = document.getElementById('load-project-btn');
        
        if (!uploadArea || !fileInput) return;
        
        // Click to browse
        uploadArea.addEventListener('click', () => fileInput.click());
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelection();
            }
        });
        
        // File input change
        fileInput.addEventListener('change', handleFileSelection);
        
        function handleFileSelection() {
            const file = fileInput.files[0];
            if (!file) return;
            
            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                showMessage('Please select a JSON file', 'error');
                return;
            }
            
            // Read and preview file
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const projectData = JSON.parse(e.target.result);
                    
                    // Show preview
                    const previewInfo = [];
                    previewInfo.push(`File: ${file.name}`);
                    previewInfo.push(`Export Date: ${new Date(projectData.exportDate).toLocaleString()}`);
                    previewInfo.push(`Current Step: ${projectData.currentStep} of 5`);
                    
                    if (projectData.fetchedData) {
                        const itemCount = Array.isArray(projectData.fetchedData) ? projectData.fetchedData.length : 1;
                        previewInfo.push(`Items: ${itemCount}`);
                    }
                    
                    if (projectData.mappings?.mappedKeys) {
                        previewInfo.push(`Mapped Properties: ${projectData.mappings.mappedKeys.length}`);
                    }
                    
                    previewContent.innerHTML = previewInfo.map(info => `<p>${info}</p>`).join('');
                    projectPreview.style.display = 'block';
                    
                    // Enable load button
                    if (loadBtn) loadBtn.disabled = false;
                    
                } catch (error) {
                    showMessage('Invalid JSON file', 'error');
                    previewContent.innerHTML = '<p class="error">Invalid project file</p>';
                    projectPreview.style.display = 'block';
                    if (loadBtn) loadBtn.disabled = true;
                }
            };
            
            reader.readAsText(file);
        }
    }
    
    // Set up event listeners for modal buttons
    function setupModalButtons() {
        const testMappingBtn = document.getElementById('test-mapping-model');
        const testReconciliationBtn = document.getElementById('test-reconciliation-model');
        const saveProjectBtn = document.getElementById('save-project');
        const loadProjectBtn = document.getElementById('load-project');
        
        if (testMappingBtn) {
            testMappingBtn.addEventListener('click', showMappingModal);
        }
        
        if (testReconciliationBtn) {
            testReconciliationBtn.addEventListener('click', showReconciliationModal);
        }
        
        if (saveProjectBtn) {
            saveProjectBtn.addEventListener('click', showSaveProjectModal);
        }
        
        if (loadProjectBtn) {
            loadProjectBtn.addEventListener('click', showLoadProjectModal);
        }
    }
    
    // Initialize
    setupModalButtons();
    
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
        showReconciliationModal,
        
        /**
         * Shows a save project modal
         */
        showSaveProjectModal,
        
        /**
         * Shows a load project modal
         */
        showLoadProjectModal
    };
}