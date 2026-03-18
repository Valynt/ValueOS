/**
 * Reasoning Logger Middleware
 *
 * Captures agent reasoning steps and streams them to the frontend
 * AgentReasoningViewer via WebSocket, with PII scrubbing.
 */

import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../lib/logger.js';
import type { AgentMiddleware, AgentMiddlewareContext, AgentResponse, ExecutionEnvelope } from '../../types/orchestration.js';

import { PrivacyScrubber } from './PrivacyScrubber.js';
import type { ReasoningStep } from './types.js';

// ============================================================================
// ReasoningChain type (matches AgentReasoningViewer expectations)
// ============================================================================

export interface ThoughtNode {
  id: string;
  type: 'reasoning' | 'action' | 'observation' | 'decision' | 'tool_use';
  content: string;
  timestamp: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  children?: ThoughtNode[];
}

export interface ReasoningChain {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  sessionId: string;
  rootThought: string;
  nodes: ThoughtNode[];
  status: 'completed' | 'failed' | 'in_progress';
  startTime: string;
  endTime?: string;
  totalDuration?: number;
}

// ============================================================================
// Broadcast function type
// ============================================================================

export type BroadcastReasoningUpdate = (tenantId: string, chain: ReasoningChain) => void;

// ============================================================================
// ReasoningLoggerMiddleware
// ============================================================================

export class ReasoningLoggerMiddleware implements AgentMiddleware {
  public readonly name = 'reasoning_logger';

  private readonly scrubber: PrivacyScrubber;
  private readonly broadcast: BroadcastReasoningUpdate;

  constructor(broadcast: BroadcastReasoningUpdate, scrubber?: PrivacyScrubber) {
    this.broadcast = broadcast;
    this.scrubber = scrubber ?? new PrivacyScrubber();
  }

  async execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    const chainId = uuidv4();
    const startTime = new Date().toISOString();
    const tenantId = context.envelope.organizationId;

    // Build initial chain
    const chain: ReasoningChain = {
      id: chainId,
      agentId: context.agentType,
      agentName: context.agentType,
      agentRole: context.agentType,
      sessionId: context.sessionId,
      rootThought: `Processing query: ${this.scrubber.scrubText(context.query)}`,
      nodes: [],
      status: 'in_progress',
      startTime,
    };

    // Broadcast start
    this.safeBroadcast(tenantId, chain);

    // Inject reasoning callback into context metadata so agents can report steps
    if (!context.envelope) {
      context.envelope = {} as ExecutionEnvelope;
    }
    const originalMetadata = context.metadata ?? {};
    context.metadata = {
      ...originalMetadata,
      reasoningCallback: (step: ReasoningStep) => {
        const scrubbedContent = this.scrubber.scrubText(step.content);
        const node: ThoughtNode = {
          id: step.id ?? uuidv4(),
          type: step.type,
          content: scrubbedContent,
          timestamp: step.timestamp ?? new Date().toISOString(),
          confidence: step.confidence,
          metadata: step.metadata ? (this.scrubber.scrub(step.metadata) as Record<string, unknown>) : undefined,
        };
        chain.nodes.push(node);
        this.safeBroadcast(tenantId, { ...chain });
      },
    };

    try {
      const response = await next();

      // Extract reasoning steps from the response if available
      this.extractReasoningFromResponse(response, chain);

      // Mark completed
      const endTime = new Date().toISOString();
      chain.status = 'completed';
      chain.endTime = endTime;
      chain.totalDuration = new Date(endTime).getTime() - new Date(startTime).getTime();

      this.safeBroadcast(tenantId, chain);

      return response;
    } catch (error) {
      // Mark failed
      const endTime = new Date().toISOString();
      chain.status = 'failed';
      chain.endTime = endTime;
      chain.totalDuration = new Date(endTime).getTime() - new Date(startTime).getTime();

      // Add error node
      chain.nodes.push({
        id: uuidv4(),
        type: 'observation',
        content: `Error: ${this.scrubber.scrubText(error instanceof Error ? error.message : String(error))}`,
        timestamp: endTime,
      });

      this.safeBroadcast(tenantId, chain);

      throw error;
    }
  }

  /**
   * Extract reasoning steps from agent response payload if present.
   */
  private extractReasoningFromResponse(response: AgentResponse, chain: ReasoningChain): void {
    const payload = response.payload;
    if (!payload || typeof payload !== 'object') return;

    // Check for reasoning_steps or thought_chain fields
    const steps: unknown[] =
      (payload as Record<string, unknown>).reasoning_steps ??
      (payload as Record<string, unknown>).thought_chain ??
      (payload as Record<string, unknown>).reasoningSteps ??
      [];

    if (!Array.isArray(steps)) return;

    for (const step of steps) {
      if (typeof step === 'object' && step !== null) {
        const s = step as Record<string, unknown>;
        const node: ThoughtNode = {
          id: (s.id as string) ?? uuidv4(),
          type: (s.type as ThoughtNode['type']) ?? 'reasoning',
          content: this.scrubber.scrubText(String(s.content ?? s.text ?? '')),
          timestamp: (s.timestamp as string) ?? new Date().toISOString(),
          confidence: typeof s.confidence === 'number' ? s.confidence : undefined,
          metadata: s.metadata ? (this.scrubber.scrub(s.metadata) as Record<string, unknown>) : undefined,
        };
        chain.nodes.push(node);
      }
    }
  }

  private safeBroadcast(tenantId: string, chain: ReasoningChain): void {
    try {
      this.broadcast(tenantId, chain);
    } catch (error) {
      logger.warn('ReasoningLoggerMiddleware: broadcast failed', {
        chainId: chain.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
