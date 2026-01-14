/**
 * Canvas Feature Types
 *
 * Extracted type definitions for canvas-related functionality.
 */

// ============================================================================
// Value Case Types
// ============================================================================

export interface ValueCase {
  id: string;
  name: string;
  description?: string;
  status: "in-progress" | "completed" | "paused";
  created_at: string;
  updated_at: string;
  workflow_state?: any;
  metadata?: Record<string, any>;
  company: string;
}

export interface ValueCaseCreate {
  name: string;
  description?: string;
  company: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Modal Types
// ============================================================================

export interface ExtractedNotes {
  title: string;
  summary: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface EmailAnalysis {
  subject: string;
  summary: string;
  sender: string;
  recipients: string[];
  content: string;
  metadata?: Record<string, any>;
}

export interface CRMDeal {
  id: string;
  name: string;
  description?: string;
  amount?: number;
  stage?: string;
  close_date?: string;
  metadata?: Record<string, any>;
}

export interface CallAnalysis {
  callTitle: string;
  summary: string;
  duration: number;
  participants: string[];
  transcript?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface CanvasLayoutState {
  selectedCase: ValueCase | null;
  isLoading: boolean;
  error: string | null;
  currentPage: any;
  isRendering: boolean;
}

export interface ModalStates {
  showUploadModal: boolean;
  showEmailModal: boolean;
  showCRMModal: boolean;
  showSalesCallModal: boolean;
  showExportModal: boolean;
  showCRMSyncModal: boolean;
}

export interface CanvasLayoutProps {
  initialCaseId?: string;
  onCaseSelect?: (caseId: string) => void;
  readOnly?: boolean;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface LibrarySidebarProps {
  cases: ValueCase[];
  selectedCaseId?: string;
  isLoading: boolean;
  onCaseSelect: (caseId: string) => void;
  onUploadNotes: () => void;
  readOnly?: boolean;
}

export interface CanvasAreaProps {
  selectedCase: ValueCase | null;
  currentPage: any;
  isRendering: boolean;
  isLoading: boolean;
  error: string | null;
  onExport: () => void;
  onCRMSync: () => void;
  onPrint: () => void;
  readOnly?: boolean;
}

export interface CommandBarWrapperProps {
  onUploadNotes: () => void;
  onEmailAnalysis: () => void;
  onCRMImport: () => void;
  onSalesCall: () => void;
  disabled?: boolean;
}

export interface ModalManagerProps {
  modalStates: ModalStates;
  selectedCase: ValueCase | null;
  onUploadNotes: (notes: ExtractedNotes) => void;
  onEmailAnalysis: (analysis: EmailAnalysis) => void;
  onCRMImport: (deals: CRMDeal[]) => void;
  onSalesCall: (analysis: CallAnalysis) => void;
  setModalState: (modal: keyof ModalStates, value: boolean) => void;
}

// ============================================================================
// Event Types
// ============================================================================

export interface CanvasEventTypes {
  CASE_SELECTED: "case_selected";
  CASE_CREATED: "case_created";
  CASE_UPDATED: "case_updated";
  CASE_DELETED: "case_deleted";
  MODAL_OPENED: "modal_opened";
  MODAL_CLOSED: "modal_closed";
  RENDERING_STARTED: "rendering_started";
  RENDERING_COMPLETED: "rendering_completed";
  ERROR_OCCURRED: "error_occurred";
}

export interface CanvasEvent {
  type: keyof CanvasEventTypes;
  payload: any;
  timestamp: Date;
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface CanvasLayoutActions {
  handleCaseSelect: (caseId: string) => Promise<void>;
  handleUploadNotes: (notes: ExtractedNotes) => Promise<void>;
  handleEmailAnalysis: (analysis: EmailAnalysis) => Promise<void>;
  handleCRMImport: (deals: CRMDeal[]) => Promise<void>;
  handleSalesCall: (analysis: CallAnalysis) => Promise<void>;
  setModalState: (modal: keyof ModalStates, value: boolean) => void;
  clearError: () => void;
}

export type UseCanvasLayoutReturn = CanvasLayoutState & ModalStates & CanvasLayoutActions;
