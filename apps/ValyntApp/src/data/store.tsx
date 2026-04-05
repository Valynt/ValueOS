// /workspaces/ValueOS/src/data/store.ts
import React, { createContext, useContext, useEffect, useReducer } from 'react';

import * as fixtures from './fixtures';
import { Artifact, AuditEvent, Benchmark, Deal, Hypothesis, ROIModel, Stakeholder, User, ValueDriver, ValueRealization } from './types';

interface State {
  users: User[];
  deals: Deal[];
  stakeholders: Stakeholder[];
  valueDrivers: ValueDriver[];
  benchmarks: Benchmark[];
  hypotheses: Hypothesis[];
  roiModels: ROIModel[];
  artifacts: Artifact[];
  valueRealizations: ValueRealization[];
  auditEvents: AuditEvent[];
  currentUser: User | null;
}

type Action =
  | { type: 'SET_CURRENT_USER'; payload: User }
  | { type: 'ADD_DEAL'; payload: Deal }
  | { type: 'UPDATE_DEAL'; payload: Deal }
  | { type: 'ADD_STAKEHOLDER'; payload: Stakeholder }
  | { type: 'UPDATE_STAKEHOLDER'; payload: Stakeholder }
  | { type: 'ADD_VALUE_DRIVER'; payload: ValueDriver }
  | { type: 'UPDATE_VALUE_DRIVER'; payload: ValueDriver }
  | { type: 'PUBLISH_VALUE_DRIVER'; payload: string }
  | { type: 'ADD_HYPOTHESIS'; payload: Hypothesis }
  | { type: 'UPDATE_HYPOTHESIS'; payload: Hypothesis }
  | { type: 'ADD_ROI_MODEL'; payload: ROIModel }
  | { type: 'UPDATE_ROI_MODEL'; payload: ROIModel }
  | { type: 'ADD_ARTIFACT'; payload: Artifact }
  | { type: 'UPDATE_ARTIFACT'; payload: Artifact }
  | { type: 'ADD_VALUE_REALIZATION'; payload: ValueRealization }
  | { type: 'UPDATE_VALUE_REALIZATION'; payload: ValueRealization }
  | { type: 'ADD_AUDIT_EVENT'; payload: AuditEvent };

const STORAGE_KEY = 'valueos-state';
const SAVE_DELAY_MS = 200;
const PERSISTED_STATE_KEYS = [
  'deals',
  'stakeholders',
  'valueDrivers',
  'hypotheses',
  'roiModels',
  'artifacts',
  'valueRealizations',
  'auditEvents',
] as const satisfies ReadonlyArray<keyof State>;

const initialState: State = {
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
  currentUser: fixtures.users[0], // Default to admin
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };
    case 'ADD_DEAL':
      return { ...state, deals: [...state.deals, action.payload] };
    case 'UPDATE_DEAL':
      return { ...state, deals: state.deals.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'ADD_STAKEHOLDER':
      return { ...state, stakeholders: [...state.stakeholders, action.payload] };
    case 'UPDATE_STAKEHOLDER':
      return { ...state, stakeholders: state.stakeholders.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_VALUE_DRIVER':
      return { ...state, valueDrivers: [...state.valueDrivers, action.payload] };
    case 'UPDATE_VALUE_DRIVER':
      return { ...state, valueDrivers: state.valueDrivers.map(v => v.id === action.payload.id ? action.payload : v) };
    case 'PUBLISH_VALUE_DRIVER':
      return { ...state, valueDrivers: state.valueDrivers.map(v => v.id === action.payload ? { ...v, status: 'published' as const } : v) };
    case 'ADD_HYPOTHESIS':
      return { ...state, hypotheses: [...state.hypotheses, action.payload] };
    case 'UPDATE_HYPOTHESIS':
      return { ...state, hypotheses: state.hypotheses.map(h => h.id === action.payload.id ? action.payload : h) };
    case 'ADD_ROI_MODEL':
      return { ...state, roiModels: [...state.roiModels, action.payload] };
    case 'UPDATE_ROI_MODEL':
      return { ...state, roiModels: state.roiModels.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'ADD_ARTIFACT':
      return { ...state, artifacts: [...state.artifacts, action.payload] };
    case 'UPDATE_ARTIFACT':
      return { ...state, artifacts: state.artifacts.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'ADD_VALUE_REALIZATION':
      return { ...state, valueRealizations: [...state.valueRealizations, action.payload] };
    case 'UPDATE_VALUE_REALIZATION':
      return { ...state, valueRealizations: state.valueRealizations.map(v => v.id === action.payload.id ? action.payload : v) };
    case 'ADD_AUDIT_EVENT':
      return { ...state, auditEvents: [...state.auditEvents, action.payload] };
    default:
      return state;
  }
}

function buildPersistedState(state: State): Partial<State> {
  return PERSISTED_STATE_KEYS.reduce<Partial<State>>((acc, key) => {
    acc[key] = state[key];
    return acc;
  }, {});
}

function initState(baseState: State): State {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { ...baseState };
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...baseState };
    }

    const hydratedState = PERSISTED_STATE_KEYS.reduce<Partial<State>>((acc, key) => {
      if (key in parsed) {
        const candidate = (parsed as Partial<State>)[key];
        if (candidate !== undefined) {
          acc[key] = candidate;
        }
      }
      return acc;
    }, {});

    return { ...baseState, ...hydratedState };
  } catch {
    return { ...baseState };
  }
}

const DataContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState, initState);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedState(state)));
    }, SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [state]);

  return (
    <DataContext.Provider value={{ state, dispatch }}>
      { children }
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};

export { buildPersistedState, initState, initialState, reducer, SAVE_DELAY_MS, STORAGE_KEY };
