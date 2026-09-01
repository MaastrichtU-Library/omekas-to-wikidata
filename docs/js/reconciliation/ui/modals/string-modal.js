/**
 * Enhanced String Reconciliation Modal
 * @module reconciliation/ui/modals/string-modal
 * 
 * Comprehensive modal interface for both regular strings and monolingual text values.
 * Supports advanced validation, language selection, and user-friendly editing.
 * 
 * Features:
 * - Dual support for 'string' and 'monolingualtext' data types
 * - Original value tracking with clickable reset functionality
 * - Wikidata language search and selection for monolingual text
 * - Visual validation feedback with green/red borders
 * - Regex pattern display with Wikidata property links
 * - Persistent language preference storage
 * - User override capability for validation failures
 */

import { 
    extractRegexConstraints, 
    validateStringValue, 
    validateRealTime, 
    getSuggestedFixes,
    createValidationUI,
    setupLiveValidation,
    searchWikidataLanguages,
    getStoredLanguage,
    setStoredLanguage,
    generatePropertyLink
} from '../validation-engine.js';

/**
 * Get confirmed value from application state
 * @param {string} itemId - Item ID
 * @param {string} mappingId - Mapping ID
 * @param {number} valueIndex - Value index
 * @returns {Object|null} Confirmed value data or null
 */
function getConfirmedValue(itemId, mappingId, valueIndex) {
    try {
        // Try multiple ways to access the state system
        const stateManager = window.debugState || window.currentState;
        if (!stateManager) {
            console.warn('No state system available');
            return null;
        }

        const state = stateManager.getState();
        const reconciliationData = state.reconciliationData || {};

        const itemData = reconciliationData[itemId];
        if (!itemData || !itemData.properties || !itemData.properties[mappingId]) {
            return null;
        }

        const propertyData = itemData.properties[mappingId];
        if (!propertyData.reconciled || !propertyData.reconciled[valueIndex]) {
            return null;
        }

        const reconciledData = propertyData.reconciled[valueIndex];

        // Only return data if it's a confirmed custom value
        if (reconciledData.status === 'reconciled' &&
            reconciledData.selectedMatch &&
            reconciledData.selectedMatch.type === 'custom') {
            return reconciledData.selectedMatch;
        }

        return null;
    } catch (error) {
        console.warn('Failed to retrieve confirmed value from state:', error);
        return null;
    }
}

/**
 * Save confirmed value to application state
 * @param {string} itemId - Item ID
 * @param {string} mappingId - Mapping ID
 * @param {number} valueIndex - Value index
 * @param {Object} confirmationData - Data to save
 */
function saveConfirmedValue(itemId, mappingId, valueIndex, confirmationData) {
    try {
        // Try multiple ways to access the state system
        const stateManager = window.debugState || window.currentState;
        if (!stateManager) {
            console.warn('No state system available');
            return false;
        }

        const state = stateManager.getState();
        const reconciliationData = { ...state.reconciliationData } || {};

        // Ensure the structure exists
        if (!reconciliationData[itemId]) {
            reconciliationData[itemId] = { properties: {} };
        }
        if (!reconciliationData[itemId].properties[mappingId]) {
            reconciliationData[itemId].properties[mappingId] = { reconciled: [] };
        }
        if (!reconciliationData[itemId].properties[mappingId].reconciled[valueIndex]) {
            reconciliationData[itemId].properties[mappingId].reconciled[valueIndex] = {};
        }

        // Save the confirmed value with proper structure
        reconciliationData[itemId].properties[mappingId].reconciled[valueIndex] = {
            status: 'reconciled',
            selectedMatch: {
                type: 'custom',
                value: confirmationData.value,
                label: confirmationData.value,
                language: confirmationData.language || null,
                languageLabel: confirmationData.languageLabel || null,
                datatype: confirmationData.datatype || 'string',
                description: 'Custom user value'
            },
            matches: [],
            confidence: 100
        };

        // Update the state
        stateManager.updateState('reconciliationData', reconciliationData);

        return true;
    } catch (error) {
        console.warn('Failed to save confirmed value to state:', error);
        return false;
    }
}

/**
 * Find the source table cell that corresponds to this modal's data
 * @param {string} itemId - Item ID
 * @param {string} mappingId - Mapping ID
 * @param {number} valueIndex - Value index
 * @returns {HTMLElement|null} The source table cell element or null
 */
