import { STRUCTURAL_TRUTH_SCHEMA_FIELDS, StructuralTruthModuleSchema } from "@mcp/ground-truth/modules/StructuralTruthModule";
import { assertProvenance, validateGroundTruthMetadata } from "@mcp/ground-truth/validators/GroundTruthValidator";

import { logger } from "../../lib/logger";
import { AgentType } from "../agent-types";
import type { AgentContext, AgentAPI } from "../AgentAPI";
import type { IntegrityVetoMetadata } from "../../types/orchestration.js";

export interface IntegrityCheckOptions {
  traceId: string;
  agentType: AgentType;
  query?: string;
  stageId?: string;
  context?: AgentContext;
}

export interface IntegrityVetoService {
  evaluateIntegrityVeto(payload: unknown, options: IntegrityCheckOptions): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata; reRefine?: boolean }>;
  evaluateStructuralTruthVeto(payload: unknown, options: IntegrityCheckOptions): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata }>;
  performReRefine(
    agentType: AgentType,
    originalQuery: string,
    agentContext: AgentContext,
    traceId: string,
    maxAttempts?: number
  ): Promise<{ success: boolean; response?: unknown; attempts: number }>;
}

export class DefaultIntegrityVetoService implements IntegrityVetoService {
  constructor(
    private readonly deps: {
      agentAPI: AgentAPI;
      evaluateClaim: (metricId: string, claimedValue: number, options: IntegrityCheckOptions) => Promise<{ benchmarkValue?: number; warning?: string }>;
      getAverageConfidence: (agentType: AgentType) => Promise<number>;
      logVeto: (agentType: AgentType, query: string, payload: unknown, options: IntegrityCheckOptions, metadata: IntegrityVetoMetadata) => Promise<void>;
      invokeRefinement: (agentType: AgentType, prompt: string, context: AgentContext, attempt: number) => Promise<{ success: boolean; data?: unknown }>;
      maxReRefineAttempts: number;
    }
  ) {}

  async evaluateIntegrityVeto(payload: unknown, options: IntegrityCheckOptions): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata; reRefine?: boolean }> {
    try {
      if (typeof payload === "object" && payload !== null && "metadata" in payload) {
        const metadata = (payload as { metadata?: unknown }).metadata;
        if (metadata) {
          validateGroundTruthMetadata(metadata);
          assertProvenance(metadata);
        }
      }
    } catch (error) {
      logger.warn("Ground truth metadata validation failed", { traceId: options.traceId, error });
    }

    const confidence = await this.deps.getAverageConfidence(options.agentType).catch(() => 1);
    if (confidence < 0.85) {
      return { vetoed: false, reRefine: true };
    }

    const claims = this.extractNumericClaims(payload);
    let vetoMetadata: IntegrityVetoMetadata | undefined;

    for (const claim of claims) {
      const validation = await this.deps.evaluateClaim(claim.metricId, claim.claimedValue, options).catch(() => ({}));
      const benchmarkValue = validation.benchmarkValue;
      if (!benchmarkValue) continue;
      const deviationPercent = (Math.abs(claim.claimedValue - benchmarkValue) / Math.abs(benchmarkValue)) * 100;
      if (deviationPercent > 15 && (!vetoMetadata || deviationPercent > vetoMetadata.deviationPercent)) {
        vetoMetadata = {
          integrityVeto: true,
          deviationPercent,
          benchmark: benchmarkValue,
          metricId: claim.metricId,
          claimedValue: claim.claimedValue,
          warning: validation.warning,
        };
      }
    }

    if (!vetoMetadata) return { vetoed: false };
    await this.deps.logVeto(options.agentType, options.query ?? "agent-output-veto", payload, options, vetoMetadata);
    return { vetoed: true, metadata: vetoMetadata };
  }

  async evaluateStructuralTruthVeto(payload: unknown, options: IntegrityCheckOptions): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata }> {
    const validation = StructuralTruthModuleSchema.safeParse(payload);
    if (validation.success) return { vetoed: false };
    const deviationPercent = Math.min(100, (validation.error.issues.length / Math.max(1, STRUCTURAL_TRUTH_SCHEMA_FIELDS.length)) * 100);
    if (deviationPercent <= 15) return { vetoed: false };
    const metadata: IntegrityVetoMetadata = {
      integrityVeto: true,
      deviationPercent,
      benchmark: 15,
      metricId: "structural_truth_schema",
      claimedValue: deviationPercent,
      warning: validation.error.issues.slice(0, 3).map((i) => i.message).join("; ") || "Structural truth schema deviation exceeded threshold.",
    };
    await this.deps.logVeto(options.agentType, options.query ?? "structural-truth-veto", payload, options, metadata);
    return { vetoed: true, metadata };
  }

  async performReRefine(agentType: AgentType, originalQuery: string, agentContext: AgentContext, traceId: string, maxAttempts = this.deps.maxReRefineAttempts): Promise<{ success: boolean; response?: unknown; attempts: number }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const refinePrompt = `${originalQuery}\n\nREFINE: grounded rerun. Attempt: ${attempt}`;
      const response = await this.deps.invokeRefinement(agentType, refinePrompt, agentContext, attempt).catch(() => ({ success: false }));
      if (!response.success) continue;
      const structural = await this.evaluateStructuralTruthVeto(response.data, { traceId, agentType, query: originalQuery, context: agentContext });
      if (structural.vetoed) continue;
      const integrity = await this.evaluateIntegrityVeto(response.data, { traceId, agentType, query: originalQuery, context: agentContext });
      if (!integrity.vetoed && !integrity.reRefine) return { success: true, response, attempts: attempt };
    }
    return { success: false, attempts: maxAttempts };
  }

  private extractNumericClaims(payload: unknown): Array<{ metricId: string; claimedValue: number }> {
    const claims: Array<{ metricId: string; claimedValue: number }> = [];
    const addFromItem = (item: Record<string, unknown>) => {
      const metricId = String(item.metricId ?? item.metric_id ?? item.kpi_id ?? item.metric ?? item.id ?? "");
      if (!metricId) return;
      const claimedValue = this.normalizeNumericValue(item.claimedValue ?? item.claimed_value ?? item.value ?? item.amount ?? item.delta ?? item.metric_value);
      if (claimedValue === null) return;
      claims.push({ metricId, claimedValue });
    };
    const addFromList = (list: unknown) => {
      if (!Array.isArray(list)) return;
      for (const entry of list) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) addFromItem(entry as Record<string, unknown>);
      }
    };
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      addFromList(record.economic_deltas ?? record.economicDeltas);
      addFromList(record.metrics);
      addFromList(record.claims);
    }
    return claims;
  }

  private normalizeNumericValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[%,$]/g, ""));
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  }
}
