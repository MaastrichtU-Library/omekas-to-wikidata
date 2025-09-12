/**
 * Property constraint validation module - business logic only
 * Handles constraint data fetching and validation coordination
 * UI formatting has been moved to constraint-ui.js
 * @module mapping/core/constraint-validator
 */

// Import dependencies
import { getCompletePropertyData } from '../../api/wikidata.js';

// Re-export all UI functions for backward compatibility
export * from '../ui/constraint-ui.js';

/**
 * Displays property constraints in the constraints container
 * @param {string} propertyId - The Wikidata property ID (e.g., 'P31')
 */
export async function displayPropertyConstraints(propertyId) {
    const constraintsContainer = document.getElementById('property-constraints');
    const loadingDiv = constraintsContainer?.querySelector('.constraint-loading');
    const contentDiv = constraintsContainer?.querySelector('.constraint-content');
    
    if (!constraintsContainer || !loadingDiv || !contentDiv) return;
    
    // Show container and loading state
    constraintsContainer.style.display = 'block';
    loadingDiv.style.display = 'block';
    contentDiv.innerHTML = '';
    
    try {
        // Fetch complete property data with constraints
        const propertyData = await getCompletePropertyData(propertyId);
        
        // Update the selected property with complete data
        window.currentMappingSelectedProperty = {
            ...window.currentMappingSelectedProperty,
            ...propertyData
        };
        
        // Hide loading
        loadingDiv.style.display = 'none';
        
        // Build constraint display
        let constraintHtml = '';
        
        // Always show datatype
        constraintHtml += `<div class="constraint-datatype"><strong>Wikidata expects:</strong> ${propertyData.datatypeLabel}</div>`;
        
        // Show format constraints if any
        if (propertyData.constraints.format.length > 0) {
            const formatDescriptions = propertyData.constraints.format
                .filter(c => c.rank !== 'deprecated')
                .map(c => c.description)
                .join('; ');
            
            if (formatDescriptions) {
                constraintHtml += `<div class="constraint-format"><strong>Format requirements:</strong> ${formatDescriptions}</div>`;
            }
        }
        
        // Show value type constraints if any
        if (propertyData.constraints.valueType.length > 0) {
            const valueTypeDescriptions = propertyData.constraints.valueType
                .filter(c => c.rank !== 'deprecated')
                .map(constraint => {
                    // Convert Q-numbers to human-readable labels
                    const classLabels = constraint.classes.map(qId => {
                        return constraint.classLabels[qId] || qId;
                    });
                    return classLabels.join(', ');
                })
                .join('; ');
            
            if (valueTypeDescriptions) {
                constraintHtml += `<div class="constraint-value-types"><strong>Must be:</strong> ${valueTypeDescriptions}</div>`;
            }
        }
        
        contentDiv.innerHTML = constraintHtml;
        
    } catch (error) {
        console.error('Error fetching property constraints:', error);
        loadingDiv.style.display = 'none';
        contentDiv.innerHTML = '<div class="constraint-error">Unable to load constraint information</div>';
    }
}