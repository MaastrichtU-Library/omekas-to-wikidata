import { extractPropertyValues } from '../../../src/js/reconciliation/core/reconciliation-data.js';

describe('reconciliation-data.extractPropertyValues', () => {
  test('prefers human-readable resource titles over object stringification', () => {
    const item = {
      'schema:provider': [
        {
          type: 'resource',
          display_title: 'Museum Collection',
          '@id': 'https://example.org/api/items/42'
        }
      ]
    };

    const values = extractPropertyValues(item, 'schema:provider');

    expect(values).toEqual(['Museum Collection']);
  });

  test('respects selected @ fields without falling back to object display text', () => {
    const item = {
      'schema:provider': [
        {
          type: 'resource',
          display_title: 'Museum Collection',
          '@id': 'https://example.org/api/items/42'
        }
      ]
    };

    const values = extractPropertyValues(item, {
      key: 'schema:provider',
      selectedAtField: '@id'
    });

    expect(values).toEqual(['https://example.org/api/items/42']);
  });

  test('normalizes recognized identifier URLs for external-id mappings', () => {
    const item = {
      'schema:sameAs': [
        {
          type: 'uri',
          '@id': 'https://maastrichtuniversity.on.worldcat.org/oclc/1453617041'
        }
      ]
    };

    const values = extractPropertyValues(item, {
      key: 'schema:sameAs',
      selectedAtField: '@id',
      property: {
        id: 'P243',
        datatype: 'external-id'
      }
    });

    expect(values).toEqual(['1453617041']);
  });

  test('extracts a specific object index from mixed JSON value arrays', () => {
    const item = {
      'schema:itemLocation': [
        {
          type: 'literal',
          '@value': 'INV-602'
        },
        {
          type: 'resource',
          'o:label': 'Special Collections',
          '@id': 'https://example.org/api/items/88'
        }
      ]
    };

    const inventoryValues = extractPropertyValues(item, {
      key: 'schema:itemLocation',
      selectedAtField: '@value',
      selectedObjectIndex: 0
    });

    const collectionValues = extractPropertyValues(item, {
      key: 'schema:itemLocation',
      selectedAtField: 'o:label',
      selectedObjectIndex: 1
    });

    expect(inventoryValues).toEqual(['INV-602']);
    expect(collectionValues).toEqual(['Special Collections']);
  });

  test('uses display text automatically for Wikidata item mappings with mixed literal and authority values', () => {
    const item = {
      'schema:author': [
        {
          type: 'literal',
          '@value': 'Anne Author'
        },
        {
          type: 'valuesuggest:oclc:viaf',
          '@id': 'https://viaf.org/viaf/12345',
          'o:label': 'Author, Anne'
        }
      ]
    };

    const values = extractPropertyValues(item, {
      key: 'schema:author',
      extractionMode: 'auto',
      fieldProfile: {
        hasLiterals: true,
        hasAuthorityLabels: true,
        hasUris: true
      },
      property: {
        id: 'P50',
        datatype: 'wikibase-item'
      }
    });

    expect(values).toEqual(['Anne Author', 'Author, Anne']);
  });

  test('uses URI-backed identifiers automatically for external-id mappings', () => {
    const item = {
      'schema:sameAs': [
        {
          type: 'uri',
          '@id': 'https://www.worldcat.org/oclc/1453617041',
          'o:label': 'WorldCat'
        }
      ]
    };

    const values = extractPropertyValues(item, {
      key: 'schema:sameAs',
      extractionMode: 'auto',
      fieldProfile: {
        hasLiterals: false,
        hasAuthorityLabels: true,
        hasUris: true
      },
      property: {
        id: 'P243',
        datatype: 'external-id'
      }
    });

    expect(values).toEqual(['1453617041']);
  });
});
