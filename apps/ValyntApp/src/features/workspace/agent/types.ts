/**
 * Agent Event Types
 * 
 * UI-facing event contract for the agent interaction model.
 * These types drive the conversation UI state machine.
 */

// Agent conversation phases — 7-state machine (see state-machine.ts for transitions)
export type AgentPhase = 
  | 'idle'      // Ready for input
  | 'clarify'   // Asking clarifying question
  | 'plan'      // Showing execution plan for approval
  | 'execute'   // Running workflow steps
  | 'review'    // Presenting artifacts for approval (diff view)
  | 'finalize'  // Confirming and persisting results
  | 'error'     // Recoverable error state
  | 'resume';   // Restoring previous session

// Event types from agent stream
export type AgentEventType =
  | 'phase_changed'
  | 'checkpoint_created'
  | 'tool_started'
  | 'tool_finished'
  | 'artifact_proposed'
  | 'artifact_updated'
  | 'message_delta'
  | 'clarify_question'
  | 'plan_proposed'
  | 'error';

// Base event structure
export interface AgentEventBase {
  id: string;
  type: AgentEventType;
  timestamp: number;
  runId: string;
}

// Phase change event
export interface PhaseChangedEvent extends AgentEventBase {
  type: 'phase_changed';
  payload: {
    from: AgentPhase;
    to: AgentPhase;
    reason?: string;
  };
}

// Checkpoint event (progress marker)
export interface CheckpointCreatedEvent extends AgentEventBase {
  type: 'checkpoint_created';
  payload: {
    checkpointId: string;
    label: string;
    progress: number; // 0-100
    canRestore: boolean;
  };
}

// Tool execution events
export interface ToolStartedEvent extends AgentEventBase {
  type: 'tool_started';
  payload: {
    toolName: string;
    toolId: string;
    description: string;
    estimatedDuration?: number; // ms
  };
}

export interface ToolFinishedEvent extends AgentEventBase {
  type: 'tool_finished';
  payload: {
    toolId: string;
    toolName: string;
    status: 'success' | 'error' | 'skipped';
    duration: number;
    result?: unknown;
    error?: string;
  };
}

// Artifact events
export interface ArtifactProposedEvent extends AgentEventBase {
  type: 'artifact_proposed';
  payload: {
    artifact: Artifact;
  };
}

export interface ArtifactUpdatedEvent extends AgentEventBase {
  type: 'artifact_updated';
  payload: {
    artifactId: string;
    changes: Partial<Artifact>;
  };
}

// Streaming message content
export interface MessageDeltaEvent extends AgentEventBase {
  type: 'message_delta';
  payload: {
    messageId: string;
    delta: string; // Incremental text
    done: boolean;
  };
}

// Clarification question
export interface ClarifyQuestionEvent extends AgentEventBase {
  type: 'clarify_question';
  payload: {
    questionId: string;
    question: string;
    options?: ClarifyOption[];
    defaultOption?: string;
    allowFreeform: boolean;
  };
}

export interface ClarifyOption {
  id: string;
  label: string;
  value: string;
  description?: string;
}

// Plan proposal
export interface PlanProposedEvent extends AgentEventBase {
  type: 'plan_proposed';
  payload: {
    planId: string;
    steps: PlanStep[];
    estimatedDuration: number; // ms
    assumptions: PlanAssumption[];
  };
}

export interface PlanStep {
  id: string;
  label: string;
  description?: string;
  estimatedDuration?: number;
  dependencies?: string[];
}

export interface PlanAssumption {
  id: string;
  label: string;
  value: string | number;
  editable: boolean;
  source?: string;
}

// Error event
export interface ErrorEvent extends AgentEventBase {
  type: 'error';
  payload: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestions?: string[];
  };
}

// Union type for all events
export type AgentEvent =
  | PhaseChangedEvent
  | CheckpointCreatedEvent
  | ToolStartedEvent
  | ToolFinishedEvent
  | ArtifactProposedEvent
  | ArtifactUpdatedEvent
  | MessageDeltaEvent
  | ClarifyQuestionEvent
  | PlanProposedEvent
  | ErrorEvent;

// Artifact model (UI-facing)
export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  createdAt: number;
  updatedAt: number;
  content: ArtifactContent;
  source?: {
    agentRunId: string;
    checkpointId?: string;
  };
}

export type ArtifactType =
  | 'value_model'
  | 'financial_projection'
  | 'benchmark_comparison'
  | 'executive_summary'
  | 'pain_point_analysis'
  | 'assumption_set'
  | 'narrative'
  | 'chart'
  | 'table';

export type ArtifactStatus =
  | 'draft'
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'superseded';

export type ArtifactContent =
  | MarkdownContent
  | JsonContent
  | TableContent
  | ChartContent;

export interface MarkdownContent {
  kind: 'markdown';
  markdown: string;
}

export interface JsonContent {
  kind: 'json';
  data: Record<string, unknown>;
  schema?: string; // JSON schema reference
}

export interface TableContent {
  kind: 'table';
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'percent' | 'date';
  format?: string;
}

export interface ChartContent {
  kind: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'area';
  data: ChartDataPoint[];
  config?: Record<string, unknown>;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  category?: string;
}

// Message in conversation
export interface ConversationMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    reasoning?: string;
    sources?: string[];
    confidence?: number;
    artifactIds?: string[];
  };
}

// Workflow step status (for Plan UI)
export interface WorkflowStepState {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  progress?: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}
