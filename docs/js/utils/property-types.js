/**
 * Property type detection and input field management for sophisticated reconciliation
 * 
 * This utility module provides intelligent property type detection based on multiple signals:
 * - Wikidata property datatype definitions
 * - Semantic property name patterns and conventions
 * - Sample value analysis from Omeka S data
 * - Entity Schema constraint requirements
 * 
 * Accurate type detection is crucial because it determines:
 * - Which reconciliation strategies to apply (entity vs. literal matching)
 * - What input validation and formatting rules to use
 * - How values should be represented in final QuickStatements export
 * - Which Wikidata constraints and validation rules apply
 * 
 * The system balances multiple detection approaches:
 * 1. Explicit Wikidata datatype (most reliable when available)
 * 2. Semantic name pattern matching (covers common metadata patterns)
 * 3. Value content analysis (handles edge cases and custom properties)
 * 4. Fallback to safe default types (prevents processing failures)
 * 
 * Type detection affects the entire reconciliation workflow, so accuracy and
 * completeness here directly impacts the quality of the final Wikidata import.
 * 
 * @module property-types
 */

/**
 * Canonical mapping from Wikidata property datatypes to internal processing types
 * 
 * This mapping defines how Wikidata's formal property datatypes translate into
 * the reconciliation and validation systems used by this application. Each mapping
 * determines the entire processing pipeline for properties of that type.
 * 
 * The mappings are based on Wikidata's official datatype specifications:
 * @see https://www.wikidata.org/wiki/Help:Data_type
 * 
 * Critical implications of each type:
 * - wikibase-item: Requires entity reconciliation against Wikidata Q-IDs
 * - string/text: Direct text matching with optional validation patterns
 * - time/date: Requires date parsing and precision handling
 * - quantity/number: Requires numeric validation and unit handling
 * - url: Requires URL format validation and accessibility checking
 * 
 * @constant {Object.<string, string>}
 */
const PROPERTY_TYPE_MAPPING = {
    // Entity references (Q-IDs)
    'wikibase-item': 'qid',
    'wikibase-property': 'property',
    
    // Text types
    'string': 'text',
    'external-id': 'text',
    'url': 'url',
    'monolingualtext': 'monolingualtext',
    
    // Numeric types
    'quantity': 'number',
    'commons-media': 'commons',
    
    // Time types
    'time': 'date',
    
    // Geographic types
    'globe-coordinate': 'coordinates'
};

/**
 * Semantic property name patterns for intelligent type detection
 * 
 * When explicit Wikidata datatype information is unavailable, this mapping provides
 * intelligent fallback detection based on property name semantics. The patterns are
 * derived from common metadata vocabularies and naming conventions:
 * 
 * - Dublin Core (dcterms:creator, dcterms:title, etc.)
 * - Schema.org (schema:author, schema:publisher, etc.)
 * - Common Omeka S property naming patterns
 * - Academic and cultural heritage metadata standards
 * 
 * Pattern matching strategy:
 * 1. Exact property name matches (e.g., "creator" -> wikibase-item)
 * 2. Partial matches for compound properties (e.g., "copyrightHolder")
 * 3. Semantic grouping by expected value types
 * 4. Conservative defaults to prevent processing errors
 * 
 * The patterns are ordered by likelihood and specificity, with more specific
 * patterns taking precedence over general ones during detection.
 * 
 * @constant {Object.<string, string>} Property name -> expected Wikidata datatype
 */
const PROPERTY_PATTERNS = {
    // Common person/organization properties
    'creator': 'wikibase-item',
    'author': 'wikibase-item',
    'publisher': 'wikibase-item',
    'editor': 'wikibase-item',
    'contributor': 'wikibase-item',
    'copyrightHolder': 'wikibase-item',
    'director': 'wikibase-item',
    'performer': 'wikibase-item',
    'subject': 'wikibase-item',
    'genre': 'wikibase-item',
    'language': 'wikibase-item',
    'place': 'wikibase-item',
    'location': 'wikibase-item',
    'country': 'wikibase-item',
    'city': 'wikibase-item',
    'license': 'wikibase-item',
    'rights': 'wikibase-item',
    'copyright': 'wikibase-item',
    
    // Text properties
    'title': 'string',
    'description': 'string',
    'abstract': 'string',
    'summary': 'string',
    'label': 'string',
    'name': 'string',
    'identifier': 'external-id',
    'isbn': 'external-id',
    'doi': 'external-id',
    'orcid': 'external-id',
    
    // Numeric properties
    'pages': 'quantity',
    'volume': 'quantity',
    'issue': 'quantity',
    'edition': 'quantity',
    'year': 'quantity',
    'duration': 'quantity',
    'height': 'quantity',
    'width': 'quantity',
    'weight': 'quantity',
    
    // Date properties
    'date': 'time',
    'published': 'time',
    'created': 'time',
    'modified': 'time',
    'birth': 'time',
    'death': 'time',
    'start': 'time',
    'end': 'time',
    
    // URL properties
    'url': 'url',
    'website': 'url',
    'homepage': 'url',
    'source': 'url'
};

