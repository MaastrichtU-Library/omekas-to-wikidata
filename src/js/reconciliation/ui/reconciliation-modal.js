/**
 * Reconciliation Modal Interface Module
 * @module reconciliation/ui/reconciliation-modal
 * 
 * Handles modal creation, user interactions, and reconciliation UI including
 * automatic match display, manual search, and custom input interfaces.
 */

import { detectPropertyType, getInputFieldConfig, createInputHTML, setupDynamicDatePrecision, validateInput, standardizeDateInput } from '../../utils/property-types.js';
import { getConstraintSummary } from '../../utils/constraint-helpers.js';
import { createElement } from '../../ui/components.js';
import { isDateValue, escapeHtml, tryDirectWikidataSearch } from '../core/entity-matcher.js';

/**
 * Display reconciliation results in the modal
 */
export function displayReconciliationResults(matches, propertyType, value) {
    const loadingState = document.querySelector('.loading-state');
    const matchesDisplay = document.querySelector('.matches-display');
    
    if (loadingState) {
        loadingState.style.display = 'none';
    }
    
    if (!matchesDisplay) return;
    
    // Handle non-Wikidata properties
    if (propertyType !== 'wikibase-item') {
        if (propertyType === 'time' || isDateValue(value)) {
            // For date properties, show date input interface directly
            matchesDisplay.innerHTML = '<p>Date/time property - use the date input below.</p>';
            matchesDisplay.style.display = 'block';
            showCustomInputInterface(propertyType, value);
        } else {
            matchesDisplay.innerHTML = '<p>Non-Wikidata property - use manual input section below.</p>';
            matchesDisplay.style.display = 'block';
        }
        return;
    }
    
    if (!matches || matches.length === 0) {
        matchesDisplay.innerHTML = '<p class="no-matches">No automatic matches found. Try manual search below.</p>';
        matchesDisplay.style.display = 'block';
        
        // Show fallback options for manual search
        displayFallbackOptions(value, []);
        return;
    }
    
    // New confidence logic from Q&A requirements:
    // - Show ALL suggestions with 80%+ confidence if multiple matches exist at that level
    // - If no suggestions above 80%, display the top 3 best matches
    
    const highConfidenceMatches = matches.filter(m => m.score >= 80);
    let displayMatches = [];
    
    if (highConfidenceMatches.length > 0) {
        // Show ALL matches above 80%
        displayMatches = highConfidenceMatches;
    } else {
        // Show top 3 best matches
        displayMatches = matches.slice(0, 3);
    }
    
    // Debug logging to identify undefined labels
    displayMatches.forEach((match, index) => {
        console.log('Match data:', {
            id: match.id,
            name: match.name,
            description: match.description,
            score: match.score,
            rawMatch: match
        });
    });

    matchesDisplay.innerHTML = `
        <div class="matches-header">
            <h5>Reconciliation Suggestions</h5>
            ${highConfidenceMatches.length > 0 ? 
                `<p class="confidence-note">All matches above 80% confidence:</p>` : 
                `<p class="confidence-note">Top ${displayMatches.length} matches (no high-confidence matches found):</p>`
            }
        </div>
        <div class="matches-list">
            ${displayMatches.map((match, index) => {
                // Ensure we have fallback values for undefined labels
                const matchName = match.name || match.label || 'Unnamed item';
                const matchDescription = match.description || match.desc || 'No description available';
                const safeMatchName = escapeHtml(matchName);
                const safeMatchDescription = escapeHtml(matchDescription);
                
                return `
                <div class="match-item-simplified" data-match-id="${match.id}" onclick="selectMatch('${match.id}', '${safeMatchName}', '${safeMatchDescription}')">
                    <div class="match-score">${match.score.toFixed(1)}%</div>
                    <div class="match-content">
                        <div class="match-name">${matchName}</div>
                        <div class="match-description">${matchDescription}</div>
                        <div class="match-id">
                            <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank" onclick="event.stopPropagation()">
                                ${match.id}
                            </a>
                        </div>
                    </div>
                    <div class="match-select">
                        <button class="btn small primary" onclick="event.stopPropagation(); selectMatch('${match.id}', '${safeMatchName}', '${safeMatchDescription}')">
                            Select
                        </button>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
        ${matches.length > displayMatches.length ? `
            <div class="view-all-matches">
                <button class="btn secondary" onclick="showAllMatches()">
                    View all ${matches.length} matches
                </button>
            </div>
        ` : ''}
    `;
    
    matchesDisplay.style.display = 'block';
    
    // Show fallback options if there are no high-confidence matches
    if (highConfidenceMatches.length === 0) {
        displayFallbackOptions(value, matches);
    }
    
    // Store all matches for "View all" functionality
    window.allReconciliationMatches = matches;
}

/**
 * Display high confidence matches in a horizontal scrollable container
 */
export function displayHighConfidenceMatches(matches) {
    const container = document.querySelector('.high-confidence-matches');
    if (!container) return;
    
    container.innerHTML = `
        <h5 class="matches-title">High Confidence Matches (≥80%)</h5>
        <div class="matches-scroll-container">
            ${matches.map((match, index) => {
                const matchName = match.name || match.label || 'Unnamed item';
                const matchDescription = match.description || match.desc || 'No description available';
                return `
                <div class="confidence-match-card ${index === 0 ? 'best-match' : ''}" data-match-id="${match.id}">
                    <div class="match-confidence">${match.score.toFixed(1)}% confidence</div>
                    <div class="match-name">${matchName}</div>
                    <div class="match-description">${matchDescription}</div>
                    <div class="match-id">
                        <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                    </div>
                    <button class="btn small primary select-match-btn" onclick="selectMatchAndAdvance('${match.id}')">
                        ${index === 0 ? '🎯 Select Best Match' : 'Select'}
                    </button>
                </div>
                `;
            }).join('')}
        </div>
        <p class="scroll-hint">← Scroll for more high-confidence matches →</p>
    `;
}

/**
 * Display fallback options for low/no confidence scenarios
 */
export function displayFallbackOptions(value, matches) {
    const container = document.querySelector('.fallback-options');
    if (!container) return;
    
    // Show the fallback options container
    container.style.display = 'block';
    
    // Populate the search input with the original value
    const searchInput = container.querySelector('.search-input');
    if (searchInput) {
        searchInput.value = value || '';
    }
    
    // Setup manual search functionality
    setTimeout(() => {
        setupManualSearchInFallback();
    }, 100);
}

/**
 * Show custom input interface for non-Wikidata properties
 */
export function showCustomInputInterface(propertyType, value) {
    const container = document.querySelector('.primary-recommendations');
    if (!container) return;
    
    const inputConfig = getInputFieldConfig(propertyType);
    const customInputHTML = createInputHTML(propertyType, value);
    
    container.innerHTML = `
        <div class="non-wikidata-input">
            <h5>Enter ${inputConfig.description}</h5>
            <div class="custom-input-container">
                ${customInputHTML}
            </div>
            <div class="input-actions">
                <button class="btn primary" onclick="confirmCustomValue()">Confirm Value</button>
            </div>
        </div>
    `;
    
    // Show the container
    container.style.display = 'block';
    
    // Setup date precision for date inputs
    if (propertyType === 'time') {
        setTimeout(() => {
            const dateInput = container.querySelector('.flexible-date-input');
            if (dateInput) {
                setupDynamicDatePrecision(dateInput);
            }
        }, 100);
    }
}

/**
 * Setup manual search functionality in fallback options
 */
export function setupManualSearchInFallback() {
    const searchBtn = document.querySelector('.search-btn');
    const searchInput = document.querySelector('.search-input');
    
    if (searchBtn && searchInput) {
        const performSearch = async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            
            try {
                const matches = await tryDirectWikidataSearch(query);
                displayFallbackSearchResults(matches);
            } catch (error) {
                console.error('Search error:', error);
                displayFallbackSearchResults([]);
            }
        };
        
        searchBtn.onclick = performSearch;
    }
}

/**
 * Display search results in fallback options
 */
export function displayFallbackSearchResults(matches) {
    const fallbackContainer = document.querySelector('.fallback-options');
    if (!fallbackContainer) return;
    
    const existingResults = fallbackContainer.querySelector('.fallback-search-results');
    if (existingResults) {
        existingResults.remove();
    }
    
    if (matches.length > 0) {
        const resultsHTML = `
            <div class="fallback-search-results">
                <h6>Search Results</h6>
                ${matches.map(match => `
                    <div class="fallback-result-item" data-match-id="${match.id}">
                        <div class="result-info">
                            <div class="result-name">${match.name}</div>
                            <div class="result-description">${match.description}</div>
                            <div class="result-id">
                                <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                            </div>
                        </div>
                        <button class="btn small primary" onclick="selectMatchAndAdvance('${match.id}')">Select</button>
                    </div>
                `).join('')}
            </div>
        `;
        fallbackContainer.insertAdjacentHTML('beforeend', resultsHTML);
    } else {
        fallbackContainer.insertAdjacentHTML('beforeend', `
            <div class="fallback-search-results">
                <p>No results found.</p>
            </div>
        `);
    }
}

/**
 * Setup expanded search functionality
 */
export function setupExpandedSearch() {
    const searchBtn = document.querySelector('.search-btn-expanded');
    const searchInput = document.querySelector('.search-input-expanded');
    const resultsContainer = document.querySelector('.search-results-expanded');
    
    if (searchBtn && searchInput && resultsContainer) {
        const performSearch = async () => {
            const query = searchInput.value.trim();
            if (!query) return;
            
            resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
            
            try {
                const matches = await tryDirectWikidataSearch(query);
                
                if (matches.length > 0) {
                    resultsContainer.innerHTML = matches.map(match => `
                        <div class="expanded-result-item" data-match-id="${match.id}">
                            <div class="result-info">
                                <div class="result-name">${match.name}</div>
                                <div class="result-description">${match.description}</div>
                                <div class="result-id">
                                    <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                                </div>
                            </div>
                            <button class="btn small primary" onclick="selectMatchAndAdvance('${match.id}')">Select</button>
                        </div>
                    `).join('');
                } else {
                    resultsContainer.innerHTML = '<div class="no-results">No results found.</div>';
                }
            } catch (error) {
                resultsContainer.innerHTML = `<div class="error">Search error: ${error.message}</div>`;
            }
        };
        
        searchBtn.onclick = performSearch;
    }
}

/**
 * Setup manual search functionality
 */
export function setupManualSearch() {
    const searchBtn = document.querySelector('.search-btn');
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.querySelector('.search-results');
    
    const performSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        
        searchResults.innerHTML = '<div class="loading">Searching...</div>';
        
        try {
            const matches = await tryDirectWikidataSearch(query);
            
            if (matches.length > 0) {
                searchResults.innerHTML = matches.map(match => `
                    <div class="search-result-item" data-match-id="${match.id}">
                        <div class="result-info">
                            <div class="result-name">${match.name}</div>
                            <div class="result-description">${match.description}</div>
                            <div class="result-id">
                                <a href="https://www.wikidata.org/wiki/${match.id}" target="_blank">${match.id}</a>
                            </div>
                        </div>
                        <div class="result-actions">
                            <button class="btn small primary" onclick="selectManualMatch('${match.id}')">Select</button>
                        </div>
                    </div>
                `).join('');
            } else {
                searchResults.innerHTML = '<div class="no-results">No results found.</div>';
            }
        } catch (error) {
            searchResults.innerHTML = `<div class="error">Search error: ${error.message}</div>`;
        }
    };
    
    searchBtn.onclick = performSearch;
}

/**
 * Create factory function for opening reconciliation modal
 */
export function createOpenReconciliationModalFactory(dependencies) {
    const {
        modalUI,
        performAutomaticReconciliation,
        setupDynamicDatePrecision,
        setupAutoAdvanceToggle,
        createReconciliationModalContent
    } = dependencies;

    let currentReconciliationCell = null;
    
    return async function openReconciliationModal(itemId, property, valueIndex, value, manualProp = null) {
        currentReconciliationCell = { itemId, property, valueIndex, value, manualProp };
        
        // Create modal content (now async)
        const modalContent = await createReconciliationModalContent(itemId, property, valueIndex, value, manualProp);
        
        // Open modal
        modalUI.openModal('Reconcile Value', modalContent, [], () => {
            currentReconciliationCell = null;
        });
        
        // Setup modal after DOM is rendered
        setTimeout(() => {
            const modalElement = document.querySelector('#modal-content');
            if (modalElement) {
                setupDynamicDatePrecision(modalElement);
                setupAutoAdvanceToggle();
            } else {
                console.warn('⚠️ Modal content element not found for setup');
            }
        }, 100);
        
        // Start automatic reconciliation (but use existing matches if available)
        await performAutomaticReconciliation(value, property, itemId, valueIndex);
    };
}

/**
 * Create factory function for creating modal content
 */
export function createReconciliationModalContentFactory(dependencies) {
    const {
        reconciliationData,
        getPropertyDisplayInfo,
        getOriginalKeyInfo,
        getReconciliationRequirementReason,
        getConstraintSummary
    } = dependencies;
    
    return async function createReconciliationModalContent(itemId, property, valueIndex, value, manualProp = null) {
        // Get property metadata from reconciliation data if available
        let propertyObj = null;
        if (itemId && reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            const propData = reconciliationData[itemId].properties[property];
            
            // Get property object from stored metadata
            if (propData.propertyMetadata) {
                propertyObj = propData.propertyMetadata;
            } else if (propData.manualPropertyData) {
                // For manual properties, use the property data
                propertyObj = propData.manualPropertyData.property;
            }
        }
        
        // For manual properties passed directly, use that
        if (manualProp) {
            propertyObj = manualProp.property;
        }
        
        // Detect property type for dynamic input fields
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        
        // Get property information for display (now async)
        const propertyInfo = await getPropertyDisplayInfo(property);
        const originalKeyInfo = getOriginalKeyInfo(itemId, property);
        const itemTitle = reconciliationData[itemId]?.originalData?.['o:title'] || `Item ${itemId.replace('item-', '')}`;
        
        // Get constraint information for display
        const constraintInfo = propertyObj ? getConstraintSummary(propertyObj) : null;
        
        // Determine why Wikidata item is required (Entity Schema vs property constraint)
        const requirementReason = getReconciliationRequirementReason(property);
        
        return `
            <div class="reconciliation-modal-compact">
                <!-- Compact Property Display with Original Value -->
                <div class="property-section">
                    <div class="property-header">
                        <a href="${propertyInfo.wikidataUrl}" target="_blank" class="property-link">
                            ${propertyInfo.label} (${propertyInfo.pid})
                            ${propertyInfo.isMock ? ' <span class="mock-indicator">[estimated]</span>' : ''}
                        </a>
                    </div>
                    <p class="property-description">
                        ${propertyInfo.description}
                        <a href="https://www.wikidata.org/wiki/Help:Description" target="_blank" class="help-link" title="Learn about Wikidata descriptions">
                            <span class="help-icon">ⓘ</span>
                        </a>
                    </p>
                    
                    ${constraintInfo && constraintInfo.hasConstraints ? `
                    <!-- Property Constraints Information -->
                    <div class="property-constraints">
                        <div class="constraint-info-notice">
                            Property constraints from Wikidata:
                        </div>
                        ${constraintInfo.datatype ? `
                        <div class="constraint-datatype">
                            <strong>Expects:</strong> ${constraintInfo.datatype}
                        </div>
                        ` : ''}
                        ${constraintInfo.valueTypes.length > 0 ? `
                        <div class="constraint-value-types">
                            <strong>Must be:</strong> ${constraintInfo.valueTypes.join(', ')}
                        </div>
                        ` : ''}
                        ${constraintInfo.formatRequirements.length > 0 ? `
                        <div class="constraint-format">
                            <strong>Format:</strong> ${constraintInfo.formatRequirements.join('; ')}
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                    
                    <div class="original-info">
                        <span class="original-label">Original key:</span>
                        <a href="${originalKeyInfo.lodUri}" target="_blank" class="original-link">
                            ${originalKeyInfo.keyName}
                        </a>
                    </div>
                    <div class="value-context">
                        <strong>"${value}"</strong> from ${itemTitle}
                    </div>
                </div>
                
                <!-- Reconciliation Results -->
                <div class="reconciliation-results">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Finding matches...</p>
                    </div>
                    <div class="matches-display" style="display: none;">
                        <!-- Results will be populated here -->
                    </div>
                    <div class="primary-recommendations" style="display: none;">
                        <!-- Primary recommendations will be populated here -->
                    </div>
                </div>
                
                <!-- Fallback Options (Manual Search) -->
                <div class="fallback-options" style="display: none;">
                    <div class="search-wikidata">
                        <input type="text" class="search-input" placeholder="Search Wikidata..." value="">
                        <button class="btn primary search-btn">Search</button>
                    </div>
                    <button class="btn create-new-item" onclick="createNewWikidataItem()">
                        ➕ Create New Wikidata Item
                    </button>
                </div>
                
                <!-- Use as String Option -->
                <div class="use-as-string-option" style="margin-top: 20px; text-align: center;">
                    <button class="btn primary" onclick="useCurrentValueAsString()" style="background-color: #4CAF50; color: white;">
                        📝 Use as String
                    </button>
                    <p style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        Use the original value as a string instead of linking to Wikidata
                    </p>
                </div>
                
                <!-- Ignore Option -->
                <div class="ignore-option" style="margin-top: 20px; text-align: center;">
                    <button class="btn secondary" onclick="ignoreCurrentValue()" style="background-color: #f44336; color: white;">
                        🚫 Ignore This Value
                    </button>
                    <p style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        This value will be skipped and not included in the final mapping
                    </p>
                </div>
            </div>
        `;
    };
}

/**
 * Modal Interaction Functions Factory
 * Creates all modal interaction functions with proper dependency injection
 */
export function createModalInteractionHandlers(dependencies) {
    const {
        currentReconciliationCell,
        modalUI,
        markCellAsReconciled,
        markCellAsSkipped,
        markCellAsNoItem,
        markCellAsString,
        getAutoAdvanceSetting,
        reconcileNextUnprocessedCell,
        setupExpandedSearch
    } = dependencies;

    return {
        toggleMoreOptions() {
            const expandedOptions = document.querySelector('.expanded-options');
            const button = document.querySelector('.expand-options');
            
            if (!expandedOptions || !button) return;
            
            const isExpanded = expandedOptions.style.display === 'block';
            
            if (isExpanded) {
                expandedOptions.style.display = 'none';
                button.textContent = '▼ More Options';
            } else {
                expandedOptions.style.display = 'block';
                button.textContent = '▲ Hide Options';
                
                // Setup expanded search functionality
                if (typeof setupExpandedSearch === 'function') {
                    setTimeout(() => {
                        setupExpandedSearch();
                    }, 100);
                }
            }
        },

        selectMatchAndAdvance(matchId) {
            if (!currentReconciliationCell.current) return;
            
            // Find the match details
            const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
            if (!matchCard) return;
            
            const matchName = matchCard.querySelector('.match-name, .result-name')?.textContent || 'Unknown';
            const matchDescription = matchCard.querySelector('.match-description, .result-description')?.textContent || 'No description';
            
            // Mark as reconciled
            markCellAsReconciled(currentReconciliationCell.current, {
                type: 'wikidata',
                id: matchId,
                label: matchName,
                description: matchDescription
            });
            
            modalUI.closeModal();
            
            // Auto-advance if enabled
            if (getAutoAdvanceSetting()) {
                setTimeout(() => {
                    reconcileNextUnprocessedCell();
                }, 300); // Brief delay for visual feedback
            }
        },

        confirmCustomValue() {
            if (!currentReconciliationCell.current) return;
            
            const { property } = currentReconciliationCell.current;
            const propertyType = detectPropertyType(property);
            
            const inputContainer = document.querySelector('.custom-input-container') || document.querySelector('.custom-input-primary');
            let customValue = null;
            let qualifiers = {};
            
            // Extract value based on input type
            if (inputContainer) {
                const textInput = inputContainer.querySelector('.text-input, .qid-input');
                const numberInput = inputContainer.querySelector('.number-input');
                const dateInput = inputContainer.querySelector('.date-input');
                const urlInput = inputContainer.querySelector('.url-input');
                const coordinatesInput = inputContainer.querySelector('.coordinates-input');
                
                if (textInput) {
                    customValue = textInput.value;
                    
                    // Check for language qualifier
                    const languageSelect = inputContainer.querySelector('.language-select');
                    if (languageSelect && languageSelect.value) {
                        qualifiers.language = languageSelect.value;
                    }
                } else if (numberInput) {
                    customValue = numberInput.value;
                    
                    // Check for unit qualifier
                    const unitSelect = inputContainer.querySelector('.unit-select');
                    if (unitSelect && unitSelect.value) {
                        qualifiers.unit = unitSelect.value;
                    }
                } else if (dateInput) {
                    // Standardize the date input and get precision
                    const standardized = standardizeDateInput(dateInput.value);
                    customValue = standardized.date;
                    
                    // Use detected precision if not manually overridden
                    const precisionSelect = inputContainer.querySelector('.precision-select');
                    const calendarSelect = inputContainer.querySelector('.calendar-select');
                    
                    if (precisionSelect && precisionSelect.value) {
                        qualifiers.precision = precisionSelect.value;
                    } else if (standardized.precision) {
                        // Use automatically detected precision
                        qualifiers.precision = standardized.precision;
                    }
                    
                    if (calendarSelect && calendarSelect.value) {
                        qualifiers.calendar = calendarSelect.value;
                    }
                    
                    // Store the display value for reference
                    if (standardized.displayValue) {
                        qualifiers.displayValue = standardized.displayValue;
                    }
                } else if (urlInput) {
                    customValue = urlInput.value;
                } else if (coordinatesInput) {
                    customValue = coordinatesInput.value;
                }
            }
            
            // Validate the input
            if (customValue) {
                const validation = validateInput(customValue, propertyType);
                
                if (!validation.isValid) {
                    // Show validation error
                    const validationMessage = document.querySelector('.validation-message');
                    if (validationMessage) {
                        validationMessage.textContent = validation.message;
                        validationMessage.style.display = 'block';
                        validationMessage.style.color = 'red';
                    } else {
                        alert(validation.message);
                    }
                    return;
                }
                
                markCellAsReconciled(currentReconciliationCell.current, {
                    type: 'custom',
                    value: customValue,
                    datatype: propertyType,
                    qualifiers: qualifiers
                });
                
                modalUI.closeModal();
                
                // Auto-advance if enabled
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            } else {
                alert('Please enter a value.');
            }
        },

        skipReconciliation() {
            if (currentReconciliationCell.current) {
                markCellAsSkipped(currentReconciliationCell.current);
                modalUI.closeModal();
                
                // Auto-advance if enabled
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            }
        },

        markAsNoWikidataItem() {
            if (currentReconciliationCell.current) {
                markCellAsNoItem(currentReconciliationCell.current);
                modalUI.closeModal();
                
                // Auto-advance if enabled
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            }
        },

        ignoreCurrentValue() {
            if (currentReconciliationCell.current) {
                markCellAsSkipped(currentReconciliationCell.current);
                modalUI.closeModal();
                
                // Auto-advance if enabled
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            }
        },

        useCurrentValueAsString() {
            if (currentReconciliationCell.current) {
                markCellAsString(currentReconciliationCell.current);
                modalUI.closeModal();
                
                // Auto-advance if enabled
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
            }
        },

        createNewWikidataItem() {
            const value = currentReconciliationCell.current?.value;
            if (value) {
                const url = `https://www.wikidata.org/wiki/Special:NewItem?label=${encodeURIComponent(value)}`;
                window.open(url, '_blank');
            }
        },

        selectMatch(matchId, matchName, matchDescription) {
            if (!currentReconciliationCell.current) return;
            
            // If called with only matchId (legacy support)
            if (arguments.length === 1) {
                // Mark match as selected
                document.querySelectorAll('.match-item').forEach(item => {
                    item.classList.remove('selected');
                });
                const matchElement = document.querySelector(`[data-match-id="${matchId}"]`);
                if (matchElement) {
                    matchElement.classList.add('selected');
                }
                return;
            }
            
            // Mark as reconciled
            markCellAsReconciled(currentReconciliationCell.current, {
                type: 'wikidata',
                id: matchId,
                label: matchName,
                description: matchDescription
            });
            
            modalUI.closeModal();
            
            // Auto-advance if enabled
            if (getAutoAdvanceSetting()) {
                setTimeout(() => {
                    reconcileNextUnprocessedCell();
                }, 300);
            }
        },

        showAllMatches() {
            const matchesDisplay = document.querySelector('.matches-display');
            if (!matchesDisplay || !window.allReconciliationMatches) return;
            
            const allMatches = window.allReconciliationMatches;
            
            matchesDisplay.innerHTML = `
                <div class="matches-header">
                    <h5>All Reconciliation Matches</h5>
                    <p class="confidence-note">Showing all ${allMatches.length} matches:</p>
                    <button class="btn secondary" onclick="window.showTopMatches()">← Back to Top Matches</button>
                </div>
                <div class="all-matches-list">
                    ${allMatches.map(match => `
                        <div class="match-item all-match" data-match-id="${match.id}" 
                             onclick="window.selectMatchAndAdvance('${match.id}')">
                            <div class="match-header">
                                <strong class="match-name">${escapeHtml(match.name)}</strong>
                                <span class="match-id">${match.id}</span>
                                <span class="confidence-score">Score: ${Math.round(match.score || 0)}%</span>
                            </div>
                            <p class="match-description">${escapeHtml(match.description || 'No description available')}</p>
                            ${match.aliases && match.aliases.length > 0 ? 
                                `<p class="match-aliases"><strong>Also known as:</strong> ${match.aliases.join(', ')}</p>` : ''
                            }
                        </div>
                    `).join('')}
                </div>
            `;
        },

        showTopMatches() {
            if (!currentReconciliationCell.current || !window.allReconciliationMatches) return;
            
            const { property } = currentReconciliationCell.current;
            const propertyType = detectPropertyType(property);
            
            // Re-display with original logic
            displayReconciliationResults(window.allReconciliationMatches, propertyType, currentReconciliationCell.current.value);
        },

        selectManualMatch(matchId) {
            // Mark as selected and enable confirm
            document.querySelectorAll('.search-result-item').forEach(item => {
                item.classList.remove('selected');
            });
            const matchElement = document.querySelector(`[data-match-id="${matchId}"]`);
            if (matchElement) {
                matchElement.classList.add('selected');
            }
            
            const confirmBtn = document.querySelector('.reconciliation-actions .btn.primary');
            if (confirmBtn) {
                confirmBtn.disabled = false;
            }
        },

        applyTypeOverride() {
            const select = document.querySelector('.type-override-select');
            
            if (!select || !select.value) {
                alert('Please select a property type.');
                return;
            }
            
            const newType = select.value;
            
            // Get current property and value from the modal context
            if (!currentReconciliationCell.current) return;
            
            const { property, value } = currentReconciliationCell.current;
            const inputConfig = getInputFieldConfig(newType);
            
            // Helper function for user-friendly type names
            const getUserFriendlyTypeName = (type) => {
                const typeNames = {
                    'wikibase-item': 'Wikidata item',
                    'string': 'Text string',
                    'external-id': 'External identifier',
                    'url': 'URL',
                    'quantity': 'Number',
                    'time': 'Date/Time',
                    'monolingualtext': 'Text with language',
                    'globe-coordinate': 'Coordinates'
                };
                return typeNames[type] || type;
            };
            
            // Update the expected type display in header
            const expectedTypeElement = document.querySelector('.expected-type');
            if (expectedTypeElement) {
                expectedTypeElement.textContent = `Expected: ${getUserFriendlyTypeName(newType)}`;
            }
            
            // Update primary recommendations section based on new type
            const primaryRecommendations = document.querySelector('.primary-recommendations');
            if (primaryRecommendations) {
                if (newType === 'wikibase-item') {
                    // For Wikidata items, show reconciliation interface
                    primaryRecommendations.innerHTML = `
                        <div class="loading-state">Finding matches...</div>
                        <div class="high-confidence-matches" style="display: none;"></div>
                        <div class="fallback-options" style="display: none;">
                            <div class="search-wikidata">
                                <input type="text" class="search-input" placeholder="Search Wikidata..." value="${value}">
                                <button class="btn primary search-btn">Search</button>
                            </div>
                            <button class="btn create-new-item" onclick="createNewWikidataItem()">
                                ➕ Create New Wikidata Item
                            </button>
                        </div>
                    `;
                    
                    // Trigger new reconciliation with overridden type
                    setTimeout(() => {
                        // This would trigger a new reconciliation attempt
                        // Implementation depends on how the reconciliation system is structured
                    }, 100);
                } else {
                    // For other types, show appropriate custom input
                    primaryRecommendations.innerHTML = `<p>Type changed to ${getUserFriendlyTypeName(newType)} - use manual input section below.</p>`;
                    showCustomInputInterface(newType, value);
                }
            }
        },

        // Legacy function for backward compatibility
        confirmReconciliation() {
            console.warn('confirmReconciliation() is deprecated - use selectMatchAndAdvance() or confirmCustomValue() instead');
            
            if (currentReconciliationCell.current) {
                // Try to find selected match first
                const selectedMatch = document.querySelector('.match-item.selected');
                if (selectedMatch) {
                    const matchId = selectedMatch.dataset.matchId;
                    this.selectMatchAndAdvance(matchId);
                    return;
                }
                
                // Fall back to custom value confirmation
                this.confirmCustomValue();
            }
        }
    };
}

// Export the current reconciliation cell for other modules to access
export function getCurrentReconciliationCell() {
    return window.currentReconciliationCell || null;
}