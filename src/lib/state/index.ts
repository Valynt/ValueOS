/**
 * State Management Module
 * 
 * Exports state management utilities for SDUI components
 */

export {
  SDUIStateManager,
  getSDUIStateManager,
  resetSDUIStateManager,
  type StateChangeEvent,
  type StateSubscriber,
  type PersistenceOptions,
  type SDUIStateManagerConfig
} from './SDUIStateManager';

export {
  useSDUIState,
  useOptimisticSDUIState,
  useSDUIStates,
  useSDUIStateListener,
  useSDUIStateMetadata,
  useSDUIStatePartial,
  useSDUIStateDelete,
  useSDUIStateExists,
  useSDUIStateKeys,
  useSDUIStateFlush
} from './useSDUIState';
