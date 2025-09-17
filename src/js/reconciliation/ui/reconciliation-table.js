/**
 * Reconciliation Table UI Module
 * @module reconciliation/ui/reconciliation-table
 * 
 * Handles the generation and management of the reconciliation table interface,
 * including property cells, value elements, loading states, and display updates.
 */

import { createElement } from '../../ui/components.js';
import { combineAndSortProperties, extractPropertyValues } from '../core/reconciliation-data.js';

/**
 * Update cell display to show error state (duplicated from batch-processor for UI access)
 */
function updateCellDisplayWithError(itemId, property, valueIndex, errorInfo) {
    const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
    const cell = document.querySelector(cellSelector);
    
    if (cell) {
        const allValueElements = cell.querySelectorAll('.property-value');
        const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
        
        if (valueElement) {
            valueElement.dataset.status = 'error';
            
            const statusSpan = valueElement.querySelector('.value-status');
            if (statusSpan) {
                if (errorInfo.retryable) {
                    statusSpan.textContent = '⚠️ Error - Click to retry';
                    statusSpan.className = 'value-status error retryable';
                    statusSpan.title = `Retryable error: ${errorInfo.message}`;
                } else {
                    statusSpan.textContent = '❌ Error - Click to reconcile';
                    statusSpan.className = 'value-status error';
                    statusSpan.title = `Error: ${errorInfo.message}`;
                }
            }
            
            // Add error styling
            valueElement.classList.remove('checking', 'high-confidence-match', 'partial-match', 'low-confidence-match');
            valueElement.classList.add('reconciliation-error');
        }
    }
}

/**
 * Update cell loading state
 */
export function updateCellLoadingState(itemId, property, valueIndex, isLoading) {
    const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
    const cell = document.querySelector(cellSelector);
    
    if (cell) {
        // For multiple values, always use indexed selection; for single values, use the first element
        const allValueElements = cell.querySelectorAll('.property-value');
        const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
        
        if (valueElement) {
            if (isLoading) {
                valueElement.classList.add('checking');
            } else {
                valueElement.classList.remove('checking');
            }
        }
    }
}

/**
 * Update cell display when no matches are found
 */
export function updateCellDisplayAsNoMatches(itemId, property, valueIndex) {
    const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
    const cell = document.querySelector(cellSelector);
    
    if (cell) {
        // For multiple values, always use indexed selection; for single values, use the first element
        const allValueElements = cell.querySelectorAll('.property-value');
        const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
        
        if (valueElement) {
            const statusSpan = valueElement.querySelector('.value-status');
            if (statusSpan) {
                statusSpan.textContent = 'Click to reconcile';
                statusSpan.className = 'value-status no-matches';
                valueElement.classList.remove('checking');
            }
        }
    }
}

/**
 * Update cell display to show best match percentage
 */
export function updateCellDisplayWithMatch(itemId, property, valueIndex, bestMatch) {
    // Find the cell element
    const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
    const cell = document.querySelector(cellSelector);
    
    if (cell) {
        // For multiple values, always use indexed selection; for single values, use the first element
        const allValueElements = cell.querySelectorAll('.property-value');
        const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
        
        if (valueElement) {
            const statusSpan = valueElement.querySelector('.value-status');
            if (statusSpan) {
                // Ensure score exists and is a valid number
                const score = bestMatch.score !== undefined && !isNaN(bestMatch.score) ? 
                    bestMatch.score : 0;
                
                // Just show percentage, not the specific match details
                statusSpan.textContent = `${score.toFixed(1)}% match`;
                statusSpan.className = 'value-status with-match';
                
                // Ensure we have a label for the tooltip
                const matchLabel = bestMatch.label || bestMatch.name || 'Unlabeled item';
                statusSpan.title = `Best match: ${matchLabel} (${score.toFixed(1)}%)`;
            }
            
            // Add a visual indicator for good matches - use yellow for partial matches
            valueElement.classList.remove('checking'); // Remove loading state
            const score = bestMatch.score !== undefined && !isNaN(bestMatch.score) ? 
                bestMatch.score : 0;
            if (score >= 85) {
                valueElement.classList.add('high-confidence-match');
            } else if (score >= 50) {
                valueElement.classList.add('partial-match'); // Yellow for partial matches
            } else {
                valueElement.classList.add('low-confidence-match');
            }
        }
    }
}

