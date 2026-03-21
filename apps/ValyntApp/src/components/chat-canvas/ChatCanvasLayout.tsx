/**
 * ChatCanvasLayout - Decomposed Architecture
 *
 * Composes three distinct layers:
 * - Shell Layer: Static navigation and tenant context
 * - Orchestration Layer: Agent state management
 * - Canvas Layer: Dynamic SDUI widget host
 *
 * This replaces the monolithic "God Component" with a modular architecture.
 */

import { useCallback, useEffect, useState } from "react";

import { logger } from "../../lib/logger";

import {
  AgentResponseCard,
  ChatInput,
  ValueSummaryCard,
} from "@/components/canvas";
import { AgentStatusIndicator } from "@/components/orchestration";
import { CommandBar, Sidebar, TopBar } from "@/components/shell";
import type { ValueCase } from "@/components/shell";
import { useAgentOrchestrator } from "@/hooks/useAgentOrchestrator";
import { useCanvasState } from "@/hooks/useCanvasState";
import { useCasesList } from "@/hooks/useCases";

interface ChatCanvasLayoutProps {
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
}

export function ChatCanvasLayout({ onSettingsClick, onHelpClick }: ChatCanvasLayoutProps) {
  // Shell state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  // Live cases from Supabase (tenant-scoped)
  const { data: rawCases = [] } = useCasesList();
  const cases: ValueCase[] = rawCases.map((c) => ({
    id: c.id,
    name: c.title ?? c.id,
    status: c.status === "published" ? "completed" : "in-progress",
    updatedAt: c.updated_at ?? "",
  }));

  // Auto-select first case when data loads
  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  // Orchestration hooks
  const {
    state: agentState,
    context: agentContext,
    thoughts,
    isProcessing,
    submitQuery,
    cancel,
  } = useAgentOrchestrator({
    onThought: (event) => logger.info("Thought:", event),
    onStateChange: (state) => logger.info("Agent state:", state),
  });

  const {
    assumptions,
    metrics,
    isDirty,
    calculateMetrics,
    commit,
  } = useCanvasState();

  // Calculate metrics when assumptions change
  useEffect(() => {
    calculateMetrics();
  }, [assumptions, calculateMetrics]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandBarOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handlers
  const handleSelectCase = useCallback((id: string) => {
    setSelectedCaseId(id);
  }, []);

  const handleNewCase = useCallback(() => {
    logger.info("Create new case");
  }, []);

  const handleCommandSubmit = useCallback((query: string) => {
    setCommandBarOpen(false);
    submitQuery(query);
  }, [submitQuery]);

  const handleChatSubmit = useCallback((action: string, payload?: unknown) => {
    if (action === "submit" && payload && typeof payload === "object" && "message" in payload) {
      submitQuery((payload as { message: string }).message);
    }
  }, [submitQuery]);

  // Derived state
  const selectedCase = cases.find((c) => c.id === selectedCaseId);
  const title = selectedCase?.name ?? "Select a case";

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Shell Layer: Sidebar */}
      <Sidebar
        cases={cases}
        selectedCaseId={selectedCaseId}
        collapsed={sidebarCollapsed}
        onSelectCase={handleSelectCase}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNewCase={handleNewCase}
        onSettingsClick={onSettingsClick}
        onHelpClick={onHelpClick}
      />

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Shell Layer: TopBar */}
        <TopBar
          title={title}
          onCommandBarOpen={() => setCommandBarOpen(true)}
        />

        {/* Orchestration Layer: Status */}
        {isProcessing && (
          <div className="border-b border-border bg-card/50 px-6 py-2">
            <AgentStatusIndicator
              state={agentState}
              currentStep={agentContext.currentStep}
            />
          </div>
        )}

        {/* Canvas Layer */}
        <div className="flex-1 overflow-auto bg-background p-6">
          {selectedCaseId ? (
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Value Summary Widget */}
              <ValueSummaryCard
                id="value-summary"
                data={{
                  title: "Value Summary",
                  status: selectedCase?.status === "completed" ? "Completed" : "In Progress",
                  roi: metrics.roi || 0,
                  annualValue: metrics.annualValue || 0,
                  stakeholders: 0,
                }}
              />

              {/* Agent Response Widget */}
              <AgentResponseCard
                id="agent-response"
                data={{
                  agentName: "Value Intelligence Agent",
                  status: isProcessing ? agentContext.currentStep : "Analysis complete",
                  summary: "Ask a question to begin value analysis for this case.",
                  valueDrivers: [],
                }}
              />

              {/* Thought Stream (when processing) */}
              {thoughts.length > 0 && (
                <div className="rounded-xl border border-border bg-card/50 p-4">
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">Agent Thoughts</h4>
                  <div className="space-y-1 font-mono text-xs text-muted-foreground">
                    {thoughts.slice(-5).map((thought) => (
                      <div key={thought.id} className="flex items-start gap-2">
                        <span className="text-primary">[{thought.type}]</span>
                        <span>{thought.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Input Widget */}
              <ChatInput
                id="chat-input"
                data={{
                  placeholder: "Ask a follow-up question...",
                  disabled: isProcessing,
                }}
                onAction={handleChatSubmit}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 text-muted-foreground/50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 21h18M3 7v14M21 7v14M6 7V4a1 1 0 011-1h10a1 1 0 011 1v3M9 21v-4a1 1 0 011-1h4a1 1 0 011 1v4" />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg font-medium">No case selected</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a case from the sidebar or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Shell Layer: Command Bar */}
      <CommandBar
        open={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        onSubmit={handleCommandSubmit}
      />
    </div>
  );
}

export default ChatCanvasLayout;
