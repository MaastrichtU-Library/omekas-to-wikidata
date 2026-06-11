/**
 * Reconciliation Table UI Module
 * @module reconciliation/ui/reconciliation-table
 * 
 * Handles the generation and management of the reconciliation table interface,
 * including property cells, value elements, loading states, and display updates.
 */

import { createElement } from '../../ui/components.js';
import { combineAndSortProperties, extractPropertyValues, extractPropertyValueDetails } from '../core/reconciliation-data.js';
import { getOmekaFieldFriendlyName } from '../../mapping/core/data-analyzer.js';

/**
 * Create item cell content with link button
 * @param {string} itemId - Item ID (e.g., 'item-0')
 * @param {number} itemNumber - Item number for display (e.g., 1)
 * @param {string|null} linkedQid - Linked Wikidata QID if any
 * @returns {HTMLElement} Item cell content
 */
function createItemCellContent(itemId, itemNumber, linkedQid = null) {
    const container = createElement('div', {
        className: 'item-cell-content',
        dataset: { itemId: itemId }
    });

    if (linkedQid) {
        // Display linked QID with unlink button
        const qidLink = createElement('a', {
            href: `https://www.wikidata.org/wiki/${linkedQid}`,
            target: '_blank',
            className: 'linked-qid-display',
            title: `Linked to ${linkedQid} - Click to view on Wikidata`
        }, linkedQid);

        const unlinkBtn = createElement('button', {
            className: 'unlink-btn',
            title: 'Unlink this item',
            style: 'background: none; border: none; padding: 0 4px; margin-left: 4px; cursor: pointer; font-size: 16px; font-weight: bold; color: #666; vertical-align: baseline;',
            onclick: () => {
                if (window.onItemUnlinked) {
                    window.onItemUnlinked(itemId, itemNumber);
                }
            }
        }, '×');

        container.appendChild(qidLink);
        container.appendChild(document.createTextNode(' '));
        container.appendChild(unlinkBtn);
    } else {
        // Display "new item N" with link button
        const itemText = createElement('span', {
            className: 'item-number-text'
        }, `new item ${itemNumber}`);

        const linkBtn = createElement('button', {
            className: 'link-item-btn',
            title: 'Link to existing Wikidata item',
            style: 'background: none; border: none; padding: 0; margin-left: 4px; cursor: pointer; font-size: 14px; vertical-align: baseline;',
            onclick: () => {
                if (window.openLinkItemModal) {
                    window.openLinkItemModal(itemId, itemNumber);
                }
            }
        }, '🔗');

        container.appendChild(itemText);
        container.appendChild(document.createTextNode(' '));
        container.appendChild(linkBtn);
    }

    return container;
}

/**
 * Update item cell to reflect link status
 * @param {string} itemId - Item ID (e.g., 'item-0')
 * @param {number} itemNumber - Item number for display (e.g., 1)
 * @param {string|null} linkedQid - Linked Wikidata QID if any
 */
export function updateItemCellDisplay(itemId, itemNumber, linkedQid = null) {
    const itemCell = document.querySelector(`#row-${itemId} .item-cell`) ||
        document.querySelector(`.item-header[data-item-id="${itemId}"]`);
    if (!itemCell) return;

    // Clear existing content
    itemCell.innerHTML = '';

    // Add new content
    const content = createItemCellContent(itemId, itemNumber, linkedQid);
    itemCell.appendChild(content);
}

/**
 * Update cell display to show error state (duplicated from batch-processor for UI access)
 */
