/**
 * Property type detection and input field management for reconciliation
 * Determines appropriate input types based on Wikidata properties and Entity Schema
 */

/**
 * Common Wikidata property types and their expected input types
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
 * Common property patterns that suggest specific types
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
 * Detect the expected property type for a given property name
 * @param {string} propertyName - The property name (e.g., 'creator', 'title')
 * @param {Object} entitySchema - Optional entity schema constraints
 * @returns {string} The detected property type
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
                    <input type="date" 
                           id="${inputId}" 
                           class="date-input" 
                           value="${value}">
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