/**
 * Language utilities for handling Wikidata language codes
 * Provides comprehensive language support for monolingual text properties
 */

import { createElement } from '../ui/components.js';

/**
 * Comprehensive list of languages supported by Wikidata
 * Based on common Wikidata languages and ISO 639 codes
 */
export const WIKIDATA_LANGUAGES = [
    // Most common languages first
    { code: 'en', name: 'English' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'sv', name: 'Swedish' },
    { code: 'ko', name: 'Korean' },
    { code: 'tr', name: 'Turkish' },
    { code: 'hi', name: 'Hindi' },
    { code: 'fa', name: 'Persian' },
    { code: 'cs', name: 'Czech' },
    { code: 'he', name: 'Hebrew' },
    { code: 'id', name: 'Indonesian' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'el', name: 'Greek' },
    { code: 'no', name: 'Norwegian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'da', name: 'Danish' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'ro', name: 'Romanian' },
    { code: 'th', name: 'Thai' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'hr', name: 'Croatian' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'sr', name: 'Serbian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'lv', name: 'Latvian' },
    { code: 'et', name: 'Estonian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'eu', name: 'Basque' },
    { code: 'gl', name: 'Galician' },
    { code: 'sq', name: 'Albanian' },
    { code: 'mk', name: 'Macedonian' },
    { code: 'ms', name: 'Malay' },
    { code: 'bn', name: 'Bengali' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'kn', name: 'Kannada' },
    { code: 'mr', name: 'Marathi' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ur', name: 'Urdu' },
    { code: 'sw', name: 'Swahili' },
    { code: 'af', name: 'Afrikaans' },
    { code: 'is', name: 'Icelandic' },
    { code: 'ga', name: 'Irish' },
    { code: 'cy', name: 'Welsh' },
    { code: 'la', name: 'Latin' },
    { code: 'eo', name: 'Esperanto' },
    // Regional variants
    { code: 'pt-br', name: 'Portuguese (Brazil)' },
    { code: 'zh-hans', name: 'Chinese (Simplified)' },
    { code: 'zh-hant', name: 'Chinese (Traditional)' },
    { code: 'en-gb', name: 'English (UK)' },
    { code: 'en-us', name: 'English (US)' },
    { code: 'de-ch', name: 'German (Switzerland)' },
    { code: 'fr-ca', name: 'French (Canada)' },
    { code: 'es-mx', name: 'Spanish (Mexico)' },
    { code: 'nl-be', name: 'Dutch (Belgium)' }
];

/**
 * Get language name by code
 * @param {string} code - Language code
 * @returns {string} Language name or code if not found
 */
export function getLanguageName(code) {
    const language = WIKIDATA_LANGUAGES.find(lang => lang.code === code.toLowerCase());
    return language ? language.name : code;
}

/**
 * Create a language selector element with comprehensive options
 * @param {string} selectedCode - Currently selected language code
 * @param {string} className - CSS class for the select element
 * @returns {HTMLSelectElement} Language selector element
 */
export function createLanguageSelector(selectedCode = 'en', className = 'language-select') {
    const select = createElement('select', { className });
    
    // Add a placeholder option
    const placeholderOption = createElement('option', {
        value: '',
        disabled: true,
        selected: !selectedCode
    }, 'Select language...');
    select.appendChild(placeholderOption);
    
    // Add all language options
    WIKIDATA_LANGUAGES.forEach(lang => {
        const option = createElement('option', {
            value: lang.code,
            selected: lang.code === selectedCode
        }, `${lang.name} (${lang.code})`);
        select.appendChild(option);
    });
    
    return select;
}

/**
 * Validate if a language code is supported by Wikidata
 * @param {string} code - Language code to validate
 * @returns {boolean} True if valid
 */
export function isValidLanguageCode(code) {
    return WIKIDATA_LANGUAGES.some(lang => lang.code === code.toLowerCase());
}

/**
 * Get common language codes for quick selection
 * @returns {Array} Array of common language objects
 */
export function getCommonLanguages() {
    const commonCodes = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ja', 'zh'];
    return WIKIDATA_LANGUAGES.filter(lang => commonCodes.includes(lang.code));
}

/**
 * Parse language from monolingual text value
 * @param {Object} value - Monolingual text value object
 * @returns {string} Language code or 'en' as default
 */
export function parseMonolingualLanguage(value) {
    if (value && typeof value === 'object') {
        // Check for language in various formats
        if (value.language) return value.language;
        if (value['@language']) return value['@language'];
        if (value.lang) return value.lang;
    }
    return 'en'; // Default to English
}

/**
 * Format monolingual text value for display
 * @param {Object|string} value - The value to format
 * @returns {Object} Object with text and language
 */
export function formatMonolingualValue(value) {
    if (typeof value === 'string') {
        return { text: value, language: 'en' };
    }
    
    if (value && typeof value === 'object') {
        const text = value['@value'] || value.value || value.text || '';
        const language = parseMonolingualLanguage(value);
        return { text, language };
    }
    
    return { text: '', language: 'en' };
}