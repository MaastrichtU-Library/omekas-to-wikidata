/**
 * Handles the Export step functionality - QuickStatements generation and validation
 * 
 * This module generates the final QuickStatements format for importing data into Wikidata.
 * QuickStatements is Wikidata's batch import tool that requires precise formatting:
 * - Tab-separated values with specific column meanings
 * - Proper escaping of special characters and strings
 * - Validation against Wikidata property and entity ID patterns
 * - Date formatting with precision indicators
 * - Reference sourcing and statement qualifiers
 * 
 * The export process is the culmination of the entire workflow - it transforms:
 * - Raw Omeka S metadata (step 1)
 * - Property mappings (step 2)
 * - Entity reconciliation (step 3)
 * 
 * Into properly formatted QuickStatements that can be imported directly into Wikidata
 * without manual intervention or formatting corrections.
 * 
 * Critical Requirements:
 * - All property IDs must be valid Wikidata format (P123, S456)
 * - All entity references must be valid Q-numbers or reconciled entities
 * - String values must be properly escaped for QuickStatements parser
 * - Date values must include appropriate precision indicators
 * - References must follow Wikidata sourcing requirements
 * 
 * @module export
 */
import { createDownloadLink, createFileInput, createElement, createButton, showMessage } from '../ui/components.js';
import { eventSystem } from '../events.js';

// Validation constants for Wikidata format compliance
// These patterns ensure generated QuickStatements meet Wikidata requirements

/**
 * Validates Wikidata property and statement IDs
 * - P\d+: Property IDs (e.g., P31 for "instance of", P569 for "date of birth")
 * - S\d+: Statement IDs used for references and qualifiers
 * @see https://www.wikidata.org/wiki/Wikidata:Glossary
 */
const PROPERTY_ID_REGEX = /^[PS]\d+$/;

/**
 * Validates language-specific property formats for multilingual content
 * - L + language code: Labels (e.g., "Len" for English label)
 * - D + language code: Descriptions (e.g., "Dde" for German description)
 * - A + language code: Aliases (e.g., "Afr" for French aliases)
 * Supports standard language codes with optional regional variants
 * @see https://www.wikidata.org/wiki/Help:Multilingual
 */
const LANGUAGE_PROPERTY_REGEX = /^[LDA][a-z]{2,3}(-[a-z]+)?$/;

/**
 * Initializes the export step interface with QuickStatements generation capabilities
 * 
 * This function sets up the final step where all processed data is transformed into
 * QuickStatements format for Wikidata import. It handles the complex task of:
 * - Aggregating data from all previous workflow steps
 * - Applying final validation and format checking
 * - Generating syntactically correct QuickStatements
 * - Providing multiple export options (copy, download, direct import)
 * 
 * The export step requires complete data from the entire workflow:
 * - Validated Omeka S data with proper structure
 * - Complete property mappings to Wikidata properties
 * - Reconciled entities with confidence scores
 * 
 * @param {Object} state - Application state management instance
 * @param {Function} state.getState - Retrieves complete application state
 * @param {Object} state.reconciliationData - Entity reconciliation results
 * @param {Array} state.mappedProperties - Property mappings from mapping step
 * @param {Object} state.designerConfig - Final structure configuration
 * 
 * @description
 * Export workflow:
 * 1. Validates completeness of all previous steps
 * 2. Aggregates reconciled entities and mapped properties
 * 3. Applies final formatting and validation rules
 * 4. Generates QuickStatements with proper escaping and formatting
 * 5. Provides export interface with copy/download/direct import options
 * 6. Validates generated statements against Wikidata requirements
 */
