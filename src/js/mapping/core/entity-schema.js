/**
 * Entity Schema Module
 * Handles Entity Schema selection, property fetching, and smart matching
 * @module mapping/core/entity-schema
 */

import { createElement, createButton, showMessage } from '../../ui/components.js';
import { eventSystem } from '../../events.js';

/**
 * Actively used Entity Schemas for this project
 */
const ACTIVE_SCHEMAS = [
    {
        id: 'E473',
        label: 'Edition or translation of a written work',
        description: 'Maastricht University Library - schema to describe a single unique copy, or exemplar, of a book',
        organization: 'Maastricht University Library',
        priority: 1
    },
    {
        id: 'E487', 
        label: 'Edition or translation of a written work',
        description: 'Radboud University Library - schema for book editions and translations',
        organization: 'Radboud University Library',
        priority: 2
    },
    {
        id: 'E476',
        label: 'Manuscript',
        description: 'Schema for manuscript documents and handwritten works',
        organization: 'General',
        priority: 3
    },
    {
        id: 'E488',
        label: 'Incunable',
        description: 'Schema for incunabula - books printed before 1501',
        organization: 'General',
        priority: 4
    }
];

/**
 * Common property name mappings for smart matching
 */
const PROPERTY_MAPPINGS = {
    // Common Omeka S / Schema.org to Wikidata property mappings
    'dcterms:title': ['P1476'], // title
    'dcterms:creator': ['P50', 'P170'], // author, creator
    'dcterms:date': ['P577', 'P571'], // publication date, inception
    'dcterms:publisher': ['P123'], // publisher
    'dcterms:subject': ['P921'], // main subject
    'dcterms:description': ['P1343'], // described by source
    'dcterms:identifier': ['P217', 'P2093'], // inventory number, author name string
    'dcterms:language': ['P407'], // language of work
    'dcterms:type': ['P31'], // instance of
    'schema:name': ['P1476'], // title
    'schema:author': ['P50'], // author
    'schema:publisher': ['P123'], // publisher
    'schema:datePublished': ['P577'], // publication date
    'schema:isbn': ['P212'], // ISBN-13
    'schema:description': ['P1343'], // described by source
    'schema:language': ['P407'], // language of work
    'bibo:isbn': ['P212'], // ISBN-13
    'bibo:issn': ['P236'], // ISSN
    'bibo:doi': ['P356'], // DOI
    'foaf:name': ['P1476'] // title
};

/**
 * Entity Schema Manager Class
 */
