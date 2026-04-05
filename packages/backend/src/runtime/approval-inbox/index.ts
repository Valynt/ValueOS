import { v4 as uuidv4 } from "uuid";

import { logger } from "../../lib/logger.js";
import { WorkflowExecutionStore } from "../../services/workflows/WorkflowExecutionStore.js";
import type {
  ApprovalCheckpointRecord,
  ApprovalCheckpointState,
} from "../../types/execution/workflowExecutionStore.js";
import type { PolicyEngine as PolicyEngineContract } from "../policy-engine/index.js";

import { StageTransitionEvent, stageTransitionEventBus } from "./StageTransitionEventBus.js";
import { AgentRegistry } from "../../services/agents/AgentRegistry.js";
import { PolicyEngine } from "../policy-engine/index.js";
import { createServerSupabaseClient } from "../../lib/supabase.js";

interface ApprovalInboxConfig {
  defaultDueInMinutes: number;
  defaultEscalationPolicyId: string;
}

const DEFAULT_APPROVAL_INBOX_CONFIG: ApprovalInboxConfig = {
  defaultDueInMinutes: 60,
  defaultEscalationPolicyId: "default-escalation-policy",
};

export class ApprovalInbox {
  private readonly store: WorkflowExecutionStore;
  private readonly config: ApprovalInboxConfig;
  private unsubscribe?: () => void;

  constructor(
    private readonly policyEngine: PolicyEngineContract,
    store?: WorkflowExecutionStore,
    config: Partial<ApprovalInboxConfig> = {},
  ) {
    this.store = store ?? new WorkflowExecutionStore(createServerSupabaseClient());
    this.config = { ...DEFAULT_APPROVAL_INBOX_CONFIG, ...config };
  }

