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

export const VALUE_SOURCE_TYPES = Object.freeze({
    LITERAL: 'literal',
    WIKIDATA: 'wikidata',
    AUTHORITY: 'authority',
    URI: 'uri'
});

const ORDERED_VALUE_SOURCE_TYPES = Object.freeze([
    VALUE_SOURCE_TYPES.LITERAL,
    VALUE_SOURCE_TYPES.URI,
    VALUE_SOURCE_TYPES.AUTHORITY,
    VALUE_SOURCE_TYPES.WIKIDATA
]);

const KNOWN_URI_FAMILIES = Object.freeze([
    {
        key: 'oclc-worldcat',
        label: 'OCLC / WorldCat',
        kind: 'identifier-family',
        matches: uri => /worldcat\.org\/oclc\//i.test(uri)
    },
    {
        key: 'ark',
        label: 'ARK',
        kind: 'identifier-family',
        matches: uri => /ark:\//i.test(uri)
    },
    {
        key: 'doi',
        label: 'DOI',
        kind: 'identifier-family',
        matches: uri => /doi\.org\//i.test(uri)
    },
    {
        key: 'handle',
        label: 'Handle',
        kind: 'identifier-family',
        matches: uri => /handle\.net\//i.test(uri)
    },
    {
        key: 'viaf',
        label: 'VIAF',
        kind: 'authority-family',
        matches: uri => /viaf\.org\//i.test(uri)
    },
    {
        key: 'geonames',
        label: 'GeoNames',
        kind: 'authority-family',
        matches: uri => /geonames\.org\//i.test(uri)
    },
    {
        key: 'loc',
        label: 'Library of Congress',
        kind: 'authority-family',
        matches: uri => /id\.loc\.gov\//i.test(uri)
    },
    {
        key: 'getty-aat',
        label: 'Getty AAT',
        kind: 'authority-family',
        matches: uri => /vocab\.getty\.edu\//i.test(uri)
    },
    {
        key: 'wikidata',
        label: 'Wikidata',
        kind: 'wikidata',
        matches: uri => /wikidata\.org\/(?:entity|wiki)\//i.test(uri)
    }
]);

const SOURCE_LABEL_OVERRIDES = new Map([
    ['valuesuggest:oclc:viaf', 'ValueSuggest: VIAF'],
    ['valuesuggest:geonames:geonames', 'ValueSuggest: GeoNames'],
    ['valuesuggest:ndeterms:geonames', 'ValueSuggest: GeoNames'],
    ['valuesuggest:ndeterms:wikipers', 'ValueSuggest: Wikidata Person'],
    ['valuesuggest:ndeterms:wikiall', 'ValueSuggest: Wikidata All'],
    ['valuesuggest:lc:iso6391', 'ValueSuggest: ISO 639-1'],
    ['viaf', 'Authority: VIAF'],
    ['geonames', 'Authority: GeoNames'],
    ['aat', 'Authority: Getty AAT'],
    ['loc', 'Authority: Library of Congress'],
    ['oclc', 'Authority: OCLC'],
    ['wikidata', 'Wikidata'],
    ['literal', 'Literal'],
    ['uri', 'URL']
]);

const LABEL_VALUE_FIELDS = ['o:label', 'display_title', 'label', 'name', 'title'];
const LITERAL_VALUE_FIELDS = ['@value', 'value'];
const URI_VALUE_FIELDS = ['@id', 'id'];
const SKIP_PROFILE_FIELDS = new Set(['property_id', 'type', 'is_public']);
const AUTHORITY_URI_PATTERNS = [
    /viaf\.org/i,
    /geonames\.org/i,
    /vocab\.getty\.edu/i,
    /id\.loc\.gov/i,
    /data\.bibliotheken\.nl/i,
    /rkd\.nl/i,
    /worldcat\.org/i
];

