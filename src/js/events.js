/**
 * Event system for application-wide communication
 * Implements a publish/subscribe pattern to decouple modules
 * @module events
 * @example
 * // Subscribe to events
 * import { eventSystem } from './events.js';
 * 
 * // Simple subscription
 * const unsubscribe = eventSystem.subscribe('data-loaded', (data) => {
 *   console.log('Data loaded:', data);
 * });
 * 
 * // Multiple subscriptions
 * const unsubscribeAll = eventSystem.subscribeMultiple({
 *   'data-loaded': handleDataLoaded,
 *   'error-occurred': handleError,
 *   'step-changed': handleStepChange
 * });
 * 
 * // Publish events
 * eventSystem.publish('data-loaded', { items: [], total: 100 });
 * eventSystem.publish('step-changed', { from: 1, to: 2 });
 * 
 * // Clean up subscriptions
 * unsubscribe();
 * unsubscribeAll();
 */

export function createEventSystem() {
    const subscribers = {};

    /**
     * Subscribe to an event
     * @param {string} event - Name of the event to subscribe to
     * @param {Function} callback - Function to call when event is published
     * @returns {Function} Unsubscribe function
     * @example
     * const unsubscribe = eventSystem.subscribe('mapping-updated', (mappingData) => {
     *   console.log('Mapping updated:', mappingData.property);
     *   updateUI(mappingData);
     * });
     * 
     * // Later, unsubscribe
     * unsubscribe();
     */
    function subscribe(event, callback) {
        if (!subscribers[event]) {
            subscribers[event] = [];
        }
        
        subscribers[event].push(callback);
        
        // Return unsubscribe function
        return () => {
            subscribers[event] = subscribers[event].filter(cb => cb !== callback);
        };
    }
    
    /**
     * Publish an event
     * @param {string} event - Name of the event to publish
     * @param {any} data - Data to pass to subscribers
     * @example
     * // Notify subscribers of reconciliation progress
     * eventSystem.publish('reconciliation-progress', {
     *   completed: 25,
     *   total: 100,
     *   itemId: 'item-123'
     * });
     * 
     * // Notify of validation errors
     * eventSystem.publish('validation-error', {
     *   field: 'api-url',
     *   message: 'Invalid URL format'
     * });
     */
    function publish(event, data) {
        if (!subscribers[event]) {
            return;
        }
        
        subscribers[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event subscriber for ${event}:`, error);
            }
        });
    }
    
    /**
     * Subscribe to multiple events at once
     * @param {Object} subscriptions - Object with event names as keys and callbacks as values
     * @returns {Function} Function that unsubscribes from all events
     */
    function subscribeMultiple(subscriptions) {
        const unsubscribers = Object.entries(subscriptions).map(
            ([event, callback]) => subscribe(event, callback)
        );
        
        return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }
    
    /**
     * Common application events
     */
    const Events = {
        // Navigation events
        STEP_CHANGED: 'step:changed',
        STEP_COMPLETED: 'step:completed',
        NAVIGATION_REQUESTED: 'navigation:requested',
        
        // State events
        STATE_CHANGED: 'state:changed',
        STATE_RESET: 'state:reset',
        STATE_IMPORTED: 'state:imported',
        STATE_EXPORTED: 'state:exported',
        
        // Step-specific events
        DATA_FETCHED: 'data:fetched',
        EXAMPLE_SELECTED: 'example:selected',
        MAPPING_UPDATED: 'mapping:updated',
        RECONCILIATION_UPDATED: 'reconciliation:updated',
        DESIGNER_UPDATED: 'designer:updated',
        EXPORT_GENERATED: 'export:generated',
        
        // UI events
        UI_MODAL_OPENED: 'ui:modal:opened',
        UI_MODAL_CLOSED: 'ui:modal:closed',
        UI_TEST_MODE_CHANGED: 'ui:testMode:changed',
        
        // Data events
        VALIDATION_FAILED: 'validation:failed',
        VALIDATION_SUCCEEDED: 'validation:succeeded'
    };
    
    return {
        subscribe,
        publish,
        subscribeMultiple,
        Events
    };
}

// Create and export a singleton instance
export const eventSystem = createEventSystem();