export function setupExportStep(state) {
    const quickStatementsTextarea = document.getElementById('quick-statements');
    const copyQuickStatementsBtn = document.getElementById('copy-quick-statements');
    // JSON export/import removed for MVP
    // const downloadJsonBtn = document.getElementById('download-json');
    // const importJsonBtn = document.getElementById('import-json');
    
    // Initialize export when entering this step
    document.addEventListener('DOMContentLoaded', () => {
        // Check if we're already on step 5 (e.g., from restored state)
        const currentState = state.getState();
        if (currentState.currentStep === 5) {
            initializeExport();
        }
        
        // Listen for step changes
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                if (parseInt(step.dataset.step) === 5) {
                    initializeExport();
                }
            });
        });
        
        // Also listen for the navigation button
        document.getElementById('proceed-to-export')?.addEventListener('click', () => {
            initializeExport();
        });
    });
    
    // Listen for step change events
    eventSystem.subscribe(eventSystem.Events.STEP_CHANGED, (data) => {
        if (data.newStep === 5) {
            initializeExport();
        }
    });
    
    // Copy QuickStatements button
    if (copyQuickStatementsBtn) {
        copyQuickStatementsBtn.addEventListener('click', () => {
            copyQuickStatements();
        });
    }
    
    // Download QuickStatements button
    const downloadQuickStatementsBtn = document.getElementById('download-quick-statements');
    if (downloadQuickStatementsBtn) {
        downloadQuickStatementsBtn.addEventListener('click', () => {
            downloadQuickStatements();
        });
    }
    
    // Open QuickStatements button
    const openQuickStatementsBtn = document.getElementById('open-quick-statements');
    if (openQuickStatementsBtn) {
        openQuickStatementsBtn.addEventListener('click', () => {
            openQuickStatements();
        });
    }
    
    // JSON export/import functionality removed for MVP
    
    // Initialize export
    function initializeExport() {
        // Generate QuickStatements directly
        generateQuickStatements();
    }
    
    /**
     * Escapes strings for QuickStatements format compliance
     * 
     * QuickStatements requires specific string escaping to prevent parsing errors:
     * - Double quotes must be escaped as double double-quotes ("")
     * - Newlines and carriage returns must be converted to spaces
     * - Empty/null values must be represented as empty quoted strings
     * 
     * This escaping is critical because improperly formatted strings can cause:
     * - QuickStatements import failures
     * - Data corruption during parsing
     * - Silent truncation of content
     * 
     * @param {string|null|undefined} str - String to escape for QuickStatements
     * @returns {string} Properly escaped string ready for QuickStatements format
     * 
     * @example
     * escapeQuickStatementsString('Book "Title" Name') // '"Book ""Title"" Name"'
     * escapeQuickStatementsString('Multi\nline') // '"Multi line"'
     * escapeQuickStatementsString(null) // '""'
     */
    function escapeQuickStatementsString(str) {
        if (!str) return '""';
        // Escape quotes and handle special characters
        return `"${str.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
    }
    
    /**
     * Converts precision string to Wikidata precision number
     * 
     * Maps user-friendly precision names to Wikidata's numeric precision system:
     * - 'day': 11 (most precise - full date)
     * - 'month': 10 (month-level precision)
     * - 'year': 9 (year-level precision)
     * - 'decade': 8 (decade-level precision)
     * 
     * @param {string} precisionString - User-friendly precision name
     * @returns {number} Wikidata precision number (defaults to 11 for day)
     * 
     * @example
     * getPrecisionNumber('year') // 9
     * getPrecisionNumber('month') // 10
     * getPrecisionNumber('day') // 11
     * getPrecisionNumber('decade') // 8
     */
    function getPrecisionNumber(precisionString) {
        const precisionMapping = {
            'day': 11,
            'month': 10,
            'year': 9,
            'decade': 8,
            'century': 7  // Future support
        };
        
        return precisionMapping[precisionString] || 11; // Default to day precision
    }
    
    /**
     * Formats dates for QuickStatements with appropriate precision indicators
     * 
     * Wikidata requires specific date formatting with precision values that indicate
     * the granularity of the date information:
     * - Precision 11: Day-level precision (YYYY-MM-DD)
     * - Precision 10: Month-level precision (YYYY-MM)
     * - Precision 9: Year-level precision (YYYY)
     * 
     * The precision affects how Wikidata displays and processes the date,
     * and must match the actual precision of the source data.
     * 
     * @param {string|Date} dateString - Date value to format
     * @param {number} precision - Wikidata precision level (8=decade, 9=year, 10=month, 11=day)
     * @returns {string|null} Formatted date string or null for invalid dates
     * 
     * @example
     * formatDate("2023-05-15", 11) // "+2023-05-15T00:00:00Z/11"
     * formatDate("2023-05", 10) // "+2023-05-01T00:00:00Z/10"
     * formatDate("2023", 9) // "+2023-01-01T00:00:00Z/9"
     * formatDate("1990s", 8) // "+1990-01-01T00:00:00Z/8"
     * 
     * @description
     * Date formatting requirements:
     * - Must include timezone indicator (Z for UTC)
     * - Must include precision suffix (/8, /9, /10, /11)
     * - Must handle various input formats gracefully (full dates, year-month, year-only, decades)
     * - Must return null for unparseable dates
     * - Automatically detects input format and adjusts parsing accordingly
     */
    function formatDate(dateString, precision = 11) {
        if (!dateString) return null;
        
        try {
            let dateStr = String(dateString).trim();
            let year, month, day;
            
            // Handle decade inputs (e.g., "1990s", "199x")
            if (precision === 8 && /^\d{3}[0-9xX][sS]?$/.test(dateStr)) {
                const decadeMatch = dateStr.match(/^(\d{3})[0-9xX]/);
                if (decadeMatch) {
                    year = `${decadeMatch[1]}0`;
                    month = '01';
                    day = '01';
                }
            }
            // Handle year-only inputs (e.g., "2023")
            else if (/^\d{4}$/.test(dateStr)) {
                year = dateStr;
                month = '01';
                day = '01';
            }
            // Handle year-month inputs (e.g., "2023-05")
            else if (/^\d{4}-\d{1,2}$/.test(dateStr)) {
                const [y, m] = dateStr.split('-');
                year = y;
                month = m.padStart(2, '0');
                day = '01';
            }
            // Handle full date inputs (e.g., "2023-05-15")
            else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
                const [y, m, d] = dateStr.split('-');
                year = y;
                month = m.padStart(2, '0');
                day = d.padStart(2, '0');
            }
            // Try to parse as Date object for other formats
            else {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    return null;
                }
                year = String(date.getFullYear());
                month = String(date.getMonth() + 1).padStart(2, '0');
                day = String(date.getDate()).padStart(2, '0');
            }
            
            // Validate year is reasonable
            if (!year || year.length < 4 || isNaN(parseInt(year))) {
                return null;
            }
            
            // Ensure we have valid month and day
            month = month || '01';
            day = day || '01';
            
            return `+${year}-${month}-${day}T00:00:00Z/${precision}`;
        } catch (error) {
            console.error('Error formatting date:', dateString, error);
            return null;
        }
    }

    /**
     * Collects references for a specific property and item
     * @param {string} propertyId - Wikidata property ID (e.g., 'P1476')
     * @param {string} itemId - Item ID (e.g., 'https://...items/123')
     * @param {Object} currentState - Application state
     * @returns {Array} Array of reference objects with url property
     */
    function getReferencesForPropertyAndItem(propertyId, itemId, currentState) {
        const references = [];

        // Get property-specific reference assignments
        const assignedReferenceTypes = currentState.references?.propertyReferences?.[propertyId] || [];

        // If no references assigned to this property, return empty array
        if (assignedReferenceTypes.length === 0) {
            return references;
        }

        // Get all item references (auto-detected)
        const itemReferences = currentState.references?.itemReferences?.[itemId] || [];

        // Get all custom references
        const customReferences = currentState.references?.customReferences || [];

        // Collect references based on assigned types
        assignedReferenceTypes.forEach(refTypeId => {
            // Check if this is an auto-detected reference type
            const autoDetectedTypes = ['omeka-item', 'oclc', 'ark'];
            if (autoDetectedTypes.includes(refTypeId)) {
                // Find matching auto-detected references for this item
                const matchingRefs = itemReferences.filter(ref => ref.type === refTypeId);
                matchingRefs.forEach(ref => {
                    if (ref.url) {
                        references.push({ url: ref.url });
                    }
                });
            } else {
                // This is a custom reference - find it in customReferences
                const customRef = customReferences.find(cr => cr.id === refTypeId);
                if (customRef && customRef.items) {
                    // Find this item's URL in the custom reference's items array
                    const itemRef = customRef.items.find(item => item.itemId === itemId);
                    if (itemRef && itemRef.url) {
                        references.push({ url: itemRef.url });
                    }
                }
            }
        });

        return references;
    }

    // Format a single statement with references
    function formatStatement(itemId, propertyId, value, references = []) {
        if (!itemId || !propertyId || !value) {
            return null;
        }

        let statement = `${itemId}\t${propertyId}\t${value}`;

        // Add references
        if (references && references.length > 0) {
            references.forEach(ref => {
                if (ref.url) {
                    statement += `\tS854\t${escapeQuickStatementsString(ref.url)}`;
                }
                if (ref.retrievedDate) {
                    const formattedDate = formatDate(ref.retrievedDate);
                    if (formattedDate) {
                        statement += `\tS813\t${formattedDate}`;
                    }
                }
            });
        }

        return statement;
    }
    
    // Validate QuickStatements syntax
    function validateQuickStatements(statements) {
        const errors = [];
        const warnings = [];
        
        if (!statements || statements.trim() === '') {
            errors.push('No statements to validate');
            return { isValid: false, errors, warnings };
        }
        
        const lines = statements.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const trimmedLine = line.trim();
            
            if (trimmedLine === 'CREATE' || trimmedLine === 'LAST') {
                // Valid command lines
                return;
            }
            
            const parts = trimmedLine.split('\t');
            
            if (parts.length < 3) {
                errors.push(`Line ${lineNum}: Invalid format - expected at least 3 tab-separated parts`);
                return;
            }
            
            // Validate item ID (first part)
            const itemId = parts[0];
            if (itemId !== 'LAST' && !itemId.match(/^Q\d+$/)) {
                errors.push(`Line ${lineNum}: Invalid item ID '${itemId}' - should be Q followed by numbers`);
            }
            
            // Validate property ID (second part)
            const propertyId = parts[1];
            // Allow special properties for labels (Len) and descriptions (Den) where n is language code
            if (!propertyId.match(PROPERTY_ID_REGEX) && !propertyId.match(LANGUAGE_PROPERTY_REGEX)) {
                errors.push(`Line ${lineNum}: Invalid property ID '${propertyId}' - should be P or S followed by numbers, or L/D followed by language code`);
            }
            
            // Validate value format (third part)
            const value = parts[2];
            if (value.startsWith('"') && !value.endsWith('"')) {
                errors.push(`Line ${lineNum}: Unclosed string value`);
            }
            
            if (value.match(/^Q\d+$/) && value === 'Q0') {
                warnings.push(`Line ${lineNum}: Q0 is not a valid item ID`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Check if an item has any valid reconciled properties that should be exported
     * 
     * An item is considered exportable if it has at least one property with a selectedMatch.
     * Items where all properties were skipped during reconciliation should not be exported.
     * 
     * @param {Object} itemData - The item's reconciliation data
     * @returns {boolean} True if the item has at least one valid reconciled property
     */
    function hasValidReconciledProperties(itemData) {
        if (!itemData || !itemData.properties) {
            return false;
        }
        
        return Object.keys(itemData.properties).some(propertyKey => {
            const propertyData = itemData.properties[propertyKey];
            
            if (!propertyData || !propertyData.reconciled) {
                return false;
            }
            
            // Check if any reconciled value has a selectedMatch
            return propertyData.reconciled.some(reconciledValue => {
                return reconciledValue && reconciledValue.selectedMatch;
            });
        });
    }
    
    // Generate QuickStatements
    function generateQuickStatements() {
        if (!quickStatementsTextarea) return;
        
        const currentState = state.getState();
        const reconciliationData = currentState.reconciliationData;
        const mappedKeys = currentState.mappings?.mappedKeys || [];
        const manualProperties = currentState.mappings?.manualProperties || [];

        const entitySchema = currentState.entitySchema;
        
        if (!reconciliationData || Object.keys(reconciliationData).length === 0) {
            quickStatementsTextarea.value = 'No reconciliation data available. Please complete the reconciliation step.';
            updateValidationDisplay({ isValid: false, errors: ['No reconciliation data available'], warnings: [] });
            return;
        }
        
        let quickStatementsText = '';
        const errors = [];
        
        // Process each item
        Object.keys(reconciliationData).forEach(itemId => {
            const itemData = reconciliationData[itemId];

            try {
                // Only export items that have at least one reconciled property with selectedMatch
                // Skip items where all properties were skipped during reconciliation
                if (!hasValidReconciledProperties(itemData)) {
                    return; // Skip this item entirely
                }

                // Extract the original item ID from the source data
                // References in Step 4 are keyed by the @id field (e.g., "https://...items/123")
                // But reconciliation uses simplified IDs (e.g., "item-0")
                // We need to get the @id from originalData for reference lookups
                const originalItemId = itemData.originalData?.['@id'] || itemId;

                // Check if item is linked to an existing Wikidata item
                const linkedQid = currentState.linkedItems ? currentState.linkedItems[itemId] : null;

                var itemPrefix;
                if (linkedQid) {
                    // Item is linked to existing Wikidata item - use QID directly, don't create new item
                    itemPrefix = linkedQid;
                } else {
                    // Create new item since it has valid reconciled properties
                    quickStatementsText += 'CREATE\n';

                    // Note: Label/description/alias configuration removed (was in step 4 designer)
                    // Items will be created without labels - these can be added manually in Wikidata

                    itemPrefix = 'LAST';
                }
                
                // Process each property
                Object.keys(itemData.properties).forEach(propertyKey => {
                    const propertyData = itemData.properties[propertyKey];

                    // Determine if this is a manual property or mapped property
                    let wikidataPropertyId;
                    let isManualProperty = false;
                    let propertyMetadata = null;

                    // Check if this is a manual property first
                    const manualProperty = manualProperties.find(mp => mp.property.id === propertyKey);
                    if (manualProperty) {
                        wikidataPropertyId = manualProperty.property.id;
                        propertyMetadata = manualProperty.property;
                        isManualProperty = true;
                    } else {
                        // Find the corresponding mapping to get the Wikidata property ID
                        const mapping = mappedKeys.find(m => m.key === propertyKey);
                        wikidataPropertyId = mapping?.property?.id || propertyKey;
                        propertyMetadata = mapping?.property;
                    }

                    // Store original property ID for reference lookup (before QuickStatements transformation)
                    const originalPropertyId = wikidataPropertyId;

                    // Process each reconciled value
                    propertyData.reconciled.forEach(reconciledValue => {
                        if (reconciledValue.selectedMatch) {
                            const match = reconciledValue.selectedMatch;
                            let value = '';
                            // Reset to original property ID for each value (in case it was transformed in previous iteration)
                            let currentPropertyId = originalPropertyId;

                            try {
                                if (match.type === 'wikidata') {
                                    value = match.id;
                                } else if (match.type === 'custom') {
                                    if (match.datatype === 'time') {
                                        // Extract precision from saved reconciliation data
                                        const precision = getPrecisionNumber(match.precision);
                                        value = formatDate(match.value, precision);
                                        if (!value) {
                                            errors.push(`Invalid date format for ${propertyKey}: ${match.value}`);
                                            return;
                                        }
                                    } else if (match.datatype === 'monolingualtext') {
                                        // Handle monolingual text (labels, descriptions, aliases)
                                        value = escapeQuickStatementsString(match.value);

                                        // For label/description/alias properties, format with language code
                                        // QuickStatements format: Len (label-en), Den (description-en), Aen (alias-en)
                                        // Handle both singular and plural forms (alias/aliases)
                                        const isLabel = currentPropertyId === 'label' || currentPropertyId === 'labels';
                                        const isDescription = currentPropertyId === 'description' || currentPropertyId === 'descriptions';
                                        const isAlias = currentPropertyId === 'alias' || currentPropertyId === 'aliases';

                                        if (isLabel || isDescription || isAlias) {
                                            const languageCode = match.language || 'en'; // Default to 'en' if no language specified

                                            // Warn if language code is missing
                                            if (!match.language) {
                                                console.warn(`No language code specified for ${currentPropertyId} "${match.value}". Defaulting to "en". Please re-reconcile this value with a language selection.`);
                                            }

                                            // Map property type to QuickStatements prefix
                                            let prefix;
                                            if (isLabel) {
                                                prefix = 'L';
                                            } else if (isDescription) {
                                                prefix = 'D';
                                            } else if (isAlias) {
                                                prefix = 'A';
                                            }

                                            // Transform property ID to QuickStatements format
                                            currentPropertyId = `${prefix}${languageCode}`;
                                        }
                                    } else {
                                        value = escapeQuickStatementsString(match.value);
                                    }
                                } else if (match.type === 'string') {
                                    // Handle string type reconciliation (from "Accept as String" option)
                                    value = escapeQuickStatementsString(match.value);
                                }

                                if (value) {
                                    // Get property-specific references using:
                                    // 1. ORIGINAL property ID (before QuickStatements transformation like "label" → "Len")
                                    // 2. ORIGINAL item ID (the @id field from source data, not the simplified "item-0" ID)
                                    // This ensures references are found correctly in both dimensions
                                    const references = getReferencesForPropertyAndItem(originalPropertyId, originalItemId, currentState);

                                    // Format the statement using the transformed property ID for QuickStatements
                                    const statement = formatStatement(itemPrefix, currentPropertyId, value, references);
                                    if (statement) {
                                        quickStatementsText += statement + '\n';
                                    }
                                }
                            } catch (error) {
                                errors.push(`Error processing ${propertyKey}: ${error.message}`);
                            }
                        }
                    });
                });
                
                // Add separator between items
                quickStatementsText += '\n';
            } catch (error) {
                errors.push(`Error processing item ${itemId}: ${error.message}`);
            }
        });
        
        quickStatementsTextarea.value = quickStatementsText;
        
        // Validate the generated statements
        const validation = validateQuickStatements(quickStatementsText);
        if (errors.length > 0) {
            validation.errors = [...validation.errors, ...errors];
            validation.isValid = false;
        }
        
        updateValidationDisplay(validation);
    }
    
    // Update validation display
    function updateValidationDisplay(validation) {
        // Get or create validation display element
        let validationDisplay = document.getElementById('validation-display');
        if (!validationDisplay) {
            validationDisplay = createElement('div', {
                id: 'validation-display',
                className: 'validation-display'
            });
            const exportContainer = document.querySelector('.export-container');
            const quickStatementsOutput = document.querySelector('.quick-statements-output');
            exportContainer.insertBefore(validationDisplay, quickStatementsOutput.nextSibling);
        }
        
        validationDisplay.innerHTML = '';
        
        if (validation.isValid && validation.errors.length === 0) {
            // No success message needed - valid syntax is expected
        } else {
            if (validation.errors.length > 0) {
                const errorDiv = createElement('div', {
                    className: 'validation-errors'
                });
                errorDiv.appendChild(createElement('h4', {}, 'Errors:'));
                const errorList = createElement('ul', { className: 'error-list' });
                validation.errors.forEach(error => {
                    errorList.appendChild(createElement('li', {}, error));
                });
                errorDiv.appendChild(errorList);
                validationDisplay.appendChild(errorDiv);
            }
        }
        
        if (validation.warnings && validation.warnings.length > 0) {
            const warningDiv = createElement('div', {
                className: 'validation-warnings'
            });
            warningDiv.appendChild(createElement('h4', {}, 'Warnings:'));
            const warningList = createElement('ul', { className: 'warning-list' });
            validation.warnings.forEach(warning => {
                warningList.appendChild(createElement('li', {}, warning));
            });
            warningDiv.appendChild(warningList);
            validationDisplay.appendChild(warningDiv);
        }
    }
    
    // Copy QuickStatements to clipboard
    function copyQuickStatements() {
        if (!quickStatementsTextarea) return;
        
        try {
            quickStatementsTextarea.select();
            document.execCommand('copy');
            showMessage('QuickStatements copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            showMessage('Failed to copy to clipboard. Please select and copy manually.', 'error');
        }
    }
    
    // Download QuickStatements as .txt file
    function downloadQuickStatements() {
        if (!quickStatementsTextarea || !quickStatementsTextarea.value.trim()) {
            showMessage('No QuickStatements to download', 'error');
            return;
        }
        
        const content = quickStatementsTextarea.value;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `quickstatements-${timestamp}.txt`;
        
        const downloadLink = createDownloadLink(url, filename, {
            onClick: () => {
                setTimeout(() => URL.revokeObjectURL(url), 100);
                showMessage('QuickStatements downloaded successfully', 'success');
            }
        });
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
    
    // Generate QuickStatements URL
    function generateQuickStatementsUrl(quickStatementsText) {
        if (!quickStatementsText || !quickStatementsText.trim()) {
            return null;
        }
        
        // Replace TAB characters with "|" and newlines with "||"
        let urlText = quickStatementsText
            .replace(/\t/g, '|')
            .replace(/\n/g, '||');
        
        // Apply URL encoding
        urlText = encodeURIComponent(urlText);
        
        // Generate the complete URL
        return `https://quickstatements.toolforge.org/#/v1=${urlText}`;
    }
    
    // Open QuickStatements with generated URL
    function openQuickStatements() {
        if (!quickStatementsTextarea || !quickStatementsTextarea.value.trim()) {
            showMessage('No QuickStatements to open', 'error');
            return;
        }
        
        const quickStatementsText = quickStatementsTextarea.value;
        const url = generateQuickStatementsUrl(quickStatementsText);
        
        if (url) {
            window.open(url, '_blank');
            showMessage('Opening QuickStatements in new tab', 'success');
        } else {
            showMessage('Failed to generate QuickStatements URL', 'error');
        }
    }
    
    // Download JSON
    function downloadJson() {
        // Prepare the state for export
        const exportData = state.exportState();
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const filename = `wikidata-mapping-${new Date().toISOString().slice(0, 10)}.json`;
        
        // Create download link
        const downloadLink = createDownloadLink(url, filename, {
            onClick: () => {
                // Cleanup after download
                setTimeout(() => URL.revokeObjectURL(url), 100);
            }
        });
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Mark changes as saved
        state.markChangesSaved();
    }
    
    // Import JSON
    function importJson() {
        // For wireframe, use a file input
        const fileInput = createFileInput({
            accept: 'application/json',
            onChange: (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const jsonData = e.target.result;
                        const success = state.importState(jsonData);
                        
                        if (success) {
                            alert('Project imported successfully');
                            
                            // Navigate to the step stored in the imported state
                            const currentStep = state.getCurrentStep();
                            document.querySelector(`.step[data-step="${currentStep}"]`)?.click();
                            
                            // Re-generate QuickStatements
                            generateQuickStatements();
                        } else {
                            alert('Error importing project: Invalid JSON format');
                        }
                    } catch (error) {
                        console.error('Error importing project:', error);
                        alert('Error importing project: ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        });
        
        fileInput.click();
    }
}