export function createFieldProfileStats(templateAllowedTypes = []) {
    return {
        templateAllowedTypes: new Set(templateAllowedTypes),
        observedTypes: new Set(),
        availableValueParts: new Set(),
        valueSourceTypes: new Set(),
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
        valueSourceTypes: getOrderedValueSourceTypes(Array.from(stats.valueSourceTypes)),
        hasMixedTypes: stats.observedTypes.size > 1 || stats.templateAllowedTypes.size > 1,
        hasAuthorityLabels: stats.hasAuthorityLabels,
        hasUris: stats.hasUris,
        hasLiterals: stats.hasLiterals
    };
}

export function classifyValueSource(rawValue) {
    return getValueSourceMetadata(rawValue).sourceType;
}

function humanizeSourceToken(token) {
    if (!token) {
        return '';
    }

    const normalized = String(token).trim().toLowerCase();
    if (SOURCE_LABEL_OVERRIDES.has(normalized)) {
        return SOURCE_LABEL_OVERRIDES.get(normalized);
    }

    const compact = normalized.replace(/^valuesuggest:/, '');
    if (SOURCE_LABEL_OVERRIDES.has(compact)) {
        return SOURCE_LABEL_OVERRIDES.get(compact);
    }

    return String(token)
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase());
}

function normalizeSegmentToken(token) {
    return String(token || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatHostLabel(hostname) {
    if (!hostname) {
        return 'URL';
    }

    return hostname
        .replace(/^www\./i, '')
        .split('.')
        .filter(Boolean)
        .join('.');
}

function getUriFamily(uriString = '') {
    const uriValue = String(uriString || '').trim();
    if (!uriValue) {
        return {
            key: 'url',
            label: 'URL',
            kind: 'uri',
            preview: ''
        };
    }

    const knownMatch = KNOWN_URI_FAMILIES.find(family => family.matches(uriValue));
    if (knownMatch) {
        return {
            key: knownMatch.key,
            label: knownMatch.label,
            kind: knownMatch.kind,
            preview: uriValue
        };
    }

    try {
        const parsedUrl = new URL(uriValue);
        const hostLabel = formatHostLabel(parsedUrl.hostname);
        return {
            key: `host-${normalizeSegmentToken(hostLabel)}`,
            label: `${hostLabel} URLs`,
            kind: 'domain-family',
            preview: uriValue
        };
    } catch {
        return {
            key: `url-${normalizeSegmentToken(uriValue.slice(0, 40)) || 'value'}`,
            label: 'URL values',
            kind: 'uri',
            preview: uriValue
        };
    }
}

function shortenPreview(value) {
    const stringValue = String(value || '').trim();
    if (stringValue.length <= 72) {
        return stringValue;
    }
    return `${stringValue.slice(0, 69)}...`;
}

function buildAuthoritySourceLabel(rawType, uriValue = null) {
    const normalizedType = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
    if (normalizedType && normalizedType !== 'uri' && SOURCE_LABEL_OVERRIDES.has(normalizedType)) {
        return SOURCE_LABEL_OVERRIDES.get(normalizedType);
    }

    if (normalizedType.startsWith('valuesuggest:')) {
        const compact = normalizedType.slice('valuesuggest:'.length);
        if (SOURCE_LABEL_OVERRIDES.has(compact)) {
            return SOURCE_LABEL_OVERRIDES.get(compact);
        }

        const parts = compact.split(':').filter(Boolean);
        const preferredToken = parts[parts.length - 1] || compact;
        const humanToken = humanizeSourceToken(preferredToken)
            .replace(/^Authority:\s*/i, '')
            .replace(/^ValueSuggest:\s*/i, '');
        return `ValueSuggest: ${humanToken}`;
    }

    const uriString = uriValue ? String(uriValue) : '';
    if (/viaf\.org/i.test(uriString)) return 'Authority: VIAF';
    if (/geonames\.org/i.test(uriString)) return 'Authority: GeoNames';
    if (/vocab\.getty\.edu/i.test(uriString)) return 'Authority: Getty AAT';
    if (/id\.loc\.gov/i.test(uriString)) return 'Authority: Library of Congress';
    if (/worldcat\.org/i.test(uriString)) return 'Authority: OCLC';

    return 'Authority';
}

export function getValueSourceMetadata(rawValue) {
    if (rawValue === null || rawValue === undefined) {
        return {
            sourceType: null,
            sourceKey: null,
            sourceLabel: null,
            sourceDetail: null
        };
    }

    if (Array.isArray(rawValue)) {
        return rawValue.map(entry => getValueSourceMetadata(entry)).find(entry => entry.sourceType) || {
            sourceType: null,
            sourceKey: null,
            sourceLabel: null,
            sourceDetail: null
        };
    }

    if (typeof rawValue !== 'object') {
        return {
            sourceType: VALUE_SOURCE_TYPES.LITERAL,
            sourceKey: 'literal',
            sourceLabel: SOURCE_LABEL_OVERRIDES.get('literal'),
            sourceDetail: typeof rawValue
        };
    }

    const rawType = typeof rawValue.type === 'string' ? rawValue.type : '';
    const uriValue = URI_VALUE_FIELDS
        .map(field => rawValue[field])
        .find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim() !== '');

    if (uriValue) {
        const uriString = String(uriValue);
        if (/wikidata\.org\/(?:entity|wiki)\/Q\d+/i.test(uriString)) {
            return {
                sourceType: VALUE_SOURCE_TYPES.WIKIDATA,
                sourceKey: 'wikidata',
                sourceLabel: SOURCE_LABEL_OVERRIDES.get('wikidata'),
                sourceDetail: uriString
            };
        }
        if (rawType.startsWith('valuesuggest:') || AUTHORITY_URI_PATTERNS.some(pattern => pattern.test(uriString))) {
            return {
                sourceType: VALUE_SOURCE_TYPES.AUTHORITY,
                sourceKey: rawType ? rawType.toLowerCase() : uriString,
                sourceLabel: buildAuthoritySourceLabel(rawType, uriString),
                sourceDetail: rawType || uriString
            };
        }
        return {
            sourceType: VALUE_SOURCE_TYPES.URI,
            sourceKey: 'uri',
            sourceLabel: SOURCE_LABEL_OVERRIDES.get('uri'),
            sourceDetail: uriString
        };
    }

    return {
        sourceType: VALUE_SOURCE_TYPES.LITERAL,
        sourceKey: 'literal',
        sourceLabel: SOURCE_LABEL_OVERRIDES.get('literal'),
        sourceDetail: rawType || 'literal'
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
        stats.valueSourceTypes.add(VALUE_SOURCE_TYPES.LITERAL);
        return;
    }

    const rawType = typeof rawValue.type === 'string' && rawValue.type.trim()
        ? rawValue.type.trim()
        : 'object';
    stats.observedTypes.add(rawType);
    const valueSource = classifyValueSource(rawValue);
    if (valueSource) {
        stats.valueSourceTypes.add(valueSource);
    }

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
        [EXTRACTION_MODES.DISPLAY_TEXT]: 'Best label text',
        [EXTRACTION_MODES.AUTHORITY_LABEL]: 'Authority label only',
        [EXTRACTION_MODES.IDENTIFIER_OR_URI]: 'Identifier or URL',
        [EXTRACTION_MODES.LITERAL_VALUE]: 'Literal text only',
        [EXTRACTION_MODES.URI_ONLY]: 'URL only'
    };

    return labels[mode] || mode;
}

