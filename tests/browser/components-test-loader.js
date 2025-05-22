/**
 * Components test loader
 * This script loads the UI components and exposes them to the test window
 */

// Import UI components - using absolute path to avoid path issues
import { 
  createElement, 
  createButton,
  setVisibility,
  toggleClass,
  createListItem,
  updateElementContent,
  showMessage
} from '/src/js/ui/components.js';

// Make them available globally for testing
window.createElement = createElement;
window.createButton = createButton;
window.setVisibility = setVisibility;
window.toggleClass = toggleClass;
window.createListItem = createListItem;
window.updateElementContent = updateElementContent;
window.showMessage = showMessage;

// Signal that components are loaded
console.log('UI Components loaded and exposed to window');