/**
 * Update cell display based on reconciliation status
 */
export function updateCellDisplay(itemId, property, valueIndex, status, reconciliation = null) {
    // Find the cell element
    const cellSelector = `[data-item-id="${itemId}"][data-property="${property}"]`;
    const cell = document.querySelector(cellSelector);
    
    if (cell) {
        // For multiple values, always use indexed selection; for single values, use the first element
        const allValueElements = cell.querySelectorAll('.property-value');
        const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
        
        if (valueElement) {
            valueElement.dataset.status = status;
            
            const statusSpan = valueElement.querySelector('.value-status');
            if (statusSpan) {
                if (status === 'reconciled' && reconciliation) {
                    if (reconciliation.type === 'wikidata') {
                        const autoAcceptedText = reconciliation.qualifiers?.autoAccepted ? ' (auto)' : '';
                        statusSpan.innerHTML = `✓ <a href="https://www.wikidata.org/wiki/${reconciliation.id}" target="_blank">${reconciliation.id}</a>${autoAcceptedText}`;
                    } else if (reconciliation.type === 'string') {
                        statusSpan.textContent = '✓ String value';
                        statusSpan.title = `Using original value as string: "${reconciliation.value}"`;
                    } else {
                        const autoAcceptedText = reconciliation.qualifiers?.autoAccepted ? ' (auto)' : '';
                        let customText = `✓ Custom value${autoAcceptedText}`;
                        
                        // Show date precision for date values
                        if (reconciliation.datatype === 'time' && reconciliation.qualifiers?.precision) {
                            const precisionLabels = {
                                'day': 'Day precision',
                                'month': 'Month precision', 
                                'year': 'Year precision',
                                'decade': 'Decade precision',
                                'century': 'Century precision',
                                'millennium': 'Millennium precision'
                            };
                            const precisionLabel = precisionLabels[reconciliation.qualifiers.precision] || reconciliation.qualifiers.precision;
                            customText = `✓ Date (${precisionLabel})${autoAcceptedText}`;
                        }
                        
                        statusSpan.textContent = customText;
                    }
                    statusSpan.className = 'value-status reconciled';
                    
                    // Add auto-accepted styling if applicable
                    if (reconciliation.qualifiers?.autoAccepted) {
                        statusSpan.classList.add('auto-accepted');
                        let tooltipText = `Auto-accepted: ${reconciliation.qualifiers.reason}`;
                        
                        // Add precision info to tooltip for dates
                        if (reconciliation.datatype === 'time' && reconciliation.qualifiers?.precision) {
                            tooltipText += ` (${reconciliation.qualifiers.precision} precision)`;
                        }
                        
                        statusSpan.title = tooltipText;
                    }
                } else if (status === 'skipped') {
                    statusSpan.textContent = 'Skipped';
                    statusSpan.className = 'value-status skipped';
                } else if (status === 'no-item') {
                    statusSpan.textContent = '✕ No item';
                    statusSpan.className = 'value-status no-item';
                    statusSpan.title = 'Marked as having no appropriate Wikidata item';
                }
            }
            
            // Remove all status classes and add the current one
            valueElement.classList.remove('high-confidence-match', 'partial-match', 'low-confidence-match', 'checking');
            
            if (status === 'reconciled') {
                // Turn green when reconciled manually or automatically
                valueElement.classList.add('reconciled');
            } else if (status === 'no-item') {
                // Gray out items with no Wikidata item
                valueElement.classList.add('no-item');
            }
            
            // Keep click handlers for all items except no-item (users should be able to edit auto-accepted items)
            // Only remove for no-item status that shouldn't be changed
            if (status === 'no-item') {
                valueElement.style.cursor = 'default';
                valueElement.onclick = null;
            }
        }
    }
}

/**
 * Create a factory function for creating property cells
 */
