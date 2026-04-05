import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DataProvider, SAVE_DELAY_MS, STORAGE_KEY, initialState, useData } from './store';

const Consumer = () => {
  const { state, dispatch } = useData();

  return (
    <>
      <div data-testid="deals-count">{state.deals.length}</div>
      <div data-testid="audit-count">{state.auditEvents.length}</div>
      <button
        onClick={() => dispatch({
          type: 'ADD_AUDIT_EVENT',
          payload: {
            id: 'audit-test',
            userId: 'user-test',
            action: 'TEST_ACTION',
            entity: 'store',
            entityId: 'store-1',
            timestamp: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            before: null,
            after: { persisted: true },
          },
        })}
        type="button"
      >
        add-audit
      </button>
    </>
  );
};

describe('data store persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('hydrates once via reducer initializer without mutating initial state', () => {
    const hydratedDeals = [{
      id: 'deal-hydrated',
      name: 'Hydrated Deal',
      stage: 'Discovery',
      amount: 1000,
      closeDate: '2026-02-01',
      contacts: [],
    }];

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ deals: hydratedDeals }));

    const getItemSpy = vi.spyOn(localStorage, 'getItem');
    const initialDealsReference = initialState.deals;

    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    );

    expect(screen.getByTestId('deals-count')).toHaveTextContent('1');
    expect(getItemSpy).toHaveBeenCalledTimes(1);
    expect(initialState.deals).toBe(initialDealsReference);
    expect(initialState.deals.some((deal) => deal.id === 'deal-hydrated')).toBe(false);
  });

  it('persists debounced state after dispatches and excludes fixture-only slices', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem');

    render(
      <DataProvider>
        <Consumer />
      </DataProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'add-audit' }).click();
      vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
    });

    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    const [, payload] = setItemSpy.mock.calls[0];
    const parsed = JSON.parse(payload);

    expect(parsed.auditEvents).toBeTruthy();
    expect(parsed.users).toBeUndefined();
    expect(parsed.benchmarks).toBeUndefined();
  });

  it('ignores malformed localStorage payloads without crashing initialization', () => {
    localStorage.setItem(STORAGE_KEY, '{bad-json');

    expect(() => {
      render(
        <DataProvider>
          <Consumer />
        </DataProvider>,
      );
    }).not.toThrow();

    expect(screen.getByTestId('deals-count')).toHaveTextContent(String(initialState.deals.length));
  });
});
