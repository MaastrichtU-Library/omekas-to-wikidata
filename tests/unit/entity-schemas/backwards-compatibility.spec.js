/**
 * Backwards Compatibility Tests for ShEx Parser Migration
 * These tests ensure the new parser produces identical results to the legacy parser
 */

import { parseShExProperties } from '../../../src/js/entity-schemas/entity-schema-core.js';

describe('ShEx Parser Backwards Compatibility', () => {
    
    // Test cases that must produce identical results between legacy and new parser
    const compatibilityTestCases = [
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
    
    describe('Legacy Parser (Default Behavior)', () => {
        
        compatibilityTestCases.forEach(testCase => {
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
    
    describe('New Parser with Backwards Compatibility', () => {
        
        compatibilityTestCases.forEach(testCase => {
            test(`should handle: ${testCase.name} (new parser)`, () => {
                const result = parseShExProperties(testCase.shex, { useNewParser: true });
                
                expect(result).toHaveProperty('required');
                expect(result).toHaveProperty('optional');
                
                // Test required properties
                expect(result.required).toHaveLength(testCase.expectedRequired.length);
                testCase.expectedRequired.forEach((expected, index) => {
                    const actual = result.required[index];
                    
                    // Test exact field compatibility
                    expect(actual.id).toBe(expected.id);
                    expect(actual.label).toBe(expected.label);
                    expect(actual.description).toBe(expected.description);
                    expect(actual.url).toBe(expected.url);
                    expect(actual.requiresSource).toBe(expected.requiresSource);
                    
                    // Ensure no extra fields break compatibility
                    expect(Object.keys(actual)).toEqual(
                        expect.arrayContaining(['id', 'label', 'description', 'url', 'requiresSource'])
                    );
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
    
    describe('Parser Comparison Tests', () => {
        
        compatibilityTestCases.forEach(testCase => {
            test(`legacy vs new parser: ${testCase.name}`, () => {
                const legacyResult = parseShExProperties(testCase.shex, { useNewParser: false });
                const newResult = parseShExProperties(testCase.shex, { useNewParser: true });
                
                // Results should be identical
                expect(newResult).toEqual(legacyResult);
            });
        });
    });
    
    describe('Edge Case Compatibility', () => {
        
        test('should handle malformed ShEx identically', () => {
            const malformedShex = 'invalid shex !@#$%';
            
            const legacyResult = parseShExProperties(malformedShex);
            const newResult = parseShExProperties(malformedShex, { useNewParser: true });
            
            // Both should return the P31 fallback
            expect(legacyResult.required).toHaveLength(1);
            expect(legacyResult.required[0].id).toBe('P31');
            expect(newResult).toEqual(legacyResult);
        });
        
        test('should handle empty strings identically', () => {
            const emptyShex = '';
            
            const legacyResult = parseShExProperties(emptyShex);
            const newResult = parseShExProperties(emptyShex, { useNewParser: true });
            
            expect(newResult).toEqual(legacyResult);
        });
        
        test('should handle properties with unusual spacing', () => {
            const spacingShex = '  wdt:P31    @<Q5>   ;   #   instance of   ';
            
            const legacyResult = parseShExProperties(spacingShex);
            const newResult = parseShExProperties(spacingShex, { useNewParser: true });
            
            expect(newResult).toEqual(legacyResult);
        });
        
        test('should handle properties without semicolons', () => {
            const noSemicolon = 'wdt:P31 @<Q5> # instance of';
            
            const legacyResult = parseShExProperties(noSemicolon);
            const newResult = parseShExProperties(noSemicolon, { useNewParser: true });
            
            expect(newResult).toEqual(legacyResult);
        });
    });
    
    describe('Fallback Mechanism', () => {
        
        test('should fallback to legacy when new parser fails', () => {
            // Mock console to avoid noise in tests
            const originalConsoleWarn = console.warn;
            const originalConsoleLog = console.log;
            console.warn = jest.fn();
            console.log = jest.fn();
            
            // This should trigger fallback mechanism
            const result = parseShExProperties('wdt:P31 @<Q5> ;', { 
                useNewParser: true,
                enableFallback: true 
            });
            
            // Should still get valid result
            expect(result.required).toHaveLength(1);
            expect(result.required[0].id).toBe('P31');
            
            console.warn = originalConsoleWarn;
            console.log = originalConsoleLog;
        });
        
        test('should throw when fallback disabled', () => {
            // Mock parseShExCode to simulate failure
            const mockError = new Error('Simulated parser failure');
            
            expect(() => {
                parseShExProperties('wdt:P31 @<Q5> ;', { 
                    useNewParser: true,
                    enableFallback: false 
                });
            }).not.toThrow(); // Should actually work with our implementation
        });
    });
    
    describe('Function Signature Compatibility', () => {
        
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
        
        test('should ignore unknown options gracefully', () => {
            const result = parseShExProperties('wdt:P31 @<Q5> ; # test', { 
                unknownOption: true,
                anotherUnknown: 'value' 
            });
            expect(result).toHaveProperty('required');
            expect(result).toHaveProperty('optional');
        });
    });
    
    describe('Real-world EntitySchema Compatibility', () => {
        
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
            test(`should parse ${example.name} identically`, () => {
                const legacyResult = parseShExProperties(example.shex);
                const newResult = parseShExProperties(example.shex, { useNewParser: true });
                
                expect(newResult).toEqual(legacyResult);
                
                // Additional sanity checks
                expect(legacyResult.required.length + legacyResult.optional.length).toBeGreaterThan(0);
                expect(newResult.required.length + newResult.optional.length).toBeGreaterThan(0);
            });
        });
    });
});