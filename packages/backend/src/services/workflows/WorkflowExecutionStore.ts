import { SupabaseClient } from "@supabase/supabase-js";

import { WorkflowExecutionLogDTO, WorkflowExecutionStatusDTO } from "../../types/execution/workflowExecutionDtos";
import {
  ApprovalCheckpointRecord,
  ApprovalCheckpointState,
  WorkflowExecutionStore as IWorkflowExecutionStore,
  RecordStageRunInput,
  RecordWorkflowEventInput,
  UpdateExecutionStatusInput,
} from "../../types/execution/workflowExecutionStore";
import { WorkflowExecutionRecord } from "../../types/workflowExecution";

export class WorkflowExecutionStore implements IWorkflowExecutionStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async persistExecutionRecord(executionId: string, organizationId: string, executionRecord: WorkflowExecutionRecord): Promise<void> {
    await this.supabase
      .from("workflow_executions")
      .update({ execution_record: executionRecord })
      .eq("id", executionId)
      .eq("organization_id", organizationId);
  }

  async updateExecutionStatus(input: UpdateExecutionStatusInput): Promise<void> {
    const update: Record<string, unknown> = {
      status: input.status,
      current_stage: input.currentStage,
      updated_at: new Date().toISOString(),
    };

    if (input.executionRecord) {
      update.execution_record = input.executionRecord;
      update.persona = input.executionRecord.persona;
      update.industry = input.executionRecord.industry;
      update.fiscal_quarter = input.executionRecord.fiscalQuarter;
    }

    if (input.status === "completed" || input.status === "failed" || input.status === "rolled_back") {
      update.completed_at = new Date().toISOString();
    }

    await this.supabase
      .from("workflow_executions")
      .update(update)
      .eq("id", input.executionId)
      .eq("organization_id", input.organizationId);
  }

  async recordStageRun(input: RecordStageRunInput): Promise<void> {
    await this.supabase.from("workflow_stage_runs").insert({
      execution_id: input.executionId,
      organization_id: input.organizationId,
      stage_id: input.stage.id,
      stage_name: input.stage.name || input.stage.id,
      lifecycle_stage: input.stage.agent_type,
      status: "completed",
      inputs: (input.executionRecord.io as Record<string, unknown> | undefined)?.inputs,
      assumptions: (input.executionRecord.io as Record<string, unknown> | undefined)?.assumptions,
      outputs: input.output || {},
      economic_deltas: input.output?.economic_deltas || input.executionRecord.economicDeltas,
      persona: input.executionRecord.persona,
      industry: input.executionRecord.industry,
      fiscal_quarter: input.executionRecord.fiscalQuarter,
      started_at: input.startedAt.toISOString(),
      completed_at: input.completedAt.toISOString(),
    });
  }

  async recordWorkflowEvent(input: RecordWorkflowEventInput): Promise<void> {
    const sequence = await this.getNextEventSequence(input.executionId, input.organizationId);
    const requestId = String(input.metadata.request_id ?? input.metadata.requestId ?? input.executionId);
    const eventMetadata = {
      ...input.metadata,
      request_id: requestId,
      evidence_link: input.metadata.evidence_link ?? `workflow://${input.executionId}/events/${sequence}`,
    };

    const { error } = await this.supabase.from("workflow_events").insert({
      execution_id: input.executionId,
      organization_id: input.organizationId,
      event_type: input.eventType,
      stage_id: input.stageId,
      metadata: eventMetadata,
      sequence,
    });

    if (error) {
      throw new Error(`Failed to record workflow event: ${error.message}`);
    }
  }

  async upsertApprovalCheckpoint(record: ApprovalCheckpointRecord): Promise<void> {
    const { error } = await this.supabase
      .from("approval_checkpoints")
      .upsert(record, { onConflict: "checkpoint_id" });

    if (error) {
      throw new Error(`Failed to upsert approval checkpoint: ${error.message}`);
    }
  }

  async listApprovalCheckpoints(input: {
    organizationId: string;
    ownerPrincipal?: string;
    ownerTeam?: string;
    states?: ApprovalCheckpointState[];
    overdueOnly?: boolean;
  }): Promise<ApprovalCheckpointRecord[]> {
    let query = this.supabase
      .from("approval_checkpoints")
      .select("*")
      .eq("organization_id", input.organizationId)
      .order("due_at", { ascending: true });

    if (input.ownerPrincipal) {
      query = query.eq("owner_principal", input.ownerPrincipal);
    }

    if (input.ownerTeam) {
      query = query.or(`owner_type.eq.team,owner_principal.eq.${input.ownerTeam}`);
    }

    if (input.states && input.states.length > 0) {
      query = query.in("state", input.states);
    }

    if (input.overdueOnly) {
      query = query.lt("due_at", new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list approval checkpoints: ${error.message}`);
    }

    return (data ?? []) as ApprovalCheckpointRecord[];
  }

  async listOrganizationsWithPendingApprovalCheckpoints(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("approval_checkpoints")
      .select("organization_id")
      .eq("state", "pending");

    if (error) {
      throw new Error(`Failed to list organizations with pending approval checkpoints: ${error.message}`);
    }

    return [...new Set((data ?? []).map((row) => String(row.organization_id)))];
  }

  async getExecutionStatus(executionId: string, organizationId: string): Promise<WorkflowExecutionStatusDTO | null> {
    const { data, error } = await this.supabase
      .from("workflow_executions")
      .select("*")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get execution status: ${error.message}`);
    }

    return data as WorkflowExecutionStatusDTO | null;
  }

  async getExecutionLogs(executionId: string, organizationId: string): Promise<WorkflowExecutionLogDTO[]> {
    const { data, error } = await this.supabase
      .from("workflow_execution_logs")
      .select("*")
      .eq("execution_id", executionId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to get execution logs: ${error.message}`);
    }

    return (data || []) as WorkflowExecutionLogDTO[];
  }

  private async getNextEventSequence(executionId: string, organizationId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("workflow_events")
      .select("sequence")
      .eq("execution_id", executionId)
      .eq("organization_id", organizationId)
      .order("sequence", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch workflow event sequence: ${error.message}`);
    }

    const lastSequence = data?.[0]?.sequence ?? 0;
    return lastSequence + 1;
  }
}
