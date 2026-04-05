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

/**
 * -----------------------------
 * STATE
 * -----------------------------
 */
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

/**
 * -----------------------------
 * ACTIONS
 * -----------------------------
 */
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

/**
 * -----------------------------
 * CONSTANTS
 * -----------------------------
 */
export const STORAGE_KEY = 'valueos-state';
export const SAVE_DELAY_MS = 200;

/**
 * Only persist safe slices
 */
type PersistedStateKey =
  | 'deals'
  | 'stakeholders'
  | 'valueDrivers'
  | 'hypotheses'
  | 'roiModels'
  | 'artifacts'
  | 'valueRealizations'
  | 'auditEvents';

const PERSISTED_STATE_KEYS: PersistedStateKey[] = [
  'deals',
  'stakeholders',
  'valueDrivers',
  'hypotheses',
  'roiModels',
  'artifacts',
  'valueRealizations',
  'auditEvents',
];

/**
 * -----------------------------
 * ZOD VALIDATION (from main)
 * -----------------------------
 */

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

const persistedStateSchemas: Record<PersistedStateKey, z.ZodTypeAny> = {
  deals: z.array(dealSchema),
  stakeholders: z.array(stakeholderSchema),
  valueDrivers: z.array(valueDriverSchema),
  hypotheses: z.array(hypothesisSchema),
  roiModels: z.array(roiModelSchema),
  artifacts: z.array(artifactSchema),
  valueRealizations: z.array(valueRealizationSchema),
  auditEvents: z.array(auditEventSchema),
};

/**
 * -----------------------------
 * INITIAL STATE
 * -----------------------------
 */
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
  currentUser: fixtures.users[0],
});

export const initialState = createInitialState();

/**
 * -----------------------------
 * REDUCER
 * -----------------------------
 */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };

    case 'ADD_DEAL':
      return { ...state, deals: [...state.deals, action.payload] };

    case 'UPDATE_DEAL':
      return {
        ...state,
        deals: state.deals.map(d =>
          d.id === action.payload.id ? action.payload : d
        ),
      };

    case 'ADD_AUDIT_EVENT':
      return { ...state, auditEvents: [...state.auditEvents, action.payload] };

    default:
      return state;
  }
}

/**
 * -----------------------------
 * HYDRATION (secure)
 * -----------------------------
 */
const sanitizePersistedState = (
  parsed: unknown
): Partial<Pick<State, PersistedStateKey>> => {
  if (!parsed || typeof parsed !== 'object') return {};

  const record = parsed as Record<string, unknown>;

  return PERSISTED_STATE_KEYS.reduce((acc, key) => {
    const result = persistedStateSchemas[key].safeParse(record[key]);
    if (result.success) acc[key] = result.data;
    return acc;
  }, {} as Partial<Pick<State, PersistedStateKey>>);
};

export const hydrateInitialState = (
  baseState: State,
  serialized: string | null
): State => {
  if (!serialized) return baseState;

  try {
    const parsed = JSON.parse(serialized);
    const safe = sanitizePersistedState(parsed);
    return { ...baseState, ...safe };
  } catch {
    return baseState;
  }
};

function initState(baseState: State): State {
  return hydrateInitialState(baseState, localStorage.getItem(STORAGE_KEY));
}

/**
 * -----------------------------
 * PERSISTENCE (debounced)
 * -----------------------------
 */
function buildPersistedState(state: State): Partial<State> {
  return PERSISTED_STATE_KEYS.reduce((acc, key) => {
    acc[key] = state[key];
    return acc;
  }, {} as Partial<State>);
}

/**
 * -----------------------------
 * CONTEXT
 * -----------------------------
 */
const DataContext = createContext<
  { state: State; dispatch: React.Dispatch<Action> } | undefined
>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState, initState);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(buildPersistedState(state))
      );
    }, SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [state]);

  return (
    <DataContext.Provider value={{ state, dispatch }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};

/**
 * -----------------------------
 * TEST EXPORTS
 * -----------------------------
 */
export const __testing = {
  buildPersistedState,
  initState,
  initialState,
  reducer,
  SAVE_DELAY_MS,
  STORAGE_KEY,
};