export function createPropertyCellFactory(openReconciliationModal) {
    return function createPropertyCell(itemId, property, valueIndex, value) {
        const td = createElement('td', {
            className: 'property-cell single-value-cell',
            dataset: {
                itemId: itemId,
                property: property,
                valueIndex: valueIndex
            }
        });
        
        const valueDiv = createValueElement(itemId, property, valueIndex, value, openReconciliationModal);
        td.appendChild(valueDiv);
        
        return td;
    };
}

/**
 * Create a value element within a property cell
 */
function createValueElement(itemId, property, valueIndex, value, openReconciliationModal) {
    const valueDiv = createElement('div', {
        className: 'property-value',
        dataset: { status: 'pending' }
    });
    
    const textSpan = createElement('span', {
        className: 'value-text'
    }, value || 'Empty value');
    
    const statusSpan = createElement('span', {
        className: 'value-status'
    }, 'Click to reconcile');
    
    valueDiv.appendChild(textSpan);
    valueDiv.appendChild(statusSpan);
    
    // Add click handler 
    const clickHandler = () => {
        openReconciliationModal(itemId, property, valueIndex, value);
    };
    
    valueDiv.addEventListener('click', clickHandler);
    
    return valueDiv;
}

/**
 * Create a factory function for creating manual property cells
 */
export function createManualPropertyCellFactory(openReconciliationModal) {
    return function createManualPropertyCell(itemId, propertyId, defaultValue, manualProp) {
        const td = createElement('td', {
            className: 'property-cell manual-property-cell',
            dataset: {
                itemId: itemId,
                property: propertyId,
                isManual: 'true'
            }
        });
        
        // Create a value element for the manual property
        const valueDiv = createElement('div', {
            className: 'property-value manual-property-value',
            dataset: { status: 'pending' }
        });
        
        const textSpan = createElement('span', {
            className: 'value-text'
        }, defaultValue || 'Click to set value');
        
        const statusSpan = createElement('span', {
            className: 'value-status'
        }, manualProp.isRequired ? 'Required - click to set' : 'Click to reconcile');
        
        valueDiv.appendChild(textSpan);
        valueDiv.appendChild(statusSpan);
        
        // Add click handler for manual property reconciliation
        const clickHandler = () => {
            openReconciliationModal(itemId, propertyId, 0, defaultValue, manualProp);
        };
        
        valueDiv.addEventListener('click', clickHandler);
        
        td.appendChild(valueDiv);
        
        return td;
    };
}

/**
 * Create a factory function for the main reconciliation table creation
 */
