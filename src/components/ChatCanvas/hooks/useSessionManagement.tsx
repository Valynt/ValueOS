/**
 * Dedicated Session Management Hook
 *
 * Centralizes session logic, validation, and persistence
 * for ChatCanvas workflow state management.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { WorkflowStateService } from '../../../services/WorkflowStateService';
import { WorkflowState } from '../../../repositories/WorkflowStateRepository';
import { logger } from '../../../lib/logger';
import type { LifecycleStage } from '../../../types/vos';
import { CaseId } from '../../../types/enhancedTypes';

// ============================================================================
// Types
// ============================================================================

export interface SessionContext {
  userId: string;
  tenantId: string;
  sessionId: string;
}

export interface SessionInitOptions {
  caseId: CaseId;
  userId: string;
  tenantId: string;
  initialStage?: LifecycleStage;
  context?: Record<string, any>;
}

export interface SessionState {
  currentSessionId: string | null;
  sessionContext: SessionContext | null;
  workflowState: WorkflowState | null;
  isLoading: boolean;
  error: string | null;
  lastActivity: number;
}

export interface SessionManagementReturn {
  // State
  sessionState: SessionState;

  // Actions
  loadOrCreateSession: (options: SessionInitOptions) => Promise<void>;
  saveWorkflowState: (state: WorkflowState) => Promise<void>;
  updateSessionStatus: (status: 'active' | 'completed' | 'error' | 'abandoned') => Promise<void>;
  clearSession: () => void;

  // Computed Values
  hasActiveSession: boolean;
  isAuthenticated: boolean;
  sessionAge: number;

  // Utilities
  validateSession: () => boolean;
  refreshSession: () => Promise<void>;
}

// ============================================================================
// Session Management Hook
// ============================================================================

export function useSessionManagement(): SessionManagementReturn {
  // Memoize service instance
  const workflowStateService = useMemo(
    () => new WorkflowStateService(supabase),
    []
  );

  // Session state
  const [sessionState, setSessionState] = useState<SessionState>({
    currentSessionId: null,
    sessionContext: null,
    workflowState: null,
    isLoading: false,
    error: null,
    lastActivity: Date.now(),
  });

  // Computed values
  const hasActiveSession = useMemo(
    () => sessionState.currentSessionId !== null && sessionState.sessionContext !== null,
    [sessionState.currentSessionId, sessionState.sessionContext]
  );

  const isAuthenticated = useMemo(
    () => sessionState.sessionContext?.userId !== undefined,
    [sessionState.sessionContext?.userId]
  );

  const sessionAge = useMemo(
    () => Date.now() - sessionState.lastActivity,
    [sessionState.lastActivity]
  );

  // Load or create session
  const loadOrCreateSession = useCallback(async (
    options: SessionInitOptions
  ) => {
    setSessionState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      logger.info('Loading or creating session', {
        caseId: options.caseId,
        userId: options.userId
      });

      const result = await workflowStateService.loadOrCreateSession({
        caseId: options.caseId,
        userId: options.userId,
        tenantId: options.tenantId,
        initialStage: options.initialStage || 'opportunity',
        context: options.context || {},
      });

      const sessionContext: SessionContext = {
        userId: options.userId,
        tenantId: options.tenantId,
        sessionId: result.sessionId,
      };

      setSessionState({
        currentSessionId: result.sessionId,
        sessionContext,
        workflowState: result.state,
        isLoading: false,
        error: null,
        lastActivity: Date.now(),
      });

      logger.info('Session loaded/created successfully', {
        sessionId: result.sessionId,
        stage: result.state.currentStage,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load session';
      logger.error('Session load/create failed', error instanceof Error ? error : undefined);

      setSessionState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        lastActivity: Date.now(),
      }));
    }
  }, [workflowStateService]);

  // Save workflow state
  const saveWorkflowState = useCallback(async (
    state: WorkflowState
  ) => {
    if (!sessionState.currentSessionId || !sessionState.sessionContext) {
      logger.warn('Cannot save state: no active session');
      return;
    }

    try {
      await workflowStateService.saveWorkflowState(
        sessionState.currentSessionId,
        state,
        sessionState.sessionContext.tenantId
      );

      setSessionState(prev => ({
        ...prev,
        workflowState: state,
        lastActivity: Date.now(),
      }));

      logger.debug('Workflow state saved successfully', {
        sessionId: sessionState.currentSessionId,
        stage: state.currentStage,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save state';
      logger.error('Workflow state save failed', error instanceof Error ? error : undefined);

      setSessionState(prev => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [sessionState.currentSessionId, sessionState.sessionContext, workflowStateService]);

  // Update session status
  const updateSessionStatus = useCallback(async (
    status: 'active' | 'completed' | 'error' | 'abandoned'
  ) => {
    if (!sessionState.currentSessionId || !sessionState.sessionContext) {
      logger.warn('Cannot update session status: no active session');
      return;
    }

    try {
      await workflowStateService.updateSessionStatus(
        sessionState.currentSessionId,
        status,
        sessionState.sessionContext.tenantId
      );

      logger.info('Session status updated', {
        sessionId: sessionState.currentSessionId,
        status,
      });

    } catch (error) {
      logger.error('Session status update failed', error instanceof Error ? error : undefined);
    }
  }, [sessionState.currentSessionId, sessionState.sessionContext, workflowStateService]);

  // Clear session
  const clearSession = useCallback(() => {
    setSessionState({
      currentSessionId: null,
      sessionContext: null,
      workflowState: null,
      isLoading: false,
      error: null,
      lastActivity: Date.now(),
    });
  }, []);

  // Validate session
  const validateSession = useCallback((): boolean => {
    if (!sessionState.currentSessionId || !sessionState.sessionContext) {
      return false;
    }

    // Check session age (30 minutes)
    const maxSessionAge = 30 * 60 * 1000; // 30 minutes in ms
    if (sessionAge > maxSessionAge) {
      logger.warn('Session expired due to age', {
        sessionId: sessionState.currentSessionId,
        age: sessionAge,
      });
      return false;
    }

    return true;
  }, [sessionState.currentSessionId, sessionState.sessionContext, sessionAge]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    if (!sessionState.sessionContext || !sessionState.currentSessionId) {
      logger.warn('Cannot refresh session: no active session');
      return;
    }

    try {
      const refreshedState = await workflowStateService.getWorkflowState(
        sessionState.currentSessionId,
        sessionState.sessionContext.tenantId
      );

      if (refreshedState) {
        setSessionState(prev => ({
          ...prev,
          workflowState: refreshedState,
          lastActivity: Date.now(),
          error: null,
        }));

        logger.info('Session refreshed successfully', {
          sessionId: sessionState.currentSessionId,
        });
      }
    } catch (error) {
      logger.error('Session refresh failed', error instanceof Error ? error : undefined);
    }
  }, [sessionState.currentSessionId, sessionState.sessionContext, workflowStateService]);

  // Auto-refresh on activity
  useEffect(() => {
    if (!hasActiveSession) return;

    const refreshInterval = setInterval(() => {
      if (validateSession()) {
        // Update last activity timestamp
        setSessionState(prev => ({
          ...prev,
          lastActivity: Date.now(),
        }));
      } else {
        // Session expired, clear it
        clearSession();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [hasActiveSession, validateSession, clearSession]);

  return {
    sessionState,
    loadOrCreateSession,
    saveWorkflowState,
    updateSessionStatus,
    clearSession,
    hasActiveSession,
    isAuthenticated,
    sessionAge,
    validateSession,
    refreshSession,
  };
}

// ============================================================================
// Session Utilities
// ============================================================================

export function createSessionContext(): SessionContext | null {
  try {
    const { data: sessionData } = supabase.auth.getSession();
    const session = sessionData?.session;

    if (!session?.user) {
      return null;
    }

    return {
      userId: session.user.id,
      tenantId: session.user.user_metadata?.tenant_id || session.user.id,
      sessionId: session.access_token?.slice(0, 36) || crypto.randomUUID(),
    };
  } catch (error) {
    logger.error('Failed to create session context', error instanceof Error ? error : undefined);
    return null;
  }
}

export function isValidSessionContext(context: any): context is SessionContext {
  return (
    context &&
    typeof context === 'object' &&
    typeof context.userId === 'string' &&
    typeof context.tenantId === 'string' &&
    typeof context.sessionId === 'string' &&
    context.userId.length > 0 &&
    context.tenantId.length > 0 &&
    context.sessionId.length > 0
  );
}

// ============================================================================
// Session Provider (for context-based usage)
// ============================================================================

import { createContext, useContext, ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
}

const SessionManagementContext = createContext<SessionManagementReturn | null>(null);

export function SessionProvider({ children }: SessionProviderProps) {
  const sessionManagement = useSessionManagement();

  return (
    <SessionManagementContext.Provider value={sessionManagement}>
      {children}
    </SessionManagementContext.Provider>
  );
}

export function useSessionContext(): SessionManagementReturn {
  const context = useContext(SessionManagementContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}
