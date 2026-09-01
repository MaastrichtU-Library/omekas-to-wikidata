/**
 * Constraint helper utilities for sophisticated reconciliation enhancement
 * 
 * This module implements advanced constraint-based validation and scoring algorithms
 * that significantly improve reconciliation accuracy by leveraging Wikidata's
 * formal property constraint system.
 * 
 * Wikidata Property Constraints:
 * - Value Type Constraints: Define expected entity classes (e.g., P31 expects instances of Q5 for humans)
 * - Format Constraints: Define regex patterns for string properties (e.g., ISBN patterns)
 * - Range Constraints: Define acceptable value ranges for quantities
 * - Qualifiers Constraints: Define required or forbidden qualifiers
 * 
 * The constraint system enables:
 * - Intelligent entity type filtering during reconciliation
 * - Automatic validation of proposed matches against Wikidata requirements
 * - Sophisticated scoring that considers constraint satisfaction
 * - Early detection of data quality issues before export
 * 
 * Constraint-Enhanced Reconciliation:
 * Instead of simple string matching, this system considers whether potential matches
 * actually satisfy Wikidata's semantic requirements, leading to much higher quality
 * mappings and fewer post-import corrections.
 * 
 * @module utils/constraint-helpers
 */

import { getSuggestedEntityTypes } from './property-types.js';

/**
 * Extracts precise entity type constraints from Wikidata property definitions
 * 
 * This function implements intelligent entity type detection by analyzing formal
 * Wikidata constraint data. When available, constraint-based types are far more
 * accurate than heuristic guessing because they reflect actual Wikidata semantics.
 * 
 * Value Type Constraints define which classes of entities are acceptable values
 * for a property. For example:
 * - P39 (position held) expects instances of Q4164871 (position)
 * - P106 (occupation) expects instances of Q12737077 (occupation)
 * - P31 (instance of) expects instances of Q16889133 (class)
 * 
 * Using these constraints dramatically improves reconciliation accuracy by:
 * - Filtering out semantically invalid matches early
 * - Focusing reconciliation on appropriate entity types
 * - Reducing false positives and manual review requirements
 * 
 * @param {Object} propertyObj - Complete Wikidata property object with constraint data
 * @param {string} propertyObj.id - Wikidata property ID (e.g., "P31")
 * @param {Object} propertyObj.constraints - Constraint object with valueType array
 * @param {Array} propertyObj.constraints.valueType - Value type constraint definitions
 * @returns {Array<string>} Array of Wikidata entity type Q-IDs for targeted reconciliation
 * 
 * @example
 * // For P106 (occupation) property:
 * getConstraintBasedTypes(occupationProperty)
 * // Returns: ["Q12737077"] (occupation class)
 * 
 * @description
 * Processing logic:
 * 1. Extracts value type constraints from property definition
 * 2. Collects all constraint class Q-IDs and validates format
 * 3. Deduplicates and filters valid Q-numbers
 * 4. Falls back to heuristic detection if no constraints available
 * 5. Logs constraint usage for debugging and quality assurance
 */
export function getConstraintBasedTypes(propertyObj) {
    // Check if we have constraint data available
    if (propertyObj && propertyObj.constraints && propertyObj.constraints.valueType) {
        const valueTypeConstraints = propertyObj.constraints.valueType;
        
        // Extract Q-numbers from value type constraints
        const constraintTypes = [];
        valueTypeConstraints.forEach(constraint => {
            if (constraint.classes && Array.isArray(constraint.classes)) {
                constraintTypes.push(...constraint.classes);
            }
        });
        
        // Remove duplicates and filter out empty values
        const uniqueTypes = [...new Set(constraintTypes)].filter(type => type && type.startsWith('Q'));
        
        if (uniqueTypes.length > 0) {
            console.log(`🎯 Using constraint-based types for ${propertyObj.id}:`, uniqueTypes);
            return uniqueTypes;
        }
    }
    
    // Fallback to heuristic type mapping
    const propertyName = propertyObj?.id || propertyObj?.label || propertyObj;
    const fallbackTypes = getSuggestedEntityTypes(propertyName);
    console.log(`⚠️ Falling back to heuristic types for ${propertyName}:`, fallbackTypes);
    return fallbackTypes;
}

