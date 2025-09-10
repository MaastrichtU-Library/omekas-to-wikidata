/**
 * Reconciliation Modal Interface Module
 * @module reconciliation/ui/reconciliation-modal
 * 
 * Handles modal creation, user interactions, and reconciliation UI including
 * automatic match display, manual search, and custom input interfaces.
 */

import { detectPropertyType, getInputFieldConfig, createInputHTML, setupDynamicDatePrecision } from '../../utils/property-types.js';
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
        setupAutoAdvanceToggle
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
        getReconciliationRequirementReason
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

// Export the current reconciliation cell for other modules to access
export function getCurrentReconciliationCell() {
    return window.currentReconciliationCell || null;
}