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

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  Settings,
  HelpCircle,
  Command,
  Loader2
} from 'lucide-react';
import { CommandBar } from '../Agent/CommandBar';
import { renderPage, RenderPageResult } from '../../sdui/renderPage';
import { SDUIPageDefinition } from '../../sdui/schema';
import { StreamingUpdate } from '../../services/UnifiedAgentOrchestrator';
import { agentChatService } from '../../services/AgentChatService';
import { WorkflowState } from '../../repositories/WorkflowStateRepository';
import { supabase } from '../../lib/supabase';
import { valueCaseService } from '../../services/ValueCaseService';
import { logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

interface ValueCase {
  id: string;
  name: string;
  company: string;
  stage: 'opportunity' | 'target' | 'realization' | 'expansion';
  status: 'in-progress' | 'completed';
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

const CaseCard: React.FC<{
  case_: ValueCase;
  isSelected: boolean;
  onClick: () => void;
}> = ({ case_, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isSelected 
          ? 'bg-indigo-50 border-2 border-indigo-500' 
          : 'bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{case_.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{case_.company}</p>
        </div>
        <ChevronRight className={`w-4 h-4 mt-1 transition-colors ${
          isSelected ? 'text-indigo-500' : 'text-gray-400'
        }`} />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <StageIndicator stage={case_.stage} />
        <span className="text-xs text-gray-400">
          {formatRelativeTime(case_.updatedAt)}
        </span>
      </div>
    </button>
  );
};

const EmptyCanvas: React.FC<{ onNewCase: () => void }> = ({ onNewCase }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-indigo-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Welcome to ValueCanvas
      </h2>
      <p className="text-gray-600 max-w-md mb-6">
        Select a case from the library or create a new one to get started.
        Use <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">⌘K</kbd> to 
        ask the AI assistant anything.
      </p>
      <button
        onClick={onNewCase}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Value Case
      </button>
    </div>
  );
};

const CanvasContent: React.FC<{
  renderedPage: RenderPageResult | null;
  isLoading: boolean;
  streamingUpdate: StreamingUpdate | null;
}> = ({ renderedPage, isLoading, streamingUpdate }) => {
  if (isLoading || streamingUpdate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-lg">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
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
      </div>
    );
  }

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

function formatRelativeTime(date: Date): string {
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
}

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
  const [streamingUpdate, setStreamingUpdate] = useState<StreamingUpdate | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);

  // Derived state
  const selectedCase = cases.find(c => c.id === selectedCaseId);
  const inProgressCases = cases.filter(c => c.status === 'in-progress');
  const completedCases = cases.filter(c => c.status === 'completed');

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

  // Initialize workflow state for selected case
  useEffect(() => {
    if (selectedCase) {
      setWorkflowState({
        currentStage: selectedCase.stage,
        status: 'in_progress',
        completedStages: [],
        context: {
          caseId: selectedCase.id,
          company: selectedCase.company,
        },
      });

      // If case has cached SDUI page, render it
      if (selectedCase.sduiPage) {
        const result = renderPage(selectedCase.sduiPage);
        setRenderedPage(result);
      } else {
        setRenderedPage(null);
      }
    } else {
      setWorkflowState(null);
      setRenderedPage(null);
    }
  }, [selectedCaseId]);

  // Keyboard shortcut for command bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandBarOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle command submission
  const handleCommand = useCallback(async (query: string) => {
    if (!workflowState || !selectedCaseId) {
      // No case selected, create a new one based on query
      handleNewCase(query);
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

      // Process through AgentChatService (uses Together.ai LLM)
      const result = await agentChatService.chat({
        query,
        caseId: selectedCaseId,
        userId,
        sessionId,
        workflowState,
      });

      // Update workflow state
      setWorkflowState(result.nextState);

      setStreamingUpdate({ stage: 'generating', message: 'Generating response...' });

      // Render SDUI page if available
      if (result.sduiPage) {
        const rendered = renderPage(result.sduiPage);
        setRenderedPage(rendered);

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
      logger.error('Error processing command', error instanceof Error ? error : undefined);
      setStreamingUpdate({ stage: 'complete', message: 'Error occurred. Please try again.' });
      setTimeout(() => setStreamingUpdate(null), 2000);
    } finally {
      setIsLoading(false);
    }
  }, [workflowState, selectedCaseId]);

  // Handle new case creation
  const handleNewCase = useCallback((initialQuery?: string) => {
    const newCase: ValueCase = {
      id: uuidv4(),
      name: initialQuery ? `New Case - ${initialQuery.slice(0, 30)}...` : 'New Value Case',
      company: 'New Company',
      stage: 'opportunity',
      status: 'in-progress',
      updatedAt: new Date(),
    };

    setCases(prev => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);

    // If there's an initial query, process it
    if (initialQuery) {
      setTimeout(() => handleCommand(initialQuery), 100);
    }
  }, [handleCommand]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Library Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">ValueCanvas</h1>
              <p className="text-xs text-gray-500">AI Value Engineering</p>
            </div>
          </div>
        </div>

        {/* New Case Button */}
        <div className="p-3">
          <button
            onClick={() => handleNewCase()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Value Case
          </button>
        </div>

        {/* Case Lists */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* In Progress */}
          <div>
            <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-gray-600">
              <Clock className="w-4 h-4" />
              In Progress ({inProgressCases.length})
            </div>
            <div className="mt-2 space-y-2">
              {inProgressCases.map(case_ => (
                <CaseCard
                  key={case_.id}
                  case_={case_}
                  isSelected={selectedCaseId === case_.id}
                  onClick={() => setSelectedCaseId(case_.id)}
                />
              ))}
              {inProgressCases.length === 0 && (
                <p className="text-sm text-gray-400 px-2 py-4 text-center">
                  No cases in progress
                </p>
              )}
            </div>
          </div>

          {/* Completed */}
          <div>
            <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-gray-600">
              <CheckCircle2 className="w-4 h-4" />
              Completed ({completedCases.length})
            </div>
            <div className="mt-2 space-y-2">
              {completedCases.map(case_ => (
                <CaseCard
                  key={case_.id}
                  case_={case_}
                  isSelected={selectedCaseId === case_.id}
                  onClick={() => setSelectedCaseId(case_.id)}
                />
              ))}
              {completedCases.length === 0 && (
                <p className="text-sm text-gray-400 px-2 py-4 text-center">
                  No completed cases
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={onSettingsClick}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onHelpClick}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 flex flex-col">
        {/* Canvas Header (when case selected) */}
        {selectedCase && (
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedCase.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <StageIndicator stage={selectedCase.stage} />
                  <span className="text-sm text-gray-500">{selectedCase.company}</span>
                </div>
              </div>
              <button
                onClick={() => setIsCommandBarOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Ask AI
                <kbd className="ml-2 px-1.5 py-0.5 bg-white rounded text-xs font-mono border border-gray-300">⌘K</kbd>
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
            />
          ) : (
            <EmptyCanvas onNewCase={() => handleNewCase()} />
          )}
        </div>

        {/* Command Bar Input (always visible at bottom when case selected) */}
        {selectedCase && (
          <div className="border-t border-gray-200 bg-white p-4">
            <button
              onClick={() => setIsCommandBarOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-left"
            >
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <span className="flex-1 text-gray-500">
                Ask AI anything about this value case...
              </span>
              <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-xs font-mono text-gray-500">
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
    </div>
  );
};

export default ChatCanvasLayout;
