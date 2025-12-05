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

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
  Plus,
  Sparkles,
  Settings,
  HelpCircle,
  Loader2,
  X,
  Building2,
  Globe,
  FileText,
  Mic,
  Link2,
  Mail,
  Search,
  Upload
} from 'lucide-react';
import { CommandBar } from '../Agent/CommandBar';
import { UploadNotesModal, ExtractedNotes } from '../Modals';
import { EmailAnalysisModal } from '../Modals/EmailAnalysisModal';
import { EmailAnalysis } from '../../services/EmailAnalysisService';
import { CRMImportModal } from '../Modals/CRMImportModal';
import { SalesCallModal } from '../Modals/SalesCallModal';
import { MappedValueCase } from '../../services/CRMFieldMapper';
import { CRMDeal } from '../../mcp-crm/types';
import { CallAnalysis } from '../../services/CallAnalysisService';
import { renderPage, RenderPageResult } from '../../sdui/renderPage';
import { SDUIPageDefinition } from '../../sdui/schema';
import { StreamingUpdate } from '../../services/UnifiedAgentOrchestrator';
import { agentChatService } from '../../services/AgentChatService';
import { WorkflowState } from '../../repositories/WorkflowStateRepository';
import { WorkflowStateService } from '../../services/WorkflowStateService';
import { supabase } from '../../lib/supabase';
import { valueCaseService } from '../../services/ValueCaseService';
import { logger } from '../../lib/logger';
import { analyticsClient } from '../../lib/analyticsClient';
import { v4 as uuidv4 } from 'uuid';
import { sduiTelemetry, TelemetryEventType } from '../../lib/telemetry/SDUITelemetry';
import { useCanvasStore } from '../../sdui/canvas/CanvasStore';
import { SkeletonCanvas } from '../Common/SkeletonCanvas';
import { toUserFriendlyError } from '../../utils/errorHandling';
import { useToast } from '../Common/Toast';

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
  
  return useCallback(((...args) => {
    const fn = handlerRef.current;
    return fn(...args);
  }) as T, []);
}

// ============================================================================
// Types
// ============================================================================

interface ValueCase {
  id: string;
  name: string;
  company: string;
  stage: 'opportunity' | 'target' | 'realization' | 'expansion';
  status: 'in-progress' | 'completed' | 'paused';
  updatedAt: Date;
  sduiPage?: SDUIPageDefinition;
}

interface ChatCanvasLayoutProps {
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
}

// ============================================================================
// Fallback Mock Data (used when Supabase is unavailable)
// ============================================================================

const FALLBACK_CASES: ValueCase[] = [
  {
    id: 'demo-1',
    name: 'Acme Corp - SaaS ROI',
    company: 'Acme Corp',
    stage: 'target',
    status: 'in-progress',
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: 'demo-2',
    name: 'TechStart - Migration',
    company: 'TechStart',
    stage: 'opportunity',
    status: 'in-progress',
    updatedAt: new Date(Date.now() - 86400000),
  },
];

// ============================================================================
// Sub-Components
// ============================================================================

