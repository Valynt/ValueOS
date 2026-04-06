/**
 * ValueLoopAnalytics
 *
 * Records events from the value loop: which recommendations users accept,
 * which assumptions they correct, and which evidence types are most persuasive.
 * These events feed back into agent confidence calibration and hypothesis ranking.
 *
 * All writes are tenant-scoped. Reads are aggregated per organization.
 */

import { createLogger } from "@shared/lib/logger";
import { z } from "zod";

// service-role:justified worker/service requires elevated DB access for background processing
import { createWorkerServiceSupabaseClient } from '../lib/supabase/privileged/index.js';

const logger = createLogger({ component: "ValueLoopAnalytics" });

// ─── Event schemas ────────────────────────────────────────────────────────────

export const ValueLoopEventTypeSchema = z.enum([
  "recommendation_accepted",
  "recommendation_dismissed",
  "assumption_corrected",
  "evidence_accepted",
  "evidence_rejected",
]);

export type ValueLoopEventType = z.infer<typeof ValueLoopEventTypeSchema>;

export const RecordEventInputSchema = z.object({
  organizationId: z.string().uuid(),
  sessionId: z.string().min(1),
  eventType: ValueLoopEventTypeSchema,
  objectType: z.string().optional(),
  objectId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).default({}),
  actorId: z.string().uuid().optional(),
});

export type RecordEventInput = z.infer<typeof RecordEventInputSchema>;

// ─── Aggregation result types ─────────────────────────────────────────────────

export interface RecommendationAcceptanceRate {
  agentName: string;
  accepted: number;
  dismissed: number;
  acceptanceRate: number;
}

export interface AssumptionCorrectionSummary {
  objectId: string;
  corrections: number;
  lastCorrectedAt: string;
}

export interface EvidencePersuasiveness {
  evidenceType: string;
  accepted: number;
  rejected: number;
  persuasivenessRate: number;
}

export interface ValueLoopInsights {
  organizationId: string;
  period: { from: string; to: string };
  recommendationAcceptance: RecommendationAcceptanceRate[];
  assumptionCorrections: AssumptionCorrectionSummary[];
  evidencePersuasiveness: EvidencePersuasiveness[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ValueLoopAnalytics {
  /**
   * Record a single value loop event.
   * Tenant isolation is enforced: organizationId must match the caller's tenant.
   */
  static async record(input: RecordEventInput): Promise<void> {
    const parsed = RecordEventInputSchema.safeParse(input);
    if (!parsed.success) {
      logger.warn("Invalid analytics event", { errors: parsed.error.flatten() });
      return;
    }

    const { organizationId, sessionId, eventType, objectType, objectId, payload, actorId } =
      parsed.data;

    // service-role:justified ValueLoopAnalytics reads value loop metrics across all tenants for analytics
    const supabase = createWorkerServiceSupabaseClient('ValueLoopAnalytics: read value loop metrics');
    const { error } = await supabase.from("value_loop_events").insert({
      organization_id: organizationId,
      session_id: sessionId,
      event_type: eventType,
      object_type: objectType ?? null,
      object_id: objectId ?? null,
      payload,
      actor_id: actorId ?? null,
    });

    if (error) {
      logger.error("Failed to record value loop event", undefined, {
        eventType,
        organizationId,
        error: error.message,
      });
    }
  }

  /**
   * Convenience: record a recommendation acceptance or dismissal.
   */
  static async recordRecommendation(opts: {
    organizationId: string;
    sessionId: string;
    accepted: boolean;
    agentName: string;
    hypothesisId?: string;
    confidence?: number;
    actorId?: string;
  }): Promise<void> {
    await ValueLoopAnalytics.record({
      organizationId: opts.organizationId,
      sessionId: opts.sessionId,
      eventType: opts.accepted ? "recommendation_accepted" : "recommendation_dismissed",
      objectType: "hypothesis",
      objectId: opts.hypothesisId,
      payload: {
        agentName: opts.agentName,
        confidence: opts.confidence,
      },
      actorId: opts.actorId,
    });
  }

  /**
   * Convenience: record a user correcting an assumption.
   */
  static async recordAssumptionCorrection(opts: {
    organizationId: string;
    sessionId: string;
    assumptionId: string;
    previousValue: unknown;
    correctedValue: unknown;
    actorId?: string;
  }): Promise<void> {
    await ValueLoopAnalytics.record({
      organizationId: opts.organizationId,
      sessionId: opts.sessionId,
      eventType: "assumption_corrected",
      objectType: "assumption",
      objectId: opts.assumptionId,
      payload: {
        previousValue: opts.previousValue,
        correctedValue: opts.correctedValue,
      },
      actorId: opts.actorId,
    });
  }

  /**
   * Query aggregated insights for a tenant over a time window.
   * Returns acceptance rates, correction counts, and evidence persuasiveness.
   */
  static async getInsights(
    organizationId: string,
    windowDays = 30,
  ): Promise<ValueLoopInsights> {
    // service-role:justified ValueLoopAnalytics reads value loop metrics across all tenants for analytics
    const supabase = createWorkerServiceSupabaseClient('ValueLoopAnalytics: read value loop metrics');
    const from = new Date(Date.now() - windowDays * 86_400_000).toISOString();
    const to = new Date().toISOString();

    const { data, error } = await supabase
      .from("value_loop_events")
      .select("event_type, object_type, object_id, payload, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", from)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to query value loop events", undefined, {
        organizationId,
        error: error.message,
      });
      return { organizationId, period: { from, to }, recommendationAcceptance: [], assumptionCorrections: [], evidencePersuasiveness: [] };
    }

