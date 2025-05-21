/**
 * Handles the Reconciliation step functionality
 */
export function setupReconciliationStep(state) {
    const propertyHeaders = document.getElementById('property-headers');
    const reconciliationRows = document.getElementById('reconciliation-rows');
    const reconciliationProgress = document.getElementById('reconciliation-progress');
    const reconcileNextBtn = document.getElementById('reconcile-next');
    const proceedToDesignerBtn = document.getElementById('proceed-to-designer');
    
    // Initialize reconciliation data when entering this step
    document.addEventListener('DOMContentLoaded', () => {
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 3) {
                    initializeReconciliation();
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-reconciliation')?.addEventListener('click', () => {
            initializeReconciliation();
        });
    });
    
    // Reconcile next item button
    if (reconcileNextBtn) {
        reconcileNextBtn.addEventListener('click', () => {
            reconcileNextItem();
        });
    }
    
    // Initialize reconciliation data
    function initializeReconciliation() {
        if (!state.mappings || !state.mappings.mappedKeys || !state.mappings.mappedKeys.length) return;
        
        // Get mapped keys
        const mappedKeys = state.mappings.mappedKeys;
        
        // Initialize reconciliation progress
        state.reconciliationProgress = {
            total: 1, // For wireframe, just one item
            completed: 0
        };
        
        // Update progress display
        updateProgressDisplay();
        
        // Create header row with property names
        if (propertyHeaders) {
            propertyHeaders.innerHTML = '';
            
            // Add item header
            const itemHeader = document.createElement('th');
            itemHeader.textContent = 'Item';
            propertyHeaders.appendChild(itemHeader);
            
            // Add property headers
            mappedKeys.forEach(key => {
                const th = document.createElement('th');
                th.textContent = key;
                propertyHeaders.appendChild(th);
            });
        }
        
        // Create item row
        if (reconciliationRows) {
            reconciliationRows.innerHTML = '';
            
            const tr = document.createElement('tr');
            tr.id = 'item-row-1';
            
            // Add item cell
            const itemCell = document.createElement('td');
            itemCell.textContent = 'Item 1';
            tr.appendChild(itemCell);
            
            // Add property cells
            mappedKeys.forEach(key => {
                const td = document.createElement('td');
                td.className = 'property-cell';
                td.dataset.property = key;
                td.textContent = 'Click to reconcile';
                td.style.cursor = 'pointer';
                
                // Add click handler to open reconciliation modal
                td.addEventListener('click', () => {
                    openReconciliationModal(key, td);
                });
                
                tr.appendChild(td);
            });
            
            reconciliationRows.appendChild(tr);
        }
        
        // Disable proceed button until all items are reconciled
        if (proceedToDesignerBtn) {
            proceedToDesignerBtn.disabled = true;
        }
    }
    
    // Update progress display
    function updateProgressDisplay() {
        if (reconciliationProgress) {
            reconciliationProgress.textContent = `${state.reconciliationProgress.completed}/${state.reconciliationProgress.total} items reconciled`;
        }
        
        // Enable proceed button if all items are reconciled
        if (proceedToDesignerBtn) {
            proceedToDesignerBtn.disabled = state.reconciliationProgress.completed < state.reconciliationProgress.total;
        }
    }
    
    // Reconcile next item - for wireframe, this will just reconcile all properties in the current item
    function reconcileNextItem() {
        if (state.reconciliationProgress.completed >= state.reconciliationProgress.total) return;
        
        const propertyCells = reconciliationRows.querySelectorAll('.property-cell');
        propertyCells.forEach(cell => {
            cell.textContent = 'Reconciled';
            cell.style.backgroundColor = '#e8f5e9';
            cell.style.cursor = 'default';
            cell.removeEventListener('click', () => {});
        });
        
        // Update progress
        state.reconciliationProgress.completed++;
        updateProgressDisplay();
    }
    
    // Open reconciliation modal for a property
    function openReconciliationModal(property, cell) {
        // Alert for wireframe
        alert(`Reconciliation modal for property: ${property}\n\nIn the full implementation, this will open a modal with reconciliation options.`);
        
        // Update cell
        cell.textContent = 'Reconciled';
        cell.style.backgroundColor = '#e8f5e9';
        cell.style.cursor = 'default';
        
        // Check if all properties are reconciled
        const unreconciled = reconciliationRows.querySelectorAll('.property-cell:not([style*="background-color: rgb(232, 245, 233)"])');
        if (unreconciled.length === 0) {
            // All properties reconciled
            state.reconciliationProgress.completed++;
            updateProgressDisplay();
        }
    }
}