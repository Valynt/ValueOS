/**
 * Consolidated State Management for ChatCanvasLayout
 *
 * Replaces multiple useState hooks with a single useReducer
 * for better state organization and predictable updates.
 */

import { RenderPageResult } from '@sdui/renderPage';
import { StreamingUpdate } from '../../services/UnifiedAgentOrchestrator';
import { WorkflowState } from '../../repositories/WorkflowStateRepository';
import { ValueCase } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface CanvasState {
  // Case Selection
  selectedCaseId: string | null;

  // Command & Interaction
  isCommandBarOpen: boolean;

  // Canvas State
  renderedPage: RenderPageResult | null;
  isLoading: boolean;
  isInitialCanvasLoad: boolean;
  streamingUpdate: StreamingUpdate | null;

  // Workflow & Session
  workflowState: WorkflowState | null;
  currentSessionId: string | null;

  // Modal States
  modals: {
    isNewCaseModalOpen: boolean;
    isUploadNotesModalOpen: boolean;
    isEmailAnalysisModalOpen: boolean;
    isCRMImportModalOpen: boolean;
    isSalesCallModalOpen: boolean;
    isSyncModalOpen: boolean;
    isExportModalOpen: boolean;
    isBetaHubOpen: boolean;
  };

  // Form States
  forms: {
    newCaseCompany: string;
    newCaseWebsite: string;
    pendingUploadFile: File | null;
  };

  // User Context
  user: {
    currentUserId: string | undefined;
    currentTenantId: string | undefined;
    userCreatedAt: string | null;
    userEmail: string | undefined;
  };

  // Processing State
  hasProcessedInitialAction: boolean;
  renderStartTime: number | null;
}