export function createReconciliationTableFactory(dependencies) {
    const {
        propertyHeaders,
        reconciliationRows,
        getWikidataUrlForProperty,
        performBatchAutoAcceptance,
        restoreReconciliationDisplay,
        openReconciliationModal,
        reconcileColumn,
        state
    } = dependencies;

    const createPropertyCell = createPropertyCellFactory(openReconciliationModal);
    const createManualPropertyCell = createManualPropertyCellFactory(openReconciliationModal);
    
    return async function createReconciliationTable(data, mappedKeys, isReturningToStep = false) {
        
        // Get manual properties from state for restoration and display
        const currentState = state.getState();
        const manualProperties = currentState.mappings?.manualProperties || [];
        
        // Combine and sort all properties for display priority
        const sortedProperties = combineAndSortProperties(mappedKeys, manualProperties);
        
        // Clear existing content
        if (propertyHeaders) {
            propertyHeaders.innerHTML = '';
            
            // Add item header
            const itemHeader = createElement('th', {
                className: 'item-header'
            }, 'Item');
            propertyHeaders.appendChild(itemHeader);
            
            // Add property headers for all properties in sorted order
            sortedProperties.forEach(propItem => {
                if (propItem.type === 'mapped') {
                    // Handle mapped property
                    const keyObj = propItem.data;
                    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                    
                    // Create header content with property label and clickable QID
                    let headerContent;
                    let clickHandler = null;
                    
                    if (keyObj.property && keyObj.property.label && keyObj.property.id) {
                        // Create header with property label and clickable QID
                        headerContent = createElement('div', { 
                            className: 'property-header-content' 
                        });
                        
                        // Property label (clickable span - will be handled by header click)
                        const labelSpan = createElement('span', {
                            className: 'property-label'
                        }, keyObj.property.label);
                        headerContent.appendChild(labelSpan);
                        
                        // Space and opening bracket
                        headerContent.appendChild(document.createTextNode(' ('));
                        
                        // Clickable QID link - smart routing based on property type
                        const wikidataUrl = getWikidataUrlForProperty(keyObj.property);
                        const qidLink = createElement('a', {
                            className: 'property-qid-link',
                            href: wikidataUrl,
                            target: '_blank',
                            onClick: (e) => e.stopPropagation() // Prevent header click when clicking QID
                        }, keyObj.property.id);
                        headerContent.appendChild(qidLink);
                        
                        // Closing bracket
                        headerContent.appendChild(document.createTextNode(')'));
                        
                        // Add @ field indicator if present (for duplicate mappings)
                        if (keyObj.selectedAtField) {
                            const atFieldIndicator = createElement('span', {
                                className: 'at-field-indicator',
                                title: `Using ${keyObj.selectedAtField} field from ${keyName}`
                            }, ` ${keyObj.selectedAtField}`);
                            headerContent.appendChild(atFieldIndicator);
                        }
                        
                        // Add reconciliation button for wikibase-item properties
                        if (keyObj.property && keyObj.property.datatype === 'wikibase-item') {
                            const buttonContainer = createElement('div', {
                                className: 'reconcile-button-container'
                            });
                            
                            const reconcileBtn = createElement('button', {
                                className: 'reconcile-column-btn',
                                title: `Reconcile all ${keyObj.property.label} values`,
                                dataset: { 
                                    property: keyName,
                                    status: 'ready'
                                }
                            });
                            
                            const buttonText = createElement('span', {}, '🔄 Reconcile');
                            reconcileBtn.appendChild(buttonText);
                            
                            // Add click handler for column reconciliation
                            reconcileBtn.addEventListener('click', async (e) => {
                                e.stopPropagation(); // Prevent header click
                                await reconcileColumn(keyName, keyObj, data);
                            });
                            
                            buttonContainer.appendChild(reconcileBtn);
                            headerContent.appendChild(buttonContainer);
                        }
                        
                        // Set click handler to open mapping modal
                        clickHandler = () => {
                            if (window.openMappingModal) {
                                window.openMappingModal(keyObj);
                            }
                        };
                    } else {
                        // Fallback to original key name if no property info available
                        headerContent = keyName;
                        clickHandler = () => {
                            if (window.openMappingModal) {
                                window.openMappingModal(keyObj);
                            }
                        };
                    }
                    
                    const th = createElement('th', {
                        className: 'property-header clickable-header',
                        dataset: { property: keyName },
                        onClick: clickHandler,
                        style: { cursor: 'pointer' },
                        title: 'Click to modify mapping'
                    }, headerContent);
                    
                    propertyHeaders.appendChild(th);
                } else if (propItem.type === 'manual') {
                    // Handle manual property
                    const manualProp = propItem.data;
                    
                    // Create header content with property label and clickable QID
                    const headerContent = createElement('div', { 
                        className: 'property-header-content' 
                    });
                    
                    // Property label (clickable span - will be handled by header click)
                    const labelSpan = createElement('span', {
                        className: 'property-label'
                    }, manualProp.property.label);
                    headerContent.appendChild(labelSpan);
                    
                    // Space and opening bracket
                    headerContent.appendChild(document.createTextNode(' ('));
                    
                    // Clickable QID link - smart routing based on property type
                    const wikidataUrl = getWikidataUrlForProperty(manualProp.property);
                    const qidLink = createElement('a', {
                        className: 'property-qid-link',
                        href: wikidataUrl,
                        target: '_blank',
                        onClick: (e) => e.stopPropagation() // Prevent header click when clicking QID
                    }, manualProp.property.id);
                    headerContent.appendChild(qidLink);
                    
                    // Closing bracket
                    headerContent.appendChild(document.createTextNode(')'));
                    
                    // Add required indicator if applicable
                    if (manualProp.isRequired) {
                        const requiredIndicator = createElement('span', {
                            className: 'required-indicator-header'
                        }, ' *');
                        headerContent.appendChild(requiredIndicator);
                    }
                    
                    // Add reconciliation button for wikibase-item manual properties
                    if (manualProp.property && manualProp.property.datatype === 'wikibase-item') {
                        const buttonContainer = createElement('div', {
                            className: 'reconcile-button-container'
                        });
                        
                        const reconcileBtn = createElement('button', {
                            className: 'reconcile-column-btn',
                            title: `Reconcile all ${manualProp.property.label} values`,
                            dataset: { 
                                property: manualProp.property.id,
                                status: 'ready',
                                isManual: 'true'
                            }
                        });
                        
                        const buttonText = createElement('span', {}, '🔄 Reconcile');
                        reconcileBtn.appendChild(buttonText);
                        
                        // Add click handler for manual property column reconciliation
                        reconcileBtn.addEventListener('click', async (e) => {
                            e.stopPropagation(); // Prevent header click
                            await reconcileColumn(manualProp.property.id, manualProp, data);
                        });
                        
                        buttonContainer.appendChild(reconcileBtn);
                        headerContent.appendChild(buttonContainer);
                    }
                    
                    const th = createElement('th', {
                        className: 'property-header manual-property-header clickable-header',
                        dataset: { 
                            property: manualProp.property.id,
                            isManual: 'true'
                        },
                        title: `${manualProp.property.description}\nClick to modify property settings`,
                        onClick: () => {
                            // Open the manual property edit modal
                            if (window.openManualPropertyEditModal) {
                                window.openManualPropertyEditModal(manualProp);
                            }
                        },
                        style: { cursor: 'pointer' }
                    }, headerContent);
                    
                    propertyHeaders.appendChild(th);
                }
            });
        }
        
        // Create item rows
        if (reconciliationRows) {
            reconciliationRows.innerHTML = '';
            
            data.forEach((item, index) => {
                const itemId = `item-${index}`;
                const tr = createElement('tr', {
                    id: `row-${itemId}`,
                    className: 'reconciliation-row'
                });
                
                // Add item cell
                const itemTitle = item['o:title'] || item['title'] || `Item ${index + 1}`;
                const itemCell = createElement('td', {
                    className: 'item-cell'
                }, itemTitle);
                tr.appendChild(itemCell);
                
                // Add property cells (using sorted order to match headers)
                sortedProperties.forEach(propItem => {
                    if (propItem.type === 'mapped') {
                        // Handle mapped property cell
                        const keyObj = propItem.data;
                        const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                        // Pass the full keyObj and state to apply transformations and preserve @ field information
                        const values = extractPropertyValues(item, keyObj, state);
                        
                        if (values.length === 0) {
                            // Empty cell
                            const td = createElement('td', {
                                className: 'property-cell empty-cell'
                            }, '—');
                            tr.appendChild(td);
                        } else if (values.length === 1) {
                            // Single value cell
                            const td = createPropertyCell(itemId, keyName, 0, values[0]);
                            tr.appendChild(td);
                        } else {
                            // Multiple values cell
                            const td = createElement('td', {
                                className: 'property-cell multi-value-cell',
                                dataset: {
                                    itemId: itemId,
                                    property: keyName
                                }
                            });
                            
                            values.forEach((value, valueIndex) => {
                                const valueDiv = createValueElement(itemId, keyName, valueIndex, value, openReconciliationModal);
                                td.appendChild(valueDiv);
                            });
                            
                            tr.appendChild(td);
                        }
                    } else if (propItem.type === 'manual') {
                        // Handle manual property cell
                        const manualProp = propItem.data;
                        const propertyId = manualProp.property.id;
                        const defaultValue = manualProp.defaultValue || '';
                        
                        // Create a cell for the manual property with the default value
                        const td = createManualPropertyCell(itemId, propertyId, defaultValue, manualProp);
                        tr.appendChild(td);
                    }
                });
                
                reconciliationRows.appendChild(tr);
            });
            
            // Only restore reconciliation display when returning to step
            // No automatic reconciliation for fresh tables - users control reconciliation via column buttons
            if (isReturningToStep) {
                restoreReconciliationDisplay(data, mappedKeys, manualProperties);
            }
            
        } else {
            console.error('🔨 reconciliationRows element not found!');
        }
    };
}

