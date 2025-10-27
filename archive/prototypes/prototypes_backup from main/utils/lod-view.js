/**
 * Linked Open Data (LOD) view functionality
 */
import { isUrl, isArkIdentifier } from './url-utils.js';
import { setContextData } from './property-view.js';

/**
 * Sets up the LOD view
 * @param {HTMLElement} container - Container for the view
 * @param {Object|Array} data - Data to display
 * @param {string} url - URL that was used to fetch the data
 */
export function setupLodView(container, data, url) {
    // Variables to manage context fetching
    let contextUrl = null;
    let contextData = null;

    // Create title and description
    const lodTitle = document.createElement('h3');
    lodTitle.textContent = 'Linked Open Data View';
    container.appendChild(lodTitle);

    const lodDesc = document.createElement('p');
    lodDesc.textContent = 'This view displays properties as linked data with context from Omeka S standards.';
    container.appendChild(lodDesc);

    // Function to create the LOD view with context information
    function createLodView() {
        // Create LOD view container
        const lodContent = document.createElement('div');

        // Create a container for the context info
        const contextInfo = document.createElement('div');
        contextInfo.className = 'context-info';
        contextInfo.style.marginBottom = '20px';
        contextInfo.style.padding = '15px';
        contextInfo.style.backgroundColor = '#f0f8ff';
        contextInfo.style.borderRadius = '5px';
        contextInfo.style.border = '1px solid #add8e6';

        // Add context title
        const contextTitle = document.createElement('h3');
        contextTitle.textContent = 'JSON-LD Context';
        contextTitle.style.marginTop = '0';
        contextInfo.appendChild(contextTitle);

        // Add context description
        const contextDesc = document.createElement('p');
        contextDesc.textContent = 'The @context defines the vocabulary terms used in the data, allowing properties to be mapped to full URIs.';
        contextInfo.appendChild(contextDesc);

        // Create prefix table
        if (contextData) {
            const prefixTable = document.createElement('table');
            prefixTable.style.width = '100%';
            prefixTable.style.borderCollapse = 'collapse';
            prefixTable.style.marginTop = '10px';

            // Create table header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');

            const prefixHeader = document.createElement('th');
            prefixHeader.textContent = 'Prefix';
            prefixHeader.style.textAlign = 'left';
            prefixHeader.style.borderBottom = '1px solid #ddd';

            const namespaceHeader = document.createElement('th');
            namespaceHeader.textContent = 'Namespace';
            namespaceHeader.style.textAlign = 'left';
            namespaceHeader.style.borderBottom = '1px solid #ddd';

            headerRow.appendChild(prefixHeader);
            headerRow.appendChild(namespaceHeader);
            thead.appendChild(headerRow);
            prefixTable.appendChild(thead);

            // Create table body
            const tbody = document.createElement('tbody');

            // Add each prefix mapping
            if (contextData['@context'] && typeof contextData['@context'] === 'object') {
                Object.entries(contextData['@context']).forEach(([prefix, uri]) => {
                    if (typeof uri === 'string') {
                        const row = document.createElement('tr');

                        const prefixCell = document.createElement('td');
                        prefixCell.textContent = prefix;
                        prefixCell.style.borderBottom = '1px solid #eee';
                        prefixCell.style.fontWeight = 'bold';

                        const namespaceCell = document.createElement('td');
                        const namespaceLink = document.createElement('a');
                        namespaceLink.href = uri;
                        namespaceLink.target = '_blank';
                        namespaceLink.textContent = uri;
                        namespaceCell.appendChild(namespaceLink);
                        namespaceCell.style.borderBottom = '1px solid #eee';

                        row.appendChild(prefixCell);
                        row.appendChild(namespaceCell);
                        tbody.appendChild(row);
                    }
                });
            }

            prefixTable.appendChild(tbody);
            contextInfo.appendChild(prefixTable);
        } else {
            const noContextMsg = document.createElement('p');
            noContextMsg.textContent = 'No context information available.';
            noContextMsg.style.fontStyle = 'italic';
            contextInfo.appendChild(noContextMsg);
        }

        lodContent.appendChild(contextInfo);

        // Create the data display section
        const dataDisplay = document.createElement('div');
        dataDisplay.className = 'lod-data-display';

        // Function to resolve a prefixed property to full URI
        function resolvePropertyUri(prop) {
            if (!contextData || !contextData['@context']) return null;

            // Check if the property has a prefix
            const parts = prop.split(':');
            if (parts.length === 2) {
                const prefix = parts[0];
                const term = parts[1];

                // Get the namespace for this prefix
                if (contextData['@context'][prefix]) {
                    return contextData['@context'][prefix] + term;
                }
            }

            // Check if the property is directly in the context
            if (contextData['@context'][prop]) {
                return contextData['@context'][prop];
            }

            return null;
        }

        // Function to create a well-formatted property row
        function createPropertyRow(prop, value) {
            const row = document.createElement('div');
            row.className = 'lod-property-row';
            row.style.marginBottom = '8px';
            row.style.paddingBottom = '4px';
            row.style.display = 'flex';
            row.style.alignItems = 'flex-start';

            // Format property name with namespace in parentheses
            const propContainer = document.createElement('div');
            propContainer.className = 'lod-property-name';
            propContainer.style.fontWeight = 'bold';
            propContainer.style.flexShrink = 0;
            propContainer.style.width = '30%';

            const propUri = resolvePropertyUri(prop);

            // Extract namespace and local name
            let namespace = '';
            let localName = prop;

            if (prop.includes(':')) {
                const parts = prop.split(':');
                namespace = parts[0];
                localName = parts[1];

                // Map namespace prefixes to readable names
                const namespaceLabels = {
                    'o': 'Omeka S',
                    'dcterms': 'Dublin Core',
                    'dctype': 'Dublin Core Type',
                    'schema': 'Schema.org',
                    'foaf': 'FOAF',
                    'bibo': 'Bibliographic Ontology',
                    'cc': 'Creative Commons',
                    'curation': 'Curation',
                    'o-cnt': 'Content',
                    'o-time': 'Time'
                };

                const readableNamespace = namespaceLabels[namespace] || namespace;

                if (propUri) {
                    const propLink = document.createElement('a');
                    propLink.href = propUri;
                    propLink.target = '_blank';
                    propLink.textContent = localName;
                    propLink.title = propUri;
                    propContainer.appendChild(propLink);

                    const nsSpan = document.createElement('span');
                    nsSpan.textContent = ` (${readableNamespace})`;
                    nsSpan.style.fontWeight = 'normal';
                    nsSpan.style.color = '#666';
                    nsSpan.style.fontSize = '0.9em';
                    propContainer.appendChild(nsSpan);
                } else {
                    propContainer.textContent = `${localName} (${readableNamespace})`;
                }
            } else {
                propContainer.textContent = prop;
            }

            row.appendChild(propContainer);

            // Create property value
            const valueContainer = document.createElement('div');
            valueContainer.className = 'lod-property-value';
            valueContainer.style.flex = '1';
            valueContainer.style.overflow = 'scroll';
            valueContainer.style.maxHeight = '400px';

            // Handle different value types
            if (Array.isArray(value)) {
                // Create a container for all array values
                const arrayContainer = document.createElement('div');
                arrayContainer.className = 'lod-array-container';

                // Handle array of values
                value.forEach((item, index) => {
                    const itemContainer = document.createElement('div');
                    itemContainer.className = 'lod-value-item';
                    itemContainer.style.marginBottom = index < value.length - 1 ? '4px' : '0';
                    itemContainer.style.position = 'relative';

                    if (typeof item === 'object' && item !== null) {
                        renderObjectValue(item, itemContainer);
                    } else if (typeof item === 'string') {
                        renderStringValue(item, itemContainer);
                    } else {
                        // Handle other primitive values
                        itemContainer.textContent = item;
                    }

                    arrayContainer.appendChild(itemContainer);
                });

                // Add the array container to the value container
                valueContainer.appendChild(arrayContainer);
            } else if (typeof value === 'object' && value !== null) {
                // Handle thumbnail display URLs or other object types
                renderObjectValue(value, valueContainer, prop);
            } else if (typeof value === 'string') {
                renderStringValue(value, valueContainer, prop);
            } else {
                // Handle other primitive types
                valueContainer.textContent = value;
            }

            row.appendChild(valueContainer);
            return row;
        }

        // Helper function to render a string value
        function renderStringValue(value, container, prop = null) {
            // Check for ARK identifier
            const isArk = isArkIdentifier(value);

            // Check if string is a URL or ARK identifier
            if (isUrl(value) || isArk) {
                const link = document.createElement('a');

                if (isArk && !value.startsWith('http')) {
                    // Make ARK clickable by prepending resolver
                    link.href = `https://n2t.net/${value}`;
                    link.textContent = value;
                    link.title = "ARK Identifier";

                    const arkSpan = document.createElement('span');
                    arkSpan.textContent = ' (ARK)';
                    arkSpan.style.color = '#666';
                    arkSpan.style.fontSize = '0.9em';

                    container.appendChild(link);
                    container.appendChild(arkSpan);
                } else {
                    link.href = value;
                    link.target = '_blank';
                    link.textContent = value;
                    container.appendChild(link);
                }
            } else if (prop === 'extracttext:extracted_text') {
                // Special handling for extracted text to limit height
                const textContainer = document.createElement('div');
                textContainer.style.maxHeight = '15em'; // Limit to 15 lines
                textContainer.style.overflow = 'auto'; // Add scrollbar when needed
                textContainer.style.border = '1px solid #eee';
                textContainer.style.padding = '8px';
                textContainer.style.borderRadius = '4px';
                textContainer.style.backgroundColor = '#f9f9f9';
                textContainer.textContent = `"${value}"`;
                container.appendChild(textContainer);
            } else {
                container.textContent = `"${value}"`;
            }
        }

        // Helper function to render object values
        function renderObjectValue(value, container, prop = null) {
            // Handle thumbnail display URLs
            if (prop === 'thumbnail_display_urls') {
                renderThumbnail(value, container);
            }
            // Handle objects with @id
            else if (value['@id']) {
                renderLinkedEntity(value, container);
            } 
            // Handle objects with @value
            else if (value['@value']) {
                renderTypedValue(value, container);
            } 
            // Handle objects with labels
            else if (value['o:label'] || value['property_label']) {
                renderLabeledObject(value, container);
            } else {
                // Generic object display
                renderGenericObject(value, container);
            }
        }

        // Helper for rendering thumbnails
        function renderThumbnail(value, container) {
            // Create a container for the thumbnail and links
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.style.display = 'flex';
            thumbnailContainer.style.flexDirection = 'column';
            thumbnailContainer.style.gap = '8px';

            // Display the thumbnail image
            if (value.medium) {
                const imgContainer = document.createElement('div');
                imgContainer.style.width = '300px';
                imgContainer.style.height = '300px';
                imgContainer.style.display = 'flex';
                imgContainer.style.alignItems = 'center';
                imgContainer.style.justifyContent = 'center';
                imgContainer.style.border = '1px solid #ddd';
                imgContainer.style.borderRadius = '4px';
                imgContainer.style.overflow = 'hidden';
                imgContainer.style.backgroundColor = '#f8f8f8';

                const img = document.createElement('img');
                img.src = value.large;
                img.alt = "Thumbnail";
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.objectFit = 'contain';

                imgContainer.appendChild(img);
                thumbnailContainer.appendChild(imgContainer);
            }

            // Create links to different sizes
            const linksContainer = document.createElement('div');
            linksContainer.style.display = 'flex';
            linksContainer.style.gap = '10px';

            // Add links for each available size
            ['large', 'medium', 'square'].forEach(size => {
                if (value[size]) {
                    const link = document.createElement('a');
                    link.href = value[size];
                    link.target = '_blank';
                    link.textContent = size.charAt(0).toUpperCase() + size.slice(1);
                    link.style.marginRight = '10px';
                    link.style.color = '#0066cc';
                    linksContainer.appendChild(link);
                }
            });

            thumbnailContainer.appendChild(linksContainer);
            container.appendChild(thumbnailContainer);
        }

        // Helper for rendering linked entities
        function renderLinkedEntity(value, container) {
            const idLink = document.createElement('a');
            idLink.href = value['@id'];
            idLink.target = '_blank';
            idLink.textContent = value['o:label'] || value['@id'];
            idLink.title = `ID: ${value['@id']}`;
            idLink.style.textDecoration = 'underline';

            // Handle specific identifier types
            const idText = value['@id'];
            let idType = document.createElement('span');
            idType.style.color = '#666';
            idType.style.fontSize = '0.9em';

            if (idText.includes('wikidata.org/entity/Q')) {
                // Wikidata item
                const qid = idText.match(/Q\d+/)[0];
                idType.textContent = ` (Wikidata: ${qid})`;
            } else if (idText.includes('viaf.org/viaf/')) {
                // VIAF identifier
                const viafId = idText.split('/').pop();
                idType.textContent = ` (VIAF: ${viafId})`;
            } else if (idText.includes('geonames.org')) {
                // GeoNames identifier
                const geoId = idText.split('/').pop();
                idType.textContent = ` (GeoNames: ${geoId})`;
            } else if (idText.includes('id.loc.gov')) {
                // Library of Congress identifier
                const locId = idText.split('/').pop();
                idType.textContent = ` (LoC: ${locId})`;
            } else {
                // Generic URI
                idType.textContent = ' (URI)';
            }

            container.appendChild(idLink);
            container.appendChild(idType);
        }

        // Helper for rendering typed values
        function renderTypedValue(value, container) {
            const valueText = document.createElement('span');
            valueText.textContent = `"${value['@value']}"`;

            const typeInfo = document.createElement('span');
            if (value['@type']) {
                typeInfo.textContent = ` (${value['@type'].split('/').pop()})`;
            } else if (value['type']) {
                typeInfo.textContent = ` (${value['type']})`;
            }
            typeInfo.style.color = '#666';
            typeInfo.style.fontSize = '0.9em';

            container.appendChild(valueText);
            container.appendChild(typeInfo);
        }

        // Helper for rendering labeled objects
        function renderLabeledObject(value, container) {
            if (value['@id']) {
                const labelLink = document.createElement('a');
                labelLink.href = value['@id'];
                labelLink.target = '_blank';
                labelLink.textContent = value['o:label'] || value['property_label'];
                labelLink.title = `ID: ${value['@id']}`;
                container.appendChild(labelLink);

                // Add ID information for known identifier types
                const idText = value['@id'];
                if (idText.includes('wikidata.org/entity/Q')) {
                    const qid = idText.match(/Q\d+/)[0];
                    const idSpan = document.createElement('span');
                    idSpan.textContent = ` (Wikidata: ${qid})`;
                    idSpan.style.color = '#666';
                    idSpan.style.fontSize = '0.9em';
                    container.appendChild(idSpan);
                } else if (idText.includes('viaf.org/viaf/')) {
                    const viafId = idText.split('/').pop();
                    const idSpan = document.createElement('span');
                    idSpan.textContent = ` (VIAF: ${viafId})`;
                    idSpan.style.color = '#666';
                    idSpan.style.fontSize = '0.9em';
                    container.appendChild(idSpan);
                } else if (idText.includes('geonames.org')) {
                    const geoId = idText.split('/').pop();
                    const idSpan = document.createElement('span');
                    idSpan.textContent = ` (GeoNames: ${geoId})`;
                    idSpan.style.color = '#666';
                    idSpan.style.fontSize = '0.9em';
                    container.appendChild(idSpan);
                }
            } else {
                container.textContent = value['o:label'] || value['property_label'];
            }

            // Add value type if available
            if (value['type']) {
                const typeSpan = document.createElement('span');
                typeSpan.textContent = ` (${value['type']})`;
                typeSpan.style.color = '#666';
                typeSpan.style.fontSize = '0.9em';
                container.appendChild(typeSpan);
            }
        }

        // Helper for rendering generic objects
        function renderGenericObject(value, container) {
            const objPre = document.createElement('pre');
            objPre.style.margin = '0';
            objPre.style.background = '#f9f9f9';
            objPre.style.padding = '5px';
            objPre.style.borderRadius = '3px';
            objPre.textContent = JSON.stringify(value, null, 2);
            container.appendChild(objPre);
        }

        // Display the data
        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                const itemContainer = document.createElement('div');
                itemContainer.className = 'lod-item';
                itemContainer.style.marginBottom = '25px';
                itemContainer.style.paddingBottom = '15px';
                itemContainer.style.borderBottom = '1px solid #ddd';

                // Item header with ID and types
                const itemHeader = document.createElement('div');
                itemHeader.className = 'lod-item-header';
                itemHeader.style.marginBottom = '10px';
                itemHeader.style.backgroundColor = '#f9f9f9';
                itemHeader.style.padding = '10px';
                itemHeader.style.borderRadius = '4px';
                itemHeader.style.borderLeft = '4px solid #4CAF50';

                // Item title
                const itemTitle = document.createElement('h3');
                itemTitle.style.margin = '0 0 5px 0';
                itemTitle.style.fontSize = '1.2em';

                // Get the title text - use o:title, schema:name, or default
                let titleText = `Item ${index + 1}`;
                if (item['o:title']) {
                    titleText = item['o:title'];
                } else if (item['schema:name'] && Array.isArray(item['schema:name']) && item['schema:name'].length > 0) {
                    if (item['schema:name'][0]['@value']) {
                        titleText = item['schema:name'][0]['@value'];
                    } else if (typeof item['schema:name'][0] === 'string') {
                        titleText = item['schema:name'][0];
                    }
                }

                if (item['@id']) {
                    const idLink = document.createElement('a');
                    idLink.href = item['@id'];
                    idLink.target = '_blank';
                    idLink.textContent = titleText;
                    itemTitle.appendChild(idLink);

                    // Check for Wikidata or other special identifiers
                    const idText = item['@id'];
                    if (idText.includes('wikidata.org/entity/Q')) {
                        const qid = idText.match(/Q\d+/)[0];
                        const wdSpan = document.createElement('span');
                        wdSpan.textContent = ` (${qid})`;
                        wdSpan.style.color = '#666';
                        wdSpan.style.fontSize = '0.9em';
                        itemTitle.appendChild(wdSpan);
                    }
                } else {
                    itemTitle.textContent = titleText;
                }

                itemHeader.appendChild(itemTitle);

                // Item ID and types in a compact format
                if (item['@id'] || item['@type']) {
                    const itemDetails = document.createElement('div');
                    itemDetails.style.fontSize = '0.85em';
                    itemDetails.style.color = '#555';
                    itemDetails.style.fontFamily = 'monospace';

                    // Handle ID
                    if (item['@id']) {
                        const idSpan = document.createElement('code');
                        idSpan.textContent = item['@id'];
                        idSpan.style.display = 'block';
                        idSpan.style.overflow = 'hidden';
                        idSpan.style.textOverflow = 'ellipsis';
                        idSpan.title = item['@id'];
                        itemDetails.appendChild(idSpan);
                    }

                    // Handle type as badges
                    if (item['@type']) {
                        const typeContainer = document.createElement('div');
                        typeContainer.style.marginTop = '3px';

                        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
                        types.forEach(type => {
                            const typeSpan = document.createElement('span');
                            typeSpan.textContent = type;
                            typeSpan.style.display = 'inline-block';
                            typeSpan.style.backgroundColor = '#e0e0e0';
                            typeSpan.style.color = '#333';
                            typeSpan.style.padding = '2px 6px';
                            typeSpan.style.borderRadius = '3px';
                            typeSpan.style.marginRight = '5px';
                            typeSpan.style.fontSize = '0.85em';
                            typeContainer.appendChild(typeSpan);
                        });

                        itemDetails.appendChild(typeContainer);
                    }

                    itemHeader.appendChild(itemDetails);
                }

                itemContainer.appendChild(itemHeader);

                // Item properties
                const properties = document.createElement('div');
                properties.className = 'lod-properties';
                properties.style.marginLeft = '10px';

                // Get all properties, sorted by importance
                const propKeys = Object.keys(item).filter(key => key !== '@id' && key !== '@type' && key !== '@context');

                // Order properties: title/name first, then descriptive properties, then technical properties
                const titleProps = propKeys.filter(key => key.includes('title') || key.includes('name') || key.includes('label'));
                const descProps = propKeys.filter(key => !key.startsWith('o:') && !titleProps.includes(key));
                const techProps = propKeys.filter(key => key.startsWith('o:') && !titleProps.includes(key));

                const orderedProps = [...titleProps, ...descProps, ...techProps];

                // Only show selected properties in main view (avoid overwhelming display)
                const highPriorityProps = orderedProps.filter(prop => {
                    // Skip title/name props as they're already in the header
                    if ((prop === 'o:title' || (prop === 'schema:name' && item['o:title']))) {
                        return false;
                    }
                    
                    // Hide extracted text by default (too large/noisy)
                    if (prop === 'extracttext:extracted_text') {
                        return false;
                    }
                    
                    return true;
                });

                // Add each property
                highPriorityProps.forEach((prop, idx) => {
                    // Add alternating background for better readability
                    const row = createPropertyRow(prop, item[prop]);
                    if (idx % 2 === 0) {
                        row.style.backgroundColor = '#f9f9f9';
                    }
                    properties.appendChild(row);
                });

                itemContainer.appendChild(properties);
                dataDisplay.appendChild(itemContainer);
            });
        } else if (typeof data === 'object' && data !== null) {
            // Handle single object display
            const itemContainer = document.createElement('div');
            itemContainer.className = 'lod-item';

            // Item header
            const itemHeader = document.createElement('div');
            itemHeader.className = 'lod-item-header';
            itemHeader.style.marginBottom = '15px';

            // Item title
            const itemTitle = document.createElement('h3');
            itemTitle.style.marginBottom = '5px';

            if (data['@id']) {
                const idLink = document.createElement('a');
                idLink.href = data['@id'];
                idLink.target = '_blank';
                idLink.textContent = data['o:title'] || data['schema:name']?.[0]?.['@value'] || 'Resource';
                itemTitle.appendChild(idLink);
            } else {
                itemTitle.textContent = data['o:title'] || data['schema:name']?.[0]?.['@value'] || 'Resource';
            }

            itemHeader.appendChild(itemTitle);

            // Item ID and types
            if (data['@id'] || data['@type']) {
                const itemDetails = document.createElement('div');
                itemDetails.style.fontSize = '0.9em';
                itemDetails.style.color = '#555';

                if (data['@id']) {
                    const idSpan = document.createElement('span');
                    idSpan.textContent = `ID: ${data['@id']}`;
                    itemDetails.appendChild(idSpan);
                }

                if (data['@type']) {
                    const typeSpan = document.createElement('span');
                    if (data['@id']) {
                        typeSpan.textContent = ` | Type: ${Array.isArray(data['@type']) ? data['@type'].join(', ') : data['@type']}`;
                    } else {
                        typeSpan.textContent = `Type: ${Array.isArray(data['@type']) ? data['@type'].join(', ') : data['@type']}`;
                    }
                    itemDetails.appendChild(typeSpan);
                }

                itemHeader.appendChild(itemDetails);
            }

            itemContainer.appendChild(itemHeader);

            // Item properties
            const properties = document.createElement('div');
            properties.className = 'lod-properties';
            properties.style.marginLeft = '15px';

            // Get all properties, sorted by importance
            const propKeys = Object.keys(data).filter(key => key !== '@id' && key !== '@type' && key !== '@context');

            // Order properties: title/name first, then descriptive properties, then technical properties
            const titleProps = propKeys.filter(key => key.includes('title') || key.includes('name') || key.includes('label'));
            const descProps = propKeys.filter(key => !key.startsWith('o:') && !titleProps.includes(key));
            const techProps = propKeys.filter(key => key.startsWith('o:') && !titleProps.includes(key));

            const orderedProps = [...titleProps, ...descProps, ...techProps];

            // Add each property
            orderedProps.forEach(prop => {
                properties.appendChild(createPropertyRow(prop, data[prop]));
            });

            itemContainer.appendChild(properties);
            dataDisplay.appendChild(itemContainer);
        } else {
            // Unexpected data format
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'Unexpected data format. Linked Open Data view requires object or array data.';
            errorMsg.style.color = 'red';
            dataDisplay.appendChild(errorMsg);
        }

        lodContent.appendChild(dataDisplay);
        return lodContent;
    }

    // Function to fetch context data if not already loaded
    function loadContextData(callback) {
        // Check if we have a context URL
        if (!contextUrl) {
            // Look for context in the data
            if (Array.isArray(data) && data.length > 0 && data[0]['@context']) {
                if (typeof data[0]['@context'] === 'string') {
                    contextUrl = data[0]['@context'];
                } else {
                    // Context is inline
                    contextData = { '@context': data[0]['@context'] };
                    // Share context data with property-view.js for LOD exports
                    setContextData(contextData);
                    callback();
                    return;
                }
            } else if (typeof data === 'object' && data !== null && data['@context']) {
                if (typeof data['@context'] === 'string') {
                    contextUrl = data['@context'];
                } else {
                    // Context is inline
                    contextData = { '@context': data['@context'] };
                    // Share context data with property-view.js for LOD exports
                    setContextData(contextData);
                    callback();
                    return;
                }
            } else {
                // No context found
                callback();
                return;
            }
        }

        // If we have a context URL but no data yet, fetch it
        if (contextUrl && !contextData) {
            // Add loading message
            const loadingMsg = document.createElement('p');
            loadingMsg.textContent = 'Loading context data...';
            loadingMsg.style.fontStyle = 'italic';
            container.appendChild(loadingMsg);

            // Fetch the context
            fetch(contextUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    contextData = data;
                    // Share context data with property-view.js for LOD exports
                    setContextData(contextData);
                    container.innerHTML = '';
                    container.appendChild(lodTitle);
                    container.appendChild(lodDesc);
                    callback();
                })
                .catch(error => {
                    container.innerHTML = '';
                    container.appendChild(lodTitle);
                    container.appendChild(lodDesc);
                    const errorMsg = document.createElement('p');
                    errorMsg.textContent = `Error loading context: ${error.message}`;
                    errorMsg.style.color = 'red';
                    container.appendChild(errorMsg);
                    callback();
                });
        } else {
            callback();
        }
    }

    // Load context data and then create the LOD view
    loadContextData(() => {
        container.appendChild(createLodView());
    });
}