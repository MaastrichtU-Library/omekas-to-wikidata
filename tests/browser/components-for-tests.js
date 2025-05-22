/**
 * UI component utilities for testing
 * A non-module version of the UI components for browser testing
 */
const UIComponents = {
  /**
   * Create a DOM element with attributes and content
   */
  createElement: function(tag, attrs = {}, content = null) {
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
  },

  /**
   * Create a button element with standardized styling
   */
  createButton: function(text, options = {}) {
    const { 
      type = 'secondary', 
      onClick, 
      disabled = false,
      id = null,
      keyboardShortcut = null
    } = options;
    
    const buttonClasses = type === 'primary' 
      ? 'button button--primary primary-button'
      : type === 'test'
        ? 'button button--test test-button'
        : 'button button--secondary secondary-button';
    
    const buttonContent = keyboardShortcut
      ? [
        text,
        this.createElement('span', { className: 'shortcut-hint' }, ` [${keyboardShortcut.toUpperCase()}]`)
      ]
      : text;
    
    return this.createElement('button', {
      className: buttonClasses,
      id: id,
      disabled: disabled,
      onClick: onClick
    }, buttonContent);
  },

  /**
   * Update element visibility
   */
  setVisibility: function(element, visible) {
    if (!element) return;
    
    element.style.display = visible ? '' : 'none';
  },

  /**
   * Toggle a class on an element
   */
  toggleClass: function(element, className, force) {
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
  },

  /**
   * Create a list item element
   */
  createListItem: function(content, options = {}) {
    const { 
      className = '', 
      onClick = null,
      isPlaceholder = false
    } = options;
    
    const listClass = isPlaceholder 
      ? 'placeholder' 
      : onClick ? `${className} clickable` : className;
    
    return this.createElement('li', {
      className: listClass,
      onClick: onClick
    }, content);
  },

  /**
   * Clear an element's contents and add new content
   */
  updateElementContent: function(element, content) {
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
};