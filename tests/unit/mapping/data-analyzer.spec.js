import { extractAndAnalyzeKeys, getDefaultExtractionMode } from '../../../src/js/mapping/core/data-analyzer.js';

describe('mapping/core/data-analyzer', () => {
    test('preserves resource template order when sortMode is template', async () => {
        const data = {
            items: [
                {
                    '@context': {
                        dcterms: 'http://purl.org/dc/terms/'
                    },
                    'o:resource_template': { 'o:id': 11, 'o:label': 'Books' },
                    'dcterms:title': [{ property_id: 1, '@value': 'First title' }],
                    'dcterms:creator': [{ property_id: 2, '@value': 'First creator' }],
                    'dcterms:date': [{ property_id: 3, '@value': '1901' }]
                },
                {
                    '@context': {
                        dcterms: 'http://purl.org/dc/terms/'
                    },
                    'o:resource_template': { 'o:id': 11, 'o:label': 'Books' },
                    'dcterms:creator': [{ property_id: 2, '@value': 'Second creator' }]
                }
            ]
        };

        const resourceTemplates = [
            {
                'o:id': 11,
                'o:resource_template_property': [
                    { 'o:property': { 'o:id': 3, 'o:term': 'dcterms:date' } },
                    { 'o:property': { 'o:id': 1, 'o:term': 'dcterms:title' } },
                    { 'o:property': { 'o:id': 2, 'o:term': 'dcterms:creator' } }
                ]
            }
        ];

        const result = await extractAndAnalyzeKeys(data, {
            sortMode: 'template',
            resourceTemplates,
            selectedTemplateIds: ['11']
        });

        expect(result.slice(0, 3).map(entry => entry.key)).toEqual([
            'dcterms:date',
            'dcterms:title',
            'dcterms:creator'
        ]);
    });

    test('sorts by frequency when sortMode is frequency', async () => {
        const data = {
            items: [
                {
                    '@context': {
                        dcterms: 'http://purl.org/dc/terms/'
                    },
                    'dcterms:title': [{ property_id: 1, '@value': 'First title' }],
                    'dcterms:creator': [{ property_id: 2, '@value': 'First creator' }]
                },
                {
                    '@context': {
                        dcterms: 'http://purl.org/dc/terms/'
                    },
                    'dcterms:creator': [{ property_id: 2, '@value': 'Second creator' }]
                },
                {
                    '@context': {
                        dcterms: 'http://purl.org/dc/terms/'
                    },
                    'dcterms:creator': [{ property_id: 2, '@value': 'Third creator' }],
                    'dcterms:date': [{ property_id: 3, '@value': '1901' }]
                }
            ]
        };

        const result = await extractAndAnalyzeKeys(data, {
            sortMode: 'frequency'
        });

        expect(result.slice(0, 3).map(entry => entry.key)).toEqual([
            'dcterms:creator',
            'dcterms:title',
            'dcterms:date'
        ]);
    });

    test('captures template datatype rules and observed mixed value shapes', async () => {
        const data = {
            items: [
                {
                    '@context': {
                        schema: 'https://schema.org/'
                    },
                    'schema:author': [
                        {
                            property_id: 8,
                            type: 'literal',
                            '@value': 'Anne Author'
                        },
                        {
                            property_id: 8,
                            type: 'valuesuggest:oclc:viaf',
                            '@id': 'https://viaf.org/viaf/12345',
                            'o:label': 'Author, Anne'
                        }
                    ]
                }
            ]
        };

        const resourceTemplates = [
            {
                'o:id': 7,
                'o:resource_template_property': [
                    {
                        'o:property': { 'o:id': 8, 'o:term': 'schema:author' },
                        'o:data_type': ['literal', 'uri', 'valuesuggest:oclc:viaf']
                    }
                ]
            }
        ];

        const result = await extractAndAnalyzeKeys(data, {
            sortMode: 'template',
            resourceTemplates,
            selectedTemplateIds: ['7']
        });

        const authorField = result.find(entry => entry.key === 'schema:author');

        expect(authorField.fieldProfile.templateAllowedTypes).toEqual([
            'literal',
            'uri',
            'valuesuggest:oclc:viaf'
        ]);
        expect(authorField.fieldProfile.observedTypes).toEqual([
            'literal',
            'valuesuggest:oclc:viaf'
        ]);
        expect(authorField.fieldProfile.hasLiterals).toBe(true);
        expect(authorField.fieldProfile.hasAuthorityLabels).toBe(true);
        expect(authorField.fieldProfile.hasUris).toBe(true);
        expect(getDefaultExtractionMode(authorField.fieldProfile, 'wikibase-item')).toBe('display_text');
    });
});