export type CanvasAction =
  // Case Selection
  | { type: 'SELECT_CASE'; payload: string | null }

  // Command & Interaction
  | { type: 'TOGGLE_COMMAND_BAR'; payload?: boolean }

  // Canvas State
  | { type: 'SET_RENDERED_PAGE'; payload: RenderPageResult | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_INITIAL_CANVAS_LOAD'; payload: boolean }
  | { type: 'SET_STREAMING_UPDATE'; payload: StreamingUpdate | null }

  // Workflow & Session
  | { type: 'SET_WORKFLOW_STATE'; payload: WorkflowState | null }
  | { type: 'SET_SESSION_ID'; payload: string | null }

  // Modal Management
  | { type: 'OPEN_MODAL'; payload: keyof CanvasState['modals'] }
  | { type: 'CLOSE_MODAL'; payload: keyof CanvasState['modals'] }
  | { type: 'CLOSE_ALL_MODALS' }

  // Form Management
  | { type: 'SET_NEW_CASE_COMPANY'; payload: string }
  | { type: 'SET_NEW_CASE_WEBSITE'; payload: string }
  | { type: 'SET_PENDING_UPLOAD_FILE'; payload: File | null }
  | { type: 'RESET_FORMS' }

  // User Context
  | { type: 'SET_USER_CONTEXT'; payload: Partial<CanvasState['user']> }

  // Processing State
  | { type: 'SET_PROCESSED_INITIAL_ACTION'; payload: boolean }
  | { type: 'SET_RENDER_START_TIME'; payload: number | null }

  // Bulk Updates
  | { type: 'BULK_UPDATE'; payload: Partial<CanvasState> }
  | { type: 'RESET_STATE' };

// ============================================================================
// Initial State
// ============================================================================

export const initialCanvasState: CanvasState = {
  selectedCaseId: null,
  isCommandBarOpen: false,
  renderedPage: null,
  isLoading: false,
  isInitialCanvasLoad: false,
  streamingUpdate: null,
  workflowState: null,
  currentSessionId: null,
  modals: {
    isNewCaseModalOpen: false,
    isUploadNotesModalOpen: false,
    isEmailAnalysisModalOpen: false,
    isCRMImportModalOpen: false,
    isSalesCallModalOpen: false,
    isSyncModalOpen: false,
    isExportModalOpen: false,
    isBetaHubOpen: false,
  },
  forms: {
    newCaseCompany: '',
    newCaseWebsite: '',
    pendingUploadFile: null,
  },
  user: {
    currentUserId: undefined,
    currentTenantId: undefined,
    userCreatedAt: null,
    userEmail: undefined,
  },
  hasProcessedInitialAction: false,
  renderStartTime: null,
};

// ============================================================================
// Reducer
// ============================================================================

export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    // Case Selection
    case 'SELECT_CASE':
      return {
        ...state,
        selectedCaseId: action.payload,
      };

    // Command & Interaction
    case 'TOGGLE_COMMAND_BAR':
      return {
        ...state,
        isCommandBarOpen: action.payload !== undefined ? action.payload : !state.isCommandBarOpen,
      };

    // Canvas State
    case 'SET_RENDERED_PAGE':
      return {
        ...state,
        renderedPage: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_INITIAL_CANVAS_LOAD':
      return {
        ...state,
        isInitialCanvasLoad: action.payload,
      };

    case 'SET_STREAMING_UPDATE':
      return {
        ...state,
        streamingUpdate: action.payload,
      };

    // Workflow & Session
    case 'SET_WORKFLOW_STATE':
      return {
        ...state,
        workflowState: action.payload,
      };

    case 'SET_SESSION_ID':
      return {
        ...state,
        currentSessionId: action.payload,
      };

    // Modal Management
    case 'OPEN_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: true,
        },
      };

    case 'CLOSE_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: false,
        },
      };

    case 'CLOSE_ALL_MODALS':
      return {
        ...state,
        modals: Object.keys(state.modals).reduce((acc, key) => ({
          ...acc,
          [key]: false,
        }), {} as CanvasState['modals']),
      };

    // Form Management
    case 'SET_NEW_CASE_COMPANY':
      return {
        ...state,
        forms: {
          ...state.forms,
          newCaseCompany: action.payload,
        },
      };

    case 'SET_NEW_CASE_WEBSITE':
      return {
        ...state,
        forms: {
          ...state.forms,
          newCaseWebsite: action.payload,
        },
      };

    case 'SET_PENDING_UPLOAD_FILE':
      return {
        ...state,
        forms: {
          ...state.forms,
          pendingUploadFile: action.payload,
        },
      };

    case 'RESET_FORMS':
      return {
        ...state,
        forms: initialCanvasState.forms,
      };

    // User Context
    case 'SET_USER_CONTEXT':
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload,
        },
      };

    // Processing State
    case 'SET_PROCESSED_INITIAL_ACTION':
      return {
        ...state,
        hasProcessedInitialAction: action.payload,
      };

    case 'SET_RENDER_START_TIME':
      return {
        ...state,
        renderStartTime: action.payload,
      };

    // Bulk Updates
    case 'BULK_UPDATE':
      return {
        ...state,
        ...action.payload,
      };

    case 'RESET_STATE':
      return initialCanvasState;

    default:
      // TypeScript exhaustiveness check
      const _exhaustiveCheck: never = action;
      return state;
  }
}

// ============================================================================
// Action Creators
// ============================================================================

