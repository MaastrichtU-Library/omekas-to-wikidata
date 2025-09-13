/**
 * Manual validation script for testing ShEx parser with real Wikidata EntitySchemas
 * This script validates the parser against actual EntitySchema patterns
 */

import { parseShExProperties } from '../src/js/entity-schemas/entity-schema-core.js';
import { parseShExCode } from '../src/js/entity-schemas/shex-parser.js';

// Real EntitySchema patterns from Wikidata
const REAL_ENTITYSCHEMA_SAMPLES = {
    
    // E473: Maastricht University Library book edition pattern
    E473_SIMPLIFIED: `
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        PREFIX wikibase: <http://wikiba.se/ontology#>
        PREFIX ps: <http://www.wikidata.org/prop/statement/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        # Book edition or translation pattern
        wdt:P31 @<Q3331189> OR @<Q13442814> ; # instance of: edition or translation
        wdt:P1476 rdf:langString+ ; # title (required, one or more)
        wdt:P407 @<Q34770>* ; # language of work or name (optional, multiple)
        wdt:P50 @<Q5>* ; # author (optional, multiple)  
        wdt:P123 @<Q1512977> ; # publisher: Maastricht University Library
        wdt:P577 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear? ; # publication date (optional)
        wdt:P212 /^97[89]-\\d{1,5}-\\d{1,7}-\\d{1,7}-[0-9X]$/ OR /^\\d{9}[0-9X]$/ ? ; # ISBN (optional)
        wdt:P1104 xsd:integer? ; # number of pages (optional)
        wdt:P195 @<Q1512977> ; # collection: Maastricht University Library
    `,
    
    // E487: Radboud University Library pattern  
    E487_SIMPLIFIED: `
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        
        # Book edition pattern for Radboud University Library
        wdt:P31 @<Q3331189> ; # instance of: edition
        wdt:P1476 rdf:langString+ ; # title (required)
        wdt:P407 @<Q34770>* ; # language (optional, multiple)
        wdt:P577 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear? ; # publication date
        wdt:P195 @<Q131613> ; # collection: Radboud University Library
    `,
    
    // E476: Manuscript pattern
    E476_SIMPLIFIED: `
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        
        # Manuscript pattern
        wdt:P31 @<Q87167> ; # instance of: manuscript
        wdt:P1476 rdf:langString+ ; # title
        wdt:P407 @<Q34770>* ; # language of work
        wdt:P571 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear? ; # inception date
        wdt:P186 @<Q11472> ; # material used (e.g., parchment)
        wdt:P18 @<wd:Q4167836>* ; # image (optional, multiple)
        wdt:P195 @<Q1138225>* ; # collection
    `,
    
    // Person pattern (common in Wikidata)
    PERSON_PATTERN: `
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        
        # Person pattern
        wdt:P31 @<Q5> ; # instance of: human
        wdt:P21 @<Q6581097> OR @<Q6581072> ; # sex or gender
        wdt:P19 @<Q515>? ; # place of birth (optional)
        wdt:P20 @<Q515>? ; # place of death (optional)  
        wdt:P569 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear? ; # date of birth
        wdt:P570 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear? ; # date of death
        wdt:P106 @<Q28640>* ; # occupation (optional, multiple)
        wdt:P27 @<Q6256>* ; # country of citizenship (optional, multiple)
        wdt:P735 @<Q202444>+ ; # given name (required, one or more)
        wdt:P734 @<Q101352>* ; # family name (optional, multiple)
    `,
    
    // Complex pattern with references and qualifiers
    COMPLEX_PATTERN: `
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        PREFIX prov: <http://www.w3.org/ns/prov#>
        
        # Complex pattern with source requirements
        wdt:P31 @<Q5> ; # instance of: human
        wdt:P569 xsd:dateTime OR xsd:date {
            # Date of birth with required source
            prov:wasDerivedFrom @<source> ;
        }? ;
        wdt:P248 @<Q5> ; # stated in (requires source)
        wdt:P854 IRI ; # reference URL
        wdt:P813 xsd:dateTime ; # retrieved date
    `
};

/**
 * Test function to validate parser with real EntitySchema patterns
 */
