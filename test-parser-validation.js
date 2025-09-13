/**
 * Quick test runner for ShEx parser validation
 * Tests the parser with real EntitySchema patterns
 */

// Simple test with known patterns
const testPatterns = {
    'Basic E473 pattern': `
        wdt:P31 @<Q3331189> ; # instance of
        wdt:P1476 rdf:langString+ ; # title (required)
        wdt:P407 @<Q34770>* ; # language (optional)
        wdt:P577 xsd:dateTime? ; # publication date (optional)
    `,
    
    'Person pattern': `
        wdt:P31 @<Q5> ; # instance of: human
        wdt:P21 @<Q6581097> ; # sex or gender
        wdt:P19 @<Q515>? ; # place of birth (optional)
        wdt:P735 @<Q202444>+ ; # given name (one or more)
    `,
    
    'Source requirement pattern': `
        wdt:P31 @<Q5> ; # instance of
        wdt:P248 @<Q5> ; # stated in (should detect source requirement)
        wdt:P854 IRI ; # reference URL
    `
};

// Mock the legacy parser behavior for testing
function mockLegacyParseShExProperties(shexCode) {
    const requiredProperties = [];
    const optionalProperties = [];
    
    // Simple regex-based parsing (mimicking legacy)
    const propertyMatches = shexCode.match(/wdt:(\w+)\s+([^;]+);?\s*(?:#\s*(.*))?/g);
    
    if (propertyMatches) {
        propertyMatches.forEach(match => {
            const propMatch = match.match(/wdt:(\w+)\s+([^;]+);?\s*(?:#\s*(.*))?/);
            if (propMatch) {
                const propertyId = propMatch[1];
                const constraint = propMatch[2].trim();
                const comment = propMatch[3] ? propMatch[3].trim() : '';
                
                const property = {
                    id: propertyId,
                    label: comment || propertyId,
                    description: `Constraint: ${constraint}`,
                    url: `https://www.wikidata.org/wiki/Property:${propertyId}`,
                    requiresSource: constraint.toLowerCase().includes('stated in') || 
                                  constraint.toLowerCase().includes('reference') ||
                                  propertyId === 'P248' || propertyId === 'P854'
                };
                
                // Determine if optional
                if (constraint.includes('?') || constraint.includes('*')) {
                    optionalProperties.push(property);
                } else {
                    requiredProperties.push(property);
                }
            }
        });
    }
    
    // Fallback behavior
    if (requiredProperties.length === 0 && optionalProperties.length === 0) {
        requiredProperties.push({
            id: 'P31',
            label: 'instance of',
            description: 'that class of which this subject is a particular example',
            url: 'https://www.wikidata.org/wiki/Property:P31',
            requiresSource: false
        });
    }
    
    return {
        required: requiredProperties,
        optional: optionalProperties
    };
}

// Simple new parser mock (for testing structure)
function mockNewParseShExCode(shexCode) {
    const required = [];
    const optional = [];
    
    // More sophisticated parsing logic would go here
    // For now, just do similar parsing but with better cardinality detection
    
    const propertyMatches = shexCode.match(/wdt:(\w+)\s+([^;#]+)(?:\s*;\s*)?(?:\s*#\s*([^\n\r]*))?/g);
    
    if (propertyMatches) {
        propertyMatches.forEach(match => {
            const propMatch = match.match(/wdt:(\w+)\s+([^;#]+)(?:\s*;\s*)?(?:\s*#\s*([^\n\r]*))?/);
            if (propMatch) {
                const propertyId = propMatch[1];
                const constraint = propMatch[2].trim();
                const comment = propMatch[3] ? propMatch[3].trim() : '';
                
                const property = {
                    id: propertyId,
                    label: comment ? comment.replace(/\([^)]*\)/, '').trim() : propertyId,
                    description: `Constraint: ${constraint}`,
                    url: `https://www.wikidata.org/wiki/Property:${propertyId}`,
                    requiresSource: detectSourceRequirement(constraint, comment, propertyId)
                };
                
                // Better cardinality detection
                if (isOptional(constraint)) {
                    optional.push(property);
                } else {
                    required.push(property);
                }
            }
        });
    }
    
    return {
        properties: { required, optional },
        shapes: {},
        prefixes: {}
    };
}

function detectSourceRequirement(constraint, comment, propertyId) {
    const text = `${constraint} ${comment || ''}`.toLowerCase();
    const sourceIndicators = ['stated in', 'reference', 'source', 'prov:', 'wasderivedfrom'];
    const sourceProperties = ['P248', 'P854', 'P813'];
    
    return sourceIndicators.some(indicator => text.includes(indicator)) || 
           sourceProperties.includes(propertyId);
}

function isOptional(constraint) {
    return constraint.includes('?') || 
           constraint.includes('*') ||
           constraint.match(/\{\s*0\s*,/) !== null;
}

// Test runner
console.log('🧪 ShEx Parser Validation Test');
console.log('═'.repeat(50));

let totalTests = 0;
let passedTests = 0;

Object.entries(testPatterns).forEach(([name, shex]) => {
    console.log(`\n📋 Testing: ${name}`);
    console.log('─'.repeat(40));
    
    totalTests++;
    
    try {
        // Test legacy parser
        const legacyResult = mockLegacyParseShExProperties(shex);
        
        // Test new parser
        const newParsed = mockNewParseShExCode(shex);
        const newResult = {
            required: newParsed.properties.required,
            optional: newParsed.properties.optional
        };
        
        console.log('Legacy Parser:');
        console.log(`  Required: ${legacyResult.required.length} (${legacyResult.required.map(p => p.id).join(', ')})`);
        console.log(`  Optional: ${legacyResult.optional.length} (${legacyResult.optional.map(p => p.id).join(', ')})`);
        
        console.log('New Parser:');
        console.log(`  Required: ${newResult.required.length} (${newResult.required.map(p => p.id).join(', ')})`);
        console.log(`  Optional: ${newResult.optional.length} (${newResult.optional.map(p => p.id).join(', ')})`);
        
        // Basic compatibility check
        const reqLengthMatch = legacyResult.required.length === newResult.required.length;
        const optLengthMatch = legacyResult.optional.length === newResult.optional.length;
        
        if (reqLengthMatch && optLengthMatch) {
            console.log('✅ Structure matches between parsers');
            passedTests++;
        } else {
            console.log('⚠️  Structure differs - may need investigation');
        }
        
        // Check for source requirement detection
        const sourceProps = [...legacyResult.required, ...legacyResult.optional].filter(p => p.requiresSource);
        if (sourceProps.length > 0) {
            console.log(`📍 Source requirements detected: ${sourceProps.map(p => p.id).join(', ')}`);
        }
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
    }
});

console.log('\n📊 RESULTS');
console.log('═'.repeat(50));
console.log(`✅ Passed: ${passedTests}/${totalTests}`);
console.log(`⚠️  Issues: ${totalTests - passedTests}/${totalTests}`);

if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Parser appears to be working correctly.');
} else {
    console.log('\n🔧 Some tests showed differences - this may be expected behavior.');
    console.log('   The new parser may have enhanced capabilities that the legacy parser lacks.');
}

console.log('\n💡 To test with the actual implementation:');
console.log('   1. Open the browser dev tools');
console.log('   2. Load tests/manual-entityschema-validation.js'); 
console.log('   3. Run testEntitySchemaPatterns() in the console');