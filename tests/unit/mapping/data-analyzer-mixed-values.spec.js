import { extractAllFieldsFromItems } from '../../../src/js/mapping/core/data-analyzer.js';

describe('mapping/core/data-analyzer mixed JSON value grouping', () => {
  test('keeps field groups tied to their original object index', () => {
    const items = [
      {
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
      }
    ];

    const fieldGroups = extractAllFieldsFromItems('schema:itemLocation', items);

    expect(fieldGroups).toEqual([
      expect.objectContaining({
        objectIndex: 0,
        fields: expect.arrayContaining([
          expect.objectContaining({ key: '@value' })
        ])
      }),
      expect.objectContaining({
        objectIndex: 1,
        fields: expect.arrayContaining([
          expect.objectContaining({ key: 'o:label' }),
          expect.objectContaining({ key: '@id' })
        ])
      })
    ]);
  });
});
