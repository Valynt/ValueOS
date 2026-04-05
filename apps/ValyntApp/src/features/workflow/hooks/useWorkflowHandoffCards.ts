import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client/unified-api-client';
import { useTenant } from '@/contexts/TenantContext';

export interface HandoffConfidenceSummary {
  score: number | null;
  label: 'high' | 'medium' | 'low' | 'unknown';
  rationale: string;
}

export interface HandoffCardArtifact {
  transition: {
    from_stage: string;
    to_stage: string;
    actor: string;
    timestamp: string;
    run_id: string;
  };
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

interface HandoffEventRecord {
  id: string;
  event_type: string;
  stage_id: string | null;
  metadata: Record<string, unknown>;
  sequence: number;
  created_at: string;
}

export interface HandoffCardViewModel {
  eventId: string;
  sequence: number;
  stageId: string;
  createdAt: string;
  card: HandoffCardArtifact;
  addenda: Array<{
    comment: string;
    actor_id: string;
    created_at: string;
  }>;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseHandoffCard(value: unknown): HandoffCardArtifact | null {
  const record = asRecord(value);
  const transition = asRecord(record.transition);
  if (!transition.from_stage || !transition.to_stage) return null;

  return {
    transition: {
      from_stage: asString(transition.from_stage),
      to_stage: asString(transition.to_stage),
      actor: asString(transition.actor),
      timestamp: asString(transition.timestamp),
      run_id: asString(transition.run_id),
    },
    objective: asString(record.objective),
    expected_outcome: asString(record.expected_outcome),
    required_inputs: asStringArray(record.required_inputs),
    unresolved_dependencies: asStringArray(record.unresolved_dependencies),
    policy_constraints: asStringArray(record.policy_constraints),
    evidence_snapshot_pointers: asStringArray(record.evidence_snapshot_pointers),
    confidence_summary: {
      score: typeof asRecord(record.confidence_summary).score === 'number' ? (asRecord(record.confidence_summary).score as number) : null,
      label: (['high', 'medium', 'low', 'unknown'] as const).includes(asRecord(record.confidence_summary).label as never)
        ? (asRecord(record.confidence_summary).label as HandoffConfidenceSummary['label'])
        : 'unknown',
      rationale: asString(asRecord(record.confidence_summary).rationale),
    },
    next_owner: asString(record.next_owner),
    acceptance_criteria: asStringArray(record.acceptance_criteria),
  };
}

function parseHandoffCards(records: HandoffEventRecord[]): HandoffCardViewModel[] {
  const snapshots = records.filter((record) => record.event_type === 'stage_transition_handoff_created');

  return snapshots
    .map((snapshot) => {
      const metadata = asRecord(snapshot.metadata);
      const card = parseHandoffCard(metadata.handoff_card);
      if (!card) return null;

      const addenda = records
        .filter((record) => {
          if (record.event_type !== 'stage_transition_handoff_addendum') return false;
          const addendumMetadata = asRecord(record.metadata);
          return asString(addendumMetadata.handoff_event_id) === snapshot.id;
        })
        .map((record) => {
          const addendumMetadata = asRecord(record.metadata);
          return {
            comment: asString(addendumMetadata.comment),
            actor_id: asString(addendumMetadata.actor_id),
            created_at: asString(addendumMetadata.created_at),
          };
        })
        .filter((entry) => entry.comment.length > 0);

      return {
        eventId: snapshot.id,
        sequence: snapshot.sequence,
        stageId: snapshot.stage_id ?? card.transition.to_stage,
        createdAt: snapshot.created_at,
        card,
        addenda,
      };
    })
    .filter((entry): entry is HandoffCardViewModel => Boolean(entry));
}

function unwrapEvents(response: { success?: boolean; data?: unknown }): HandoffEventRecord[] {
  if (!response.success || !Array.isArray(response.data)) return [];
  return response.data as HandoffEventRecord[];
}

export function useWorkflowHandoffCards(runId: string | null | undefined, stageId?: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return useQuery<HandoffCardViewModel[]>({
    queryKey: ['workflow-handoff-cards', tenantId, runId, stageId ?? null],
    enabled: Boolean(tenantId && runId),
    queryFn: async () => {
      const response = stageId
        ? await api.getWorkflowHandoffCardsByStage(runId!, stageId)
        : await api.getWorkflowHandoffCardsByRun(runId!);

      const records = unwrapEvents(response as { success?: boolean; data?: unknown });
      return parseHandoffCards(records);
    },
  });
}

export function useAppendWorkflowHandoffAddendum(runId: string | null | undefined, stageId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return useMutation({
    mutationFn: async ({ eventId, comment }: { eventId: string; comment: string }) => {
      if (!runId || !stageId) throw new Error('Run and stage are required to append an addendum comment.');
      return api.appendWorkflowHandoffAddendum(runId, stageId, eventId, { comment });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workflow-handoff-cards', tenantId, runId, stageId ?? null] });
      await queryClient.invalidateQueries({ queryKey: ['workflow-handoff-cards', tenantId, runId, null] });
    },
  });
}
