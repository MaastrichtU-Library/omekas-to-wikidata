/**
 * Entity Matching Engine Module
 * Core reconciliation algorithms and entity matching logic
 * @module reconciliation/core/entity-matcher
 */

import { getConstraintBasedTypes, buildContextualProperties, validateAgainstFormatConstraints, scoreMatchWithConstraints, getConstraintSummary } from '../../utils/constraint-helpers.js';
import { detectPropertyType, getInputFieldConfig } from '../../utils/property-types.js';
import { createElement } from '../../ui/components.js';

/**
 * Check if a value appears to be a date
 */
export function isDateValue(value) {
    if (!value || typeof value !== 'string') {
        return false;
    }
    
    const trimmedValue = value.trim();
    
    // Common date patterns
    const datePatterns = [
        /^\d{4}$/,                              // Year only (e.g., "2023")
        /^\d{4}-\d{2}$/,                        // Year-month (e.g., "2023-06") 
        /^\d{4}-\d{2}-\d{2}$/,                  // ISO date (e.g., "2023-06-15")
        /^\d{1,2}\/\d{1,2}\/\d{4}$/,           // US format (e.g., "6/15/2023")
        /^\d{1,2}-\d{1,2}-\d{4}$/,             // Dash format (e.g., "15-6-2023")
        /^\d{1,2}\.\d{1,2}\.\d{4}$/,           // Dot format (e.g., "15.6.2023")
        /^\d{4}s$/,                             // Decade (e.g., "1990s")
        /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i, // "June 15, 2023"
        /^\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i, // "15 June 2023"
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i, // "Jun 15, 2023"
        /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i, // "15 Jun 2023"
        /^(early|mid|late)\s+\d{4}s?$/i,        // "early 2000s", "mid 1990s"
        /^c\.\s*\d{4}$/i,                       // "c. 2000" (circa)
        /^circa\s+\d{4}$/i,                     // "circa 2000"
        /^\d{4}-\d{4}$/,                        // Date range (e.g., "1990-1995")
        /^\d{4}\/\d{4}$/,                       // Date range with slash (e.g., "1990/1995")
    ];
    
    // Test against patterns
    for (const pattern of datePatterns) {
        if (pattern.test(trimmedValue)) {
            return true;
        }
    }
    
    // Try parsing with Date constructor as fallback
    const parsed = new Date(trimmedValue);
    return !isNaN(parsed.getTime()) && trimmedValue.length > 3; // Avoid matching single numbers
}

/**
 * Escape HTML characters in text
 */
