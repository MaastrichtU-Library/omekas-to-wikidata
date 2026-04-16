/**
 * Omeka value profiling and extraction strategy helpers
 * Shared by Mapping, Reconciliation, and preview logic.
 * @module mapping/core/value-resolution
 */

export const EXTRACTION_MODES = Object.freeze({
    AUTO: 'auto',
    DISPLAY_TEXT: 'display_text',
    AUTHORITY_LABEL: 'authority_label',
    IDENTIFIER_OR_URI: 'identifier_or_uri',
    LITERAL_VALUE: 'literal_value',
    URI_ONLY: 'uri_only'
});

const LABEL_VALUE_FIELDS = ['o:label', 'display_title', 'label', 'name', 'title'];
const LITERAL_VALUE_FIELDS = ['@value', 'value'];
const URI_VALUE_FIELDS = ['@id', 'id'];
const SKIP_PROFILE_FIELDS = new Set(['property_id', 'type', 'is_public']);

export function createFieldProfileStats(templateAllowedTypes = []) {
    return {
        templateAllowedTypes: new Set(templateAllowedTypes),
        observedTypes: new Set(),
        availableValueParts: new Set(),
        hasAuthorityLabels: false,
        hasUris: false,
        hasLiterals: false
    };
}

export function finalizeFieldProfileStats(stats) {
    return {
        templateAllowedTypes: Array.from(stats.templateAllowedTypes).sort(),
        observedTypes: Array.from(stats.observedTypes).sort(),
        availableValueParts: Array.from(stats.availableValueParts).sort(),
        hasMixedTypes: stats.observedTypes.size > 1 || stats.templateAllowedTypes.size > 1,
        hasAuthorityLabels: stats.hasAuthorityLabels,
        hasUris: stats.hasUris,
        hasLiterals: stats.hasLiterals
    };
}

export function mergeObservedValueIntoProfileStats(rawValue, stats) {
    if (rawValue === null || rawValue === undefined) {
        return;
    }

    if (Array.isArray(rawValue)) {
        rawValue.forEach(entry => mergeObservedValueIntoProfileStats(entry, stats));
        return;
    }

    if (typeof rawValue !== 'object') {
        stats.hasLiterals = true;
        stats.observedTypes.add(typeof rawValue);
        stats.availableValueParts.add('_value');
        return;
    }

    const rawType = typeof rawValue.type === 'string' && rawValue.type.trim()
        ? rawValue.type.trim()
        : 'object';
    stats.observedTypes.add(rawType);

    Object.keys(rawValue).forEach(field => {
        if (!SKIP_PROFILE_FIELDS.has(field)) {
            stats.availableValueParts.add(field);
        }
    });

    if (LITERAL_VALUE_FIELDS.some(field => rawValue[field] !== undefined && rawValue[field] !== null && rawValue[field] !== '')) {
        stats.hasLiterals = true;
    }

    if (LABEL_VALUE_FIELDS.some(field => rawValue[field] !== undefined && rawValue[field] !== null && rawValue[field] !== '')) {
        stats.hasAuthorityLabels = true;
    }

    if (URI_VALUE_FIELDS.some(field => rawValue[field] !== undefined && rawValue[field] !== null && rawValue[field] !== '')) {
        stats.hasUris = true;
    }
}

export function buildObservedFieldProfile(rawValue, templateAllowedTypes = []) {
    const stats = createFieldProfileStats(templateAllowedTypes);
    mergeObservedValueIntoProfileStats(rawValue, stats);
    return finalizeFieldProfileStats(stats);
}

