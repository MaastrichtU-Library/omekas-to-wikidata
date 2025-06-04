# Reconciliation Step Debugging Guide

This guide will help systematically debug why the reconciliation step is not showing data.

## Testing Steps

### 1. Open the Application
- Open `/src/index.html` in your browser
- Open the browser Developer Tools (F12) and go to the Console tab

### 2. Check Initial Setup
Run this in the console to see the initial state:
```javascript
// Check if debugging functions are available
console.log('Debug functions available:', {
  debugReconciliation: typeof window.debugReconciliation,
  loadMockData: typeof window.loadMockReconciliationData,
  manualInit: typeof window.initializeReconciliationManually
});

// Get initial debug report
window.debugReconciliation();
```

### 3. Enable Test Mode (if needed)
If you need to navigate to step 3 without completing previous steps:
- Click on any step indicator while holding Ctrl (Windows) or Cmd (Mac)
- OR double-click any step indicator
- You should see a green "Test Mode" indicator in the top-right corner

### 4. Load Mock Data for Testing
Run this in the console to load test data:
```javascript
// Load mock data and initialize reconciliation
window.loadMockReconciliationData();
```

### 5. Navigate to Step 3
- Click on the "3 Reconciliation" step indicator
- Watch the console for debug messages

### 6. Manual Initialization (if needed)
If automatic initialization fails, try manual initialization:
```javascript
// Force manual initialization
window.initializeReconciliationManually();
```

### 7. Get Detailed Debug Report
After attempting initialization, run:
```javascript
// Get comprehensive debug info
const report = window.debugReconciliation();
console.log('Full report:', report);
```

## What to Look For

### Console Log Patterns

**✅ Normal Flow (what should happen):**
```
🔧 Setting up ReconciliationStep module
🎯 ReconciliationStep: DOM loaded, setting up event listeners
🎯 Adding click listener to step 1
🎯 Adding click listener to step 2
🎯 Adding click listener to step 3
... etc
```

**When navigating to step 3:**
```
🧭 Navigation: navigateToStep(3) called
🔄 Step changed from 2 to 3
🎯 STEP_CHANGED event received: {oldStep: 2, newStep: 3}
🎯 Entering step 3 - calling initializeReconciliation()
🚀 initializeReconciliation() called
✅ Validation passed - proceeding with reconciliation initialization
🔨 Creating reconciliation table with data: X items and Y mapped keys
🎉 Reconciliation initialization completed successfully!
```

**❌ Problem Indicators:**
- Missing DOM elements (null values in debug report)
- No fetchedData or empty fetchedData
- No mapped keys or empty mappedKeys array
- Validation failed messages
- JavaScript errors

### DOM Elements Check
The debug report should show these elements as non-null:
- `propertyHeaders`: Table header element
- `reconciliationRows`: Table body element  
- `reconciliationProgress`: Progress display element
- Navigation buttons

### State Check
The debug report should show:
- `fetchedData`: Should be an array with items
- `mappedKeys`: Should be an array with property names
- `currentStep`: Should be 3 when on reconciliation step

## Common Issues and Solutions

### Issue 1: No fetchedData
**Symptoms:** `Has fetchedData: false` in debug report
**Solution:** Use mock data: `window.loadMockReconciliationData()`

### Issue 2: No mappedKeys  
**Symptoms:** `mappedKeys count: 0` in debug report
**Solution:** Mock data includes mapped keys, or manually set them

### Issue 3: DOM Elements Missing
**Symptoms:** `null` values for DOM elements in debug report
**Solution:** Check if the HTML structure matches expected IDs

### Issue 4: STEP_CHANGED Event Not Firing
**Symptoms:** No step change logs when clicking step 3
**Solution:** Check navigation system setup

### Issue 5: Event Listeners Not Attached
**Symptoms:** No click logs when clicking step indicators
**Solution:** Check if DOM was ready when event listeners were added

## Manual Testing Commands

```javascript
// Quick test - load data and init
window.loadMockReconciliationData();

// Check current state
window.debugReconciliation();

// Force navigation to step 3
// (if navigation system is working)
document.querySelector('[data-step="3"]').click();

// Manual initialization
window.initializeReconciliationManually();
```

## Expected Results

After successful initialization, you should see:
1. Table headers with property names instead of "Properties will appear here"
2. Table rows with actual data instead of "Values will appear here after mapping"
3. Progress display showing reconciliation statistics
4. Clickable cells that open reconciliation modals

If these elements are still showing placeholder text, the initialization is not completing successfully.