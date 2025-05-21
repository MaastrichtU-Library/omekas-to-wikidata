/**
 * Tests for the UI components module
 */

// Import the components module to test
import { 
  createElement, 
  createButton,
  setVisibility,
  toggleClass,
  createListItem,
  updateElementContent
} from '../../../src/js/ui/components.js';

describe('UI Components Module', () => {
  describe('createElement', () => {
    test('creates a basic element with text content', () => {
      const element = createElement('div', {}, 'Hello world');
      expect(element.tagName).toBe('DIV');
      expect(element.textContent).toBe('Hello world');
    });

    test('sets attributes correctly', () => {
      const element = createElement('button', {
        id: 'test-button',
        className: 'button primary',
        disabled: true,
        'data-test': 'test-value'
      });
      
      expect(element.id).toBe('test-button');
      expect(element.className).toBe('button primary');
      expect(element.disabled).toBe(true);
      expect(element.getAttribute('data-test')).toBe('test-value');
    });

    test('handles dataset attributes', () => {
      const element = createElement('div', {
        dataset: {
          testKey: 'testValue',
          step: '1'
        }
      });
      
      expect(element.dataset.testKey).toBe('testValue');
      expect(element.dataset.step).toBe('1');
    });

    test('handles style object', () => {
      const element = createElement('div', {
        style: {
          color: 'red',
          backgroundColor: 'blue',
          padding: '10px'
        }
      });
      
      expect(element.style.color).toBe('red');
      expect(element.style.backgroundColor).toBe('blue');
      expect(element.style.padding).toBe('10px');
    });

    test('adds event listeners', () => {
      const clickHandler = jest.fn();
      const element = createElement('button', {
        onClick: clickHandler
      });
      
      element.click();
      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    test('appends child elements', () => {
      const child1 = createElement('span', {}, 'Child 1');
      const child2 = createElement('span', {}, 'Child 2');
      
      const parent = createElement('div', {}, [child1, child2]);
      
      expect(parent.children.length).toBe(2);
      expect(parent.children[0]).toBe(child1);
      expect(parent.children[1]).toBe(child2);
      expect(parent.textContent).toBe('Child 1Child 2');
    });
  });

  describe('createButton', () => {
    test('creates a basic button with text', () => {
      const button = createButton('Click me');
      
      expect(button.tagName).toBe('BUTTON');
      expect(button.textContent).toBe('Click me');
      expect(button.className).toContain('button--secondary');
    });

    test('creates a primary button', () => {
      const button = createButton('Primary', { type: 'primary' });
      
      expect(button.className).toContain('button--primary');
      expect(button.textContent).toBe('Primary');
    });

    test('adds onClick handler', () => {
      const clickHandler = jest.fn();
      const button = createButton('Action', { onClick: clickHandler });
      
      button.click();
      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    test('sets disabled state', () => {
      const button = createButton('Disabled', { disabled: true });
      
      expect(button.disabled).toBe(true);
    });

    test('adds id attribute', () => {
      const button = createButton('With ID', { id: 'test-id' });
      
      expect(button.id).toBe('test-id');
    });

    test('adds keyboard shortcut indicator', () => {
      const button = createButton('Save', { keyboardShortcut: 's' });
      
      expect(button.textContent).toContain('Save');
      expect(button.querySelector('.shortcut-hint')).not.toBeNull();
      expect(button.querySelector('.shortcut-hint').textContent).toContain('[S]');
    });
  });

  describe('setVisibility', () => {
    test('shows an element', () => {
      const element = document.createElement('div');
      element.style.display = 'none';
      
      setVisibility(element, true);
      expect(element.style.display).toBe('');
    });

    test('hides an element', () => {
      const element = document.createElement('div');
      
      setVisibility(element, false);
      expect(element.style.display).toBe('none');
    });

    test('does nothing if element is undefined', () => {
      expect(() => {
        setVisibility(undefined, true);
      }).not.toThrow();
    });
  });

  describe('toggleClass', () => {
    test('adds a class to an element', () => {
      const element = document.createElement('div');
      
      toggleClass(element, 'active', true);
      expect(element.classList.contains('active')).toBe(true);
    });

    test('removes a class from an element', () => {
      const element = document.createElement('div');
      element.classList.add('active');
      
      toggleClass(element, 'active', false);
      expect(element.classList.contains('active')).toBe(false);
    });

    test('toggles a class on an element', () => {
      const element = document.createElement('div');
      
      toggleClass(element, 'active');
      expect(element.classList.contains('active')).toBe(true);
      
      toggleClass(element, 'active');
      expect(element.classList.contains('active')).toBe(false);
    });

    test('does nothing if element is undefined', () => {
      expect(() => {
        toggleClass(undefined, 'active');
      }).not.toThrow();
    });

    test('returns the class state', () => {
      const element = document.createElement('div');
      
      const result1 = toggleClass(element, 'active');
      expect(result1).toBe(true);
      
      const result2 = toggleClass(element, 'active');
      expect(result2).toBe(false);
    });
  });

  describe('createListItem', () => {
    test('creates a basic list item with text content', () => {
      const li = createListItem('Item text');
      
      expect(li.tagName).toBe('LI');
      expect(li.textContent).toBe('Item text');
      expect(li.className).toBe('');
    });

    test('creates a placeholder list item', () => {
      const li = createListItem('No items', { isPlaceholder: true });
      
      expect(li.className).toBe('placeholder');
      expect(li.textContent).toBe('No items');
    });

    test('creates a clickable list item', () => {
      const clickHandler = jest.fn();
      const li = createListItem('Click me', { onClick: clickHandler });
      
      expect(li.className).toContain('clickable');
      
      li.click();
      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    test('applies custom class name', () => {
      const li = createListItem('Custom class', { className: 'custom-class' });
      
      expect(li.className).toBe('custom-class');
    });
  });

  describe('updateElementContent', () => {
    test('updates element with text content', () => {
      const element = document.createElement('div');
      element.textContent = 'Original content';
      
      updateElementContent(element, 'New content');
      expect(element.textContent).toBe('New content');
    });

    test('updates element with HTML element', () => {
      const element = document.createElement('div');
      const span = document.createElement('span');
      span.textContent = 'Span content';
      
      updateElementContent(element, span);
      expect(element.innerHTML).toBe('<span>Span content</span>');
    });

    test('updates element with array of content', () => {
      const element = document.createElement('div');
      const span1 = document.createElement('span');
      span1.textContent = 'First';
      const span2 = document.createElement('span');
      span2.textContent = 'Second';
      
      updateElementContent(element, [span1, 'Text', span2]);
      expect(element.childNodes.length).toBe(3);
      expect(element.childNodes[0]).toBe(span1);
      expect(element.childNodes[1].textContent).toBe('Text');
      expect(element.childNodes[2]).toBe(span2);
    });

    test('clears element content', () => {
      const element = document.createElement('div');
      element.innerHTML = '<span>Content</span>';
      
      updateElementContent(element, null);
      expect(element.innerHTML).toBe('');
    });

    test('does nothing if element is undefined', () => {
      expect(() => {
        updateElementContent(undefined, 'content');
      }).not.toThrow();
    });
  });
});