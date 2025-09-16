/**
 * Interactive JSON display functionality for rich data visualization
 * Provides collapsible, clickable JSON viewer with URL detection and navigation
 * @module prototypes/utils/interactive-json
 */
import { isUrl, isApiUrl, isArkIdentifier, getArkUrl, getResourceNameFromUrl } from './url-utils.js';
import { loadUrlInTab } from '../api/fetch.js';
import { createNewTab } from '../ui/tabs.js';

// Click delay timer to handle click vs double-click
let clickTimer = null;
const clickDelay = 250; // milliseconds

/**
 * Creates an interactive JSON display with collapsible structure and clickable URLs
 * Recursively builds a hierarchical view with expand/collapse functionality,
 * automatic URL detection, and smart click handling for navigation
 * @param {any} data - Data to display (objects, arrays, strings, numbers, etc.)
 * @param {number} [indent=0] - Current indentation level for nested display
 * @returns {HTMLElement} Interactive JSON element with click handlers and styling
 * @example
 * const jsonView = createInteractiveJson({
 *   title: "Example",
 *   url: "https://example.com",
 *   items: [1, 2, 3]
 * });
 * document.body.appendChild(jsonView);
 */
export function createInteractiveJson(data, indent = 0) {
    const container = document.createElement('div');

    if (Array.isArray(data)) {
        // Handle array
        const arrayContainer = document.createElement('div');
        const jsonLine = document.createElement('div');
        jsonLine.className = 'json-line';

        const header = document.createElement('span');
        header.className = 'collapsible';
        header.textContent = `Array(${data.length})`;

        // Use a single click handler with a delay to distinguish between clicks
        header.addEventListener('click', function(e) {
            // If it's a double-click, handle it and clear any pending single-click
            if (e.detail === 2) {
                e.stopPropagation();
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                const willShow = !this.classList.contains('expanded');
                toggleAllNested(this, willShow);
            }
            // If it's a single-click, set a timer before handling it
            else if (e.detail === 1) {
                const headerElement = this;
                if (clickTimer) {
                    clearTimeout(clickTimer);
                }
                clickTimer = setTimeout(() => {
                    const contentId = headerElement.getAttribute('data-content-id');
                    const contentElem = document.getElementById(contentId);

                    if (contentElem) {
                        headerElement.classList.toggle('expanded');
                        contentElem.style.display = contentElem.style.display === 'none' ? 'block' : 'none';
                    }
                    clickTimer = null;
                }, clickDelay);
            }
        });

        jsonLine.appendChild(header);
        arrayContainer.appendChild(jsonLine);

        // Create unique ID for linking header to content
        const contentId = 'json-content-array-' + Math.random().toString(36).substr(2, 9);

        // Set data attribute on header
        header.setAttribute('data-content-id', contentId);

        const content = document.createElement('div');
        content.id = contentId;
        content.className = 'json-content';
        content.style.display = 'none';
        content.style.paddingLeft = '20px';

        data.forEach((item, index) => {
            const itemContainer = document.createElement('div');
            const jsonLine = document.createElement('div');
            jsonLine.className = 'json-line';

            const indexSpan = document.createElement('span');
            indexSpan.className = 'json-key';
            indexSpan.textContent = `${index}: `;
            jsonLine.appendChild(indexSpan);

            // Always handle in the same way, the recursive function will determine rendering
            jsonLine.appendChild(createInteractiveJson(item, indent + 1));

            itemContainer.appendChild(jsonLine);
            content.appendChild(itemContainer);
        });

        arrayContainer.appendChild(content);
        container.appendChild(arrayContainer);
    } else if (data !== null && typeof data === 'object') {
        // Handle object
        const objContainer = document.createElement('div');
        const jsonLine = document.createElement('div');
        jsonLine.className = 'json-line';

        const header = document.createElement('span');
        header.className = 'collapsible';
        header.textContent = 'Object';

        // Use a single click handler with a delay to distinguish between clicks
        header.addEventListener('click', function(e) {
            // If it's a double-click, handle it and clear any pending single-click
            if (e.detail === 2) {
                e.stopPropagation();
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                const willShow = !this.classList.contains('expanded');
                toggleAllNested(this, willShow);
            }
            // If it's a single-click, set a timer before handling it
            else if (e.detail === 1) {
                const headerElement = this;
                if (clickTimer) {
                    clearTimeout(clickTimer);
                }
                clickTimer = setTimeout(() => {
                    const contentId = headerElement.getAttribute('data-content-id');
                    const contentElem = document.getElementById(contentId);

                    if (contentElem) {
                        headerElement.classList.toggle('expanded');
                        contentElem.style.display = contentElem.style.display === 'none' ? 'block' : 'none';
                    }
                    clickTimer = null;
                }, clickDelay);
            }
        });

        jsonLine.appendChild(header);
        objContainer.appendChild(jsonLine);

        // Create unique ID for linking header to content
        const contentId = 'json-content-obj-' + Math.random().toString(36).substr(2, 9);

        // Set data attribute on header
        header.setAttribute('data-content-id', contentId);

        const content = document.createElement('div');
        content.id = contentId;
        content.className = 'json-content';
        content.style.display = 'none';
        content.style.paddingLeft = '20px';

        Object.keys(data).forEach(key => {
            const propertyContainer = document.createElement('div');
            const jsonLine = document.createElement('div');
            jsonLine.className = 'json-line';

            const keySpan = document.createElement('span');
            keySpan.className = 'json-key';
            keySpan.textContent = `${key}: `;
            jsonLine.appendChild(keySpan);

            // Special handling for URL strings
            if (typeof data[key] === 'string' && (isUrl(data[key]) || isArkIdentifier(data[key]))) {
                const valueSpan = document.createElement('span');
                valueSpan.className = 'json-string';

                const isArk = isArkIdentifier(data[key]);
                const url = isArk ? getArkUrl(data[key]) : data[key];
                const baseUrl = document.getElementById('baseUrl').value.trim();
                const isApi = !isArk && isApiUrl(url, baseUrl);

                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.textContent = `"${data[key]}"`; // Show original text
                link.className = isApi ? 'json-string api-link' : (isArk ? 'json-string ark-link' : 'json-string');
                if (isArk) {
                    link.title = 'ARK identifier - Click to resolve';
                }
                valueSpan.appendChild(link);

                // Create action buttons container
                const actionBtns = document.createElement('span');
                actionBtns.className = 'action-buttons';

                // Regular link button
                const linkBtn = document.createElement('a');
                linkBtn.href = url;
                linkBtn.target = '_blank';
                linkBtn.className = 'json-link-btn';
                linkBtn.title = 'Open in new tab';
                linkBtn.textContent = '🔗';
                linkBtn.style.marginLeft = '5px';
                linkBtn.style.fontSize = '12px';
                actionBtns.appendChild(linkBtn);

                // If it's an API URL, add a button to load it in a new tab
                if (isApi) {
                    const apiBtn = document.createElement('a');
                    apiBtn.href = '#';
                    apiBtn.className = 'api-btn';
                    apiBtn.title = 'Load this API endpoint in a new tab';
                    apiBtn.textContent = '🔍'; // Magnifying glass
                    apiBtn.style.marginLeft = '5px';
                    apiBtn.style.cursor = 'pointer';
                    apiBtn.style.textDecoration = 'none';
                    apiBtn.style.fontSize = '14px';

                    apiBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();

                        // Create a new tab and load the API URL directly
                        const elements = {
                            tabsList: document.getElementById('tabs-list'),
                            tabsContent: document.getElementById('tabs-content'),
                            loadingDiv: document.getElementById('loading')
                        };
                        const tabId = createNewTab(getResourceNameFromUrl(url), url, elements);
                        loadUrlInTab(url, tabId, elements);
                    });

                    actionBtns.appendChild(apiBtn);
                }

                valueSpan.appendChild(actionBtns);
                jsonLine.appendChild(valueSpan);
            } else {
                // For all other values, use the recursive function
                jsonLine.appendChild(createInteractiveJson(data[key], indent + 1));
            }

            propertyContainer.appendChild(jsonLine);
            content.appendChild(propertyContainer);
        });

        objContainer.appendChild(content);
        container.appendChild(objContainer);
    } else {
        // Handle primitive values
        const valueSpan = document.createElement('span');
        if (typeof data === 'string') {
            valueSpan.className = 'json-string';

            // Check if the string is a URL or ARK identifier
            if (isUrl(data) || isArkIdentifier(data)) {
                const isArk = isArkIdentifier(data);
                const url = isArk ? getArkUrl(data) : data;
                const baseUrl = document.getElementById('baseUrl').value.trim();
                const isApi = !isArk && isApiUrl(url, baseUrl);

                // Create a link if it's a URL or ARK
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.textContent = `"${data}"`; // Show original text
                link.className = isApi ? 'json-string api-link' : (isArk ? 'json-string ark-link' : 'json-string');
                if (isArk) {
                    link.title = 'ARK identifier - Click to resolve';
                }
                valueSpan.appendChild(link);

                // If it's an API URL, add action buttons
                if (isApi) {
                    // API button - load in new tab
                    const apiBtn = document.createElement('a');
                    apiBtn.href = '#';
                    apiBtn.className = 'api-btn';
                    apiBtn.title = 'Load this API endpoint in a new tab';
                    apiBtn.textContent = '🔍'; // Magnifying glass
                    apiBtn.style.marginLeft = '5px';
                    apiBtn.style.cursor = 'pointer';
                    apiBtn.style.textDecoration = 'none';
                    apiBtn.style.fontSize = '14px';

                    apiBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();

                        // Create a new tab and load the API URL directly
                        const elements = {
                            tabsList: document.getElementById('tabs-list'),
                            tabsContent: document.getElementById('tabs-content'),
                            loadingDiv: document.getElementById('loading')
                        };
                        const tabId = createNewTab(getResourceNameFromUrl(url), url, elements);
                        loadUrlInTab(url, tabId, elements);
                    });

                    valueSpan.appendChild(apiBtn);
                }
            } else {
                valueSpan.textContent = `"${data}"`;
            }
        } else if (typeof data === 'number') {
            valueSpan.className = 'json-number';
            valueSpan.textContent = data;
        } else if (typeof data === 'boolean') {
            valueSpan.className = 'json-boolean';
            valueSpan.textContent = data;
        } else if (data === null) {
            valueSpan.className = 'json-null';
            valueSpan.textContent = 'null';
        }
        container.appendChild(valueSpan);
    }

    return container;
}

/**
 * Toggles all nested JSON content
 * @param {HTMLElement} element - Header element
 * @param {boolean} show - Whether to show or hide content
 */
export function toggleAllNested(element, show) {
    // Get content ID directly from the element
    const contentId = element.getAttribute('data-content-id');
    if (!contentId) return;

    const contentContainer = document.getElementById(contentId);
    if (!contentContainer) return;

    // Toggle this content
    contentContainer.style.display = show ? 'block' : 'none';
    if (show) {
        element.classList.add('expanded');
    } else {
        element.classList.remove('expanded');
    }

    // Find and toggle all nested collapsible elements
    const nestedCollapsibles = contentContainer.querySelectorAll('.collapsible');
    nestedCollapsibles.forEach(nestedHeader => {
        // Reuse the same function for all nested elements
        toggleAllNested(nestedHeader, show);
    });
}