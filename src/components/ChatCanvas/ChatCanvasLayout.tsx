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

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  memo,
  ReactNode,
  FC,
} from "react";
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
import { CRMDeal } from '@mcp/crm/types";
import { CallAnalysis } from "../../services/CallAnalysisService";
import { renderPage, RenderPageResult } from '@sdui/renderPage";
import { SDUIPageDefinition } from '@sdui/schema";
import { StreamingUpdate } from "../../services/UnifiedAgentOrchestrator";
import { agentChatService } from "../../services/AgentChatService";
import { WorkflowState } from "../../repositories/WorkflowStateRepository";
import { WorkflowStateService } from "../../services/WorkflowStateService";
import { supabase } from "../../lib/supabase";
import { valueCaseService } from "../../services/ValueCaseService";
import { logger, LogContext } from "../../lib/logger";
import { analyticsClient } from "../../lib/analyticsClient";
import { randomUUID } from "crypto";
import {
  sduiTelemetry,
  TelemetryEventType,
} from "../../lib/telemetry/SDUITelemetry";
import { useCanvasStore } from '@sdui/canvas/CanvasStore";
import { SkeletonCanvas } from "../Common/SkeletonCanvas";
import { toUserFriendlyError } from "../../utils/errorHandling";
import { useToast } from "../Common/Toast";
import { crmIntegrationService } from "../../services/CRMIntegrationService";
import { PrintReportLayout } from "../Report/PrintReportLayout";
import { ExportPreviewModal } from "../Modals/ExportPreviewModal";
import { CRMSyncModal } from "../Modals/CRMSyncModal";
import { useSubscriptionManager, useSafeAsync } from "../../hooks/useSubscriptionManager";
import { useBatchedState, useSmartMemo } from "../../hooks/useBatchedState";
import { useValueCases, useCreateValueCase, queryClient } from "../../hooks/useValueCaseQuery";
import { useCanvasState } from './hooks/useCanvasStateHook';
import { useSessionManagement } from './hooks/useSessionManagement';
import { useAgentChatService } from './services/ServiceLocator';

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
  company: string;
  stage: "opportunity" | "target" | "realization" | "expansion";
  status: "in-progress" | "completed" | "paused";
  updatedAt: Date;
  sduiPage?: SDUIPageDefinition;
}

interface ChatCanvasLayoutProps {
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
  initialAction?: {
    type: string;
    data: any;
  } | null;
}

// ============================================================================
// Fallback Mock Data (used when Supabase is unavailable)
// ============================================================================

const FALLBACK_CASES: ValueCase[] = [
  {
    id: "demo-1",
    name: "Acme Corp - SaaS ROI",
    company: "Acme Corp",
    stage: "target",
    status: "in-progress",
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: "demo-2",
    name: "TechStart - Migration",
    company: "TechStart",
    stage: "opportunity",
    status: "in-progress",
    updatedAt: new Date(Date.now() - 86400000),
  },
];

// ============================================================================
// Sub-Components
// ============================================================================

const StageIndicator: FC<{ stage: ValueCase["stage"] }> = ({ stage }) => {
  const stageConfig = {
    opportunity: { color: "bg-blue-500", label: "Opportunity" },
    target: { color: "bg-amber-500", label: "Target" },
    realization: { color: "bg-green-500", label: "Realization" },
    expansion: { color: "bg-purple-500", label: "Expansion" },
  };

  const config = stageConfig[stage] || stageConfig.opportunity;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${config.color}`}
    >
      {config.label}
    </span>
  );
};

// Condensed case item (like screenshot)
const CaseItem = memo(
  ({
    case_,
    isSelected,
    onSelect,
  }: {
    case_: ValueCase;
    isSelected: boolean;
    onSelect: (id: string) => void;
  }) => {
    return (
      <button
        onClick={() => onSelect(case_.id)}
        aria-label={`${isSelected ? "Currently viewing" : "Open"} ${case_.name} for ${case_.company}`}
        aria-current={isSelected ? "page" : undefined}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
          isSelected
            ? "bg-card text-foreground shadow-beautiful-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        {case_.name}
      </button>
    );
  }
);
CaseItem.displayName = "CaseItem";

// Starter card component
const StarterCard: FC<{
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}> = ({ icon, title, description, onClick, primary }) => (
  <button
    onClick={onClick}
    aria-label={`${title} - ${description}`}
    className={`flex flex-col items-center text-center p-5 rounded-xl border transition-all hover:scale-[1.02] ${
      primary
        ? "bg-gray-800 border-gray-700 hover:border-indigo-500 hover:bg-gray-750"
        : "bg-gray-900 border-gray-800 hover:border-gray-600"
    }`}
  >
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
        primary ? "bg-indigo-600" : "bg-gray-800"
      }`}
    >
      {icon}
    </div>
    <h3 className="text-white font-medium text-sm mb-1">{title}</h3>
    <p className="text-gray-500 text-xs">{description}</p>
  </button>
);

