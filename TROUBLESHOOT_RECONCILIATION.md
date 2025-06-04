# Troubleshooting Reconciliation Step

## Quick Debug Steps

1. **Open the browser console** (F12 → Console tab)

2. **Run the debug function:**
   ```javascript
   window.debugReconciliation()
   ```

3. **Check what the output shows:**
   - ✅ If you see mapped keys and fetched data → the problem is in DOM manipulation
   - ❌ If mapped keys or fetched data are missing → the problem is in data flow from previous steps

4. **If data is missing, try loading mock data:**
   ```javascript
   window.loadMockReconciliationData()
   ```
   Then navigate to Step 3 again.

5. **Check for JavaScript errors:**
   - Look for red error messages in console
   - Check if the reconciliation table elements exist

## Expected Debug Output (Good)

```
🔍 RECONCILIATION DEBUG: Current state inspection
📊 mappings: {mappedKeys: Array(1), nonLinkedKeys: [], ignoredKeys: []}
📊 fetchedData: [Object] (should show your Omeka S data)
🏗️ DOM elements check:
- property-headers: <thead id="property-headers">
- reconciliation-rows: <tbody id="reconciliation-rows">
🚀 initializeReconciliation() called
✅ Validation passed - proceeding with reconciliation initialization
```

## Problematic Output (Bad)

```
📊 mappings: undefined (or empty)
📊 fetchedData: undefined (or empty)
❌ No mapped keys available for reconciliation
```

## Quick Fixes

### If no mapped keys:
1. Go back to Step 2 (Mapping)
2. Make sure at least one key is in the "Mapped Keys" section
3. Try mapping a key to a Wikidata property

### If no fetched data:
1. Go back to Step 1 (Input)
2. Re-fetch your Omeka S data
3. Make sure the fetch was successful

### If DOM elements are missing:
- Check that you're on the correct page
- Look for HTML structure issues

## Manual Testing Commands

```javascript
// 1. Check current state
window.debugReconciliation()

// 2. Load test data if needed
window.loadMockReconciliationData()

// 3. Force manual initialization
window.initializeReconciliationManually()

// 4. Check specific state parts
console.log('State:', window.state?.getState())
```