function findSourceTableCell(itemId, mappingId, valueIndex) {
    try {
        // Look for manual property cells (no value index)
        const manualSelector = `.property-cell[data-item-id="${itemId}"][data-mapping-id="${mappingId}"][data-is-manual="true"]`;
        const manualCell = document.querySelector(manualSelector);
        if (manualCell) {
            return manualCell;
        }

        // Look for regular property cells with value index
        const regularSelector = `.property-cell[data-item-id="${itemId}"][data-mapping-id="${mappingId}"][data-value-index="${valueIndex}"]`;
        const regularCell = document.querySelector(regularSelector);
        if (regularCell) {
            return regularCell;
        }

        // Fallback: look for any cell with matching item and mapping
        const fallbackSelector = `.property-cell[data-item-id="${itemId}"][data-mapping-id="${mappingId}"]`;
        const fallbackCell = document.querySelector(fallbackSelector);
        return fallbackCell;
    } catch (error) {
        console.warn('Failed to find source table cell:', error, { itemId, mappingId, valueIndex });
        return null;
    }
}


/**
 * Update the source table cell to reflect the confirmed value
 * @param {HTMLElement} sourceCell - The source table cell element
 * @param {Object} confirmationData - The confirmed value data
 */
function updateSourceTableCell(sourceCell, confirmationData) {
    if (!sourceCell) {
        console.warn('No source cell found to update');
        return;
    }
    
    try {
        // Find the elements within the cell that need updating
        const valueTextSpan = sourceCell.querySelector('.value-text');
        const valueStatusSpan = sourceCell.querySelector('.value-status');
        const propertyValueDiv = sourceCell.querySelector('.property-value');
        
        if (!valueTextSpan) {
            console.warn('Could not find .value-text span in source cell');
            return;
        }
        
        // Prepare the display text
        let displayText = confirmationData.value;
        if (confirmationData.language) {
            displayText += ` (${confirmationData.languageLabel || confirmationData.language})`;
        }
        
        // Update the value text
        valueTextSpan.textContent = displayText;
        
        // Update the status text and styling
        if (valueStatusSpan) {
            valueStatusSpan.textContent = '✓ Custom value';
            valueStatusSpan.classList.add('reconciled');
        }
        
        // Update the property value container
        if (propertyValueDiv) {
            propertyValueDiv.setAttribute('data-status', 'reconciled');
            propertyValueDiv.classList.add('reconciled');
            propertyValueDiv.classList.remove('pending');
        }
        
        // Remove any pending or error styling from the cell
        sourceCell.classList.remove('pending', 'error');
        sourceCell.classList.add('reconciled');
        
        
    } catch (error) {
        console.error('Failed to update source table cell:', error);
    }
}


/**
 * Create enhanced String/Monolingual reconciliation modal content
 * @param {string} itemId - Item ID being reconciled
 * @param {string} property - Property name being reconciled
 * @param {number} valueIndex - Index of value within property
 * @param {string} value - The value to reconcile
 * @param {Object} propertyData - Property metadata and constraints
 * @param {Array} existingMatches - Not used for string values
 * @param {string} mappingId - The mapping ID for this property
 * @returns {HTMLElement} Modal content element
 */
