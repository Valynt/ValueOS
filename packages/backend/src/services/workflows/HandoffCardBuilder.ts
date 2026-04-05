import type { WorkflowDAG, WorkflowStage } from '../../types/workflow.js';

export interface HandoffTransitionMetadata {
  from_stage: string;
  to_stage: string;
  actor: string;
  timestamp: string;
  run_id: string;
}

export interface HandoffConfidenceSummary {
  score: number | null;
  label: 'high' | 'medium' | 'low' | 'unknown';
  rationale: string;
}

export interface HandoffCardArtifact {
  transition: HandoffTransitionMetadata;
  objective: string;
  expected_outcome: string;
  required_inputs: string[];
  unresolved_dependencies: string[];
  policy_constraints: string[];
  evidence_snapshot_pointers: string[];
  confidence_summary: HandoffConfidenceSummary;
  next_owner: string;
  acceptance_criteria: string[];
}

interface BuildHandoffCardInput {
  runId: string;
  fromStage: WorkflowStage;
  toStage: WorkflowStage;
  actor: string;
  timestamp: string;
  dag: WorkflowDAG;
  stageOutput: Record<string, unknown>;
  policyConstraints: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function resolveConfidenceSummary(output: Record<string, unknown>): HandoffConfidenceSummary {
  const nestedResult = asRecord(output.result);
  const confidenceRaw =
    typeof output.confidence_score === 'number'
      ? output.confidence_score
      : typeof output.confidence === 'number'
        ? output.confidence
        : typeof nestedResult.confidence_score === 'number'
          ? nestedResult.confidence_score
          : null;

  if (confidenceRaw === null) {
    return {
      score: null,
      label: 'unknown',
      rationale: 'No confidence score was captured in the stage output.',
    };
  }

  const normalized = confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw;
  const label: HandoffConfidenceSummary['label'] = normalized >= 0.8 ? 'high' : normalized >= 0.6 ? 'medium' : 'low';

  return {
    score: Number(normalized.toFixed(4)),
    label,
    rationale: `Confidence derived from stage output (${normalized.toFixed(2)}).`,
  };
}

function resolveEvidenceSnapshotPointers(output: Record<string, unknown>, runId: string, toStageId: string): string[] {
  const nestedResult = asRecord(output.result);
  const candidates = [
    ...asStringArray(output.evidence_snapshot_pointers),
    ...asStringArray(output.evidence_links),
    ...asStringArray(nestedResult.evidence_snapshot_pointers),
    ...asStringArray(nestedResult.evidence_links),
  ];

  if (candidates.length > 0) {
    return Array.from(new Set(candidates));
  }

  return [`workflow://${runId}/stage/${toStageId}/evidence`];
}

function resolveRequiredInputs(output: Record<string, unknown>, toStage: WorkflowStage): string[] {
  const nestedResult = asRecord(output.result);
  const explicitInputs = [
    ...asStringArray(output.required_inputs),
    ...asStringArray(nestedResult.required_inputs),
  ];

  if (explicitInputs.length > 0) {
    return Array.from(new Set(explicitInputs));
  }

  return toStage.dependencies && toStage.dependencies.length > 0
    ? Array.from(new Set(toStage.dependencies))
    : ['context_bundle'];
}

export class HandoffCardBuilder {
  build(input: BuildHandoffCardInput): HandoffCardArtifact {
    const transitionOutEdges = (input.dag.transitions ?? []).filter((transition) => {
      const toStage = transition.to_stage ?? transition.to;
      return toStage === input.toStage.id;
    });

    const unresolvedDependencies = transitionOutEdges
      .map((transition) => transition.from_stage ?? transition.from)
      .filter((stageId): stageId is string => typeof stageId === 'string' && stageId.length > 0 && stageId !== input.fromStage.id);

    const acceptanceCriteria = transitionOutEdges
      .map((transition) => transition.condition)
      .filter((condition): condition is string => typeof condition === 'string' && condition.trim().length > 0);

    return {
      transition: {
        from_stage: input.fromStage.id,
        to_stage: input.toStage.id,
        actor: input.actor,
        timestamp: input.timestamp,
        run_id: input.runId,
      },
      objective: input.toStage.description ?? `Advance workflow to ${input.toStage.id}.`,
      expected_outcome: `Stage ${input.toStage.id} starts with a validated and auditable handoff payload.`,
      required_inputs: resolveRequiredInputs(input.stageOutput, input.toStage),
      unresolved_dependencies: Array.from(new Set(unresolvedDependencies)),
      policy_constraints: input.policyConstraints,
      evidence_snapshot_pointers: resolveEvidenceSnapshotPointers(input.stageOutput, input.runId, input.toStage.id),
      confidence_summary: resolveConfidenceSummary(input.stageOutput),
      next_owner: input.toStage.agent_type,
      acceptance_criteria: acceptanceCriteria.length > 0
        ? Array.from(new Set(acceptanceCriteria))
        : ['Stage owner confirms readiness and completes output schema requirements.'],
    };
  }
}
