import { detectOmekaItemLink, detectReferences } from '../../../src/js/references/core/detector.js';

describe('references/core/detector', () => {
  test('prefers explicit Omeka item @id when available', () => {
    const item = {
      '@id': 'https://collections.example.org/api/items/42',
      'o:id': 42
    };

    expect(detectOmekaItemLink(item, {
      apiUrl: 'https://collections.example.org/api/items?page=2'
    })).toEqual({
      type: 'omeka-item',
      url: 'https://collections.example.org/api/items/42',
      displayName: 'Omeka Item Link'
    });
  });

  test('builds an Omeka item API URL from apiUrl and o:id when @id is missing', () => {
    const item = {
      'o:id': 1090,
      'schema:sameAs': [
        {
          '@id': 'https://www.worldcat.org/oclc/123456'
        }
      ]
    };

    expect(detectOmekaItemLink(item, {
      apiUrl: 'https://radboudcollections.omeka.net/api/items?page=5&per_page=2'
    })).toEqual({
      type: 'omeka-item',
      url: 'https://radboudcollections.omeka.net/api/items/1090',
      displayName: 'Omeka Item Link'
    });
  });

  test('detects source-institution and OCLC references together for wrapper responses', () => {
    const detectionResults = detectReferences({
      items: [
        {
          'o:id': 1090,
          'schema:sameAs': [
            {
              '@id': 'https://www.worldcat.org/oclc/123456'
            }
          ]
        }
      ]
    }, {
      apiUrl: 'https://radboudcollections.omeka.net/api/items?page=5&per_page=2'
    });

    const itemReferences = Object.values(detectionResults.itemReferences)[0];

    expect(itemReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'omeka-item',
          url: 'https://radboudcollections.omeka.net/api/items/1090'
        }),
        expect.objectContaining({
          type: 'oclc',
          url: 'https://www.worldcat.org/oclc/123456'
        })
      ])
    );
  });
});