export function getExtractionModeDescription(mode, propertyDatatype = null) {
    const descriptions = {
        [EXTRACTION_MODES.AUTO]: propertyDatatype === 'wikibase-item'
            ? 'Automatically use the default readable text for each eligible value segment based on the Wikidata property type.'
            : 'Automatically use the default value part for each eligible value segment based on the Wikidata property type and the Omeka field structure.',
        [EXTRACTION_MODES.DISPLAY_TEXT]: 'Use the best human-readable text for each eligible value segment. Prefer a linked label, then other readable text, then a URI only as a fallback.',
        [EXTRACTION_MODES.AUTHORITY_LABEL]: 'Use the label that comes with an authority-linked value segment. If no separate authority label exists, fall back to the human-readable text stored with that linked value.',
        [EXTRACTION_MODES.IDENTIFIER_OR_URI]: 'Prefer identifiers or URLs when the Wikidata property expects them, and only fall back to readable text if needed.',
        [EXTRACTION_MODES.LITERAL_VALUE]: 'Use only the plain literal text stored in Omeka S for each eligible value segment.',
        [EXTRACTION_MODES.URI_ONLY]: 'Use only the URI or URL itself for each eligible value segment.'
    };

    return descriptions[mode] || '';
}

export function getValueSourceTypeLabel(sourceType) {
    const labels = {
        [VALUE_SOURCE_TYPES.LITERAL]: 'Literal entries',
        [VALUE_SOURCE_TYPES.WIKIDATA]: 'Direct Wikidata-linked entries',
        [VALUE_SOURCE_TYPES.AUTHORITY]: 'ValueSuggest / authority-linked entries',
        [VALUE_SOURCE_TYPES.URI]: 'Standalone URL entries'
    };

    return labels[sourceType] || sourceType;
}

