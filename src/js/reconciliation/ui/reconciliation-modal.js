/**
 * Reconciliation Modal Interface Module
 * Handles modal creation, user interactions, and reconciliation UI
 * @module reconciliation/ui/reconciliation-modal
 */

import { detectPropertyType, getInputFieldConfig, createInputHTML, validateInput, getSuggestedEntityTypes, setupDynamicDatePrecision, standardizeDateInput } from '../../utils/property-types.js';
import { createElement } from '../../ui/components.js';

// Functions will be moved here from reconciliation.js
// This module handles:
// - Modal opening and content creation
// - Reconciliation results display
// - High confidence match display
// - Fallback options interface
// - Custom input interface
// - Manual search setup and results
// - Expanded search functionality

// Placeholder - functions will be extracted from reconciliation.js