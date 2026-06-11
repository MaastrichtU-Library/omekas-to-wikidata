/**
 * ShEx Libraries Vendor Bundle
 * This file provides ES module exports for the @shexjs libraries
 * Downloaded locally to avoid external dependencies
 */

// Browser-compatible module loading helper
const loadModule = (modulePath) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = () => resolve(window);
    script.onerror = reject;
    script.src = modulePath;
    document.head.appendChild(script);
  });
};

// Helper to simulate CommonJS require for the ShEx libraries
if (typeof window !== 'undefined' && typeof window.require === 'undefined') {
  window.require = function(path) {
    // Map the require paths to our local modules
    if (path === './lib/ShExJison') {
      // This will be loaded from the ShExJison.js file
      return window.ShExJison || {};
    }
    throw new Error(`Module not found: ${path}`);
  };
  
  // Set up module.exports simulation
  window.module = window.module || {};
  window.module.exports = window.module.exports || {};
}

// Load and export the ShEx parser
let ShExParser = null;
let ShExUtil = null;

// Initialize libraries
const initLibraries = async () => {
  try {
    // Load ShExJison first (dependency)
    await loadModule('./vendor/lib/ShExJison.js');
    
    // Load main parser
    await loadModule('./vendor/shex-parser.js');
    ShExParser = window.ShExParserCjsModule;
    
    // Load utilities
    await loadModule('./vendor/shexjs-util.js');
    ShExUtil = window.ShExUtil; // Assuming the util library exposes this way
    
  } catch (error) {
    console.error('Failed to load ShEx libraries:', error);
    throw error;
  }
};

// ES Module exports
export { ShExParser, ShExUtil, initLibraries };

// Default export with initialization
export default {
  ShExParser,
  ShExUtil,
  initLibraries
};