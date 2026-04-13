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
});
