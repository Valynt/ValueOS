import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { z } from 'zod';

import * as fixtures from './fixtures';
import {
  Artifact,
  AuditEvent,
  Benchmark,
  Deal,
  Hypothesis,
  ROIModel,
  Stakeholder,
  User,
  ValueDriver,
  ValueRealization,
} from './types';

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

const PERSISTED_STATE_KEY = 'valueos-state';

const roleSchema = z.enum(['admin', 'revops', 'field']);
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: roleSchema,
});

const dealSchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.string(),
  amount: z.number(),
  closeDate: z.string(),
  contacts: z.array(z.string()),
});

const stakeholderSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  name: z.string(),
  role: z.string(),
  influence: z.number(),
  priorities: z.array(z.string()),
});

const valueDriverSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  personaTags: z.array(z.string()),
  motionTags: z.array(z.string()),
  formula: z.string(),
  defaultAssumptions: z.record(z.string(), z.number()),
  narrativePitch: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  version: z.number(),
});

const benchmarkSchema = z.object({
  id: z.string(),
  industry: z.string(),
  metric: z.string(),
  baselineMin: z.number(),
  baselineMax: z.number(),
  source: z.string(),
  confidence: z.number(),
});

const hypothesisSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  driverId: z.string(),
  inputs: z.record(z.string(), z.number()),
  outputs: z.record(z.string(), z.number()),
});

const roiModelSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  components: z.object({
    revenueUplift: z.number(),
    costSavings: z.number(),
    riskReduction: z.number(),
  }),
  paybackMonths: z.number(),
  scenarios: z.array(
    z.object({
      name: z.string(),
      multiplier: z.number(),
    }),
  ),
});

const artifactSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  type: z.enum(['exec-summary', 'one-page', 'qbr-report']),
  content: z.string(),
});

const valueRealizationSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  committed: z.record(z.string(), z.number()),
  actual: z.record(z.string(), z.number()),
  variance: z.record(z.string(), z.number()),
  rootCause: z.string(),
  actions: z.array(z.string()),
});

const auditEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  timestamp: z.string(),
  before: z.unknown(),
  after: z.unknown(),
});

const stateSchema = z.object({
  users: z.array(userSchema),
  deals: z.array(dealSchema),
  stakeholders: z.array(stakeholderSchema),
  valueDrivers: z.array(valueDriverSchema),
  benchmarks: z.array(benchmarkSchema),
  hypotheses: z.array(hypothesisSchema),
  roiModels: z.array(roiModelSchema),
  artifacts: z.array(artifactSchema),
  valueRealizations: z.array(valueRealizationSchema),
  auditEvents: z.array(auditEventSchema),
  currentUser: userSchema.nullable(),
});

type PersistedStateKey =
  | 'deals'
  | 'stakeholders'
  | 'valueDrivers'
  | 'benchmarks'
  | 'hypotheses'
  | 'roiModels'
  | 'artifacts'
  | 'valueRealizations';

const persistedStateSchemas: { [K in PersistedStateKey]: z.ZodType<State[K]> } = {
  deals: stateSchema.shape.deals,
  stakeholders: stateSchema.shape.stakeholders,
  valueDrivers: stateSchema.shape.valueDrivers,
  benchmarks: stateSchema.shape.benchmarks,
  hypotheses: stateSchema.shape.hypotheses,
  roiModels: stateSchema.shape.roiModels,
  artifacts: stateSchema.shape.artifacts,
  valueRealizations: stateSchema.shape.valueRealizations,
};

const persistedStateKeys = Object.keys(persistedStateSchemas) as PersistedStateKey[];

const createInitialState = (): State => ({
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
});

const defaultState = createInitialState();

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

const sanitizePersistedState = (parsed: unknown): Partial<Pick<State, PersistedStateKey>> => {
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  const parsedRecord = parsed as Record<string, unknown>;
  return persistedStateKeys.reduce<Partial<Pick<State, PersistedStateKey>>>((accumulator, key) => {
    const validated = persistedStateSchemas[key].safeParse(parsedRecord[key]);
    if (validated.success) {
      accumulator[key] = validated.data;
    }
    return accumulator;
  }, {});
};

export const hydrateInitialState = (state: State = createInitialState(), serializedState: string | null): State => {
  if (!serializedState) {
    return state;
  }

  try {
    const parsed = JSON.parse(serializedState);
    const hydratedSlices = sanitizePersistedState(parsed);
    return { ...state, ...hydratedSlices };
  } catch {
    return state;
  }
};

const initState = (baseState: State): State => hydrateInitialState(baseState, localStorage.getItem(PERSISTED_STATE_KEY));

const DataContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, defaultState, initState);

  useEffect(() => {
    const persistedState = persistedStateKeys.reduce<Partial<Pick<State, PersistedStateKey>>>((accumulator, key) => {
      accumulator[key] = state[key];
      return accumulator;
    }, {});

    localStorage.setItem(PERSISTED_STATE_KEY, JSON.stringify(persistedState));
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
