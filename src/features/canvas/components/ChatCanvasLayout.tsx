/**
 * ChatCanvasLayout Component
 *
 * Simplified layout component using headless hooks for:
 * - Canvas state coordination (useCanvasController)
 * - Command/input handling (useInteractionRouter)
 * - Async agent response control (useStreamingOrchestrator)
 * - Modal state management (useModalManager)
 */

import React, { useEffect } from "react";
import { FileText, Plus, Share2, Link2, Printer } from "lucide-react";
import { CommandBar } from "../Agent/CommandBar";
import { ExtractedNotes, UploadNotesModal } from "../Modals";
import { EmailAnalysisModal } from "../Modals/EmailAnalysisModal";
import { EmailAnalysis } from "../../services/EmailAnalysisService";
import { CRMImportModal } from "../Modals/CRMImportModal";
import { CRMDeal } from "../../mcp-crm/types";
import { SalesCallModal } from "../Modals/SalesCallModal";
import { CallAnalysis } from "../../services/CallAnalysisService";
import { SkeletonCanvas } from "../Common/SkeletonCanvas";
import { ExportPreviewModal } from "../Modals/ExportPreviewModal";
import { CRMSyncModal } from "../Modals/CRMSyncModal";

// Import the headless hooks
import { useCanvasController } from "../hooks/useCanvasController";
import { useInteractionRouter } from "../hooks/useInteractionRouter";
import { useStreamingOrchestrator } from "../hooks/useStreamingOrchestrator";
import { useModalManager } from "../hooks/useModalManager";

interface ChatCanvasLayoutProps {
  initialCaseId?: string;
  onCaseSelect?: (caseId: string) => void;
  readOnly?: boolean;
}

export const ChatCanvasLayout: React.FC<ChatCanvasLayoutProps> = ({
  initialCaseId,
  onCaseSelect,
  readOnly = false,
}) => {
  // ============================================================================
  // Hook Integration
  // ============================================================================

  // Canvas state coordination
  const {
    selectedCase,
    isLoading,
    error,
    currentPage,
    isRendering,
    selectCase,
    setError,
  } = useCanvasController({ onCaseSelect, readOnly });

  // Command and input handling
  const {
    handleUploadNotes,
    handleEmailAnalysis,
    handleCRMImport,
    handleSalesCallAnalysis,
    handleExport,
    handleCRMSync,
  } = useInteractionRouter({ onCaseSelect, readOnly });

  // Streaming orchestrator (for future SDUI streaming)
  const {
    isStreaming,
    startStreaming,
    updateStreaming,
    completeStreaming,
    cancelStreaming,
  } = useStreamingOrchestrator({
    onComplete: (page) => {
      // Handle streaming completion
      console.log("Streaming complete", page);
    },
    onError: (error) => {
      console.error("Streaming error", error);
      setError(error.message);
    },
  });

  // Modal state management
  const {
    showUploadModal,
    showEmailModal,
    showCRMModal,
    showSalesCallModal,
    showExportModal,
    showCRMSyncModal,
    openModal,
    closeModal,
  } = useModalManager();

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (initialCaseId) {
      selectCase(initialCaseId);
    }
  }, [initialCaseId, selectCase]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleModalSubmit = {
    upload: async (notes: ExtractedNotes) => {
      await handleUploadNotes(notes);
      closeModal("upload");
    },
    email: async (analysis: EmailAnalysis) => {
      await handleEmailAnalysis(analysis);
      closeModal("emailAnalysis");
    },
    crm: async (deals: CRMDeal[]) => {
      await handleCRMImport(deals);
      closeModal("crmImport");
    },
    salesCall: async (analysis: CallAnalysis) => {
      await handleSalesCallAnalysis(analysis);
      closeModal("salesCall");
    },
    export: async () => {
      if (selectedCase) {
        await handleExport(selectedCase.id);
        closeModal("export");
      }
    },
    crmSync: async () => {
      if (selectedCase) {
        await handleCRMSync(selectedCase.id);
        closeModal("crmSync");
      }
    },
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-white">
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Value Cases</h2>
            <button
              onClick={() => openModal("upload")}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={readOnly}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Case List */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-16 bg-gray-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-gray-500">
                  No cases found. Upload notes to get started.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Content Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h1 className="text-xl font-semibold">
              {selectedCase?.name || "Select a case"}
            </h1>
            {selectedCase?.description && (
              <p className="text-sm text-gray-500">
                {selectedCase.description}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => openModal("export")}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={!selectedCase || readOnly}
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => openModal("crmSync")}
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
          {isRendering || isStreaming ? (
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No content selected
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select a case from the sidebar to view its content
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Command Bar */}
      <CommandBar
        onUploadNotes={() => openModal("upload")}
        onEmailAnalysis={() => openModal("emailAnalysis")}
        onCRMImport={() => openModal("crmImport")}
        onSalesCall={() => openModal("salesCall")}
        disabled={readOnly}
      />

      {/* Modals */}
      {showUploadModal && (
        <UploadNotesModal
          onClose={() => closeModal("upload")}
          onSubmit={handleModalSubmit.upload}
        />
      )}

      {showEmailModal && (
        <EmailAnalysisModal
          onClose={() => closeModal("emailAnalysis")}
          onSubmit={handleModalSubmit.email}
        />
      )}

      {showCRMModal && (
        <CRMImportModal
          onClose={() => closeModal("crmImport")}
          onSubmit={handleModalSubmit.crm}
        />
      )}

      {showSalesCallModal && (
        <SalesCallModal
          onClose={() => closeModal("salesCall")}
          onSubmit={handleModalSubmit.salesCall}
        />
      )}

      {showExportModal && selectedCase && (
        <ExportPreviewModal
          caseData={selectedCase}
          onClose={() => closeModal("export")}
        />
      )}

      {showCRMSyncModal && selectedCase && (
        <CRMSyncModal
          caseData={selectedCase}
          onClose={() => closeModal("crmSync")}
        />
      )}
    </div>
  );
};