export function escapeHtml(text) {
    if (text === undefined || text === null) {
        return '';
    }
    const div = createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Create automatic reconciliation function
 */
export function createAutomaticReconciliation(dependencies) {
    const { 
        reconciliationData, 
        state, 
        storeAllMatches, 
        storeEmptyMatches, 
        displayReconciliationResults,
        displayReconciliationError,
        markCellAsReconciled,
        modalUI,
        currentReconciliationCell,
        getAutoAdvanceSetting,
        reconcileNextUnprocessedCell
    } = dependencies;

    return async function performAutomaticReconciliation(value, property, itemId, valueIndex) {
        // Get property metadata from reconciliation data if available
        let propertyObj = null;
        let propData = null;
        
        if (itemId && reconciliationData[itemId] && reconciliationData[itemId].properties[property]) {
            propData = reconciliationData[itemId].properties[property];
            
            // Get property object from stored metadata
            if (propData.propertyMetadata) {
                propertyObj = propData.propertyMetadata;
            } else if (propData.manualPropertyData) {
                // For manual properties, use the property data
                propertyObj = propData.manualPropertyData.property;
            }
        }
        
        // Check if this property type requires reconciliation
        const propertyType = detectPropertyType(property);
        const inputConfig = getInputFieldConfig(propertyType);
        
        // For date properties, skip reconciliation and show date input directly
        if (propertyType === 'time' || isDateValue(value)) {
            displayReconciliationResults([], propertyType, value);
            return;
        }
        
        try {
            let matches = [];
            let hasBeenReconciled = false;
            
            // Check if we already have reconciliation data from batch reconciliation
            if (propData && propData.reconciled[valueIndex]) {
                const reconciledData = propData.reconciled[valueIndex];
                
                // Check if reconciliation has been attempted (regardless of results)
                if (reconciledData.matches !== undefined) {
                    hasBeenReconciled = true;
                    matches = reconciledData.matches || [];
                }
            }
            
            // Only fetch new matches if reconciliation has never been attempted
            if (!hasBeenReconciled) {
                
                // Validate against format constraints before making API calls
                if (propertyObj) {
                    const formatValidation = validateAgainstFormatConstraints(value, propertyObj);
                    if (!formatValidation.isValid) {
                        console.warn(`⚠️ Format constraint violation for ${propertyObj.id}:`, formatValidation.violations);
                        // Still proceed with reconciliation but log the issue
                    }
                }
                
                // Get all mapped keys for contextual property building
                const currentState = state.getState();
                const allMappings = currentState.mappings?.mappedKeys || [];
                
                // Try reconciliation API first with property object and context
                matches = await tryReconciliationApi(value, propertyObj || property, allMappings);
                
                // If no good matches, try direct Wikidata search
                if (!matches || matches.length === 0) {
                    matches = await tryDirectWikidataSearch(value);
                }
                
                // Store matches (even if empty) to track that reconciliation was attempted
                if (itemId && valueIndex !== undefined) {
                    if (matches && matches.length > 0) {
                        storeAllMatches({ itemId, property, valueIndex }, matches, matches[0]);
                    } else {
                        storeEmptyMatches({ itemId, property, valueIndex });
                    }
                }
            }
            
            // Check for 100% confidence auto-selection (Q&A requirement)
            if (matches && matches.length > 0 && matches[0].score >= 100) {
                
                // Auto-select 100% confidence match
                const perfectMatch = matches[0];
                markCellAsReconciled(currentReconciliationCell, {
                    type: 'wikidata',
                    id: perfectMatch.id,
                    label: perfectMatch.name,
                    description: perfectMatch.description,
                    qualifiers: {
                        autoAccepted: true,
                        reason: '100% confidence match',
                        score: perfectMatch.score
                    }
                });
                
                modalUI.closeModal();
                
                // Auto-advance if enabled
                if (getAutoAdvanceSetting()) {
                    setTimeout(() => {
                        reconcileNextUnprocessedCell();
                    }, 300);
                }
                return;
            }
            
            // Display results using new simplified display logic
            await displayReconciliationResults(matches, propertyType, value);
            
        } catch (error) {
            console.error('Error during automatic reconciliation:', error);
            displayReconciliationError(error);
        }
    };
}

// Circuit breaker state for API health monitoring
const circuitBreaker = {
    primaryApiFailures: 0,
    fallbackApiFailures: 0,
    lastFailureTime: 0,
    maxFailures: 5,
    resetTimeMs: 60000 // 1 minute
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a fetch request with timeout
 */
function fetchWithTimeout(url, options, timeoutMs = 30000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
        )
    ]);
}

/**
 * Check if circuit breaker should block API calls
 */
function shouldSkipApi(apiType) {
    const now = Date.now();
    const failures = apiType === 'primary' ? circuitBreaker.primaryApiFailures : circuitBreaker.fallbackApiFailures;
    
    // Reset circuit breaker if enough time has passed
    if (now - circuitBreaker.lastFailureTime > circuitBreaker.resetTimeMs) {
        circuitBreaker.primaryApiFailures = 0;
        circuitBreaker.fallbackApiFailures = 0;
        return false;
    }
    
    return failures >= circuitBreaker.maxFailures;
}

/**
 * Record API failure for circuit breaker
 */
function recordApiFailure(apiType) {
    if (apiType === 'primary') {
        circuitBreaker.primaryApiFailures++;
    } else {
        circuitBreaker.fallbackApiFailures++;
    }
    circuitBreaker.lastFailureTime = Date.now();
}

/**
 * Try Wikidata Reconciliation API with enhanced error recovery
 * Features: retry logic, timeout handling, circuit breaker, constraint-based filtering
 */
