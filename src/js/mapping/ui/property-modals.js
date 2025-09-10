/**
 * Property modals UI module orchestrator
 * Maintains backward compatibility by re-exporting all modal functions
 * Individual modals are now in separate modules for better maintainability
 * @module mapping/ui/property-modals
 */

// Re-export all modal functions for backward compatibility
export * from './modals/mapping-modal.js';
export * from './modals/manual-property-modal.js';
export * from './modals/add-property-modal.js';
export * from './modals/json-modal.js';
export * from './modals/modal-helpers.js';