/**
 * Create a factory function for restoring reconciliation display
 */
export function createRestoreReconciliationDisplayFactory(reconciliationData) {
    return function restoreReconciliationDisplay(data, mappedKeys, manualProperties = []) {
        data.forEach((item, index) => {
            const itemId = `item-${index}`;
            
            mappedKeys.forEach(keyObj => {
                const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                const propData = reconciliationData[itemId]?.properties[keyName];
                
                if (propData && propData.reconciled) {
                    propData.reconciled.forEach((reconciledItem, valueIndex) => {
                        const cellInfo = { itemId, property: keyName, valueIndex };
                        
                        if (reconciledItem.status === 'reconciled' && reconciledItem.selectedMatch) {
                            // Restore reconciled state
                            updateCellDisplay(itemId, keyName, valueIndex, 'reconciled', reconciledItem.selectedMatch);
                        } else if (reconciledItem.status === 'skipped') {
                            // Restore skipped state
                            updateCellDisplay(itemId, keyName, valueIndex, 'skipped');
                        } else if (reconciledItem.status === 'no-item') {
                            // Restore no-item state
                            updateCellDisplay(itemId, keyName, valueIndex, 'no-item');
                        } else if (reconciledItem.status === 'error') {
                            // Restore error state with enhanced error info
                            const errorInfo = {
                                message: reconciledItem.error || 'Unknown error',
                                timestamp: reconciledItem.timestamp,
                                retryable: reconciledItem.retryable !== false // Default to retryable
                            };
                            updateCellDisplayWithError(itemId, keyName, valueIndex, errorInfo);
                        } else if (reconciledItem.matches && reconciledItem.matches.length > 0) {
                            // Restore match percentage display for non-reconciled items with matches
                            const bestMatch = reconciledItem.matches[0];
                            updateCellDisplayWithMatch(itemId, keyName, valueIndex, bestMatch);
                        }
                    });
                }
            });
            
            // Restore manual properties reconciliation states
            manualProperties.forEach(manualProp => {
                const propertyId = manualProp.property.id;
                const propData = reconciliationData[itemId]?.properties[propertyId];
                
                if (propData && propData.reconciled) {
                    propData.reconciled.forEach((reconciledItem, valueIndex) => {
                        const cellInfo = { itemId, property: propertyId, valueIndex };
                        
                        if (reconciledItem.status === 'reconciled' && reconciledItem.selectedMatch) {
                            // Restore reconciled state
                            updateCellDisplay(itemId, propertyId, valueIndex, 'reconciled', reconciledItem.selectedMatch);
                        } else if (reconciledItem.status === 'skipped') {
                            // Restore skipped state
                            updateCellDisplay(itemId, propertyId, valueIndex, 'skipped');
                        } else if (reconciledItem.status === 'no-item') {
                            // Restore no-item state
                            updateCellDisplay(itemId, propertyId, valueIndex, 'no-item');
                        } else if (reconciledItem.status === 'error') {
                            // Restore error state with enhanced error info
                            const errorInfo = {
                                message: reconciledItem.error || 'Unknown error',
                                timestamp: reconciledItem.timestamp,
                                retryable: reconciledItem.retryable !== false // Default to retryable
                            };
                            updateCellDisplayWithError(itemId, propertyId, valueIndex, errorInfo);
                        } else if (reconciledItem.matches && reconciledItem.matches.length > 0) {
                            // Restore match percentage display for non-reconciled manual properties with matches
                            const bestMatch = reconciledItem.matches[0];
                            updateCellDisplayWithMatch(itemId, propertyId, valueIndex, bestMatch);
                        }
                    });
                }
            });
        });
    };
}