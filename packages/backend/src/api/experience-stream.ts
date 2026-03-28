/**
 * Experience Streaming API — SSE Endpoint for Progress Directives
 *
 * GET /api/v1/experience/stream
 *
 * Server-Sent Events endpoint that streams progress directives to the client
 * during async agent execution. Enables real-time UI updates while agents run.
 *
 * Sprint 55: Real-time progress streaming implementation.
 */

import { logger } from "@shared/lib/logger";
import { Request, Response, Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { createBillingAccessEnforcement } from "../middleware/billingAccessEnforcement.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import { securityHeadersMiddleware } from "../middleware/securityMiddleware.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js";

import {
  getArtifactTransformerRegistry,
  type JourneyOrchestrator,
  type JourneyOrchestratorOutput,
} from "../services/bridging/index.js";
import { DEFAULT_EXPERIENCE_MODEL } from "@valueos/sdui";

const router: Router = Router();

// Standard middleware stack for streaming endpoints
router.use(securityHeadersMiddleware);
router.use(requireAuth);
router.use(tenantContextMiddleware());
router.use(tenantDbContextMiddleware());
router.use(createBillingAccessEnforcement());
router.use(requirePermission("agents:execute"));

// ── SSE Stream Schema ─────────────────────────────────────────────────

const StreamQuerySchema = z.object({
  opportunity_id: z.string().uuid(),
  value_case_id: z.string().uuid(),
  session_id: z.string().uuid(),
  // Optional: start from a specific saga state
  initial_saga_state: z
    .enum(["INITIATED", "DRAFTING", "VALIDATING", "COMPOSING", "REFINING", "FINALIZED"])
    .optional()
    .default("INITIATED"),
  // Optional: filter to specific agent
  agent_filter: z.string().optional(),
});

// ── Stream Event Types ────────────────────────────────────────────────

interface StreamEvent {
  event: "connected" | "ping" | "progress" | "artifact" | "phase_change" | "interrupt" | "complete" | "error";
  timestamp: string;
  data: unknown;
}

interface ProgressEventData {
  agent_name: string;
  activity_label: string;
  progress_pct: number | null;
  has_partial_result: boolean;
  eta_seconds: number | null;
  saga_state: string;
  workflow_status: string;
  partial_result?: Record<string, unknown>;
}

interface ArtifactEventData {
  slot_id: string;
  component: string;
  version: number;
  props: Record<string, unknown>;
  indicator: string;
  badge_value: number | null;
  lineage: {
    source_agent: string;
    trace_id: string | null;
    produced_at: string;
    grounding_score: number | null;
  };
}

interface PhaseChangeEventData {
  previous_phase: string;
  current_phase: string;
  phase_label: string;
  user_goal: string;
  can_lock: boolean;
}

interface InterruptEventData {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
  source_agent: string;
}

// ── Active Stream Registry ──────────────────────────────────────────

interface ActiveStream {
  session_id: string;
  organization_id: string;
  opportunity_id: string;
  value_case_id: string;
  response: Response;
  last_activity: Date;
  current_saga_state: string;
  current_workflow_status: string;
}

class StreamRegistry {
  private streams = new Map<string, ActiveStream>();

  register(stream: ActiveStream): void {
    this.streams.set(stream.session_id, stream);
    logger.info("Experience stream registered", {
      session_id: stream.session_id,
      opportunity_id: stream.opportunity_id,
    });
  }

  unregister(sessionId: string): void {
    const stream = this.streams.get(sessionId);
    if (stream) {
      this.streams.delete(sessionId);
      logger.info("Experience stream unregistered", {
        session_id: sessionId,
        opportunity_id: stream.opportunity_id,
      });
    }
  }

  get(sessionId: string): ActiveStream | undefined {
    return this.streams.get(sessionId);
  }

  getAllForOpportunity(opportunityId: string): ActiveStream[] {
    return Array.from(this.streams.values()).filter(
      (s) => s.opportunity_id === opportunityId
    );
  }

  updateActivity(sessionId: string): void {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.last_activity = new Date();
    }
  }

  // Cleanup stale streams (called periodically)
  cleanupStaleStreams(maxIdleMs: number = 5 * 60 * 1000): string[] {
    const now = new Date();
    const cleaned: string[] = [];

    for (const [sessionId, stream] of this.streams.entries()) {
      if (now.getTime() - stream.last_activity.getTime() > maxIdleMs) {
        this.streams.delete(sessionId);
        cleaned.push(sessionId);

        // End the response if still open
        try {
          if (!stream.response.writableEnded) {
            stream.response.end();
          }
        } catch {
          // Ignore errors during cleanup
        }
      }
    }

    if (cleaned.length > 0) {
      logger.info("Cleaned up stale experience streams", {
        count: cleaned.length,
        session_ids: cleaned,
      });
    }

    return cleaned;
  }
}

