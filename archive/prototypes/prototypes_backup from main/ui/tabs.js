/**
 * Tab management functionality
 */

// Tab management variables
let tabCounter = 0;
let activeTabId = null;

/**
 * Creates a new tab and returns its ID
 * @param {string} title - Tab title
 * @param {string} url - URL associated with the tab
 * @param {Object} elements - DOM elements
 * @returns {string} - The ID of the created tab
 */
export function createNewTab(title, url, elements) {
    // Generate a unique tab ID
    const tabId = `tab-${tabCounter++}`;

    // Create tab element
    const tabItem = document.createElement('li');
    tabItem.className = 'tab';
    tabItem.setAttribute('data-tab-id', tabId);
    tabItem.setAttribute('data-url', url);

    // Add title
    const tabTitle = document.createElement('span');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = title;
    tabItem.appendChild(tabTitle);

    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-tab';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        removeTab(tabId, elements);
    });
    tabItem.appendChild(closeBtn);

    // Set click handler for the tab
    tabItem.addEventListener('click', function () {
        activateTab(tabId, elements);
    });

    // Create content container
    const contentItem = document.createElement('div');
    contentItem.className = 'tab-content';
    contentItem.id = tabId;

    // Add URL display
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'request-url';
    urlDisplay.innerHTML = `<strong>Request URL:</strong> <a href="${url}" target="_blank">${url}</a>`;
    contentItem.appendChild(urlDisplay);

    // Add content container
    const resultContainer = document.createElement('div');
    resultContainer.className = 'result-container';
    contentItem.appendChild(resultContainer);

    // Add tab to DOM
    elements.tabsList.appendChild(tabItem);
    elements.tabsContent.appendChild(contentItem);

    // Activate the new tab
    activateTab(tabId, elements);

    return tabId;
}

/**
 * Activates a tab by ID
 * @param {string} tabId - The ID of the tab to activate
 * @param {Object} elements - DOM elements
 */
export function activateTab(tabId, elements) {
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Remove active class from all content areas
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    const selectedTab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    const selectedContent = document.getElementById(tabId);

    if (selectedTab && selectedContent) {
        selectedTab.classList.add('active');
        selectedContent.classList.add('active');
        activeTabId = tabId;
    }
}

/**
 * Removes a tab by ID
 * @param {string} tabId - The ID of the tab to remove
 * @param {Object} elements - DOM elements
 */
export function removeTab(tabId, elements) {
    const tabToRemove = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    const contentToRemove = document.getElementById(tabId);

    if (tabToRemove && contentToRemove) {
        // If removing the active tab, activate another tab if available
        let activateNext = false;
        if (tabToRemove.classList.contains('active')) {
            activateNext = true;
        }

        // Remove the tab and content
        tabToRemove.remove();
        contentToRemove.remove();

        // If we need to activate another tab
        if (activateNext) {
            const remainingTabs = document.querySelectorAll('.tab');
            if (remainingTabs.length > 0) {
                const nextTabId = remainingTabs[0].getAttribute('data-tab-id');
                activateTab(nextTabId, elements);
            }
        }
    }
}

/**
 * Shows an error message in a specific tab
 * @param {string} message - Error message to display
 * @param {string} tabId - ID of the tab to show error in, if null uses active tab
 */
export function showError(message, tabId) {
    if (tabId) {
        // Show error in specific tab
        const tabContent = document.getElementById(tabId);
        if (!tabContent) return;

        const resultContainer = tabContent.querySelector('.result-container');
        if (resultContainer) {
            resultContainer.innerHTML = `<div class="error">${message}</div>`;
        }
    } else {
        // Show error in active tab
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;

        const resultContainer = activeTab.querySelector('.result-container');
        if (resultContainer) {
            resultContainer.innerHTML = `<div class="error">${message}</div>`;
        }
    }
}