export async function tryReconciliationApi(value, propertyObj, allMappings = []) {
    // Primary endpoint - wikidata.reconci.link
    const primaryApiUrl = 'https://wikidata.reconci.link/en/api';
    // Fallback endpoint - tools.wmflabs.org
    const fallbackApiUrl = 'https://tools.wmflabs.org/openrefine-wikidata/en/api';
    
    // Get constraint-based entity types (falls back to heuristic if no constraints)
    const entityTypes = getConstraintBasedTypes(propertyObj);
    
    // Build contextual properties for better disambiguation
    const contextualProperties = buildContextualProperties(propertyObj, allMappings);
    
    const query = {
        queries: {
            q1: {
                query: value,
                type: entityTypes,
                properties: contextualProperties
            }
        }
    };
    
    const requestBody = "queries=" + encodeURIComponent(JSON.stringify(query.queries));
    
    // Retry configuration
    const maxRetries = 3;
    const baseDelayMs = 1000;
    
    /**
     * Attempt API call with retry logic
     */
    async function attemptApiCall(url, apiType, retryCount = 0) {
        // Check circuit breaker
        if (shouldSkipApi(apiType)) {
            throw new Error(`${apiType} API temporarily disabled due to repeated failures`);
        }
        
        try {
            const response = await fetchWithTimeout(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: requestBody,
                mode: 'cors'
            }, 30000); // 30 second timeout
            
            if (!response.ok) {
                // Handle specific HTTP status codes
                if (response.status === 429) {
                    throw new Error(`Rate limited (429): ${response.statusText}`);
                } else if (response.status >= 500) {
                    throw new Error(`Server error (${response.status}): ${response.statusText}`);
                } else {
                    throw new Error(`HTTP error (${response.status}): ${response.statusText}`);
                }
            }
            
            const data = await response.json();
            
            // Reset circuit breaker on success
            if (apiType === 'primary') {
                circuitBreaker.primaryApiFailures = 0;
            } else {
                circuitBreaker.fallbackApiFailures = 0;
            }
            
            return parseReconciliationResults(data, value, propertyObj);
            
        } catch (error) {
            const isRetryableError = (
                error.message.includes('timeout') ||
                error.message.includes('Rate limited') ||
                error.message.includes('Server error') ||
                error.message.includes('fetch')
            );
            
            // Retry logic with exponential backoff
            if (isRetryableError && retryCount < maxRetries) {
                const delay = baseDelayMs * Math.pow(2, retryCount) + Math.random() * 1000; // Add jitter
                console.warn(`⚠️ ${apiType} API attempt ${retryCount + 1} failed, retrying in ${Math.round(delay)}ms:`, error.message);
                
                await sleep(delay);
                return attemptApiCall(url, apiType, retryCount + 1);
            }
            
            // Record failure for circuit breaker
            recordApiFailure(apiType);
            throw error;
        }
    }
    
    // Try primary endpoint first
    try {
        return await attemptApiCall(primaryApiUrl, 'primary');
        
    } catch (primaryError) {
        console.warn(`⚠️ Primary reconciliation API exhausted retries for "${value}":`, primaryError.message);
        
        // Try fallback endpoint with its own retry logic
        try {
            return await attemptApiCall(fallbackApiUrl, 'fallback');
            
        } catch (fallbackError) {
            console.error(`❌ Both reconciliation APIs failed for "${value}":`, {
                primary: primaryError.message,
                fallback: fallbackError.message,
                circuitBreakerState: {
                    primaryFailures: circuitBreaker.primaryApiFailures,
                    fallbackFailures: circuitBreaker.fallbackApiFailures,
                    lastFailureTime: new Date(circuitBreaker.lastFailureTime).toISOString()
                }
            });
            
            // Return empty array but don't throw - let the system continue with other properties
            return [];
        }
    }
}

/**
 * Parse reconciliation API results and score them
 */