// Singleton registry
const streamRegistry = new StreamRegistry();

// Periodic cleanup (every 60 seconds)
setInterval(() => {
  streamRegistry.cleanupStaleStreams();
}, 60000);

// ── SSE Handler ───────────────────────────────────────────────────────

interface StreamRequest extends Request {
  tenantId?: string;
}

function streamHandler(req: StreamRequest, res: Response): void {
  const tenantId = req.tenantId;

  if (!tenantId) {
    res.status(401).json({
      error: "tenant_required",
      message: "Tenant context is required to stream experience updates",
    });
    return;
  }

  const parseResult = StreamQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      error: "validation_error",
      message:
        parseResult.error.issues[0]?.message ??
        "Invalid stream request parameters",
      details: parseResult.error.issues,
    });
    return;
  }

  const params = parseResult.data;

  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Send initial connection event
  sendEvent(res, {
    event: "connected",
    timestamp: new Date().toISOString(),
    data: {
      session_id: params.session_id,
      opportunity_id: params.opportunity_id,
      message: "Experience stream connected",
    },
  });

  // Register the stream
  const stream: ActiveStream = {
    session_id: params.session_id,
    organization_id: tenantId,
    opportunity_id: params.opportunity_id,
    value_case_id: params.value_case_id,
    response: res,
    last_activity: new Date(),
    current_saga_state: params.initial_saga_state,
    current_workflow_status: "pending",
  };
  streamRegistry.register(stream);

  // Handle client disconnect
  req.on("close", () => {
    streamRegistry.unregister(params.session_id);
  });

  req.on("error", (err) => {
    logger.error("Experience stream error", err instanceof Error ? err : undefined, {
      session_id: params.session_id,
      opportunity_id: params.opportunity_id,
    });
    streamRegistry.unregister(params.session_id);
  });

  // Keep-alive ping (every 30 seconds)
  const keepAliveInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(keepAliveInterval);
      return;
    }

    sendEvent(res, {
      event: "ping",
      timestamp: new Date().toISOString(),
      data: { timestamp: Date.now() },
    });

    streamRegistry.updateActivity(params.session_id);
  }, 30000);

  // Cleanup on response end
  res.on("finish", () => {
    clearInterval(keepAliveInterval);
    streamRegistry.unregister(params.session_id);
  });

  res.on("close", () => {
    clearInterval(keepAliveInterval);
    streamRegistry.unregister(params.session_id);
  });
}

// ── Event Broadcasting Utilities ────────────────────────────────────

