import { randomUUID } from "node:crypto";

import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createLogger } from "../../lib/logger.js";
import { supabase as supabaseClient } from "../../lib/supabase.js";

const logger = createLogger({ component: "DiffExplainabilityService" });

const DiffEntityTypeSchema = z.enum(["claim", "evidence_link", "policy_check", "approval", "outcome"]);

const DiffReasonSchema = z.enum(["policy", "evidence", "input", "owner", "unknown"]);

const DiffChangeTypeSchema = z.enum(["added", "removed", "modified"]);

export const DiffExplainabilityItemSchema = z.object({
  id: z.string(),
  change_type: DiffChangeTypeSchema,
  entity_type: DiffEntityTypeSchema,
  entity_key: z.string(),
  what_changed: z.string(),
  why_changed: DiffReasonSchema,
  confidence_impact: z.object({
    delta: z.number().min(-1).max(1),
    direction: z.enum(["increased", "decreased", "neutral"]),
    rationale: z.string(),
  }),
  expected_business_impact: z.object({
    direction: z.enum(["positive", "negative", "mixed", "neutral"]),
    magnitude: z.enum(["low", "medium", "high"]),
    rationale: z.string(),
  }),
  semantic_similarity: z.number().min(0).max(1),
  structural_change_score: z.number().min(0).max(1),
  source: z.object({
    comparison_axis: z.enum(["run_output", "decision_path"]),
    left_pointer: z.string().optional(),
    right_pointer: z.string().optional(),
  }),
  metadata: z.record(z.unknown()).default({}),
});

export const DiffNarrativeSummarySchema = z.object({
  executive_summary: z.string(),
  auditor_summary: z.string(),
  top_changes: z.array(z.string()),
  counts_by_entity: z.record(z.number()),
  counts_by_reason: z.record(z.number()),
});

export const DiffMachinePayloadSchema = z.object({
  schema_version: z.literal(1),
  compared: z.object({
    run_a_id: z.string(),
    run_b_id: z.string(),
    human_decision_path_id: z.string(),
    agent_decision_path_id: z.string(),
  }),
  generated_at: z.string().datetime(),
  diffs: z.array(DiffExplainabilityItemSchema),
  aggregates: z.object({
    total_items: z.number().int().nonnegative(),
    semantic_change_mean: z.number().min(0).max(1),
    structural_change_mean: z.number().min(0).max(1),
    confidence_delta_net: z.number().min(-100).max(100),
  }),
});