export class EntitySchemaManager {
    constructor(state) {
        this.state = state;
        this.selectedSchema = null;
        this.schemaProperties = new Map();
        this.schemaCache = new Map();
        this.isLoading = false;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for state changes
     */
    setupEventListeners() {
        eventSystem.subscribe(eventSystem.Events.STATE_CHANGED, (data) => {
            if (data.path === 'entitySchema') {
                this.handleSchemaChange(data.newValue);
            }
        });
    }

    /**
     * Get active schemas for display
     */
    getActiveSchemas() {
        return ACTIVE_SCHEMAS;
    }

    /**
     * Render schema selection interface
     */
    renderSchemaSelector(container) {
        container.innerHTML = '';
        
        // Create header
        const header = createElement('div', { className: 'schema-selector-header' }, `
            <h3>Select Entity Schema</h3>
            <p>Choose the Entity Schema that best describes your data:</p>
        `);
        container.appendChild(header);

        // Create active schemas grid
        const schemasGrid = createElement('div', { className: 'active-schemas-grid' });
        
        ACTIVE_SCHEMAS.forEach(schema => {
            const schemaCard = this.createSchemaCard(schema);
            schemasGrid.appendChild(schemaCard);
        });
        
        container.appendChild(schemasGrid);

        // Create alternative search option
        const searchSection = createElement('div', { className: 'schema-search-section' }, `
            <h4>Use a Different Schema</h4>
            <p>Search for other Entity Schemas if none of the above fit your data:</p>
        `);
        
        const searchInput = createElement('input', {
            type: 'text',
            className: 'schema-search-input',
            placeholder: 'Search by ID (e.g., E123) or keywords...'
        });
        
        const searchResults = createElement('div', { 
            className: 'schema-search-results',
            style: 'display: none;'
        });
        
        searchSection.appendChild(searchInput);
        searchSection.appendChild(searchResults);
        container.appendChild(searchSection);

        // Setup search functionality
        this.setupSchemaSearch(searchInput, searchResults);

        // Show current selection if any
        this.updateSelectionDisplay(container);
    }

    /**
     * Create a schema card element
     */
    createSchemaCard(schema) {
        const isSelected = this.selectedSchema?.id === schema.id;
        
        const card = createElement('div', { 
            className: `schema-card ${isSelected ? 'selected' : ''}`,
            'data-schema-id': schema.id
        });
        
        card.innerHTML = `
            <div class="schema-id">${schema.id}</div>
            <div class="schema-label">${schema.label}</div>
            <div class="schema-organization">${schema.organization}</div>
            <div class="schema-description">${schema.description}</div>
            <div class="schema-actions">
                <button class="select-schema-btn" data-schema-id="${schema.id}">
                    ${isSelected ? 'Selected' : 'Select'}
                </button>
                <button class="view-schema-btn" data-schema-id="${schema.id}">View Details</button>
            </div>
        `;

        // Add event listeners
        const selectBtn = card.querySelector('.select-schema-btn');
        const viewBtn = card.querySelector('.view-schema-btn');
        
        selectBtn.addEventListener('click', () => this.selectSchema(schema));
        viewBtn.addEventListener('click', () => this.viewSchemaDetails(schema));
        
        return card;
    }

    /**
     * Setup schema search functionality
     */
    setupSchemaSearch(input, resultsContainer) {
        let searchTimeout;
        
        input.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                resultsContainer.style.display = 'none';
                return;
            }
            
            searchTimeout = setTimeout(() => {
                this.performSchemaSearch(query, resultsContainer);
            }, 300);
        });
    }

    /**
     * Perform Entity Schema search
     */
    async performSchemaSearch(query, resultsContainer) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
        
        try {
            // Check if it's a direct schema ID
            if (query.match(/^E\d{3,4}$/i)) {
                const schemaResult = await this.fetchEntitySchemaDirectly(query.toUpperCase());
                if (schemaResult) {
                    this.displaySearchResults([schemaResult], resultsContainer);
                    return;
                }
            }
            
            // Search in Entity Schema namespace
            const searchResults = await this.searchEntitySchemas(query);
            this.displaySearchResults(searchResults, resultsContainer);
            
        } catch (error) {
            console.error('Schema search error:', error);
            resultsContainer.innerHTML = '<div class="search-error">Search failed. Please try again.</div>';
        }
    }

    /**
     * Search Entity Schemas via Wikidata API
     */
    async searchEntitySchemas(query) {
        const searchUrl = `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=640&format=json&origin=*&srlimit=10`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.query && data.query.search) {
            return data.query.search
                .filter(item => item.title.match(/^EntitySchema:E\d+$/))
                .map(item => {
                    const id = item.title.replace('EntitySchema:', '');
                    return {
                        id: id,
                        label: item.snippet || `Entity Schema ${id}`,
                        description: item.snippet || `Entity Schema ${id}`,
                        isSearchResult: true
                    };
                });
        }
        
        return [];
    }

    /**
     * Fetch Entity Schema details directly
     */
    async fetchEntitySchemaDirectly(schemaId) {
        if (this.schemaCache.has(schemaId)) {
            return this.schemaCache.get(schemaId);
        }
        
        try {
            // Fetch schema page content
            const parseUrl = `https://www.wikidata.org/w/api.php?action=parse&page=EntitySchema:${schemaId}&format=json&origin=*&prop=text|displaytitle`;
            const parseResponse = await fetch(parseUrl);
            const parseData = await parseResponse.json();
            
            let label = `Entity Schema ${schemaId}`;
            let description = `Entity Schema ${schemaId}`;
            
            if (parseData.parse && parseData.parse.text) {
                const html = parseData.parse.text['*'];
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Extract label and description from parsed HTML
                const labelElement = doc.querySelector('.entityschema-label');
                const descElement = doc.querySelector('.entityschema-description');
                
                if (labelElement) label = labelElement.textContent.trim();
                if (descElement) description = descElement.textContent.trim();
            }
            
            // Fetch ShEx code
            let shexCode = null;
            try {
                const shexUrl = `https://www.wikidata.org/wiki/Special:EntitySchemaText/${schemaId}`;
                const shexResponse = await fetch(shexUrl);
                shexCode = await shexResponse.text();
            } catch (error) {
                console.warn('Failed to fetch ShEx code:', error);
            }
            
            const schema = {
                id: schemaId,
                label: label,
                description: description,
                shexCode: shexCode,
                url: `https://www.wikidata.org/wiki/EntitySchema:${schemaId}`
            };
            
            this.schemaCache.set(schemaId, schema);
            return schema;
            
        } catch (error) {
            console.error('Failed to fetch schema:', error);
            return null;
        }
    }

    /**
     * Display search results
     */
    displaySearchResults(results, container) {
        if (results.length === 0) {
            container.innerHTML = '<div class="no-results">No Entity Schemas found.</div>';
            return;
        }
        
        container.innerHTML = '';
        
        results.forEach(schema => {
            const resultItem = createElement('div', { className: 'search-result-item' });
            resultItem.innerHTML = `
                <div class="result-id">${schema.id}</div>
                <div class="result-label">${schema.label}</div>
                <div class="result-description">${schema.description}</div>
                <div class="result-actions">
                    <button class="select-result-btn" data-schema-id="${schema.id}">Select</button>
                    <button class="view-result-btn" data-schema-id="${schema.id}">Details</button>
                </div>
            `;
            
            const selectBtn = resultItem.querySelector('.select-result-btn');
            const viewBtn = resultItem.querySelector('.view-result-btn');
            
            selectBtn.addEventListener('click', () => this.selectSchema(schema));
            viewBtn.addEventListener('click', () => this.viewSchemaDetails(schema));
            
            container.appendChild(resultItem);
        });
    }

    /**
     * Select a schema
     */
    async selectSchema(schema) {
        this.isLoading = true;
        
        try {
            // Fetch full schema details if not available
            if (!schema.shexCode && !schema.isSearchResult) {
                const fullSchema = await this.fetchEntitySchemaDirectly(schema.id);
                if (fullSchema) {
                    schema = { ...schema, ...fullSchema };
                }
            } else if (schema.isSearchResult) {
                const fullSchema = await this.fetchEntitySchemaDirectly(schema.id);
                if (fullSchema) {
                    schema = fullSchema;
                }
            }
            
            this.selectedSchema = schema;
            
            // Update state
            this.state.updateState('entitySchema', schema.id);
            
            // Extract and cache properties
            await this.extractSchemaProperties(schema);
            
            // Update UI
            this.updateSelectionDisplay();
            
            // Notify other modules
            eventSystem.publish('ENTITY_SCHEMA_SELECTED', {
                schema: schema,
                properties: this.schemaProperties.get(schema.id) || []
            });
            
            showMessage(`Entity Schema ${schema.id} selected successfully`, 'success');
            
        } catch (error) {
            console.error('Error selecting schema:', error);
            showMessage('Failed to select Entity Schema', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Extract properties from schema ShEx code
     */
    async extractSchemaProperties(schema) {
        if (!schema.shexCode) return [];
        
        try {
            // Parse ShEx code to extract Wikidata properties
            const properties = this.parseShexForProperties(schema.shexCode);
            this.schemaProperties.set(schema.id, properties);
            return properties;
        } catch (error) {
            console.error('Error extracting schema properties:', error);
            return [];
        }
    }

    /**
     * Parse ShEx code to extract Wikidata properties
     */
    parseShexForProperties(shexCode) {
        const properties = [];
        
        // Regex to match Wikidata property references in ShEx
        const propertyRegex = /wdt:(P\d+)/g;
        const matches = [...shexCode.matchAll(propertyRegex)];
        
        const uniqueProperties = [...new Set(matches.map(match => match[1]))];
        
        uniqueProperties.forEach(propertyId => {
            // Determine if property is required (basic heuristic)
            const isRequired = shexCode.includes(`wdt:${propertyId}`) && 
                              !shexCode.includes(`wdt:${propertyId}?`);
            
            properties.push({
                id: propertyId,
                required: isRequired,
                source: 'schema'
            });
        });
        
        return properties;
    }

    /**
     * Get smart property suggestions for Omeka keys
     */
    getSmartPropertySuggestions(omekaKeys) {
        const suggestions = new Map();
        const schemaProperties = this.getSelectedSchemaProperties();
        
        omekaKeys.forEach(key => {
            const matches = this.findPropertyMatches(key, schemaProperties);
            if (matches.length > 0) {
                suggestions.set(key, matches);
            }
        });
        
        return suggestions;
    }

    /**
     * Find property matches for an Omeka key
     */
    findPropertyMatches(omekaKey, schemaProperties) {
        const matches = [];
        
        // Direct mapping lookup
        if (PROPERTY_MAPPINGS[omekaKey]) {
            PROPERTY_MAPPINGS[omekaKey].forEach(propertyId => {
                const confidence = schemaProperties.some(p => p.id === propertyId) ? 'high' : 'medium';
                matches.push({
                    propertyId: propertyId,
                    confidence: confidence,
                    reason: 'direct_mapping'
                });
            });
        }
        
        // Semantic matching
        const semanticMatches = this.findSemanticMatches(omekaKey, schemaProperties);
        matches.push(...semanticMatches);
        
        return matches.sort((a, b) => {
            const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
        });
    }

    /**
     * Find semantic matches between Omeka key and schema properties
     */
    findSemanticMatches(omekaKey, schemaProperties) {
        const matches = [];
        const keyLower = omekaKey.toLowerCase();
        
        // Simple keyword matching
        const keywords = {
            'title': ['P1476'],
            'name': ['P1476'], 
            'author': ['P50'],
            'creator': ['P170'],
            'publisher': ['P123'],
            'date': ['P577', 'P571'],
            'language': ['P407'],
            'subject': ['P921'],
            'description': ['P1343'],
            'identifier': ['P217'],
            'isbn': ['P212'],
            'issn': ['P236'],
            'doi': ['P356']
        };
        
        Object.entries(keywords).forEach(([keyword, propertyIds]) => {
            if (keyLower.includes(keyword)) {
                propertyIds.forEach(propertyId => {
                    const isInSchema = schemaProperties.some(p => p.id === propertyId);
                    matches.push({
                        propertyId: propertyId,
                        confidence: isInSchema ? 'medium' : 'low',
                        reason: 'semantic_match',
                        keyword: keyword
                    });
                });
            }
        });
        
        return matches;
    }

    /**
     * Get selected schema properties
     */
    getSelectedSchemaProperties() {
        if (!this.selectedSchema) return [];
        return this.schemaProperties.get(this.selectedSchema.id) || [];
    }

    /**
     * View schema details
     */
    async viewSchemaDetails(schema) {
        if (!schema.shexCode) {
            const fullSchema = await this.fetchEntitySchemaDirectly(schema.id);
            if (fullSchema) {
                schema = fullSchema;
            }
        }
        
        // Show schema details modal or panel
        this.showSchemaDetailsModal(schema);
    }

    /**
     * Show schema details in a modal
     */
    showSchemaDetailsModal(schema) {
        // Implementation would create a modal showing schema details
        // For now, just show basic info
        const info = `
            Schema: ${schema.id}
            Label: ${schema.label}
            Description: ${schema.description}
            URL: ${schema.url || 'N/A'}
        `;
        alert(info);
    }

    /**
     * Update selection display
     */
    updateSelectionDisplay(container = null) {
        // Update all schema cards to show current selection
        const cards = document.querySelectorAll('.schema-card');
        cards.forEach(card => {
            const schemaId = card.dataset.schemaId;
            const isSelected = this.selectedSchema?.id === schemaId;
            
            card.classList.toggle('selected', isSelected);
            
            const selectBtn = card.querySelector('.select-schema-btn');
            if (selectBtn) {
                selectBtn.textContent = isSelected ? 'Selected' : 'Select';
                selectBtn.disabled = isSelected;
            }
        });
        
        // Update entity schema input if it exists
        const entitySchemaInput = document.getElementById('entity-schema');
        if (entitySchemaInput && this.selectedSchema) {
            entitySchemaInput.value = this.selectedSchema.id;
        }
    }

    /**
     * Clear schema selection
     */
    clearSelection() {
        this.selectedSchema = null;
        this.state.updateState('entitySchema', '');
        this.updateSelectionDisplay();
        
        eventSystem.publish('ENTITY_SCHEMA_CLEARED', {});
        
        showMessage('Entity Schema selection cleared', 'info');
    }

    /**
     * Get current schema
     */
    getCurrentSchema() {
        return this.selectedSchema;
    }

    /**
     * Handle schema change from state
     */
    async handleSchemaChange(schemaId) {
        if (!schemaId) {
            this.selectedSchema = null;
            return;
        }
        
        // Find schema in active schemas or fetch from Wikidata
        let schema = ACTIVE_SCHEMAS.find(s => s.id === schemaId);
        
        if (!schema) {
            schema = await this.fetchEntitySchemaDirectly(schemaId);
        }
        
        if (schema) {
            this.selectedSchema = schema;
            await this.extractSchemaProperties(schema);
        }
    }
}

/**
 * Create and initialize Entity Schema Manager
 */
export function createEntitySchemaManager(state) {
    return new EntitySchemaManager(state);
}