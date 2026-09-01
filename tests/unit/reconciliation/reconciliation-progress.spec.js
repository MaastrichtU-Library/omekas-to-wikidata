import { createCellMarkers } from '../../../src/js/reconciliation/core/reconciliation-progress.js';

describe('reconciliation-progress.createCellMarkers', () => {
  let reconciliationData;
  let state;
  let updateCellDisplay;
  let updateProceedButton;
  let contextSuggestions;
  let markers;

  beforeEach(() => {
    reconciliationData = {
      'item-0': {
        properties: {
          'schema:creator::P50': {
            originalValues: ['Vincent van Gogh'],
            reconciled: [
              {
                status: 'pending',
                matches: [],
                selectedMatch: null,
                confidence: 0
              }
            ]
          }
        }
      },
      'item-1': {
        properties: {
          'schema:creator::P50': {
            originalValues: ['Vincent van Gogh'],
            reconciled: [
              {
                status: 'pending',
                matches: [],
                selectedMatch: null,
                confidence: 0
              }
            ]
          }
        }
      },
      'item-2': {
        properties: {
          'schema:creator::P50': {
            originalValues: ['Paul Gauguin'],
            reconciled: [
              {
                status: 'pending',
                matches: [],
                selectedMatch: null,
                confidence: 0
              }
            ]
          }
        }
      }
    };

    state = {
      updateState: jest.fn(),
      getState: jest.fn(() => ({
        reconciliationProgress: {
          total: 3,
          completed: 0,
          skipped: 0,
          errors: 0
        }
      }))
    };
    updateCellDisplay = jest.fn();
    updateProceedButton = jest.fn();
    contextSuggestions = new Map();

    markers = createCellMarkers(
      reconciliationData,
      state,
      updateCellDisplay,
      updateProceedButton,
      contextSuggestions
    );
  });

  function getLatestProgressUpdate() {
    return state.updateState.mock.calls
      .filter(([path]) => path === 'reconciliationProgress')
      .at(-1)?.[1];
  }

  test('recalculates progress from actual cell states when overwriting decisions', () => {
    const cellInfo = {
      itemId: 'item-0',
      property: 'schema:creator',
      mappingId: 'schema:creator::P50',
      valueIndex: 0,
      value: 'Vincent van Gogh'
    };

    markers.markCellAsReconciled(cellInfo, {
      type: 'wikidata',
      id: 'Q5582',
      label: 'Vincent van Gogh'
    });
    markers.markCellAsReconciled(cellInfo, {
      type: 'wikidata',
      id: 'Q5582',
      label: 'Vincent van Gogh'
    });

    expect(getLatestProgressUpdate()).toEqual({
      total: 3,
      completed: 1,
      skipped: 0,
      errors: 0
    });
  });

  test('applies a decision to identical values in the same mapping when requested', () => {
    markers.markCellAsReconciled(
      {
        itemId: 'item-0',
        property: 'schema:creator',
        mappingId: 'schema:creator::P50',
        valueIndex: 0,
        value: 'Vincent van Gogh',
        applyToIdenticalValues: true
      },
      {
        type: 'wikidata',
        id: 'Q5582',
        label: 'Vincent van Gogh'
      }
    );

    expect(reconciliationData['item-0'].properties['schema:creator::P50'].reconciled[0].selectedMatch.id).toBe('Q5582');
    expect(reconciliationData['item-1'].properties['schema:creator::P50'].reconciled[0].selectedMatch.id).toBe('Q5582');
    expect(reconciliationData['item-2'].properties['schema:creator::P50'].reconciled[0].status).toBe('pending');
    expect(getLatestProgressUpdate()).toEqual({
      total: 3,
      completed: 2,
      skipped: 0,
      errors: 0
    });
    expect(updateCellDisplay).toHaveBeenCalledTimes(2);
  });

  test('resetting a reconciled cell returns it to pending and lowers progress', () => {
    reconciliationData['item-0'].properties['schema:creator::P50'].reconciled[0] = {
      status: 'reconciled',
      matches: [],
      selectedMatch: {
        type: 'wikidata',
        id: 'Q5582',
        label: 'Vincent van Gogh'
      },
      confidence: 95
    };

    markers.markCellAsPending({
      itemId: 'item-0',
      property: 'schema:creator',
      mappingId: 'schema:creator::P50',
      valueIndex: 0,
      value: 'Vincent van Gogh'
    });

    expect(reconciliationData['item-0'].properties['schema:creator::P50'].reconciled[0].status).toBe('pending');
    expect(reconciliationData['item-0'].properties['schema:creator::P50'].reconciled[0].selectedMatch).toBeNull();
    expect(getLatestProgressUpdate()).toEqual({
      total: 3,
      completed: 0,
      skipped: 0,
      errors: 0
    });
  });
});
