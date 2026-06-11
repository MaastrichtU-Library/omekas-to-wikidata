/**
 * Public API for reconciliation functionality
 * Re-exports all reconciliation modules for easy importing
 * @module reconciliation
 */

// Re-export all public functions from core modules
export * from './core/reconciliation-data.js';
export * from './core/entity-matcher.js';
export * from './core/batch-processor.js';
export * from './core/reconciliation-progress.js';

// Re-export all public functions from UI modules
export * from './ui/reconciliation-table.js';
export * from './ui/reconciliation-modal.js';
export * from './ui/reconciliation-display.js';

// Export specific functions with correct names for backward compatibility
export { setupManualSearchInFallback as setupManualSearch } from './ui/reconciliation-display.js';