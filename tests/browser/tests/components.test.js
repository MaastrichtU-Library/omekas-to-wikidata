/**
 * Browser-based tests for the UI components module
 */
import { 
  createElement, 
  createButton,
  setVisibility,
  toggleClass,
  createListItem,
  updateElementContent
} from '../../../src/js/ui/components.js';

// Use the globally defined test helpers
const { resetTestDOM, mockEventSystem } = window;

describe('UI Components Module', () => {
  beforeEach(() => {
    resetTestDOM();
  });
  
  describe('createElement', () => {
    it('creates a basic element with text content', () => {
      const element = createElement('div', {}, 'Hello world');
      expect(element.tagName).to.equal('DIV');
      expect(element.textContent).to.equal('Hello world');
    });

    it('sets attributes correctly', () => {
      const element = createElement('button', {
        id: 'test-button',
        className: 'button primary',
        disabled: true,
        'data-test': 'test-value'
      });
      
      expect(element.id).to.equal('test-button');
      expect(element.className).to.equal('button primary');
      expect(element.disabled).to.equal(true);
      expect(element.getAttribute('data-test')).to.equal('test-value');
    });

    it('handles dataset attributes', () => {
      const element = createElement('div', {
        dataset: {
          testKey: 'testValue',
          step: '1'
        }
      });
      
      expect(element.dataset.testKey).to.equal('testValue');
      expect(element.dataset.step).to.equal('1');
    });

    it('handles style object', () => {
      const element = createElement('div', {
        style: {
          color: 'red',
          backgroundColor: 'blue',
          padding: '10px'
        }
      });
      
      expect(element.style.color).to.equal('red');
      expect(element.style.backgroundColor).to.equal('blue');
      expect(element.style.padding).to.equal('10px');
    });

    it('adds event listeners', () => {
      let clicked = false;
      const element = createElement('button', {
        onClick: () => { clicked = true; }
      });
      
      element.click();
      expect(clicked).to.equal(true);
    });

    it('appends child elements', () => {
      const child1 = createElement('span', {}, 'Child 1');
      const child2 = createElement('span', {}, 'Child 2');
      
      const parent = createElement('div', {}, [child1, child2]);
      
      expect(parent.children.length).to.equal(2);
      expect(parent.children[0]).to.equal(child1);
      expect(parent.children[1]).to.equal(child2);
      expect(parent.textContent).to.equal('Child 1Child 2');
    });
  });

  describe('createButton', () => {
    it('creates a basic button with text', () => {
      const button = createButton('Click me');
      
      expect(button.tagName).to.equal('BUTTON');
      expect(button.textContent).to.equal('Click me');
      expect(button.className).to.contain('button--secondary');
    });

    it('creates a primary button', () => {
      const button = createButton('Primary', { type: 'primary' });
      
      expect(button.className).to.contain('button--primary');
      expect(button.textContent).to.equal('Primary');
    });

    it('adds onClick handler', () => {
      let clicked = false;
      const button = createButton('Action', { 
        onClick: () => { clicked = true; }
      });
      
      button.click();
      expect(clicked).to.equal(true);
    });

    it('sets disabled state', () => {
      const button = createButton('Disabled', { disabled: true });
      
      expect(button.disabled).to.equal(true);
    });

    it('adds id attribute', () => {
      const button = createButton('With ID', { id: 'test-id' });
      
      expect(button.id).to.equal('test-id');
    });

    it('adds keyboard shortcut indicator', () => {
      const button = createButton('Save', { keyboardShortcut: 's' });
      
      expect(button.textContent).to.contain('Save');
      expect(button.querySelector('.shortcut-hint')).to.not.be.null;
      expect(button.querySelector('.shortcut-hint').textContent).to.contain('[S]');
    });
  });

  describe('setVisibility', () => {
    it('shows an element', () => {
      const element = document.createElement('div');
      element.style.display = 'none';
      
      setVisibility(element, true);
      expect(element.style.display).to.equal('');
    });

    it('hides an element', () => {
      const element = document.createElement('div');
      
      setVisibility(element, false);
      expect(element.style.display).to.equal('none');
    });

    it('does nothing if element is undefined', () => {
      expect(() => {
        setVisibility(undefined, true);
      }).to.not.throw();
    });
  });

  describe('toggleClass', () => {
    it('adds a class to an element', () => {
      const element = document.createElement('div');
      
      toggleClass(element, 'active', true);
      expect(element.classList.contains('active')).to.equal(true);
    });

    it('removes a class from an element', () => {
      const element = document.createElement('div');
      element.classList.add('active');
      
      toggleClass(element, 'active', false);
      expect(element.classList.contains('active')).to.equal(false);
    });

    it('toggles a class on an element', () => {
      const element = document.createElement('div');
      
      toggleClass(element, 'active');
      expect(element.classList.contains('active')).to.equal(true);
      
      toggleClass(element, 'active');
      expect(element.classList.contains('active')).to.equal(false);
    });
  });

  describe('createListItem', () => {
    it('creates a basic list item with text content', () => {
      const li = createListItem('Item text');
      
      expect(li.tagName).to.equal('LI');
      expect(li.textContent).to.equal('Item text');
      expect(li.className).to.equal('');
    });

    it('creates a placeholder list item', () => {
      const li = createListItem('No items', { isPlaceholder: true });
      
      expect(li.className).to.equal('placeholder');
      expect(li.textContent).to.equal('No items');
    });

    it('creates a clickable list item', () => {
      let clicked = false;
      const li = createListItem('Click me', { 
        onClick: () => { clicked = true; }
      });
      
      expect(li.className).to.contain('clickable');
      
      li.click();
      expect(clicked).to.equal(true);
    });
  });

  describe('updateElementContent', () => {
    it('updates element with text content', () => {
      const element = document.createElement('div');
      element.textContent = 'Original content';
      
      updateElementContent(element, 'New content');
      expect(element.textContent).to.equal('New content');
    });

    it('updates element with HTML element', () => {
      const element = document.createElement('div');
      const span = document.createElement('span');
      span.textContent = 'Span content';
      
      updateElementContent(element, span);
      expect(element.innerHTML).to.equal('<span>Span content</span>');
    });

    it('updates element with array of content', () => {
      const element = document.createElement('div');
      const span1 = document.createElement('span');
      span1.textContent = 'First';
      const span2 = document.createElement('span');
      span2.textContent = 'Second';
      
      updateElementContent(element, [span1, 'Text', span2]);
      expect(element.childNodes.length).to.equal(3);
      expect(element.childNodes[0]).to.equal(span1);
      expect(element.childNodes[1].textContent).to.equal('Text');
      expect(element.childNodes[2]).to.equal(span2);
    });
  });
});