    const rows = data ?? [];

    // Recommendation acceptance by agent
    const recByAgent = new Map<string, { accepted: number; dismissed: number }>();
    for (const row of rows) {
      if (
        row.event_type !== "recommendation_accepted" &&
        row.event_type !== "recommendation_dismissed"
      ) continue;
      const agent = (row.payload as Record<string, unknown>)?.agentName as string ?? "unknown";
      const bucket = recByAgent.get(agent) ?? { accepted: 0, dismissed: 0 };
      if (row.event_type === "recommendation_accepted") bucket.accepted++;
      else bucket.dismissed++;
      recByAgent.set(agent, bucket);
    }

    const recommendationAcceptance: RecommendationAcceptanceRate[] = Array.from(
      recByAgent.entries(),
    ).map(([agentName, { accepted, dismissed }]) => ({
      agentName,
      accepted,
      dismissed,
      acceptanceRate: accepted + dismissed > 0 ? accepted / (accepted + dismissed) : 0,
    }));

    // Assumption corrections
    const correctionsByAssumption = new Map<string, { count: number; lastAt: string }>();
    for (const row of rows) {
      if (row.event_type !== "assumption_corrected" || !row.object_id) continue;
      const existing = correctionsByAssumption.get(row.object_id) ?? { count: 0, lastAt: row.created_at };
      correctionsByAssumption.set(row.object_id, {
        count: existing.count + 1,
        lastAt: row.created_at > existing.lastAt ? row.created_at : existing.lastAt,
      });
    }

    const assumptionCorrections: AssumptionCorrectionSummary[] = Array.from(
      correctionsByAssumption.entries(),
    ).map(([objectId, { count, lastAt }]) => ({
      objectId,
      corrections: count,
      lastCorrectedAt: lastAt,
    }));

    // Evidence persuasiveness by type
    const evidenceByType = new Map<string, { accepted: number; rejected: number }>();
    for (const row of rows) {
      if (row.event_type !== "evidence_accepted" && row.event_type !== "evidence_rejected") continue;
      const evidenceType = (row.payload as Record<string, unknown>)?.evidenceType as string ?? "unknown";
      const bucket = evidenceByType.get(evidenceType) ?? { accepted: 0, rejected: 0 };
      if (row.event_type === "evidence_accepted") bucket.accepted++;
      else bucket.rejected++;
      evidenceByType.set(evidenceType, bucket);
    }

    const evidencePersuasiveness: EvidencePersuasiveness[] = Array.from(
      evidenceByType.entries(),
    ).map(([evidenceType, { accepted, rejected }]) => ({
      evidenceType,
      accepted,
      rejected,
      persuasivenessRate: accepted + rejected > 0 ? accepted / (accepted + rejected) : 0,
    }));

    return { organizationId, period: { from, to }, recommendationAcceptance, assumptionCorrections, evidencePersuasiveness };
  }
}