export const canvasActions = {
  // Case Selection
  selectCase: (caseId: string | null): CanvasAction => ({
    type: 'SELECT_CASE',
    payload: caseId,
  }),

  // Command & Interaction
  toggleCommandBar: (isOpen?: boolean): CanvasAction => ({
    type: 'TOGGLE_COMMAND_BAR',
    payload: isOpen,
  }),

  // Canvas State
  setRenderedPage: (page: RenderPageResult | null): CanvasAction => ({
    type: 'SET_RENDERED_PAGE',
    payload: page,
  }),

  setLoading: (isLoading: boolean): CanvasAction => ({
    type: 'SET_LOADING',
    payload: isLoading,
  }),

  setInitialCanvasLoad: (isInitial: boolean): CanvasAction => ({
    type: 'SET_INITIAL_CANVAS_LOAD',
    payload: isInitial,
  }),

  setStreamingUpdate: (update: StreamingUpdate | null): CanvasAction => ({
    type: 'SET_STREAMING_UPDATE',
    payload: update,
  }),

  // Workflow & Session
  setWorkflowState: (state: WorkflowState | null): CanvasAction => ({
    type: 'SET_WORKFLOW_STATE',
    payload: state,
  }),

  setSessionId: (sessionId: string | null): CanvasAction => ({
    type: 'SET_SESSION_ID',
    payload: sessionId,
  }),

  // Modal Management
  openModal: (modal: keyof CanvasState['modals']): CanvasAction => ({
    type: 'OPEN_MODAL',
    payload: modal,
  }),

  closeModal: (modal: keyof CanvasState['modals']): CanvasAction => ({
    type: 'CLOSE_MODAL',
    payload: modal,
  }),

  closeAllModals: (): CanvasAction => ({
    type: 'CLOSE_ALL_MODALS',
  }),

  // Form Management
  setNewCaseCompany: (company: string): CanvasAction => ({
    type: 'SET_NEW_CASE_COMPANY',
    payload: company,
  }),

  setNewCaseWebsite: (website: string): CanvasAction => ({
    type: 'SET_NEW_CASE_WEBSITE',
    payload: website,
  }),

  setPendingUploadFile: (file: File | null): CanvasAction => ({
    type: 'SET_PENDING_UPLOAD_FILE',
    payload: file,
  }),

  resetForms: (): CanvasAction => ({
    type: 'RESET_FORMS',
  }),

  // User Context
  setUserContext: (context: Partial<CanvasState['user']>): CanvasAction => ({
    type: 'SET_USER_CONTEXT',
    payload: context,
  }),

  // Processing State
  setProcessedInitialAction: (processed: boolean): CanvasAction => ({
    type: 'SET_PROCESSED_INITIAL_ACTION',
    payload: processed,
  }),

  setRenderStartTime: (time: number | null): CanvasAction => ({
    type: 'SET_RENDER_START_TIME',
    payload: time,
  }),

  // Bulk Updates
  bulkUpdate: (updates: Partial<CanvasState>): CanvasAction => ({
    type: 'BULK_UPDATE',
    payload: updates,
  }),

  resetState: (): CanvasAction => ({
    type: 'RESET_STATE',
  }),
};

// ============================================================================
// Selectors
// ============================================================================

export const canvasSelectors = {
  // Case Selection
  selectedCaseId: (state: CanvasState) => state.selectedCaseId,
  hasSelectedCase: (state: CanvasState) => state.selectedCaseId !== null,

  // Canvas State
  renderedPage: (state: CanvasState) => state.renderedPage,
  isLoading: (state: CanvasState) => state.isLoading,
  isInitialCanvasLoad: (state: CanvasState) => state.isInitialCanvasLoad,
  streamingUpdate: (state: CanvasState) => state.streamingUpdate,
  hasContent: (state: CanvasState) => state.renderedPage?.element !== null,

  // Workflow & Session
  workflowState: (state: CanvasState) => state.workflowState,
  currentSessionId: (state: CanvasState) => state.currentSessionId,
  hasActiveSession: (state: CanvasState) => state.currentSessionId !== null,

  // Modal States
  isModalOpen: (state: CanvasState, modal: keyof CanvasState['modals']) => state.modals[modal],
  anyModalOpen: (state: CanvasState) => Object.values(state.modals).some(Boolean),

  // Form States
  newCaseCompany: (state: CanvasState) => state.forms.newCaseCompany,
  newCaseWebsite: (state: CanvasState) => state.forms.newCaseWebsite,
  pendingUploadFile: (state: CanvasState) => state.forms.pendingUploadFile,

  // User Context
  userContext: (state: CanvasState) => state.user,
  isAuthenticated: (state: CanvasState) => state.user.currentUserId !== undefined,

  // Processing State
  hasProcessedInitialAction: (state: CanvasState) => state.hasProcessedInitialAction,
  renderStartTime: (state: CanvasState) => state.renderStartTime,

  // Computed Selectors
  canSubmitCommand: (state: CanvasState) =>
    state.selectedCaseId !== null &&
    !state.isLoading &&
    state.workflowState !== null,

  isStreaming: (state: CanvasState) =>
    state.isLoading || state.streamingUpdate !== null,

  currentStage: (state: CanvasState) =>
    state.workflowState?.currentStage,
};