export function createStringModal(itemId, property, valueIndex, value, propertyData = null, existingMatches = null, mappingId = null) {
    const dataType = propertyData?.datatype || 'string';
    const isMonolingual = dataType === 'monolingualtext';

    // Use provided mappingId or fall back to property
    const effectiveMappingId = mappingId || property;

    // Check for previously confirmed value
    const confirmedData = getConfirmedValue(itemId, effectiveMappingId, valueIndex);
    const displayValue = confirmedData ? confirmedData.value : value;
    const hasConfirmedValue = confirmedData !== null;

    const regexConstraints = extractRegexConstraints(property, propertyData);
    const validationResult = validateStringValue(displayValue, regexConstraints);
    const propertyLink = generatePropertyLink(property, propertyData);

    const modalContent = document.createElement('div');
    modalContent.className = isMonolingual ? 'monolingual-modal' : 'string-modal';

    // Store context for modal interactions
    modalContent.dataset.modalType = dataType;
    modalContent.dataset.itemId = itemId;
    modalContent.dataset.property = property;
    modalContent.dataset.mappingId = effectiveMappingId;
    modalContent.dataset.valueIndex = valueIndex;
    modalContent.dataset.originalValue = value; // Always keep the original Omeka value
    modalContent.dataset.currentValue = displayValue; // Use saved value if available
    modalContent.dataset.isMonolingual = isMonolingual.toString();
    modalContent.dataset.hasConfirmedValue = hasConfirmedValue.toString();
    if (propertyData) {
        modalContent.dataset.propertyData = JSON.stringify(propertyData);
    }
    if (confirmedData) {
        modalContent.dataset.confirmedData = JSON.stringify(confirmedData);
    }
    
    modalContent.innerHTML = `
        <div class="data-type-indicator">
            <span class="data-type-label">Expecting:</span>
            <span class="data-type-value">${isMonolingual ? 'Monolingual Text' : 'Text String'}</span>
        </div>

        <div class="value-display">
            <div class="section-title">Omeka S Value</div>
            <div class="original-value" id="omeka-original-value">${escapeHtml(value)}</div>
            <div class="saved-value-indicator ${hasConfirmedValue ? '' : 'hidden'}" id="saved-value-indicator">
                <div class="section-title">Previously Confirmed Value</div>
                <div class="saved-value" id="saved-value-display">${escapeHtml(displayValue)}</div>
            </div>
        </div>

        <div class="string-section">
            <!-- String Editor -->
            <div class="string-editor">
                <div class="section-title">Edit Value</div>
                <div class="input-container">
                    <textarea id="string-editor" 
                             class="string-input ${validationResult?.isValid === false ? 'validation-error' : (validationResult?.isValid === true ? 'validation-success' : '')}" 
                             placeholder="${isMonolingual ? 'Enter text in selected language...' : 'Edit the string value...'}">${escapeHtml(displayValue)}</textarea>
                    
                    <!-- Original Value Display (hidden initially) -->
                    <div class="original-value-hint hidden" id="original-value-hint">
                        <span class="original-label">${hasConfirmedValue ? 'Reset to confirmed:' : 'Original:'}</span>
                        <span class="original-text clickable" onclick="resetToOriginalValue()">${escapeHtml(displayValue)}</span>
                    </div>
                    
                    <!-- Validation Pattern Display -->
                    ${regexConstraints ? `
                        <div class="validation-pattern">
                            <span class="pattern-text">Must match pattern: </span>
                            <code class="pattern-code">${escapeHtml(regexConstraints.pattern)}</code>
                            ${propertyLink ? `<a href="${propertyLink}" target="_blank" class="property-link">ⓘ</a>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Language Selection (monolingual only) -->
            ${isMonolingual ? `
                <div class="language-selection">
                    <div class="section-title">Language <span class="required">*</span></div>
                    <div class="language-help-text">
                        Select the language for this text value. If no language is specified, the text will be treated as the default for all languages.
                    </div>
                    <div class="language-container">
                        <input type="text" 
                               id="language-search" 
                               class="language-input" 
                               placeholder="Type to search languages (e.g., English, German, fr)..." 
                               autocomplete="off">
                        <div class="language-search-status hidden" id="language-search-status"></div>
                        <div class="language-dropdown hidden" id="language-dropdown"></div>
                        <input type="hidden" id="selected-language-code" value="">
                    </div>
                </div>
            ` : ''}
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="cancelStringModal()">Cancel</button>
            <button class="btn btn-outline" onclick="resetStringModal()">Reset</button>
            <button class="btn btn-outline" onclick="skipReconciliation()">Skip</button>
            <button class="btn btn-primary" id="confirm-btn" onclick="confirmStringValue()">Confirm</button>
        </div>
    `;

    return modalContent;
}

/**
 * Initialize enhanced String/Monolingual modal after DOM insertion
 * @param {HTMLElement} modalElement - The modal element
 */
export function initializeStringModal(modalElement) {
    console.log('🔧 initializeStringModal called with:', modalElement);

    const originalValue = modalElement.dataset.originalValue;
    const currentValue = modalElement.dataset.currentValue;
    const property = modalElement.dataset.property;
    const isMonolingual = modalElement.dataset.isMonolingual === 'true';
    const hasConfirmedValue = modalElement.dataset.hasConfirmedValue === 'true';
    const propertyData = modalElement.dataset.propertyData ?
        JSON.parse(modalElement.dataset.propertyData) : null;
    const confirmedData = modalElement.dataset.confirmedData ?
        JSON.parse(modalElement.dataset.confirmedData) : null;

    const mappingId = window.currentModalContext?.mappingId || modalElement.dataset.mappingId || property;

    console.log('🔧 Modal initialization data:', {
        originalValue, currentValue, property, isMonolingual,
        hasConfirmedValue, propertyData, confirmedData, mappingId
    });

    // Find the source table cell that opened this modal
    const sourceCell = findSourceTableCell(modalElement.dataset.itemId, mappingId, parseInt(modalElement.dataset.valueIndex));

    // Store modal context globally for interaction handlers
    window.currentModalContext = {
        itemId: modalElement.dataset.itemId,
        property: property,
        mappingId: mappingId, // NEW: Add mappingId to context
        valueIndex: parseInt(modalElement.dataset.valueIndex),
        originalValue: originalValue,
        currentValue: currentValue,
        propertyData: propertyData,
        dataType: modalElement.dataset.modalType,
        modalType: modalElement.dataset.modalType,
        isMonolingual: isMonolingual,
        hasBeenEdited: hasConfirmedValue, // If we have a confirmed value, consider it edited
        hasConfirmedValue: hasConfirmedValue,
        confirmedData: confirmedData,
        selectedLanguage: null,
        sourceCell: sourceCell // Reference to the original table cell
    };
    
    // Set up string editor with enhanced functionality
    const stringEditor = document.getElementById('string-editor');
    console.log('🔧 String editor found:', stringEditor);
    if (stringEditor) {
        setupStringEditor(stringEditor, property, propertyData);
    }
    
    // Set up language selection for monolingual text
    console.log('🔧 Checking if monolingual:', isMonolingual);
    if (isMonolingual) {
        console.log('🌐 Setting up language selection for monolingual text');
        setupLanguageSelection();
        
        // Restore confirmed language if available
        if (confirmedData && confirmedData.language) {
            console.log('🌐 Restoring confirmed language:', confirmedData.language);
            window.currentModalContext.selectedLanguage = {
                code: confirmedData.language,
                label: confirmedData.languageLabel || confirmedData.language
            };
        }
    }
    
    // Initial validation and UI state
    console.log('🔧 Updating validation state');
    updateValidationState();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Set up string editor with enhanced functionality
 * @param {HTMLElement} editor - The text editor element
 * @param {string} property - Property name
 * @param {Object} propertyData - Property metadata
 */
function setupStringEditor(editor, property, propertyData) {
    let isFirstEdit = true;
    
    // Set up input event for original value display and validation
    editor.addEventListener('input', function() {
        const currentValue = editor.value;
        
        // Show original value hint on first edit
        if (isFirstEdit && currentValue !== window.currentModalContext.originalValue) {
            showOriginalValueHint();
            window.currentModalContext.hasBeenEdited = true;
            isFirstEdit = false;
        }
        
        // Update current value in context
        window.currentModalContext.currentValue = currentValue;
        
        // Update validation
        updateValidationState();
    });
    
    // Set up blur event for final validation
    editor.addEventListener('blur', function() {
        updateValidationState();
    });
}

/**
 * Set up language selection functionality for monolingual text
 */
function setupLanguageSelection() {
    console.log('🌐 setupLanguageSelection called');
    
    const languageSearch = document.getElementById('language-search');
    const languageDropdown = document.getElementById('language-dropdown');
    const languageStatus = document.getElementById('language-search-status');
    const selectedLanguageCode = document.getElementById('selected-language-code');
    
    console.log('🌐 Language DOM elements found:', {
        languageSearch: !!languageSearch,
        languageDropdown: !!languageDropdown,
        languageStatus: !!languageStatus,
        selectedLanguageCode: !!selectedLanguageCode
    });
    
    if (!languageSearch || !languageDropdown) {
        console.error('🌐 Missing required language DOM elements!');
        return;
    }
    
    // Set default language from storage or confirmed data
    const storedLanguage = getStoredLanguage();
    const confirmedLanguage = window.currentModalContext.selectedLanguage;
    const defaultLanguage = confirmedLanguage || storedLanguage;
    
    if (defaultLanguage) {
        languageSearch.value = defaultLanguage.label;
        selectedLanguageCode.value = defaultLanguage.code;
        window.currentModalContext.selectedLanguage = defaultLanguage;
        updateConfirmButtonState();
    }
    
    let searchTimeout;
    let currentSearchQuery = '';
    
    console.log('🌐 Attaching ALL event listeners to language search input');
    
    // Add comprehensive keystroke logging
    languageSearch.addEventListener('keydown', function(event) {
        console.log('⌨️ KEYDOWN event fired! Key:', event.key, 'Code:', event.code, 'Value:', this.value);
    });
    
    languageSearch.addEventListener('keyup', function(event) {
        console.log('⌨️ KEYUP event fired! Key:', event.key, 'Code:', event.code, 'Value:', this.value);
    });
    
    languageSearch.addEventListener('keypress', function(event) {
        console.log('⌨️ KEYPRESS event fired! Key:', event.key, 'Code:', event.code, 'Value:', this.value);
    });
    
    languageSearch.addEventListener('change', function(event) {
        console.log('⌨️ CHANGE event fired! Value:', this.value, 'Event:', event);
    });
    
    languageSearch.addEventListener('focus', function(event) {
        console.log('⌨️ FOCUS event fired! Value:', this.value, 'Event:', event);
    });
    
    languageSearch.addEventListener('blur', function(event) {
        console.log('⌨️ BLUR event fired! Value:', this.value, 'Event:', event);
    });
    
    // Search languages as user types
    languageSearch.addEventListener('input', function(event) {
        console.log('🌐 Language input event fired! Value:', this.value, 'Event:', event);
        
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        currentSearchQuery = query;
        
        console.log('🌐 Processing language search query:', query);
        
        // Clear selection if user is typing something different
        if (window.currentModalContext.selectedLanguage && 
            query !== window.currentModalContext.selectedLanguage.label) {
            selectedLanguageCode.value = '';
            window.currentModalContext.selectedLanguage = null;
            updateConfirmButtonState();
        }
        
        if (query.length < 1) {
            console.log('🌐 Query too short, hiding dropdown');
            hideLanguageDropdown();
            return;
        }
        
        // Show loading state for queries longer than 1 character
        if (query.length >= 2) {
            console.log('🌐 Showing loading status for query:', query);
            showLanguageSearchStatus('Searching languages...', 'loading');
        }
        
        searchTimeout = setTimeout(async () => {
            console.log('🌐 Executing language search for:', query);
            
            // Only search if this is still the current query
            if (currentSearchQuery !== query) {
                console.log('🌐 Query changed, skipping search');
                return;
            }
            
            try {
                console.log('🌐 Calling searchWikidataLanguages with:', query);
                const languages = await searchWikidataLanguages(query);
                console.log('🌐 Language search returned:', languages);
                
                // Verify this is still the current search
                if (currentSearchQuery === query) {
                    displayLanguageResults(languages, query);
                }
            } catch (error) {
                console.error('🌐 Language search failed:', error);
                if (currentSearchQuery === query) {
                    showLanguageSearchStatus('Search failed. Try typing a different language name.', 'error');
                    displayLanguageResults([], query);
                }
            }
        }, query.length >= 3 ? 300 : 500); // Longer delay for short queries
    });
    
    // Handle focus to show recent results if available
    languageSearch.addEventListener('focus', function() {
        if (this.value.trim().length >= 2 && languageDropdown.innerHTML.trim()) {
            languageDropdown.classList.remove('hidden');
        }
    });
    
    // Handle language option clicks using event delegation
    languageDropdown.addEventListener('click', function(event) {
        const languageOption = event.target.closest('.language-option');
        if (languageOption) {
            console.log('🌐 Language option clicked:', languageOption);
            
            // Extract language data from data attributes
            const languageData = {
                id: languageOption.dataset.languageId || null,
                code: languageOption.dataset.languageCode,
                label: languageOption.dataset.languageLabel,
                description: languageOption.dataset.languageDescription || null,
                iso639_1: languageOption.dataset.languageIso6391 || null,
                iso639_3: languageOption.dataset.languageIso6393 || null,
                wikimediaCode: languageOption.dataset.languageWikimediaCode || null,
                source: languageOption.dataset.languageSource || 'unknown'
            };
            
            console.log('🌐 Extracted language data:', languageData);
            selectLanguageData(languageData);
        }
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.language-container')) {
            hideLanguageDropdown();
        }
    });
}

/**
 * Show language search status message
 * @param {string} message - Status message
 * @param {string} type - Status type (loading, error, info)
 */
function showLanguageSearchStatus(message, type = 'info') {
    const statusElement = document.getElementById('language-search-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `language-search-status ${type}`;
        statusElement.classList.remove('hidden');
        
        // Auto-hide after 3 seconds for non-loading messages
        if (type !== 'loading') {
            setTimeout(() => {
                statusElement.classList.add('hidden');
            }, 3000);
        }
    }
}

/**
 * Hide language search status
 */
function hideLanguageSearchStatus() {
    const statusElement = document.getElementById('language-search-status');
    if (statusElement) {
        statusElement.classList.add('hidden');
    }
}

/**
 * Hide language dropdown and status
 */
function hideLanguageDropdown() {
    const languageDropdown = document.getElementById('language-dropdown');
    if (languageDropdown) {
        languageDropdown.classList.add('hidden');
    }
    hideLanguageSearchStatus();
}

/**
 * Display language search results with enhanced data
 * @param {Array} languages - Array of language objects
 * @param {string} query - Original search query
 */
function displayLanguageResults(languages, query = '') {
    const languageDropdown = document.getElementById('language-dropdown');
    
    hideLanguageSearchStatus(); // Hide loading status
    
    if (languages.length === 0) {
        if (query.length >= 2) {
            languageDropdown.innerHTML = `
                <div class="no-results">
                    <div class="no-results-message">No languages found for "${escapeHtml(query)}"</div>
                    <div class="no-results-hint">Try typing a different language name or code (e.g., "en", "English", "German")</div>
                </div>
            `;
        } else {
            languageDropdown.innerHTML = `
                <div class="search-hint">
                    <div class="search-hint-message">Start typing to search languages</div>
                </div>
            `;
        }
    } else {
        languageDropdown.innerHTML = languages.map(lang => {
            // Build display elements
            let codesDisplay = '';
            const codes = [];
            if (lang.iso639_1) codes.push(lang.iso639_1);
            if (lang.iso639_3 && lang.iso639_3 !== lang.iso639_1) codes.push(lang.iso639_3);
            if (codes.length > 0) {
                codesDisplay = `<span class="language-codes">[${codes.join(', ')}]</span>`;
            }
            
            const sourceIndicator = lang.source === 'wikidata' ? 
                '<span class="language-source-indicator" title="From Wikidata">🌐</span>' : '';
            
            const description = lang.description ? 
                `<div class="language-description">${escapeHtml(lang.description)}</div>` : '';
            
            return `
                <div class="language-option enhanced" 
                     data-language-id="${escapeHtml(lang.id || '')}"
                     data-language-code="${escapeHtml(lang.code)}"
                     data-language-label="${escapeHtml(lang.label)}"
                     data-language-description="${escapeHtml(lang.description || '')}"
                     data-language-iso639-1="${escapeHtml(lang.iso639_1 || '')}"
                     data-language-iso639-3="${escapeHtml(lang.iso639_3 || '')}"
                     data-language-wikimedia-code="${escapeHtml(lang.wikimediaCode || '')}"
                     data-language-source="${escapeHtml(lang.source || 'unknown')}">
                    <div class="language-option-content">
                        <div class="language-main-info">
                            <span class="language-label">${escapeHtml(lang.label)}</span>
                            ${codesDisplay}
                            ${sourceIndicator}
                        </div>
                        ${description}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    languageDropdown.classList.remove('hidden');
}


/**
 * Internal function to handle language selection with enhanced data
 * @param {Object} languageData - Language data object
 */
function selectLanguageData(languageData) {
    const languageSearch = document.getElementById('language-search');
    const selectedLanguageCode = document.getElementById('selected-language-code');
    
    if (!languageSearch || !selectedLanguageCode) {
        console.error('Language selection elements not found');
        return;
    }
    
    // Use the best available code (prefer ISO 639-1, fallback to others)
    const displayCode = languageData.iso639_1 || languageData.code;
    const storageCode = languageData.code; // Store the actual code used by the system
    
    // Update form fields
    languageSearch.value = languageData.label;
    selectedLanguageCode.value = storageCode;
    
    // Create enhanced language object for storage
    const selectedLanguage = {
        id: languageData.id,
        code: storageCode,
        label: languageData.label,
        description: languageData.description,
        iso639_1: languageData.iso639_1,
        iso639_3: languageData.iso639_3,
        wikimediaCode: languageData.wikimediaCode,
        source: languageData.source
    };
    
    // Update modal context
    window.currentModalContext.selectedLanguage = selectedLanguage;
    
    // Store language preference for future use (simplified version)
    setStoredLanguage({
        code: storageCode,
        label: languageData.label
    });
    
    // Hide dropdown and show success feedback
    hideLanguageDropdown();
    
    // Enhanced feedback message
    let feedbackMessage = `Selected: ${languageData.label}`;
    if (displayCode !== languageData.label.toLowerCase()) {
        feedbackMessage += ` [${displayCode}]`;
    }
    if (languageData.source === 'wikidata' && languageData.id) {
        feedbackMessage += ` (${languageData.id})`;
    }
    
    showLanguageSearchStatus(feedbackMessage, 'info');
    
    // Update confirmation button state
    updateConfirmButtonState();
    
    // Visual feedback
    languageSearch.style.backgroundColor = '#f0f8ff';
    setTimeout(() => {
        languageSearch.style.backgroundColor = '';
    }, 1000);
}

/**
 * Show the original value hint below the input
 */
function showOriginalValueHint() {
    const originalValueHint = document.getElementById('original-value-hint');
    if (originalValueHint) {
        originalValueHint.classList.remove('hidden');
    }
}

/**
 * Update validation state and visual feedback
 */
function updateValidationState() {
    const editor = document.getElementById('string-editor');
    const currentValue = window.currentModalContext?.currentValue || '';
    const property = window.currentModalContext?.property;
    const propertyData = window.currentModalContext?.propertyData;
    
    if (!editor || !property) return;
    
    // Get validation result
    const constraints = extractRegexConstraints(property, propertyData);
    const validationResult = validateStringValue(currentValue, constraints);
    
    // Update input styling
    editor.className = editor.className.replace(/validation-(success|error)/g, '');
    if (validationResult) {
        if (validationResult.isValid) {
            editor.classList.add('validation-success');
        } else {
            editor.classList.add('validation-error');
        }
    }
    
    // Update confirm button state
    updateConfirmButtonState();
}

/**
 * Update the value displays to show the newly confirmed value
 * @param {Object} confirmationData - The confirmed value data
 */
function updateValueDisplays(confirmationData) {
    // Update the saved value indicator
    const savedValueIndicator = document.getElementById('saved-value-indicator');
    const savedValueDisplay = document.getElementById('saved-value-display');
    
    if (savedValueIndicator && savedValueDisplay) {
        // Show the saved value indicator if it was hidden
        savedValueIndicator.classList.remove('hidden');
        
        // Update the saved value text
        let displayText = confirmationData.value;
        if (confirmationData.language) {
            displayText += ` (${confirmationData.languageLabel || confirmationData.language})`;
        }
        
        savedValueDisplay.textContent = displayText;
        
        // Update the modal context to reflect the new confirmed state
        if (window.currentModalContext) {
            window.currentModalContext.hasConfirmedValue = true;
            window.currentModalContext.confirmedData = confirmationData;
            window.currentModalContext.hasBeenEdited = true;
        }
        
    }
}

/**
 * Update confirm button enabled/disabled state
 */
function updateConfirmButtonState() {
    const confirmBtn = document.getElementById('confirm-btn');
    const currentValue = window.currentModalContext?.currentValue || '';
    const isMonolingual = window.currentModalContext?.isMonolingual;
    const selectedLanguage = window.currentModalContext?.selectedLanguage;
    
    if (!confirmBtn) return;
    
    let canConfirm = true;
    
    // Check if value is not empty
    if (!currentValue.trim()) {
        canConfirm = false;
    }
    
    // For monolingual text, require language selection
    if (isMonolingual && !selectedLanguage) {
        canConfirm = false;
    }
    
    // Note: Allow confirmation even with regex validation failures (user override)
    confirmBtn.disabled = !canConfirm;
}

// Global interaction handlers for enhanced String modal
window.resetToOriginalValue = function() {
    const editor = document.getElementById('string-editor');
    const originalValueHint = document.getElementById('original-value-hint');
    
    if (!editor || !window.currentModalContext) return;
    
    // Reset to original value
    editor.value = window.currentModalContext.originalValue;
    window.currentModalContext.currentValue = window.currentModalContext.originalValue;
    window.currentModalContext.hasBeenEdited = false;
    
    // Hide original value hint
    if (originalValueHint) {
        originalValueHint.classList.add('hidden');
    }
    
    // Update validation
    updateValidationState();
};

window.cancelStringModal = function() {
    if (typeof window.closeReconciliationModal === 'function') {
        window.closeReconciliationModal();
    }
};

window.resetStringModal = function() {
    window.resetToOriginalValue();
};

window.confirmStringValue = function() {
    if (!window.currentModalContext) {
        console.error('No modal context available for string confirmation');
        return;
    }
    
    // Get the actual current value from the input field (most reliable)
    const stringEditor = document.getElementById('string-editor');
    const currentValue = stringEditor ? stringEditor.value : (window.currentModalContext.currentValue || window.currentModalContext.originalValue);
    
    // Update context with the actual current value
    if (stringEditor) {
        window.currentModalContext.currentValue = stringEditor.value;
    }
    
    const isMonolingual = window.currentModalContext.isMonolingual;
    
    // Get the actual selected language from DOM elements (most reliable)
    let selectedLanguage = window.currentModalContext.selectedLanguage;
    if (isMonolingual) {
        const languageSearch = document.getElementById('language-search');
        const selectedLanguageCode = document.getElementById('selected-language-code');
        
        if (languageSearch && selectedLanguageCode && selectedLanguageCode.value) {
            selectedLanguage = {
                code: selectedLanguageCode.value,
                label: languageSearch.value
            };
            // Update context with actual values
            window.currentModalContext.selectedLanguage = selectedLanguage;
        }
    }
    
    // Validate required fields
    if (!currentValue.trim()) {
        alert('Please enter a value before confirming.');
        return;
    }
    
    if (isMonolingual && !selectedLanguage) {
        alert('Please select a language for monolingual text.');
        return;
    }
    
    // Prepare confirmation data
    let confirmationData = {
        type: 'custom',
        value: currentValue.trim(),
        datatype: window.currentModalContext.dataType
    };
    
    // Add language for monolingual text
    if (isMonolingual && selectedLanguage) {
        confirmationData.language = selectedLanguage.code;
        confirmationData.languageLabel = selectedLanguage.label;
    }
    
    
    // Store confirmation data in context for handlers
    window.currentModalContext.confirmationData = confirmationData;
    
    // Save to application state system first
    const savedToState = saveConfirmedValue(
        window.currentModalContext.itemId,
        window.currentModalContext.mappingId,
        window.currentModalContext.valueIndex,
        confirmationData
    );
    
    // Try multiple approaches to save the value
    let saved = savedToState; // Start with state save result
    
    // First, try the proper modal interaction handler
    if (typeof window.confirmCustomValue === 'function') {
        window.confirmCustomValue();
        saved = true;
    } 
    // Try the factory-based interaction handlers
    else if (window.modalInteractionHandlers && typeof window.modalInteractionHandlers.confirmCustomValue === 'function') {
        window.modalInteractionHandlers.confirmCustomValue();
        saved = true;
    }
    // Try direct reconciliation marking
    else if (typeof window.markCellAsReconciled === 'function') {
        window.markCellAsReconciled(window.currentModalContext, confirmationData);
        saved = true;
        if (typeof window.closeReconciliationModal === 'function') {
            window.closeReconciliationModal();
        }
    }
    // Fallback: dispatch a custom event that other parts of the system can listen to
    else {
        const event = new CustomEvent('stringValueConfirmed', {
            detail: {
                context: window.currentModalContext,
                confirmationData: confirmationData
            }
        });
        document.dispatchEvent(event);
        saved = true;
        
        // Close modal if possible
        if (typeof window.closeReconciliationModal === 'function') {
            window.closeReconciliationModal();
        }
    }
    
    if (saved) {
        // Update the displayed values immediately
        updateValueDisplays(confirmationData);
        
        // Update the source table cell if available
        if (window.currentModalContext && window.currentModalContext.sourceCell) {
            updateSourceTableCell(window.currentModalContext.sourceCell, confirmationData);
        }
        
        // Show success feedback
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            const originalText = confirmBtn.textContent;
            confirmBtn.textContent = 'Saved!';
            confirmBtn.style.background = '#28a745';
            setTimeout(() => {
                confirmBtn.textContent = originalText;
                confirmBtn.style.background = '';
            }, 1000);
        }
    } else {
        console.warn('No save handler found - value may not be persisted');
    }
};

