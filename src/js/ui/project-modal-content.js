/**
 * Project-specific modal content generators for save/load functionality
 * @module ui/project-modal-content
 */
import { createElement, createFileInput } from './components.js';

/**
 * Returns DOM content for the save project modal
 * @param {Object} state - Application state manager
 * @returns {HTMLElement} Modal content DOM element
 */
export function getSaveProjectModalContent(state) {
    const content = createElement('div', {
        className: 'modal-content-save-project'
    });

    // Project summary section
    const summarySection = createElement('div', {
        className: 'project-summary'
    });

    const summaryTitle = createElement('h4', {}, 'Project Summary');
    summarySection.appendChild(summaryTitle);

    const currentState = state.getState();
    const summary = [];
    
    // Add current step info
    summary.push(`Current Step: ${currentState.currentStep} of 5`);
    
    // Add data info
    if (currentState.fetchedData) {
        const itemCount = Array.isArray(currentState.fetchedData) ? currentState.fetchedData.length : 1;
        summary.push(`Items loaded: ${itemCount}`);
    }
    
    if (currentState.mappings && currentState.mappings.mappedKeys) {
        summary.push(`Properties mapped: ${currentState.mappings.mappedKeys.length}`);
    }
    
    if (currentState.reconciliationData) {
        const reconciledCount = Object.keys(currentState.reconciliationData).length;
        summary.push(`Items reconciled: ${reconciledCount}`);
    }
    
    if (currentState.references) {
        summary.push(`References configured: ${currentState.references.length}`);
    }

    const summaryList = createElement('ul', {
        className: 'summary-list'
    });
    
    summary.forEach(item => {
        const listItem = createElement('li', {}, item);
        summaryList.appendChild(listItem);
    });

    summarySection.appendChild(summaryList);

    // File name section
    const fileNameSection = createElement('div', {
        className: 'filename-section'
    });

    const fileNameLabel = createElement('label', {
        htmlFor: 'save-filename'
    }, 'File Name:');

    const defaultFileName = `omeka-wikidata-project-${new Date().toISOString().slice(0, 10)}.json`;
    const fileNameInput = createElement('input', {
        type: 'text',
        id: 'save-filename',
        className: 'filename-input',
        value: defaultFileName
    });

    fileNameSection.appendChild(fileNameLabel);
    fileNameSection.appendChild(fileNameInput);

    content.appendChild(summarySection);
    content.appendChild(fileNameSection);

    return content;
}

/**
 * Returns DOM content for the load project modal
 * @returns {HTMLElement} Modal content DOM element
 */
export function getLoadProjectModalContent() {
    const content = createElement('div', {
        className: 'modal-content-load-project'
    });

    // Warning section
    const warningSection = createElement('div', {
        className: 'load-warning'
    });

    const warningIcon = createElement('span', {
        className: 'warning-icon'
    }, '⚠️');

    const warningText = createElement('p', {
        className: 'warning-text'
    }, 'Loading a project will replace all current work. Make sure to save your current progress first.');

    warningSection.appendChild(warningIcon);
    warningSection.appendChild(warningText);

    // File upload section
    const uploadSection = createElement('div', {
        className: 'file-upload-section'
    });

    const uploadArea = createElement('div', {
        className: 'file-upload-area',
        id: 'file-upload-area'
    });

    const uploadIcon = createElement('div', {
        className: 'upload-icon'
    }, '📁');

    const uploadText = createElement('p', {
        className: 'upload-text'
    }, 'Drop your project JSON file here or click to browse');

    const uploadInput = createFileInput({
        accept: '.json',
        id: 'project-file-input',
        style: { display: 'none' }
    });

    uploadArea.appendChild(uploadIcon);
    uploadArea.appendChild(uploadText);
    uploadArea.appendChild(uploadInput);

    // Project preview section (initially hidden)
    const previewSection = createElement('div', {
        className: 'project-preview',
        id: 'project-preview',
        style: { display: 'none' }
    });

    const previewTitle = createElement('h4', {}, 'Project Preview');
    const previewContent = createElement('div', {
        className: 'preview-content',
        id: 'preview-content'
    });

    previewSection.appendChild(previewTitle);
    previewSection.appendChild(previewContent);

    uploadSection.appendChild(uploadArea);
    uploadSection.appendChild(previewSection);

    content.appendChild(warningSection);
    content.appendChild(uploadSection);

    return content;
}