function sendEvent(res: Response, event: StreamEvent): void {
  if (res.writableEnded) return;

  res.write(`event: ${event.event}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Broadcast a progress directive to all streams for an opportunity.
 * Called by agents during async execution to update the UI.
 */
function broadcastProgressDirective(
  opportunityId: string,
  directive: {
    agent_name: string;
    activity_label: string;
    progress_pct: number | null;
    has_partial_result: boolean;
    eta_seconds: number | null;
    partial_result?: Record<string, unknown>;
  },
  sagaState: string,
  workflowStatus: string
): void {
  const streams = streamRegistry.getAllForOpportunity(opportunityId);

  if (streams.length === 0) {
    // No active streams - directive is dropped (this is fine)
    return;
  }

  const event: StreamEvent = {
    event: "progress",
    timestamp: new Date().toISOString(),
    data: {
      agent_name: directive.agent_name,
      activity_label: directive.activity_label,
      progress_pct: directive.progress_pct,
      has_partial_result: directive.has_partial_result,
      eta_seconds: directive.eta_seconds,
      saga_state: sagaState,
      workflow_status: workflowStatus,
      partial_result: directive.partial_result,
    } satisfies ProgressEventData,
  };

  for (const stream of streams) {
    try {
      sendEvent(stream.response, event);
      streamRegistry.updateActivity(stream.session_id);
    } catch (err) {
      logger.warn("Failed to send progress directive to stream", {
        session_id: stream.session_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Broadcast a transformed artifact to all streams for an opportunity.
 * Called when an agent completes and produces a renderable artifact.
 */
function broadcastArtifact(
  opportunityId: string,
  artifact: {
    slot_id: string;
    component: string;
    version: number;
    props: Record<string, unknown>;
    indicator: string;
    badge_value: number | null;
    lineage: {
      source_agent: string;
      trace_id: string | null;
      produced_at: string;
      grounding_score: number | null;
    };
  }
): void {
  const streams = streamRegistry.getAllForOpportunity(opportunityId);

  const event: StreamEvent = {
    event: "artifact",
    timestamp: new Date().toISOString(),
    data: artifact satisfies ArtifactEventData,
  };

  for (const stream of streams) {
    try {
      sendEvent(stream.response, event);
      streamRegistry.updateActivity(stream.session_id);
    } catch (err) {
      logger.warn("Failed to send artifact to stream", {
        session_id: stream.session_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Broadcast a phase change to all streams for an opportunity.
 */
function broadcastPhaseChange(
  opportunityId: string,
  change: {
    previous_phase: string;
    current_phase: string;
    phase_label: string;
    user_goal: string;
    can_lock: boolean;
  }
): void {
  const streams = streamRegistry.getAllForOpportunity(opportunityId);

  const event: StreamEvent = {
    event: "phase_change",
    timestamp: new Date().toISOString(),
    data: change satisfies PhaseChangeEventData,
  };

  for (const stream of streams) {
    try {
      sendEvent(stream.response, event);
      stream.current_saga_state = change.current_phase;
      streamRegistry.updateActivity(stream.session_id);
    } catch (err) {
      logger.warn("Failed to send phase change to stream", {
        session_id: stream.session_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Broadcast an interrupt to all streams for an opportunity.
 */
function broadcastInterrupt(
  opportunityId: string,
  interrupt: {
    id: string;
    type: string;
    severity: "high" | "medium" | "low";
    message: string;
    source_agent: string;
  }
): void {
  const streams = streamRegistry.getAllForOpportunity(opportunityId);

  const event: StreamEvent = {
    event: "interrupt",
    timestamp: new Date().toISOString(),
    data: interrupt satisfies InterruptEventData,
  };

  for (const stream of streams) {
    try {
      sendEvent(stream.response, event);
      streamRegistry.updateActivity(stream.session_id);
    } catch (err) {
      logger.warn("Failed to send interrupt to stream", {
        session_id: stream.session_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Broadcast stream completion (all agents finished).
 */
function broadcastComplete(
  opportunityId: string,
  finalOutput?: JourneyOrchestratorOutput
): void {
  const streams = streamRegistry.getAllForOpportunity(opportunityId);

  const event: StreamEvent = {
    event: "complete",
    timestamp: new Date().toISOString(),
    data: {
      message: "All agents completed",
      final_phase: finalOutput?.phase.lifecycle_stage,
      can_lock: finalOutput?.can_lock,
    },
  };

  for (const stream of streams) {
    try {
      sendEvent(stream.response, event);
      // End the stream after completion
      stream.response.end();
    } catch (err) {
      logger.warn("Failed to send completion to stream", {
        session_id: stream.session_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Broadcast an error to all streams for an opportunity.
 */
function broadcastError(
  opportunityId: string,
  error: { message: string; code?: string; details?: unknown }
): void {
  const streams = streamRegistry.getAllForOpportunity(opportunityId);

  const event: StreamEvent = {
    event: "error",
    timestamp: new Date().toISOString(),
    data: error,
  };

  for (const stream of streams) {
    try {
      sendEvent(stream.response, event);
      stream.response.end();
    } catch (err) {
      // Ignore errors during error broadcast
    }
  }
}

// ── Routes ────────────────────────────────────────────────────────────

router.get(
  "/v1/experience/stream",
  rateLimiters.loose, // Looser limits for streaming
  streamHandler
);

export default router;

// Re-export broadcast functions for use by agents and orchestrators
export {
  broadcastProgressDirective,
  broadcastArtifact,
  broadcastPhaseChange,
  broadcastInterrupt,
  broadcastComplete,
  broadcastError,
  streamRegistry,
};
