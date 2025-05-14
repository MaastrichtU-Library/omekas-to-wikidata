/**
 * Filter management for Omeka S API queries
 */

// Available properties for filters
export const properties = [
    { id: "dcterms:title", name: "Title" },
    { id: "dcterms:creator", name: "Creator" },
    { id: "dcterms:date", name: "Date" },
    { id: "dcterms:description", name: "Description" },
    { id: "dcterms:identifier", name: "Identifier" },
    { id: "dcterms:subject", name: "Subject" }
];

// Comparison operators
export const operators = [
    { id: "eq", name: "Equals" },
    { id: "neq", name: "Not Equals" },
    { id: "in", name: "Contains" },
    { id: "nin", name: "Does Not Contain" }
];

/**
 * Creates a new filter row
 * @param {HTMLElement} filtersDiv - The container for filter rows
 */
export function addFilterRow(filtersDiv) {
    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';

    // Property select
    const propertySelect = document.createElement('select');
    propertySelect.className = 'property-select';
    properties.forEach(prop => {
        const option = document.createElement('option');
        option.value = prop.id;
        option.textContent = prop.name;
        propertySelect.appendChild(option);
    });

    // Operator select
    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'operator-select';
    operators.forEach(op => {
        const option = document.createElement('option');
        option.value = op.id;
        option.textContent = op.name;
        operatorSelect.appendChild(option);
    });

    // Value input
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'value-input';
    valueInput.placeholder = 'Enter value';

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function () {
        filtersDiv.removeChild(filterRow);
    });

    // Append elements
    filterRow.appendChild(propertySelect);
    filterRow.appendChild(operatorSelect);
    filterRow.appendChild(valueInput);
    filterRow.appendChild(removeBtn);

    filtersDiv.appendChild(filterRow);
}

/**
 * Gets filter parameters from all filter rows
 * @param {HTMLElement} filtersDiv - The container with filter rows
 * @returns {URLSearchParams} - URL parameters for the filters
 */
export function getFilterParams(filtersDiv) {
    const params = new URLSearchParams();
    const filterRows = filtersDiv.querySelectorAll('.filter-row');
    
    filterRows.forEach((row) => {
        const property = row.querySelector('.property-select').value;
        const operator = row.querySelector('.operator-select').value;
        const value = row.querySelector('.value-input').value.trim();

        if (value) {
            // Transform dcterms:title to just 'title' for the parameter
            const propName = property.split(':')[1];
            params.append(`property[${propName}][${operator}]`, value);
        }
    });
    
    return params;
}