export function getValueSourceTypeDescription(sourceType, propertyDatatype = null) {
    const descriptions = {
        [VALUE_SOURCE_TYPES.LITERAL]: 'Include plain text value segments with no linked authority or Wikidata URI behind them.',
        [VALUE_SOURCE_TYPES.WIKIDATA]: propertyDatatype === 'wikibase-item'
            ? 'Include value segments that already point directly to a Wikidata entity URI. They will reconcile using their readable label text.'
            : 'Keep value segments that already point directly to a Wikidata entity URI available when relevant. They still reconcile using readable label text.',
        [VALUE_SOURCE_TYPES.AUTHORITY]: 'Include value segments that point to an authority or ValueSuggest URI. They reconcile using readable label text rather than the raw URI.',
        [VALUE_SOURCE_TYPES.URI]: propertyDatatype === 'url' || propertyDatatype === 'external-id'
            ? 'Include standalone URL-valued segments whose main value is the URL or identifier itself.'
            : 'Include standalone URL-valued segments that are not linked authority entities.'
    };

    return descriptions[sourceType] || '';
}

export function getOrderedValueSourceTypes(sourceTypes = []) {
    const uniqueTypes = Array.from(new Set(sourceTypes));
    return ORDERED_VALUE_SOURCE_TYPES.filter(sourceType => uniqueTypes.includes(sourceType));
}

function forEachRawValueSegment(rawValue, callback) {
    if (rawValue === null || rawValue === undefined) {
        return;
    }

    if (Array.isArray(rawValue)) {
        rawValue.forEach(entry => forEachRawValueSegment(entry, callback));
        return;
    }

    callback(rawValue);
}

export function summarizeValueSourcesForField(fieldValues = []) {
    const initialStats = ORDERED_VALUE_SOURCE_TYPES.reduce((accumulator, sourceType) => {
        accumulator[sourceType] = {
            valueCount: 0,
            itemCount: 0
        };
        return accumulator;
    }, {});

    fieldValues.forEach(fieldValue => {
        const seenInItem = new Set();

        forEachRawValueSegment(fieldValue, rawSegment => {
            const sourceType = classifyValueSource(rawSegment);
            if (!sourceType || !initialStats[sourceType]) {
                return;
            }

            initialStats[sourceType].valueCount += 1;
            seenInItem.add(sourceType);
        });

        seenInItem.forEach(sourceType => {
            initialStats[sourceType].itemCount += 1;
        });
    });

    return initialStats;
}

