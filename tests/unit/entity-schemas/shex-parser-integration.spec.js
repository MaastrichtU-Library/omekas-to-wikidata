/**
 * Integration Tests for ShEx Parser
 * These tests ensure the new parser produces the expected output format for the application
 */

import { parseShExProperties } from '../../../src/js/entity-schemas/entity-schema-core.js';

describe('ShEx Parser Integration', () => {
    
    // Test cases that verify the parser produces expected output format
    const integrationTestCases = [
        {
            name: 'basic required property',
            shex: 'wdt:P31 @<Q5> ; # instance of',
            expectedRequired: [{
                id: 'P31',
                label: 'instance of',
                description: 'Constraint: @<Q5>',
                url: 'https://www.wikidata.org/wiki/Property:P31',
                requiresSource: false
            }],
            expectedOptional: []
        },
        {
            name: 'optional property with ?',
            shex: 'wdt:P123 xsd:string? ; # optional title',
            expectedRequired: [],
            expectedOptional: [{
                id: 'P123',
                label: 'optional title',
                description: 'Constraint: xsd:string?',
                url: 'https://www.wikidata.org/wiki/Property:P123',
                requiresSource: false
            }]
        },
        {
            name: 'optional property with *',
            shex: 'wdt:P456 IRI* ; # multiple values',
            expectedRequired: [],
            expectedOptional: [{
                id: 'P456',
                label: 'multiple values',
                description: 'Constraint: IRI*',
                url: 'https://www.wikidata.org/wiki/Property:P456',
                requiresSource: false
            }]
        },
        {
            name: 'property without comment',
            shex: 'wdt:P789 @<Q1> ;',
            expectedRequired: [{
                id: 'P789',
                label: 'P789',
                description: 'Constraint: @<Q1>',
                url: 'https://www.wikidata.org/wiki/Property:P789',
                requiresSource: false
            }],
            expectedOptional: []
        },
        {
            name: 'source-requiring property',
            shex: 'wdt:P248 @<Q1> ; # stated in (source)',
            expectedRequired: [{
                id: 'P248',
                label: 'stated in (source)',
                description: 'Constraint: @<Q1>',
                url: 'https://www.wikidata.org/wiki/Property:P248',
                requiresSource: true // detectSourceRequirement should detect 'stated in'
            }],
            expectedOptional: []
        },
        {
            name: 'multiple properties mixed',
            shex: `wdt:P31 @<Q5> ; # instance of
                   wdt:P21 @<Q6581097>? ; # sex or gender
                   wdt:P19 @<Q515> ; # place of birth`,
            expectedRequired: [
                {
                    id: 'P31',
                    label: 'instance of',
                    description: 'Constraint: @<Q5>',
                    url: 'https://www.wikidata.org/wiki/Property:P31',
                    requiresSource: false
                },
                {
                    id: 'P19',
                    label: 'place of birth',
                    description: 'Constraint: @<Q515>',
                    url: 'https://www.wikidata.org/wiki/Property:P19',
                    requiresSource: false
                }
            ],
            expectedOptional: [{
                id: 'P21',
                label: 'sex or gender',
                description: 'Constraint: @<Q6581097>?',
                url: 'https://www.wikidata.org/wiki/Property:P21',
                requiresSource: false
            }]
        },
        {
            name: 'empty input (fallback case)',
            shex: '# just comments\n\n',
            expectedRequired: [{
                id: 'P31',
                label: 'instance of',
                description: 'that class of which this subject is a particular example',
                url: 'https://www.wikidata.org/wiki/Property:P31',
                requiresSource: false
            }],
            expectedOptional: []
        },
        {
            name: 'complex constraint patterns',
            shex: 'wdt:P577 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear ; # publication date',
            expectedRequired: [{
                id: 'P577',
                label: 'publication date',
                description: 'Constraint: xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear',
                url: 'https://www.wikidata.org/wiki/Property:P577',
                requiresSource: false
            }],
            expectedOptional: []
        }
    ];
    
    describe('Parser Output Format', () => {
        
        integrationTestCases.forEach(testCase => {
            test(`should handle: ${testCase.name}`, () => {
                const result = parseShExProperties(testCase.shex);
                
                expect(result).toHaveProperty('required');
                expect(result).toHaveProperty('optional');
                
                // Test required properties
                expect(result.required).toHaveLength(testCase.expectedRequired.length);
                testCase.expectedRequired.forEach((expected, index) => {
                    const actual = result.required[index];
                    expect(actual).toEqual(expected);
                });
                
                // Test optional properties
                expect(result.optional).toHaveLength(testCase.expectedOptional.length);
                testCase.expectedOptional.forEach((expected, index) => {
                    const actual = result.optional[index];
                    expect(actual).toEqual(expected);
                });
            });
        });
    });
    
    
    describe('Edge Case Handling', () => {
        
        test('should handle malformed ShEx with P31 fallback', () => {
            const malformedShex = 'invalid shex !@#$%';
            
            const result = parseShExProperties(malformedShex);
            
            // Should return the P31 fallback
            expect(result.required).toHaveLength(1);
            expect(result.required[0].id).toBe('P31');
            expect(result.optional).toHaveLength(0);
        });
        
        test('should handle empty strings with P31 fallback', () => {
            const emptyShex = '';
            
            const result = parseShExProperties(emptyShex);
            
            expect(result.required).toHaveLength(1);
            expect(result.required[0].id).toBe('P31');
        });
        
        test('should handle properties with unusual spacing', () => {
            const spacingShex = '  wdt:P31    @<Q5>   ;   #   instance of   ';
            
            const result = parseShExProperties(spacingShex);
            
            expect(result.required).toHaveLength(1);
            expect(result.required[0].id).toBe('P31');
            expect(result.required[0].label).toBe('instance of');
        });
        
        test('should handle properties without semicolons', () => {
            const noSemicolon = 'wdt:P31 @<Q5> # instance of';
            
            const result = parseShExProperties(noSemicolon);
            
            expect(result.required).toHaveLength(1);
            expect(result.required[0].id).toBe('P31');
        });
    });
    
    describe('Function Signature', () => {
        
        test('should work with no options parameter', () => {
            const result = parseShExProperties('wdt:P31 @<Q5> ; # test');
            expect(result).toHaveProperty('required');
            expect(result).toHaveProperty('optional');
        });
        
        test('should work with empty options object', () => {
            const result = parseShExProperties('wdt:P31 @<Q5> ; # test', {});
            expect(result).toHaveProperty('required');
            expect(result).toHaveProperty('optional');
        });
        
        test('should work with strictMode option', () => {
            const result = parseShExProperties('wdt:P31 @<Q5> ; # test', { 
                strictMode: false 
            });
            expect(result).toHaveProperty('required');
            expect(result).toHaveProperty('optional');
        });
    });
    
    describe('Real-world EntitySchema Patterns', () => {
        
        // Test patterns from actual Wikidata EntitySchemas
        const realWorldExamples = [
            {
                name: 'E473 pattern',
                shex: `wdt:P31 @<Q3331189> OR @<Q13442814> ; # instance of
                       wdt:P1476 rdf:langString+ ; # title`,
                description: 'Maastricht University Library pattern'
            },
            {
                name: 'E487 pattern', 
                shex: `wdt:P31 @<Q3331189> ; # instance of
                       wdt:P407 @<Q34770>* ; # language`,
                description: 'Radboud University Library pattern'
            },
            {
                name: 'Person pattern',
                shex: `wdt:P31 @<Q5> ; # instance of
                       wdt:P21 @<Q6581097> ; # sex or gender
                       wdt:P19 @<Q515>? ; # place of birth`,
                description: 'Common person pattern'
            }
        ];
        
        realWorldExamples.forEach(example => {
            test(`should parse ${example.name} correctly`, () => {
                const result = parseShExProperties(example.shex);
                
                // Basic structure validation
                expect(result).toHaveProperty('required');
                expect(result).toHaveProperty('optional');
                
                // Should parse some properties
                expect(result.required.length + result.optional.length).toBeGreaterThan(0);
                
                // All properties should have required fields
                [...result.required, ...result.optional].forEach(prop => {
                    expect(prop).toHaveProperty('id');
                    expect(prop).toHaveProperty('label');
                    expect(prop).toHaveProperty('description');
                    expect(prop).toHaveProperty('url');
                    expect(prop).toHaveProperty('requiresSource');
                    expect(typeof prop.requiresSource).toBe('boolean');
                });
            });
        });
    });
});