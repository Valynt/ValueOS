/** @vitest-environment jsdom */

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as fixtures from './fixtures';
import {
  DataProvider,
  SAVE_DELAY_MS,
  STORAGE_KEY,
  initialState,
  useData,
  hydrateInitialState,
} from './store';

/**
 * Test Consumer for Provider-based tests
 */
const Consumer = () => {
  const { state, dispatch } = useData();

  return (
    <>
      <div data-testid="deals-count">{state.deals.length}</div>
      <div data-testid="audit-count">{state.auditEvents.length}</div>
      <button
        onClick={() =>
          dispatch({
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
          })
        }
        type="button"
      >
        add-audit
      </button>
    </>
  );
};

/**
 * Helper for hydration-only tests
 */
const buildBaseState = () => ({
  users: fixtures.users,
  deals: fixtures.deals,
  stakeholders: fixtures.stakeholders,
  valueDrivers: fixtures.valueDrivers,
  benchmarks: fixtures.benchmarks,
  hypotheses: fixtures.hypotheses,
  roiModels: fixtures.roiModels,
  artifacts: fixtures.artifacts,
  valueRealizations: fixtures.valueRealizations,
  auditEvents: fixtures.auditEvents,
  currentUser: fixtures.users[0],
});

describe('data store persistence + hydration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
  });

  /**
   * -----------------------------
   * HYDRATION TESTS
   * -----------------------------
   */

  it('hydrates once via reducer initializer without mutating initial state', () => {
    const hydratedDeals = [
      {
        id: 'deal-hydrated',
        name: 'Hydrated Deal',
        stage: 'Discovery',
        amount: 1000,
        closeDate: '2026-02-01',
        contacts: [],
      },
    ];

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

    // Ensure no mutation of initial state
    expect(initialState.deals).toBe(initialDealsReference);
    expect(
      initialState.deals.some((deal) => deal.id === 'deal-hydrated'),
    ).toBe(false);
  });

  it('ignores malformed localStorage payloads without crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{bad-json');

    expect(() => {
      render(
        <DataProvider>
          <Consumer />
        </DataProvider>,
      );
    }).not.toThrow();

    expect(screen.getByTestId('deals-count')).toHaveTextContent(
      String(initialState.deals.length),
    );
  });

  it('hydrateInitialState: falls back safely on malformed JSON', () => {
    const baseState = buildBaseState();

    const hydrated = hydrateInitialState(baseState, '{invalid-json');

    expect(hydrated).toStrictEqual(baseState);
    expect(hydrated).toBe(baseState);
  });

  it('ignores unknown keys and prototype pollution attempts', () => {
    const baseState = buildBaseState();

    const serializedState = JSON.stringify({
      deals: [{ ...fixtures.deals[0], id: 'persisted-deal' }],
      unknownSlice: ['unexpected-data'],
      ['__proto__']: { polluted: true },
      ['constructor']: { prototype: { pollutedAgain: true } },
    });

    const hydrated = hydrateInitialState(baseState, serializedState);

    expect(hydrated.deals).toStrictEqual([
      { ...fixtures.deals[0], id: 'persisted-deal' },
    ]);

    // Ensure pollution did not occur
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(
      ({} as { pollutedAgain?: boolean }).pollutedAgain,
    ).toBeUndefined();
  });

  it('rejects invalid typed payloads', () => {
    const baseState = buildBaseState();

    const serializedState = JSON.stringify({
      deals: [
        {
          id: 'invalid-deal',
          name: 'Invalid Deal',
          stage: 'discovery',
          amount: 'not-a-number',
          closeDate: '2025-01-01',
          contacts: ['contact1'],
        },
      ],
    });

    const hydrated = hydrateInitialState(baseState, serializedState);

    expect(hydrated.deals).toStrictEqual(baseState.deals);
    expect(hydrated).toStrictEqual(baseState);
  });

  it('does not mutate original state during hydration', () => {
    const baseState = buildBaseState();
    const snapshot = JSON.parse(JSON.stringify(baseState));

    const serializedState = JSON.stringify({
      deals: [{ ...fixtures.deals[0], id: 'hydrated-deal' }],
    });

    const hydrated = hydrateInitialState(baseState, serializedState);

    expect(hydrated).not.toBe(baseState);
    expect(baseState).toStrictEqual(snapshot);
  });

  /**
   * -----------------------------
   * PERSISTENCE TESTS
   * -----------------------------
   */

  it('persists debounced state after dispatch and excludes non-persisted slices', () => {
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

    // Not yet persisted
    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);

    const [, payload] = setItemSpy.mock.calls[0];
    const parsed = JSON.parse(payload);

    expect(parsed.auditEvents).toBeTruthy();

    // Ensure fixture-only / non-persisted slices excluded
    expect(parsed.users).toBeUndefined();
    expect(parsed.benchmarks).toBeUndefined();
  });
});