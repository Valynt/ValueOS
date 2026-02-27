/**
 * Agent API Adapter
 *
 * Maps backend agent events to UI AgentEvent types.
 * Provides a clean interface between the orchestrator and the UI store.
 */

import type { AgentEvent, AgentPhase, Artifact } from './types';

// Backend types (from UnifiedAgentOrchestrator)
export interface StreamingUpdate {
  stage: 'thinking' | 'executing' | 'completed';
  message: string;
  progress?: number;
}

export interface AgentResponse {
  type: 'component' | 'message' | 'suggestion' | 'sdui-page';
  payload: unknown;
  streaming?: boolean;
  sduiPage?: unknown;
}

// Generate unique IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * Map backend streaming stage to UI phase
 */
function mapStageToPhase(stage: StreamingUpdate['stage']): AgentPhase {
  switch (stage) {
    case 'thinking':
      return 'clarify';
    case 'executing':
      return 'execute';
    case 'completed':
      return 'review';
    default:
      return 'idle';
  }
}

/**
 * Convert a StreamingUpdate to AgentEvents
 */
export function fromStreamingUpdate(
  update: StreamingUpdate,
  runId: string,
  previousPhase: AgentPhase
): AgentEvent[] {
  const events: AgentEvent[] = [];
  const timestamp = Date.now();
  const newPhase = mapStageToPhase(update.stage);

  // Emit phase change if different
  if (newPhase !== previousPhase) {
    events.push({
      id: generateId(),
      type: 'phase_changed',
      timestamp,
      runId,
      payload: {
        from: previousPhase,
        to: newPhase,
        reason: update.message,
      },
    });
  }

  // Emit checkpoint for progress updates
  if (update.progress !== undefined) {
    events.push({
      id: generateId(),
      type: 'checkpoint_created',
      timestamp,
      runId,
      payload: {
        checkpointId: generateId(),
        label: update.message,
        progress: update.progress,
        canRestore: true,
      },
    });
  }

  // Emit message delta for the update message
  if (update.message) {
    const messageId = generateId();
    events.push({
      id: generateId(),
      type: 'message_delta',
      timestamp,
      runId,
      payload: {
        messageId,
        delta: update.message,
        done: update.stage === 'complete',
      },
    });
  }

  return events;
}

/**
 * Convert an AgentResponse to AgentEvents
 */
export function fromAgentResponse(
  response: AgentResponse,
  runId: string
): AgentEvent[] {
  const events: AgentEvent[] = [];
  const timestamp = Date.now();

  switch (response.type) {
    case 'message':
      // Simple message response
      const messageId = generateId();
      events.push({
        id: generateId(),
        type: 'message_delta',
        timestamp,
        runId,
        payload: {
          messageId,
          delta: typeof response.payload === 'string'
            ? response.payload
            : JSON.stringify(response.payload),
          done: true,
        },
      });
      break;

    case 'component':
      // Component response - treat as artifact
      const artifact = extractArtifactFromPayload(response.payload, runId);
      if (artifact) {
        events.push({
          id: generateId(),
          type: 'artifact_proposed',
          timestamp,
          runId,
          payload: { artifact },
        });
      }
      break;

    case 'sdui-page':
      // SDUI page - convert to artifact
      if (response.sduiPage) {
        const sduiArtifact = convertSDUIToArtifact(response.sduiPage, runId);
        events.push({
          id: generateId(),
          type: 'artifact_proposed',
          timestamp,
          runId,
          payload: { artifact: sduiArtifact },
        });
      }
      break;

    case 'suggestion':
      // Suggestion - could be a clarify question
      if (Array.isArray(response.payload)) {
        events.push({
          id: generateId(),
          type: 'clarify_question',
          timestamp,
          runId,
          payload: {
            questionId: generateId(),
            question: 'Select an option:',
            options: response.payload.map((item: string, idx: number) => ({
              id: `opt_${idx}`,
              label: item,
              value: item,
            })),
            allowFreeform: true,
          },
        });
      }
      break;
  }

  return events;
}

/**
 * Extract artifact from component payload
 */
function extractArtifactFromPayload(payload: unknown, runId: string): Artifact | null {
  if (!payload || typeof payload !== 'object') return null;

  const p = payload as Record<string, unknown>;
  const timestamp = Date.now();

  // Try to detect artifact type from payload structure
  if ('valueDrivers' in p || 'totalValue' in p) {
    return {
      id: generateId(),
      type: 'value_model',
      title: (p.title as string) || 'Value Model',
      status: 'proposed',
      createdAt: timestamp,
      updatedAt: timestamp,
      content: {
        kind: 'json',
        data: p,
      },
      source: { agentRunId: runId },
    };
  }

  if ('roi' in p || 'npv' in p || 'projections' in p) {
    return {
      id: generateId(),
      type: 'financial_projection',
      title: (p.title as string) || 'Financial Projection',
      status: 'proposed',
      createdAt: timestamp,
      updatedAt: timestamp,
      content: {
        kind: 'json',
        data: p,
      },
      source: { agentRunId: runId },
    };
  }

  if ('markdown' in p || 'summary' in p || 'narrative' in p) {
    return {
      id: generateId(),
      type: 'executive_summary',
      title: (p.title as string) || 'Executive Summary',
      status: 'proposed',
      createdAt: timestamp,
      updatedAt: timestamp,
      content: {
        kind: 'markdown',
        markdown: (p.markdown as string) || (p.summary as string) || (p.narrative as string) || '',
      },
      source: { agentRunId: runId },
    };
  }

  // Generic artifact
  return {
    id: generateId(),
    type: 'narrative',
    title: (p.title as string) || 'Agent Output',
    status: 'proposed',
    createdAt: timestamp,
    updatedAt: timestamp,
    content: {
      kind: 'json',
      data: p,
    },
    source: { agentRunId: runId },
  };
}

/**
 * Convert SDUI page to artifact
 */
function convertSDUIToArtifact(sduiPage: unknown, runId: string): Artifact {
  const timestamp = Date.now();
  const page = sduiPage as Record<string, unknown>;

  return {
    id: generateId(),
    type: 'narrative',
    title: (page.title as string) || 'Generated Page',
    status: 'proposed',
    createdAt: timestamp,
    updatedAt: timestamp,
    content: {
      kind: 'json',
      data: page,
    },
    source: { agentRunId: runId },
  };
}

/**
 * Create error event
 */
export function createErrorEvent(
  error: Error | string,
  runId: string,
  recoverable = true
): AgentEvent {
  return {
    id: generateId(),
    type: 'error',
    timestamp: Date.now(),
    runId,
    payload: {
      code: 'API_ERROR',
      message: typeof error === 'string' ? error : error.message,
      recoverable,
      suggestions: recoverable
        ? ['Try again', 'Rephrase your request']
        : ['Contact support'],
    },
  };
}

/**
 * Create phase change event
 */
export function createPhaseChangeEvent(
  from: AgentPhase,
  to: AgentPhase,
  runId: string,
  reason?: string
): AgentEvent {
  return {
    id: generateId(),
    type: 'phase_changed',
    timestamp: Date.now(),
    runId,
    payload: { from, to, reason },
  };
}