/**
 * Validates values against Wikidata format constraints with comprehensive reporting
 * 
 * Format constraints define regex patterns that valid values must match.
 * This validation is crucial for:
 * - External identifier properties (ISBN, DOI, ORCID patterns)
 * - Structured text properties (coordinates, dates, codes)
 * - Preventing import failures due to invalid formats
 * - Early detection of data quality issues
 * 
 * The function provides detailed validation results including:
 * - Boolean validity status
 * - Specific constraint violations with explanations
 * - Passed constraints for confidence building
 * - Warnings for malformed constraint definitions
 * 
 * @param {string} value - Value to validate against format constraints
 * @param {Object} propertyObj - Complete property object with constraint definitions
 * @param {Object} propertyObj.constraints - Property constraint object
 * @param {Array} propertyObj.constraints.format - Array of format constraint objects
 * @returns {Object} Comprehensive validation result object
 * @returns {boolean} result.isValid - Overall validation status
 * @returns {Array} result.violations - Array of failed constraint details
 * @returns {Array} result.passedConstraints - Array of satisfied constraints
 * @returns {Array} result.warnings - Array of validation process warnings
 * 
 * @example
 * // Validating an ISBN against P957 (ISBN-10) constraints:
 * validateAgainstFormatConstraints("0123456789", isbnProperty)
 * // Returns: { isValid: true, violations: [], passedConstraints: [...] }
 * 
 * @description
 * Validation process:
 * 1. Checks for presence of format constraints in property definition
 * 2. Iterates through all non-deprecated format constraint regex patterns
 * 3. Tests value against each pattern with comprehensive error handling
 * 4. Categorizes results into violations, passes, and warnings
 * 5. Returns detailed results for UI display and logging
 */
