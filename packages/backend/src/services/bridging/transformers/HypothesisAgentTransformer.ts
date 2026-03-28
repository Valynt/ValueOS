/**
 * HypothesisAgent Artifact Transformer
 *
 * Transforms HypothesisAgent outputs into renderable SDUI artifacts.
 * Registered with the ArtifactTransformerRegistry to fill the "value_tree"
 * and "assumption_register" artifact slots during the DRAFTING phase.
 *
 * Sprint 55: Phase 2 concrete transformer implementation.
 */

import type {
  ArtifactSlot,
  ProgressDirective,
} from "@valueos/shared";

import type {
  IArtifactTransformer,
  TransformInput,
  TransformedArtifact,
} from "../ArtifactTransformer.js";

// HypothesisAgent output shape (matches the agent's Zod schema)
interface HypothesisAgentOutput {
  hypotheses: Array<{
    id: string;
    description: string;
    category: string;
    estimated_value?: {
      low: number;
      high: number;
      currency: string;
    } | null;
    confidence: "low" | "medium" | "high";
    impact_cascade?: {
      feature: string;
      capability: string;
      kpi: string;
      financial_value: string;
    };
    assumptions: Array<{
      id: string;
      name: string;
      value: string;
      unit: string;
      source: string;
      sensitivity_low?: string;
      sensitivity_high?: string;
    }>;
    evidence_ids: string[];
  }>;
  red_team_objections?: Array<{
    id: string;
    target_hypothesis_id: string;
    objection_type: string;
    description: string;
    severity: "critical" | "warning" | "info";
    suggested_revision?: string;
  }>;
  overall_confidence: number;
  reasoning_trace_id: string;
}

