import { setupExportStep } from '../../../src/js/steps/export.js';
import { eventSystem } from '../../../src/js/events.js';

describe('steps/export monolingual text output', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="export-container">
        <div class="quick-statements-output">
          <textarea id="quick-statements"></textarea>
          <button id="copy-quick-statements"></button>
          <button id="download-quick-statements"></button>
          <button id="open-quick-statements"></button>
        </div>
      </div>
    `;
  });

  test('exports monolingual text values with a language prefix for regular properties', () => {
    const state = {
      getState: () => ({
        currentStep: 1,
        reconciliationData: {
          'item-0': {
            originalData: {
              '@id': 'https://example.org/api/items/1'
            },
            properties: {
              'dcterms:title::P1476': {
                reconciled: [
                  {
                    selectedMatch: {
                      type: 'custom',
                      value: 'Example Title',
                      datatype: 'monolingualtext',
                      language: 'en'
                    }
                  }
                ]
              }
            }
          }
        },
        mappings: {
          mappedKeys: [
            {
              key: 'dcterms:title',
              property: {
                id: 'P1476',
                label: 'title',
                datatype: 'monolingualtext'
              }
            }
          ],
          manualProperties: []
        },
        references: {
          propertyReferences: {},
          itemReferences: {},
          customReferences: []
        },
        linkedItems: {}
      })
    };

    setupExportStep(state);
    eventSystem.publish(eventSystem.Events.STEP_CHANGED, { newStep: 5 });

    expect(document.getElementById('quick-statements').value).toContain('CREATE');
    expect(document.getElementById('quick-statements').value).toContain('LAST\tP1476\ten:"Example Title"');
  });
});
