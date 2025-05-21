/**
 * Handles the Mapping step functionality
 */
export function setupMappingStep(state) {
    // Initialize DOM elements
    const entitySchemaInput = document.getElementById('entity-schema');
    const nonLinkedKeysList = document.getElementById('non-linked-keys');
    const mappedKeysList = document.getElementById('mapped-keys');
    const ignoredKeysList = document.getElementById('ignored-keys');
    const proceedToReconciliationBtn = document.getElementById('proceed-to-reconciliation');
    
    // When we enter this step, populate the lists
    document.addEventListener('DOMContentLoaded', () => {
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 2) {
                    populateLists();
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-mapping')?.addEventListener('click', () => {
            populateLists();
        });
    });
    
    // Entity schema input
    if (entitySchemaInput) {
        entitySchemaInput.addEventListener('change', () => {
            state.entitySchema = entitySchemaInput.value;
            state.markChangesUnsaved();
        });
    }
    
    // Helper function to populate key lists
    function populateLists() {
        if (!state.fetchedData || !state.selectedExample) return;
        
        // Get key examples from the selected example object
        const example = state.selectedExample;
        const keys = Object.keys(example).filter(key => key !== '@context' && key !== '@id' && key !== '@type');
        
        // For the wireframe, split keys into different categories
        const nonLinkedKeysArray = keys.slice(0, 3); // First 3 keys are non-linked
        const mappedKeysArray = [keys[3]]; // One key is already mapped
        const ignoredKeysArray = keys.slice(4); // Rest are ignored
        
        // Update state
        state.mappings.nonLinkedKeys = nonLinkedKeysArray;
        state.mappings.mappedKeys = mappedKeysArray;
        state.mappings.ignoredKeys = ignoredKeysArray;
        
        // Populate the UI lists
        populateKeyList(nonLinkedKeysList, nonLinkedKeysArray, 'non-linked');
        populateKeyList(mappedKeysList, mappedKeysArray, 'mapped');
        populateKeyList(ignoredKeysList, ignoredKeysArray, 'ignored');
        
        // Enable continue button if there are mapped keys
        if (proceedToReconciliationBtn) {
            proceedToReconciliationBtn.disabled = !state.mappings.mappedKeys.length;
        }
    }
    
    // Helper function to populate a key list
    function populateKeyList(listElement, keys, type) {
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        if (!keys.length) {
            const placeholder = document.createElement('li');
            placeholder.className = 'placeholder';
            placeholder.textContent = type === 'non-linked'
                ? 'All keys have been processed'
                : type === 'mapped'
                    ? 'No mapped keys yet'
                    : 'No ignored keys';
            listElement.appendChild(placeholder);
            return;
        }
        
        keys.forEach(key => {
            const li = document.createElement('li');
            li.textContent = key;
            
            // Add click handler for non-linked keys to open mapping modal
            if (type === 'non-linked') {
                li.className = 'clickable';
                li.addEventListener('click', () => openMappingModal(key));
            }
            
            listElement.appendChild(li);
        });
    }
    
    // Function to open a mapping modal for a key
    function openMappingModal(key) {
        // Alert for wireframe
        alert(`Mapping modal for key: ${key}\n\nIn the full implementation, this will open a modal with mapping options.`);
        
        // Simulate mapping the key
        state.mappings.nonLinkedKeys = state.mappings.nonLinkedKeys.filter(k => k !== key);
        state.mappings.mappedKeys.push(key);
        
        // Update UI
        populateLists();
    }
    
    // Empty function as placeholder - using inline handlers instead
    function showMappingModelModal() {
        // This function is not used - we use inline handlers in HTML
    }
}