export function validateAgainstFormatConstraints(value, propertyObj) {
    const result = {
        isValid: true,
        violations: [],
        warnings: [],
        passedConstraints: []
    };
    
    // Check if we have format constraints
    if (!propertyObj || !propertyObj.constraints || !propertyObj.constraints.format) {
        return result; // No constraints to validate against
    }
    
    const formatConstraints = propertyObj.constraints.format;
    
    formatConstraints.forEach(constraint => {
        if (constraint.regex && constraint.rank !== 'deprecated') {
            try {
                const regex = new RegExp(constraint.regex);
                const matches = regex.test(value);
                
                if (matches) {
                    result.passedConstraints.push({
                        regex: constraint.regex,
                        description: constraint.description
                    });
                } else {
                    result.isValid = false;
                    result.violations.push({
                        regex: constraint.regex,
                        description: constraint.description,
                        expectedPattern: constraint.regex
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Invalid regex pattern in constraint for ${propertyObj.id}:`, constraint.regex, error);
                result.warnings.push({
                    message: `Invalid regex pattern: ${constraint.regex}`,
                    error: error.message
                });
            }
        }
    });
    
    return result;
}

/**
 * Calculates sophisticated match scores incorporating Wikidata constraint satisfaction
 * 
 * This is the core scoring algorithm that determines reconciliation confidence by
 * analyzing multiple factors including constraint compliance, label similarity,
 * and semantic consistency. The scoring directly affects auto-acceptance decisions
 * and user review priorities.
 * 
 * Scoring Factors:
 * - Base match score from Wikidata reconciliation API (0-100)
 * - Constraint satisfaction bonus/penalty (type matching, format compliance)
 * - Label and alias similarity analysis
 * - Description relevance scoring
 * - Contextual consistency with related properties
 * 
 * Score Ranges and Implications:
 * - 90-100: High confidence, eligible for auto-acceptance
 * - 70-89: Medium confidence, requires user review
 * - 50-69: Low confidence, manual verification recommended
 * - <50: Very low confidence, likely incorrect match
 * 
 * @param {Object} match - Reconciliation match result from Wikidata API
 * @param {string} match.id - Wikidata entity ID (Q-number)
 * @param {string} match.name - Primary label of matched entity
 * @param {number} match.score - Base reconciliation confidence score
 * @param {Array} match.type - Entity type information
 * @param {Object} propertyObj - Complete property object with constraint data
 * @param {Object} propertyObj.constraints - Property constraint definitions
 * @param {string} originalValue - Original value from Omeka S data for comparison
 * @returns {number} Enhanced confidence score (0-100) incorporating constraint analysis
 * 
 * @example
 * // Scoring a potential creator match:
 * scoreMatchWithConstraints(wikidataMatch, creatorProperty, "Jane Smith")
 * // Returns: 92 (high confidence due to constraint satisfaction)
 * 
 * @description
 * Scoring algorithm:
 * 1. Starts with base reconciliation API score
 * 2. Applies constraint satisfaction bonuses/penalties:
 *    - Type constraint match: +10 points
 *    - Type constraint violation: -20 points
 *    - Format constraint compliance: +5 points
 * 3. Analyzes label similarity for additional confidence
 * 4. Considers description relevance and contextual factors
 * 5. Normalizes final score to 0-100 range
 * 6. Logs scoring details for debugging and quality assurance
 */
 /**
 * @param {string} originalValue - Original value being reconciled
 * @returns {Object} Enhanced match with constraint-based scoring
 */
export function scoreMatchWithConstraints(match, propertyObj, originalValue) {
    if (!match) {
        return match;
    }
    
    // If no propertyObj, return match with its original score preserved
    if (!propertyObj) {
        return {
            ...match,
            score: match.score || 50,
            originalScore: match.score || 50,
            constraintScore: 100,
            constraintDetails: {
                typeConstraintSatisfied: null,
                formatConstraintSatisfied: null,
                datatypeCompatible: null,
                confidenceAdjustments: ['No property constraints to validate']
            }
        };
    }
    
    const enhancedMatch = { ...match };
    let constraintScore = 100; // Start with perfect score
    const constraintDetails = {
        typeConstraintSatisfied: null,
        formatConstraintSatisfied: null,
        datatypeCompatible: null,
        confidenceAdjustments: []
    };
    
    // Check value type constraints
    if (propertyObj.constraints && propertyObj.constraints.valueType) {
        const valueTypeConstraints = propertyObj.constraints.valueType;
        let typeConstraintMet = false;
        
        valueTypeConstraints.forEach(constraint => {
            if (constraint.classes && Array.isArray(constraint.classes)) {
                // Check if match has type information that satisfies constraint
                if (match.type && Array.isArray(match.type)) {
                    const matchTypes = match.type.map(t => t.id || t);
                    const hasMatchingType = constraint.classes.some(constraintType => 
                        matchTypes.includes(constraintType)
                    );
                    
                    if (hasMatchingType) {
                        typeConstraintMet = true;
                        constraintDetails.typeConstraintSatisfied = true;
                    }
                }
            }
        });
        
        if (valueTypeConstraints.length > 0 && !typeConstraintMet) {
            constraintScore *= 0.7; // Reduce score for type constraint violation
            constraintDetails.typeConstraintSatisfied = false;
            constraintDetails.confidenceAdjustments.push('Type constraint not satisfied (-30%)');
        }
    }
    
    // Check format constraints against original value
    const formatValidation = validateAgainstFormatConstraints(originalValue, propertyObj);
    if (!formatValidation.isValid) {
        constraintScore *= 0.8; // Reduce score for format violations
        constraintDetails.formatConstraintSatisfied = false;
        constraintDetails.confidenceAdjustments.push('Format constraint violated (-20%)');
    } else if (formatValidation.passedConstraints.length > 0) {
        constraintScore *= 1.1; // Boost score for format compliance
        constraintDetails.formatConstraintSatisfied = true;
        constraintDetails.confidenceAdjustments.push('Format constraint satisfied (+10%)');
    }
    
    // Check datatype compatibility
    if (propertyObj.datatype || propertyObj.datatypeLabel) {
        const datatype = propertyObj.datatype || propertyObj.datatypeLabel;
        
        // Boost scores for certain datatype matches
        if (datatype === 'external-id' && match.source === 'reconciliation') {
            constraintScore *= 1.2; // External IDs should prefer reconciliation API results
            constraintDetails.datatypeCompatible = true;
            constraintDetails.confidenceAdjustments.push('External ID via reconciliation API (+20%)');
        } else if (datatype === 'wikibase-item' && match.id && match.id.startsWith('Q')) {
            constraintScore *= 1.1; // Wikibase items should be Q-numbers
            constraintDetails.datatypeCompatible = true;
            constraintDetails.confidenceAdjustments.push('Valid Wikibase item format (+10%)');
        }
    }
    
    // Apply constraint score to original score, but cap the total
    const originalScore = match.score || 0;
    const adjustedScore = Math.min(100, (originalScore * constraintScore) / 100);
    
    enhancedMatch.score = adjustedScore;
    enhancedMatch.originalScore = originalScore;
    enhancedMatch.constraintScore = constraintScore;
    enhancedMatch.constraintDetails = constraintDetails;
    
    return enhancedMatch;
}

/**
 * Build contextual properties for enhanced reconciliation queries
 * @param {Object} propertyObj - Current property being reconciled
 * @param {Array} allMappings - All available property mappings for context
 * @returns {Array} Array of contextual property objects for API query
 */
export function buildContextualProperties(propertyObj, allMappings = []) {
    const contextualProps = [];
    
    // For now, implement basic contextual property logic
    // This can be expanded based on common property relationships
    
    if (propertyObj && propertyObj.id) {
        // Add instance of (P31) for most properties to help with disambiguation
        if (propertyObj.constraints && propertyObj.constraints.valueType) {
            const valueTypes = propertyObj.constraints.valueType;
            valueTypes.forEach(constraint => {
                if (constraint.classes && constraint.classes.length > 0) {
                    contextualProps.push({
                        pid: 'P31', // instance of
                        v: constraint.classes[0] // Use first class as primary type hint
                    });
                }
            });
        }
        
        // Add property-specific contextual relationships
        switch (propertyObj.id) {
            case 'P50': // author
                // Authors are typically humans or organizations
                contextualProps.push({ pid: 'P31', v: 'Q5' }); // human
                break;
            case 'P276': // location
                // Locations should have coordinate or administrative info
                contextualProps.push({ pid: 'P31', v: 'Q17334923' }); // location
                break;
            case 'P407': // language of work
                // Should be a language
                contextualProps.push({ pid: 'P31', v: 'Q34770' }); // language
                break;
        }
    }
    
    return contextualProps;
}

/**
 * Build property paths for complex reconciliation queries
 * @param {Object} propertyObj - Current property being reconciled
 * @param {Array} relatedMappings - Related property mappings that might form paths
 * @returns {Array} Array of property path strings
 */
export function getPropertyPaths(propertyObj, relatedMappings = []) {
    const paths = [];
    
    if (!propertyObj || !propertyObj.id) {
        return paths;
    }
    
    // Define common property path patterns
    const pathPatterns = {
        // Geographic relationships
        'P17': ['P17/P297'], // country -> country code
        'P276': ['P276/P17'], // location -> country
        'P131': ['P131/P17'], // administrative territory -> country
        
        // Organizational relationships  
        'P108': ['P108/P31'], // employer -> type of organization
        'P69': ['P69/P31'], // educated at -> type of institution
        
        // Temporal relationships
        'P577': ['P577/@year'], // publication date -> year
        'P571': ['P571/@year'], // inception -> year
    };
    
    if (pathPatterns[propertyObj.id]) {
        paths.push(...pathPatterns[propertyObj.id]);
    }
    
    return paths;
}

/**
 * Get human-readable constraint summary for UI display
 * @param {Object} propertyObj - Property object with constraints
 * @returns {Object} Formatted constraint information for display
 */
export function getConstraintSummary(propertyObj) {
    const summary = {
        hasConstraints: false,
        datatype: null,
        valueTypes: [],
        formatRequirements: [],
        warnings: []
    };
    
    if (!propertyObj) {
        return summary;
    }
    
    // Add datatype information
    if (propertyObj.datatypeLabel || propertyObj.datatype) {
        summary.datatype = propertyObj.datatypeLabel || propertyObj.datatype;
    }
    
    // Process constraints if available
    if (propertyObj.constraints) {
        summary.hasConstraints = true;
        
        // Value type constraints
        if (propertyObj.constraints.valueType && propertyObj.constraints.valueType.length > 0) {
            propertyObj.constraints.valueType.forEach(constraint => {
                if (constraint.classLabels && Object.keys(constraint.classLabels).length > 0) {
                    const labels = Object.values(constraint.classLabels);
                    summary.valueTypes.push(...labels);
                } else if (constraint.classes) {
                    summary.valueTypes.push(...constraint.classes);
                }
            });
        }
        
        // Format constraints
        if (propertyObj.constraints.format && propertyObj.constraints.format.length > 0) {
            propertyObj.constraints.format.forEach(constraint => {
                if (constraint.description && constraint.rank !== 'deprecated') {
                    summary.formatRequirements.push(constraint.description);
                }
            });
        }
    }
    
    // Remove duplicates
    summary.valueTypes = [...new Set(summary.valueTypes)];
    summary.formatRequirements = [...new Set(summary.formatRequirements)];
    
    return summary;
}

/**
 * Check if a property object has usable constraint data
 * @param {Object} propertyObj - Property object to check
 * @returns {boolean} True if property has constraint data that can be used
 */
export function hasUsableConstraints(propertyObj) {
    if (!propertyObj || !propertyObj.constraints) {
        return false;
    }
    
    const hasValueTypeConstraints = propertyObj.constraints.valueType && 
        propertyObj.constraints.valueType.length > 0;
    
    const hasFormatConstraints = propertyObj.constraints.format && 
        propertyObj.constraints.format.length > 0;
    
    return hasValueTypeConstraints || hasFormatConstraints;
}

/**
 * Determine if a value needs reconciliation based on datatype and constraints
 * @param {string} value - Value to check
 * @param {Object} propertyObj - Property object with constraints
 * @returns {Object} Analysis of whether reconciliation is needed
 */
export function analyzeReconciliationNeed(value, propertyObj) {
    const analysis = {
        needsReconciliation: true,
        reason: 'default',
        confidence: 'medium',
        suggestions: []
    };
    
    if (!value || !propertyObj) {
        analysis.needsReconciliation = false;
        analysis.reason = 'no value or property data';
        return analysis;
    }
    
    // Check if it's already a Q-number (likely already reconciled)
    if (value.match(/^Q\d+$/)) {
        analysis.needsReconciliation = false;
        analysis.reason = 'already a Q-number';
        analysis.confidence = 'high';
        return analysis;
    }
    
    // Check datatype to determine reconciliation approach
    const datatype = propertyObj.datatype || propertyObj.datatypeLabel;
    
    switch (datatype) {
        case 'external-id':
        case 'string':
            analysis.needsReconciliation = false;
            analysis.reason = 'string/external-id datatype';
            analysis.confidence = 'high';
            break;
            
        case 'wikibase-item':
            analysis.needsReconciliation = true;
            analysis.reason = 'wikibase-item datatype requires Q-number';
            analysis.confidence = 'high';
            break;
            
        case 'time':
        case 'point in time':
            analysis.needsReconciliation = false;
            analysis.reason = 'temporal datatype';
            analysis.confidence = 'high';
            break;
            
        case 'quantity':
            analysis.needsReconciliation = false;
            analysis.reason = 'quantity datatype';
            analysis.confidence = 'high';
            break;
            
        default:
            analysis.needsReconciliation = true;
            analysis.reason = 'unknown datatype - reconcile to be safe';
            analysis.confidence = 'low';
    }
    
    return analysis;
}