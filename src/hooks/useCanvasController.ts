/**
 * useCanvasController Hook
 *
 * Core controller hook for canvas operations and state management.
 * Handles workflow state, case management, and canvas interactions.
 */

import { useState, useCallback, useEffect } from "react";
import { WorkflowState } from "../repositories/WorkflowStateRepository";
import { ValueCase } from "../shared/types/structural-data";

// ============================================================================
// Types
// ============================================================================

export interface CanvasControllerState {
  selectedCase: ValueCase | null;
  workflowState: WorkflowState | null;
  isLoading: boolean;
  error: string | null;
}

export interface CanvasControllerActions {
  selectCase: (caseId: string) => Promise<void>;
  updateWorkflowState: (state: WorkflowState) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCanvasController(): CanvasControllerState & CanvasControllerActions {
  const [state, setState] = useState<CanvasControllerState>({
    selectedCase: null,
    workflowState: null,
    isLoading: false,
    error: null,
  });

  const selectCase = useCallback(async (caseId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // This would integrate with actual case service
      // For now, creating a mock case with proper structure
      const mockCase: ValueCase = {
        id: caseId,
        name: `Case ${caseId}`,
        company: 'Sample Company',
        status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tenant_id: 'default',
        organization_id: 'default',
        tags: [],
        priority: 'medium',
      };

      setState(prev => ({
        ...prev,
        selectedCase: mockCase,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to select case',
        isLoading: false,
      }));
    }
  }, []);

  const updateWorkflowState = useCallback(async (workflowState: WorkflowState) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // This would integrate with actual workflow service
      setState(prev => ({
        ...prev,
        workflowState,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update workflow state',
        isLoading: false,
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      selectedCase: null,
      workflowState: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    selectCase,
    updateWorkflowState,
    clearError,
    reset,
  };
}