function updateCellDisplayWithError(itemId, mappingId, valueIndex, errorInfo) {
    const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
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
export function updateCellLoadingState(itemId, mappingId, valueIndex, isLoading) {
    const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
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
export function updateCellDisplayAsNoMatches(itemId, mappingId, valueIndex) {
    const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
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
export function updateCellDisplayWithMatch(itemId, mappingId, valueIndex, bestMatch) {
    // Find the cell element
    const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
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
export function updateCellDisplay(itemId, mappingId, valueIndex, status, reconciliation = null) {
    // Find the cell element
    const cellSelector = `[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
    const cell = document.querySelector(cellSelector);
    
    if (cell) {
        // For multiple values, always use indexed selection; for single values, use the first element
        const allValueElements = cell.querySelectorAll('.property-value');
        const valueElement = allValueElements.length > 1 ? allValueElements[valueIndex] : allValueElements[0];
        
        if (valueElement) {
            valueElement.dataset.status = status;
            
            const statusSpan = valueElement.querySelector('.value-status');
            const valueTextSpan = valueElement.querySelector('.value-text');
            if (statusSpan) {
                if (status === 'pending') {
                    statusSpan.textContent = 'Click to reconcile';
                    statusSpan.className = 'value-status';
                    statusSpan.removeAttribute('title');
                } else if (status === 'reconciled' && reconciliation) {
                    if (reconciliation.type === 'wikidata') {
                        const autoAcceptedText = reconciliation.qualifiers?.autoAccepted ? ' (auto)' : '';
                        statusSpan.innerHTML = `✓ <a href="https://www.wikidata.org/wiki/${reconciliation.id}" target="_blank">${reconciliation.id}</a>${autoAcceptedText}`;
                    } else if (reconciliation.type === 'string') {
                        statusSpan.textContent = '✓ String value';
                        statusSpan.title = `Using original value as string: "${reconciliation.value}"`;
                        if (valueTextSpan && reconciliation.value) {
                            valueTextSpan.textContent = reconciliation.value;
                        }
                    } else {
                        const autoAcceptedText = reconciliation.qualifiers?.autoAccepted ? ' (auto)' : '';
                        let customText = `✓ Custom value${autoAcceptedText}`;
                        let customTooltip = reconciliation.value || '';
                        
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
                            customTooltip = `${reconciliation.value || ''}${customTooltip ? ` (${precisionLabel})` : precisionLabel}`;
                        }
                        
                        statusSpan.textContent = customText;
                        if (customTooltip) {
                            statusSpan.title = customTooltip;
                        }

                        if (valueTextSpan && reconciliation.value) {
                            const languageSuffix = reconciliation.languageLabel || reconciliation.language;
                            valueTextSpan.textContent = languageSuffix
                                ? `${reconciliation.value} (${languageSuffix})`
                                : reconciliation.value;
                        }
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
            valueElement.classList.remove(
                'high-confidence-match',
                'partial-match',
                'low-confidence-match',
                'checking',
                'reconciled',
                'no-item',
                'reconciliation-error'
            );
            
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
            } else {
                valueElement.style.cursor = 'pointer';
            }
        }
    }
}

/**
 * Create a factory function for creating property cells
 */
export function createPropertyCellFactory(openReconciliationModal) {
    return function createPropertyCell(itemId, property, valueIndex, value, keyObj) {
        // Calculate mappingId from keyObj
        const mappingId = keyObj?.mappingId || property; // Use mappingId if available, fallback for compatibility

        const td = createElement('td', {
            className: 'property-cell single-value-cell',
            dataset: {
                itemId: itemId,
                property: property,  // Keep for reference
                mappingId: mappingId,  // NEW: Unique identifier
                valueIndex: valueIndex
            }
        });

        const valueDiv = createValueElement(itemId, property, valueIndex, value, openReconciliationModal, keyObj);
        td.appendChild(valueDiv);

        return td;
    };
}

/**
 * Create a value element within a property cell
 */
function createValueElement(itemId, property, valueIndex, value, openReconciliationModal, keyObj) {
    const mappingId = keyObj?.mappingId || property;
    const valueDetail = value && typeof value === 'object' && 'value' in value
        ? value
        : { value };

    const valueDiv = createElement('div', {
        className: 'property-value',
        dataset: {
            status: 'pending',
            mappingId: mappingId  // NEW: Store mappingId for reference
        }
    });

    const textSpan = createElement('span', {
        className: 'value-text'
    }, valueDetail.value || 'Empty value');

    const statusSpan = createElement('span', {
        className: 'value-status'
    }, 'Click to reconcile');

    if (valueDetail.sourceLabel) {
        valueDiv.appendChild(createElement('span', {
            className: 'value-source-badge',
            title: valueDetail.sourceDetail || valueDetail.sourceLabel,
            dataset: {
                sourceKey: valueDetail.sourceKey || ''
            }
        }, valueDetail.sourceLabel));
    }

    valueDiv.appendChild(textSpan);
    valueDiv.appendChild(statusSpan);

    // Add click handler - pass keyObj to modal
    const clickHandler = () => {
        openReconciliationModal(itemId, property, valueIndex, valueDetail.value, keyObj);
    };

    valueDiv.addEventListener('click', clickHandler);

    return valueDiv;
}

/**
 * Create a factory function for creating manual property cells
 */
export function createManualPropertyCellFactory(openReconciliationModal) {
    return function createManualPropertyCell(itemId, propertyId, defaultValue, manualProp) {
        // For manual properties, use propertyId as mappingId
        const mappingId = propertyId;

        const td = createElement('td', {
            className: 'property-cell manual-property-cell',
            dataset: {
                itemId: itemId,
                property: propertyId,
                mappingId: mappingId,  // NEW: Add mappingId
                isManual: 'true'
            }
        });

        // Create a value element for the manual property
        const valueDiv = createElement('div', {
            className: 'property-value manual-property-value',
            dataset: {
                status: 'pending',
                mappingId: mappingId  // NEW: Add mappingId
            }
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

    function syncReconciliationColgroup(itemCount) {
        const table = propertyHeaders?.closest('table');
        if (!table) {
            return;
        }

        const existingColgroup = table.querySelector('colgroup.reconciliation-colgroup');
        if (existingColgroup) {
            existingColgroup.remove();
        }

        const colgroup = createElement('colgroup', {
            className: 'reconciliation-colgroup'
        });
        colgroup.appendChild(createElement('col', {
            className: 'reconciliation-col reconciliation-col--field'
        }));

        for (let index = 0; index < itemCount; index += 1) {
            colgroup.appendChild(createElement('col', {
                className: 'reconciliation-col reconciliation-col--item'
            }));
        }

        table.insertBefore(colgroup, table.firstChild);
    }

    function createMappedFieldHeaderContent(keyObj, keyName, data) {
        const headerContent = createElement('div', {
            className: 'property-header-content property-header-content--row'
        });

        const sourceRow = createElement('div', {
            className: 'property-source-row'
        });
        const friendlyName = getOmekaFieldFriendlyName(keyObj, keyName);
        const sourceLabel = createElement('span', {
            className: 'property-source-label property-source-label--primary'
        }, friendlyName && friendlyName !== keyName ? friendlyName : keyName);
        sourceRow.appendChild(sourceLabel);

        if (friendlyName && friendlyName !== keyName) {
            sourceRow.appendChild(createElement('span', {
                className: 'property-source-technical'
            }, keyName));
        }

        const mappedRow = createElement('div', {
            className: 'property-mapped-row'
        });
        const mappedPrefix = createElement('span', {
            className: 'property-mapped-prefix'
        }, 'Wikidata: ');
        const labelSpan = createElement('span', {
            className: 'property-label'
        }, keyObj.property.label);
        const wikidataUrl = getWikidataUrlForProperty(keyObj.property);
        const qidLink = createElement('a', {
            className: 'property-qid-link',
            href: wikidataUrl,
            target: '_blank',
            onClick: (e) => e.stopPropagation()
        }, keyObj.property.id);

        mappedRow.appendChild(mappedPrefix);
        mappedRow.appendChild(labelSpan);
        mappedRow.appendChild(document.createTextNode(' ('));
        mappedRow.appendChild(qidLink);
        mappedRow.appendChild(document.createTextNode(')'));

        if (keyObj.property.datatype === 'monolingualtext') {
            mappedRow.appendChild(createElement('span', {
                className: 'property-language-indicator',
                title: 'This Wikidata property expects text with a language code.'
            }, ' Language required'));
        }

        headerContent.appendChild(sourceRow);
        headerContent.appendChild(mappedRow);

        if (keyObj.property?.datatype === 'wikibase-item') {
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
            }, 'Reconcile field');
            reconcileBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await reconcileColumn(keyName, keyObj, data);
            });
            buttonContainer.appendChild(reconcileBtn);
            headerContent.appendChild(buttonContainer);
        }

        return headerContent;
    }

    function createManualFieldHeaderContent(manualProp, data) {
        const headerContent = createElement('div', {
            className: 'property-header-content property-header-content--row'
        });

        const sourceRow = createElement('div', {
            className: 'property-source-row'
        }, `Manual value (${manualProp.property.id})`);

        const mappedRow = createElement('div', {
            className: 'property-mapped-row'
        });
        const mappedPrefix = createElement('span', {
            className: 'property-mapped-prefix'
        }, 'Wikidata: ');
        const labelSpan = createElement('span', {
            className: 'property-label'
        }, manualProp.property.label);
        const qidLink = createElement('a', {
            className: 'property-qid-link',
            href: getWikidataUrlForProperty(manualProp.property),
            target: '_blank',
            onClick: (e) => e.stopPropagation()
        }, manualProp.property.id);

        mappedRow.appendChild(mappedPrefix);
        mappedRow.appendChild(labelSpan);
        mappedRow.appendChild(document.createTextNode(' ('));
        mappedRow.appendChild(qidLink);
        mappedRow.appendChild(document.createTextNode(')'));

        if (manualProp.isRequired) {
            mappedRow.appendChild(createElement('span', {
                className: 'required-indicator-header'
            }, ' *'));
        }

        if (manualProp.property?.datatype === 'monolingualtext') {
            mappedRow.appendChild(createElement('span', {
                className: 'property-language-indicator',
                title: 'This Wikidata property expects text with a language code.'
            }, ' Language required'));
        }

        headerContent.appendChild(sourceRow);
        headerContent.appendChild(mappedRow);

        if (manualProp.property?.datatype === 'wikibase-item') {
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
            }, 'Reconcile field');
            reconcileBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await reconcileColumn(manualProp.property.id, manualProp, data);
            });
            buttonContainer.appendChild(reconcileBtn);
            headerContent.appendChild(buttonContainer);
        }

        return headerContent;
    }
    
    return async function createReconciliationTable(data, mappedKeys, isReturningToStep = false) {
        
        // Get manual properties from state for restoration and display
        const currentState = state.getState();
        const manualProperties = currentState.mappings?.manualProperties || [];
        
        // Combine and sort all properties for display priority
        const sortedProperties = combineAndSortProperties(mappedKeys, manualProperties, {
            resourceTemplates: currentState.resourceTemplates,
            selectedTemplateIds: currentState.selectedTemplates
        });

        syncReconciliationColgroup(data.length);

        if (propertyHeaders) {
            propertyHeaders.innerHTML = '';
            propertyHeaders.appendChild(createElement('th', {
                className: 'field-header'
            }, 'Mapped field'));

            data.forEach((item, index) => {
                const itemId = `item-${index}`;
                const linkedQid = state.getLinkedItem ? state.getLinkedItem(itemId) : null;
                const itemHeader = createElement('th', {
                    className: 'item-header',
                    dataset: { itemId }
                });
                itemHeader.appendChild(createItemCellContent(itemId, index + 1, linkedQid));
                propertyHeaders.appendChild(itemHeader);
            });
        }

        if (reconciliationRows) {
            reconciliationRows.innerHTML = '';

            sortedProperties.forEach(propItem => {
                const tr = createElement('tr', {
                    className: 'reconciliation-row reconciliation-row--field'
                });

                if (propItem.type === 'mapped') {
                    const keyObj = propItem.data;
                    const keyName = typeof keyObj === 'string' ? keyObj : keyObj.key;
                    const mappingId = keyObj?.mappingId || keyName;

                    const fieldCell = createElement('td', {
                        className: 'property-header clickable-header field-row-header',
                        dataset: {
                            property: keyName,
                            mappingId
                        },
                        onClick: () => {
                            if (window.openMappingModal) {
                                window.openMappingModal(keyObj);
                            }
                        },
                        title: 'Click to modify mapping'
                    }, keyObj.property?.label
                        ? createMappedFieldHeaderContent(keyObj, keyName, data)
                        : keyName);
                    tr.appendChild(fieldCell);

                    data.forEach((item, index) => {
                        const itemId = `item-${index}`;
                        const valueDetails = extractPropertyValueDetails(item, keyObj, state);

                        if (valueDetails.length === 0) {
                            tr.appendChild(createElement('td', {
                                className: 'property-cell empty-cell',
                                dataset: {
                                    itemId,
                                    property: keyName,
                                    mappingId
                                }
                            }, '-'));
                        } else if (valueDetails.length === 1) {
                            tr.appendChild(createPropertyCell(itemId, keyName, 0, valueDetails[0], keyObj));
                        } else {
                            const td = createElement('td', {
                                className: 'property-cell multi-value-cell',
                                dataset: {
                                    itemId,
                                    property: keyName,
                                    mappingId
                                }
                            });

                            valueDetails.forEach((valueDetail, valueIndex) => {
                                td.appendChild(createValueElement(itemId, keyName, valueIndex, valueDetail, openReconciliationModal, keyObj));
                            });

                            tr.appendChild(td);
                        }
                    });
                } else if (propItem.type === 'manual') {
                    const manualProp = propItem.data;
                    const propertyId = manualProp.property.id;

                    const fieldCell = createElement('td', {
                        className: 'property-header manual-property-header clickable-header field-row-header',
                        dataset: {
                            property: propertyId,
                            mappingId: propertyId,
                            isManual: 'true'
                        },
                        title: `${manualProp.property.description}\nClick to modify property settings`,
                        onClick: () => {
                            if (window.openManualPropertyEditModal) {
                                window.openManualPropertyEditModal(manualProp);
                            }
                        }
                    }, createManualFieldHeaderContent(manualProp, data));
                    tr.appendChild(fieldCell);

                    data.forEach((item, index) => {
                        const itemId = `item-${index}`;
                        tr.appendChild(createManualPropertyCell(itemId, propertyId, manualProp.defaultValue || '', manualProp));
                    });
                }

                reconciliationRows.appendChild(tr);
            });

            if (isReturningToStep) {
                restoreReconciliationDisplay(data, mappedKeys, manualProperties);
            }
        } else {
            console.error('reconciliationRows element not found');
        }

        return;
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
                const mappingId = keyObj?.mappingId || keyName;

                // Use mappingId to access data
                const propData = reconciliationData[itemId]?.properties[mappingId];

                if (propData && propData.reconciled) {
                    propData.reconciled.forEach((reconciledItem, valueIndex) => {
                        const cellInfo = { itemId, property: keyName, mappingId: mappingId, valueIndex };

                        if (reconciledItem.status === 'reconciled' && reconciledItem.selectedMatch) {
                            // Restore reconciled state - use mappingId
                            updateCellDisplay(itemId, mappingId, valueIndex, 'reconciled', reconciledItem.selectedMatch);
                        } else if (reconciledItem.status === 'skipped') {
                            // Restore skipped state - use mappingId
                            updateCellDisplay(itemId, mappingId, valueIndex, 'skipped');
                        } else if (reconciledItem.status === 'no-item') {
                            // Restore no-item state - use mappingId
                            updateCellDisplay(itemId, mappingId, valueIndex, 'no-item');
                        } else if (reconciledItem.status === 'error') {
                            // Restore error state with enhanced error info - use mappingId
                            const errorInfo = {
                                message: reconciledItem.error || 'Unknown error',
                                timestamp: reconciledItem.timestamp,
                                retryable: reconciledItem.retryable !== false // Default to retryable
                            };
                            updateCellDisplayWithError(itemId, mappingId, valueIndex, errorInfo);
                        } else if (reconciledItem.matches && reconciledItem.matches.length > 0) {
                            // Restore match percentage display for non-reconciled items with matches - use mappingId
                            const bestMatch = reconciledItem.matches[0];
                            updateCellDisplayWithMatch(itemId, mappingId, valueIndex, bestMatch);
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