export class HypothesisAgentTransformer
  implements IArtifactTransformer<HypothesisAgentOutput>
{
  readonly agentName = "HypothesisAgent";

  async transform(
    input: TransformInput<HypothesisAgentOutput>
  ): Promise<TransformedArtifact | null> {
    const { agent_output, target_slot, trace_id, grounding_score } = input;

    // No output to transform
    if (!agent_output?.hypotheses?.length) {
      return null;
    }

    switch (target_slot.id) {
      case "value_tree":
        return this.transformValueTree(input);

      case "assumption_register":
        return this.transformAssumptionRegister(input);

      case "confidence_dashboard":
        return this.transformConfidenceDashboard(input);

      default:
        // This transformer doesn't handle other slots
        return null;
    }
  }

  toProgressDirective(
    partialOutput: Partial<HypothesisAgentOutput>,
    slot: ArtifactSlot
  ): ProgressDirective {
    const hypothesisCount = partialOutput.hypotheses?.length ?? 0;
    const totalExpected = 3; // Typical expectation

    return {
      agent_name: this.agentName,
      activity_label:
        hypothesisCount > 0
          ? `Generating hypotheses (${hypothesisCount}/${totalExpected})`
          : "Identifying value drivers",
      progress_pct: hypothesisCount > 0 ? (hypothesisCount / totalExpected) * 100 : null,
      has_partial_result: hypothesisCount > 0,
      partial_result:
        hypothesisCount > 0
          ? {
              hypotheses: partialOutput.hypotheses?.slice(0, 3),
              partial: true,
            }
          : undefined,
      eta_seconds: null,
    };
  }

  // ─── Private Transform Methods ───────────────────────────────────────

  private transformValueTree(
    input: TransformInput<HypothesisAgentOutput>
  ): TransformedArtifact {
    const { agent_output, target_slot, trace_id, grounding_score } = input;

    const valueNodes = agent_output.hypotheses.map((h: typeof agent_output.hypotheses[0]) => ({
      id: h.id,
      label: h.description.slice(0, 60),
      category: h.category,
      estimatedValue: h.estimated_value
        ? `$${(h.estimated_value.low / 1000).toFixed(0)}k–$${(h.estimated_value.high / 1000).toFixed(0)}k`
        : "TBD",
      confidence: h.confidence,
      evidenceCount: h.evidence_ids?.length ?? 0,
      impactCascade: h.impact_cascade,
      hasObjections: agent_output.red_team_objections?.some(
        (o: typeof agent_output.red_team_objections[0]) => o.target_hypothesis_id === h.id
      ),
    }));

    const totalValueLow = agent_output.hypotheses.reduce(
      (sum: number, h: typeof agent_output.hypotheses[0]) => sum + (h.estimated_value?.low ?? 0),
      0
    );
    const totalValueHigh = agent_output.hypotheses.reduce(
      (sum: number, h: typeof agent_output.hypotheses[0]) => sum + (h.estimated_value?.high ?? 0),
      0
    );

    return {
      slot_id: target_slot.id,
      component: "ValueTreeCard",
      version: 1,
      props: {
        title: "Value Hypotheses",
        nodes: valueNodes,
        summary: {
          hypothesisCount: agent_output.hypotheses.length,
          totalValueLow,
          totalValueHigh,
          currency: agent_output.hypotheses[0]?.estimated_value?.currency ?? "USD",
          overallConfidence: agent_output.overall_confidence,
        },
        objections: agent_output.red_team_objections?.map((o: typeof agent_output.red_team_objections[0]) => ({
          id: o.id,
          targetId: o.target_hypothesis_id,
          type: o.objection_type,
          description: o.description,
          severity: o.severity,
        })),
      },
      lineage: {
        source_agent: this.agentName,
        trace_id: trace_id ?? agent_output.reasoning_trace_id,
        produced_at: new Date().toISOString(),
        grounding_score: grounding_score ?? agent_output.overall_confidence,
        source_ids: agent_output.hypotheses.map((h) => h.id),
      },
      indicator: agent_output.red_team_objections?.some((o) => o.severity === "critical")
        ? "warning"
        : "success",
      badge_value: agent_output.hypotheses.length,
    };
  }

  private transformAssumptionRegister(
    input: TransformInput<HypothesisAgentOutput>
  ): TransformedArtifact {
    const { agent_output, target_slot, trace_id, grounding_score } = input;

    const allAssumptions = agent_output.hypotheses.flatMap((h: typeof agent_output.hypotheses[0]) =>
      (h.assumptions ?? []).map((a: typeof h.assumptions[0]) => ({
        ...a,
        hypothesis_id: h.id,
        hypothesis_description: h.description,
      }))
    );

    return {
      slot_id: target_slot.id,
      component: "AssumptionRegister",
      version: 1,
      props: {
        title: "Assumptions Register",
        assumptions: allAssumptions.map((a: typeof allAssumptions[0]) => ({
          id: a.id,
          name: a.name,
          value: a.value,
          unit: a.unit,
          source: a.source,
          sensitivityRange:
            a.sensitivity_low && a.sensitivity_high
              ? `${a.sensitivity_low}–${a.sensitivity_high}`
              : null,
          hypothesisId: a.hypothesis_id,
          hypothesisContext: a.hypothesis_description.slice(0, 50),
        })),
        count: allAssumptions.length,
        bySource: this.groupBySource(allAssumptions),
      },
      lineage: {
        source_agent: this.agentName,
        trace_id: trace_id ?? agent_output.reasoning_trace_id,
        produced_at: new Date().toISOString(),
        grounding_score: grounding_score ?? agent_output.overall_confidence,
        source_ids: allAssumptions.map((a) => a.id),
      },
      indicator: allAssumptions.some((a) => a.source === "agent_inference")
        ? "warning"
        : "success",
      badge_value: allAssumptions.length,
    };
  }

  private transformConfidenceDashboard(
    input: TransformInput<HypothesisAgentOutput>
  ): TransformedArtifact {
    const { agent_output, target_slot } = input;

    const confidenceComponents = agent_output.hypotheses.map((h: typeof agent_output.hypotheses[0]) => ({
      id: h.id,
      label: h.description.slice(0, 40),
      score: this.confidenceToScore(h.confidence),
      tier: h.confidence,
      evidenceCount: h.evidence_ids?.length ?? 0,
    }));

    return {
      slot_id: target_slot.id,
      component: "ReadinessGauge",
      version: 1,
      props: {
        compositeScore: agent_output.overall_confidence,
        status: this.scoreToStatus(agent_output.overall_confidence),
        components: {
          hypotheses: confidenceComponents,
          overall: agent_output.overall_confidence,
        },
        summary: {
          highConfidenceCount: confidenceComponents.filter((c: typeof confidenceComponents[0]) => c.tier === "high")
            .length,
          mediumConfidenceCount: confidenceComponents.filter((c: typeof confidenceComponents[0]) => c.tier === "medium")
            .length,
          lowConfidenceCount: confidenceComponents.filter((c: typeof confidenceComponents[0]) => c.tier === "low")
            .length,
        },
      },
      lineage: {
        source_agent: this.agentName,
        trace_id: input.trace_id ?? agent_output.reasoning_trace_id,
        produced_at: new Date().toISOString(),
        grounding_score: input.grounding_score ?? agent_output.overall_confidence,
        source_ids: agent_output.hypotheses.map((h) => h.id),
      },
      indicator: this.scoreToIndicator(agent_output.overall_confidence),
      badge_value: Math.round(agent_output.overall_confidence * 100),
    };
  }

  // ─── Helper Methods ──────────────────────────────────────────────────

  private confidenceToScore(confidence: "low" | "medium" | "high"): number {
    const scores = { low: 0.35, medium: 0.6, high: 0.85 };
    return scores[confidence] ?? 0.5;
  }

  private scoreToStatus(score: number): "ready" | "warning" | "critical" {
    if (score >= 0.75) return "ready";
    if (score >= 0.5) return "warning";
    return "critical";
  }

  private scoreToIndicator(score: number): "success" | "warning" | "error" {
    if (score >= 0.75) return "success";
    if (score >= 0.5) return "warning";
    return "error";
  }

  private groupBySource(
    assumptions: Array<{ source: string }>
  ): Record<string, number> {
    return assumptions.reduce((acc: Record<string, number>, a: { source: string }) => {
      acc[a.source] = (acc[a.source] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
