/**
 * Public API for mapping functionality
 * Re-exports all public functions from mapping modules
 * @module mapping
 */

// Core modules
export * from './core/data-analyzer.js';
export * from './core/property-searcher.js';
export * from './core/transformation-engine.js';
export * from './core/mapping-persistence.js';
export * from './core/constraint-validator.js';

// UI modules
export * from './ui/mapping-lists.js';
export * from './ui/property-modals.js';
export * from './ui/transformation-ui.js';
export * from './ui/constraint-ui.js';