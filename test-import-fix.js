#!/usr/bin/env node

/**
 * Test to verify all import issues are fixed
 */

console.log('🔍 Testing import fix for displayFallbackOptions and other functions...\n');

// Mock minimal DOM for Node.js
global.document = {
    createElement: () => ({ textContent: '', innerHTML: '' }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
};

global.window = {};

async function testImports() {
    try {
        // Test 1: Import reconciliation display (where we added the missing functions)
        console.log('📦 Testing reconciliation display imports...');
        const reconciliationDisplay = await import('./src/js/reconciliation/ui/reconciliation-display.js');
        
        const requiredFunctions = [
            'displayReconciliationResults',
            'displayHighConfidenceMatches', 
            'displayFallbackOptions',
            'showCustomInputInterface',
            'setupManualSearchInFallback', 
            'displayFallbackSearchResults',
            'setupExpandedSearch'
        ];
        
        let missingFunctions = [];
        requiredFunctions.forEach(func => {
            if (typeof reconciliationDisplay[func] !== 'function') {
                missingFunctions.push(func);
            }
        });
        
        if (missingFunctions.length === 0) {
            console.log('✅ All required display functions are exported');
            requiredFunctions.forEach(func => {
                console.log(`  ✓ ${func}`);
            });
        } else {
            console.log('❌ Missing functions:', missingFunctions);
            return false;
        }
        
        // Test 2: Import reconciliation index (should re-export all functions)
        console.log('\n📦 Testing reconciliation index re-exports...');
        const reconciliationIndex = await import('./src/js/reconciliation/index.js');
        
        let missingFromIndex = [];
        requiredFunctions.forEach(func => {
            if (typeof reconciliationIndex[func] !== 'function') {
                missingFromIndex.push(func);
            }
        });
        
        if (missingFromIndex.length === 0) {
            console.log('✅ All functions are re-exported from reconciliation index');
        } else {
            console.log('❌ Functions not re-exported from index:', missingFromIndex);
            return false;
        }
        
        // Test 3: Test the functions work (basic smoke test)
        console.log('\n🧪 Testing function execution...');
        
        try {
            reconciliationDisplay.displayFallbackOptions([]);
            reconciliationDisplay.setupExpandedSearch();
            reconciliationDisplay.showCustomInputInterface('string', 'test');
            console.log('✅ Functions execute without errors');
        } catch (funcError) {
            console.log('❌ Function execution failed:', funcError.message);
            return false;
        }
        
        // Test 4: Test that steps/reconciliation.js would be able to import these
        console.log('\n📦 Testing steps/reconciliation.js import compatibility...');
        
        // This simulates what steps/reconciliation.js does
        const importedFunctions = {};
        requiredFunctions.forEach(func => {
            if (reconciliationIndex[func]) {
                importedFunctions[func] = reconciliationIndex[func];
            }
        });
        
        if (Object.keys(importedFunctions).length === requiredFunctions.length) {
            console.log('✅ All functions available for steps/reconciliation.js import');
        } else {
            console.log('❌ Some functions would not be available for import');
            return false;
        }
        
        console.log('\n🎉 All import tests passed!');
        console.log('\nSummary:');
        console.log('- All missing display functions have been added');
        console.log('- Functions are properly exported from reconciliation-display.js');
        console.log('- Functions are re-exported from reconciliation/index.js');
        console.log('- Functions execute without runtime errors');
        console.log('- Import compatibility with steps/reconciliation.js is maintained');
        
        return true;
        
    } catch (error) {
        console.error('❌ Import test failed:', error);
        console.error('\nStack trace:', error.stack);
        return false;
    }
}

// Run the test
testImports().then(success => {
    if (success) {
        console.log('\n✅ The displayFallbackOptions import error should now be fixed!');
        process.exit(0);
    } else {
        console.log('\n❌ Import issues remain. Please check the errors above.');
        process.exit(1);
    }
});