/**
 * useCanvasSession Hook
 *
 * Extracts session management logic from ChatCanvasLayout.
 * Handles session lifecycle, case selection, and workflow state initialization.
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useValueCases, useCreateValueCase } from './useValueCaseQuery';
import { WorkflowStateService, SessionInitOptions } from '../services/WorkflowStateService';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { useSubscriptionManager, useSafeAsync } from './useSubscriptionManager';
import { useBatchedState, useSmartMemo } from './useBatchedState';

export interface UseCanvasSessionOptions {
  initialCaseId?: string | null;
  onSessionReady?: (sessionId: string, workflowState: WorkflowState) => void;
  onCaseChange?: (caseId: string | null, caseData: any) => void;
}

export interface SessionData {
  sessionId: string | null;
  workflowState: WorkflowState | null;
  selectedCaseId: string | null;
  selectedCase: any;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for managing canvas sessions and case selection
 */
export function useCanvasSession(options: UseCanvasSessionOptions = {}) {
  const { initialCaseId, onSessionReady, onCaseChange } = options;

  // Value cases data
  const {
    data: cases = [],
    isLoading: isFetchingCases,
    error: casesError,
    refetch: refetchCases
  } = useValueCases();

  const createValueCase = useCreateValueCase();

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId || null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [currentTenantId, setCurrentTenantId] = useState<string | undefined>();
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>();

  // Utility hooks
  const subscriptionManager = useSubscriptionManager();
  const { safeSetState } = useSafeAsync();
  const batchedState = useBatchedState();

  // Workflow state service (memoized)
  const workflowStateService = useMemo(
    () => new WorkflowStateService(supabase),
    []
  );

  // Derived state
  const selectedCase = useSmartMemo(
    () => cases.find((c: any) => c.id === selectedCaseId),
    [cases, selectedCaseId],
    { equalityFn: (a: any, b: any) => a?.id === b?.id }
  );

  const inProgressCases = useSmartMemo(
    () => cases.filter((c: any) => c.status === 'in-progress'),
    [cases],
    { equalityFn: (a: any[], b: any[]) => a.length === b.length && a.every((c: any) => b.some((bc: any) => bc.id === c.id)) }
  );

  const completedCases = useSmartMemo(
    () => cases.filter((c: any) => c.status === 'completed'),
    [cases],
    { equalityFn: (a: any[], b: any[]) => a.length === b.length && a.every((c: any) => b.some((bc: any) => bc.id === c.id)) }
  );

  // Initialize user session
  useEffect(() => {
    const initializeUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setCurrentUserId(session.user.id);
          setCurrentTenantId(
            session.user.user_metadata?.tenant_id || session.user.id
          );
          setUserCreatedAt(session.user.created_at);
          setUserEmail(session.user.email);
        }
      } catch (error) {
        logger.error('Failed to initialize user session', error);
      }
    };

    initializeUserSession();
  }, []);

  // Handle case selection and session management
  useEffect(() => {
    if (!selectedCaseId || !currentUserId || isFetchingCases) {
      return;
    }

    const loadOrCreateSession = async () => {
      try {
        const currentCase = cases.find((c: any) => c.id === selectedCaseId);
        const currentWorkflowStateService = workflowStateService;

        const sessionOptions: SessionInitOptions = {
          caseId: selectedCaseId,
          userId: currentUserId,
          tenantId: currentTenantId || currentUserId,
          initialStage: currentCase?.stage || 'opportunity',
          context: {
            company: currentCase?.company || '',
            website: currentCase?.website || '',
          },
        };

        const result = await currentWorkflowStateService.loadOrCreateSession(sessionOptions);

        // Update state
        safeSetState(setSessionId)(result.sessionId);
        safeSetState(setWorkflowState)(result.state);

        // Subscribe to workflow state changes
        const unsubscribe = workflowStateService.subscribeToState(
          result.sessionId,
          (state) => {
            safeSetState(setWorkflowState)(state);
          }
        );

        // Add to subscription manager for cleanup
        subscriptionManager.add(unsubscribe);

        // Notify callbacks
        onSessionReady?.(result.sessionId, result.state);
        onCaseChange?.(selectedCaseId, currentCase);

        logger.info('Session initialized', {
          sessionId: result.sessionId,
          caseId: selectedCaseId,
          stage: result.state.currentStage,
        });

      } catch (error) {
        logger.error('Failed to load/create session', error);
      }
    };

    loadOrCreateSession();
  }, [
    selectedCaseId,
    currentUserId,
    currentTenantId,
    cases,
    isFetchingCases,
    workflowStateService,
    safeSetState,
    subscriptionManager,
    onSessionReady,
    onCaseChange,
  ]);

  // Case selection handlers
  const selectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
  }, []);

  const createNewCase = useCallback(async (caseData: {
    name: string;
    company: string;
    website?: string;
    stage?: string;
  }) => {
    try {
      const newCase = await createValueCase.mutateAsync({
        name: caseData.name,
        company: caseData.company,
        website: caseData.website,
        stage: (caseData.stage as any) || 'opportunity',
      });

      // Select the newly created case
      setSelectedCaseId(newCase.id);

      // Refetch cases to get the latest data
      await refetchCases();

      return newCase;
    } catch (error) {
      logger.error('Failed to create new case', error);
      throw error;
    }
  }, [createValueCase, refetchCases]);

  // Session management
  const updateWorkflowState = useCallback(async (newState: WorkflowState) => {
    if (!sessionId || !currentTenantId) {
      logger.warn('Cannot update workflow state: missing session or tenant');
      return;
    }

    try {
      await workflowStateService.saveWorkflowState(sessionId, newState, currentTenantId);
      setWorkflowState(newState);
    } catch (error) {
      logger.error('Failed to update workflow state', error);
      throw error;
    }
  }, [sessionId, currentTenantId, workflowStateService]);

  const clearSession = useCallback(() => {
    setSessionId(null);
    setWorkflowState(null);
    setSelectedCaseId(null);

    // Cleanup subscriptions
    subscriptionManager.cleanup();
  }, [subscriptionManager]);

  // Refresh session data
  const refreshSession = useCallback(async () => {
    if (!sessionId || !currentTenantId) {
      return;
    }

    try {
      const sessionData = await workflowStateService.getSession(sessionId, currentTenantId);
      if (sessionData) {
        setWorkflowState(sessionData.workflow_state);
      }
    } catch (error) {
      logger.error('Failed to refresh session', error);
    }
  }, [sessionId, currentTenantId, workflowStateService]);

  // Session validation
  const isSessionValid = useMemo(() => {
    return !!(sessionId && workflowState && selectedCaseId && currentUserId);
  }, [sessionId, workflowState, selectedCaseId, currentUserId]);

  const sessionData: SessionData = {
    sessionId,
    workflowState,
    selectedCaseId,
    selectedCase,
    isLoading: isFetchingCases || !isSessionValid,
    error: casesError,
  };

  return {
    // Data
    ...sessionData,

    // Cases
    cases,
    inProgressCases,
    completedCases,

    // Actions
    selectCase,
    createNewCase,
    updateWorkflowState,
    clearSession,
    refreshSession,
    refetchCases,

    // State
    isSessionValid,
    currentUserId,
    currentTenantId,
    userEmail,
    userCreatedAt,

    // Services
    workflowStateService,
  };
}

