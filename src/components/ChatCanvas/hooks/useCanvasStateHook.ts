/**
 * Custom hook for Canvas State Management
 *
 * Provides a clean interface for the consolidated state management
 * with additional utilities and side effects.
 */

import { useReducer, useCallback, useMemo } from 'react';
import { canvasReducer, initialCanvasState, canvasActions, canvasSelectors, CanvasState, CanvasAction } from './useCanvasState';

export interface UseCanvasStateReturn {
  // State
  state: CanvasState;

  // Actions
  actions: typeof canvasActions;

  // Selectors (memoized)
  selectors: typeof canvasSelectors;

  // Utilities
  dispatch: React.Dispatch<CanvasAction>;

  // Common derived values
  hasSelectedCase: boolean;
  canSubmitCommand: boolean;
  isStreaming: boolean;
  anyModalOpen: boolean;
  isAuthenticated: boolean;
  currentStage: string | undefined;
}

/**
 * Hook for managing canvas state with consolidated reducer
 */
export function useCanvasState(): UseCanvasStateReturn {
  const [state, dispatch] = useReducer(canvasReducer, initialCanvasState);

  // Memoized derived values for performance
  const hasSelectedCase = useMemo(() =>
    canvasSelectors.hasSelectedCase(state), [state]
  );

  const canSubmitCommand = useMemo(() =>
    canvasSelectors.canSubmitCommand(state), [state]
  );

  const isStreaming = useMemo(() =>
    canvasSelectors.isStreaming(state), [state]
  );

  const anyModalOpen = useMemo(() =>
    canvasSelectors.anyModalOpen(state), [state]
  );

  const isAuthenticated = useMemo(() =>
    canvasSelectors.isAuthenticated(state), [state]
  );

  const currentStage = useMemo(() =>
    canvasSelectors.currentStage(state), [state]
  );

  // Action creators bound to dispatch
  const actions = useMemo(() => ({
    selectCase: (caseId: string | null) => dispatch(canvasActions.selectCase(caseId)),
    toggleCommandBar: (isOpen?: boolean) => dispatch(canvasActions.toggleCommandBar(isOpen)),
    setRenderedPage: (page: any) => dispatch(canvasActions.setRenderedPage(page)),
    setLoading: (isLoading: boolean) => dispatch(canvasActions.setLoading(isLoading)),
    setInitialCanvasLoad: (isInitial: boolean) => dispatch(canvasActions.setInitialCanvasLoad(isInitial)),
    setStreamingUpdate: (update: any) => dispatch(canvasActions.setStreamingUpdate(update)),
    setWorkflowState: (workflowState: any) => dispatch(canvasActions.setWorkflowState(workflowState)),
    setSessionId: (sessionId: string | null) => dispatch(canvasActions.setSessionId(sessionId)),
    openModal: (modal: keyof CanvasState['modals']) => dispatch(canvasActions.openModal(modal)),
    closeModal: (modal: keyof CanvasState['modals']) => dispatch(canvasActions.closeModal(modal)),
    closeAllModals: () => dispatch(canvasActions.closeAllModals()),
    setNewCaseCompany: (company: string) => dispatch(canvasActions.setNewCaseCompany(company)),
    setNewCaseWebsite: (website: string) => dispatch(canvasActions.setNewCaseWebsite(website)),
    setPendingUploadFile: (file: File | null) => dispatch(canvasActions.setPendingUploadFile(file)),
    resetForms: () => dispatch(canvasActions.resetForms()),
    setUserContext: (context: any) => dispatch(canvasActions.setUserContext(context)),
    setProcessedInitialAction: (processed: boolean) => dispatch(canvasActions.setProcessedInitialAction(processed)),
    setRenderStartTime: (time: number | null) => dispatch(canvasActions.setRenderStartTime(time)),
    bulkUpdate: (updates: any) => dispatch(canvasActions.bulkUpdate(updates)),
    resetState: () => dispatch(canvasActions.resetState()),
  }), []);

  // Convenience methods for common operations
  const utilities = useMemo(() => ({
    // Modal management
    openNewCaseModal: () => dispatch(canvasActions.openModal('isNewCaseModalOpen')),
    closeNewCaseModal: () => dispatch(canvasActions.closeModal('isNewCaseModalOpen')),

    // Loading states
    startLoading: () => dispatch(canvasActions.setLoading(true)),
    stopLoading: () => dispatch(canvasActions.setLoading(false)),

    // Streaming states
    startStreaming: (message: string, stage?: string) =>
      dispatch(canvasActions.setStreamingUpdate({ stage: stage || 'processing', message })),
    stopStreaming: () => dispatch(canvasActions.setStreamingUpdate(null)),

    // Case selection with cleanup
    selectCaseAndReset: (caseId: string | null) => {
      dispatch(canvasActions.selectCase(caseId));
      dispatch(canvasActions.setRenderedPage(null));
      dispatch(canvasActions.closeAllModals());
    },

    // Session management
    setSessionAndUser: (sessionId: string, userId: string, tenantId: string) => {
      dispatch(canvasActions.setSessionId(sessionId));
      dispatch(canvasActions.setUserContext({ currentUserId: userId, currentTenantId: tenantId }));
    },
  }), []);

  return {
    state,
    actions: actions as typeof canvasActions,
    selectors: canvasSelectors,
    dispatch,
    hasSelectedCase,
    canSubmitCommand,
    isStreaming,
    anyModalOpen,
    isAuthenticated,
    currentStage,
    ...utilities,
  };
}

/**
 * Hook for accessing specific canvas state slices
 * Useful for components that only need specific parts of the state
 */
export function useCanvasSelector<T>(
  selector: (state: CanvasState) => T
): T {
  const { state } = useCanvasState();
  return selector(state);
}

/**
 * Hook for case selection logic
 */
export function useCaseSelection() {
  const { state, actions, hasSelectedCase } = useCanvasState();

  const selectCase = useCallback((caseId: string | null) => {
    actions.selectCaseAndReset(caseId);
  }, [actions]);

  return {
    selectedCaseId: state.selectedCaseId,
    hasSelectedCase,
    selectCase,
  };
}

/**
 * Hook for modal management
 */
export function useModalManagement() {
  const { state, actions, anyModalOpen } = useCanvasState();

  const openModal = useCallback((modal: keyof CanvasState['modals']) => {
    actions.openModal(modal);
  }, [actions]);

  const closeModal = useCallback((modal: keyof CanvasState['modals']) => {
    actions.closeModal(modal);
  }, [actions]);

  const closeAllModals = useCallback(() => {
    actions.closeAllModals();
  }, [actions]);

  return {
    modals: state.modals,
    anyModalOpen,
    openModal,
    closeModal,
    closeAllModals,
  };
}

/**
 * Hook for streaming state management
 */
export function useStreamingState() {
  const { state, actions, isStreaming } = useCanvasState();

  const startStreaming = useCallback((message: string, stage?: string) => {
    actions.startStreaming(message, stage);
  }, [actions]);

  const stopStreaming = useCallback(() => {
    actions.stopStreaming();
  }, [actions]);

  const updateStreamingMessage = useCallback((message: string, stage?: string) => {
    actions.setStreamingUpdate({ stage: stage || 'processing', message });
  }, [actions]);

  return {
    streamingUpdate: state.streamingUpdate,
    isStreaming,
    startStreaming,
    stopStreaming,
    updateStreamingMessage,
  };
}