const StageIndicator: React.FC<{ stage: ValueCase['stage'] }> = ({ stage }) => {
  const stageConfig = {
    opportunity: { color: 'bg-blue-500', label: 'Opportunity' },
    target: { color: 'bg-amber-500', label: 'Target' },
    realization: { color: 'bg-green-500', label: 'Realization' },
    expansion: { color: 'bg-purple-500', label: 'Expansion' },
  };

  const config = stageConfig[stage];
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${config.color}`}>
      {config.label}
    </span>
  );
};

// Condensed case item (like screenshot)
const CaseItem: React.FC<{
  case_: ValueCase;
  isSelected: boolean;
  onClick: () => void;
}> = ({ case_, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      aria-label={`${isSelected ? 'Currently viewing' : 'Open'} ${case_.name} for ${case_.company}`}
      aria-current={isSelected ? 'page' : undefined}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
        isSelected 
          ? 'bg-gray-800 text-white' 
          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {case_.name}
    </button>
  );
};

// Starter card component
const StarterCard: React.FC<{
  icon: React.ReactNode;
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
        ? 'bg-gray-800 border-gray-700 hover:border-indigo-500 hover:bg-gray-750' 
        : 'bg-gray-900 border-gray-800 hover:border-gray-600'
    }`}
  >
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
      primary ? 'bg-indigo-600' : 'bg-gray-800'
    }`}>
      {icon}
    </div>
    <h3 className="text-white font-medium text-sm mb-1">{title}</h3>
    <p className="text-gray-500 text-xs">{description}</p>
  </button>
);

const EmptyCanvas: React.FC<{ 
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
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onStarterAction('upload_notes', { files });
    }
  }, [onStarterAction]);
  
  return (
    <div 
      className={`flex flex-col items-center justify-center h-full bg-gray-950 p-8 transition-all ${
        isDragging ? 'ring-2 ring-indigo-500 ring-inset bg-gray-900' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-white mb-2">
            Start Building Value
          </h1>
          <p className="text-gray-400">
            Create a new case or import data to begin
          </p>
        </div>

        {/* Primary Actions - Large Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StarterCard
            icon={<Mic className="w-5 h-5 text-white" />}
            title="Analyze Sales Call"
            description="Upload recording or paste transcript"
            onClick={() => onStarterAction('upload_call')}
            primary
          />
          <StarterCard
            icon={<Link2 className="w-5 h-5 text-white" />}
            title="Import from CRM"
            description="Paste Salesforce or HubSpot URL"
            onClick={() => onStarterAction('import_crm')}
            primary
          />
        </div>

        {/* Secondary Actions - Smaller Cards */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <StarterCard
            icon={<FileText className="w-4 h-4 text-gray-400" />}
            title="Upload Notes"
            description="PDF, Doc, or text"
            onClick={() => onStarterAction('upload_notes')}
          />
          <StarterCard
            icon={<Mail className="w-4 h-4 text-gray-400" />}
            title="Email Thread"
            description="Paste to analyze"
            onClick={() => onStarterAction('analyze_email')}
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
          <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
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
              className="w-full px-4 py-4 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
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

const CanvasContent: React.FC<{
  renderedPage: RenderPageResult | null;
  isLoading: boolean;
  streamingUpdate: StreamingUpdate | null;
  isInitialLoad?: boolean;
}> = ({ renderedPage, isLoading, streamingUpdate, isInitialLoad }) => {
  // Show skeleton on initial load
  if (isInitialLoad) {
    return <SkeletonCanvas />;
  }

  // Show streaming progress indicator
  if (isLoading || streamingUpdate) {
    return (
      <div 
        className="flex flex-col items-center justify-center h-full gap-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-lg">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" aria-hidden="true" />
          <span className="text-indigo-700 font-medium">
            {streamingUpdate?.message || 'Processing...'}
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
        <span className="sr-only">
          {streamingUpdate?.message || 'Processing your request'}
          {streamingUpdate?.progress !== undefined && ` - ${Math.round(streamingUpdate.progress * 100)}% complete`}
        </span>
      </div>
    );
  }

  // Show rendered content
  if (renderedPage?.element) {
    return (
      <div className="p-6 overflow-auto h-full">
        {renderedPage.element}
      </div>
    );
  }

  return null;
};

// ============================================================================
// Helper Functions
// ============================================================================

// Phase 3: Add telemetry debug helper
const logTelemetrySummary = () => {
  if (typeof window !== 'undefined' && (window as any).__SDUI_DEBUG__) {
    const summary = sduiTelemetry.getPerformanceSummary();
    console.group('[SDUI Telemetry Summary]');
    console.log('Average Render Time:', summary.avgRenderTime.toFixed(2), 'ms');
    console.log('Average Hydration Time:', summary.avgHydrationTime.toFixed(2), 'ms');
    console.log('Error Rate:', (summary.errorRate * 100).toFixed(2), '%');
    console.log('Total Events:', summary.totalEvents);
    console.groupEnd();
  }
};

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const BETA_HUB_URL = import.meta.env.VITE_BETA_HUB_URL || 'https://docs.valuecanvas.app/beta-hub';

const betaReleaseNotes = [
  {
    version: '0.9.0-beta',
    date: '2024-12-18',
    highlights: [
      'New in-app feedback workflow with screenshot and console capture',
      'Telemetry events for onboarding, invites, and API keys',
      'Improved API latency monitoring with percentile tracking',
    ],
    link: `${BETA_HUB_URL}#release-0-9-0-beta`,
  },
  {
    version: '0.8.5-beta',
    date: '2024-12-10',
    highlights: [
      'Value case starter flows for uploads, CRM imports, and calls',
      'Command bar reliability improvements',
      'Performance instrumentation for SDUI rendering',
    ],
    link: `${BETA_HUB_URL}#release-0-8-5-beta`,
  },
];

// ============================================================================
// Main Component
// ============================================================================

export const ChatCanvasLayout: React.FC<ChatCanvasLayoutProps> = ({
  onSettingsClick,
  onHelpClick,
}) => {
  // State
  const [cases, setCases] = useState<ValueCase[]>(FALLBACK_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [renderedPage, setRenderedPage] = useState<RenderPageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCases, setIsFetchingCases] = useState(true);
  const [isInitialCanvasLoad, setIsInitialCanvasLoad] = useState(false);
  const [streamingUpdate, setStreamingUpdate] = useState<StreamingUpdate | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // New case modal state
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [newCaseCompany, setNewCaseCompany] = useState('');
  const [newCaseWebsite, setNewCaseWebsite] = useState('');

  // Upload notes modal state
  const [isUploadNotesModalOpen, setIsUploadNotesModalOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  
  // Email analysis modal state
  const [isEmailAnalysisModalOpen, setIsEmailAnalysisModalOpen] = useState(false);

  // CRM import modal state
  const [isCRMImportModalOpen, setIsCRMImportModalOpen] = useState(false);

  // Sales call modal state
  const [isSalesCallModalOpen, setIsSalesCallModalOpen] = useState(false);

  // User/tenant for CRM import
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [currentTenantId, setCurrentTenantId] = useState<string | undefined>();
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>();

  // Beta hub + telemetry
  const [isBetaHubOpen, setIsBetaHubOpen] = useState(false);

  // Workflow state service (initialized once)
  const workflowStateService = React.useMemo(
    () => new WorkflowStateService(supabase),
    []
  );

  // Phase 3: Telemetry tracking
  const [renderStartTime, setRenderStartTime] = React.useState<number | null>(null);
  
  // Canvas store for undo/redo
  const { undo, redo, canUndo, canRedo } = useCanvasStore();
  
  // Toast notifications
  const { error: showError, success: showSuccess, info: showInfo } = useToast();

  // Derived state
  const selectedCase = cases.find(c => c.id === selectedCaseId);
  const inProgressCases = cases.filter(c => c.status === 'in-progress');
  const completedCases = cases.filter(c => c.status === 'completed');

  const trackAssetCreated = useCallback(
    (payload: { caseId: string; company: string; source: string; name: string }) => {
      const timeToValueMs = userCreatedAt ? Date.now() - new Date(userCreatedAt).getTime() : undefined;

      analyticsClient.trackWorkflowEvent('asset_created', 'asset_creation', {
        case_id: payload.caseId,
        company: payload.company,
        source: payload.source,
        name: payload.name,
        user_email: userEmail,
        time_to_first_value_ms: timeToValueMs,
        time_to_first_value_minutes: timeToValueMs ? Math.round(timeToValueMs / 60000) : undefined,
      });

      analyticsClient.trackTimeToValue('time_to_first_value', userCreatedAt, {
        workflow: 'asset_creation',
        source: payload.source,
        case_id: payload.caseId,
      });
    },
    [userCreatedAt, userEmail]
  );

  // Fetch cases from Supabase on mount
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const fetchedCases = await valueCaseService.getValueCases();
        if (fetchedCases.length > 0) {
          setCases(fetchedCases.map(c => ({
            id: c.id,
            name: c.name,
            company: c.company,
            stage: c.stage,
            status: c.status,
            updatedAt: c.updated_at,
          })));
        }
        // If no cases fetched, keep fallback
      } catch (error) {
        logger.warn('Failed to fetch cases, using fallback data');
      } finally {
        setIsFetchingCases(false);
      }
    };

    fetchCases();

    // Subscribe to real-time updates
    const unsubscribe = valueCaseService.subscribe(async (updatedCases) => {
      setCases(updatedCases.map(c => ({
        id: c.id,
        name: c.name,
        company: c.company,
        stage: c.stage,
        status: c.status,
        updatedAt: c.updated_at,
      })));
    });

    return () => unsubscribe();
  }, []);

  // Get current user/tenant for CRM import
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        // Use user's default tenant or user ID as tenant
        // In a multi-tenant app, this would come from user metadata or a tenants table
        setCurrentTenantId(session.user.user_metadata?.tenant_id || session.user.id);
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

  // Initialize workflow state for selected case
  useEffect(() => {
    if (selectedCase && currentUserId) {
      // Load or create session for this case
      workflowStateService
        .loadOrCreateSession({
          caseId: selectedCase.id,
          userId: currentUserId,
          initialStage: selectedCase.stage as any,
          context: {
            company: selectedCase.company,
          },
        })
        .then(({ sessionId, state }) => {
          setCurrentSessionId(sessionId);
          setWorkflowState(state);
          logger.info('Workflow session initialized', {
            sessionId,
            caseId: selectedCase.id,
            stage: state.currentStage,
          });
        })
        .catch((error) => {
          logger.error('Failed to initialize workflow session', error);
          // Fallback to in-memory state
          setWorkflowState({
            currentStage: selectedCase.stage,
            status: 'in_progress',
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
            stage: selectedCase.stage,
          }
        );

        try {
          const result = renderPage(selectedCase.sduiPage);
          setRenderedPage(result);
          setIsInitialCanvasLoad(false);

          sduiTelemetry.endSpan(
            `render-${selectedCase.id}`,
            TelemetryEventType.RENDER_COMPLETE,
            {
              componentCount: result.metadata?.componentCount,
              warnings: result.warnings?.length || 0,
            }
          );
        } catch (error) {
          setIsInitialCanvasLoad(false);
          sduiTelemetry.endSpan(
            `render-${selectedCase.id}`,
            TelemetryEventType.RENDER_ERROR,
            { caseId: selectedCase.id },
            {
              message: error instanceof Error ? error.message : 'Render error',
              stack: error instanceof Error ? error.stack : undefined,
            }
          );
          setRenderedPage(null);
        }
      } else {
        setRenderedPage(null);
        setIsInitialCanvasLoad(false);
      }
    } else {
      setWorkflowState(null);
      setRenderedPage(null);
      setCurrentSessionId(null);
      setIsInitialCanvasLoad(false);
    }
  }, [selectedCaseId, currentUserId, workflowStateService]);

  // Keyboard shortcuts (⌘K for command bar, ⌘Z/⌘⇧Z for undo/redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command bar: ⌘K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandBarOpen(true);
        return;
      }
      
      // Undo/Redo: ⌘Z / ⌘⇧Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // Handle command submission
  const handleCommand = useEvent(async (query: string) => {
    if (!workflowState || !selectedCaseId) {
      // No case selected, prompt user to create one first
      setIsNewCaseModalOpen(true);
      return;
    }

    setIsLoading(true);
    setStreamingUpdate({ stage: 'analyzing', message: 'Understanding your request...' });

    try {
      // Get user info from Supabase auth
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || 'anonymous';
      const sessionId = sessionData?.session?.access_token?.slice(0, 36) || uuidv4();

      setStreamingUpdate({ stage: 'processing', message: 'Consulting AI agent...' });

      // Use current session ID or fall back to access token
      const actualSessionId = currentSessionId || sessionId;

      // Phase 3: Track chat request
      const chatSpanId = `chat-${Date.now()}`;
      sduiTelemetry.startSpan(
        chatSpanId,
        TelemetryEventType.CHAT_REQUEST_START,
        {
          caseId: selectedCaseId,
          stage: workflowState.currentStage,
          queryLength: query.length,
        }
      );

      // Process through AgentChatService (uses Together.ai LLM)
      const result = await agentChatService.chat({
        query,
        caseId: selectedCaseId,
        userId,
        sessionId: actualSessionId,
        workflowState,
      });

      // Track chat completion
      sduiTelemetry.endSpan(
        chatSpanId,
        TelemetryEventType.CHAT_REQUEST_COMPLETE,
        {
          hasSDUI: !!result.sduiPage,
          stageTransitioned: result.nextState.currentStage !== workflowState.currentStage,
        }
      );

      // Update workflow state in memory
      setWorkflowState(result.nextState);

      // Persist workflow state to database
      if (currentSessionId) {
        try {
          // Track state save
          sduiTelemetry.recordEvent({
            type: TelemetryEventType.WORKFLOW_STATE_SAVE,
            metadata: {
              sessionId: currentSessionId,
              stage: result.nextState.currentStage,
            },
          });

          await workflowStateService.saveWorkflowState(currentSessionId, result.nextState);
          logger.debug('Workflow state persisted after chat', {
            sessionId: currentSessionId,
            stage: result.nextState.currentStage,
          });

          // Track stage transition if occurred
          if (result.nextState.currentStage !== workflowState.currentStage) {
            sduiTelemetry.recordWorkflowStateChange(
              currentSessionId,
              workflowState.currentStage,
              result.nextState.currentStage,
              {
                caseId: selectedCaseId,
              }
            );
          }
        } catch (error) {
          logger.warn('Failed to persist workflow state', { error });
          // Continue even if persistence fails
        }
      }

      setStreamingUpdate({ stage: 'generating', message: 'Generating response...' });

      // Render SDUI page if available
      if (result.sduiPage) {
        // Phase 3: Track SDUI rendering
        const renderSpanId = `render-response-${Date.now()}`;
        sduiTelemetry.startSpan(
          renderSpanId,
          TelemetryEventType.RENDER_START,
          {
            caseId: selectedCaseId,
            stage: result.nextState.currentStage,
          }
        );

        try {
          const rendered = renderPage(result.sduiPage);
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
              message: renderError instanceof Error ? renderError.message : 'Render error',
              stack: renderError instanceof Error ? renderError.stack : undefined,
            }
          );
          throw renderError;
        }

        // Cache in case
        setCases(prev => prev.map(c => 
          c.id === selectedCaseId 
            ? { ...c, sduiPage: result.sduiPage, updatedAt: new Date() }
            : c
        ));
      }

      // Update case stage if changed
      if (result.nextState.currentStage !== workflowState.currentStage) {
        setCases(prev => prev.map(c => 
          c.id === selectedCaseId 
            ? { ...c, stage: result.nextState.currentStage as any, updatedAt: new Date() }
            : c
        ));
      }

      setStreamingUpdate({ stage: 'complete', message: 'Done!' });
      setTimeout(() => setStreamingUpdate(null), 1000);

    } catch (error) {
      // Phase 3: Track chat error
      sduiTelemetry.recordEvent({
        type: TelemetryEventType.CHAT_REQUEST_ERROR,
        metadata: {
          caseId: selectedCaseId,
          stage: workflowState?.currentStage,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      logger.error('Agent chat failed', error instanceof Error ? error : new Error(String(error)));

      // Show user-friendly error with retry action
      const friendlyError = toUserFriendlyError(
        error,
        'AI Analysis',
        () => handleCommand(query)
      );
      
      showError(
        friendlyError.title,
        friendlyError.message,
        friendlyError.action
      );

      setIsLoading(false);
      setStreamingUpdate(null);
    } finally {
      setIsLoading(false);
    }
  });

  // Handle new case creation
  const handleNewCase = useCallback((companyName: string, website: string) => {
    const domain = website.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const newCase: ValueCase = {
      id: uuidv4(),
      name: `${companyName} - Value Case`,
      company: companyName,
      stage: 'opportunity',
      status: 'in-progress',
      updatedAt: new Date(),
    };

    setCases(prev => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    setIsNewCaseModalOpen(false);
    setNewCaseCompany('');
    setNewCaseWebsite('');
    
    // Show success notification
    showSuccess(
      'Case Created',
      `${companyName} value case is ready`
    );

    // Initialize workflow with company context
    setWorkflowState({
      currentStage: 'opportunity',
      status: 'in_progress',
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
      source: 'manual',
      name: newCase.name,
    });

    // Persist to Supabase if available
    valueCaseService.createValueCase({
      name: newCase.name,
      company: companyName,
      website: website,
      stage: 'opportunity',
      status: 'in-progress',
    }).catch(err => logger.warn('Failed to persist new case', { error: err }));
  }, []);

  // Open new case modal
  const openNewCaseModal = useCallback(() => {
    setIsNewCaseModalOpen(true);
  }, []);

  const openBetaHub = useCallback(() => {
    setIsBetaHubOpen(true);
    analyticsClient.track('beta_hub_opened', {
      workflow: 'beta_enablement',
      source: 'sidebar_footer',
    });
  }, []);

  const closeUploadNotesModal = useCallback(() => {
    setPendingUploadFile(null);
    setIsUploadNotesModalOpen(false);
  }, []);

  // Handle starter card actions
  const handleStarterAction = useCallback((action: string, data?: { files?: File[] }) => {
    switch (action) {
      case 'upload_notes':
        setPendingUploadFile(data?.files?.[0] ?? null);
        setIsUploadNotesModalOpen(true);
        break;
      case 'analyze_email':
        setIsEmailAnalysisModalOpen(true);
        break;
      case 'import_crm':
        setIsCRMImportModalOpen(true);
        break;
      case 'upload_call':
        setIsSalesCallModalOpen(true);
        break;
      default:
        setIsNewCaseModalOpen(true);
    }
  }, []);

  // Handle notes upload completion
  const handleNotesComplete = useCallback((notes: ExtractedNotes) => {
    // Create a new case from the extracted notes
    const companyName = notes.insights?.companyName || 'Unknown Company';
    const caseName = notes.fileName
      ? `${companyName} - ${notes.fileName}`
      : `${companyName} - Imported Notes`;

    const newCase: ValueCase = {
      id: uuidv4(),
      name: caseName,
      company: companyName,
      stage: 'opportunity',
      status: 'in-progress',
      updatedAt: new Date(),
    };

    setCases(prev => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    closeUploadNotesModal();
    
    // Show success notification
    showSuccess(
      'Notes Analyzed',
      `Created case for ${companyName}`
    );

    // Initialize workflow with extracted context
    setWorkflowState({
      currentStage: 'opportunity',
      status: 'in_progress',
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
      source: 'notes_upload',
      name: newCase.name,
    });

    // Auto-send the notes to the AI for deeper analysis
    setTimeout(async () => {
      const insights = notes.insights;
      const stakeholderList = insights?.stakeholders?.map(s => 
        typeof s === 'string' ? s : `${s.name}${s.role ? ` (${s.role})` : ''}`
      ) || [];

      const analysisPrompt = `I've imported opportunity notes. Here's what I found:

Company: ${companyName}
${insights?.summary ? `\nSummary: ${insights.summary}` : ''}
${insights?.painPoints?.length ? `\nPain Points:\n${insights.painPoints.map(p => `- ${p}`).join('\n')}` : ''}
${stakeholderList.length ? `\nStakeholders:\n${stakeholderList.map(s => `- ${s}`).join('\n')}` : ''}
${insights?.opportunities?.length ? `\nOpportunities:\n${insights.opportunities.map(o => `- ${o}`).join('\n')}` : ''}
${insights?.nextSteps?.length ? `\nNext Steps:\n${insights.nextSteps.map(n => `- ${n}`).join('\n')}` : ''}

Please analyze these notes and help me build a value hypothesis. What key value drivers should we focus on?`;

      // This will trigger the AI analysis
      handleCommand(analysisPrompt);
    }, 100);

    // Persist to Supabase
    valueCaseService.createValueCase({
      name: caseName,
      company: companyName,
      stage: 'opportunity',
      status: 'in-progress',
      metadata: {
        importedFrom: 'notes',
        fileName: notes.fileName,
        extractedInsights: notes.insights,
      },
    }).catch(err => logger.warn('Failed to persist case from notes', { error: err }));
  }, [closeUploadNotesModal, handleCommand]);

  // Handle email analysis completion
  const handleEmailComplete = useCallback((analysis: EmailAnalysis, rawText: string) => {
    // Determine company name from participants or thread
    const companyName = analysis.participants?.[0]?.name?.split('@')[0] || 'Unknown Company';
    const caseName = `${companyName} - Email Analysis`;

    const newCase: ValueCase = {
      id: uuidv4(),
      name: caseName,
      company: companyName,
      stage: 'opportunity',
      status: 'in-progress',
      updatedAt: new Date(),
    };

    setCases(prev => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    setIsEmailAnalysisModalOpen(false);

    // Initialize workflow with analysis context
    setWorkflowState({
      currentStage: 'opportunity',
      status: 'in_progress',
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
      source: 'email_analysis',
      name: newCase.name,
    });

    // Auto-send analysis to AI for next steps
    setTimeout(async () => {
      const stakeholderList = analysis.participants?.map(p =>
        `${p.name}${p.role ? ` (${p.role})` : ''} - ${p.sentiment}`
      ) || [];

      const analysisPrompt = `I've analyzed an email thread. Here's what I found:

**Summary:** ${analysis.threadSummary}

**Sentiment:** ${analysis.sentiment} - ${analysis.sentimentExplanation}

**Urgency:** ${analysis.urgencyScore}/10 - ${analysis.urgencyReason}

${stakeholderList.length ? `**Participants:**\n${stakeholderList.map(s => `- ${s}`).join('\n')}` : ''}

${analysis.keyAsks?.length ? `**Key Asks:**\n${analysis.keyAsks.map(k => `- ${k}`).join('\n')}` : ''}

${analysis.objections?.length ? `**Objections:**\n${analysis.objections.map(o => `- ${o}`).join('\n')}` : ''}

${analysis.dealSignals?.positive?.length ? `**Positive Signals:**\n${analysis.dealSignals.positive.map(s => `- ${s}`).join('\n')}` : ''}

${analysis.dealSignals?.negative?.length ? `**Warning Signs:**\n${analysis.dealSignals.negative.map(s => `- ${s}`).join('\n')}` : ''}

**Suggested Next Step:** ${analysis.suggestedNextStep}

Based on this email analysis, help me create a value hypothesis and action plan. What should I focus on to move this opportunity forward?`;

      handleCommand(analysisPrompt);
    }, 100);

    // Persist to Supabase
    valueCaseService.createValueCase({
      name: caseName,
      company: companyName,
      stage: 'opportunity',
      status: 'in-progress',
      metadata: {
        importedFrom: 'email',
        emailAnalysis: analysis,
      },
    }).catch(err => logger.warn('Failed to persist case from email', { error: err }));
  }, []);

  // Handle CRM import completion
  const handleCRMImportComplete = useCallback((mappedCase: MappedValueCase, deal: CRMDeal) => {
    const newCase: ValueCase = {
      id: uuidv4(),
      name: mappedCase.name,
      company: mappedCase.company,
      stage: mappedCase.stage,
      status: mappedCase.status,
      updatedAt: new Date(),
    };

    setCases(prev => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    setIsCRMImportModalOpen(false);

    // Initialize workflow with CRM context
    setWorkflowState({
      currentStage: mappedCase.stage,
      status: 'in_progress',
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
      source: 'crm_import',
      name: newCase.name,
    });

    // Auto-send deal info to AI for analysis
    setTimeout(async () => {
      const stakeholderList = mappedCase.metadata.stakeholders?.map(s =>
        `${s.name}${s.role ? ` (${s.role})` : ''}${s.title ? ` - ${s.title}` : ''}`
      ) || [];

      const importPrompt = `I've imported a deal from ${mappedCase.metadata.crmProvider}:

**Deal:** ${deal.name}
**Company:** ${mappedCase.company}
**Stage:** ${deal.stage} → mapped to ${mappedCase.stage}
**Value:** ${deal.amount ? `$${deal.amount.toLocaleString()}` : 'Not specified'}
**Close Date:** ${mappedCase.metadata.closeDate || 'Not specified'}

${stakeholderList.length ? `**Stakeholders:**\n${stakeholderList.map(s => `- ${s}`).join('\n')}` : ''}

Based on this deal information, help me:
1. Identify key value drivers for this opportunity
2. Suggest questions to uncover pain points
3. Recommend next steps to advance this deal`;

      handleCommand(importPrompt);
    }, 100);

    // Persist to Supabase
    valueCaseService.createValueCase({
      name: mappedCase.name,
      company: mappedCase.company,
      stage: mappedCase.stage,
      status: mappedCase.status,
      metadata: {
        importedFrom: 'crm',
        crmProvider: mappedCase.metadata.crmProvider,
        crmDealId: mappedCase.metadata.crmDealId,
        dealValue: mappedCase.metadata.dealValue,
        closeDate: mappedCase.metadata.closeDate,
        stakeholders: mappedCase.metadata.stakeholders,
      },
    }).catch(err => logger.warn('Failed to persist case from CRM', { error: err }));
  }, []);

  // Handle sales call analysis completion
  const handleSalesCallComplete = useCallback((analysis: CallAnalysis, transcript: string) => {
    const caseName = `Sales Call - ${new Date().toLocaleDateString()}`;
    const companyName = analysis.participants?.find(p => p.role === 'prospect')?.name || 'Unknown Prospect';

    const newCase: ValueCase = {
      id: uuidv4(),
      name: caseName,
      company: companyName,
      stage: 'opportunity',
      status: 'in-progress',
      updatedAt: new Date(),
    };

    setCases(prev => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    setIsSalesCallModalOpen(false);

    // Initialize workflow with call context
    setWorkflowState({
      currentStage: 'opportunity',
      status: 'in_progress',
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
      source: 'sales_call',
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

${analysis.painPoints?.length ? `**Pain Points:**\n${analysis.painPoints.map(p => `- ${p}`).join('\n')}` : ''}

${analysis.objections?.length ? `**Objections:**\n${analysis.objections.map(o => `- ${o.objection}${o.handled ? ' ✓' : ' ✗'}`).join('\n')}` : ''}

${analysis.buyingSignals?.length ? `**Buying Signals:**\n${analysis.buyingSignals.map(s => `- ${s}`).join('\n')}` : ''}

${analysis.warningFlags?.length ? `**Warning Flags:**\n${analysis.warningFlags.map(f => `- ${f}`).join('\n')}` : ''}

${analysis.nextSteps?.length ? `**Agreed Next Steps:**\n${analysis.nextSteps.map(n => `- ${n}`).join('\n')}` : ''}

Based on this call analysis, help me:
1. Build a value hypothesis addressing the pain points
2. Prepare for the next conversation
3. Identify any gaps in my discovery`;

      handleCommand(analysisPrompt);
    }, 100);

    // Persist to Supabase
    valueCaseService.createValueCase({
      name: caseName,
      company: companyName,
      stage: 'opportunity',
      status: 'in-progress',
      metadata: {
        importedFrom: 'call',
        callDuration: analysis.duration,
        callScore: analysis.callScore,
        painPoints: analysis.painPoints,
        nextSteps: analysis.nextSteps,
      },
    }).catch(err => logger.warn('Failed to persist case from call', { error: err }));
  }, []);

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Library Sidebar - Dark theme, condensed */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm font-medium">←</span>
            <span className="text-gray-400 text-xs">ValueCanvas</span>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-2">
          <button
            onClick={openNewCaseModal}
            aria-label="Create new case"
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
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
              <p className="px-3 py-1 text-xs text-gray-500 font-medium">Recent</p>
              <div className="space-y-0.5">
                {inProgressCases.map(case_ => (
                  <CaseItem
                    key={case_.id}
                    case_={case_}
                    isSelected={selectedCaseId === case_.id}
                    onClick={() => setSelectedCaseId(case_.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedCases.length > 0 && (
            <div>
              <p className="px-3 py-1 text-xs text-gray-500 font-medium">Previous 30 Days</p>
              <div className="space-y-0.5">
                {completedCases.map(case_ => (
                  <CaseItem
                    key={case_.id}
                    case_={case_}
                    isSelected={selectedCaseId === case_.id}
                    onClick={() => setSelectedCaseId(case_.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-gray-800">
          <div className="flex items-center justify-between px-2">
            <button
              onClick={onSettingsClick}
              aria-label="Open settings"
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={openBetaHub}
              aria-label="Open beta hub"
              className="px-3 py-1 text-xs bg-blue-900/50 text-blue-200 rounded-lg border border-blue-800 hover:bg-blue-800 hover:text-white transition-colors"
            >
              Beta Hub
            </button>
            <button
              onClick={onHelpClick}
              aria-label="Get help"
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              title="Help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs text-gray-500">
              <span>⌘</span>
              <span>K</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 flex flex-col">
        {/* Canvas Header (when case selected) */}
        {selectedCase && (
          <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedCase.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <StageIndicator stage={selectedCase.stage} />
                  <span className="text-sm text-gray-400">{selectedCase.company}</span>
                </div>
              </div>
              <button
                onClick={() => setIsCommandBarOpen(true)}
                aria-label="Ask AI a question (⌘K)"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Ask AI
                <kbd className="ml-2 px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono border border-gray-600">⌘K</kbd>
              </button>
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
          <div className="border-t border-gray-800 bg-gray-900 p-4">
            <button
              onClick={() => setIsCommandBarOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 transition-colors text-left"
              aria-label="Open command bar (⌘K)"
            >
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span className="flex-1 text-gray-400">
                Ask AI anything about this value case...
              </span>
              <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-xs font-mono text-gray-400">
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
          'Analyze pain points for this company',
          'Generate ROI model',
          'Create executive summary',
          'Show value drivers',
          'Build business case for CFO',
        ]}
      />

      {isBetaHubOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4">
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold">Beta Hub</p>
                <h3 className="text-2xl font-semibold text-gray-900">Knowledge Base & Release Notes</h3>
                <p className="text-sm text-gray-500">Track what shipped this week and jump to the beta documentation.</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={BETA_HUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => analyticsClient.track('beta_hub_kb_opened', { workflow: 'beta_enablement' })}
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
                <h4 className="text-sm font-semibold text-gray-700">Latest release notes</h4>
                <div className="space-y-3">
                  {betaReleaseNotes.map((entry) => (
                    <div key={entry.version} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs uppercase text-gray-500">{entry.date}</p>
                          <p className="font-semibold text-gray-900">{entry.version}</p>
                        </div>
                        <a
                          href={entry.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800"
                          onClick={() => analyticsClient.track('beta_hub_release_note_opened', { version: entry.version })}
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
                <h4 className="text-sm font-semibold text-gray-700">How to get help</h4>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">For blockers, start a support ticket via the in-app feedback button or message our team in Intercom. Tickets from the beta cohort are auto-tagged for the priority queue.</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-green-500" aria-hidden />
                      <p>Real-time chat: click <span className="font-semibold">Feedback</span> → submit ticket (includes screenshot & console logs).</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                      <p>
                        Documentation:{' '}
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
                    analyticsClient.track('beta_hub_closed', { workflow: 'beta_enablement' });
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
              <h2 className="text-xl font-semibold text-gray-900">New Value Case</h2>
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
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
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
                <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
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
    </div>
  );
};

export default ChatCanvasLayout;