/**
 * Hook for managing modal state related to canvas operations
 */
export function useCanvasModals() {
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isUploadNotesModalOpen, setIsUploadNotesModalOpen] = useState(false);
  const [isEmailAnalysisModalOpen, setIsEmailAnalysisModalOpen] = useState(false);
  const [isCRMImportModalOpen, setIsCRMImportModalOpen] = useState(false);
  const [isSalesCallModalOpen, setIsSalesCallModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBetaHubOpen, setIsBetaHubOpen] = useState(false);

  const openNewCaseModal = useCallback(() => setIsNewCaseModalOpen(true), []);
  const closeNewCaseModal = useCallback(() => setIsNewCaseModalOpen(false), []);

  const openUploadNotesModal = useCallback(() => setIsUploadNotesModalOpen(true), []);
  const closeUploadNotesModal = useCallback(() => setIsUploadNotesModalOpen(false), []);

  const openEmailAnalysisModal = useCallback(() => setIsEmailAnalysisModalOpen(true), []);
  const closeEmailAnalysisModal = useCallback(() => setIsEmailAnalysisModalOpen(false), []);

  const openCRMImportModal = useCallback(() => setIsCRMImportModalOpen(true), []);
  const closeCRMImportModal = useCallback(() => setIsCRMImportModalOpen(false), []);

  const openSalesCallModal = useCallback(() => setIsSalesCallModalOpen(true), []);
  const closeSalesCallModal = useCallback(() => setIsSalesCallModalOpen(false), []);

  const openSyncModal = useCallback(() => setIsSyncModalOpen(true), []);
  const closeSyncModal = useCallback(() => setIsSyncModalOpen(false), []);

  const openExportModal = useCallback(() => setIsExportModalOpen(true), []);
  const closeExportModal = useCallback(() => setIsExportModalOpen(false), []);

  const openBetaHub = useCallback(() => setIsBetaHubOpen(true), []);
  const closeBetaHub = useCallback(() => setIsBetaHubOpen(false), []);

  const closeAllModals = useCallback(() => {
    closeNewCaseModal();
    closeUploadNotesModal();
    closeEmailAnalysisModal();
    closeCRMImportModal();
    closeSalesCallModal();
    closeSyncModal();
    closeExportModal();
    closeBetaHub();
  }, [
    closeNewCaseModal,
    closeUploadNotesModal,
    closeEmailAnalysisModal,
    closeCRMImportModal,
    closeSalesCallModal,
    closeSyncModal,
    closeExportModal,
    closeBetaHub,
  ]);

  return {
    // Modal states
    isNewCaseModalOpen,
    isUploadNotesModalOpen,
    isEmailAnalysisModalOpen,
    isCRMImportModalOpen,
    isSalesCallModalOpen,
    isSyncModalOpen,
    isExportModalOpen,
    isBetaHubOpen,

    // Modal actions
    openNewCaseModal,
    closeNewCaseModal,
    openUploadNotesModal,
    closeUploadNotesModal,
    openEmailAnalysisModal,
    closeEmailAnalysisModal,
    openCRMImportModal,
    closeCRMImportModal,
    openSalesCallModal,
    closeSalesCallModal,
    openSyncModal,
    closeSyncModal,
    openExportModal,
    closeExportModal,
    openBetaHub,
    closeBetaHub,
    closeAllModals,
  };
}