function testEntitySchemaPatterns() {
    console.log('🧪 Testing ShEx Parser with Real Wikidata EntitySchema Patterns\n');
    
    const results = {};
    let successCount = 0;
    let errorCount = 0;
    
    Object.entries(REAL_ENTITYSCHEMA_SAMPLES).forEach(([schemaName, shexCode]) => {
        console.log(`\n📋 Testing: ${schemaName}`);
        console.log('─'.repeat(60));
        
        try {
            const result = parseShExProperties(shexCode);
            results[schemaName] = result;
            successCount++;
            
            console.log('✅ Parser Results:');
            console.log(`   Required properties: ${result.required.length}`);
            console.log(`   Optional properties: ${result.optional.length}`);
            
            if (result.required.length > 0) {
                console.log('   Required IDs:', result.required.map(p => p.id).join(', '));
            }
            if (result.optional.length > 0) {
                console.log('   Optional IDs:', result.optional.map(p => p.id).join(', '));
            }
            
            // Validate structure
            [...result.required, ...result.optional].forEach(prop => {
                if (!prop.id || !prop.label || !prop.url || typeof prop.requiresSource !== 'boolean') {
                    console.log('   ⚠️  Property missing required fields:', prop.id);
                }
            });
            
            // Check for source requirements
            const sourceProps = [...result.required, ...result.optional].filter(p => p.requiresSource);
            if (sourceProps.length > 0) {
                console.log('   📍 Source requirements detected:', sourceProps.map(p => p.id).join(', '));
            }
            
        } catch (error) {
            console.log('❌ Parser failed:', error.message);
            results[schemaName] = { error: error.message };
            errorCount++;
        }
    });
    
    // Summary
    console.log('\n📊 SUMMARY');
    console.log('═'.repeat(60));
    
    const total = Object.keys(REAL_ENTITYSCHEMA_SAMPLES).length;
    
    console.log(`✅ Successful parses: ${successCount}/${total}`);
    console.log(`❌ Failed parses: ${errorCount}/${total}`);
    
    if (errorCount > 0) {
        console.log('\n🔍 ERRORS');
        console.log('─'.repeat(60));
        
        Object.entries(results).forEach(([schema, result]) => {
            if (result.error) {
                console.log(`❌ ${schema}: ${result.error}`);
            }
        });
    }
    
    return results;
}

/**
 * Test specific parsing edge cases
 */
function testParsingEdgeCases() {
    console.log('\n🎯 Testing Edge Cases');
    console.log('═'.repeat(60));
    
    const edgeCases = {
        'Empty schema': '',
        'Comments only': '# This is just a comment\n# Another comment',
        'Malformed property': 'invalid:property @<something> ;',
        'Mixed valid/invalid': `
            wdt:P31 @<Q5> ; # valid property
            invalid:prop something ; # invalid
            wdt:P21 @<Q123>? ; # another valid
        `,
        'Complex constraints': `
            wdt:P577 xsd:dateTime OR xsd:date OR xsd:gYearMonth OR xsd:gYear ;
        `,
        'Cardinality patterns': `
            wdt:P1476 rdf:langString{1,3} ; # explicit cardinality
            wdt:P50 @<Q5>+ ; # one or more
            wdt:P407 @<Q34770>* ; # zero or more
        `
    };
    
    Object.entries(edgeCases).forEach(([caseName, shex]) => {
        console.log(`\n📝 Testing: ${caseName}`);
        
        try {
            const result = parseShExProperties(shex);
            
            console.log(`   ✅ Parser handled successfully`);
            console.log(`   Result: ${result.required.length} required, ${result.optional.length} optional`);
            
            if (result.required.length > 0) {
                console.log(`   Required: ${result.required.map(p => p.id).join(', ')}`);
            }
            if (result.optional.length > 0) {
                console.log(`   Optional: ${result.optional.map(p => p.id).join(', ')}`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    });
}

// Run tests if this file is executed directly
if (typeof process !== 'undefined' && process.argv) {
    // Running in Node.js environment
    console.log('🚀 ShEx Parser Validation Suite');
    console.log('═'.repeat(60));
    
    const results = testEntitySchemaPatterns();
    testParsingEdgeCases();
    
    console.log('\n✨ Validation complete!');
    
} else {
    // Export for browser testing
    window.testEntitySchemaPatterns = testEntitySchemaPatterns;
    window.testParsingEdgeCases = testParsingEdgeCases;
    console.log('📋 EntitySchema validation functions loaded. Run testEntitySchemaPatterns() or testParsingEdgeCases() in console.');
}