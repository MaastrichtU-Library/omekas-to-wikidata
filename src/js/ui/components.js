/**
 * UI component utilities for DOM manipulation
 * Contains reusable UI component functions to separate UI logic from business logic
 * @module ui/components
 */

/**
 * Create a DOM element with attributes and content
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set on the element
 * @param {string|Element|Array} content - Content to append to the element
 * @returns {HTMLElement} The created element
 */
export function createElement(tag, attrs = {}, content = null) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else if (key === 'style' && typeof value === 'object') {
            Object.entries(value).forEach(([styleKey, styleValue]) => {
                element.style[styleKey] = styleValue;
            });
        } else if (key.startsWith('on') && typeof value === 'function') {
            const eventName = key.slice(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Add content
    if (content) {
        if (Array.isArray(content)) {
            content.forEach(item => {
                if (typeof item === 'string') {
                    element.appendChild(document.createTextNode(item));
                } else if (item instanceof Element) {
                    element.appendChild(item);
                }
            });
        } else if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Element) {
            element.appendChild(content);
        }
    }
    
    return element;
}

/**
 * Create a button element with standardized styling
 * @param {string} text - Button text
 * @param {Object} options - Button options including type, onClick, etc.
 * @returns {HTMLButtonElement} The created button
 */
export function createButton(text, options = {}) {
    const { 
        type = 'secondary', 
        onClick, 
        disabled = false,
        id = null
    } = options;
    
    const buttonClasses = type === 'primary' 
        ? 'button button--primary primary-button'
        : type === 'test'
            ? 'button button--test test-button'
            : 'button button--secondary secondary-button';
    
    const buttonContent = text;
    
    return createElement('button', {
        className: buttonClasses,
        id: id,
        disabled: disabled,
        onClick: onClick
    }, buttonContent);
}

/**
 * Update element visibility
 * @param {HTMLElement} element - Element to update
 * @param {boolean} visible - Whether element should be visible
 */
export function setVisibility(element, visible) {
    if (!element) return;
    
    element.style.display = visible ? '' : 'none';
}

/**
 * Toggle a class on an element
 * @param {HTMLElement} element - Element to update
 * @param {string} className - Class to toggle
 * @param {boolean} force - If provided, add class when true, remove when false
 * @returns {boolean} Whether class is now present
 */
export function toggleClass(element, className, force) {
    if (!element) return false;
    
    if (force === undefined) {
        return element.classList.toggle(className);
    } else {
        if (force) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
        return force;
    }
}

/**
 * Create a list item element
 * @param {string|Element} content - Content for the list item
 * @param {Object} options - Options for the list item
 * @returns {HTMLLIElement} The created list item
 */
export function createListItem(content, options = {}) {
    const { 
        className = '', 
        onClick = null,
        isPlaceholder = false
    } = options;
    
    const listClass = isPlaceholder 
        ? 'placeholder' 
        : onClick ? `${className} clickable` : className;
    
    return createElement('li', {
        className: listClass,
        onClick: onClick
    }, content);
}

/**
 * Clear an element's contents and add new content
 * @param {HTMLElement} element - Element to update
 * @param {string|Element|Array} content - New content
 */
export function updateElementContent(element, content) {
    if (!element) return;
    
    // Clear existing content
    element.innerHTML = '';
    
    // Add new content
    if (content) {
        if (Array.isArray(content)) {
            content.forEach(item => {
                if (typeof item === 'string') {
                    element.appendChild(document.createTextNode(item));
                } else if (item instanceof Element) {
                    element.appendChild(item);
                }
            });
        } else if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Element) {
            element.appendChild(content);
        }
    }
}

/**
 * Create an input element with standardized attributes
 * @param {string} type - Input type (text, file, email, etc.)
 * @param {Object} options - Input options including placeholder, value, onChange, etc.
 * @returns {HTMLInputElement} The created input element
 */
export function createInput(type = 'text', options = {}) {
    const {
        placeholder = '',
        value = '',
        onChange = null,
        accept = null,
        multiple = false,
        required = false,
        id = null,
        className = '',
        name = null
    } = options;

    const attrs = {
        type: type,
        placeholder: placeholder,
        value: value,
        id: id,
        name: name,
        className: className,
        required: required
    };

    if (accept && type === 'file') {
        attrs.accept = accept;
    }

    if (multiple && type === 'file') {
        attrs.multiple = multiple;
    }

    if (onChange) {
        attrs.onChange = onChange;
    }

    return createElement('input', attrs);
}

/**
 * Create a modal container with standardized structure
 * @param {Object} options - Modal options including content, className, etc.
 * @returns {HTMLDivElement} The created modal container
 */
export function createModal(options = {}) {
    const {
        className = 'modal',
        content = null,
        overlay = true,
        closeOnOverlayClick = true
    } = options;

    const modal = createElement('div', {
        className: className
    });

    if (overlay) {
        const modalOverlay = createElement('div', {
            className: 'modal-overlay',
            onClick: closeOnOverlayClick ? () => modal.remove() : null
        });

        const modalContent = createElement('div', {
            className: 'modal-content',
            onClick: (e) => e.stopPropagation()
        }, content);

        modalOverlay.appendChild(modalContent);
        modal.appendChild(modalOverlay);
    } else {
        modal.appendChild(content);
    }

    return modal;
}

/**
 * Create a file input element with standardized behavior
 * @param {Object} options - File input options
 * @returns {HTMLInputElement} The created file input element
 */
export function createFileInput(options = {}) {
    const {
        accept = '*/*',
        multiple = false,
        onChange = null,
        id = null,
        className = 'file-input',
        hidden = false
    } = options;

    return createInput('file', {
        accept: accept,
        multiple: multiple,
        onChange: onChange,
        id: id,
        className: hidden ? `${className} hidden` : className
    });
}

/**
 * Create an anchor element for downloads
 * @param {string} href - The download URL or data URL
 * @param {string} filename - The filename for download
 * @param {Object} options - Additional options
 * @returns {HTMLAnchorElement} The created anchor element
 */
export function createDownloadLink(href, filename, options = {}) {
    const {
        text = filename,
        className = 'download-link',
        onClick = null
    } = options;

    return createElement('a', {
        href: href,
        download: filename,
        className: className,
        onClick: onClick
    }, text);
}

/**
 * Show a simple alert/toast message
 * @param {string} message - Message to display
 * @param {string} type - Message type (info, success, warning, error)
 * @param {number} duration - Time in ms to show the message (0 for permanent)
 */
export function showMessage(message, type = 'info', duration = 3000) {
    // Remove any existing message elements
    const existingMessages = document.querySelectorAll('.message-toast');
    existingMessages.forEach(el => el.remove());
    
    // Create new message element
    const messageElement = createElement('div', {
        className: `message-toast message-toast--${type}`
    }, message);
    
    // Add to document
    document.body.appendChild(messageElement);
    
    // Animate in
    setTimeout(() => {
        messageElement.classList.add('visible');
    }, 10);
    
    // Remove after duration (if not permanent)
    if (duration > 0) {
        setTimeout(() => {
            messageElement.classList.remove('visible');
            setTimeout(() => messageElement.remove(), 300);
        }, duration);
    } else {
        // Add close button for permanent messages
        const closeButton = createElement('button', {
            className: 'message-close',
            onClick: () => {
                messageElement.classList.remove('visible');
                setTimeout(() => messageElement.remove(), 300);
            }
        }, '×');
        
        messageElement.appendChild(closeButton);
    }
}