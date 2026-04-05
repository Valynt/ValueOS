/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import * as fixtures from './fixtures';
import { hydrateInitialState } from './store';

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

describe('hydrateInitialState', () => {
  it('does not crash on malformed JSON and falls back to defaults', () => {
    const baseState = buildBaseState();

    expect(() => hydrateInitialState(baseState, '{invalid-json')).not.toThrow();

    const hydrated = hydrateInitialState(baseState, '{invalid-json');
    expect(hydrated).toStrictEqual(baseState);
    expect(hydrated).toBe(baseState);
  });

  it('ignores unknown keys and prototype pollution keys', () => {
    const baseState = buildBaseState();
    const serializedState = JSON.stringify({
      deals: [{ ...fixtures.deals[0], id: 'persisted-deal' }],
      users: [{ id: 'persisted-user', name: 'Persisted User', email: 'persisted@valueos.com', role: 'admin' }],
      currentUser: { id: 'persisted-user', name: 'Persisted User', email: 'persisted@valueos.com', role: 'admin' },
      unknownSlice: ['unexpected-data'],
      ['__proto__']: { polluted: true },
      ['constructor']: { prototype: { pollutedAgain: true } },
    });

    const hydrated = hydrateInitialState(baseState, serializedState);

    expect(hydrated.deals).toStrictEqual([{ ...fixtures.deals[0], id: 'persisted-deal' }]);
    expect(hydrated.users).toStrictEqual(baseState.users);
    expect(hydrated.currentUser).toStrictEqual(baseState.currentUser);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(({} as { pollutedAgain?: boolean }).pollutedAgain).toBeUndefined();
  });

  it('rejects invalid typed payloads for persisted slices', () => {
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
      hypotheses: [
        {
          id: 'invalid-hypothesis',
          dealId: '1',
          driverId: '1',
          inputs: { baseline: 'wrong-type' },
          outputs: { output: 100 },
        },
      ],
    });

    const hydrated = hydrateInitialState(baseState, serializedState);

    expect(hydrated.deals).toStrictEqual(baseState.deals);
    expect(hydrated.hypotheses).toStrictEqual(baseState.hypotheses);
    expect(hydrated).toStrictEqual(baseState);
  });

  it('hydrates without mutating the existing state object in place', () => {
    const baseState = buildBaseState();
    const stateSnapshotBefore = JSON.parse(JSON.stringify(baseState));
    const serializedState = JSON.stringify({
      deals: [{ ...fixtures.deals[0], id: 'hydrated-deal' }],
      valueDrivers: [{ ...fixtures.valueDrivers[0], id: 'hydrated-driver' }],
    });

    const hydrated = hydrateInitialState(baseState, serializedState);

    expect(hydrated).not.toBe(baseState);
    expect(baseState).toStrictEqual(stateSnapshotBefore);
    expect(hydrated.deals).toStrictEqual([{ ...fixtures.deals[0], id: 'hydrated-deal' }]);
    expect(hydrated.valueDrivers).toStrictEqual([{ ...fixtures.valueDrivers[0], id: 'hydrated-driver' }]);
  });
});