export function summarizeValueSourcesForResolvedDetails(valueDetailsByItem = []) {
    const initialStats = ORDERED_VALUE_SOURCE_TYPES.reduce((accumulator, sourceType) => {
        accumulator[sourceType] = {
            valueCount: 0,
            itemCount: 0
        };
        return accumulator;
    }, {});

    valueDetailsByItem.forEach(itemDetails => {
        const seenInItem = new Set();

        (itemDetails || []).forEach(detail => {
            const sourceType = detail?.sourceType || detail?.valueSource || null;
            if (!sourceType || !initialStats[sourceType]) {
                return;
            }

            initialStats[sourceType].valueCount += 1;
            seenInItem.add(sourceType);
        });

        seenInItem.forEach(sourceType => {
            initialStats[sourceType].itemCount += 1;
        });
    });

    return initialStats;
}

export function buildIncludedSegmentsSignature(includedSegments = []) {
    if (!Array.isArray(includedSegments) || includedSegments.length === 0) {
        return null;
    }

    const normalizedSegments = [...new Set(
        includedSegments
            .map(segment => String(segment || '').trim())
            .filter(Boolean)
    )].sort();

    return normalizedSegments.length > 0
        ? normalizedSegments.map(segment => encodeURIComponent(segment)).join('|')
        : null;
}

export function getSegmentMetadata(rawValue, options = {}) {
    const {
        sourceMetadata = getValueSourceMetadata(rawValue),
        candidates = getValueCandidates(rawValue),
        matchedPart = null,
        candidateValue = null
    } = options;

    const readableValue = candidateValue
        ?? candidates.labelValue
        ?? candidates.literalValue
        ?? candidates.uriValue
        ?? candidates.fallbackValue
        ?? '';
    const rawType = typeof rawValue?.type === 'string' ? rawValue.type.trim() : '';

    if (sourceMetadata.sourceType === VALUE_SOURCE_TYPES.WIKIDATA) {
        return {
            segmentKey: 'wikidata::direct',
            segmentLabel: 'Direct Wikidata-linked values',
            segmentPreview: shortenPreview(readableValue || sourceMetadata.sourceDetail || ''),
            segmentKind: 'wikidata'
        };
    }

    if (sourceMetadata.sourceType === VALUE_SOURCE_TYPES.AUTHORITY) {
        const uriFamily = candidates.uriValue ? getUriFamily(candidates.uriValue) : null;
        const authorityLabel = uriFamily?.label && uriFamily.key !== 'url'
            ? uriFamily.label
            : sourceMetadata.sourceLabel || 'Authority-linked values';
        const authorityKey = normalizeSegmentToken(
            uriFamily?.key || sourceMetadata.sourceKey || rawType || authorityLabel || 'authority'
        );
        return {
            segmentKey: `authority::${authorityKey || 'authority'}`,
            segmentLabel: authorityLabel,
            segmentPreview: shortenPreview(readableValue || sourceMetadata.sourceDetail || ''),
            segmentKind: 'authority-family'
        };
    }

    if (sourceMetadata.sourceType === VALUE_SOURCE_TYPES.URI) {
        const uriFamily = getUriFamily(candidates.uriValue || sourceMetadata.sourceDetail || readableValue);
        return {
            segmentKey: `uri::${uriFamily.key}`,
            segmentLabel: uriFamily.label,
            segmentPreview: shortenPreview(uriFamily.preview || readableValue),
            segmentKind: uriFamily.kind
        };
    }

    const literalType = rawType && rawType !== 'literal'
        ? humanizeSourceToken(rawType)
        : matchedPart === 'o:label'
            ? 'Label text values'
            : 'Literal text values';

    return {
        segmentKey: `literal::${normalizeSegmentToken(literalType) || 'literal-text'}`,
        segmentLabel: literalType,
        segmentPreview: shortenPreview(readableValue || ''),
        segmentKind: 'literal'
    };
}

