/**
 * Mapping modal functionality for property selection and configuration
 * Handles the main property mapping modal interface
 * @module mapping/ui/modals/mapping-modal
 */

// Import dependencies
import { createElement } from '../../../ui/components.js';
import { setupPropertySearch, extractEntitySchemaProperties, setupEntitySchemaPropertySelection } from '../../core/property-searcher.js';
import { renderValueTransformationUI } from '../../core/transformation-engine.js';
import { moveKeyToCategory, mapKeyToProperty, moveToNextUnmappedKey } from '../mapping-lists.js';
import { formatSampleValue } from './modal-helpers.js';
import { showMessage } from '../../../ui/components.js';
import {
    buildObservedFieldProfile,
    describeFieldProfile,
    getOrderedValueSourceTypes,
    summarizeObservedSegments,
    summarizeValueSourcesForResolvedDetails,
    buildIncludedSegmentsSignature,
    getValueSourceTypeLabel,
    getValueSourceTypeDescription,
    getOmekaFieldFriendlyName,
    extractSampleValue
} from '../../core/data-analyzer.js';
import { extractAllFields } from '../../../transformations.js';
import { fetchWithCorsProxy } from '../../../utils/cors-proxy.js';
import { extractPropertyValueDetails } from '../../../reconciliation/core/reconciliation-data.js';

/**
 * Search Wikidata items using the wbsearchentities API
 */