export const DiffSnapshotSchema = z.object({
  id: z.string().uuid(),
  stable_id: z.string(),
  organization_id: z.string().uuid(),
  case_id: z.string().uuid().nullable(),
  run_a_id: z.string(),
  run_b_id: z.string(),
  human_decision_path_id: z.string(),
  agent_decision_path_id: z.string(),
  diff_payload: DiffMachinePayloadSchema,
  narrative_summary: DiffNarrativeSummarySchema,
  references: z.array(z.object({
    type: z.enum(["handoff_card", "approval_inbox_record"]),
    id: z.string(),
  })),
  created_by_user_id: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type DiffExplainabilityItem = z.infer<typeof DiffExplainabilityItemSchema>;
export type DiffMachinePayload = z.infer<typeof DiffMachinePayloadSchema>;
export type DiffNarrativeSummary = z.infer<typeof DiffNarrativeSummarySchema>;
export type DiffSnapshot = z.infer<typeof DiffSnapshotSchema>;

type ComparedEntity = {
  id: string;
  type: z.infer<typeof DiffEntityTypeSchema>;
  key: string;
  content: string;
  raw: Record<string, unknown>;
  pointer: string;
};

export interface BuildDiffSnapshotInput {
  organizationId: string;
  caseId?: string;
  runA: { id: string; output: Record<string, unknown> };
  runB: { id: string; output: Record<string, unknown> };
  humanDecisionPath: { id: string; payload: Record<string, unknown> };
  agentDecisionPath: { id: string; payload: Record<string, unknown> };
  references?: Array<{ type: "handoff_card" | "approval_inbox_record"; id: string }>;
  createdByUserId?: string;
}

export class DiffExplainabilityService {
  constructor(private readonly supabase: SupabaseClient = DiffExplainabilityService.requireSupabase()) {}

  private static requireSupabase(): SupabaseClient {
    if (!supabaseClient) {
      throw new Error("DiffExplainabilityService requires Supabase to be configured");
    }
    return supabaseClient;
  }

  async createSnapshot(input: BuildDiffSnapshotInput): Promise<DiffSnapshot> {
    const runDiffs = this.compareNormalizedSets(
      this.normalizeEntities(input.runA.output, "run_output", "runA"),
      this.normalizeEntities(input.runB.output, "run_output", "runB")
    );

    const decisionPathDiffs = this.compareNormalizedSets(
      this.normalizeEntities(input.humanDecisionPath.payload, "decision_path", "human"),
      this.normalizeEntities(input.agentDecisionPath.payload, "decision_path", "agent")
    );

    const allDiffs = [...runDiffs, ...decisionPathDiffs];
    const payload = this.buildMachinePayload(input, allDiffs);
    const narrative = this.buildNarrativeSummary(payload);
    const stableId = this.generateStableId();

    const insertRecord = {
      stable_id: stableId,
      organization_id: input.organizationId,
      case_id: input.caseId ?? null,
      run_a_id: input.runA.id,
      run_b_id: input.runB.id,
      human_decision_path_id: input.humanDecisionPath.id,
      agent_decision_path_id: input.agentDecisionPath.id,
      diff_payload: payload,
      narrative_summary: narrative,
      references_json: input.references ?? [],
      created_by_user_id: input.createdByUserId ?? null,
    };

    const { data, error } = await this.supabase
      .from("diff_explainability_snapshots")
      .insert(insertRecord)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to persist diff explainability snapshot: ${error?.message}`);
    }

    logger.info("Diff explainability snapshot created", {
      snapshotId: data.id,
      stableId,
      organizationId: input.organizationId,
      caseId: input.caseId,
      diffCount: allDiffs.length,
    });

    return DiffSnapshotSchema.parse({
      ...data,
      references: Array.isArray(data.references_json) ? data.references_json : [],
    });
  }

  async getSnapshotByStableId(organizationId: string, stableId: string): Promise<DiffSnapshot | null> {
    const { data, error } = await this.supabase
      .from("diff_explainability_snapshots")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("stable_id", stableId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load diff explainability snapshot: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return DiffSnapshotSchema.parse({
      ...data,
      references: Array.isArray(data.references_json) ? data.references_json : [],
    });
  }

  private normalizeEntities(
    payload: Record<string, unknown>,
    comparisonAxis: "run_output" | "decision_path",
    sideLabel: string
  ): ComparedEntity[] {
    const buckets = [
      { key: "claims", type: "claim" as const },
      { key: "evidence_links", type: "evidence_link" as const },
      { key: "policy_checks", type: "policy_check" as const },
      { key: "approvals", type: "approval" as const },
      { key: "outcomes", type: "outcome" as const },
    ];

    const entities: ComparedEntity[] = [];

    for (const bucket of buckets) {
      const items = payload[bucket.key];
      if (!Array.isArray(items)) {
        continue;
      }

      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || typeof item !== "object") {
          continue;
        }

        const raw = item as Record<string, unknown>;
        const keyValue = this.firstDefinedString(raw, ["id", "key", "name", "title", "slug"])
          ?? `${bucket.type}:${i}`;
        const content = this.stringifyCompact(raw);

        entities.push({
          id: `${sideLabel}:${bucket.type}:${i}`,
          type: bucket.type,
          key: keyValue.toLowerCase(),
          content,
          raw,
          pointer: `${comparisonAxis}.${sideLabel}.${bucket.key}[${i}]`,
        });
      }
    }

    return entities;
  }

  private compareNormalizedSets(left: ComparedEntity[], right: ComparedEntity[]): DiffExplainabilityItem[] {
    const leftByKey = new Map<string, ComparedEntity>(left.map((entry) => [this.entityFingerprint(entry), entry]));
    const rightByKey = new Map<string, ComparedEntity>(right.map((entry) => [this.entityFingerprint(entry), entry]));

    const keys = new Set([...leftByKey.keys(), ...rightByKey.keys()]);
    const diffs: DiffExplainabilityItem[] = [];

    for (const key of keys) {
      const leftEntity = leftByKey.get(key);
      const rightEntity = rightByKey.get(key);

      if (leftEntity && !rightEntity) {
        diffs.push(this.buildDiff("removed", leftEntity, undefined));
        continue;
      }

      if (!leftEntity && rightEntity) {
        diffs.push(this.buildDiff("added", undefined, rightEntity));
        continue;
      }

      if (leftEntity && rightEntity && leftEntity.content !== rightEntity.content) {
        diffs.push(this.buildDiff("modified", leftEntity, rightEntity));
      }
    }

    return diffs;
  }

  private buildDiff(
    changeType: z.infer<typeof DiffChangeTypeSchema>,
    leftEntity?: ComparedEntity,
    rightEntity?: ComparedEntity
  ): DiffExplainabilityItem {
    const entity = rightEntity ?? leftEntity;
    if (!entity) {
      throw new Error("Cannot build diff without an entity");
    }

    const semanticSimilarity = this.semanticSimilarity(leftEntity?.content ?? "", rightEntity?.content ?? "");
    const structuralChangeScore = this.structuralChangeScore(leftEntity?.raw ?? {}, rightEntity?.raw ?? {});
    const reason = this.inferChangeReason(leftEntity?.raw ?? {}, rightEntity?.raw ?? {});

    const confidenceDelta = this.inferConfidenceImpact(changeType, reason, semanticSimilarity, structuralChangeScore);
    const expectedBusinessImpact = this.inferBusinessImpact(changeType, reason, entity.type, confidenceDelta.delta);

    return {
      id: randomUUID(),
      change_type: changeType,
      entity_type: entity.type,
      entity_key: entity.key,
      what_changed: this.describeChange(changeType, leftEntity, rightEntity),
      why_changed: reason,
      confidence_impact: confidenceDelta,
      expected_business_impact: expectedBusinessImpact,
      semantic_similarity: semanticSimilarity,
      structural_change_score: structuralChangeScore,
      source: {
        comparison_axis: entity.pointer.startsWith("run_output") ? "run_output" : "decision_path",
        left_pointer: leftEntity?.pointer,
        right_pointer: rightEntity?.pointer,
      },
      metadata: {
        left_keys: leftEntity ? Object.keys(leftEntity.raw) : [],
        right_keys: rightEntity ? Object.keys(rightEntity.raw) : [],
      },
    };
  }

  private buildMachinePayload(input: BuildDiffSnapshotInput, diffs: DiffExplainabilityItem[]): DiffMachinePayload {
    const semanticMean = diffs.length > 0 ? diffs.reduce((sum, d) => sum + d.semantic_similarity, 0) / diffs.length : 1;
    const structuralMean =
      diffs.length > 0 ? diffs.reduce((sum, d) => sum + d.structural_change_score, 0) / diffs.length : 0;
    const confidenceNet = diffs.reduce((sum, d) => sum + d.confidence_impact.delta, 0);

    return DiffMachinePayloadSchema.parse({
      schema_version: 1,
      compared: {
        run_a_id: input.runA.id,
        run_b_id: input.runB.id,
        human_decision_path_id: input.humanDecisionPath.id,
        agent_decision_path_id: input.agentDecisionPath.id,
      },
      generated_at: new Date().toISOString(),
      diffs,
      aggregates: {
        total_items: diffs.length,
        semantic_change_mean: semanticMean,
        structural_change_mean: structuralMean,
        confidence_delta_net: Number(confidenceNet.toFixed(3)),
      },
    });
  }

  private buildNarrativeSummary(payload: DiffMachinePayload): DiffNarrativeSummary {
    const byEntity: Record<string, number> = {};
    const byReason: Record<string, number> = {};

    for (const diff of payload.diffs) {
      byEntity[diff.entity_type] = (byEntity[diff.entity_type] ?? 0) + 1;
      byReason[diff.why_changed] = (byReason[diff.why_changed] ?? 0) + 1;
    }

    const topChanges = payload.diffs
      .slice()
      .sort((a, b) => b.structural_change_score - a.structural_change_score)
      .slice(0, 5)
      .map((diff) => `${diff.entity_type}/${diff.entity_key}: ${diff.what_changed}`);

    const executiveSummary =
      `Compared ${payload.compared.run_a_id} → ${payload.compared.run_b_id} and ` +
      `${payload.compared.human_decision_path_id} → ${payload.compared.agent_decision_path_id}. ` +
      `${payload.aggregates.total_items} explainable changes detected with net confidence delta ` +
      `${payload.aggregates.confidence_delta_net.toFixed(2)}.`;

    const auditorSummary =
      `Machine-normalized entities (claims, evidence links, policy checks, approvals, outcomes) were diffed ` +
      `for semantic and structural drift. Primary reason categories: ${Object.entries(byReason)
        .map(([reason, count]) => `${reason}=${count}`)
        .join(", ") || "none"}.`;

    return DiffNarrativeSummarySchema.parse({
      executive_summary: executiveSummary,
      auditor_summary: auditorSummary,
      top_changes: topChanges,
      counts_by_entity: byEntity,
      counts_by_reason: byReason,
    });
  }

  private entityFingerprint(entity: ComparedEntity): string {
    return `${entity.type}:${entity.key}`;
  }

  private semanticSimilarity(left: string, right: string): number {
    if (!left && !right) return 1;
    if (!left || !right) return 0;

    const leftTokens = new Set(left.toLowerCase().split(/\W+/).filter(Boolean));
    const rightTokens = new Set(right.toLowerCase().split(/\W+/).filter(Boolean));

    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;

    return union === 0 ? 1 : Number((intersection / union).toFixed(3));
  }

  private structuralChangeScore(left: Record<string, unknown>, right: Record<string, unknown>): number {
    const leftKeys = new Set(Object.keys(left));
    const rightKeys = new Set(Object.keys(right));
    const allKeys = new Set([...leftKeys, ...rightKeys]);

    if (allKeys.size === 0) return 0;

    let changed = 0;
    for (const key of allKeys) {
      const leftValue = left[key];
      const rightValue = right[key];
      if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
        changed += 1;
      }
    }

    return Number((changed / allKeys.size).toFixed(3));
  }

  private inferChangeReason(
    left: Record<string, unknown>,
    right: Record<string, unknown>
  ): z.infer<typeof DiffReasonSchema> {
    const mergedText = `${this.stringifyCompact(left)} ${this.stringifyCompact(right)}`.toLowerCase();

    if (/(policy|control|guardrail|compliance|rule)/.test(mergedText)) {
      return "policy";
    }
    if (/(evidence|source|citation|benchmark|proof|link)/.test(mergedText)) {
      return "evidence";
    }
    if (/(owner|approver|stakeholder|assignee|reviewer)/.test(mergedText)) {
      return "owner";
    }
    if (/(input|assumption|parameter|prompt|context|scenario)/.test(mergedText)) {
      return "input";
    }

    return "unknown";
  }

  private inferConfidenceImpact(
    changeType: z.infer<typeof DiffChangeTypeSchema>,
    reason: z.infer<typeof DiffReasonSchema>,
    semanticSimilarity: number,
    structuralChange: number
  ): { delta: number; direction: "increased" | "decreased" | "neutral"; rationale: string } {
    const base = reason === "evidence" ? 0.1 : reason === "policy" ? 0.08 : 0.05;
    const volatilityPenalty = (1 - semanticSimilarity) * 0.12 + structuralChange * 0.1;

    let delta = 0;
    if (changeType === "added" && reason === "evidence") {
      delta = base - volatilityPenalty / 2;
    } else if (changeType === "removed" && (reason === "evidence" || reason === "policy")) {
      delta = -(base + volatilityPenalty);
    } else if (changeType === "modified") {
      delta = reason === "policy" ? -(volatilityPenalty / 2) : base / 2 - volatilityPenalty;
    }

    const normalizedDelta = Number(Math.max(-1, Math.min(1, delta)).toFixed(3));
    const direction = normalizedDelta > 0.01 ? "increased" : normalizedDelta < -0.01 ? "decreased" : "neutral";

    return {
      delta: normalizedDelta,
      direction,
      rationale: `Reason=${reason}; semantic_similarity=${semanticSimilarity}; structural_change=${structuralChange}.`,
    };
  }

  private inferBusinessImpact(
    changeType: z.infer<typeof DiffChangeTypeSchema>,
    reason: z.infer<typeof DiffReasonSchema>,
    entityType: z.infer<typeof DiffEntityTypeSchema>,
    confidenceDelta: number
  ): { direction: "positive" | "negative" | "mixed" | "neutral"; magnitude: "low" | "medium" | "high"; rationale: string } {
    const direction =
      confidenceDelta > 0.02
        ? "positive"
        : confidenceDelta < -0.02
          ? "negative"
          : changeType === "modified"
            ? "mixed"
            : "neutral";

    const weight = Math.abs(confidenceDelta) + (reason === "policy" ? 0.2 : 0.1) + (entityType === "outcome" ? 0.2 : 0);
    const magnitude = weight > 0.5 ? "high" : weight > 0.25 ? "medium" : "low";

    return {
      direction,
      magnitude,
      rationale: `Change=${changeType}; reason=${reason}; entity=${entityType}; confidence_delta=${confidenceDelta}.`,
    };
  }

  private describeChange(
    changeType: z.infer<typeof DiffChangeTypeSchema>,
    leftEntity?: ComparedEntity,
    rightEntity?: ComparedEntity
  ): string {
    if (changeType === "added" && rightEntity) {
      return `Added ${rightEntity.type} "${rightEntity.key}".`;
    }

    if (changeType === "removed" && leftEntity) {
      return `Removed ${leftEntity.type} "${leftEntity.key}".`;
    }

    if (leftEntity && rightEntity) {
      return `Modified ${rightEntity.type} "${rightEntity.key}" from ${leftEntity.content} to ${rightEntity.content}.`;
    }

    return `Changed entity ${leftEntity?.key ?? rightEntity?.key ?? "unknown"}.`;
  }

  private firstDefinedString(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  }

  private stringifyCompact(value: unknown): string {
    return JSON.stringify(value, Object.keys((value as Record<string, unknown>) ?? {}).sort());
  }

  private generateStableId(): string {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    return `dxs_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${suffix}`;
  }
}

export const diffExplainabilityService = new DiffExplainabilityService();