const EmptyCanvas: FC<{
  onNewCase: () => void;
  onStarterAction: (action: string, data?: any) => void;
}> = ({ onNewCase, onStarterAction }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onStarterAction("upload_notes", { files });
      }
    },
    [onStarterAction]
  );

  return (
    <div
      className={`flex flex-col items-center justify-center h-full bg-background p-8 transition-all ${
        isDragging ? "ring-2 ring-primary ring-inset bg-card" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Start Building Value
          </h1>
          <p className="text-muted-foreground">
            Create a new case or import data to begin
          </p>
        </div>

        {/* Primary Actions - Large Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StarterCard
            icon={<Mic className="w-5 h-5 text-white" />}
            title="Analyze Sales Call"
            description="Upload recording or paste transcript"
            onClick={() => onStarterAction("upload_call")}
            primary
          />
          <StarterCard
            icon={<Link2 className="w-5 h-5 text-white" />}
            title="Import from CRM"
            description="Paste Salesforce or HubSpot URL"
            onClick={() => onStarterAction("import_crm")}
            primary
          />
        </div>

        {/* Secondary Actions - Smaller Cards */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <StarterCard
            icon={<FileText className="w-4 h-4 text-gray-400" />}
            title="Upload Notes"
            description="PDF, Doc, or text"
            onClick={() => onStarterAction("upload_notes")}
          />
          <StarterCard
            icon={<Mail className="w-4 h-4 text-gray-400" />}
            title="Email Thread"
            description="Paste to analyze"
            onClick={() => onStarterAction("analyze_email")}
          />
          <StarterCard
            icon={<Search className="w-4 h-4 text-gray-400" />}
            title="Research Company"
            description="Enter domain"
            onClick={onNewCase}
          />
          <StarterCard
            icon={<Plus className="w-4 h-4 text-gray-400" />}
            title="New Case"
            description="Start fresh"
            onClick={onNewCase}
          />
        </div>

        {/* Drop Zone Hint */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            Or drag & drop files anywhere
          </p>
        </div>

        {/* Chat Input Placeholder */}
        <div className="mt-10">
          <div className="relative">
            <input
              type="text"
              placeholder="It all starts here..."
              aria-label="Create new case to get started"
              className="w-full px-4 py-4 bg-card border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring shadow-beautiful-sm"
              onFocus={onNewCase}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">↑</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CanvasContent: FC<{
  renderedPage: RenderPageResult | null;
  isLoading: boolean;
  streamingUpdate: StreamingUpdate | null;
  isInitialLoad?: boolean;
}> = ({ renderedPage, isLoading, streamingUpdate, isInitialLoad }) => {
  // Show skeleton on initial load
  if (isInitialLoad) {
    return <SkeletonCanvas />;
  }

  // Show rendered content (prefer this even if loading/streaming to show updates)
  if (renderedPage?.element) {
    return (
      <div className="relative h-full flex flex-col">
        {/* Streaming Indicator Overlay */}
        {(isLoading || streamingUpdate) && (
          <div className="absolute top-4 right-6 z-10 flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur border border-indigo-100 rounded-full shadow-sm animate-in fade-in slide-in-from-top-2">
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium text-indigo-600">
              {streamingUpdate?.message || "Analyzing..."}
            </span>
          </div>
        )}

        <div className="p-6 overflow-auto flex-1">{renderedPage.element}</div>
      </div>
    );
  }

  // Fallback Loading State (only if no page rendered yet)
  if (isLoading || streamingUpdate) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-lg">
          <Loader2
            className="w-5 h-5 text-indigo-600 animate-spin"
            aria-hidden="true"
          />
          <span className="text-indigo-700 font-medium">
            {streamingUpdate?.message || "Processing..."}
          </span>
        </div>
        {streamingUpdate?.stage && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="capitalize">{streamingUpdate.stage}</span>
            {streamingUpdate.progress !== undefined && (
              <span>({Math.round(streamingUpdate.progress * 100)}%)</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

// Phase 3: Helper to create initial artifact SDUI page
function createInitialArtifactPage(
  actionType: string,
  data: any
): SDUIPageDefinition {
  const timestamp = new Date().toISOString();
  let title = "New Artifact";
  let content = "Processing data...";
  let icon = "file";

  if (actionType === "crm") {
    title = `Imported Deal: ${data.name || "Unknown"}`;
    content = `Imported from ${data.metadata?.crmProvider || "CRM"}.\nValue: ${data.amount ? `$${data.amount}` : "N/A"}\nStage: ${data.stage || "N/A"}`;
    icon = "database";
  } else if (actionType === "sales-call") {
    title = `Sales Call Analysis`;
    content = `Processing call recording/transcript.\nParticipants: ${data.participants?.length || "Unknown"}\nDuration: ${data.duration ? `${Math.round(data.duration / 60)}m` : "N/A"}`;
    icon = "mic";
  } else if (actionType === "upload-notes") {
    title = `Document Analysis`;
    content = `Analyzing uploaded notes...\nSource: ${data.fileName || "Upload"}`;
    icon = "file-text";
  }

  return {
    type: "page",
    version: 1,
    sections: [
      {
        type: "component",
        component: "AgentResponseCard",
        version: 1,
        props: {
          response: {
            id: "initial-artifact",
            agentId: "system",
            agentName: "System",
            timestamp: timestamp,
            content: `**${title}**\n\n${content}\n\n*Handing off to AI Agent for deep analysis...*`,
            status: "pending",
            confidence: 1,
            reasoning: [],
          },
          showReasoning: false,
          showActions: false,
        },
      },
    ],
    metadata: {
      priority: "normal",
      generated_at: Date.now(),
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

// Phase 3: Add telemetry debug helper
const logTelemetrySummary = () => {
  if (typeof window !== "undefined" && (window as any).__SDUI_DEBUG__) {
    const summary = sduiTelemetry.getPerformanceSummary();
    logger.debug("SDUI telemetry summary", {
      averageRenderMs: Number(summary.avgRenderTime.toFixed(2)),
      averageHydrationMs: Number(summary.avgHydrationTime.toFixed(2)),
      errorRate: Number((summary.errorRate * 100).toFixed(2)),
      totalEvents: summary.totalEvents,
    });
  }
};

const BETA_HUB_URL =
  import.meta.env.VITE_BETA_HUB_URL || "https://docs.valuecanvas.app/beta-hub";

const betaReleaseNotes = [
  {
    version: "0.9.0-beta",
    date: "2024-12-18",
    highlights: [
      "New in-app feedback workflow with screenshot and console capture",
      "Telemetry events for onboarding, invites, and API keys",
      "Improved API latency monitoring with percentile tracking",
    ],
    link: `${BETA_HUB_URL}#release-0-9-0-beta`,
  },
  {
    version: "0.8.5-beta",
    date: "2024-12-10",
    highlights: [
      "Value case starter flows for uploads, CRM imports, and calls",
      "Command bar reliability improvements",
      "Performance instrumentation for SDUI rendering",
    ],
    link: `${BETA_HUB_URL}#release-0-8-5-beta`,
  },
];

// ============================================================================
// Main Component
// ============================================================================

