/**
 * ChatCanvasLayout Component
 *
 * Main application layout with:
 * - Library sidebar (in-progress and completed cases)
 * - Canvas area (SDUI rendered agent outputs)
 * - Command bar (⌘K to invoke agents)
 *
 * This is the simplified UI following the chat + canvas pattern.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Building2,
  FileText,
  Globe,
  HelpCircle,
  Link2,
  Loader2,
  Mail,
  Mic,
  Plus,
  Printer,
  Search,
  Settings,
  Share2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { CommandBar } from "../Agent/CommandBar";
import { ExtractedNotes, UploadNotesModal } from "../Modals";
import { EmailAnalysisModal } from "../Modals/EmailAnalysisModal";
import { EmailAnalysis } from "../../services/EmailAnalysisService";
import { CRMImportModal } from "../Modals/CRMImportModal";
import { SalesCallModal } from "../Modals/SalesCallModal";
import { MappedValueCase } from "../../services/CRMFieldMapper";
import { CRMDeal } from "../../mcp-crm/types";
import { CallAnalysis } from "../../services/CallAnalysisService";
import { renderPage, RenderPageResult } from "../../sdui/renderPage";
import { SDUIPageDefinition } from "../../sdui/schema";
import { StreamingUpdate } from "../../services/UnifiedAgentOrchestrator";
import { agentChatService } from "../../services/AgentChatService";
import { WorkflowState } from "../../repositories/WorkflowStateRepository";
import { WorkflowStateService } from "../../services/WorkflowStateService";
import { supabase } from "@lib/supabase";
import { valueCaseService } from "../../services/ValueCaseService";
import { logger } from "@lib/logger";
import { analyticsClient } from "@lib/analyticsClient";
import { v4 as uuidv4 } from "uuid";
import { sduiTelemetry, TelemetryEventType } from "@lib/telemetry/SDUITelemetry";
import { useCanvasStore } from "../../sdui/canvas/CanvasStore";
import { SkeletonCanvas } from "../Common/SkeletonCanvas";
import { toUserFriendlyError } from "../../utils/errorHandling";
import { useToast } from "../Common/Toast";
import { crmIntegrationService } from "../../services/CRMIntegrationService";
import { PrintReportLayout } from "../Report/PrintReportLayout";
import { ExportPreviewModal } from "../Modals/ExportPreviewModal";
import { CRMSyncModal } from "../Modals/CRMSyncModal";

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * useEvent Hook - Always gets latest callback without closure issues
 * Solves the stale closure problem in setTimeout/setInterval
 */
function useEvent<T extends (...args: any[]) => any>(handler: T): T {
  const handlerRef = useRef<T>(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return useCallback(
    ((...args) => {
      const fn = handlerRef.current;
      return fn(...args);
    }) as T,
    []
  );
}

// ============================================================================
// Types
// ============================================================================

interface ValueCase {
  id: string;
  name: string;
  description?: string;
  status: "in_progress" | "completed" | "archived";
  created_at: string;
  updated_at: string;
  workflow_state?: WorkflowState;
  metadata?: Record<string, any>;
}

interface ChatCanvasLayoutProps {
  initialCaseId?: string;
  onCaseSelect?: (caseId: string) => void;
  readOnly?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export const ChatCanvasLayout: React.FC<ChatCanvasLayoutProps> = ({
  initialCaseId,
  onCaseSelect,
  readOnly = false,
}) => {
  // State management will be extracted to useCanvasLayout hook
  const [selectedCase, setSelectedCase] = useState<ValueCase | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCRMModal, setShowCRMModal] = useState(false);
  const [showSalesCallModal, setShowSalesCallModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCRMSyncModal, setShowCRMSyncModal] = useState(false);

  // Canvas state
  const [currentPage, setCurrentPage] = useState<SDUIPageDefinition | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Store integration
  const canvasStore = useCanvasStore();
  const { toast } = useToast();

  // ============================================================================
  // Utility Functions (to be extracted to utils.ts)
  // ============================================================================

  const handleCaseSelect = useCallback(
    async (caseId: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const valueCase = await valueCaseService.getValueCase(caseId);
        setSelectedCase(valueCase);

        if (valueCase.workflow_state) {
          const page = await renderPage(valueCase.workflow_state);
          setCurrentPage(page);
        }

        onCaseSelect?.(caseCaseId);
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
    async (notes: ExtractedNotes) => {
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

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (initialCaseId) {
      handleCaseSelect(initialCaseId);
    }
  }, [initialCaseId, handleCaseSelect]);

  // ============================================================================
  // Render
  // ============================================================================

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <X className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - to be extracted to LibrarySidebar component */}
      <div className="w-80 border-r border-gray-200 bg-white">
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Value Cases</h2>
            <button
              onClick={() => setShowUploadModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={readOnly}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Case List - to be extracted */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Case items will be rendered here */}
                <div className="text-sm text-gray-500">
                  No cases found. Upload notes to get started.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - to be extracted to CanvasArea component */}
      <div className="flex-1 flex flex-col">
        {/* Content Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h1 className="text-xl font-semibold">{selectedCase?.name || "Select a case"}</h1>
            {selectedCase?.description && (
              <p className="text-sm text-gray-500">{selectedCase.description}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={!selectedCase || readOnly}
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCRMSyncModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={!selectedCase || readOnly}
            >
              <Link2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={!selectedCase}
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden">
          {isRendering ? (
            <SkeletonCanvas />
          ) : currentPage ? (
            <div className="h-full w-full">
              {/* SDUI content will be rendered here */}
              <div className="p-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Canvas rendering will be implemented here
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No content selected</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select a case from the sidebar to view its content
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Command Bar - to be extracted to CommandBarWrapper */}
      <CommandBar
        onUploadNotes={() => setShowUploadModal(true)}
        onEmailAnalysis={() => setShowEmailModal(true)}
        onCRMImport={() => setShowCRMModal(true)}
        onSalesCall={() => setShowSalesCallModal(true)}
        disabled={readOnly}
      />

      {/* Modals - to be extracted to ModalManager component */}
      {showUploadModal && (
        <UploadNotesModal onClose={() => setShowUploadModal(false)} onSubmit={handleUploadNotes} />
      )}

      {showEmailModal && (
        <EmailAnalysisModal
          onClose={() => setShowEmailModal(false)}
          onSubmit={async (analysis) => {
            // Handle email analysis
            setShowEmailModal(false);
          }}
        />
      )}

      {showCRMModal && (
        <CRMImportModal
          onClose={() => setShowCRMModal(false)}
          onSubmit={async (deals) => {
            // Handle CRM import
            setShowCRMModal(false);
          }}
        />
      )}

      {showSalesCallModal && (
        <SalesCallModal
          onClose={() => setShowSalesCallModal(false)}
          onSubmit={async (analysis) => {
            // Handle sales call analysis
            setShowSalesCallModal(false);
          }}
        />
      )}

      {showExportModal && selectedCase && (
        <ExportPreviewModal caseData={selectedCase} onClose={() => setShowExportModal(false)} />
      )}

      {showCRMSyncModal && selectedCase && (
        <CRMSyncModal caseData={selectedCase} onClose={() => setShowCRMSyncModal(false)} />
      )}
    </div>
  );
};