/**
 * Detects the expected property type using multiple detection strategies
 * 
 * This is the primary type detection function that orchestrates multiple detection
 * approaches to determine the most appropriate property type. The detection follows
 * a priority hierarchy to ensure accuracy while maintaining robustness.
 * 
 * Detection priority order:
 * 1. Explicit entity schema constraints (highest priority)
 * 2. Direct property name pattern matching
 * 3. Semantic substring matching for compound names
 * 4. Value content analysis (fallback)
 * 5. Safe default type (string - lowest priority)
 * 
 * @param {string} propertyName - Property name to analyze (e.g., 'dcterms:creator')
 * @param {Object} [entitySchema] - Optional entity schema with property constraints
 * @param {Array} [entitySchema.properties] - Property constraint definitions
 * @returns {string} Detected property type compatible with Wikidata datatypes
 * 
 * @example
 * detectPropertyType('creator') // 'wikibase-item' (expects entity)
 * detectPropertyType('title') // 'string' (expects literal text)
 * detectPropertyType('dateCreated') // 'time' (expects date value)
 * 
 * @description
 * The function handles various property name formats:
 * - Prefixed properties (dcterms:creator, schema:author)
 * - CamelCase compounds (dateCreated, copyrightHolder)
 * - Underscore_separated (date_created, copyright_holder)
 * - Simple names (title, description, year)
 * 
 * Type detection accuracy is crucial because it determines the entire
 * reconciliation and validation pipeline for each property.
 */
export function detectPropertyType(propertyName, entitySchema = null) {
    // First check if we have entity schema information
    if (entitySchema && entitySchema.properties && entitySchema.properties[propertyName]) {
        const schemaProperty = entitySchema.properties[propertyName];
        if (schemaProperty.datatype) {
            return schemaProperty.datatype;
        }
    }
    
    // Check exact property name matches
    const normalizedProperty = propertyName.toLowerCase().replace(/[^a-z]/g, '');
    if (PROPERTY_PATTERNS[normalizedProperty]) {
        return PROPERTY_PATTERNS[normalizedProperty];
    }
    
    // Check partial matches
    for (const [pattern, type] of Object.entries(PROPERTY_PATTERNS)) {
        if (normalizedProperty.includes(pattern) || pattern.includes(normalizedProperty)) {
            return type;
        }
    }
    
    // Default to string if no specific type detected
    return 'string';
}

/**
 * Get input field configuration for a property type
 * @param {string} propertyType - The property type (e.g., 'wikibase-item', 'string')
 * @returns {Object} Input field configuration
 */
export function getInputFieldConfig(propertyType) {
    const configs = {
        'wikibase-item': {
            type: 'qid-select',
            placeholder: 'Search for Wikidata item...',
            allowCustom: false,
            requiresReconciliation: true,
            validation: /^Q\d+$/,
            description: 'Select a Wikidata entity (Q-ID)'
        },
        
        'wikibase-property': {
            type: 'property-select',
            placeholder: 'Search for Wikidata property...',
            allowCustom: false,
            requiresReconciliation: true,
            validation: /^P\d+$/,
            description: 'Select a Wikidata property (P-ID)'
        },
        
        'string': {
            type: 'text',
            placeholder: 'Enter text value...',
            allowCustom: true,
            requiresReconciliation: false,
            validation: null,
            description: 'Free text value'
        },
        
        'external-id': {
            type: 'text',
            placeholder: 'Enter identifier...',
            allowCustom: true,
            requiresReconciliation: false,
            validation: null,
            description: 'External identifier'
        },
        
        'url': {
            type: 'url',
            placeholder: 'Enter URL...',
            allowCustom: true,
            requiresReconciliation: false,
            validation: /^https?:\/\/.+/,
            description: 'Valid URL (http:// or https://)'
        },
        
        'quantity': {
            type: 'number',
            placeholder: 'Enter number...',
            allowCustom: true,
            requiresReconciliation: false,
            validation: /^-?\d+(\.\d+)?$/,
            description: 'Numeric value',
            units: true
        },
        
        'time': {
            type: 'date',
            placeholder: 'Select date...',
            allowCustom: true,
            requiresReconciliation: false,
            validation: null,
            description: 'Date/time value',
            precision: true,
            calendar: true
        },
        
        'monolingualtext': {
            type: 'text',
            placeholder: 'Enter text...',
            allowCustom: true,
            requiresReconciliation: false,
            validation: null,
            description: 'Text with language specification',
            language: true
        },
        
        'commons-media': {
            type: 'text',
            placeholder: 'Enter Commons filename...',
            allowCustom: true,
            requiresReconciliation: false,
            validation: /^.+\.(jpe?g|png|gif|svg|pdf|ogg|mp[34]|webm)$/i,
            description: 'Wikimedia Commons filename'
        },
        
        'globe-coordinate': {
            type: 'coordinates',
            placeholder: 'Enter coordinates...',
            allowCustom: true,
            requiresReconciliation: false,
            validation: /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/,
            description: 'Geographic coordinates (lat, lon)'
        }
    };
    
    return configs[propertyType] || configs['string'];
}