  start(): void {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = stageTransitionEventBus.subscribe((event) => {
      void this.handleStageTransition(event);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  async handleStageTransition(event: StageTransitionEvent): Promise<void> {
    if (event.transition !== "stage_waiting_approval") {
      return;
    }

    const ownerPrincipal = String(event.metadata.owner_principal ?? "unassigned");
    const ownerType = (event.metadata.owner_type as "user" | "team" | "role" | undefined) ?? "role";
    const checkpointId = String(event.metadata.checkpoint_id ?? uuidv4());

    const dueAt = event.metadata.due_at
      ? new Date(String(event.metadata.due_at)).toISOString()
      : new Date(Date.now() + this.config.defaultDueInMinutes * 60_000).toISOString();

    const escalationPolicyId = String(
      event.metadata.escalation_policy_id ?? this.config.defaultEscalationPolicyId,
    );

    const checkpoint: ApprovalCheckpointRecord = {
      checkpoint_id: checkpointId,
      run_id: event.runId,
      stage_id: event.stageId,
      organization_id: event.organizationId,
      owner_principal: ownerPrincipal,
      owner_type: ownerType,
      due_at: dueAt,
      escalation_policy_id: escalationPolicyId,
      state: "pending",
      updated_at: new Date().toISOString(),
    };

    await this.store.upsertApprovalCheckpoint(checkpoint);
    await this.store.recordWorkflowEvent({
      executionId: event.runId,
      organizationId: event.organizationId,
      eventType: "approval_checkpoint_created",
      stageId: event.stageId,
      metadata: {
        checkpoint_id: checkpointId,
        owner_principal: ownerPrincipal,
        owner_type: ownerType,
        due_at: dueAt,
        escalation_policy_id: escalationPolicyId,
        source: event.source,
      },
    });
  }

  async transitionCheckpointState(input: {
    organizationId: string;
    checkpointId: string;
    actorPrincipal: string;
    nextState: Exclude<ApprovalCheckpointState, "pending">;
    reasonCode: string;
    stageId: string;
    runId: string;
  }): Promise<void> {
    const checkpoints = await this.store.listApprovalCheckpoints({
      organizationId: input.organizationId,
    });

    const checkpoint = checkpoints.find((candidate) => candidate.checkpoint_id === input.checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${input.checkpointId} not found`);
    }

    if (input.nextState === "rejected") {
      await this.policyEngine.validateRejectionAuthority({
        organizationId: input.organizationId,
        actorPrincipal: input.actorPrincipal,
        ownerPrincipal: checkpoint.owner_principal,
      });
    }

    const updatedCheckpoint: ApprovalCheckpointRecord = {
      ...checkpoint,
      state: input.nextState,
      updated_at: new Date().toISOString(),
    };

    await this.store.upsertApprovalCheckpoint(updatedCheckpoint);
    await this.store.recordWorkflowEvent({
      executionId: input.runId,
      organizationId: input.organizationId,
      eventType: "approval_checkpoint_state_changed",
      stageId: input.stageId,
      metadata: {
        checkpoint_id: input.checkpointId,
        prior_state: checkpoint.state,
        next_state: input.nextState,
        actor_principal: input.actorPrincipal,
        reason_code: input.reasonCode,
      },
    });
  }

  async processDueEscalations(now: Date = new Date()): Promise<number> {
    const organizations = await this.fetchOrganizationsWithPendingApprovals();
    let escalatedCount = 0;

    for (const organizationId of organizations) {
      const pending = await this.store.listApprovalCheckpoints({
        organizationId,
        states: ["pending"],
        overdueOnly: true,
      });

      for (const checkpoint of pending) {
        if (new Date(checkpoint.due_at) > now) {
          continue;
        }

        const escalationResult = await this.policyEngine.validateEscalationPath({
          organizationId,
          escalationPolicyId: checkpoint.escalation_policy_id,
          currentOwnerPrincipal: checkpoint.owner_principal,
        });

        const priorAssignee = checkpoint.owner_principal;
        const nextOwner = escalationResult.nextOwnerPrincipal;

        await this.store.upsertApprovalCheckpoint({
          ...checkpoint,
          owner_principal: nextOwner,
          state: "escalated",
          updated_at: now.toISOString(),
        });

        await this.store.recordWorkflowEvent({
          executionId: checkpoint.run_id,
          organizationId,
          eventType: "approval_checkpoint_escalated",
          stageId: checkpoint.stage_id,
          metadata: {
            checkpoint_id: checkpoint.checkpoint_id,
            reason_code: "due_at_breach",
            prior_assignee: priorAssignee,
            next_assignee: nextOwner,
            escalation_policy_id: checkpoint.escalation_policy_id,
          },
        });

        escalatedCount += 1;
      }
    }

    return escalatedCount;
  }

  async getMyApprovals(organizationId: string, principal: string): Promise<ApprovalCheckpointRecord[]> {
    return this.store.listApprovalCheckpoints({
      organizationId,
      ownerPrincipal: principal,
      states: ["pending", "escalated"],
    });
  }

  async getTeamApprovals(organizationId: string, teamPrincipal: string): Promise<ApprovalCheckpointRecord[]> {
    return this.store.listApprovalCheckpoints({
      organizationId,
      ownerTeam: teamPrincipal,
      states: ["pending", "escalated"],
    });
  }

  async getOverdueOrEscalatedApprovals(organizationId: string): Promise<ApprovalCheckpointRecord[]> {
    const overdue = await this.store.listApprovalCheckpoints({
      organizationId,
      states: ["pending"],
      overdueOnly: true,
    });

    const escalated = await this.store.listApprovalCheckpoints({
      organizationId,
      states: ["escalated"],
    });

    return [...overdue, ...escalated];
  }

  private async fetchOrganizationsWithPendingApprovals(): Promise<string[]> {
    try {
      return await this.store.listOrganizationsWithPendingApprovalCheckpoints();
    } catch (error) {
      logger.error("Failed to fetch organizations with pending approval checkpoints", error as Error);
      return [];
    }
  }
}

let approvalInboxSingleton: ApprovalInbox | null = null;

export function getApprovalInbox(): ApprovalInbox {
  if (approvalInboxSingleton) {
    return approvalInboxSingleton;
  }

  const supabaseClient = createServerSupabaseClient();
  const store = new WorkflowExecutionStore(supabaseClient);
  const policyEngine = new PolicyEngine({
    supabase: supabaseClient,
    registry: new AgentRegistry(),
    serviceReadiness: () => ({
      message_broker_ready: true,
      queue_ready: true,
      memory_backend_ready: true,
      llm_gateway_ready: true,
      circuit_breaker_ready: true,
    }),
  });

  approvalInboxSingleton = new ApprovalInbox(policyEngine, store);
  approvalInboxSingleton.start();
  return approvalInboxSingleton;
}
