/**
 * useCanvasLayout Hook
 *
 * Extracted business logic and state management for ChatCanvasLayout component.
 * Handles case management, modal states, and canvas operations.
 */

import { useState, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { WorkflowState } from "../../../repositories/WorkflowStateRepository";
import { valueCaseService } from "../../../services/ValueCaseService";
import { agentChatService } from "../../../services/AgentChatService";
import { renderPage } from "../../../sdui/renderPage";
import { SDUIPageDefinition } from "../../../sdui/schema";
import { useCanvasStore } from "../../../sdui/canvas/CanvasStore";
import { toUserFriendlyError } from "../../../utils/errorHandling";
import { useToast } from "../../../components/Common/Toast";

// ============================================================================
// Types
// ============================================================================

export interface ValueCase {
  id: string;
  name: string;
  description?: string;
  status: "in_progress" | "completed" | "archived";
  created_at: string;
  updated_at: string;
  workflow_state?: WorkflowState;
  metadata?: Record<string, any>;
}

export interface CanvasLayoutState {
  selectedCase: ValueCase | null;
  isLoading: boolean;
  error: string | null;
  currentPage: SDUIPageDefinition | null;
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

export interface CanvasLayoutActions {
  handleCaseSelect: (caseId: string) => Promise<void>;
  handleUploadNotes: (notes: any) => Promise<void>;
  handleEmailAnalysis: (analysis: any) => Promise<void>;
  handleCRMImport: (deals: any[]) => Promise<void>;
  handleSalesCall: (analysis: any) => Promise<void>;
  setModalState: (modal: keyof ModalStates, value: boolean) => void;
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export const useCanvasLayout = (
  initialCaseId?: string,
  onCaseSelect?: (caseId: string) => void
): CanvasLayoutState & ModalStates & CanvasLayoutActions => {
  // Core state
  const [selectedCase, setSelectedCase] = useState<ValueCase | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<SDUIPageDefinition | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCRMModal, setShowCRMModal] = useState(false);
  const [showSalesCallModal, setShowSalesCallModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCRMSyncModal, setShowCRMSyncModal] = useState(false);

  // Store integrations
  const canvasStore = useCanvasStore();
  const { toast } = useToast();

  // ============================================================================
  // Actions
  // ============================================================================

  const handleCaseSelect = useCallback(
    async (caseId: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const valueCase = await valueCaseService.getValueCase(caseId);
        setSelectedCase(valueCase);

        if (valueCase.workflow_state) {
          setIsRendering(true);
          try {
            const page = await renderPage(valueCase.workflow_state);
            setCurrentPage(page);
          } finally {
            setIsRendering(false);
          }
        }

        onCaseSelect?.(caseId);
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        setError(friendlyError);
        toast({
          title: "Error loading case",
          description: friendlyError,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onCaseSelect, toast]
  );

  const handleUploadNotes = useCallback(
    async (notes: any) => {
      try {
        setIsLoading(true);

        const newCase = await valueCaseService.createValueCase({
          name: notes.title,
          description: notes.summary,
          metadata: { source: "upload", notes },
        });

        await handleCaseSelect(newCase.id);
        setShowUploadModal(false);

        toast({
          title: "Notes uploaded successfully",
          description: "New case created from your notes.",
        });
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        toast({
          title: "Upload failed",
          description: friendlyError,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [handleCaseSelect, toast]
  );

  const handleEmailAnalysis = useCallback(
    async (analysis: any) => {
      try {
        setIsLoading(true);

        // Create case from email analysis
        const newCase = await valueCaseService.createValueCase({
          name: analysis.subject || "Email Analysis",
          description: analysis.summary,
          metadata: { source: "email", analysis },
        });

        await handleCaseSelect(newCase.id);
        setShowEmailModal(false);

        toast({
          title: "Email analyzed successfully",
          description: "New case created from email analysis.",
        });
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        toast({
          title: "Email analysis failed",
          description: friendlyError,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [handleCaseSelect, toast]
  );

  const handleCRMImport = useCallback(
    async (deals: any[]) => {
      try {
        setIsLoading(true);

        // Process each deal
        for (const deal of deals) {
          await valueCaseService.createValueCase({
            name: deal.name || "CRM Deal",
            description: deal.description,
            metadata: { source: "crm", deal },
          });
        }

        setShowCRMModal(false);

        toast({
          title: "CRM import successful",
          description: `Imported ${deals.length} deals.`,
        });
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        toast({
          title: "CRM import failed",
          description: friendlyError,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const handleSalesCall = useCallback(
    async (analysis: any) => {
      try {
        setIsLoading(true);

        const newCase = await valueCaseService.createValueCase({
          name: analysis.callTitle || "Sales Call Analysis",
          description: analysis.summary,
          metadata: { source: "sales_call", analysis },
        });

        await handleCaseSelect(newCase.id);
        setShowSalesCallModal(false);

        toast({
          title: "Sales call analyzed successfully",
          description: "New case created from sales call analysis.",
        });
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        toast({
          title: "Sales call analysis failed",
          description: friendlyError,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [handleCaseSelect, toast]
  );

  const setModalState = useCallback((modal: keyof ModalStates, value: boolean) => {
    switch (modal) {
      case "showUploadModal":
        setShowUploadModal(value);
        break;
      case "showEmailModal":
        setShowEmailModal(value);
        break;
      case "showCRMModal":
        setShowCRMModal(value);
        break;
      case "showSalesCallModal":
        setShowSalesCallModal(value);
        break;
      case "showExportModal":
        setShowExportModal(value);
        break;
      case "showCRMSyncModal":
        setShowCRMSyncModal(value);
        break;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (initialCaseId) {
      handleCaseSelect(initialCaseId);
    }
  }, [initialCaseId, handleCaseSelect]);

  // ============================================================================
  // Return State and Actions
  // ============================================================================

  return {
    // State
    selectedCase,
    isLoading,
    error,
    currentPage,
    isRendering,

    // Modal states
    showUploadModal,
    showEmailModal,
    showCRMModal,
    showSalesCallModal,
    showExportModal,
    showCRMSyncModal,

    // Actions
    handleCaseSelect,
    handleUploadNotes,
    handleEmailAnalysis,
    handleCRMImport,
    handleSalesCall,
    setModalState,
    clearError,
  };
};
