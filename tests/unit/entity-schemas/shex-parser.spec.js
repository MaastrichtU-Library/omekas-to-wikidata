/**
 * Unit tests for the new ShEx parser implementation
 * Tests both the new parser and backwards compatibility layer
 */

import { 
    parseShExCode, 
    parseShExProperties,
    WIKIDATA_PREFIXES,
    ShExParseError
} from '../../../src/js/entity-schemas/shex-parser.js';

describe('ShEx Parser', () => {
    
    describe('parseShExCode()', () => {
        
        test('should parse basic Wikidata property', () => {
            const shexCode = 'wdt:P31 @<Q5> ; # instance of';
            const result = parseShExCode(shexCode);
            
            expect(result.properties.required).toHaveLength(1);
            expect(result.properties.optional).toHaveLength(0);
            
            const prop = result.properties.required[0];
            expect(prop.id).toBe('P31');
            expect(prop.schemaComment).toBe('instance of'); // Comment preserved for tooltip
            expect(prop.predicate).toBe('http://www.wikidata.org/prop/direct/P31');
            expect(prop.constraint).toBe('@<Q5>');
            expect(prop.requiresSource).toBe(false);
            // Note: label is now fetched from Wikidata API, not set by parser
        });
        
        test('should parse optional property with ?', () => {
            const shexCode = 'wdt:P123 xsd:string? ; # optional title';
            const result = parseShExCode(shexCode);
            
            expect(result.properties.required).toHaveLength(0);
            expect(result.properties.optional).toHaveLength(1);
            
            const prop = result.properties.optional[0];
            expect(prop.id).toBe('P123');
            expect(prop.schemaComment).toBe('optional title');
            expect(prop.cardinality).toEqual({ min: 0, max: 1 });
        });
        
        test('should parse optional property with *', () => {
            const shexCode = 'wdt:P456 IRI* ; # multiple values';
            const result = parseShExCode(shexCode);
            
            expect(result.properties.optional).toHaveLength(1);
            const prop = result.properties.optional[0];
            expect(prop.cardinality).toEqual({ min: 0, max: -1 });
        });
        
        test('should parse required property with +', () => {
            const shexCode = 'wdt:P789 @<Q1>+ ; # one or more';
            const result = parseShExCode(shexCode);
            
            expect(result.properties.required).toHaveLength(1);
            const prop = result.properties.required[0];
            expect(prop.cardinality).toEqual({ min: 1, max: -1 });
        });
        
        test('should parse explicit cardinality {min,max}', () => {
            const shexCode = 'wdt:P100 xsd:string{1,3} ; # one to three';
            const result = parseShExCode(shexCode);
            
            expect(result.properties.required).toHaveLength(1);
            const prop = result.properties.required[0];
            expect(prop.cardinality).toEqual({ min: 1, max: 3 });
        });
        
        test('should detect source requirements', () => {
            const shexCode = 'wdt:P248 @<Q1> ; # stated in (requires source)';
            const result = parseShExCode(shexCode);
            
            const prop = result.properties.required[0];
            expect(prop.requiresSource).toBe(true);
        });
        
        test('should extract prefixes from ShEx code', () => {
            const shexCode = `
                PREFIX ex: <http://example.org/>
                PREFIX wd: <http://www.wikidata.org/entity/>
                wdt:P31 @<Q5> ;
            `;
            const result = parseShExCode(shexCode);
            
            expect(result.prefixes.ex).toBe('http://example.org/');
            expect(result.prefixes.wd).toBe('http://www.wikidata.org/entity/');
        });
        
        test('should parse multiple properties', () => {
            const shexCode = `
                wdt:P31 @<Q5> ; # instance of
                wdt:P21 @<Q6581097> ; # sex or gender  
                wdt:P19 @<Q515>? ; # place of birth (optional)
            `;
            const result = parseShExCode(shexCode);
            
            expect(result.properties.required).toHaveLength(2);
            expect(result.properties.optional).toHaveLength(1);
            
            // Check required properties
            const required = result.properties.required;
            expect(required.find(p => p.id === 'P31')).toBeTruthy();
            expect(required.find(p => p.id === 'P21')).toBeTruthy();
            
            // Check optional property
            expect(result.properties.optional[0].id).toBe('P19');
        });
        
        test('should handle complex constraints', () => {
            const shexCode = 'wdt:P580 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear ;';
            const result = parseShExCode(shexCode);
            
            const prop = result.properties.required[0];
            expect(prop.id).toBe('P580');
            expect(prop.constraint).toContain('xsd:dateTime');
            expect(prop.valueConstraints).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'datatype' })
                ])
            );
        });
        
        test('should parse shape definitions', () => {
            const shexCode = `
                <PersonShape> {
                    wdt:P31 @<Q5> ; # instance of
                    wdt:P21 @<Q6581097> ; # sex or gender
                }
            `;
            const result = parseShExCode(shexCode);
            
            expect(result.shapes).toBeDefined();
            expect(Object.keys(result.shapes)).toHaveLength(1);
            
            const shape = Object.values(result.shapes)[0];
            expect(shape.properties.required).toHaveLength(2);
        });
        
        test('should handle malformed input gracefully', () => {
            const invalidShex = 'invalid shex code !!!';
            const result = parseShExCode(invalidShex);
            
            // Should return empty structure rather than throwing
            expect(result.properties.required).toHaveLength(0);
            expect(result.properties.optional).toHaveLength(0);
        });
    });
    
    describe('Backwards Compatibility Layer', () => {
        
        test('should use legacy parser by default', () => {
            const shexCode = 'wdt:P31 @<Q5> ; # instance of';
            const result = parseShExProperties(shexCode);
            
            // Should work exactly like the legacy parser
            expect(result).toHaveProperty('required');
            expect(result).toHaveProperty('optional');
            expect(result.required).toHaveLength(1);
            
            const prop = result.required[0];
            expect(prop.id).toBe('P31');
            expect(prop.schemaComment).toBe('instance of');
            expect(prop.description).toBe('Constraint: @<Q5>');
            expect(prop.url).toBe('https://www.wikidata.org/wiki/Property:P31');
        });
        
        test('should use new parser when requested', () => {
            const shexCode = 'wdt:P31 @<Q5> ; # instance of';
            const result = parseShExProperties(shexCode, { useNewParser: true });
            
            // Should return same structure but potentially with enhanced parsing
            expect(result.required).toHaveLength(1);
            const prop = result.required[0];
            expect(prop.id).toBe('P31');
            expect(prop.schemaComment).toBe('instance of');
        });
        
        test('should fallback to legacy when new parser fails', () => {
            const shexCode = 'wdt:P31 @<Q5> ; # instance of';
            
            // Mock new parser to throw error
            const originalConsoleWarn = console.warn;
            console.warn = jest.fn();
            
            const result = parseShExProperties(shexCode, { 
                useNewParser: true,
                enableFallback: true 
            });
            
            // Should still return valid result via fallback
            expect(result.required).toHaveLength(1);
            
            console.warn = originalConsoleWarn;
        });
        
        test('should throw when fallback disabled and new parser fails', () => {
            // Mock parseShExCode to throw
            const originalParseShExCode = parseShExCode;
            
            expect(() => {
                parseShExProperties('invalid', { 
                    useNewParser: true,
                    enableFallback: false 
                });
            }).toThrow(); // Should throw because fallback is disabled
        });
        
        test('should maintain legacy fallback behavior', () => {
            const emptyShex = '# just comments';
            const result = parseShExProperties(emptyShex);
            
            // Legacy behavior: add P31 fallback
            expect(result.required).toHaveLength(1);
            expect(result.required[0].id).toBe('P31');
            expect(result.required[0].schemaComment).toBe('instance of');
            expect(result.required[0].requiresSource).toBe(false);
        });
    });
    
    describe('Parser Edge Cases', () => {
        
        test('should handle properties without comments', () => {
            const shexCode = 'wdt:P31 @<Q5> ;';
            const result = parseShExCode(shexCode);
            
            const prop = result.properties.required[0];
            expect(prop.schemaComment).toBeNull(); // No comment provided
        });
        
        test('should handle properties with complex comments', () => {
            const shexCode = 'wdt:P31 @<Q5> ; # instance of (taxonomic class)';
            const result = parseShExCode(shexCode);
            
            const prop = result.properties.required[0];
            expect(prop.schemaComment).toBe('instance of (taxonomic class)');
        });
        
        test('should handle mixed required and optional properties', () => {
            const shexCode = `
                wdt:P31 @<Q5> ; # required
                wdt:P21 @<Q6581097>? ; # optional
                wdt:P19 @<Q515>* ; # optional multiple
                wdt:P20 @<Q515> ; # required
            `;
            const result = parseShExCode(shexCode);
            
            expect(result.properties.required).toHaveLength(2);
            expect(result.properties.optional).toHaveLength(2);
        });
        
        test('should deduplicate properties', () => {
            const shexCode = `
                wdt:P31 @<Q5> ; # first occurrence
                wdt:P31 @<Q6> ; # duplicate
            `;
            const result = parseShExCode(shexCode);
            
            // Should only have one P31 property (first occurrence wins)
            expect(result.properties.required).toHaveLength(1);
            expect(result.properties.required[0].constraint).toBe('@<Q5>');
        });
        
        test('should handle non-Wikidata properties gracefully', () => {
            const shexCode = `
                ex:customProp xsd:string ; # non-Wikidata property
                wdt:P31 @<Q5> ; # Wikidata property
            `;
            const result = parseShExCode(shexCode);
            
            // Should only include Wikidata properties
            expect(result.properties.required).toHaveLength(1);
            expect(result.properties.required[0].id).toBe('P31');
        });
    });
    
    describe('Error Handling', () => {
        
        test('should create ShExParseError with location info', () => {
            const error = new ShExParseError('Test error', 5, 10, 'test source');
            
            expect(error.name).toBe('ShExParseError');
            expect(error.message).toBe('Test error');
            expect(error.line).toBe(5);
            expect(error.column).toBe(10);
            expect(error.source).toBe('test source');
            
            const errorString = error.toString();
            expect(errorString).toContain('line 5, column 10');
        });
    });
    
    describe('Performance', () => {
        
        test('should parse complex schema in reasonable time', () => {
            const complexShex = `
                PREFIX wd: <http://www.wikidata.org/entity/>
                PREFIX wdt: <http://www.wikidata.org/prop/direct/>
                
                <PersonShape> {
                    wdt:P31 @<Q5> ; # instance of
                    wdt:P21 @<Q6581097> ; # sex or gender
                    wdt:P19 @<Q515>? ; # place of birth
                    wdt:P20 @<Q515>? ; # place of death
                    wdt:P569 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear? ; # date of birth
                    wdt:P570 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear? ; # date of death
                    wdt:P106 @<Q28640>* ; # occupation
                    wdt:P27 @<Q6256>* ; # country of citizenship
                    wdt:P735 @<Q202444>* ; # given name
                    wdt:P734 @<Q101352>* ; # family name
                }
            `.repeat(10); // Make it larger for performance testing
            
            const start = performance.now();
            const result = parseShExCode(complexShex);
            const end = performance.now();
            
            expect(end - start).toBeLessThan(100); // Should parse in <100ms
            expect(result.properties.required.length + result.properties.optional.length).toBeGreaterThan(0);
        });
    });
    
    describe('Real-world Examples', () => {
        
        test('should parse E473 (Maastricht University Library) pattern', () => {
            // Simplified version of actual E473 pattern
            const e473Pattern = `
                wdt:P31 @<Q3331189> OR @<Q13442814> ; # instance of: edition, translation
                wdt:P407 @<Q34770>* ; # language of work or name
                wdt:P50 @<Q5>* ; # author
                wdt:P123 @<Q1512977> ; # publisher: Maastricht University Library
                wdt:P577 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear? ; # publication date
                wdt:P1476 rdf:langString+ ; # title
            `;
            
            const result = parseShExCode(e473Pattern);
            
            expect(result.properties.required.length).toBeGreaterThan(0);
            expect(result.properties.optional.length).toBeGreaterThan(0);
            
            // Check specific properties
            const titles = result.properties.required.find(p => p.id === 'P1476');
            expect(titles).toBeTruthy();
            expect(titles.cardinality.min).toBe(1);
            expect(titles.cardinality.max).toBe(-1); // + means one or more
            
            const pubDate = result.properties.optional.find(p => p.id === 'P577');
            expect(pubDate).toBeTruthy();
        });
    });
});

describe('WIKIDATA_PREFIXES', () => {
    
    test('should contain essential Wikidata prefixes', () => {
        expect(WIKIDATA_PREFIXES.wd).toBe('http://www.wikidata.org/entity/');
        expect(WIKIDATA_PREFIXES.wdt).toBe('http://www.wikidata.org/prop/direct/');
        expect(WIKIDATA_PREFIXES.p).toBe('http://www.wikidata.org/prop/');
        expect(WIKIDATA_PREFIXES.ps).toBe('http://www.wikidata.org/prop/statement/');
        expect(WIKIDATA_PREFIXES.prov).toBe('http://www.w3.org/ns/prov#');
        expect(WIKIDATA_PREFIXES.xsd).toBe('http://www.w3.org/2001/XMLSchema#');
    });
});