function formatHumanList(values) {
    if (!values.length) {
        return '';
    }
    if (values.length === 1) {
        return values[0];
    }
    if (values.length === 2) {
        return `${values[0]} and ${values[1]}`;
    }
    return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function getValueCandidates(rawValue) {
    const emptyResult = {
        labelValue: null,
        literalValue: null,
        uriValue: null,
        fallbackValue: null,
        language: null
    };

    if (rawValue === null || rawValue === undefined) {
        return emptyResult;
    }

    if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        const value = String(rawValue);
        return {
            ...emptyResult,
            literalValue: value,
            fallbackValue: value
        };
    }

    if (Array.isArray(rawValue)) {
        for (const entry of rawValue) {
            const resolvedEntry = getValueCandidates(entry);
            if (resolvedEntry.labelValue || resolvedEntry.literalValue || resolvedEntry.uriValue || resolvedEntry.fallbackValue) {
                return resolvedEntry;
            }
        }
        return emptyResult;
    }

    if (typeof rawValue !== 'object') {
        const value = String(rawValue);
        return {
            ...emptyResult,
            fallbackValue: value
        };
    }

    const language = typeof rawValue['@language'] === 'string' && rawValue['@language'].trim()
        ? rawValue['@language'].trim()
        : typeof rawValue.language === 'string' && rawValue.language.trim()
            ? rawValue.language.trim()
            : null;

    const labelValue = LABEL_VALUE_FIELDS
        .map(field => rawValue[field])
        .find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim() !== '');

    const literalValue = LITERAL_VALUE_FIELDS
        .map(field => rawValue[field])
        .find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim() !== '');

    const uriValue = URI_VALUE_FIELDS
        .map(field => rawValue[field])
        .find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim() !== '');

    let fallbackValue = null;
    for (const [field, fieldValue] of Object.entries(rawValue)) {
        if (SKIP_PROFILE_FIELDS.has(field)) {
            continue;
        }

        if (typeof fieldValue === 'string' && fieldValue.trim() !== '') {
            fallbackValue = fieldValue;
            break;
        }
    }

    return {
        labelValue: labelValue !== undefined && labelValue !== null ? String(labelValue) : null,
        literalValue: literalValue !== undefined && literalValue !== null ? String(literalValue) : null,
        uriValue: uriValue !== undefined && uriValue !== null ? String(uriValue) : null,
        fallbackValue: fallbackValue !== undefined && fallbackValue !== null ? String(fallbackValue) : null,
        language
    };
}

export function getExtractionModeLabel(mode) {
    const labels = {
        [EXTRACTION_MODES.AUTO]: 'Automatic',
        [EXTRACTION_MODES.DISPLAY_TEXT]: 'Display text',
        [EXTRACTION_MODES.AUTHORITY_LABEL]: 'Authority label',
        [EXTRACTION_MODES.IDENTIFIER_OR_URI]: 'Identifier or URI',
        [EXTRACTION_MODES.LITERAL_VALUE]: 'Literal value',
        [EXTRACTION_MODES.URI_ONLY]: 'URI only'
    };

    return labels[mode] || mode;
}

export function getDefaultExtractionMode(fieldProfile = {}, propertyDatatype = null) {
    const profile = fieldProfile || {};

    switch (propertyDatatype) {
        case 'wikibase-item':
            return EXTRACTION_MODES.DISPLAY_TEXT;
        case 'monolingualtext':
        case 'string':
            return profile.hasLiterals
                ? EXTRACTION_MODES.LITERAL_VALUE
                : profile.hasAuthorityLabels
                    ? EXTRACTION_MODES.DISPLAY_TEXT
                    : profile.hasUris
                        ? EXTRACTION_MODES.IDENTIFIER_OR_URI
                        : EXTRACTION_MODES.AUTO;
        case 'external-id':
            return EXTRACTION_MODES.IDENTIFIER_OR_URI;
        case 'url':
            return EXTRACTION_MODES.URI_ONLY;
        case 'time':
            return EXTRACTION_MODES.LITERAL_VALUE;
        default:
            if (profile.hasLiterals) {
                return EXTRACTION_MODES.LITERAL_VALUE;
            }
            if (profile.hasAuthorityLabels) {
                return EXTRACTION_MODES.DISPLAY_TEXT;
            }
            if (profile.hasUris) {
                return EXTRACTION_MODES.IDENTIFIER_OR_URI;
            }
            return EXTRACTION_MODES.AUTO;
    }
}

export function getAvailableExtractionModes(fieldProfile = {}, propertyDatatype = null) {
    const modes = new Set([EXTRACTION_MODES.AUTO, getDefaultExtractionMode(fieldProfile, propertyDatatype)]);

    if (fieldProfile.hasAuthorityLabels || fieldProfile.hasLiterals || fieldProfile.hasUris) {
        modes.add(EXTRACTION_MODES.DISPLAY_TEXT);
    }
    if (fieldProfile.hasAuthorityLabels) {
        modes.add(EXTRACTION_MODES.AUTHORITY_LABEL);
    }
    if (fieldProfile.hasLiterals) {
        modes.add(EXTRACTION_MODES.LITERAL_VALUE);
    }
    if (fieldProfile.hasUris) {
        modes.add(EXTRACTION_MODES.IDENTIFIER_OR_URI);
        modes.add(EXTRACTION_MODES.URI_ONLY);
    }

    return Array.from(modes);
}

