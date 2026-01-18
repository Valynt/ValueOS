/**
 * CaseWorkspace - Split-pane workspace for value cases
 * 
 * Left: Conversation panel with agent messages
 * Right: Canvas with artifact rendering
 * 
 * Integrates with agent store and mock stream for MVP.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Circle,
  PlayCircle,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Agent store and types
import { 
  useAgentStore, 
  selectActiveArtifact, 
  selectArtifacts,
  selectOverallProgress,
  selectCanUndo,
  selectCanRedo,
} from "@/features/workspace/agent/store";
import { useAgentStream } from "@/features/workspace/agent/useAgentStream";
import type { AgentPhase, ConversationMessage, WorkflowStepState, Artifact } from "@/features/workspace/agent/types";

// Services
import { conversationsService } from "@/services/conversations";
import { artifactsService } from "@/services/artifacts";

// Artifact components
import { ArtifactRenderer } from "@/features/workspace/artifacts/ArtifactRenderer";
import { ArtifactStack } from "@/features/workspace/artifacts/ArtifactStack";

// Workspace components
import { FloatingToolbar } from "@/features/workspace/components/FloatingToolbar";
import { KPICards, type KPIData } from "@/features/workspace/components/KPICards";
import { ShareModal } from "@/features/workspace/components/ShareModal";
import { exportToPdf } from "@/features/workspace/services/exportPdf";

// Value Drivers
import { ValueDriverSelector } from "@/components/valueDrivers";
import { ValueDriver, MOCK_VALUE_DRIVERS } from "@/types/valueDriver";

export function CaseWorkspace() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local UI state
  const [inputValue, setInputValue] = useState("");
  const [showArtifactStack, setShowArtifactStack] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDriverPanel, setShowDriverPanel] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState<Array<{
    driver: ValueDriver;
    customValues: Record<string, number>;
    calculatedValue: number;
  }>>([]);

  // Agent store
  const {
    phase,
    messages,
    streamingContent,
    isStreaming,
    steps,
    assumptions,
    pendingQuestion,
    activeArtifactId,
    error,
    selectOption,
    approvePlan,
    rejectPlan,
    updateAssumption,
    approveArtifact,
    rejectArtifact,
    selectArtifact,
    reset,
    undo,
    redo,
    saveSnapshot,
    loadSession,
  } = useAgentStore();

  const activeArtifact = useAgentStore(selectActiveArtifact);
  const artifacts = useAgentStore(selectArtifacts);
  const overallProgress = useAgentStore(selectOverallProgress);
  const canUndo = useAgentStore(selectCanUndo);
  const canRedo = useAgentStore(selectCanRedo);
  
  // Memoize artifact list to avoid creating new array on every render
  const artifactList = React.useMemo(() => 
    Object.values(artifacts).sort((a, b) => b.updatedAt - a.updatedAt),
    [artifacts]
  );

  // Extract KPI data from artifacts
  const kpiData = React.useMemo((): KPIData => {
    const financialArtifact = artifactList.find(a => a.type === 'financial_projection');
    const valueArtifact = artifactList.find(a => a.type === 'value_model');
    
    if (financialArtifact?.content.kind === 'chart') {
      const config = financialArtifact.content.config as Record<string, unknown> | undefined;
      const metrics = config?.metrics as Record<string, number> | undefined;
      return {
        npv: metrics?.npv,
        roi: metrics?.roi,
        paybackMonths: metrics?.paybackMonths,
        costOfInaction: 45000, // Default estimate
        industryComparison: {
          npv: '+12% vs industry avg',
          payback: '-1.5 Mo vs industry avg',
          costOfInaction: 'High Risk vs industry avg',
        },
      };
    }
    
    if (valueArtifact?.content.kind === 'json') {
      const data = valueArtifact.content.data as Record<string, unknown>;
      return {
        totalValue: data.totalValue as number | undefined,
        npv: (data.totalValue as number) * 0.85, // Rough NPV estimate
        paybackMonths: 7.2,
        costOfInaction: 45000,
      };
    }
    
    return {};
  }, [artifactList]);

  // Agent stream hook - handles both mock and real API
  // Persists artifacts and messages to backend when caseId is available
  const { sendMessage: sendAgentMessage } = useAgentStream({
    useMock: false, // Using real Together AI API
    companyName: 'Acme Corp',
    valueCaseId: caseId,
    persistArtifacts: !!caseId, // Enable artifact persistence when we have a case ID
    persistMessages: !!caseId, // Enable message persistence when we have a case ID
    onArtifactPersisted: (artifact, persistedId) => {
      console.log(`Artifact "${artifact.title}" persisted with ID: ${persistedId}`);
    },
    onMessagesPersisted: (count) => {
      console.log(`Persisted ${count} messages to backend`);
    },
  });

  // Load conversation session on mount
  useEffect(() => {
    if (!caseId || sessionLoaded) return;

    const loadConversationSession = async () => {
      setIsLoadingSession(true);
      try {
        // Load messages
        const session = await conversationsService.loadSession(caseId);
        const uiMessages = conversationsService.sessionToUIMessages(session);

        // Load artifacts for this case
        const persistedArtifacts = await artifactsService.getByValueCase(caseId);
        const artifactsMap: Record<string, Artifact> = {};
        for (const pa of persistedArtifacts) {
          artifactsMap[pa.id] = artifactsService.toUIArtifact(pa);
        }

        // Load into store
        if (uiMessages.length > 0 || Object.keys(artifactsMap).length > 0) {
          loadSession(uiMessages, artifactsMap);
          console.log(`Loaded session: ${uiMessages.length} messages, ${Object.keys(artifactsMap).length} artifacts`);
        }
      } catch (error) {
        // Session load failure is not critical - user can start fresh
        console.warn('Failed to load conversation session:', error);
      } finally {
        setIsLoadingSession(false);
        setSessionLoaded(true);
      }
    };

    loadConversationSession();
  }, [caseId, sessionLoaded, loadSession]);

  // Export handler
  const handleExport = useCallback(() => {
    exportToPdf({
      title: 'Value Case Analysis',
      companyName: 'Acme Corp',
      artifacts: artifactList,
      kpiData,
      confidential: true,
    });
  }, [artifactList, kpiData]);

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    const text = artifactList
      .map(a => `${a.title}\n${a.content.kind === 'markdown' ? a.content.markdown : JSON.stringify(a.content, null, 2)}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
  }, [artifactList]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Handle sending a message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    // Send via agent stream hook
    await sendAgentMessage(userMessage);
  }, [inputValue, isStreaming, sendAgentMessage]);

  // Handle option selection (for clarify questions)
  const handleOptionSelect = useCallback((optionId: string) => {
    selectOption(optionId);
    
    // Continue the stream after selection
    sendAgentMessage('continue');
  }, [selectOption, sendAgentMessage]);

  // Handle plan approval
  const handleApprovePlan = useCallback(() => {
    approvePlan();
    
    // Continue execution
    sendAgentMessage('execute');
  }, [approvePlan, sendAgentMessage]);

  // Get phase display info
  const getPhaseInfo = (phase: AgentPhase) => {
    switch (phase) {
      case 'idle':
        return { label: 'Ready', color: 'bg-slate-100 text-slate-600' };
      case 'clarify':
        return { label: 'Clarifying', color: 'bg-blue-100 text-blue-700' };
      case 'plan':
        return { label: 'Planning', color: 'bg-amber-100 text-amber-700' };
      case 'execute':
        return { label: 'Executing', color: 'bg-purple-100 text-purple-700' };
      case 'review':
        return { label: 'Review', color: 'bg-emerald-100 text-emerald-700' };
      case 'finalize':
        return { label: 'Complete', color: 'bg-emerald-100 text-emerald-700' };
      default:
        return { label: phase, color: 'bg-slate-100 text-slate-600' };
    }
  };

  const phaseInfo = getPhaseInfo(phase);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app/cases")}
            className="p-1 hover:bg-slate-100 rounded text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Cases</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">Acme Corp Value Case</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={phaseInfo.color}>{phaseInfo.label}</Badge>
          <Button 
            variant={showDriverPanel ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowDriverPanel(!showDriverPanel)}
          >
            Value Drivers {selectedDrivers.length > 0 && `(${selectedDrivers.length})`}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowShareModal(true)}>Share</Button>
          <Button size="sm">Export</Button>
        </div>
      </header>

      {/* Main Content - Split Pane */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Conversation Panel */}
        <div className="w-[35%] min-w-[320px] max-w-[480px] border-r border-slate-200 flex flex-col bg-slate-50">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Welcome message if no messages */}
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">Start Building Your Value Case</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Tell me about the company you're analyzing, and I'll help you build a defensible ROI model.
                </p>
              </div>
            )}

            {/* Conversation messages */}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming message */}
            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl px-4 py-3 shadow-sm bg-white border border-slate-200 text-slate-800">
                  <div className="text-xs font-semibold text-primary mb-1">VALUEOS AGENT</div>
                  <div className="text-sm leading-relaxed">{streamingContent}</div>
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isStreaming && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {/* Clarify question */}
            {pendingQuestion && (
              <ClarifyCard
                question={pendingQuestion.question}
                options={pendingQuestion.options || []}
                onSelect={handleOptionSelect}
              />
            )}

            {/* Plan card */}
            {phase === 'plan' && steps.length > 0 && (
              <PlanCard
                steps={steps}
                assumptions={assumptions}
                onApprove={handleApprovePlan}
                onReject={rejectPlan}
                onUpdateAssumption={updateAssumption}
              />
            )}

            {/* Execution progress */}
            {phase === 'execute' && steps.length > 0 && (
              <ExecutionCard steps={steps} progress={overallProgress} />
            )}

            {/* Error display */}
            {error && (
              <ErrorCard
                message={error.message}
                suggestions={error.suggestions}
                onRetry={() => reset()}
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <UserAvatar name="Sarah K." size="sm" />
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={
                    phase === 'idle' 
                      ? "e.g., 'Build a value case for Stripe'" 
                      : "Ask a follow-up question..."
                  }
                  disabled={isStreaming}
                  className="w-full pl-4 pr-10 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isStreaming}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStreaming ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Canvas Panel */}
        <div className="flex-1 flex min-h-0">
          {/* Artifact Stack (collapsible sidebar) */}
          {showArtifactStack && artifactList.length > 0 && (
            <div className="w-64 border-r border-slate-200 bg-white overflow-y-auto">
              <ArtifactStack
                artifacts={artifactList}
                activeArtifactId={activeArtifactId}
                onSelect={selectArtifact}
              />
            </div>
          )}

          {/* Main Canvas */}
          <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col">
            {/* KPI Cards - show when we have data */}
            {(kpiData.npv || kpiData.totalValue) && (
              <div className="p-4 border-b border-slate-200 bg-white">
                <KPICards data={kpiData} />
              </div>
            )}
            
            {/* Artifact Display */}
            <div className="flex-1 overflow-hidden">
              {activeArtifact ? (
                <ArtifactRenderer
                  artifact={activeArtifact}
                  onApprove={() => {
                    saveSnapshot();
                    approveArtifact(activeArtifact.id);
                  }}
                  onReject={() => {
                    saveSnapshot();
                    rejectArtifact(activeArtifact.id);
                  }}
                />
              ) : (
                <EmptyCanvas phase={phase} />
              )}
            </div>
          </div>

          {/* Value Drivers Panel */}
          {showDriverPanel && (
            <div className="w-96 border-l border-slate-200 bg-white overflow-y-auto">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold">Value Drivers</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Select drivers to include in this case
                </p>
              </div>
              <div className="p-4">
                <ValueDriverSelector
                  selectedDrivers={selectedDrivers}
                  onSelect={(driver) => {
                    const defaultValues: Record<string, number> = {};
                    driver.formula.variables.forEach(v => {
                      defaultValues[v.name] = v.defaultValue;
                    });
                    setSelectedDrivers([...selectedDrivers, {
                      driver,
                      customValues: defaultValues,
                      calculatedValue: 0,
                    }]);
                  }}
                  onRemove={(driverId) => {
                    setSelectedDrivers(selectedDrivers.filter(s => s.driver.id !== driverId));
                  }}
                  onUpdateValues={(driverId, values) => {
                    setSelectedDrivers(selectedDrivers.map(s => 
                      s.driver.id === driverId ? { ...s, customValues: values } : s
                    ));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Toolbar */}
      {artifactList.length > 0 && (
        <FloatingToolbar
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onExport={handleExport}
          onCopy={handleCopy}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        caseId={caseId || 'new'}
        caseTitle="Acme Corp Value Case"
        companyName="Acme Corp"
      />
    </div>
  );
}

// Message bubble component
function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-primary text-white"
            : "bg-white border border-slate-200 text-slate-800"
        )}
      >
        {!isUser && (
          <div className="text-xs font-semibold text-primary mb-1">VALUEOS AGENT</div>
        )}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>

        {message.metadata?.reasoning && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="font-medium">Reasoning:</span> {message.metadata.reasoning}
          </div>
        )}

        {message.metadata?.confidence !== undefined && (
          <div className="mt-1 text-xs text-slate-400">
            Confidence: {Math.round(message.metadata.confidence * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}

// Clarify question card
function ClarifyCard({
  question,
  options,
  onSelect,
}: {
  question: string;
  options: Array<{ id: string; label: string; description?: string }>;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="p-4 bg-white border-primary/20 shadow-sm">
      <div className="text-xs font-semibold text-primary mb-2">CLARIFICATION NEEDED</div>
      <p className="text-sm text-slate-700 mb-3">{question}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-primary border border-slate-200 hover:border-primary/30 rounded-lg text-xs font-medium transition-colors"
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// Plan card
function PlanCard({
  steps,
  assumptions,
  onApprove,
  onReject,
  onUpdateAssumption,
}: {
  steps: WorkflowStepState[];
  assumptions: Array<{ id: string; label: string; value: string | number; editable: boolean }>;
  onApprove: () => void;
  onReject: () => void;
  onUpdateAssumption: (id: string, value: string | number) => void;
}) {
  return (
    <Card className="p-4 bg-white border-amber-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-amber-700">PROPOSED PLAN</div>
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Review</Badge>
      </div>

      {/* Steps */}
      <div className="space-y-2 mb-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2 text-sm">
            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
              {index + 1}
            </span>
            <span className="text-slate-700">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Assumptions */}
      {assumptions.length > 0 && (
        <div className="border-t border-slate-100 pt-3 mb-4">
          <div className="text-xs font-medium text-slate-500 mb-2">Assumptions</div>
          <div className="space-y-1">
            {assumptions.map((asm) => (
              <div key={asm.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{asm.label}</span>
                <span className="font-medium text-slate-800">{asm.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReject} className="flex-1">
          Reject
        </Button>
        <Button size="sm" onClick={onApprove} className="flex-1">
          Approve & Execute
        </Button>
      </div>
    </Card>
  );
}

// Execution progress card
function ExecutionCard({
  steps,
  progress,
}: {
  steps: WorkflowStepState[];
  progress: number;
}) {
  return (
    <Card className="p-4 bg-white border-purple-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-purple-700">EXECUTING</div>
        <span className="text-xs text-slate-500">{progress}% complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2">
            <div className="w-5 flex justify-center">
              {step.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
              {step.status === 'running' && <PlayCircle size={16} className="text-purple-500 animate-pulse" />}
              {step.status === 'pending' && <Circle size={16} className="text-slate-300" />}
              {step.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
            </div>
            <span className={cn(
              "text-sm",
              step.status === 'pending' ? "text-slate-400" : "text-slate-700"
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Error card
function ErrorCard({
  message,
  suggestions,
  onRetry,
}: {
  message: string;
  suggestions?: string[];
  onRetry: () => void;
}) {
  return (
    <Card className="p-4 bg-red-50 border-red-200 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-red-800 mb-1">Something went wrong</div>
          <p className="text-sm text-red-600 mb-3">{message}</p>
          {suggestions && suggestions.length > 0 && (
            <div className="text-xs text-red-500 mb-3">
              Try: {suggestions.join(' or ')}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Empty canvas state
function EmptyCanvas({ phase }: { phase: AgentPhase }) {
  const getMessage = () => {
    switch (phase) {
      case 'idle':
        return {
          title: 'Start a Conversation',
          description: 'Ask the agent to analyze a company and artifacts will appear here.',
        };
      case 'clarify':
      case 'plan':
        return {
          title: 'Preparing Analysis',
          description: 'Answer the questions on the left to continue.',
        };
      case 'execute':
        return {
          title: 'Building Your Value Case',
          description: 'Artifacts will appear here as the agent works.',
        };
      default:
        return {
          title: 'Canvas',
          description: 'Select an artifact to view it here.',
        };
    }
  };

  const { title, description } = getMessage();

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export default CaseWorkspace;
