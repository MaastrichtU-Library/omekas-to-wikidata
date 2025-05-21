/**
 * Mock data module for development and testing
 * Contains sample data that mimics API responses from Omeka S
 * @module data/mock-data
 */

/**
 * Get dummy Omeka S items data
 * @returns {Object} Sample Omeka S API response with items
 */
export function getMockItemsData() {
    return {
        "items": [
            {
                "@context": "http://example.org/context/item",
                "@id": "http://example.org/api/items/1",
                "@type": ["o:Item"],
                "o:id": 1,
                "o:title": "Example Item",
                "dcterms:title": [
                    {
                        "@value": "Example Item",
                        "@language": "en"
                    }
                ],
                "dcterms:description": [
                    {
                        "@value": "This is an example item description.",
                        "@language": "en"
                    }
                ],
                "dcterms:creator": [
                    {
                        "@value": "John Doe",
                        "@language": null
                    }
                ],
                "dcterms:date": [
                    {
                        "@value": "2023-01-15",
                        "@type": "http://www.w3.org/2001/XMLSchema#date"
                    }
                ],
                "o:created": {
                    "@value": "2023-01-15T10:30:45+00:00",
                    "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
                }
            },
            {
                "@context": "http://example.org/context/item",
                "@id": "http://example.org/api/items/2",
                "@type": ["o:Item"],
                "o:id": 2,
                "o:title": "Another Example Item",
                "dcterms:title": [
                    {
                        "@value": "Another Example Item",
                        "@language": "en"
                    }
                ],
                "dcterms:description": [
                    {
                        "@value": "This is another example item description.",
                        "@language": "en"
                    }
                ],
                "dcterms:creator": [
                    {
                        "@value": "Jane Smith",
                        "@language": null
                    }
                ],
                "dcterms:date": [
                    {
                        "@value": "2023-02-20",
                        "@type": "http://www.w3.org/2001/XMLSchema#date"
                    }
                ],
                "o:created": {
                    "@value": "2023-02-20T14:15:30+00:00",
                    "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
                }
            }
        ]
    };
}

/**
 * Get mock property mapping data
 * @returns {Object} Sample property mapping data
 */
export function getMockMappingData() {
    return {
        "mappings": {
            "nonLinkedKeys": ["o:title", "dcterms:description"],
            "mappedKeys": ["dcterms:creator", "dcterms:date"],
            "ignoredKeys": ["o:created", "@context", "@id", "@type", "o:id"]
        },
        "wikidataProperties": {
            "dcterms:creator": {
                "property": "P170",
                "label": "creator",
                "datatype": "wikibase-item",
                "reconciliationService": "https://wikidata.reconci.link/en/api"
            },
            "dcterms:date": {
                "property": "P571",
                "label": "inception",
                "datatype": "time",
                "format": "+%Y-%m-%d"
            }
        }
    };
}

/**
 * Get mock reconciliation data
 * @returns {Object} Sample reconciliation data
 */
export function getMockReconciliationData() {
    return {
        "reconciliationProgress": {
            "total": 2,
            "completed": 1
        },
        "reconciliationData": [
            {
                "id": "item1",
                "properties": {
                    "dcterms:creator": {
                        "original": "John Doe",
                        "reconciled": {
                            "id": "Q123456",
                            "label": "John Doe",
                            "description": "American author",
                            "score": 0.95,
                            "match": true
                        }
                    },
                    "dcterms:date": {
                        "original": "2023-01-15",
                        "formatted": "+2023-01-15"
                    }
                }
            },
            {
                "id": "item2",
                "properties": {
                    "dcterms:creator": {
                        "original": "Jane Smith",
                        "reconciled": null // Not yet reconciled
                    },
                    "dcterms:date": {
                        "original": "2023-02-20",
                        "formatted": "+2023-02-20"
                    }
                }
            }
        ]
    };
}

/**
 * Get mock references (sources) data
 * @returns {Array} Sample references data
 */
export function getMockReferencesData() {
    return [
        {
            "id": "ref1",
            "label": "Omeka S API",
            "url": "http://example.org/api",
            "date": "2023-03-15",
            "properties": {
                "stated in": "P248",
                "retrieved": "P813"
            }
        }
    ];
}

/**
 * Get mock QuickStatements export
 * @returns {string} Sample QuickStatements export
 */
export function getMockQuickStatementsExport() {
    return `
CREATE
LAST|Len|"Example Item"
LAST|Den|"This is an example item description."
LAST|P170|Q123456
LAST|P571|+2023-01-15T00:00:00Z
LAST|P248|Q12345|S854|"http://example.org/api"|S813|+2023-03-15T00:00:00Z

CREATE
LAST|Len|"Another Example Item"
LAST|Den|"This is another example item description."
LAST|P170|Q234567
LAST|P571|+2023-02-20T00:00:00Z
LAST|P248|Q12345|S854|"http://example.org/api"|S813|+2023-03-15T00:00:00Z
    `.trim();
}