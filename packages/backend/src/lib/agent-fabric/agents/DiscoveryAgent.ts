/**
 * DiscoveryAgent
 *
 * Thin orchestration layer for the discovery workflow. Coordinates OpportunityAgent
 * and supporting agents, normalizes outputs, and streams progress to the UI.
 */

import { randomUUID } from "crypto";

import { getDomainEventBus } from "../../../events/DomainEventBus.js";
import type {
  DiscoveryStartedPayload,
  DiscoveryProgressPayload,
  DiscoveryHypothesisAddedPayload,
  DiscoveryGraphUpdatedPayload,
  DiscoveryCompletedPayload,
  DiscoveryFailedPayload,
  DiscoveryCancelledPayload,
} from "../../../events/DomainEventSchemas.js";
import { OpportunityAgent } from "./OpportunityAgent.js";
import type { AgentOutput, LifecycleContext } from "../../../types/agent.js";
import { logger } from "../../logger.js";
import {
  ValueGraphService,
  valueGraphService as defaultValueGraphService,
} from "../../../services/value-graph/ValueGraphService.js";
import { BaseGraphWriter } from "../BaseGraphWriter.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { createCronSupabaseClient } from "../../supabase/privileged/cron.js";
import type { VgValueDriverType } from "@valueos/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiscoveryStatus =
  | "started"
  | "enriching"
  | "validating"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled";

export interface DiscoveryRun {
  runId: string;
  organizationId: string;
  valueCaseId: string;
  status: DiscoveryStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
  cancellationToken?: { cancelled: boolean };
}

export interface DiscoveryHypothesis {
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedImpact: {
    low: number;
    high: number;
    unit: string;
    timeframeMonths: number;
  };
  confidence: number;
  evidence: string[];
  assumptions: string[];
}

// ---------------------------------------------------------------------------
// DiscoveryRunStore — persists run state to workflow_executions
//
// Keeps a process-local cache for fast reads (getRunState) while writing
// every mutation to Supabase so state survives restarts and is visible
// across instances. The cancellationToken is local-only (not persisted)
// because cancellation is a best-effort in-process signal.
// ---------------------------------------------------------------------------

class DiscoveryRunStore {
  /** Process-local cache for fast reads and cancellation tokens. */
  private readonly cache = new Map<string, DiscoveryRun>();