export function parseReconciliationResults(data, value, propertyObj) {
    if (!data || !data.q1 || !data.q1.result) {
        return [];
    }
    
    const results = data.q1.result;
    
    return results.map((result, index) => {
        // Ensure the result has a score - reconciliation API returns scores as 0-100
        // If no score, use position-based scoring (first result = highest score)
        if (result.score === undefined || result.score === null) {
            result.score = Math.max(100 - (index * 10), 10); // Position-based fallback
            console.log(`⚠️ No score from API for ${result.id}, using position-based score: ${result.score}`);
        }
        
        // Convert score to number if it's a string
        if (typeof result.score === 'string') {
            result.score = parseFloat(result.score);
        }
        
        // Score the match with constraint validation
        // scoreMatchWithConstraints returns an enhanced match object, not just a score
        const enhancedMatch = scoreMatchWithConstraints(result, propertyObj);
        
        // Extract the score from the enhanced match object
        if (enhancedMatch && typeof enhancedMatch === 'object') {
            return {
                id: enhancedMatch.id || result.id,
                name: enhancedMatch.name || result.name,
                description: enhancedMatch.description || result.description || '',
                score: enhancedMatch.score !== undefined ? Math.round(enhancedMatch.score) : 50,
                url: `https://www.wikidata.org/wiki/${result.id}`,
                originalScore: enhancedMatch.originalScore || result.score || 50,
                constraintScore: enhancedMatch.constraintScore || 100,
                types: result.type || [],
                features: result.features || [],
                constraintDetails: enhancedMatch.constraintDetails
            };
        } else {
            // Fallback if scoreMatchWithConstraints didn't work as expected
            const baseScore = (result.score !== undefined && !isNaN(result.score)) ? result.score : 50;
            return {
                id: result.id,
                name: result.name,
                description: result.description || '',
                score: baseScore,
                url: `https://www.wikidata.org/wiki/${result.id}`,
                originalScore: baseScore,
                constraintScore: 100,
                types: result.type || [],
                features: result.features || []
            };
        }
    }).sort((a, b) => b.score - a.score); // Sort by score descending
}

/**
 * Try direct Wikidata search as fallback with enhanced error recovery
 */
export async function tryDirectWikidataSearch(value) {
    const maxRetries = 2;
    const baseDelayMs = 500;
    
    async function attemptSearch(retryCount = 0) {
        try {
            const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(value)}&language=en&format=json&origin=*`;
            
            const response = await fetchWithTimeout(searchUrl, {}, 15000); // 15 second timeout
            
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(`Wikidata search rate limited (429): ${response.statusText}`);
                } else if (response.status >= 500) {
                    throw new Error(`Wikidata search server error (${response.status}): ${response.statusText}`);
                } else {
                    throw new Error(`Wikidata search API error: ${response.status}`);
                }
            }
            
            const data = await response.json();
            
            if (!data.search || data.search.length === 0) {
                return [];
            }
            
            return data.search.slice(0, 10).map(result => ({
                id: result.id,
                name: result.label || result.id,
                description: result.description || '',
                score: Math.round(80), // Lower base score for fallback search
                url: result.concepturi || `https://www.wikidata.org/wiki/${result.id}`,
                originalScore: 80,
                constraintScore: 1,
                types: [],
                features: [],
                fallback: true
            }));
            
        } catch (error) {
            const isRetryableError = (
                error.message.includes('timeout') ||
                error.message.includes('rate limited') ||
                error.message.includes('server error') ||
                error.message.includes('fetch')
            );
            
            // Retry logic with exponential backoff
            if (isRetryableError && retryCount < maxRetries) {
                const delay = baseDelayMs * Math.pow(2, retryCount) + Math.random() * 500; // Add jitter
                console.warn(`⚠️ Wikidata search attempt ${retryCount + 1} failed, retrying in ${Math.round(delay)}ms:`, error.message);
                
                await sleep(delay);
                return attemptSearch(retryCount + 1);
            }
            
            throw error;
        }
    }
    
    try {
        return await attemptSearch();
    } catch (error) {
        console.error('Direct Wikidata search failed after retries:', error);
        // Return empty array but don't throw - let the system continue
        return [];
    }
}