export function summarizeObservedSegments(valueDetailsByItem = []) {
    const observedSegments = new Map();

    const getSegmentGroupOrder = (segmentKey = '') => {
        if (segmentKey.startsWith('literal::')) {
            return 0;
        }
        if (segmentKey.startsWith('uri::')) {
            return 1;
        }
        if (segmentKey.startsWith('authority::')) {
            return 2;
        }
        if (segmentKey.startsWith('wikidata::')) {
            return 3;
        }
        return 4;
    };

    valueDetailsByItem.forEach(itemDetails => {
        const seenInItem = new Set();
        (itemDetails || []).forEach(detail => {
            if (!detail?.segmentKey) {
                return;
            }

            const existing = observedSegments.get(detail.segmentKey) || {
                key: detail.segmentKey,
                label: detail.segmentLabel || detail.segmentKey,
                preview: detail.segmentPreview || '',
                kind: detail.segmentKind || null,
                valueCount: 0,
                itemCount: 0
            };

            existing.valueCount += 1;
            if (!existing.preview && detail.segmentPreview) {
                existing.preview = detail.segmentPreview;
            }
            observedSegments.set(detail.segmentKey, existing);
            seenInItem.add(detail.segmentKey);
        });

        seenInItem.forEach(segmentKey => {
            const existing = observedSegments.get(segmentKey);
            if (existing) {
                existing.itemCount += 1;
            }
        });
    });

    return Array.from(observedSegments.values()).sort((a, b) => {
        const groupOrderDifference = getSegmentGroupOrder(a.key) - getSegmentGroupOrder(b.key);
        if (groupOrderDifference !== 0) {
            return groupOrderDifference;
        }
        if (b.itemCount !== a.itemCount) {
            return b.itemCount - a.itemCount;
        }
        if (b.valueCount !== a.valueCount) {
            return b.valueCount - a.valueCount;
        }
        return a.label.localeCompare(b.label);
    });
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

    const summary = typeBits.length > 0
        ? `This field has ${typeBits.join(' and ')}.`
        : 'This field uses the detected Omeka value structure.';
    const partsSummary = valueParts.length > 0
        ? ` Available data parts: ${formatHumanList(valueParts)}.`
        : '';

    return {
        summary: `${summary}${partsSummary}`,
        recommendedMode: getDefaultExtractionMode(profile, propertyDatatype)
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

        const sourceMetadata = getValueSourceMetadata(rawValue);
        const segmentMetadata = getSegmentMetadata(rawValue, {
            sourceMetadata,
            candidates: getValueCandidates(rawValue),
            matchedPart: selectedAtField,
            candidateValue: overrideValue
        });
        return {
            value: String(overrideValue),
            language: selectedAtField === '@value'
                ? (typeof rawValue['@language'] === 'string' ? rawValue['@language'] : null)
                : null,
            matchedPart: selectedAtField,
            resolvedMode: 'field_override',
            sourceType: sourceMetadata.sourceType,
            sourceKey: sourceMetadata.sourceKey,
            sourceLabel: sourceMetadata.sourceLabel,
            sourceDetail: sourceMetadata.sourceDetail,
            segmentKey: segmentMetadata.segmentKey,
            segmentLabel: segmentMetadata.segmentLabel,
            segmentPreview: segmentMetadata.segmentPreview,
            segmentKind: segmentMetadata.segmentKind,
            valueSource: sourceMetadata.sourceType,
            dedupeKey: `${sourceMetadata.sourceKey || sourceMetadata.sourceType || 'value'}::${String(overrideValue).trim().toLowerCase()}`
        };
    }

    return null;
}