  async save(run: DiscoveryRun): Promise<void> {
    this.cache.set(run.runId, run);
    try {
      const supabase = createCronSupabaseClient({
        justification: "service-role:justified discovery run state persistence for background workflow",
      });
      const { error } = await supabase.from("workflow_executions").upsert({
        id: run.runId,
        tenant_id: run.organizationId,
        organization_id: run.organizationId,
        status: run.status,
        started_at: run.startedAt,
        completed_at: run.completedAt ?? null,
        error_message: run.error ?? null,
        metadata: {
          type: "discovery_run",
          valueCaseId: run.valueCaseId,
        },
      });
      if (error) {
        logger.warn("DiscoveryRunStore: failed to persist run", {
          runId: run.runId,
          error: error.message,
        });
      }
    } catch (err) {
      logger.warn("DiscoveryRunStore: persistence error", {
        runId: run.runId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async get(runId: string): Promise<DiscoveryRun | undefined> {
    // Return from cache first (includes cancellationToken)
    const cached = this.cache.get(runId);
    if (cached) return cached;

    // Fall back to Supabase for runs started on another instance
    try {
      const supabase = createCronSupabaseClient({
        justification: "service-role:justified discovery run state persistence for background workflow",
      });
      const { data, error } = await supabase
        .from("workflow_executions")
        .select("id, tenant_id, status, started_at, completed_at, error_message, metadata")
        .eq("id", runId)
        .maybeSingle();

      if (error || !data) return undefined;

      const run: DiscoveryRun = {
        runId: data.id as string,
        organizationId: data.tenant_id as string,
        valueCaseId: (data.metadata as Record<string, unknown>)?.valueCaseId as string ?? "",
        status: data.status as DiscoveryStatus,
        startedAt: data.started_at as string,
        completedAt: data.completed_at as string | undefined,
        error: data.error_message as string | undefined,
        // cancellationToken is not persisted — cross-instance cancellation
        // must be handled via a shared signal (e.g. Redis or DB flag).
      };
      this.cache.set(runId, run);
      return run;
    } catch (err) {
      logger.warn("DiscoveryRunStore: failed to fetch run from DB", {
        runId,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }
}

const discoveryRunStore = new DiscoveryRunStore();

// ---------------------------------------------------------------------------
// DiscoveryAgent
// ---------------------------------------------------------------------------

export class DiscoveryAgent {
  private readonly valueGraphService: ValueGraphService;
  private readonly graphWriter: BaseGraphWriter;

  constructor(
    valueGraphService?: ValueGraphService,
    graphWriter?: BaseGraphWriter
  ) {
    this.valueGraphService = valueGraphService ?? defaultValueGraphService;
    this.graphWriter = graphWriter ?? new BaseGraphWriter();
  }

  /**
   * Start a new discovery run. Emits discovery.started and begins orchestration.
   */
  async startDiscovery(params: {
    organizationId: string;
    valueCaseId: string;
    companyName: string;
    industryContext?: string;
  }): Promise<{ runId: string }> {
    const runId = `discovery_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const run: DiscoveryRun = {
      runId,
      organizationId: params.organizationId,
      valueCaseId: params.valueCaseId,
      status: "started",
      startedAt: new Date().toISOString(),
      cancellationToken: { cancelled: false },
    };

    await discoveryRunStore.save(run);

    // Emit started event
    const bus = getDomainEventBus();
    const startedPayload: DiscoveryStartedPayload = {
      id: randomUUID(),
      emittedAt: new Date().toISOString(),
      traceId: runId,
      tenantId: params.organizationId,
      actorId: "system",
      runId,
      valueCaseId: params.valueCaseId,
      companyName: params.companyName,
    };
    await bus.publish("discovery.started", startedPayload);

    // Begin orchestration asynchronously
    this.executeDiscoveryWorkflow(run, params).catch((err) => {
      logger.error("DiscoveryAgent: workflow failed", {
        runId,
        error: err instanceof Error ? err.message : String(err),
      });
      this.failRun(runId, err);
    });

    return { runId };
  }

  /**
   * Cancel an in-progress discovery run.
   */
  async cancelDiscovery(runId: string): Promise<void> {
    const run = await discoveryRunStore.get(runId);
    if (!run) {
      throw new Error(`Discovery run not found: ${runId}`);
    }

    if (run.cancellationToken) {
      run.cancellationToken.cancelled = true;
    }
    run.status = "cancelled";
    run.completedAt = new Date().toISOString();
    await discoveryRunStore.save(run);

    const bus = getDomainEventBus();
    const cancelledPayload: DiscoveryCancelledPayload = {
      id: randomUUID(),
      emittedAt: new Date().toISOString(),
      traceId: runId,
      tenantId: run.organizationId,
      actorId: "system",
      runId,
      reason: "user_cancelled",
    };
    await bus.publish("discovery.cancelled", cancelledPayload);

    logger.info("DiscoveryAgent: run cancelled", { runId });
  }

  /**
   * Get the current state of a discovery run.
   * Checks the process-local cache first, then falls back to Supabase.
   */
  async getRunState(runId: string): Promise<DiscoveryRun | undefined> {
    return discoveryRunStore.get(runId);
  }

  /**
   * Execute the discovery workflow.
   */
  private async executeDiscoveryWorkflow(
    run: DiscoveryRun,
    params: {
      organizationId: string;
      valueCaseId: string;
      companyName: string;
      industryContext?: string;
    }
  ): Promise<void> {
    const { runId, cancellationToken } = run;
    const { organizationId, valueCaseId, companyName, industryContext } = params;

    try {
      // Step 1: Ingest input
      await this.emitProgress(runId, organizationId, {
        step: "ingesting",
        message: `Starting discovery for ${companyName}...`,
        progressPercent: 5,
      });

      if (cancellationToken?.cancelled) {
        return;
      }

      // Step 2: Generate hypotheses via OpportunityAgent
      await this.emitProgress(runId, organizationId, {
        step: "generating_hypotheses",
        message: "Generating value hypotheses...",
        progressPercent: 20,
      });

      const opportunityOutput = await this.runOpportunityPhase(
        organizationId,
        valueCaseId,
        companyName,
        industryContext
      );

      if (cancellationToken?.cancelled) {
        return;
      }

      // Extract hypotheses from agent output
      const hypotheses = this.extractHypotheses(opportunityOutput);

      // Step 3: Enrichment phase
      await this.emitProgress(runId, organizationId, {
        step: "enriching",
        message: "Enriching with domain context...",
        progressPercent: 40,
        hypothesesFound: hypotheses.length,
      });

      // Step 4: Validation phase
      await this.emitProgress(runId, organizationId, {
        step: "validating",
        message: "Validating hypotheses...",
        progressPercent: 60,
      });

      if (cancellationToken?.cancelled) {
        return;
      }

      // Step 5: Write to Value Graph
      await this.emitProgress(runId, organizationId, {
        step: "writing_graph",
        message: "Persisting to Value Graph...",
        progressPercent: 80,
      });

      const graphNodesWritten = await this.writeHypothesesToGraph(
        organizationId,
        valueCaseId,
        hypotheses
      );

      // Step 6: Finalize
      await this.emitProgress(runId, organizationId, {
        step: "finalizing",
        message: "Discovery complete",
        progressPercent: 100,
        graphNodesWritten,
      });

      // Mark completed
      run.status = "completed";
      run.completedAt = new Date().toISOString();
      await discoveryRunStore.save(run);

      // Emit completed event
      const bus = getDomainEventBus();
      const completedPayload: DiscoveryCompletedPayload = {
        id: randomUUID(),
        emittedAt: new Date().toISOString(),
        traceId: runId,
        tenantId: organizationId,
        actorId: "system",
        runId,
        valueCaseId,
        hypothesesFound: hypotheses.length,
        graphNodesWritten,
      };
      await bus.publish("discovery.completed", completedPayload);

      logger.info("DiscoveryAgent: workflow completed", {
        runId,
        hypothesesFound: hypotheses.length,
        graphNodesWritten,
      });
    } catch (error) {
      await this.failRun(
        runId,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Run the OpportunityAgent to generate hypotheses.
   */
  private async runOpportunityPhase(
    organizationId: string,
    opportunityId: string,
    companyName: string,
    industryContext?: string
  ): Promise<AgentOutput> {
    // Create fresh OpportunityAgent instance for this run
    const memorySystem = new MemorySystem({
      max_memories: 1000,
      enable_persistence: true,
    });
    const llmGateway = new LLMGateway({
      provider: "together",
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    });
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
    });

    const opportunityAgent = new OpportunityAgent(
      {
        id: "opportunity",
        name: "opportunity",
        type: "opportunity",
        lifecycle_stage: "discovery",
        capabilities: [],
        model: {
          provider: "openai",
          model_name: "gpt-4",
        },
        prompts: {
          // OpportunityAgent resolves these via PromptRegistry by key.
          system_prompt: "opportunity.system.base",
          user_prompt_template: "opportunity.user.analysis-request",
        },
        parameters: {
          timeout_seconds: 60,
          max_retries: 3,
          retry_delay_ms: 1000,
          enable_caching: true,
          enable_telemetry: true,
        },
        constraints: {
          max_input_tokens: 4000,
          max_output_tokens: 2000,
          allowed_actions: [],
          forbidden_actions: [],
          required_permissions: [],
        },
        metadata: { version: "1.0.0" },
      },
      organizationId,
      memorySystem,
      llmGateway,
      circuitBreaker
    );

    const context: LifecycleContext = {
      workspace_id: opportunityId,
      organization_id: organizationId,
      user_id: "system",
      lifecycle_stage: "discovery",
      workspace_data: {},
      user_inputs: {
        query: companyName,
        industry_context: industryContext,
      },
    };

    // OpportunityAgent owns the reasoning
    const output = await opportunityAgent.execute(context);

    // Emit hypothesis.added events for each hypothesis
    const bus = getDomainEventBus();
    const hypotheses = this.extractHypotheses(output);

    for (const hypothesis of hypotheses) {
      const hypothesisPayload: DiscoveryHypothesisAddedPayload = {
        id: randomUUID(),
        emittedAt: new Date().toISOString(),
        traceId: opportunityId,
        tenantId: organizationId,
        actorId: "system",
        valueCaseId: opportunityId,
        hypothesisId: hypothesis.id,
        title: hypothesis.title,
        category: hypothesis.category,
        confidence: hypothesis.confidence,
      };
      await bus.publish("discovery.hypothesis.added", hypothesisPayload);
    }

    return output;
  }

  /**
   * Extract hypotheses from AgentOutput data.
   */
  private extractHypotheses(output: AgentOutput): DiscoveryHypothesis[] {
    const data = output.data as Record<string, unknown> | undefined;
    if (!data) return [];

    const hypotheses = data.hypotheses as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(hypotheses)) return [];

    return hypotheses.map((h, index) => ({
      id: (h.id as string) || `hypothesis_${index}`,
      title: (h.title as string) || "Untitled Hypothesis",
      description: (h.description as string) || "",
      category: (h.category as string) || "other",
      estimatedImpact: {
        low: (h.estimated_impact as Record<string, number>)?.low ?? 0,
        high: (h.estimated_impact as Record<string, number>)?.high ?? 0,
        unit: (h.estimated_impact as Record<string, string>)?.unit ?? "usd",
        timeframeMonths: (h.estimated_impact as Record<string, number>)?.timeframe_months ?? 12,
      },
      confidence: (h.confidence as number) ?? 0.5,
      evidence: Array.isArray(h.evidence) ? h.evidence.map(String) : [],
      assumptions: Array.isArray(h.assumptions) ? h.assumptions.map(String) : [],
    }));
  }

  /**
   * Write hypotheses to the Value Graph.
   */
  private async writeHypothesesToGraph(
    organizationId: string,
    opportunityId: string,
    hypotheses: DiscoveryHypothesis[]
  ): Promise<number> {
    let nodesWritten = 0;

    for (const hypothesis of hypotheses) {
      try {
        // Build a context for graph writer
        const context: LifecycleContext = {
          workspace_id: opportunityId,
          organization_id: organizationId,
          user_id: "system",
          lifecycle_stage: "discovery",
          workspace_data: {},
          user_inputs: {},
        };

        // Write ValueDriver node for each hypothesis
        // Map category to a valid VgValueDriver type
        const driverType = mapCategoryToDriverType(hypothesis.category);

        await this.graphWriter.writeValueDriver(context, {
          type: driverType,
          name: hypothesis.title,
          description: hypothesis.description,
          estimated_impact_usd: hypothesis.estimatedImpact?.high ?? 0,
        });

        nodesWritten++;

        // Emit graph.updated event
        const bus = getDomainEventBus();
        const graphPayload: DiscoveryGraphUpdatedPayload = {
          id: randomUUID(),
          emittedAt: new Date().toISOString(),
          traceId: opportunityId,
          tenantId: organizationId,
          actorId: "system",
          opportunityId,
          nodeType: "value_driver",
          nodeId: hypothesis.id,
          operation: "upsert",
        };
        await bus.publish("discovery.graph.updated", graphPayload);
      } catch (err) {
        logger.warn("DiscoveryAgent: failed to write hypothesis to graph", {
          hypothesisId: hypothesis.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return nodesWritten;
  }

  /**
   * Emit a discovery.progress event.
   */
  private async emitProgress(
    runId: string,
    organizationId: string,
    progress: Omit<DiscoveryProgressPayload, 'id' | 'emittedAt' | 'traceId' | 'tenantId' | 'actorId' | 'runId'>
  ): Promise<void> {
    const bus = getDomainEventBus();
    const payload: DiscoveryProgressPayload = {
      id: randomUUID(),
      emittedAt: new Date().toISOString(),
      traceId: runId,
      tenantId: organizationId,
      actorId: "system",
      runId,
      step: progress.step,
      message: progress.message,
      progressPercent: progress.progressPercent,
      hypothesesFound: progress.hypothesesFound,
      graphNodesWritten: progress.graphNodesWritten,
    };
    await bus.publish("discovery.progress", payload);
  }

  /**
   * Mark a run as failed and emit discovery.failed event.
   */
  private async failRun(runId: string, error: Error): Promise<void> {
    const run = await discoveryRunStore.get(runId);
    if (!run) return;

    run.status = "failed";
    run.error = error.message;
    run.completedAt = new Date().toISOString();
    await discoveryRunStore.save(run);

    const bus = getDomainEventBus();
    const failedPayload: DiscoveryFailedPayload = {
      id: randomUUID(),
      emittedAt: new Date().toISOString(),
      traceId: runId,
      tenantId: run.organizationId,
      actorId: "system",
      runId,
      valueCaseId: run.valueCaseId,
      error: error.message,
    };
    await bus.publish("discovery.failed", failedPayload);

    logger.error("DiscoveryAgent: run failed", {
      runId,
      error: error.message,
    });
  }
}

/**
 * Map hypothesis category to Value Driver type.
 */
function mapCategoryToDriverType(category: string): VgValueDriverType {
  const mapping: Record<string, VgValueDriverType> = {
    revenue_growth: "revenue_growth",
    cost_reduction: "cost_reduction",
    risk_mitigation: "risk_mitigation",
    operational_efficiency: "capital_efficiency",
    strategic_advantage: "capital_efficiency",
  };
  return mapping[category] ?? "capital_efficiency";
}

// Singleton instance for use by the API layer
let discoveryAgentInstance: DiscoveryAgent | null = null;

export function getDiscoveryAgent(): DiscoveryAgent {
  if (!discoveryAgentInstance) {
    discoveryAgentInstance = new DiscoveryAgent();
  }
  return discoveryAgentInstance;
}