export function describeFieldProfile(fieldProfile = {}, propertyDatatype = null) {
    const profile = fieldProfile || {};
    const typeBits = [];

    if (profile.observedTypes?.length) {
        typeBits.push(`observed ${formatHumanList(profile.observedTypes)}`);
    }
    if (profile.templateAllowedTypes?.length) {
        typeBits.push(`template allows ${formatHumanList(profile.templateAllowedTypes)}`);
    }

    const valueParts = [];
    if (profile.hasLiterals) {
        valueParts.push('literal values');
    }
    if (profile.hasAuthorityLabels) {
        valueParts.push('labels');
    }
    if (profile.hasUris) {
        valueParts.push('URIs');
    }

    const defaultMode = getDefaultExtractionMode(profile, propertyDatatype);
    const summary = typeBits.length > 0
        ? `This field has ${typeBits.join(' and ')}.`
        : 'This field uses the detected Omeka value structure.';
    const partsSummary = valueParts.length > 0
        ? ` Available data parts: ${formatHumanList(valueParts)}.`
        : '';
    const recommendation = ` Recommended extraction: ${getExtractionModeLabel(defaultMode)}.`;

    return {
        summary: `${summary}${partsSummary}${recommendation}`,
        recommendedMode: defaultMode
    };
}

function extractFieldOverrideValue(rawValue, selectedAtField) {
    if (rawValue === null || rawValue === undefined) {
        return null;
    }

    if (Array.isArray(rawValue)) {
        for (const entry of rawValue) {
            const overrideEntry = extractFieldOverrideValue(entry, selectedAtField);
            if (overrideEntry?.value !== null && overrideEntry?.value !== undefined && overrideEntry.value !== '') {
                return overrideEntry;
            }
        }
        return null;
    }

    if (typeof rawValue === 'object' && rawValue[selectedAtField] !== undefined) {
        const overrideValue = rawValue[selectedAtField];
        if (overrideValue === null || overrideValue === undefined) {
            return null;
        }

        return {
            value: String(overrideValue),
            language: selectedAtField === '@value'
                ? (typeof rawValue['@language'] === 'string' ? rawValue['@language'] : null)
                : null,
            matchedPart: selectedAtField,
            resolvedMode: 'field_override'
        };
    }

    return null;
}

export function resolveOmekaValue(rawValue, options = {}) {
    const {
        extractionMode = EXTRACTION_MODES.AUTO,
        propertyDatatype = null,
        fieldProfile = null,
        selectedAtField = null
    } = options;

    if (selectedAtField) {
        return extractFieldOverrideValue(rawValue, selectedAtField);
    }

    const effectiveMode = extractionMode === EXTRACTION_MODES.AUTO
        ? getDefaultExtractionMode(fieldProfile ?? buildObservedFieldProfile(rawValue), propertyDatatype)
        : extractionMode;

    const candidates = getValueCandidates(rawValue);
    const modePriority = {
        [EXTRACTION_MODES.DISPLAY_TEXT]: [
            ['labelValue', 'o:label'],
            ['literalValue', '@value'],
            ['uriValue', '@id'],
            ['fallbackValue', 'fallback']
        ],
        [EXTRACTION_MODES.AUTHORITY_LABEL]: [
            ['labelValue', 'o:label'],
            ['literalValue', '@value'],
            ['uriValue', '@id'],
            ['fallbackValue', 'fallback']
        ],
        [EXTRACTION_MODES.IDENTIFIER_OR_URI]: [
            ['uriValue', '@id'],
            ['literalValue', '@value'],
            ['labelValue', 'o:label'],
            ['fallbackValue', 'fallback']
        ],
        [EXTRACTION_MODES.LITERAL_VALUE]: [
            ['literalValue', '@value'],
            ['labelValue', 'o:label'],
            ['uriValue', '@id'],
            ['fallbackValue', 'fallback']
        ],
        [EXTRACTION_MODES.URI_ONLY]: [
            ['uriValue', '@id'],
            ['literalValue', '@value'],
            ['fallbackValue', 'fallback']
        ]
    };

    const priority = modePriority[effectiveMode] || modePriority[EXTRACTION_MODES.DISPLAY_TEXT];
    for (const [candidateKey, matchedPart] of priority) {
        const candidateValue = candidates[candidateKey];
        if (candidateValue !== null && candidateValue !== undefined && String(candidateValue).trim() !== '') {
            return {
                value: String(candidateValue),
                language: candidateKey === 'literalValue' ? candidates.language : null,
                matchedPart,
                resolvedMode: effectiveMode
            };
        }
    }

    return null;
}