export function resolveOmekaValue(rawValue, options = {}) {
    const {
        extractionMode = EXTRACTION_MODES.AUTO,
        propertyDatatype = null,
        fieldProfile = null,
        selectedAtField = null,
        includedValueSources = null,
        includedSegments = null
    } = options;

    if (selectedAtField) {
        return extractFieldOverrideValue(rawValue, selectedAtField);
    }

    if (Array.isArray(rawValue) && (
        (Array.isArray(includedValueSources) && includedValueSources.length > 0)
        || (Array.isArray(includedSegments) && includedSegments.length > 0)
    )) {
        for (const entry of rawValue) {
            const entrySource = classifyValueSource(entry);
            if (Array.isArray(includedValueSources) && includedValueSources.length > 0 && entrySource && !includedValueSources.includes(entrySource)) {
                continue;
            }

            const entrySegment = getSegmentMetadata(entry).segmentKey;
            if (Array.isArray(includedSegments) && includedSegments.length > 0 && entrySegment && !includedSegments.includes(entrySegment)) {
                continue;
            }

            const resolvedEntry = resolveOmekaValue(entry, {
                extractionMode,
                propertyDatatype,
                fieldProfile,
                selectedAtField: null,
                includedValueSources: null,
                includedSegments: null
            });

            if (resolvedEntry?.value) {
                return {
                    ...resolvedEntry,
                    valueSource: entrySource || resolvedEntry.valueSource || null
                };
            }
        }

        return null;
    }

    if (Array.isArray(includedValueSources) && includedValueSources.length > 0) {
        const valueSource = classifyValueSource(rawValue);
        if (valueSource && !includedValueSources.includes(valueSource)) {
            return null;
        }
    }

    const preliminarySegment = getSegmentMetadata(rawValue);
    if (Array.isArray(includedSegments) && includedSegments.length > 0 && preliminarySegment.segmentKey && !includedSegments.includes(preliminarySegment.segmentKey)) {
        return null;
    }

    const sourceMetadata = getValueSourceMetadata(rawValue);
    const automaticModeBySource = {
        [VALUE_SOURCE_TYPES.WIKIDATA]: EXTRACTION_MODES.DISPLAY_TEXT,
        [VALUE_SOURCE_TYPES.AUTHORITY]: EXTRACTION_MODES.AUTHORITY_LABEL,
        [VALUE_SOURCE_TYPES.LITERAL]: EXTRACTION_MODES.LITERAL_VALUE,
        [VALUE_SOURCE_TYPES.URI]: EXTRACTION_MODES.URI_ONLY
    };
    const automaticMode = propertyDatatype === 'external-id'
        ? EXTRACTION_MODES.IDENTIFIER_OR_URI
        : (automaticModeBySource[sourceMetadata.sourceType]
            || getDefaultExtractionMode(fieldProfile ?? buildObservedFieldProfile(rawValue), propertyDatatype));
    const effectiveMode = extractionMode === EXTRACTION_MODES.AUTO
        ? automaticMode
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
            const segmentMetadata = getSegmentMetadata(rawValue, {
                sourceMetadata,
                candidates,
                matchedPart,
                candidateValue
            });
            return {
                value: String(candidateValue),
                language: candidateKey === 'literalValue' ? candidates.language : null,
                matchedPart,
                resolvedMode: effectiveMode,
                valueSource: sourceMetadata.sourceType,
                sourceType: sourceMetadata.sourceType,
                sourceKey: sourceMetadata.sourceKey,
                sourceLabel: sourceMetadata.sourceLabel,
                sourceDetail: sourceMetadata.sourceDetail,
                segmentKey: segmentMetadata.segmentKey,
                segmentLabel: segmentMetadata.segmentLabel,
                segmentPreview: segmentMetadata.segmentPreview,
                segmentKind: segmentMetadata.segmentKind,
                dedupeKey: `${sourceMetadata.sourceKey || sourceMetadata.sourceType || 'value'}::${String(candidateValue).trim().toLowerCase()}`
            };
        }
    }

    return null;
}
