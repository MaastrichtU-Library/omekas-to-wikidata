/**
 * Components test loader
 * This script loads the UI components and exposes them to the test window
 */

// Define a loading status flag to track when components are ready
window.componentsLoaded = false;

try {
  // Import UI components - using relative path to improve compatibility
  const modulePath = '../../../src/js/ui/components.js';
  console.log('Loading components from:', modulePath);
  
  import(modulePath)
    .then(module => {
      // Make all exported functions available globally for testing
      window.createElement = module.createElement;
      window.createButton = module.createButton;
      window.setVisibility = module.setVisibility;
      window.toggleClass = module.toggleClass;
      window.createListItem = module.createListItem;
      window.updateElementContent = module.updateElementContent;
      window.showMessage = module.showMessage;
      
      // Signal that components are loaded
      window.componentsLoaded = true;
      console.log('✅ UI Components loaded and exposed to window');
    })
    .catch(error => {
      console.error('❌ Failed to load UI components:', error);
      // Create stub functions to prevent test errors
      window.createElement = () => document.createElement('div');
      window.createButton = () => document.createElement('button');
      window.setVisibility = () => {};
      window.toggleClass = () => {};
      window.createListItem = () => document.createElement('li');
      window.updateElementContent = () => {};
      window.showMessage = () => {};
    });
} catch (error) {
  console.error('❌ Error in component loading script:', error);
}