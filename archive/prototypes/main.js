/**
 * Omeka S to Wikidata
 * Main application entry point
 */
import { initElements } from './ui/elements.js';
import { addFilterRow } from './ui/filters.js';
import { fetchData } from './api/fetch.js';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM elements
    const elements = initElements();

    // Set up toggle behavior for advanced options
    elements.advancedOptionsBtn.addEventListener('click', function() {
        elements.queryParamsSection.style.display = 
            elements.queryParamsSection.style.display === 'none' ? 'block' : 'none';
    });

    // Add initial filter row
    addFilterRow(elements.filtersDiv);

    // Set up filter row button
    elements.addFilterBtn.addEventListener('click', function() {
        addFilterRow(elements.filtersDiv);
    });

    // Set up fetch button
    elements.fetchBtn.addEventListener('click', function() {
        fetchData(elements);
    });
});