export const ChatCanvasLayout: FC<ChatCanvasLayoutProps> = ({
  onSettingsClick,
  onHelpClick,
  initialAction,
}) => {
  // Use React Query for value cases with caching
  const {
    data: cases = [],
    isLoading: isFetchingCases,
    error: casesError,
    refetch: refetchCases
  } = useValueCases();

  const createValueCase = useCreateValueCase();

  // Consolidated state management using useCanvasState hook
  const {
    state: canvasState,
    actions,
    hasSelectedCase,
    canSubmitCommand,
    isStreaming,
    anyModalOpen,
    startStreaming,
    stopStreaming,
    updateStreamingMessage,
    selectCaseAndReset,
    openModal,
    closeModal,
    setLoading,
    setSessionId,
    setWorkflowState,
    setRenderedPage,
    setStreamingUpdate,
    setRenderStartTime,
  } = useCanvasState();

  const {
    sessionState: newSessionState,
    loadOrCreateSession: newLoadOrCreateSession,
    saveWorkflowState: newSaveWorkflowState,
    hasActiveSession: newHasActiveSession,
    validateSession: newValidateSession,
  } = useSessionManagement();

  const agentChatServiceNew = useAgentChatService();

  // Workflow state service (initialized once)
  const workflowStateService = useMemo(
    () => new WorkflowStateService(supabase),
    []
  );

  // Handle command submission
  const handleCommand = useEvent(async (query: string) => {
    // Unified state validation
    if (!hasSelectedCase) {
      openModal('isNewCaseModalOpen');
      return;
    }

    // Get selected case from cases list
    const selectedCase = canvasState.selectedCaseId ? cases.find(c => c.id === canvasState.selectedCaseId) : undefined;

    // Initialize workflow state if not set
    if (!canvasState.workflowState && selectedCase) {
      setWorkflowState({
        currentStage: selectedCase.stage,
        status: "in_progress",
        completedStages: [],
        context: {
          caseId: selectedCase.id,
          company: selectedCase.company,
        },
      });
    }

    // Unified streaming state management
    setLoading(true);
    startStreaming("Understanding your request...", "analyzing");

    try {
      // Get user info from Supabase auth
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || "anonymous";
      const sessionId =
        sessionData?.session?.access_token?.slice(0, 36) || randomUUID();

      // Unified streaming update
      updateStreamingMessage("Consulting AI agent...", "processing");

      // Use current session ID or fall back to access token
      const actualSessionId = canvasState.currentSessionId || sessionId;

      // Phase 3: Track chat request
      const chatSpanId = `chat-${Date.now()}`;
      sduiTelemetry.startSpan(
        chatSpanId,
        TelemetryEventType.CHAT_REQUEST_START,
        {
          caseId: canvasState.selectedCaseId,
          stage: canvasState.workflowState?.currentStage || 'unknown',
          queryLength: query.length,
        }
      );

      // Process through AgentChatService (uses Together.ai LLM)
      // OLD: Direct service usage
      const result = await agentChatService.chat({
        query,
        caseId: canvasState.selectedCaseId,
        userId,
        sessionId: actualSessionId,
        workflowState: canvasState.workflowState ?? undefined,
      });

      // NEW: Service locator usage (gradual migration)
      // This will eventually replace the call above
      // const result = await agentChatServiceNew.chat({
      //   query,
      //   caseId: selectedCaseId,
      //   userId,
      //   sessionId: actualSessionId,
      //   workflowState: workflowState ?? undefined,
      // });

      // Track chat completion
      sduiTelemetry.endSpan(
        chatSpanId,
        TelemetryEventType.CHAT_REQUEST_COMPLETE,
        {
          hasSDUI: !!result.sduiPage,
          stageTransitioned:
            canvasState.workflowState ? result.nextState.currentStage !== canvasState.workflowState.currentStage : false,
        }
      );

      // Update workflow state in memory
      setWorkflowState(result.nextState);

      // Persist workflow state to database
      if (canvasState.currentSessionId) {
        try {
          // Track state save
          sduiTelemetry.recordEvent({
            type: TelemetryEventType.WORKFLOW_STATE_SAVE,
            metadata: {
              sessionId: canvasState.currentSessionId,
              stage: result.nextState.currentStage,
            },
          });

          if (!canvasState.user.currentTenantId) {
            throw new Error("Tenant ID is required to persist workflow state");
          }

          // OLD: Individual service call
          await workflowStateService.saveWorkflowState(
            canvasState.currentSessionId,
            result.nextState,
            canvasState.user.currentTenantId
          );

          // NEW: Session management call (gradual migration)
          // This will eventually replace the call above
          // await newSaveWorkflowState(result.nextState);
          logger.debug("Workflow state persisted after chat", {
            sessionId: canvasState.currentSessionId,
            stage: result.nextState.currentStage,
          });

          // Track stage transition if occurred
          if (canvasState.workflowState && result.nextState.currentStage !== canvasState.workflowState.currentStage) {
            sduiTelemetry.recordWorkflowStateChange(
              canvasState.currentSessionId,
              canvasState.workflowState?.currentStage || 'unknown',
              result.nextState.currentStage,
              {
                caseId: canvasState.selectedCaseId,
              }
            );
          }
        } catch (error) {
          logger.warn("Failed to persist workflow state", { error });
          // Continue even if persistence fails
        }
      }

      // OLD: Individual state management
      setStreamingUpdate({
        stage: "generating",
        message: "Generating response...",
      });

  // Unified streaming update
  updateStreamingMessage("Generating response...", "generating");

      // Render SDUI page if available
      if (result.sduiPage) {
        // Phase 3: Track SDUI rendering
        const renderSpanId = `render-response-${Date.now()}`;
        sduiTelemetry.startSpan(renderSpanId, TelemetryEventType.RENDER_START, {
          caseId: canvasState.selectedCaseId,
          stage: result.nextState.currentStage,
        });

        try {
          // Define handleSDUIAction for new pages
          const handleSDUIAction = (action: string, payload: any) => {
            if (action === "select_hypothesis") {
              handleCommand(
                `I want to explore the hypothesis: "${payload.title}". ${payload.description}. Please analyze this potential value driver deeper.`
              );
            }
          };

          const rendered = renderPage(result.sduiPage, {
            onAction: handleSDUIAction,
          });
          setRenderedPage(rendered);

          sduiTelemetry.endSpan(
            renderSpanId,
            TelemetryEventType.RENDER_COMPLETE,
            {
              componentCount: rendered.metadata?.componentCount,
              warnings: rendered.warnings?.length || 0,
            }
          );
        } catch (renderError) {
          sduiTelemetry.endSpan(
            renderSpanId,
            TelemetryEventType.RENDER_ERROR,
            {},
            {
              message:
                renderError instanceof Error
                  ? renderError.message
                  : "Render error",
              stack:
                renderError instanceof Error ? renderError.stack : undefined,
            }
          );
          throw renderError;
        }

        // Cache in case
        refetchCases();
      }

      // Update case stage if changed
      if (result.nextState.currentStage !== canvasState.workflowState?.currentStage) {
        refetchCases();
      }

  // Unified streaming completion
  updateStreamingMessage("Done!", "complete");
  setTimeout(() => stopStreaming(), 1000);
    } catch (error) {
      // Phase 3: Track chat error
      sduiTelemetry.recordEvent({
        type: TelemetryEventType.CHAT_REQUEST_ERROR,
        metadata: {
          caseId: canvasState.selectedCaseId,
          stage: canvasState.workflowState?.currentStage,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      logger.error(
        "Agent chat failed",
        error instanceof Error ? error : new Error(String(error))
      );

      // Show user-friendly error with retry action
      const friendlyError = toUserFriendlyError(error, "AI Analysis", () =>
        handleCommand(query)
      );

      showError(
        friendlyError.title,
        friendlyError.message,
        friendlyError.action
      );

  // Unified error state handling
  setLoading(false);
  stopStreaming();
    } finally {
  // Unified cleanup
  setLoading(false);
    }
  });

  // Unified modal management
  const handleOpenSync = () => openModal('isSyncModalOpen');
  const handleOpenExport = () => openModal('isExportModalOpen');

  // Canvas store for undo/redo
  const { undo, redo, canUndo, canRedo } = useCanvasStore();

  // Subscription manager for preventing memory leaks
  const subscriptionManager = useSubscriptionManager();
  const { safeSetState } = useSafeAsync();
  const batchedState = useBatchedState();

  // Toast notifications
  const { error: showError, success: showSuccess, info: showInfo } = useToast();

  // Optimized derived state using Maps for O(1) lookups
  const caseStatusMap = useMemo(() =>
    new Map(cases.map((c: ValueCase) => [c.id, c.status])),
    [cases]
  );

  const selectedCase = useMemo(() =>
    canvasState.selectedCaseId ? cases.find((c: ValueCase) => c.id === canvasState.selectedCaseId) : undefined,
    [cases, canvasState.selectedCaseId]
  );

  const inProgressCases = useMemo(() =>
    cases.filter((c: ValueCase) => caseStatusMap.get(c.id) === "in-progress"),
    [cases, caseStatusMap]
  );

  const completedCases = useMemo(() =>
    cases.filter((c: ValueCase) => caseStatusMap.get(c.id) === "completed"),
    [cases, caseStatusMap]
  );

  // Unified case selection
  const handleCaseSelect = useCallback((id: string) => {
    selectCaseAndReset(id);
  }, [selectCaseAndReset]);

  const trackAssetCreated = useCallback(
    (payload: {
      caseId: string;
      company: string;
      source: string;
      name: string;
    }) => {
      const timeToValueMs = canvasState.user.userCreatedAt
        ? Date.now() - new Date(canvasState.user.userCreatedAt).getTime()
        : undefined;

      analyticsClient.trackWorkflowEvent("asset_created", "asset_creation", {
        case_id: payload.caseId,
        company: payload.company,
        source: payload.source,
        name: payload.name,
        user_email: canvasState.user.userEmail,
        time_to_first_value_ms: timeToValueMs,
        time_to_first_value_minutes: timeToValueMs
          ? Math.round(timeToValueMs / 60000)
          : undefined,
      });

      analyticsClient.trackTimeToValue("time_to_first_value", canvasState.user.userCreatedAt, {
        workflow: "asset_creation",
        source: payload.source,
        case_id: payload.caseId,
      });
    },
    [canvasState.user.userCreatedAt, canvasState.user.userEmail]
  );

  // Handle Initial Action from Mission Control
  useEffect(() => {
    if (initialAction && !canvasState.hasProcessedInitialAction && !isFetchingCases) {
      const processInitialAction = async () => {
        actions.setProcessedInitialAction(true);

        // 1. Create a transient "New Case" if needed or use the data to spawn one
        let caseName = "New Value Case";
        let initialQuery = "";

        if (initialAction.type === "research") {
          caseName = `Research: ${initialAction.data}`;
          initialQuery = `Research the company ${initialAction.data} and identify top value drivers.`;
        } else if (initialAction.type === "sales-call") {
          caseName = `Call Analysis: ${new Date().toLocaleDateString()}`;
          initialQuery = `Analyze this sales call data and identify key value drivers and objections: ${JSON.stringify(initialAction.data).slice(0, 500)}...`;
        } else if (initialAction.type === "crm") {
          const dealName = initialAction.data.name || "Imported Deal";
          caseName = `Deal: ${dealName}`;
          initialQuery = `I have imported the deal "${dealName}" from CRM (Stage: ${initialAction.data.stage || "Unknown"}, Value: ${initialAction.data.amount || "Unknown"}). Please analyze this opportunity, identify missing value data, and recommend next steps to advance it to the next stage.`;
        } else if (initialAction.type === "upload-notes") {
          caseName = `Document Analysis: ${new Date().toLocaleDateString()}`;
          // In a real app, we'd pass the file content or ID. Here we assume the data contains extracted text.
          const extractedText =
            initialAction.data.text ||
            JSON.stringify(initialAction.data).slice(0, 500);
          initialQuery = `Analyze these uploaded notes/documents content. Extract the key business challenges, strategic goals, and potential value drivers:\n\n${extractedText}`;
        } else if (initialAction.type === "template") {
          caseName = `Model: ${initialAction.data.templateId} Template`;
          initialQuery = `Initialize a new value model using the "${initialAction.data.templateId}" template. Outline the standard value drivers, KPIs, and ROI metric structure for this industry use case.`;
        }

        // Define handleSDUIAction early so we can use it (though specific interaction logic is below)
        // OLD: Using any type
        // const handleSDUIAction = (action: string, payload: any) => {

        // NEW: Using enhanced types (gradual migration)
        const handleSDUIAction = (action: string, payload: unknown) => {
          if (action === "select_hypothesis") {
            // Type guard for hypothesis payload
            if (payload && typeof payload === 'object' && 'title' in payload && 'description' in payload) {
              handleCommand(
                `I want to explore the hypothesis: "${payload.title}". ${payload.description}. Please analyze this potential value driver deeper.`
              );
            }
          } else {
            logger.info("Unknown SDUI Action", { action, payload });
          }
        };

        // Create the case
        try {
          // For now, we mock creating it in the local state if Supabase isn't saving it yet
          const newCase: ValueCase = {
            id: randomUUID(),
            name: caseName,
            company: initialAction.data.company || "Unknown",
            stage: "opportunity",
            status: "in-progress",
            updatedAt: new Date(),
          };

          refetchCases();
          setSelectedCaseId(newCase.id);

          // If there's a query to run, trigger it after a brief delay to allow state to settle
          if (initialQuery) {
            // Materialize the initial artifact immediately so user sees "Receipt" of data
            try {
              const initialSDUI = createInitialArtifactPage(
                initialAction.type,
                initialAction.data
              );
              const renderedInitial = renderPage(initialSDUI, {
                onAction: handleSDUIAction,
              });
              setRenderedPage(renderedInitial);
            } catch (e) {
              logger.warn("Failed to render initial artifact", e as LogContext | undefined);
            }

            setTimeout(() => {
              handleCommand(initialQuery);
            }, 800); // Slightly increased delay to let user see the card appear
          }
        } catch (err) {
          console.error("Failed to process initial action", err);
        }
      };

      processInitialAction();
    }
  }, [
    initialAction,
    hasProcessedInitialAction,
    isFetchingCases,
    handleCommand,
  ]);

  // Fetch cases from Supabase on mount
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const fetchedCases = await valueCaseService.getValueCases();
        if (fetchedCases.length > 0) {
          refetchCases();
        }
        // If no cases fetched, keep fallback
      } catch (error) {
        logger.warn("Failed to fetch cases, using fallback data");
      } finally {
        // React Query handles loading state
      }
    };

    fetchCases();

    // Subscribe to real-time updates with memory leak prevention
    const unsubscribe = valueCaseService.subscribe(async (updatedCases) => {
      refetchCases();
    });

    subscriptionManager.add('valueCases', unsubscribe);
  }, []);

  // Get current user/tenant for CRM import
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        // Use user's default tenant or user ID as tenant
        // In a multi-tenant app, this would come from user metadata or a tenants table
        setCurrentTenantId(
          session.user.user_metadata?.tenant_id || session.user.id
        );
        setUserCreatedAt(session.user.created_at);
        setUserEmail(session.user.email || undefined);
        analyticsClient.identify(session.user.id, {
          email: session.user.email,
          created_at: session.user.created_at,
        });
      }
    };
    getSession();
  }, []);

  // NEW: Session Management Integration (Gradual Migration)
  // This demonstrates how to use the new session management
  // This will eventually replace the old session logic above
  useEffect(() => {
    // OLD: Keep existing session logic for now
    // NEW: Demonstrate new session management approach

    if (selectedCase && currentUserId && currentTenantId && !currentSessionId) {
      // This is how the new session management would work:
      newLoadOrCreateSession({
        caseId: selectedCase.id,
        userId: currentUserId,
        tenantId: currentTenantId,
        initialStage: selectedCase.stage,
        context: { company: selectedCase.company },
      }).then(({ sessionId, state }) => {
        newActions.setSessionId(sessionId);
        newActions.setWorkflowState(state);
        setCurrentSessionId(sessionId); // Keep old state for compatibility
        setWorkflowState(state); // Keep old state for compatibility
      }).catch(error => {
        logger.warn('Failed to load/create session with new management', error);
        // Fall back to existing behavior
      });
    }
  }, [selectedCase, currentUserId, currentTenantId, currentSessionId, newLoadOrCreateSession, newActions]);

  // Initialize workflow state for selected case
  useEffect(() => {
    if (!selectedCase || !currentUserId || !currentTenantId) {
      // Clear state when case is deselected
      setWorkflowState(null);
      setRenderedPage(null);
      setCurrentSessionId(null);
      setIsInitialCanvasLoad(false);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    // Load or create session for this case
    workflowStateService
      .loadOrCreateSession({
        caseId: selectedCase.id,
        userId: currentUserId,
        tenantId: currentTenantId,
        initialStage: selectedCase.stage as any,
        context: {
          company: selectedCase.company,
        },
      })
      .then(({ sessionId, state }) => {
        if (!isMounted) return; // Prevent state updates if component unmounted

        safeSetState(setCurrentSessionId)(sessionId);
        safeSetState(setWorkflowState)(state);
        logger.info("Workflow session initialized", {
          sessionId,
          caseId: selectedCase.id,
          stage: state.currentStage,
        });

        // Subscribe to workflow state changes using the actual session ID
        unsubscribe = workflowStateService.subscribeToState(
          sessionId,
          (newState) => {
            if (!isMounted) return; // Prevent state updates if component unmounted
            safeSetState(setWorkflowState)(newState);
          }
        );

        subscriptionManager.add('workflowState', unsubscribe);
      })
      .catch((error) => {
        if (!isMounted) return; // Prevent state updates if component unmounted
        logger.error("Failed to initialize workflow session", error);
        // Fallback to in-memory state
        safeSetState(setWorkflowState)({
          currentStage: selectedCase.stage,
          status: "in_progress",
          completedStages: [],
          context: {
            caseId: selectedCase.id,
            company: selectedCase.company,
          },
        });
      });

    // If case has cached SDUI page, render it
    if (selectedCase.sduiPage) {
      // Phase 3: Track SDUI rendering
      const renderStart = Date.now();
      setRenderStartTime(renderStart);
      sduiTelemetry.startSpan(
        `render-${selectedCase.id}`,
        TelemetryEventType.RENDER_START,
        {
          caseId: selectedCase.id,
          stage: workflowState?.currentStage || 'unknown',
          source: 'cached',
        }
      );

      try {
        const rendered = renderPage(selectedCase.sduiPage, {
          // OLD: Using any type
          // onAction: (action: string, payload: any) => {

          // NEW: Using enhanced types (gradual migration)
          onAction: (action: string, payload: unknown) => {
            if (action === "select_hypothesis") {
              // Type guard for hypothesis payload
              if (payload && typeof payload === 'object' && 'title' in payload && 'description' in payload) {
                handleCommand(
                  `I want to explore the hypothesis: "${payload.title}". ${payload.description}. Please analyze this potential value driver deeper.`
                );
              }
            }
          },
        });

        if (!isMounted) return; // Prevent state updates if component unmounted

        setRenderedPage(rendered);
        setIsInitialCanvasLoad(false);

        sduiTelemetry.endSpan(
          `render-${selectedCase.id}`,
          TelemetryEventType.RENDER_COMPLETE,
          {
            componentCount: rendered.metadata?.componentCount,
            warnings: rendered.warnings?.length || 0,
          }
        );
      } catch (error) {
        if (!isMounted) return; // Prevent state updates if component unmounted
        logger.error("Failed to render cached SDUI page", error);
        sduiTelemetry.endSpan(
          `render-${selectedCase.id}`,
          TelemetryEventType.RENDER_ERROR,
          {},
          {
            message: error instanceof Error ? error.message : "Render error",
            stack: error instanceof Error ? error.stack : undefined,
          }
        );
        setRenderedPage(null);
      }
    } else {
      if (!isMounted) return; // Prevent state updates if component unmounted
      setRenderedPage(null);
      setIsInitialCanvasLoad(false);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      unsubscribe?.();
      subscriptionManager.remove('workflowState');
    };
  }, [selectedCase?.id, currentUserId, currentTenantId, selectedCase?.stage, selectedCase?.company, selectedCase?.sduiPage]);

  // Keyboard shortcuts (⌘K for command bar, ⌘Z/⌘⇧Z for undo/redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command bar: ⌘K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandBarOpen(true);
        return;
      }

      // Undo/Redo: ⌘Z / ⌘⇧Z
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo()) {
            redo();
          }
        } else {
          if (canUndo()) {
            undo();
          }
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // Handle new case creation
  const handleNewCase = useCallback((companyName: string, website: string) => {
    const domain = website.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const newCase: ValueCase = {
      id: randomUUID(),
      name: `${companyName} - Value Case`,
      company: companyName,
      stage: "opportunity",
      status: "in-progress",
      updatedAt: new Date(),
    };

    refetchCases();
    setSelectedCaseId(newCase.id);
    setIsNewCaseModalOpen(false);
    setNewCaseCompany("");
    setNewCaseWebsite("");

    // Show success notification
    showSuccess("Case Created", `${companyName} value case is ready`);

    // Initialize workflow with company context
    setWorkflowState({
      currentStage: "opportunity",
      status: "in_progress",
      completedStages: [],
      context: {
        caseId: newCase.id,
        company: companyName,
        website: website,
        domain: domain,
      },
    });

    trackAssetCreated({
      caseId: newCase.id,
      company: companyName,
      source: "manual",
      name: newCase.name,
    });

    // Persist to Supabase if available
    valueCaseService
      .createValueCase({
        name: newCase.name,
        company: companyName,
        website: website,
        stage: "opportunity",
        status: "in-progress",
      })
      .catch((err) =>
        logger.warn("Failed to persist new case", { error: err })
      );
  }, []);

  // Open new case modal
  const openNewCaseModal = useCallback(() => {
    setIsNewCaseModalOpen(true);
  }, []);

  const openBetaHub = useCallback(() => {
    setIsBetaHubOpen(true);
    analyticsClient.track("beta_hub_opened", {
      workflow: "beta_enablement",
      source: "sidebar_footer",
    });
  }, []);

  const closeUploadNotesModal = useCallback(() => {
    setPendingUploadFile(null);
    setIsUploadNotesModalOpen(false);
  }, []);

  // Handle starter card actions
  const handleStarterAction = useCallback(
    (action: string, data?: { files?: File[] }) => {
      switch (action) {
        case "upload_notes":
          setPendingUploadFile(data?.files?.[0] ?? null);
          setIsUploadNotesModalOpen(true);
          break;
        case "analyze_email":
          setIsEmailAnalysisModalOpen(true);
          break;
        case "import_crm":
          setIsCRMImportModalOpen(true);
          break;
        case "upload_call":
          setIsSalesCallModalOpen(true);
          break;
        default:
          setIsNewCaseModalOpen(true);
      }
    },
    []
  );

  // Handle notes upload completion
  const handleNotesComplete = useCallback(
    (notes: ExtractedNotes) => {
      // Create a new case from the extracted notes
      const companyName = notes.insights?.companyName || "Unknown Company";
      const caseName = notes.fileName
        ? `${companyName} - ${notes.fileName}`
        : `${companyName} - Imported Notes`;

      const newCase: ValueCase = {
        id: randomUUID(),
        name: caseName,
        company: companyName,
        stage: "opportunity",
        status: "in-progress",
        updatedAt: new Date(),
      };

      refetchCases();
      setSelectedCaseId(newCase.id);
      closeUploadNotesModal();

      // Show success notification
      showSuccess("Notes Analyzed", `Created case for ${companyName}`);

      // Initialize workflow with extracted context
      setWorkflowState({
        currentStage: "opportunity",
        status: "in_progress",
        completedStages: [],
        context: {
          caseId: newCase.id,
          company: companyName,
          importedNotes: notes.rawText,
          extractedInsights: notes.insights,
        },
      });

      trackAssetCreated({
        caseId: newCase.id,
        company: companyName,
        source: "notes_upload",
        name: newCase.name,
      });

      // Auto-send the notes to the AI for deeper analysis
      setTimeout(async () => {
        const insights = notes.insights;
        const stakeholderList =
          insights?.stakeholders?.map((s) =>
            typeof s === "string"
              ? s
              : `${s.name}${s.role ? ` (${s.role})` : ""}`
          ) || [];

        const analysisPrompt = `I've imported opportunity notes. Here's what I found:

Company: ${companyName}
${insights?.summary ? `\nSummary: ${insights.summary}` : ""}
${insights?.painPoints?.length ? `\nPain Points:\n${insights.painPoints.map((p) => `- ${p}`).join("\n")}` : ""}
${stakeholderList.length ? `\nStakeholders:\n${stakeholderList.map((s) => `- ${s}`).join("\n")}` : ""}
${insights?.opportunities?.length ? `\nOpportunities:\n${insights.opportunities.map((o) => `- ${o}`).join("\n")}` : ""}
${insights?.nextSteps?.length ? `\nNext Steps:\n${insights.nextSteps.map((n) => `- ${n}`).join("\n")}` : ""}

Please analyze these notes and help me build a value hypothesis. What key value drivers should we focus on?`;

        // This will trigger the AI analysis
        handleCommand(analysisPrompt);
      }, 100);

      // Persist to Supabase
      valueCaseService
        .createValueCase({
          name: caseName,
          company: companyName,
          stage: "opportunity",
          status: "in-progress",
          metadata: {
            importedFrom: "notes",
            fileName: notes.fileName,
            extractedInsights: notes.insights,
          },
        })
        .catch((err) =>
          logger.warn("Failed to persist case from notes", { error: err })
        );
    },
    [closeUploadNotesModal, handleCommand]
  );

  // Handle email analysis completion
  const handleEmailComplete = useCallback(
    (analysis: EmailAnalysis, rawText: string) => {
      // Determine company name from participants or thread
      const companyName =
        analysis.participants?.[0]?.name?.split("@")[0] || "Unknown Company";
      const caseName = `${companyName} - Email Analysis`;

      const newCase: ValueCase = {
        id: randomUUID(),
        name: caseName,
        company: companyName,
        stage: "opportunity",
        status: "in-progress",
        updatedAt: new Date(),
      };

      refetchCases();
      setSelectedCaseId(newCase.id);
      setIsEmailAnalysisModalOpen(false);

      // Initialize workflow with analysis context
      setWorkflowState({
        currentStage: "opportunity",
        status: "in_progress",
        completedStages: [],
        context: {
          caseId: newCase.id,
          company: companyName,
          emailThread: rawText,
          emailAnalysis: analysis,
        },
      });

      trackAssetCreated({
        caseId: newCase.id,
        company: companyName,
        source: "email_analysis",
        name: newCase.name,
      });

      // Auto-send analysis to AI for next steps
      setTimeout(async () => {
        const stakeholderList =
          analysis.participants?.map(
            (p) => `${p.name}${p.role ? ` (${p.role})` : ""} - ${p.sentiment}`
          ) || [];

        const analysisPrompt = `I've analyzed an email thread. Here's what I found:

**Summary:** ${analysis.threadSummary}

**Sentiment:** ${analysis.sentiment} - ${analysis.sentimentExplanation}

**Urgency:** ${analysis.urgencyScore}/10 - ${analysis.urgencyReason}

${stakeholderList.length ? `**Participants:**\n${stakeholderList.map((s) => `- ${s}`).join("\n")}` : ""}

${analysis.keyAsks?.length ? `**Key Asks:**\n${analysis.keyAsks.map((k) => `- ${k}`).join("\n")}` : ""}

${analysis.objections?.length ? `**Objections:**\n${analysis.objections.map((o) => `- ${o}`).join("\n")}` : ""}

${analysis.dealSignals?.positive?.length ? `**Positive Signals:**\n${analysis.dealSignals.positive.map((s) => `- ${s}`).join("\n")}` : ""}

${analysis.dealSignals?.negative?.length ? `**Warning Signs:**\n${analysis.dealSignals.negative.map((s) => `- ${s}`).join("\n")}` : ""}

**Suggested Next Step:** ${analysis.suggestedNextStep}

Based on this email analysis, help me create a value hypothesis and action plan. What should I focus on to move this opportunity forward?`;

        handleCommand(analysisPrompt);
      }, 100);

      // Persist to Supabase
      valueCaseService
        .createValueCase({
          name: caseName,
          company: companyName,
          stage: "opportunity",
          status: "in-progress",
          metadata: {
            importedFrom: "email",
            emailAnalysis: analysis,
          },
        })
        .catch((err) =>
          logger.warn("Failed to persist case from email", { error: err })
        );
    },
    []
  );

  // Handle CRM import completion
  const handleCRMImportComplete = useCallback(
    (mappedCase: MappedValueCase, deal: CRMDeal) => {
      const newCase: ValueCase = {
        id: randomUUID(),
        name: mappedCase.name,
        company: mappedCase.company,
        stage: mappedCase.stage,
        status: mappedCase.status,
        updatedAt: new Date(),
      };

      refetchCases();
      setSelectedCaseId(newCase.id);
      setIsCRMImportModalOpen(false);

      // Initialize workflow with CRM context
      setWorkflowState({
        currentStage: mappedCase.stage,
        status: "in_progress",
        completedStages: [],
        context: {
          caseId: newCase.id,
          company: mappedCase.company,
          crmDeal: deal,
          crmMetadata: mappedCase.metadata,
        },
      });

      trackAssetCreated({
        caseId: newCase.id,
        company: mappedCase.company,
        source: "crm_import",
        name: newCase.name,
      });

      // Auto-send deal info to AI for analysis
      setTimeout(async () => {
        const stakeholderList =
          mappedCase.metadata.stakeholders?.map(
            (s) =>
              `${s.name}${s.role ? ` (${s.role})` : ""}${s.title ? ` - ${s.title}` : ""}`
          ) || [];

        const importPrompt = `I've imported a deal from ${mappedCase.metadata.crmProvider}:

**Deal:** ${deal.name}
**Company:** ${mappedCase.company}
**Stage:** ${deal.stage} → mapped to ${mappedCase.stage}
**Value:** ${deal.amount ? `$${deal.amount.toLocaleString()}` : "Not specified"}
**Close Date:** ${mappedCase.metadata.closeDate || "Not specified"}

${stakeholderList.length ? `**Stakeholders:**\n${stakeholderList.map((s) => `- ${s}`).join("\n")}` : ""}

Based on this deal information, help me:
1. Identify key value drivers for this opportunity
2. Suggest questions to uncover pain points
3. Recommend next steps to advance this deal`;

        handleCommand(importPrompt);
      }, 100);

      // Persist to Supabase
      valueCaseService
        .createValueCase({
          name: mappedCase.name,
          company: mappedCase.company,
          stage: mappedCase.stage,
          status: mappedCase.status,
          metadata: {
            importedFrom: "crm",
            crmProvider: mappedCase.metadata.crmProvider,
            crmDealId: mappedCase.metadata.crmDealId,
            dealValue: mappedCase.metadata.dealValue,
            closeDate: mappedCase.metadata.closeDate,
            stakeholders: mappedCase.metadata.stakeholders,
          },
        })
        .catch((err) =>
          logger.warn("Failed to persist case from CRM", { error: err })
        );
    },
    []
  );

  // Handle sales call analysis completion
  const handleSalesCallComplete = useCallback(
    (analysis: CallAnalysis, transcript: string) => {
      const caseName = `Sales Call - ${new Date().toLocaleDateString()}`;
      const companyName =
        analysis.participants?.find((p) => p.role === "prospect")?.name ||
        "Unknown Prospect";

      const newCase: ValueCase = {
        id: randomUUID(),
        name: caseName,
        company: companyName,
        stage: "opportunity",
        status: "in-progress",
        updatedAt: new Date(),
      };

      refetchCases();
      setSelectedCaseId(newCase.id);
      setIsSalesCallModalOpen(false);

      // Initialize workflow with call context
      setWorkflowState({
        currentStage: "opportunity",
        status: "in_progress",
        completedStages: [],
        context: {
          caseId: newCase.id,
          company: companyName,
          callTranscript: transcript,
          callAnalysis: analysis,
        },
      });

      trackAssetCreated({
        caseId: newCase.id,
        company: companyName,
        source: "sales_call",
        name: newCase.name,
      });

      // Auto-send analysis to AI for next steps
      setTimeout(async () => {
        const analysisPrompt = `I've analyzed a sales call. Here's what I found:

**Summary:** ${analysis.summary}

**Call Score:** ${analysis.callScore}/10
- Discovery: ${analysis.scoreBreakdown.discovery}/10
- Value Articulation: ${analysis.scoreBreakdown.valueArticulation}/10
- Objection Handling: ${analysis.scoreBreakdown.objectionHandling}/10
- Next Steps Clarity: ${analysis.scoreBreakdown.nextStepsClarity}/10

${analysis.painPoints?.length ? `**Pain Points:**\n${analysis.painPoints.map((p) => `- ${p}`).join("\n")}` : ""}

${analysis.objections?.length ? `**Objections:**\n${analysis.objections.map((o) => `- ${o.objection}${o.handled ? " ✓" : " ✗"}`).join("\n")}` : ""}

${analysis.buyingSignals?.length ? `**Buying Signals:**\n${analysis.buyingSignals.map((s) => `- ${s}`).join("\n")}` : ""}

${analysis.warningFlags?.length ? `**Warning Flags:**\n${analysis.warningFlags.map((f) => `- ${f}`).join("\n")}` : ""}

${analysis.nextSteps?.length ? `**Agreed Next Steps:**\n${analysis.nextSteps.map((n) => `- ${n}`).join("\n")}` : ""}

Based on this call analysis, help me:
1. Build a value hypothesis addressing the pain points
2. Prepare for the next conversation
3. Identify any gaps in my discovery`;

        handleCommand(analysisPrompt);
      }, 100);

      // Persist to Supabase
      valueCaseService
        .createValueCase({
          name: caseName,
          company: companyName,
          stage: "opportunity",
          status: "in-progress",
          metadata: {
            importedFrom: "call",
            callDuration: analysis.duration,
            callScore: analysis.callScore,
            painPoints: analysis.painPoints,
            nextSteps: analysis.nextSteps,
          },
        })
        .catch((err) =>
          logger.warn("Failed to persist case from call", { error: err })
        );
    },
    []
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Library Sidebar - Dark theme, condensed */}
      <aside className="w-56 bg-sidebar-background border-r border-sidebar-border flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">←</span>
            <span className="text-muted-foreground text-xs">ValueCanvas</span>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-2">
          <button
            onClick={openNewCaseModal}
            aria-label="Create new case"
            className="w-full flex items-center justify-between px-3 py-2 bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg border border-sidebar-border hover:bg-accent hover:text-accent-foreground transition-colors shadow-beautiful-sm"
          >
            <span>New Chat</span>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Case Lists - Condensed */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {/* Recent */}
          {inProgressCases.length > 0 && (
            <div className="mb-4">
              <p className="px-3 py-1 text-xs text-muted-foreground font-medium">
                Recent
              </p>
              <div className="space-y-0.5">
                {inProgressCases.map((case_: ValueCase) => (
                  <CaseItem
                    key={case_.id}
                    case_={case_}
                    isSelected={selectedCaseId === case_.id}
                    onSelect={handleCaseSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedCases.length > 0 && (
            <div>
              <p className="px-3 py-1 text-xs text-muted-foreground font-medium">
                Previous 30 Days
              </p>
              <div className="space-y-0.5">
                {completedCases.map((case_: ValueCase) => (
                  <CaseItem
                    key={case_.id}
                    case_={case_}
                    isSelected={selectedCaseId === case_.id}
                    onSelect={handleCaseSelect}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-2">
            <button
              onClick={onSettingsClick}
              aria-label="Open settings"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={openBetaHub}
              aria-label="Open beta hub"
              className="px-3 py-1 text-xs bg-primary/10 text-primary rounded-lg border border-primary/40 hover:bg-primary hover:text-primary-foreground transition-colors shadow-beautiful-sm"
            >
              Beta Hub
            </button>
            <button
              onClick={onHelpClick}
              aria-label="Get help"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              title="Help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
              <span>⌘</span>
              <span>K</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 flex flex-col bg-background">
        {/* Canvas Header (when case selected) */}
        {selectedCase && (
          <header className="bg-card border-b border-border px-6 py-4 shadow-beautiful-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedCase.name}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <StageIndicator stage={selectedCase.stage} />
                  <span className="text-sm text-muted-foreground">
                    {selectedCase.company}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Phase 6: Sync & Export Actions */}
                {workflowState?.context?.lastAnalysis && (
                  <>
                    {initialAction?.type === "crm" && (
                      <button
                        onClick={handleOpenSync}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200 transition-colors shadow-sm"
                      >
                        <Share2 className="w-4 h-4 text-orange-600" />
                        <span>Sync to CRM</span>
                      </button>
                    )}

                    <button
                      onClick={handleOpenExport}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200 transition-colors shadow-sm"
                    >
                      <Printer className="w-4 h-4 text-gray-500" />
                      <span>Export Report</span>
                    </button>

                    <div className="h-6 w-px bg-gray-200 mx-1" />
                  </>
                )}

                <button
                  onClick={() => setIsCommandBarOpen(true)}
                  aria-label="Ask AI a question (⌘K)"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-accent rounded-lg text-sm text-muted-foreground hover:text-accent-foreground border border-border transition-colors shadow-beautiful-sm"
                >
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Ask AI</span>
                  <kbd className="ml-2 px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono border border-gray-600">
                    ⌘K
                  </kbd>
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Canvas Content */}
        <div className="flex-1 overflow-hidden">
          {selectedCase ? (
            <CanvasContent
              renderedPage={renderedPage}
              isLoading={isLoading}
              streamingUpdate={streamingUpdate}
              isInitialLoad={isInitialCanvasLoad}
            />
          ) : (
            <EmptyCanvas
              onNewCase={openNewCaseModal}
              onStarterAction={handleStarterAction}
            />
          )}
        </div>

        {/* Command Bar Input (always visible at bottom when case selected) */}
        {selectedCase && (
          <div className="border-t border-border bg-card p-4">
            <button
              onClick={() => setIsCommandBarOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-accent rounded-lg border border-border transition-colors text-left shadow-beautiful-sm"
              aria-label="Open command bar (⌘K)"
            >
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span className="flex-1 text-muted-foreground">
                Ask AI anything about this value case...
              </span>
              <kbd className="px-2 py-1 bg-muted rounded border border-border text-xs font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div>
        )}
      </main>

      {/* Command Bar Modal */}
      <CommandBar
        isOpen={isCommandBarOpen}
        onClose={() => setIsCommandBarOpen(false)}
        onSubmit={handleCommand}
        suggestions={[
          "Analyze pain points for this company",
          "Generate ROI model",
          "Create executive summary",
          "Show value drivers",
          "Build business case for CFO",
        ]}
      />

      {isBetaHubOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4">
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold">
                  Beta Hub
                </p>
                <h3 className="text-2xl font-semibold text-gray-900">
                  Knowledge Base & Release Notes
                </h3>
                <p className="text-sm text-gray-500">
                  Track what shipped this week and jump to the beta
                  documentation.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={BETA_HUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() =>
                    analyticsClient.track("beta_hub_kb_opened", {
                      workflow: "beta_enablement",
                    })
                  }
                >
                  Open knowledge base
                </a>
                <button
                  onClick={() => setIsBetaHubOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  aria-label="Close beta hub"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  Latest release notes
                </h4>
                <div className="space-y-3">
                  {betaReleaseNotes.map((entry) => (
                    <div
                      key={entry.version}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs uppercase text-gray-500">
                            {entry.date}
                          </p>
                          <p className="font-semibold text-gray-900">
                            {entry.version}
                          </p>
                        </div>
                        <a
                          href={entry.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800"
                          onClick={() =>
                            analyticsClient.track(
                              "beta_hub_release_note_opened",
                              { version: entry.version }
                            )
                          }
                        >
                          View
                        </a>
                      </div>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {entry.highlights.map((note, idx) => (
                          <li key={idx}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700">
                  How to get help
                </h4>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">
                    For blockers, start a support ticket via the in-app feedback
                    button or message our team in Intercom. Tickets from the
                    beta cohort are auto-tagged for the priority queue.
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2 w-2 rounded-full bg-green-500"
                        aria-hidden
                      />
                      <p>
                        Real-time chat: click{" "}
                        <span className="font-semibold">Feedback</span> → submit
                        ticket (includes screenshot & console logs).
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2 w-2 rounded-full bg-indigo-500"
                        aria-hidden
                      />
                      <p>
                        Documentation:{" "}
                        <a
                          href={BETA_HUB_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {BETA_HUB_URL}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsBetaHubOpen(false);
                    analyticsClient.track("beta_hub_closed", {
                      workflow: "beta_enablement",
                    });
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Case Modal */}
      {isNewCaseModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                New Value Case
              </h2>
              <button
                onClick={() => setIsNewCaseModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close new case dialog"
              >
                <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newCaseCompany.trim()) {
                  handleNewCase(newCaseCompany.trim(), newCaseWebsite.trim());
                }
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="company"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Company Name *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="company"
                    type="text"
                    value={newCaseCompany}
                    onChange={(e) => setNewCaseCompany(e.target.value)}
                    placeholder="e.g., Acme Corporation"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="website"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Company Website
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="website"
                    type="url"
                    value={newCaseWebsite}
                    onChange={(e) => setNewCaseWebsite(e.target.value)}
                    placeholder="e.g., https://acme.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Used to enrich with public company data
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewCaseModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  aria-label="Cancel new case creation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCaseCompany.trim()}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Create new value case"
                >
                  Create Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Notes Modal */}
      <UploadNotesModal
        isOpen={isUploadNotesModalOpen}
        onClose={() => {
          setIsUploadNotesModalOpen(false);
          setPendingUploadFile(null);
        }}
        onComplete={handleNotesComplete}
        initialFile={pendingUploadFile}
      />

      {/* Email Analysis Modal */}
      <EmailAnalysisModal
        isOpen={isEmailAnalysisModalOpen}
        onClose={() => setIsEmailAnalysisModalOpen(false)}
        onComplete={handleEmailComplete}
      />

      {/* CRM Import Modal */}
      <CRMImportModal
        isOpen={isCRMImportModalOpen}
        onClose={() => setIsCRMImportModalOpen(false)}
        onComplete={handleCRMImportComplete}
        tenantId={currentTenantId}
        userId={currentUserId}
      />

      {/* Sales Call Modal */}
      <SalesCallModal
        isOpen={isSalesCallModalOpen}
        onClose={() => setIsSalesCallModalOpen(false)}
        onComplete={handleSalesCallComplete}
      />

      {/* Phase 6: Hidden Print Layout */}
      {/* Phase 6: Interactive Modals */}
      {selectedCase && workflowState?.context?.lastAnalysis && (
        <>
          <ExportPreviewModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            caseData={selectedCase}
            analysisData={workflowState.context.lastAnalysis}
          />
          <CRMSyncModal
            isOpen={isSyncModalOpen}
            onClose={() => setIsSyncModalOpen(false)}
            dealId={
              (initialAction?.type === "crm" && initialAction.data?.id) ||
              "mock_deal_123"
            }
            analysisData={workflowState.context.lastAnalysis}
          />
        </>
      )}
    </div>
  );
};

export default ChatCanvasLayout;
