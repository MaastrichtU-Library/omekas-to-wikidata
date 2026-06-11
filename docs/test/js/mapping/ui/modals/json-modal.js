/**
 * JSON modal functionality for displaying raw property data
 * Handles modal for viewing raw JSON property information
 * @module mapping/ui/modals/json-modal
 */

// Import dependencies
import { createElement } from '../../../ui/components.js';

/**
 * Opens raw JSON modal
 */
export function openRawJsonModal(propertyData) {
    import('../../../ui/modal-ui.js').then(({ setupModalUI }) => {
        const modalUI = setupModalUI();
        
        // Create JSON viewer content
        const jsonContent = createElement('div', {
            className: 'raw-json-viewer'
        });
        
        const jsonPre = createElement('pre', {
            className: 'json-display'
        }, JSON.stringify(propertyData, null, 2));
        
        jsonContent.appendChild(jsonPre);
        
        // Add copy button
        const copyBtn = createElement('button', {
            className: 'copy-json-btn',
            onClick: () => {
                navigator.clipboard.writeText(JSON.stringify(propertyData, null, 2));
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy to Clipboard';
                }, 2000);
            }
        }, 'Copy to Clipboard');
        
        jsonContent.insertBefore(copyBtn, jsonPre);
        
        const buttons = [
            {
                text: 'Close',
                type: 'primary',
                callback: () => modalUI.closeModal()
            }
        ];
        
        modalUI.openModal(
            `Raw JSON Data - ${propertyData.id}`,
            jsonContent,
            buttons
        );
    });
}