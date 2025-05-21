/**
 * Tests for the modal UI module
 */

// Import the modules to test
import { setupModalUI } from '../../../src/js/ui/modal-ui.js';
import { eventSystem } from '../../../src/js/events.js';

// Mock the event system
jest.mock('../../../src/js/events.js', () => ({
  eventSystem: {
    Events: {
      UI_MODAL_OPENED: 'ui:modal:opened',
      UI_MODAL_CLOSED: 'ui:modal:closed'
    },
    publish: jest.fn(),
    subscribe: jest.fn(() => jest.fn())
  }
}));

describe('Modal UI Module', () => {
  let modalUI;
  let modalContainer;
  let modalTitle;
  let modalContent;
  let modalFooter;
  let closeButton;

  beforeEach(() => {
    // Reset mocks
    eventSystem.publish.mockClear();
    
    // Set up DOM elements
    modalContainer = document.getElementById('modal-container');
    modalTitle = document.getElementById('modal-title');
    modalContent = document.getElementById('modal-content');
    modalFooter = document.getElementById('modal-footer');
    closeButton = document.getElementById('close-modal');
    
    // Initialize the modal UI
    modalUI = setupModalUI();
  });

  afterEach(() => {
    // Ensure modal is closed
    if (modalContainer.style.display !== 'none') {
      modalUI.closeModal();
    }
  });

  describe('openModal', () => {
    test('opens a modal with title and content', () => {
      modalUI.openModal('Test Title', 'Test Content');
      
      expect(modalContainer.style.display).toBe('flex');
      expect(modalTitle.textContent).toBe('Test Title');
      expect(modalContent.textContent).toBe('Test Content');
      expect(eventSystem.publish).toHaveBeenCalledWith(
        eventSystem.Events.UI_MODAL_OPENED, 
        { title: 'Test Title' }
      );
    });

    test('opens a modal with HTML element content', () => {
      const testContent = document.createElement('div');
      testContent.innerHTML = '<p>Paragraph content</p>';
      
      modalUI.openModal('Test Title', testContent);
      
      expect(modalContainer.style.display).toBe('flex');
      expect(modalContent.innerHTML).toBe('<div><p>Paragraph content</p></div>');
    });

    test('adds buttons to the modal', () => {
      const closeCallback = jest.fn();
      const saveCallback = jest.fn();
      
      modalUI.openModal('Test Title', 'Test Content', [
        { text: 'Close', type: 'secondary', callback: closeCallback },
        { text: 'Save', type: 'primary', callback: saveCallback }
      ]);
      
      // Check if buttons are created
      const buttons = modalFooter.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      
      // Check first button
      expect(buttons[0].textContent).toBe('Close');
      expect(buttons[0].className).toContain('button--secondary');
      
      // Check second button
      expect(buttons[1].textContent).toBe('Save');
      expect(buttons[1].className).toContain('button--primary');
      
      // Test button clicks
      buttons[0].click();
      expect(closeCallback).toHaveBeenCalledTimes(1);
      
      buttons[1].click();
      expect(saveCallback).toHaveBeenCalledTimes(1);
    });

    test('adds keyboard shortcuts to buttons', () => {
      const closeCallback = jest.fn();
      const saveCallback = jest.fn();
      
      modalUI.openModal('Test Title', 'Test Content', [
        { text: 'Close', type: 'secondary', callback: closeCallback, keyboardShortcut: 'c' },
        { text: 'Save', type: 'primary', callback: saveCallback, keyboardShortcut: 's' }
      ]);
      
      // Check if buttons have shortcut hints
      const buttons = modalFooter.querySelectorAll('button');
      const closeShortcut = buttons[0].querySelector('.shortcut-hint');
      const saveShortcut = buttons[1].querySelector('.shortcut-hint');
      
      expect(closeShortcut).not.toBeNull();
      expect(closeShortcut.textContent).toBe(' [C]');
      
      expect(saveShortcut).not.toBeNull();
      expect(saveShortcut.textContent).toBe(' [S]');
      
      // Simulate keyboard events
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      const cKeyEvent = new KeyboardEvent('keydown', { key: 'c' });
      const sKeyEvent = new KeyboardEvent('keydown', { key: 's' });
      
      document.dispatchEvent(cKeyEvent);
      expect(closeCallback).toHaveBeenCalledTimes(1);
      
      document.dispatchEvent(sKeyEvent);
      expect(saveCallback).toHaveBeenCalledTimes(1);
    });

    test('closes modal on escape key', () => {
      modalUI.openModal('Test Title', 'Test Content');
      expect(modalContainer.style.display).toBe('flex');
      
      // Simulate escape key press
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      expect(modalContainer.style.display).toBe('none');
      expect(eventSystem.publish).toHaveBeenCalledWith(
        eventSystem.Events.UI_MODAL_CLOSED, 
        {}
      );
    });

    test('executes onClose callback when modal is closed', () => {
      const onCloseCallback = jest.fn();
      
      modalUI.openModal('Test Title', 'Test Content', [], onCloseCallback);
      modalUI.closeModal();
      
      expect(onCloseCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeModal', () => {
    test('closes an open modal', () => {
      // First open the modal
      modalUI.openModal('Test Title', 'Test Content');
      expect(modalContainer.style.display).toBe('flex');
      
      // Then close it
      modalUI.closeModal();
      
      expect(modalContainer.style.display).toBe('none');
      expect(modalTitle.textContent).toBe('');
      expect(modalContent.innerHTML).toBe('');
      expect(modalFooter.innerHTML).toBe('');
      expect(eventSystem.publish).toHaveBeenCalledWith(
        eventSystem.Events.UI_MODAL_CLOSED, 
        {}
      );
    });
    
    test('close button closes the modal', () => {
      // First open the modal
      modalUI.openModal('Test Title', 'Test Content');
      expect(modalContainer.style.display).toBe('flex');
      
      // Click the close button
      closeButton.click();
      
      expect(modalContainer.style.display).toBe('none');
    });
    
    test('clicking outside modal container closes it', () => {
      // First open the modal
      modalUI.openModal('Test Title', 'Test Content');
      expect(modalContainer.style.display).toBe('flex');
      
      // Click the modal container (outside the modal content)
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });
      modalContainer.dispatchEvent(clickEvent);
      
      expect(modalContainer.style.display).toBe('none');
    });
  });
});