/**
 * Create appropriate input HTML for a property type
 * @param {string} propertyType - The property type
 * @param {string} value - Current value
 * @param {string} propertyName - Property name for context
 * @returns {string} HTML for the input field
 */
export function createInputHTML(propertyType, value = '', propertyName = '') {
    const config = getInputFieldConfig(propertyType);
    const inputId = `input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let html = `<div class="dynamic-input-container" data-property-type="${propertyType}">`;
    
    // Add description
    html += `<p class="input-description">${config.description}</p>`;
    
    switch (config.type) {
        case 'qid-select':
            html += `
                <div class="qid-input-group">
                    <input type="text" 
                           id="${inputId}" 
                           class="qid-input" 
                           placeholder="${config.placeholder}"
                           value="${value}"
                           data-property="${propertyName}">
                    <button class="btn small secondary search-qid-btn" type="button">Search</button>
                </div>
                <div class="qid-suggestions" style="display: none;"></div>
            `;
            break;
            
        case 'number':
            html += `
                <div class="number-input-group">
                    <input type="number" 
                           id="${inputId}" 
                           class="number-input" 
                           placeholder="${config.placeholder}"
                           value="${value}"
                           step="any">
                    ${config.units ? '<select class="unit-select"><option value="">No unit</option></select>' : ''}
                </div>
            `;
            break;
            
        case 'date':
            html += `
                <div class="date-input-group">
                    <div class="date-input-row">
                        <input type="text" 
                               id="${inputId}" 
                               class="date-input flexible-date-input" 
                               placeholder="Enter date (e.g., 2023, 2023-06, 2023-06-15, 1990s)"
                               value="${value}"
                               data-auto-precision="true">
                        <input type="date" 
                               class="date-picker-fallback" 
                               style="display: none;">
                        <button type="button" class="date-picker-btn">📅</button>
                    </div>
                    ${config.precision ? `
                        <select class="precision-select">
                            <option value="day">Day precision</option>
                            <option value="month">Month precision</option>
                            <option value="year">Year precision</option>
                            <option value="decade">Decade precision</option>
                        </select>
                    ` : ''}
                    ${config.calendar ? `
                        <select class="calendar-select">
                            <option value="gregorian">Gregorian calendar</option>
                            <option value="julian">Julian calendar</option>
                        </select>
                    ` : ''}
                    <div class="date-format-hint">
                        Supports: Year (2023), Month (2023-06), Day (2023-06-15), Decade (1990s)
                    </div>
                </div>
            `;
            break;
            
        case 'url':
            html += `
                <input type="url" 
                       id="${inputId}" 
                       class="url-input" 
                       placeholder="${config.placeholder}"
                       value="${value}">
            `;
            break;
            
        case 'coordinates':
            html += `
                <div class="coordinates-input-group">
                    <input type="text" 
                           id="${inputId}" 
                           class="coordinates-input" 
                           placeholder="${config.placeholder}"
                           value="${value}">
                    <button class="btn small secondary map-btn" type="button">📍 Map</button>
                </div>
            `;
            break;
            
        default: // text, external-id, etc.
            html += `
                <input type="text" 
                       id="${inputId}" 
                       class="text-input" 
                       placeholder="${config.placeholder}"
                       value="${value}">
                ${config.language ? `
                    <select class="language-select">
                        <option value="en">English</option>
                        <option value="de">German</option>
                        <option value="fr">French</option>
                        <option value="es">Spanish</option>
                        <option value="it">Italian</option>
                        <option value="nl">Dutch</option>
                    </select>
                ` : ''}
            `;
            break;
    }
    
    // Add validation message container
    html += `<div class="validation-message" style="display: none;"></div>`;
    
    html += `</div>`;
    
    return html;
}

/**
 * Validate input value according to property type
 * @param {string} value - Value to validate
 * @param {string} propertyType - Property type
 * @returns {Object} Validation result with isValid and message
 */
export function validateInput(value, propertyType) {
    const config = getInputFieldConfig(propertyType);
    
    if (!value || value.trim() === '') {
        return { isValid: false, message: 'Value is required' };
    }
    
    if (config.validation && !config.validation.test(value)) {
        return { 
            isValid: false, 
            message: `Invalid format for ${propertyType}. ${config.description}` 
        };
    }
    
    return { isValid: true, message: '' };
}

/**
 * Get suggested entity types for reconciliation based on property
 * @param {string} propertyName - Property name
 * @returns {Array} Array of Wikidata entity type Q-IDs
 */
export function getSuggestedEntityTypes(propertyName) {
    const normalizedProperty = propertyName.toLowerCase().replace(/[^a-z]/g, '');
    
    const typeMapping = {
        'creator': ['Q5', 'Q43229'], // Person, Organization
        'author': ['Q5'], // Person
        'publisher': ['Q2085381', 'Q43229'], // Publisher, Organization
        'editor': ['Q5'], // Person
        'contributor': ['Q5', 'Q43229'], // Person, Organization
        'copyrightHolder': ['Q5', 'Q43229'], // Person, Organization
        'director': ['Q5'], // Person
        'performer': ['Q5'], // Person
        'subject': ['Q35120'], // Entity
        'genre': ['Q483394'], // Genre
        'language': ['Q34770'], // Language
        'place': ['Q17334923'], // Location
        'location': ['Q17334923'], // Location
        'country': ['Q6256'], // Country
        'city': ['Q515'] // City
    };
    
    return typeMapping[normalizedProperty] || ['Q35120']; // Default to Entity
}

/**
 * Common units for quantity properties
 */
export const COMMON_UNITS = {
    'pages': [],
    'volume': [],
    'issue': [],
    'edition': [],
    'year': [],
    'duration': ['Q11574', 'Q7727', 'Q25235'], // second, minute, hour
    'height': ['Q11573', 'Q174728', 'Q828224'], // metre, centimetre, kilometre
    'width': ['Q11573', 'Q174728', 'Q828224'], // metre, centimetre, kilometre
    'weight': ['Q11570', 'Q41803', 'Q223664'] // kilogram, gram, pound
};

/**
 * Get common units for a property
 * @param {string} propertyName - Property name
 * @returns {Array} Array of unit Q-IDs
 */
export function getCommonUnits(propertyName) {
    const normalizedProperty = propertyName.toLowerCase().replace(/[^a-z]/g, '');
    return COMMON_UNITS[normalizedProperty] || [];
}

/**
 * Detect date precision based on input format
 * Mimics Wikidata's behavior where precision adapts to the input format
 * @param {string} dateInput - The date input string
 * @returns {string} Detected precision ('year', 'month', 'day', 'decade')
 */
export function detectDatePrecision(dateInput) {
    if (!dateInput || dateInput.trim() === '') {
        return 'day'; // Default precision
    }
    
    const input = dateInput.trim();
    
    // Check for year only (4 digits) - MUST come before decade check
    if (/^\d{4}$/.test(input)) {
        return 'year';
    }
    
    // Check for decade format (e.g., "1990s", "199x", "199X", "199-")
    // More specific patterns to avoid matching regular years
    if (/^\d{3}[0-9][sS]$/.test(input) ||       // 1990s, 1990S
        /^\d{3}[xX]$/.test(input) ||            // 199x, 199X  
        /^\d{3}[-_]$/.test(input)) {            // 199-, 199_
        return 'decade';
    }
    
    // Check for year-month format (YYYY-MM)
    if (/^\d{4}-\d{1,2}$/.test(input)) {
        return 'month';
    }
    
    // Check for full date format (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, etc.)
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(input) || 
        /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input) ||
        /^\d{1,2}-\d{1,2}-\d{4}$/.test(input) ||
        /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(input)) {
        return 'day';
    }
    
    // Check for partial year formats (e.g., "early 1990", "late 19th century")
    if (/\b\d{4}\b/.test(input)) {
        return 'year';
    }
    
    // Default to day precision for any other format
    return 'day';
}

/**
 * Convert various date input formats to standardized format
 * @param {string} dateInput - The date input string
 * @returns {Object} Object containing standardized date and detected precision
 */
export function standardizeDateInput(dateInput) {
    if (!dateInput || dateInput.trim() === '') {
        return { date: '', precision: 'day' };
    }
    
    const input = dateInput.trim();
    const precision = detectDatePrecision(input);
    
    // Handle decade format
    if (precision === 'decade') {
        const decade = input.match(/\d{3}/)[0];
        return { 
            date: `${decade}0-01-01`, 
            precision: 'decade',
            displayValue: `${decade}0s`
        };
    }
    
    // Handle year only
    if (precision === 'year' && /^\d{4}$/.test(input)) {
        return { 
            date: `${input}-01-01`, 
            precision: 'year',
            displayValue: input
        };
    }
    
    // Handle year-month format
    if (precision === 'month') {
        const parts = input.split('-');
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        return { 
            date: `${year}-${month}-01`, 
            precision: 'month',
            displayValue: `${year}-${month}`
        };
    }
    
    // Handle various full date formats
    if (precision === 'day') {
        let standardDate = input;
        
        // Convert DD/MM/YYYY to YYYY-MM-DD
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input)) {
            const [day, month, year] = input.split('/');
            standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Convert DD-MM-YYYY to YYYY-MM-DD
        else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(input)) {
            const [day, month, year] = input.split('-');
            standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Convert DD.MM.YYYY to YYYY-MM-DD
        else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(input)) {
            const [day, month, year] = input.split('.');
            standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        return { 
            date: standardDate, 
            precision: 'day',
            displayValue: standardDate
        };
    }
    
    // Fallback
    return { date: input, precision: 'day', displayValue: input };
}

/**
 * Setup dynamic date precision handlers for date inputs
 * This function should be called after creating date input HTML
 * @param {HTMLElement} container - Container element with date inputs
 */
export function setupDynamicDatePrecision(container) {
    const dateInputs = container.querySelectorAll('.flexible-date-input[data-auto-precision="true"]');
    
    dateInputs.forEach(dateInput => {
        const dateInputGroup = dateInput.closest('.date-input-group');
        
        // Skip if we can't find the expected DOM structure
        if (!dateInputGroup) {
            console.warn('setupDynamicDatePrecision: Could not find .date-input-group parent for date input');
            return;
        }
        
        const precisionSelect = dateInputGroup.querySelector('.precision-select');
        const datePicker = dateInputGroup.querySelector('.date-picker-fallback');
        const datePickerBtn = dateInputGroup.querySelector('.date-picker-btn');
        
        // Auto-detect precision on input change
        dateInput.addEventListener('input', function() {
            const inputValue = this.value;
            const detectedPrecision = detectDatePrecision(inputValue);
            
            console.log('Date input changed:', {
                inputValue,
                detectedPrecision,
                hasPrecisionSelect: !!precisionSelect
            });
            
            if (precisionSelect) {
                // Update precision select to match detected precision
                precisionSelect.value = detectedPrecision;
                
                // Trigger change event to notify other parts of the application
                precisionSelect.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.warn('setupDynamicDatePrecision: Could not find .precision-select element');
            }
            
            // Update visual feedback
            updateDateInputFeedback(this, detectedPrecision, inputValue);
        });
        
        // Handle date picker button
        if (datePickerBtn && datePicker) {
            datePickerBtn.addEventListener('click', function() {
                datePicker.style.display = 'block';
                datePicker.click();
            });
            
            datePicker.addEventListener('change', function() {
                if (this.value) {
                    dateInput.value = this.value;
                    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                this.style.display = 'none';
            });
            
        }
        
        // Initialize precision on page load if there's already a value
        if (dateInput.value) {
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
}

/**
 * Update visual feedback for date input based on detected precision
 * @param {HTMLElement} dateInput - The date input element
 * @param {string} precision - Detected precision
 * @param {string} inputValue - Current input value
 */
function updateDateInputFeedback(dateInput, precision, inputValue) {
    const container = dateInput.closest('.date-input-group');
    const hint = container.querySelector('.date-format-hint');
    
    console.log('Updating date input feedback:', {
        precision,
        inputValue,
        hasContainer: !!container,
        hasHint: !!hint
    });
    
    // Remove existing feedback classes
    dateInput.classList.remove('precision-year', 'precision-month', 'precision-day', 'precision-decade');
    
    // Add precision class for styling
    dateInput.classList.add(`precision-${precision}`);
    
    // Update hint text with detected precision
    if (hint && inputValue.trim()) {
        const standardized = standardizeDateInput(inputValue);
        hint.textContent = `Detected: ${precision} precision (${standardized.displayValue || inputValue})`;
        hint.style.color = '#2e7d32'; // Green color for successful detection
    } else if (hint) {
        hint.textContent = 'Supports: Year (2023), Month (2023-06), Day (2023-06-15), Decade (1990s)';
        hint.style.color = '#666';
    }
}