async function searchWikidataItems(query, resultsContainer) {
    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }
    
    resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
    
    try {
        const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*&type=item&limit=10`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.search || data.search.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No items found</div>';
            return;
        }
        
        // Clear loading message
        resultsContainer.innerHTML = '';
        
        // Display results
        data.search.forEach(item => {
            const resultItem = createElement('div', {
                className: 'wikidata-search-result-item',
                onClick: () => insertWikidataItemReference(item)
            });
            
            const itemLabel = createElement('div', {
                className: 'item-label'
            }, `${item.label} (${item.id})`);
            
            const itemDescription = createElement('div', {
                className: 'item-description'
            }, item.description || 'No description available');
            
            resultItem.appendChild(itemLabel);
            resultItem.appendChild(itemDescription);
            resultsContainer.appendChild(resultItem);
        });
        
    } catch (error) {
        console.error('Error searching Wikidata items:', error);
        resultsContainer.innerHTML = `<div class="search-error">Search failed: ${error.message}</div>`;
    }
}

/**
 * Insert a Wikidata item reference into the compose pattern
 */
function insertWikidataItemReference(item) {
    // Find the compose pattern textarea and insert the Q-ID
    const patternInput = document.querySelector('.pattern-input');
    if (patternInput) {
        const currentPattern = patternInput.value;
        const qidReference = `{{wikidata:${item.id}}}`;
        
        // Insert at cursor position if possible, otherwise append
        if (patternInput.selectionStart !== undefined) {
            const start = patternInput.selectionStart;
            const end = patternInput.selectionEnd;
            patternInput.value = currentPattern.substring(0, start) + qidReference + currentPattern.substring(end);
            patternInput.selectionStart = patternInput.selectionEnd = start + qidReference.length;
        } else {
            patternInput.value = currentPattern + qidReference;
        }
        
        // Trigger input event to update the pattern
        patternInput.dispatchEvent(new Event('input', { bubbles: true }));
        patternInput.focus();
    }
    
    // Show a success message
    showMessage(`Added ${item.label} (${item.id}) to pattern`, 'success', 2000);
}

const GUIDED_PROPERTY_CONFIG = Object.freeze({
    label: {
        title: 'Set Label',
        property: {
            id: 'label',
            label: 'Labels',
            description: 'Main name for entities',
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text',
            isMetadata: true,
            helpUrl: 'https://www.wikidata.org/wiki/Help:Label'
        },
        guidance: 'Choose the imported Omeka S field that contains the main title or name for the record. This usually comes from a field named Title or Name.',
        searchPlaceholder: 'Search title or name fields...',
        selectionLabel: 'Source field for the Wikidata label',
        targetHeading: 'Wikidata Label',
        autoSuggestPattern: /(title|name|label)/i
    },
    description: {
        title: 'Add Description',
        property: {
            id: 'description',
            label: 'Descriptions',
            description: 'Short disambiguating phrases',
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text',
            isMetadata: true,
            helpUrl: 'https://www.wikidata.org/wiki/Help:Description'
        },
        guidance: 'Choose the imported Omeka S field that contains the short descriptive phrase you want to send to Wikidata.',
        searchPlaceholder: 'Search description fields...',
        selectionLabel: 'Source field for the Wikidata description',
        targetHeading: 'Wikidata Description',
        autoSuggestPattern: /(description|summary|abstract|note)/i
    },
    aliases: {
        title: 'Add Aliases',
        property: {
            id: 'aliases',
            label: 'Aliases',
            description: 'Alternative names',
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text',
            isMetadata: true,
            helpUrl: 'https://www.wikidata.org/wiki/Help:Aliases'
        },
        guidance: 'Choose the imported Omeka S field that contains alternative names or variant titles for the record.',
        searchPlaceholder: 'Search alias or variant-title fields...',
        selectionLabel: 'Source field for Wikidata aliases',
        targetHeading: 'Wikidata Aliases',
        autoSuggestPattern: /(alias|variant|alternative|other title)/i
    },
    instance_of: {
        title: 'Set Instance of',
        property: {
            id: 'P31',
            label: 'instance of',
            description: 'that class of which this subject is a particular example',
            datatype: 'wikibase-item',
            datatypeLabel: 'Item',
            url: 'https://www.wikidata.org/wiki/Property:P31'
        },
        guidance: 'Use the Omeka S resource template class as the source for what kind of object these records describe. This value will be reconciled in the next step.',
        searchPlaceholder: 'Search type or class fields...',
        selectionLabel: 'Detected type source',
        targetHeading: 'Wikidata Instance of',
        autoSuggestPattern: /(resource class|type|class|genre)/i
    }
});

function detectGuidedModalMode(keyData) {
    if (keyData?.modalMode && GUIDED_PROPERTY_CONFIG[keyData.modalMode]) {
        return keyData.modalMode;
    }

    const propertyId = keyData?.guidedProperty?.id || keyData?.property?.id || '';
    if (propertyId === 'P31') {
        return 'instance_of';
    }
    if (propertyId === 'label' || propertyId === 'description' || propertyId === 'aliases') {
        return propertyId;
    }

    return null;
}

function getGuidedPropertyForMode(mode) {
    return GUIDED_PROPERTY_CONFIG[mode]?.property || null;
}

function normalizeFetchedItems(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (data?.items && Array.isArray(data.items)) {
        return data.items;
    }

    return data ? [data] : [];
}

function isMediaLikeFieldKey(fieldKey) {
    if (!fieldKey) {
        return false;
    }

    const normalized = String(fieldKey).toLowerCase();
    return normalized === 'o:media'
        || normalized === 'thumbnail_display_urls'
        || normalized === 'dcterms:hasformat'
        || normalized.includes('iiif')
        || normalized.includes('thumbnail');
}

function buildSelectableFieldCandidates(currentState) {
    const candidatesByKey = new Map();
    const mappingCategories = [
        ...(currentState?.mappings?.nonLinkedKeys || []),
        ...(currentState?.mappings?.mappedKeys || []),
        ...(currentState?.mappings?.ignoredKeys || [])
    ];

    mappingCategories
        .filter(candidate => typeof candidate === 'object' && candidate?.key)
        .forEach(candidate => {
            if (candidate.isCustomProperty || candidate.key.startsWith('custom_')) {
                return;
            }
            if (!candidatesByKey.has(candidate.key)) {
                candidatesByKey.set(candidate.key, {
                    ...candidate,
                    mappingId: undefined
                });
            }
        });

    const selectedTemplateIds = new Set((currentState?.selectedTemplates || []).map(String));
    const templateDisplayLabelByTerm = new Map();
    const templateAlternateLabelByTerm = new Map();
    (currentState?.resourceTemplates || [])
        .filter(template => selectedTemplateIds.size === 0 || selectedTemplateIds.has(String(template?.['o:id'])))
        .forEach(template => {
            (template?.['o:resource_template_property'] || []).forEach(templateProperty => {
                const term = templateProperty?.['o:property']?.['o:term'];
                if (!term) {
                    return;
                }

                const alternateLabel = typeof templateProperty?.['o:alternate_label'] === 'string'
                    ? templateProperty['o:alternate_label'].trim()
                    : '';
                const propertyLabel = typeof templateProperty?.['o:property']?.['o:label'] === 'string'
                    ? templateProperty['o:property']['o:label'].trim()
                    : '';

                if (alternateLabel && !templateAlternateLabelByTerm.has(term)) {
                    templateAlternateLabelByTerm.set(term, alternateLabel);
                }
                if ((alternateLabel || propertyLabel) && !templateDisplayLabelByTerm.has(term)) {
                    templateDisplayLabelByTerm.set(term, alternateLabel || propertyLabel);
                }
            });
        });

    const items = normalizeFetchedItems(currentState?.fetchedData);
    const fallbackCandidatesByKey = new Map();
    items.forEach(item => {
        if (!item || typeof item !== 'object') {
            return;
        }

        Object.keys(item)
            .filter(key => !key.startsWith('@'))
            .forEach((key, index) => {
                if (key.startsWith('o:') || isMediaLikeFieldKey(key)) {
                    return;
                }

                const existing = fallbackCandidatesByKey.get(key) || {
                    key,
                    sampleValue: null,
                    frequency: 0,
                    totalItems: items.length || 1,
                    sortIndex: index,
                    fieldProfile: null,
                    templateDisplayLabel: templateDisplayLabelByTerm.get(key) || null,
                    templateAlternateLabel: templateAlternateLabelByTerm.get(key) || null,
                    mappingId: undefined
                };

                existing.frequency += 1;
                if (existing.sampleValue === null) {
                    existing.sampleValue = extractSampleValue(item[key]);
                }
                if (!existing.fieldProfile) {
                    existing.fieldProfile = buildObservedFieldProfile(item[key]);
                }
                if (existing.sortIndex === undefined || existing.sortIndex === null) {
                    existing.sortIndex = index;
                }

                fallbackCandidatesByKey.set(key, existing);
            });
    });

    fallbackCandidatesByKey.forEach((candidate, key) => {
        if (!candidatesByKey.has(key)) {
            candidatesByKey.set(key, candidate);
            return;
        }

        const existing = candidatesByKey.get(key);
        candidatesByKey.set(key, {
            ...candidate,
            ...existing,
            sampleValue: existing.sampleValue ?? candidate.sampleValue,
            frequency: existing.frequency ?? candidate.frequency,
            totalItems: existing.totalItems ?? candidate.totalItems,
            sortIndex: existing.sortIndex ?? candidate.sortIndex,
            fieldProfile: existing.fieldProfile || candidate.fieldProfile,
            templateDisplayLabel: existing.templateDisplayLabel || candidate.templateDisplayLabel,
            templateAlternateLabel: existing.templateAlternateLabel || candidate.templateAlternateLabel
        });
    });

    return Array.from(candidatesByKey.values())
        .filter(candidate => !candidate.key.startsWith('o:'))
        .filter(candidate => !isMediaLikeFieldKey(candidate.key));
}

function getResourceClassUri(resourceClassValue) {
    if (!resourceClassValue) {
        return null;
    }

    if (typeof resourceClassValue === 'string' && /^https?:\/\//i.test(resourceClassValue)) {
        return resourceClassValue;
    }

    if (resourceClassValue && typeof resourceClassValue === 'object') {
        const directUri = resourceClassValue['@id'] || resourceClassValue.id || null;
        if (typeof directUri === 'string' && directUri.trim()) {
            return directUri.trim();
        }
    }

    return null;
}

function mergeResourceClassCandidate(candidate, resourceClassData = null) {
    if (!candidate) {
        return null;
    }

    const mergedData = resourceClassData && typeof resourceClassData === 'object'
        ? resourceClassData
        : {};
    const resourceClassLabel = mergedData['o:label']
        || candidate.resourceClassLabel
        || mergedData.label
        || mergedData.display_title
        || mergedData['o:local_name']
        || null;
    const resourceClassTerm = mergedData['o:term']
        || candidate.resourceClassTerm
        || null;
    const resourceClassUri = getResourceClassUri(mergedData)
        || candidate.resourceClassUri
        || candidate.linkedDataUri
        || null;

    return {
        ...candidate,
        resourceClassLabel,
        resourceClassTerm,
        resourceClassUri,
        linkedDataUri: resourceClassUri,
        preferredSourceField: 'o:label',
        sampleValue: resourceClassLabel || candidate.sampleValue || 'No sample available',
        fieldProfile: buildObservedFieldProfile(mergedData && Object.keys(mergedData).length > 0 ? [mergedData] : [candidate]),
        resourceClassData: Object.keys(mergedData).length > 0 ? mergedData : candidate.resourceClassData || null
    };
}

async function ensureResourceClassDefinition(candidate, stateInstance = window.mappingStepState) {
    if (!candidate || candidate.key !== 'o:resource_class') {
        return candidate;
    }

    const currentState = typeof stateInstance?.getState === 'function'
        ? stateInstance.getState()
        : null;
    const resourceClassUri = candidate.resourceClassUri || candidate.linkedDataUri || getResourceClassUri(candidate.resourceClassData);
    if (!resourceClassUri) {
        return mergeResourceClassCandidate(candidate);
    }

    const cachedData = currentState?.resourceClassCache?.[resourceClassUri];
    if (cachedData) {
        return mergeResourceClassCandidate(candidate, cachedData);
    }

    try {
        const result = await fetchWithCorsProxy(resourceClassUri, {
            headers: {
                Accept: 'application/json, application/ld+json'
            }
        });
        const resourceClassData = result?.data && typeof result.data === 'object'
            ? result.data
            : null;

        if (!resourceClassData) {
            return mergeResourceClassCandidate(candidate);
        }

        if (typeof stateInstance?.updateState === 'function') {
            const latestState = stateInstance.getState();
            stateInstance.updateState('resourceClassCache', {
                ...(latestState?.resourceClassCache || {}),
                [resourceClassUri]: resourceClassData
            }, false);
        }

        return mergeResourceClassCandidate(candidate, resourceClassData);
    } catch (error) {
        console.warn('Unable to fetch resource class details for guided instance-of modal:', error);
        return mergeResourceClassCandidate(candidate);
    }
}

function createResourceClassCandidate(currentState) {
    const selectedTemplateIds = new Set((currentState?.selectedTemplates || []).map(String));
    const selectedTemplates = (currentState?.resourceTemplates || []).filter(template =>
        selectedTemplateIds.has(String(template?.['o:id']))
    );

    const templateResourceClass = selectedTemplates
        .map(template => template?.['o:resource_class'])
        .find(Boolean);

    const items = normalizeFetchedItems(currentState?.fetchedData);
    const samples = items
        .map(item => item?.['o:resource_class'])
        .filter(Boolean);

    const sample = templateResourceClass || samples[0];
    if (!sample) {
        return null;
    }

    return mergeResourceClassCandidate({
        key: 'o:resource_class',
        type: 'guided',
        frequency: samples.length || selectedTemplates.length || 1,
        totalItems: items.length || samples.length || selectedTemplates.length || 1,
        sampleValue: sample?.['o:label']
            || sample?.label
            || sample?.display_title
            || sample?.['o:term']
            || sample?.['o:local_name']
            || sample?.['@value']
            || (typeof sample?.['@id'] === 'string' ? sample['@id'].split('/').pop() : null)
            || 'Resource class',
        templateDisplayLabel: 'Resource class',
        templateAlternateLabel: 'Resource class',
        fieldProfile: buildObservedFieldProfile(samples.length > 0 ? samples : [sample]),
        linkedDataUri: getResourceClassUri(sample),
        resourceClassUri: getResourceClassUri(sample),
        resourceClassLabel: sample?.['o:label'] || sample?.['o:local_name'] || null,
        resourceClassTerm: sample?.['o:term'] || null,
        preferredSourceField: 'o:label',
        resourceClassData: sample,
        sortIndex: -1
    }, sample);
}

function getFirstResolvedSampleDetail(candidate, stateInstance = window.mappingStepState) {
    if (!candidate || typeof stateInstance?.getState !== 'function') {
        return null;
    }

    const currentState = stateInstance.getState();
    const items = normalizeFetchedItems(currentState?.fetchedData);

    for (const item of items) {
        if (item?.[candidate.key] === undefined) {
            continue;
        }

        const resolvedDetails = extractPropertyValueDetails(item, candidate, stateInstance);
        const firstDetail = resolvedDetails.find(detail => detail?.value);
        if (firstDetail) {
            return firstDetail;
        }
    }

    return null;
}

function createGuidedPreviewRow(label, value, modifier = '') {
    const row = createElement('div', {
        className: `guided-field-selector__preview-row${modifier ? ` ${modifier}` : ''}`
    });
    const labelElement = createElement('span', {
        className: 'guided-field-selector__preview-label'
    }, `${label}:`);
    const valueElement = createElement('span', {
        className: 'guided-field-selector__preview-value'
    }, value || 'No sample available');
    row.appendChild(labelElement);
    row.appendChild(valueElement);
    return row;
}

function createManualInstanceSelection(manualText = '', selectedProperty = null) {
    const trimmedText = typeof manualText === 'string' ? manualText.trim() : '';

    return {
        key: 'o:resource_class',
        type: 'guided',
        templateDisplayLabel: 'Manual instance-of text',
        templateAlternateLabel: 'Manual instance-of text',
        sampleValue: trimmedText || 'No sample available',
        preferredSourceField: null,
        selectedAtField: null,
        guidedSourceMode: 'manual_text',
        guidedManualText: trimmedText,
        property: selectedProperty,
        mappingId: undefined
    };
}

function getObservedSegmentOptions(items, keyData, state) {
    const analysisKeyData = {
        ...keyData,
        includedSegments: undefined,
        includedSegmentLabels: undefined,
        segmentSignature: undefined,
        includedValueSources: undefined
    };

    const detailsByItem = items
        .filter(item => item?.[keyData.key] !== undefined)
        .map(item => extractPropertyValueDetails(item, analysisKeyData, state));

    return summarizeObservedSegments(detailsByItem);
}

function syncSelectedSegments(keyData, segmentOptions) {
    const availableKeys = new Set((segmentOptions || []).map(option => option.key));

    if (!Array.isArray(keyData.includedSegments) || keyData.includedSegments.length === 0) {
        keyData.includedSegments = [...availableKeys];
    } else {
        keyData.includedSegments = keyData.includedSegments.filter(segmentKey => availableKeys.has(segmentKey));
        if (keyData.includedSegments.length === 0 && availableKeys.size > 0) {
            keyData.includedSegments = [...availableKeys];
        }
    }

    keyData.includedSegmentLabels = (segmentOptions || [])
        .filter(option => keyData.includedSegments.includes(option.key))
        .map(option => option.label);
    keyData.segmentSignature = buildIncludedSegmentsSignature(keyData.includedSegments);
}

function updateSelectedSegmentsFromKeys(keyData, segmentOptions, selectedKeys = []) {
    keyData.includedSegments = [...selectedKeys];
    keyData.includedSegmentLabels = (segmentOptions || [])
        .filter(option => keyData.includedSegments.includes(option.key))
        .map(option => option.label);
    keyData.segmentSignature = buildIncludedSegmentsSignature(keyData.includedSegments);
}

function getSourceFieldSearchScore(candidate, searchTerm) {
    if (!searchTerm) {
        return 0;
    }

    const normalizedTerm = searchTerm.toLowerCase();
    const friendlyName = (getOmekaFieldFriendlyName(candidate, candidate.key) || '').toLowerCase();
    const keyName = (candidate.key || '').toLowerCase();

    if (friendlyName.startsWith(normalizedTerm)) return 0;
    if (friendlyName.includes(normalizedTerm)) return 1;
    if (keyName.startsWith(normalizedTerm)) return 2;
    if (keyName.includes(normalizedTerm)) return 3;
    return Number.POSITIVE_INFINITY;
}

function getDefaultGuidedCandidate(candidates, mode, currentKey = '') {
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return null;
    }

    if (currentKey) {
        const currentMatch = candidates.find(candidate => candidate.key === currentKey);
        if (currentMatch) {
            return currentMatch;
        }
    }

    const pattern = GUIDED_PROPERTY_CONFIG[mode]?.autoSuggestPattern;
    if (pattern) {
        const suggested = candidates.find(candidate => {
            const friendlyName = getOmekaFieldFriendlyName(candidate, candidate.key);
            return pattern.test(friendlyName) || pattern.test(candidate.key);
        });
        if (suggested) {
            return suggested;
        }
    }

    return candidates[0];
}

function buildGuidedFieldCandidates(currentState, mode) {
    const selectableCandidates = buildSelectableFieldCandidates(currentState);

    if (mode === 'instance_of') {
        const resourceClassCandidate = createResourceClassCandidate(currentState);
        if (resourceClassCandidate) {
            return [resourceClassCandidate, ...selectableCandidates.filter(candidate => candidate.key !== 'o:resource_class')];
        }
    }

    return selectableCandidates;
}

function createGuidedSourceFieldSelector(keyData, mode, selectedProperty) {
    const currentState = window.mappingStepState?.getState();
    const fieldCandidates = buildGuidedFieldCandidates(currentState, mode);
    const guidedConfig = GUIDED_PROPERTY_CONFIG[mode];
    const wrapper = createElement('div', {
        className: 'guided-field-selector'
    });

    wrapper.appendChild(createElement('h4', {}, guidedConfig.selectionLabel));
    wrapper.appendChild(createElement('p', {
        className: 'field-override-help'
    }, 'Media and IIIF-related fields are hidden here so you can focus on values you genuinely want to send to Wikidata.'));

    const samplePreview = createElement('div', {
        className: 'guided-field-selector__preview'
    });

    const setGuidedSelection = (selection) => {
        window.currentMappingGuidedSelection = selection
            ? {
                ...selection,
                property: selectedProperty,
                mappingId: undefined
            }
            : null;
    };

    const updatePreview = async (selectedCandidate) => {
        if (!selectedCandidate) {
            samplePreview.textContent = 'No source field selected yet.';
            return;
        }

        samplePreview.textContent = 'Loading sample preview...';

        if (selectedCandidate.guidedSourceMode === 'manual_text') {
            setGuidedSelection(selectedCandidate);
            samplePreview.innerHTML = '';
            samplePreview.appendChild(createGuidedPreviewRow('Selected source', 'Manual instance-of text'));
            samplePreview.appendChild(createGuidedPreviewRow(
                'Sample value used for reconciliation',
                selectedCandidate.guidedManualText || 'No sample available',
                'guided-field-selector__preview-row--stacked'
            ));
            return;
        }

        const enrichedCandidate = mode === 'instance_of'
            ? await ensureResourceClassDefinition(selectedCandidate)
            : selectedCandidate;

        setGuidedSelection(enrichedCandidate);

        const friendlyName = getOmekaFieldFriendlyName(enrichedCandidate, enrichedCandidate.key) || enrichedCandidate.key;
        const keyLine = friendlyName && friendlyName !== enrichedCandidate.key
            ? `${friendlyName} (${enrichedCandidate.key})`
            : enrichedCandidate.key;
        const sampleDetail = getFirstResolvedSampleDetail({
            ...enrichedCandidate,
            property: selectedProperty,
            selectedAtField: enrichedCandidate.selectedAtField || enrichedCandidate.preferredSourceField
        });

        samplePreview.innerHTML = '';
        samplePreview.appendChild(createGuidedPreviewRow('Selected source', keyLine));

        if (mode === 'instance_of') {
            samplePreview.appendChild(createGuidedPreviewRow('Label', enrichedCandidate.resourceClassLabel || 'No class label available'));
            samplePreview.appendChild(createGuidedPreviewRow('Term', enrichedCandidate.resourceClassTerm || 'No class term available'));
            samplePreview.appendChild(createGuidedPreviewRow(
                'Sample value used for reconciliation',
                sampleDetail?.value || enrichedCandidate.resourceClassLabel || enrichedCandidate.sampleValue || 'No sample available',
                'guided-field-selector__preview-row--stacked'
            ));
            return;
        }

        samplePreview.appendChild(createGuidedPreviewRow(
            'Sample value',
            sampleDetail?.value || enrichedCandidate.sampleValue || 'No sample available'
        ));
    };

    if (mode === 'instance_of') {
        const modeFieldset = createElement('div', {
            className: 'guided-instance-mode'
        });
        modeFieldset.appendChild(createElement('div', {
            className: 'guided-instance-mode__title'
        }, 'Choose how to define Instance of'));

        let activeMode = keyData.guidedSourceMode === 'manual_text' ? 'manual_text' : 'resource_class';
        const modeOptions = createElement('div', {
            className: 'guided-instance-mode__options'
        });
        const radioGroupName = `guided-instance-mode-${Date.now()}`;
        const automaticModeId = `guided-instance-mode-automatic-${Date.now()}`;
        const manualModeId = `guided-instance-mode-manual-${Date.now()}`;
        const automaticControls = createElement('div', {
            className: 'guided-instance-mode__panel'
        });
        const manualControls = createElement('div', {
            className: 'guided-instance-mode__panel'
        });
        const manualInput = createElement('textarea', {
            className: 'guided-instance-mode__textarea',
            rows: 3,
            placeholder: 'Example: Manuscript'
        });
        manualInput.value = keyData.guidedManualText || '';

        [
            {
                id: automaticModeId,
                value: 'resource_class',
                label: 'Use the Omeka resource class'
            },
            {
                id: manualModeId,
                value: 'manual_text',
                label: 'Enter instance-of text manually'
            }
        ].forEach(option => {
            const label = createElement('label', {
                className: 'guided-instance-mode__option'
            });
            label.appendChild(createElement('input', {
                type: 'radio',
                name: radioGroupName,
                id: option.id,
                value: option.value,
                checked: activeMode === option.value,
                onChange: () => {
                    activeMode = option.value;
                    renderActiveMode();
                }
            }));
            label.appendChild(createElement('span', {}, option.label));
            modeOptions.appendChild(label);
        });

        modeFieldset.appendChild(modeOptions);
        wrapper.appendChild(modeFieldset);

        const searchInput = createElement('input', {
            type: 'text',
            className: 'field-search-input',
            placeholder: guidedConfig.searchPlaceholder
        });
        automaticControls.appendChild(searchInput);

        const select = createElement('select', {
            className: 'field-selector guided-field-selector__select'
        });
        automaticControls.appendChild(select);

        manualControls.appendChild(createElement('label', {
            className: 'guided-instance-mode__manual-label'
        }, 'Instance-of text to reconcile'));
        manualControls.appendChild(createElement('p', {
            className: 'field-override-help'
        }, 'Use this when the Omeka class is missing or when you want to reconcile a different class label against Wikidata.'));
        manualControls.appendChild(manualInput);

        wrapper.appendChild(automaticControls);
        wrapper.appendChild(manualControls);
        wrapper.appendChild(samplePreview);

        const renderOptions = () => {
            const searchTerm = searchInput.value.trim();
            const rankedCandidates = fieldCandidates
                .map(candidate => ({ candidate, score: getSourceFieldSearchScore(candidate, searchTerm) }))
                .filter(result => !searchTerm || Number.isFinite(result.score))
                .sort((left, right) => {
                    if (left.score !== right.score) {
                        return left.score - right.score;
                    }
                    const leftIndex = left.candidate.sortIndex ?? Number.MAX_SAFE_INTEGER;
                    const rightIndex = right.candidate.sortIndex ?? Number.MAX_SAFE_INTEGER;
                    if (leftIndex !== rightIndex) {
                        return leftIndex - rightIndex;
                    }
                    return (getOmekaFieldFriendlyName(left.candidate, left.candidate.key) || left.candidate.key)
                        .localeCompare(getOmekaFieldFriendlyName(right.candidate, right.candidate.key) || right.candidate.key);
                })
                .map(result => result.candidate);

            select.innerHTML = '';

            if (rankedCandidates.length === 0) {
                select.appendChild(createElement('option', {
                    value: ''
                }, 'No matching fields found'));
                select.disabled = true;
                if (activeMode === 'resource_class') {
                    samplePreview.textContent = 'No matching source fields found for this search.';
                    setGuidedSelection(null);
                }
                return;
            }

            select.disabled = false;
            rankedCandidates.forEach(candidate => {
                const friendlyName = getOmekaFieldFriendlyName(candidate, candidate.key);
                const optionText = friendlyName && friendlyName !== candidate.key
                    ? `${friendlyName} (${candidate.key})`
                    : candidate.key;

                select.appendChild(createElement('option', {
                    value: candidate.key,
                    selected: false
                }, optionText));
            });

            const defaultCandidate = getDefaultGuidedCandidate(rankedCandidates, mode, keyData.key);
            if (defaultCandidate) {
                select.value = defaultCandidate.key;
                if (activeMode === 'resource_class') {
                    setGuidedSelection(defaultCandidate);
                    void updatePreview(defaultCandidate);
                }
            }
        };

        const renderActiveMode = () => {
            automaticControls.style.display = activeMode === 'resource_class' ? '' : 'none';
            manualControls.style.display = activeMode === 'manual_text' ? '' : 'none';

            if (activeMode === 'manual_text') {
                const manualSelection = createManualInstanceSelection(manualInput.value, selectedProperty);
                setGuidedSelection(manualSelection);
                void updatePreview(manualSelection);
            } else {
                const selectedCandidate = fieldCandidates.find(candidate => candidate.key === select.value)
                    || getDefaultGuidedCandidate(fieldCandidates, mode, keyData.key);
                setGuidedSelection(selectedCandidate);
                void updatePreview(selectedCandidate);
            }
        };

        searchInput.addEventListener('input', renderOptions);
        select.addEventListener('change', () => {
            if (activeMode !== 'resource_class') {
                return;
            }

            const selectedCandidate = fieldCandidates.find(candidate => candidate.key === select.value) || null;
            setGuidedSelection(selectedCandidate);
            void updatePreview(selectedCandidate);
            if (selectedCandidate) {
                updateModalTitle(selectedProperty);
            }
        });
        manualInput.addEventListener('input', () => {
            if (activeMode !== 'manual_text') {
                return;
            }
            const manualSelection = createManualInstanceSelection(manualInput.value, selectedProperty);
            setGuidedSelection(manualSelection);
            void updatePreview(manualSelection);
        });

        renderOptions();
        renderActiveMode();
        return wrapper;
    }

    const searchInput = createElement('input', {
        type: 'text',
        className: 'field-search-input',
        placeholder: guidedConfig.searchPlaceholder
    });
    wrapper.appendChild(searchInput);

    const select = createElement('select', {
        className: 'field-selector guided-field-selector__select'
    });
    wrapper.appendChild(select);
    wrapper.appendChild(samplePreview);

    const renderOptions = () => {
        const searchTerm = searchInput.value.trim();
        const rankedCandidates = fieldCandidates
            .map(candidate => ({ candidate, score: getSourceFieldSearchScore(candidate, searchTerm) }))
            .filter(result => !searchTerm || Number.isFinite(result.score))
            .sort((left, right) => {
                if (left.score !== right.score) {
                    return left.score - right.score;
                }
                const leftIndex = left.candidate.sortIndex ?? Number.MAX_SAFE_INTEGER;
                const rightIndex = right.candidate.sortIndex ?? Number.MAX_SAFE_INTEGER;
                if (leftIndex !== rightIndex) {
                    return leftIndex - rightIndex;
                }
                return (getOmekaFieldFriendlyName(left.candidate, left.candidate.key) || left.candidate.key)
                    .localeCompare(getOmekaFieldFriendlyName(right.candidate, right.candidate.key) || right.candidate.key);
            })
            .map(result => result.candidate);

        select.innerHTML = '';

        if (rankedCandidates.length === 0) {
            select.appendChild(createElement('option', {
                value: ''
            }, 'No matching fields found'));
            select.disabled = true;
            samplePreview.textContent = 'No matching source fields found for this search.';
            setGuidedSelection(null);
            return;
        }

        select.disabled = false;
        rankedCandidates.forEach(candidate => {
            const friendlyName = getOmekaFieldFriendlyName(candidate, candidate.key);
            const optionText = friendlyName && friendlyName !== candidate.key
                ? `${friendlyName} (${candidate.key})`
                : candidate.key;

            select.appendChild(createElement('option', {
                value: candidate.key,
                selected: false
            }, optionText));
        });

        const defaultCandidate = getDefaultGuidedCandidate(rankedCandidates, mode, window.currentMappingGuidedSelection?.key || keyData.key);
        if (defaultCandidate) {
            select.value = defaultCandidate.key;
            setGuidedSelection(defaultCandidate);
            void updatePreview(defaultCandidate);
        }
    };

    searchInput.addEventListener('input', renderOptions);
    select.addEventListener('change', () => {
        const selectedCandidate = fieldCandidates.find(candidate => candidate.key === select.value) || null;
        setGuidedSelection(selectedCandidate);
        void updatePreview(selectedCandidate);
        if (selectedCandidate) {
            updateModalTitle(selectedProperty);
        }
    });

    renderOptions();
    return wrapper;
}

function createGuidedMappingModalContent(keyData, mode) {
    const guidedConfig = GUIDED_PROPERTY_CONFIG[mode];
    const selectedProperty = keyData.guidedProperty || keyData.property || getGuidedPropertyForMode(mode);
    window.currentMappingSelectedProperty = selectedProperty;

    const container = createElement('div', {
        className: 'mapping-modal-content two-column-layout guided-mapping-modal'
    });

    const leftColumn = createElement('div', {
        className: 'mapping-column left-column'
    });
    leftColumn.appendChild(createElement('div', {
        className: 'column-header'
    }, 'Choose Omeka S Source'));
    leftColumn.appendChild(createElement('div', {
        className: 'metadata-info'
    }, guidedConfig.guidance));
    leftColumn.appendChild(createGuidedSourceFieldSelector(keyData, mode, selectedProperty));

    const rightColumn = createElement('div', {
        className: 'mapping-column right-column'
    });
    rightColumn.appendChild(createElement('div', {
        className: 'column-header'
    }, guidedConfig.targetHeading));

    const propertyInfo = createElement('div', {
        className: 'property-info guided-target-card'
    });
    propertyInfo.appendChild(createElement('h3', {}, `${selectedProperty.label}${selectedProperty.id ? ` (${selectedProperty.id})` : ''}`));
    propertyInfo.appendChild(createElement('p', {}, selectedProperty.description));
    propertyInfo.appendChild(createElement('div', {
        className: 'metadata-notice'
    }, mode === 'instance_of'
        ? 'The Omeka S resource template class is treated as the source value for what each item is. You will confirm the matching Wikidata item during Reconciliation.'
        : 'Pick the imported Omeka S field that already contains the value you genuinely want to send to Wikidata.'));
    if (selectedProperty.helpUrl || selectedProperty.url) {
        propertyInfo.appendChild(createElement('a', {
            href: selectedProperty.helpUrl || selectedProperty.url,
            target: '_blank',
            rel: 'noopener'
        }, `Learn more about ${selectedProperty.label} →`));
    }
    rightColumn.appendChild(propertyInfo);

    const datatypeInfo = createElement('div', {
        className: 'datatype-info',
        id: 'datatype-info-section'
    });
    datatypeInfo.innerHTML = `
        <div class="datatype-display">
            <h4>Expected Value Type</h4>
            <div id="detected-datatype" class="detected-datatype">
                <span class="datatype-label">${selectedProperty.datatypeLabel}</span>
            </div>
        </div>
    `;
    rightColumn.appendChild(datatypeInfo);

    container.appendChild(leftColumn);
    container.appendChild(rightColumn);
    updateModalTitle(selectedProperty);
    return container;
}

function buildGuidedKeyData(baseKeyData, selectedProperty) {
    const selectedCandidate = window.currentMappingGuidedSelection;
    if (!selectedCandidate) {
        return null;
    }

    const isManualInstanceText = selectedCandidate.guidedSourceMode === 'manual_text';

    return {
        ...selectedCandidate,
        property: selectedProperty,
        mappingId: baseKeyData.mappingId,
        isMetadata: Boolean(selectedProperty?.isMetadata),
        modalMode: detectGuidedModalMode(baseKeyData),
        guidedSourceMode: isManualInstanceText ? 'manual_text' : 'resource_class',
        guidedManualText: isManualInstanceText ? selectedCandidate.guidedManualText || null : null,
        selectedAtField: isManualInstanceText
            ? null
            : baseKeyData.selectedAtField
                || selectedCandidate.selectedAtField
                || (selectedProperty?.id === 'P31' && selectedCandidate.key === 'o:resource_class'
                ? (selectedCandidate.preferredSourceField || 'o:label')
                : undefined),
        extractionMode: isManualInstanceText ? undefined : selectedCandidate.extractionMode || 'auto',
        includedValueSources: isManualInstanceText
            ? undefined
            : Array.isArray(selectedCandidate.includedValueSources)
            ? [...selectedCandidate.includedValueSources]
            : selectedCandidate.fieldProfile?.valueSourceTypes
                ? [...selectedCandidate.fieldProfile.valueSourceTypes]
                : undefined
    };
}

/**
 * Handle selection of metadata field (Labels, Descriptions, Aliases)
 */
function selectMetadataField(metadataOption) {
    // Clear any existing property selection
    const searchInput = document.getElementById('property-search-input');
    if (searchInput) searchInput.value = '';
    
    const suggestions = document.getElementById('property-suggestions');
    if (suggestions) suggestions.innerHTML = '';
    
    // Remove selected class from all buttons
    document.querySelectorAll('.metadata-select-button').forEach(btn => {
        btn.classList.remove('selected');
        btn.style.borderColor = '#ddd';
        btn.style.background = 'white';
    });
    
    // Add selected class to clicked button
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
        event.currentTarget.style.borderColor = '#3366cc';
        event.currentTarget.style.background = '#e6f0ff';
    }
    
    // Create metadata property object
    const metadataProperty = {
        id: metadataOption.id,
        label: metadataOption.label,
        description: metadataOption.description,
        datatype: 'monolingualtext',
        datatypeLabel: 'Monolingual text',
        isMetadata: true,
        helpUrl: metadataOption.helpUrl
    };
    
    // Store as selected property
    window.currentMappingSelectedProperty = metadataProperty;
    
    // Update the selected property display
    const selectedSection = document.getElementById('selected-property');
    const selectedDetails = document.getElementById('selected-property-details');
    
    if (selectedSection && selectedDetails) {
        selectedSection.style.display = 'block';
        selectedDetails.innerHTML = `
            <div class="property-info metadata-property-info">
                <h3>${metadataOption.icon} ${metadataProperty.label}</h3>
                <p class="property-id">Metadata Field</p>
                <p>${metadataProperty.description}</p>
                <a href="${metadataOption.helpUrl}" target="_blank" rel="noopener">
                    Learn more about ${metadataProperty.label} →
                </a>
                <div class="metadata-notice" style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                    <strong>Note:</strong> This is a metadata field for Wikidata entities. 
                    Values will be treated as language-specific text.
                </div>
            </div>
        `;
    }
    
    // Update datatype display
    const datatypeDisplay = document.getElementById('detected-datatype');
    if (datatypeDisplay) {
        datatypeDisplay.innerHTML = `
            <span class="datatype-label">Monolingual text</span>
        `;
    }
    
    // Show datatype section
    const datatypeSection = document.getElementById('datatype-info-section');
    if (datatypeSection) {
        datatypeSection.style.display = 'block';
    }

    window.updateMappingExtractionUI?.(metadataProperty);
}

/**
 * Opens the mapping modal for a key
 */
export function openMappingModal(keyData) {
    // Store keyData globally for modal title updates
    window.currentMappingKeyData = keyData;
    const guidedMode = detectGuidedModalMode(keyData);
    window.currentMappingSelectedProperty = keyData.guidedProperty || keyData.property || getGuidedPropertyForMode(guidedMode) || null;
    window.currentMappingGuidedSelection = null;
    
    // Extract fields once for the entire modal session to optimize performance
    if (keyData && keyData.sampleValue && window.mappingStepState) {
        const currentState = window.mappingStepState.getState();
        
        if (currentState.fetchedData) {
            const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
            
            // Use first item that has any meaningful data (not looking for specific key)
            let fullItemData = items.find(item => {
                return typeof item === 'object' && item !== null && Object.keys(item).length > 0;
            });
            
            if (fullItemData) {
                keyData.extractedFields = extractAllFields(fullItemData);
            }
        }
    }
    
    // Import modal functionality
    import('../../../ui/modal-ui.js').then(({ setupModalUI }) => {
        const modalUI = setupModalUI();
        
        // Create modal content
        const modalContent = createMappingModalContent(keyData);
        
        // Create buttons based on whether this is a custom property or not
        const isCustomProperty = !keyData.key || 
                                keyData.key.trim() === '' || 
                                keyData.key.startsWith('custom_') || 
                                keyData.isCustomProperty === true;
        const saveGuidedMapping = (closeAfterSave = true) => {
            const selectedProperty = getSelectedPropertyFromModal();
            if (!selectedProperty) {
                showMessage('Please choose the Wikidata target for this mapping.', 'warning', 3000);
                return false;
            }

            const guidedKeyData = buildGuidedKeyData(keyData, selectedProperty);
            if (!guidedKeyData) {
                showMessage('Please choose an Omeka S source field first.', 'warning', 3000);
                return false;
            }
            if (guidedKeyData.guidedSourceMode === 'manual_text' && !guidedKeyData.guidedManualText) {
                showMessage('Enter the instance-of text you want to reconcile before saving.', 'warning', 3000);
                return false;
            }

            const mappingSucceeded = mapKeyToProperty(guidedKeyData, selectedProperty, window.mappingStepState);
            if (!mappingSucceeded) {
                return false;
            }

            if (closeAfterSave) {
                modalUI.closeModal();
            }
            return true;
        };

        const buttons = isCustomProperty ? (guidedMode ? [
            {
                text: 'Cancel',
                type: 'secondary',
                keyboardShortcut: 'Escape',
                callback: () => {
                    modalUI.closeModal();
                }
            },
            {
                text: 'Confirm',
                type: 'primary',
                keyboardShortcut: 'Enter',
                callback: () => {
                    saveGuidedMapping(true);
                }
            }
        ] : [
            // For custom properties, show simpler button set
            {
                text: 'Cancel',
                type: 'secondary',
                keyboardShortcut: 'Escape',
                callback: () => {
                    modalUI.closeModal();
                }
            },
            {
                text: keyData.key && keyData.key.startsWith('custom_') ? 'Update Property' : 'Add Property',
                type: 'primary',
                keyboardShortcut: 'Enter',
                callback: () => {
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        
                        // For custom properties, create or update the key data
                        const customKeyData = {
                            ...keyData,
                            key: keyData.key || `custom_${selectedProperty.id}`,
                            type: 'custom',
                            frequency: keyData.frequency || 1,
                            totalItems: keyData.totalItems || 1,
                            isCustomProperty: true,
                            isMetadata: selectedProperty.isMetadata || false
                        };
                        
                        
                        // Transfer compose transformation data from current mappingId to final mappingId if needed
                        const finalMappingId = window.mappingStepState.generateMappingId(
                            customKeyData.key,
                            selectedProperty.id,
                            customKeyData.selectedAtField,
                            customKeyData.selectedObjectIndex
                        );
                        const composeSection = document.querySelector('.compose-section');
                        const currentMappingId = composeSection?.dataset?.mappingId;
                        
                        
                        if (currentMappingId && currentMappingId !== finalMappingId) {
                            const currentState = window.mappingStepState.getState();
                            const currentBlocks = currentState.mappings?.transformationBlocks?.[currentMappingId] || [];
                            
                            
                            // Transfer transformation blocks from current to final mappingId
                            currentBlocks.forEach(block => {
                                window.mappingStepState.addTransformationBlock(finalMappingId, block);
                            });
                            
                            // Clean up current mappingId if it was temporary
                            if (currentMappingId.startsWith('temp_') && currentState.mappings?.transformationBlocks) {
                                delete currentState.mappings.transformationBlocks[currentMappingId];
                            }
                        }
                        
                        
                        const mappingSucceeded = mapKeyToProperty(customKeyData, selectedProperty, window.mappingStepState);
                        if (!mappingSucceeded) {
                            return;
                        }
                        
                        // Check final state
                        const finalState = window.mappingStepState.getState();
                        
                        modalUI.closeModal();
                        showMessage(keyData.key ? 'Custom property updated successfully' : 'Custom property added successfully', 'success', 3000);
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            }
        ]) : (guidedMode ? [
            {
                text: 'Cancel',
                type: 'secondary',
                keyboardShortcut: 'Escape',
                callback: () => {
                    modalUI.closeModal();
                }
            },
            {
                text: 'Confirm',
                type: 'primary',
                keyboardShortcut: 'Enter',
                callback: () => {
                    saveGuidedMapping(true);
                }
            }
        ] : [
            {
                text: 'Ignore',
                type: 'secondary',
                keyboardShortcut: 'i',
                callback: () => {
                    moveKeyToCategory(keyData, 'ignored', window.mappingStepState);
                    modalUI.closeModal();
                }
            },
            {
                text: 'Ignore and Next',
                type: 'secondary',
                keyboardShortcut: 'x',
                callback: () => {
                    moveKeyToCategory(keyData, 'ignored', window.mappingStepState);
                    modalUI.closeModal();
                    moveToNextUnmappedKey(window.mappingStepState);
                }
            },
            {
                text: 'Confirm',
                type: 'secondary',
                keyboardShortcut: 'c',
                callback: () => {
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        const mappingSucceeded = mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        if (!mappingSucceeded) {
                            return;
                        }
                        modalUI.closeModal();
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            },
            {
                text: 'Confirm and Duplicate',
                type: 'secondary',
                keyboardShortcut: 'd',
                callback: () => {
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        // Save the current mapping
                        const mappingSucceeded = mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        if (!mappingSucceeded) {
                            return;
                        }
                        modalUI.closeModal();
                        
                        // Open a new modal for the same key with reset configuration
                        setTimeout(() => {
                            // Create a fresh keyData object for the duplicate
                            const duplicateKeyData = {
                                ...keyData,
                                selectedAtField: undefined,  // Reset @ field selection
                                selectedObjectIndex: undefined,
                                selectedTransformationField: undefined,  // Reset transformation
                                isDuplicate: true  // Mark as duplicate
                            };
                            openMappingModal(duplicateKeyData);
                        }, 100);
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            },
            {
                text: 'Confirm and Next',
                type: 'primary',
                keyboardShortcut: 'n',
                callback: () => {
                    const selectedProperty = getSelectedPropertyFromModal();
                    if (selectedProperty) {
                        const mappingSucceeded = mapKeyToProperty(keyData, selectedProperty, window.mappingStepState);
                        if (!mappingSucceeded) {
                            return;
                        }
                        modalUI.closeModal();
                        moveToNextUnmappedKey(window.mappingStepState);
                    } else {
                        showMessage('Please select a Wikidata property first.', 'warning', 3000);
                    }
                }
            }
        ]);
        
        // Open modal with mapping relationship header
        const modalTitle = guidedMode
            ? GUIDED_PROPERTY_CONFIG[guidedMode]?.title || 'Select Value'
            : isCustomProperty
                ? 'Select Value'
                : createMappingRelationshipTitle(keyData.key, null);
        modalUI.openModal(
            modalTitle,
            modalContent,
            buttons,
            () => {
                // Remove the wide class when modal closes
                const modal = document.querySelector('.modal');
                if (modal) {
                    modal.classList.remove('mapping-modal-wide');
                }
                window.updateMappingExtractionUI = null;
                window.refreshMappingSamples = null;
                window.currentMappingSelectedProperty = null;
                window.currentMappingGuidedSelection = null;
            }
        );
        
        // Add class to modal for wider display after opening
        setTimeout(() => {
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.classList.add('mapping-modal-wide');
            }
        }, 0);
    });
}

/**
 * Creates mapping modal content with two-column layout
 */
export function createMappingModalContent(keyData) {
    const guidedMode = detectGuidedModalMode(keyData);
    if (guidedMode) {
        return createGuidedMappingModalContent(keyData, guidedMode);
    }

    // Check if this is a metadata property (labels, descriptions, aliases)
    const isMetadata = keyData.isMetadata || ['label', 'description', 'aliases'].includes(keyData.key?.toLowerCase());
    
    // Check if this is a custom property (empty key OR custom key from previous saves)
    const isCustomProperty = !keyData.key || 
                            keyData.key.trim() === '' || 
                            keyData.key.startsWith('custom_') || 
                            keyData.isCustomProperty === true;
    const useThreeColumnLayout = !isMetadata && !isCustomProperty;
    
    const container = createElement('div', {
        className: `mapping-modal-content ${useThreeColumnLayout ? 'three-column-layout' : 'two-column-layout'}`
    });
    
    // Add duplicate notice if this is a duplicate mapping
    if (keyData.isDuplicate) {
        const duplicateNotice = createElement('div', {
            className: 'duplicate-notice'
        });
        duplicateNotice.innerHTML = `
            <div class="duplicate-notice-content">
                <strong>Creating duplicate mapping for:</strong> ${keyData.key}
                <p>Select a different segment family, source filter, @ field, or property to create an additional mapping for this key.</p>
            </div>
        `;
        container.appendChild(duplicateNotice);
    }
    
    // LEFT COLUMN - Samples for standard mappings, custom value content for manual mappings
    const leftColumn = createElement('div', {
        className: `mapping-column left-column${useThreeColumnLayout ? ' sample-column' : ''}`
    });
    const middleColumn = useThreeColumnLayout
        ? createElement('div', {
            className: 'mapping-column middle-column'
        })
        : null;
    
    if (isCustomProperty) {
        // For custom properties, rebrand as "Custom Value" section
        const leftHeader = createElement('div', {
            className: 'column-header'
        }, 'Custom Value');
        leftColumn.appendChild(leftHeader);
        
        // Compose transformation section
        const composeSection = createElement('div', {
            className: 'compose-section'
        });
        
        const composeHeader = createElement('h4', {}, 'Value Composition');
        composeSection.appendChild(composeHeader);
        
        const composeDescription = createElement('p', {
            className: 'compose-description'
        }, 'Create complex values by combining text and variables from your data fields.');
        composeSection.appendChild(composeDescription);
        
        // Create or load existing transformation block for compose functionality
        let composeBlock;
        let existingPattern = null;
        
        // Check for existing transformation data in multiple locations
        if (window.mappingStepState) {
            const currentState = window.mappingStepState.getState();
            const possibleMappingIds = [];
            
            
            // Build list of possible mappingIds to check for existing patterns
            if (keyData.key && keyData.property) {
                // Final mappingId for saved custom properties
                const finalMappingId = window.mappingStepState.generateMappingId(
                    keyData.key,
                    keyData.property.id,
                    keyData.selectedAtField,
                    keyData.selectedObjectIndex
                );
                possibleMappingIds.push(finalMappingId);
            }
            if (keyData.key) {
                // Temporary mappingId for custom properties being edited
                const tempMappingId = `temp_${keyData.key}`;
                possibleMappingIds.push(tempMappingId);
            }
            // Always check the general temporary ID
            possibleMappingIds.push('temp_custom_property');
            
            
            // Look for existing compose blocks in any of these locations
            for (const mappingId of possibleMappingIds) {
                const existingBlocks = currentState.mappings?.transformationBlocks?.[mappingId] || [];
                const existingComposeBlock = existingBlocks.find(block => block.type === 'compose');
                
                
                if (existingComposeBlock && existingComposeBlock.config.pattern) {
                    // Use the existing block but ensure sourceData is updated
                    composeBlock = {
                        ...existingComposeBlock,
                        config: {
                            ...existingComposeBlock.config,
                            // Preserve pattern but update sourceData with latest data
                            sourceData: existingComposeBlock.config.sourceData || {}
                        }
                    };
                    existingPattern = existingComposeBlock.config.pattern;
                    break;
                }
            }
            
            if (!composeBlock) {
            }
        }
        
        // If no existing block found, create a new one with sourceData
        if (!composeBlock) {
            // Get source data from the current state
            let sourceData = {};
            if (window.mappingStepState) {
                const currentState = window.mappingStepState.getState();
                if (currentState.fetchedData) {
                    const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
                    sourceData = items.find(item => typeof item === 'object' && item !== null && Object.keys(item).length > 0) || {};
                }
            }
            
            composeBlock = {
                id: 'custom-compose',
                type: 'compose',
                config: {
                    pattern: existingPattern || '{{value}}', // Default to {{value}} instead of placeholder text
                    sourceData: sourceData // Include source data for field replacements
                }
            };
        }
        
        // Create mappingId for custom properties
        let mappingId;
        if (keyData.key && keyData.property) {
            // For existing custom properties with a selected property, use the real mappingId
            mappingId = window.mappingStepState.generateMappingId(
                keyData.key,
                keyData.property.id,
                keyData.selectedAtField,
                keyData.selectedObjectIndex
            );
        } else if (keyData.key) {
            // For existing custom properties without a property selected yet, use temp mappingId
            mappingId = `temp_${keyData.key}`;
        } else {
            // For completely new custom properties
            mappingId = 'temp_custom_property';
        }
        
        
        // Add the compose block to the transformation state if it's not already there
        const currentState = window.mappingStepState.getState();
        const existingBlocks = currentState.mappings?.transformationBlocks?.[mappingId] || [];
        const hasExistingComposeBlock = existingBlocks.find(block => block.id === composeBlock.id);
        
        
        if (!hasExistingComposeBlock) {
            window.mappingStepState.addTransformationBlock(mappingId, composeBlock);
            
            // Verify it was added
            const afterAddState = window.mappingStepState.getState();
            const afterAddBlocks = afterAddState.mappings?.transformationBlocks?.[mappingId];
        } else {
        }
        
        // Import the compose config UI
        import('../../core/transformation-engine.js').then(({ renderComposeConfigUI }) => {
            const composeUI = renderComposeConfigUI(mappingId, composeBlock, window.mappingStepState);
            composeSection.appendChild(composeUI);
            
            // Store the mappingId for later use
            composeSection.dataset.mappingId = mappingId;
        });
        
        leftColumn.appendChild(composeSection);
        
        // Wikidata Item Search section
        const itemSearchSection = createElement('div', {
            className: 'wikidata-item-search-section',
            style: 'margin-top: 20px;'
        });
        
        const itemSearchHeader = createElement('h4', {}, 'Wikidata Item Search');
        itemSearchSection.appendChild(itemSearchHeader);
        
        const itemSearchDescription = createElement('p', {
            className: 'search-description'
        }, 'Search for Wikidata items to use as values or references.');
        itemSearchSection.appendChild(itemSearchDescription);
        
        const itemSearchInput = createElement('input', {
            type: 'text',
            placeholder: 'Search Wikidata items (e.g., "Albert Einstein")...',
            className: 'wikidata-item-search-input',
            onInput: (e) => {
                if (e.target.value.trim().length > 2) {
                    searchWikidataItems(e.target.value.trim(), itemSearchResults);
                } else {
                    itemSearchResults.innerHTML = '';
                }
            }
        });
        itemSearchSection.appendChild(itemSearchInput);
        
        const itemSearchResults = createElement('div', {
            className: 'wikidata-item-search-results'
        });
        itemSearchSection.appendChild(itemSearchResults);
        
        leftColumn.appendChild(itemSearchSection);
    } else {
        if (useThreeColumnLayout) {
            delete keyData.extractionMode;
            delete keyData.selectedAtField;
            delete keyData.selectedObjectIndex;
        }

        const infoColumn = middleColumn || leftColumn;
        const leftHeader = createElement('div', {
            className: 'column-header'
        }, useThreeColumnLayout ? 'Sample Values' : 'Omeka S Data');
        leftColumn.appendChild(leftHeader);

        if (useThreeColumnLayout && middleColumn) {
            middleColumn.appendChild(createElement('div', {
                className: 'column-header'
            }, 'Omeka S Data'));
        }

        const keyInfo = createElement('div', {
            className: 'key-info'
        });
    
    const keyDisplay = keyData.linkedDataUri 
        ? `<a href="${keyData.linkedDataUri}" target="_blank" class="clickable-key">${keyData.key}</a>`
        : keyData.key;
    
    // Basic key info (always visible)
    const basicInfo = createElement('div', {});
    basicInfo.innerHTML = `
        <h4>Key Information</h4>
        <p><strong>Key:</strong> ${keyDisplay}</p>
        <p><strong>Frequency:</strong> ${keyData.frequency || 1} out of ${keyData.totalItems || 1} items</p>
    `;
    keyInfo.appendChild(basicInfo);
    
    const currentState = window.mappingStepState.getState();
    const items = currentState.fetchedData
        ? (Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData])
        : [];
    const propertyDatatype = () => window.currentMappingSelectedProperty?.datatype || keyData.property?.datatype || null;
    const segmentOptions = getObservedSegmentOptions(items, keyData, window.mappingStepState);
    keyData.segmentOptions = segmentOptions;
    syncSelectedSegments(keyData, segmentOptions);

    const fieldProfileSection = createElement('div', {
        className: 'field-profile-section'
    });
    const fieldProfileSummary = createElement('div', {
        className: 'field-profile-summary',
        id: `field-profile-summary-${keyData.key.replace(/[^a-zA-Z0-9]/g, '_')}`
    });
    fieldProfileSection.appendChild(fieldProfileSummary);
    keyInfo.appendChild(fieldProfileSection);

    const segmentSection = createElement('div', {
        className: 'segment-family-section'
    });
    const segmentTitle = createElement('div', {
        className: 'value-source-title'
    }, 'Observed segments in this field:');
    const segmentHelp = createElement('p', {
        className: 'field-override-help'
    }, 'Choose which value family from this Omeka S field should be used for this Wikidata property. One field can contain several families, including more than one literal family or more than one URI or authority family. You can map the same field again when another family should go to a different Wikidata property.');
    const segmentOptionsContainer = createElement('div', {
        className: 'segment-family-options'
    });
    segmentSection.appendChild(segmentTitle);
    segmentSection.appendChild(segmentHelp);
    segmentSection.appendChild(segmentOptionsContainer);

    const valueSourceSection = createElement('div', {
        className: 'value-source-section'
    });
    const valueSourceTitle = createElement('div', {
        className: 'value-source-title'
    }, 'Value sources to include:');
    const valueSourceHelp = createElement('p', {
        className: 'field-override-help'
    }, 'Choose which value-entry groups are allowed at all. Authority-linked and direct Wikidata-linked entries reconcile by readable label text, while standalone URL entries stay URL-valued segments.');
    const valueSourceOptions = createElement('div', {
        className: 'value-source-options'
    });
    valueSourceSection.appendChild(valueSourceTitle);
    valueSourceSection.appendChild(valueSourceHelp);
    valueSourceSection.appendChild(valueSourceOptions);

    const samplesSection = createElement('div', {
        className: useThreeColumnLayout ? 'samples-section samples-section--open' : 'samples-section'
    });
    const samplesHeading = createElement('h4', {
        className: 'samples-heading'
    }, 'What will be reconciled');
    const samplesHelp = createElement('p', {
        className: 'field-override-help'
    }, 'These sample values use the same source filters and extraction rules as Reconciliation.');
    const samplesContent = createElement('div', {
        className: useThreeColumnLayout ? 'samples-content samples-content--open' : 'samples-content'
    });
    samplesSection.appendChild(samplesHeading);
    samplesSection.appendChild(samplesHelp);
    samplesSection.appendChild(samplesContent);
    let lastAvailableSources = [];

    const getSegmentFilteredValueDetails = () => {
        const analysisKeyData = {
            ...keyData,
            includedValueSources: undefined
        };

        return items
            .filter(item => item?.[keyData.key] !== undefined)
            .map(item => extractPropertyValueDetails(item, analysisKeyData, window.mappingStepState))
            .filter(details => Array.isArray(details) && details.length > 0);
    };

    const renderSegmentOptions = () => {
        const currentSegmentOptions = getObservedSegmentOptions(items, keyData, window.mappingStepState);
        keyData.segmentOptions = currentSegmentOptions;
        syncSelectedSegments(keyData, currentSegmentOptions);
        segmentOptionsContainer.innerHTML = '';
        segmentSection.style.display = currentSegmentOptions.length > 1 ? '' : 'none';

        currentSegmentOptions.forEach(option => {
            const optionId = `segment-family-${keyData.key.replace(/[^a-zA-Z0-9]/g, '_')}-${option.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const optionLabel = createElement('label', {
                className: 'value-source-option segment-family-option',
                title: option.preview || option.label
            });
            const checkbox = createElement('input', {
                type: 'checkbox',
                id: optionId,
                checked: keyData.includedSegments.includes(option.key),
                onChange: (event) => {
                    const checkedSegments = Array.from(segmentOptionsContainer.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(input => input.value);

                    if (checkedSegments.length === 0) {
                        event.target.checked = true;
                        return;
                    }

                    updateSelectedSegmentsFromKeys(keyData, currentSegmentOptions, checkedSegments);
                    refreshExtractionUI({ restoreNewlyAvailableSources: true });
                }
            });
            checkbox.value = option.key;
            optionLabel.appendChild(checkbox);

            const optionText = createElement('div', {
                className: 'value-source-option__content'
            });
            optionText.appendChild(createElement('span', {}, option.label));
            optionText.appendChild(createElement('small', {}, `${option.valueCount || 0} values across ${option.itemCount || 0} items`));
            if (option.preview) {
                optionText.appendChild(createElement('small', {
                    className: 'segment-family-option__preview'
                }, `Example: ${option.preview}`));
            }

            optionLabel.appendChild(optionText);
            segmentOptionsContainer.appendChild(optionLabel);
        });
    };

    const refreshExtractionUI = ({ restoreNewlyAvailableSources = false } = {}) => {
        const profileDescription = describeFieldProfile(keyData.fieldProfile, propertyDatatype());
        fieldProfileSummary.textContent = profileDescription.summary;
        renderSegmentOptions();

        const segmentFilteredValueDetails = getSegmentFilteredValueDetails();
        const filteredSourceStats = summarizeValueSourcesForResolvedDetails(segmentFilteredValueDetails);
        const availableSources = getOrderedValueSourceTypes(
            Object.entries(filteredSourceStats)
                .filter(([, counts]) => (counts?.valueCount || 0) > 0)
                .map(([sourceType]) => sourceType)
        );
        valueSourceOptions.innerHTML = '';
        valueSourceSection.style.display = availableSources.length > 1 ? '' : 'none';

        if (availableSources.length <= 1) {
            keyData.includedValueSources = undefined;
        } else if (!Array.isArray(keyData.includedValueSources) && availableSources.length > 0) {
            keyData.includedValueSources = [...availableSources];
        } else if (Array.isArray(keyData.includedValueSources)) {
            const validSelectedSources = keyData.includedValueSources.filter(sourceType => availableSources.includes(sourceType));
            if (restoreNewlyAvailableSources) {
                const newlyAvailableSources = availableSources.filter(sourceType => !lastAvailableSources.includes(sourceType));
                keyData.includedValueSources = [...new Set([...validSelectedSources, ...newlyAvailableSources])];
            } else {
                keyData.includedValueSources = validSelectedSources;
            }
            if (keyData.includedValueSources.length === 0 && availableSources.length > 0) {
                keyData.includedValueSources = [...availableSources];
            }
        }
        lastAvailableSources = [...availableSources];

        availableSources.forEach(sourceType => {
            const optionId = `value-source-${sourceType}-${keyData.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const optionLabel = createElement('label', {
                className: 'value-source-option',
                title: getValueSourceTypeDescription(sourceType, propertyDatatype())
            });
            const checkbox = createElement('input', {
                type: 'checkbox',
                id: optionId,
                checked: !Array.isArray(keyData.includedValueSources) || keyData.includedValueSources.includes(sourceType),
                onChange: () => {
                    const checkedSources = Array.from(valueSourceOptions.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(input => input.value);
                    keyData.includedValueSources = checkedSources.length > 0 ? checkedSources : [...availableSources];
                    loadSampleValues(samplesContent, keyData, window.mappingStepState);
                }
            });
            checkbox.value = sourceType;
            optionLabel.appendChild(checkbox);
            const optionText = createElement('div', {
                className: 'value-source-option__content'
            });
            optionText.appendChild(createElement('span', {}, getValueSourceTypeLabel(sourceType)));
            optionText.appendChild(createElement('small', {}, `${filteredSourceStats[sourceType]?.valueCount || 0} values across ${filteredSourceStats[sourceType]?.itemCount || 0} items`));
            optionLabel.appendChild(optionText);
            valueSourceOptions.appendChild(optionLabel);
        });

        loadSampleValues(samplesContent, keyData, window.mappingStepState);
    };

    keyInfo.appendChild(segmentSection);
    keyInfo.appendChild(valueSourceSection);
    refreshExtractionUI();
    window.updateMappingExtractionUI = refreshExtractionUI;
    window.refreshMappingSamples = () => loadSampleValues(samplesContent, keyData, window.mappingStepState);
    infoColumn.appendChild(keyInfo);
    leftColumn.appendChild(samplesSection);
    
    // Value transformation section (Stage 3) - Collapsible
    const transformationSection = createElement('div', {
        className: 'transformation-section',
        style: 'margin-top: 20px;'
    });
    
    // Toggle button for transformation section
    const transformationToggle = createElement('button', {
        className: 'transformation-toggle',
        onClick: () => {
            const isExpanded = transformationSection.classList.contains('expanded');
            if (isExpanded) {
                transformationSection.classList.remove('expanded');
                transformationToggle.textContent = '▶ Add Transformation';
            } else {
                transformationSection.classList.add('expanded');
                transformationToggle.textContent = '▼ Hide Transformations';
                
                // For metadata fields, ensure compose transformation is added by default
                if (isMetadata) {
                    const composeContainer = document.querySelector('.transformation-blocks');
                    if (composeContainer && !composeContainer.hasChildNodes()) {
                        // Add a default compose block for metadata
                        const addComposeBtn = document.querySelector('.add-compose-btn');
                        if (addComposeBtn) {
                            addComposeBtn.click();
                        }
                    }
                }
            }
        }
    }, '▶ Add Transformation');
    
    transformationSection.appendChild(transformationToggle);
    
    // Collapsible content container
    const transformationContent = createElement('div', {
        className: 'transformation-content'
    });
    
    const transformationHeader = createElement('h4', {}, 'Value Transformation');
    transformationContent.appendChild(transformationHeader);
    
    const valueTransformationContainer = renderValueTransformationUI(keyData, window.mappingStepState);
    transformationContent.appendChild(valueTransformationContainer);
    
    transformationSection.appendChild(transformationContent);
        infoColumn.appendChild(transformationSection);
    }
    
    container.appendChild(leftColumn);
    if (middleColumn) {
        container.appendChild(middleColumn);
    }
    
    // RIGHT COLUMN - Wikidata Property
    const rightColumn = createElement('div', {
        className: 'mapping-column right-column'
    });
    
    // Column header with link to Wikidata help page
    const rightHeaderText = isMetadata ? 
        `<a href="https://www.wikidata.org/wiki/Help:Label" target="_blank" rel="noopener">Wikidata ${keyData.key || 'Property'}</a>` : 
        'Wikidata Property';
    const rightHeader = createElement('div', {
        className: 'column-header'
    });
    rightHeader.innerHTML = rightHeaderText;
    rightColumn.appendChild(rightHeader);
    
    // Property search section or metadata information
    const searchSection = createElement('div', {
        className: 'property-search'
    });
    
    if (isMetadata) {
        // For metadata properties, show information instead of search
        const metadataType = keyData.key?.toLowerCase();
        let helpUrl, helpText, description;
        
        switch(metadataType) {
            case 'label':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Label';
                helpText = 'Labels';
                description = 'Labels are the main name given to identify an entity. They do not need to be unique. In Wikidata, labels are language-specific.';
                break;
            case 'description':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Description';
                helpText = 'Descriptions';
                description = 'Descriptions are short phrases that disambiguate items with similar labels. They are language-specific and should be lowercase except for proper nouns.';
                break;
            case 'aliases':
                helpUrl = 'https://www.wikidata.org/wiki/Help:Aliases';
                helpText = 'Aliases';
                description = 'Aliases are alternative names for an entity. They help people find items even if they search for a name that is different from the label.';
                break;
            default:
                helpUrl = 'https://www.wikidata.org/wiki/Help:Label';
                helpText = 'Metadata';
                description = 'This is a metadata field for Wikidata entities.';
        }
        
        searchSection.innerHTML = `
            <div class="metadata-info">
                <h4>${helpText} Information</h4>
                <p>${description}</p>
                <p><a href="${helpUrl}" target="_blank" rel="noopener">Learn more about ${helpText} on Wikidata →</a></p>
                <div class="metadata-notice">
                    <strong>Note:</strong> ${helpText} are language-specific monolingual text values. Pick the source field that best represents this Wikidata value. ${metadataType === 'label' ? 'Use one Label mapping for the project and edit that mapping if you need to change it.' : 'Use this only when the value is genuinely needed for export.'}
                </div>
            </div>
        `;
    } else {
        // For custom properties, add metadata quick select buttons
        if (isCustomProperty) {
            // Add metadata quick select buttons
            const metadataButtonsSection = createElement('div', {
                className: 'metadata-buttons-section',
                style: 'margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; border: 1px solid #e0e0e0;'
            });
            
            const metadataHeader = createElement('h4', {
                style: 'margin-bottom: 10px;'
            }, 'Quick Select Metadata Fields');
            
            const metadataDescription = createElement('p', {
                style: 'margin-bottom: 15px; font-size: 0.9em; color: #666;'
            }, 'Use these only when the imported fields do not already provide the Wikidata value you need. Label should be mapped once per project.');
            
            const buttonsContainer = createElement('div', {
                className: 'metadata-buttons-grid',
                style: 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;'
            });
            
            // Create metadata buttons
            const metadataOptions = [
                {
                    id: 'label',
                    label: 'Labels',
                    icon: '🏷️',
                    description: 'Main name for entities',
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Label'
                },
                {
                    id: 'description',
                    label: 'Descriptions',
                    icon: '📝',
                    description: 'Short disambiguating phrases',
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Description'
                },
                {
                    id: 'aliases',
                    label: 'Aliases',
                    icon: '🔄',
                    description: 'Alternative names',
                    helpUrl: 'https://www.wikidata.org/wiki/Help:Aliases'
                }
            ];
            
            metadataOptions.forEach(option => {
                const button = createElement('button', {
                    className: 'metadata-select-button',
                    style: `
                        padding: 12px;
                        border: 2px solid #ddd;
                        background: white;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: all 0.2s;
                        text-align: center;
                    `,
                    onClick: () => selectMetadataField(option),
                    onMouseOver: (e) => {
                        if (!e.target.classList.contains('selected')) {
                            e.target.style.borderColor = '#3366cc';
                            e.target.style.background = '#f0f4ff';
                        }
                    },
                    onMouseOut: (e) => {
                        if (!e.target.classList.contains('selected')) {
                            e.target.style.borderColor = '#ddd';
                            e.target.style.background = 'white';
                        }
                    }
                });
                
                button.innerHTML = `
                    <div style="font-size: 1.5em; margin-bottom: 5px;">${option.icon}</div>
                    <div style="font-weight: bold; margin-bottom: 3px;">${option.label}</div>
                    <div style="font-size: 0.8em; color: #666;">${option.description}</div>
                `;
                
                buttonsContainer.appendChild(button);
            });
            
            metadataButtonsSection.appendChild(metadataHeader);
            metadataButtonsSection.appendChild(metadataDescription);
            metadataButtonsSection.appendChild(buttonsContainer);
            searchSection.appendChild(metadataButtonsSection);
            
            // Add divider
            const divider = createElement('div', {
                style: 'margin: 20px 0; border-bottom: 1px solid #ddd; position: relative;'
            });
            
            const orLabel = createElement('span', {
                style: `
                    position: absolute;
                    top: -10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: white;
                    padding: 0 10px;
                    color: #999;
                `
            }, 'OR');
            
            divider.appendChild(orLabel);
            searchSection.appendChild(divider);
        }
        
        // Check if entity schema is selected to conditionally add dropdown
        const schemaState = window.mappingStepState?.getState();
        const selectedSchema = schemaState?.selectedEntitySchema;
        const hasEntitySchemaProperties = selectedSchema?.properties && 
            (selectedSchema.properties.required?.length > 0 || selectedSchema.properties.optional?.length > 0);
        
        const entitySchemaDropdownHTML = hasEntitySchemaProperties ? `
            <div class="entity-schema-properties" id="entity-schema-properties">
                <label for="entity-schema-property-select">Properties from Entity Schema:</label>
                <select class="entity-schema-property-select" id="entity-schema-property-select">
                    <option value="">Select a property from schema...</option>
                </select>
                <small class="schema-indicator">These properties are recommended by the selected entity schema</small>
            </div>
        ` : '';
        
        const regularSearchHTML = `
            ${entitySchemaDropdownHTML}
            <h4>Search Properties</h4>
            <input type="text" id="property-search-input" placeholder="Type to search for Wikidata properties..." class="property-search-input">
            <div id="property-suggestions" class="property-suggestions"></div>
            <div id="selected-property" class="selected-property" style="display: none;">
                <h4>Selected Property</h4>
                <div id="selected-property-details"></div>
                <div id="property-constraints" class="property-constraints" style="display: none;">
                    <div class="constraint-loading" style="display: none;">Loading constraint information...</div>
                    <div class="constraint-content"></div>
                    <div class="constraint-info-notice">
                        This information is automatically retrieved from Wikidata and cannot be changed.
                    </div>
                </div>
            </div>
        `;
        
        // Create a container div for the regular search HTML
        const regularSearchContainer = createElement('div');
        regularSearchContainer.innerHTML = regularSearchHTML;
        searchSection.appendChild(regularSearchContainer);
    }
    rightColumn.appendChild(searchSection);
    
    // Data type information section (Stage 2 content)
    const dataTypeInfo = createElement('div', {
        className: 'datatype-info',
        id: 'datatype-info-section',
        style: isMetadata ? 'margin-top: 20px;' : 'margin-top: 20px; display: none;'
    });
    
    if (isMetadata) {
        // For metadata, always show monolingual text type
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Expected Value Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <span class="datatype-label">Monolingual text</span>
                </div>
                <div class="datatype-description">
                    <p>This field expects language-specific text values. Each value should be associated with a language code (e.g., "en" for English, "fr" for French).</p>
                </div>
            </div>
        `;
    } else {
        dataTypeInfo.innerHTML = `
            <div class="datatype-display">
                <h4>Expected Value Type</h4>
                <div id="detected-datatype" class="detected-datatype">
                    <div class="datatype-loading">Select a property to see expected type...</div>
                </div>
            </div>
        `;
    }
    rightColumn.appendChild(dataTypeInfo);
    
    container.appendChild(rightColumn);
    
    // Setup search functionality and pre-populate if mapped (only for non-metadata)
    if (!isMetadata) {
        setTimeout(() => {
            setupPropertySearch(keyData, window.mappingStepState);
            // Setup entity schema property dropdown if it exists
            setupEntitySchemaPropertySelection(window.mappingStepState);
        }, 100);
    } else {
        // For metadata properties, store them as selected automatically
        window.currentMappingSelectedProperty = {
            id: keyData.key?.toLowerCase(),
            label: keyData.key,
            description: `${keyData.key} for Wikidata entities`,
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text',
            isMetadata: true
        };
    }
    
    return container;
}

/**
 * Load sample values for the collapsible samples section
 */
function loadSampleValues(container, keyData, state) {
    const currentState = state.getState();
    if (!currentState.fetchedData) {
        container.innerHTML = '<div class="no-samples">No sample data available</div>';
        return;
    }
    
    const items = Array.isArray(currentState.fetchedData) ? currentState.fetchedData : [currentState.fetchedData];
    const samples = [];
    const maxSamples = 5;
    const previewKeyData = {
        ...keyData,
        property: window.currentMappingSelectedProperty || keyData.property
    };
    
    // Extract up to 5 sample values using the same segment-resolution pipeline as Reconciliation.
    for (const item of items) {
        if (samples.length >= maxSamples) break;
        if (item[keyData.key] === undefined) {
            continue;
        }

        const valueDetails = extractPropertyValueDetails(item, previewKeyData, state);
        if (valueDetails.length === 0) {
            continue;
        }

        const renderedDetails = valueDetails.map(detail => {
            const sampleHtml = formatSampleValue(detail.value, keyData.contextMap || new Map());
            const segmentBadge = detail.segmentLabel
                ? `<span class="sample-segment-badge">${detail.segmentLabel}</span>`
                : '';
            const sourceBadge = detail.sourceLabel
                ? `<span class="sample-source-badge">${detail.sourceLabel}</span>`
                : '';
            return `
                <div class="sample-value-detail">
                    <div class="sample-value-badges">${segmentBadge}${sourceBadge}</div>
                    <div class="sample-value-text">${sampleHtml}</div>
                </div>
            `;
        }).join('');

        samples.push(`
            <div class="sample-item">
                <strong>Sample ${samples.length + 1}:</strong>
                <div class="sample-value-stack">${renderedDetails}</div>
            </div>
        `);
    }
    
    if (samples.length === 0) {
        const hasRawValues = items.some(item => item[keyData.key] !== undefined);
        container.innerHTML = hasRawValues
            ? '<div class="no-samples">No sample values remain with the current settings.</div>'
            : '<div class="no-samples">No sample values found</div>';
        return;
    }
    
    container.innerHTML = samples.join('');
}

/**
 * Get selected property from modal
 */
export function getSelectedPropertyFromModal() {
    // For metadata properties, ensure the property is properly formatted
    const property = window.currentMappingSelectedProperty;
    if (property && property.isMetadata) {
        // Ensure metadata properties have the correct structure
        return {
            ...property,
            id: property.id || property.label?.toLowerCase(),
            datatype: 'monolingualtext',
            datatypeLabel: 'Monolingual text'
        };
    }
    return property;
}

/**
 * Create mapping relationship title with arrow
 */
function createMappingRelationshipTitle(keyName, property) {
    const sourceSpan = `<span class="mapping-source">${keyName}</span>`;
    const arrow = `<span class="mapping-arrow">→</span>`;
    const targetSpan = property 
        ? `<span class="mapping-target clickable" data-property-id="${property.id}" title="View on Wikidata" style="cursor: pointer; text-decoration: underline;">${property.label} (${property.id})</span>`
        : `<span class="mapping-target unmapped">unmapped</span>`;
    
    return `<div class="mapping-relationship-header">${sourceSpan}${arrow}${targetSpan}</div>`;
}

/**
 * Update the modal title to show the mapping relationship
 */
export function updateModalTitle(property) {
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle && window.currentMappingKeyData) {
        const keyName = window.currentMappingKeyData.key || 'Key';
        const titleHtml = createMappingRelationshipTitle(keyName, property);
        modalTitle.innerHTML = titleHtml;
        
        // Make the target property clickable
        const targetSpan = modalTitle.querySelector('.mapping-target.clickable');
        if (targetSpan) {
            targetSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                const propertyId = targetSpan.dataset.propertyId;
                if (propertyId) {
                    window.open(`https://www.wikidata.org/wiki/Property:${propertyId}`, '_blank');
                }
            });
        }
    }
}

/**
 * Update Stage 2 summary to show detected data type
 */
export function updateStage2Summary(property) {
    // In two-column layout, update the datatype section visibility and content
    const datatypeSection = document.getElementById('datatype-info-section');
    const datatypeDisplay = document.getElementById('detected-datatype');
    
    if (datatypeSection && datatypeDisplay && property && property.datatypeLabel) {
        datatypeSection.style.display = 'block';
        datatypeDisplay.innerHTML = `
            <div class="datatype-item">
                <strong>Type:</strong> ${property.datatypeLabel}
            </div>
        `;
    }
}
