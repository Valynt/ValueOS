import { SupabaseClient } from "@supabase/supabase-js";

import {
  ApprovalContext,
  ApprovalDecision,
  ApprovalRecord,
  FactStatus,
  NarrativeStatus,
  UUID,
} from "./types";

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

export class ApprovalService {
  constructor(
    private supabase: SupabaseClient,
    private tenantId: UUID
  ) {}

  async approveFact(
    factId: UUID,
    context: ApprovalContext
  ): Promise<ApprovalRecord> {
    const { data: fact, error: fetchError } = await this.supabase
      .from("memory_facts")
      .select("*")
      .eq("id", factId)
      .single();

    if (fetchError || !fact) {
      throw new ApprovalError(`Fact ${factId} not found.`);
    }

    if (fact.status !== FactStatus.DRAFT) {
      throw new ApprovalError(
        `Only Draft facts can be approved. Current status: ${fact.status}`
      );
    }

    const { error: updateError } = await this.supabase
      .from("memory_facts")
      .update({
        status: FactStatus.APPROVED,
        updated_at: new Date().toISOString(),
      })
      .eq("id", factId);

    if (updateError) throw updateError;

    const { data: approval, error: approvalError } = await this.supabase
      .from("memory_approvals")
      .insert({
        tenant_id: this.tenantId,
        resource_type: "fact",
        resource_id: factId,
        approver_id: context.approverId,
        decision: ApprovalDecision.APPROVED,
        comments: context.notes,
      })
      .select()
      .single();

    if (approvalError) throw approvalError;

    return {
      id: approval.id,
      object_id: factId,
      version: fact.version,
      approver_id: context.approverId,
      decision: ApprovalDecision.APPROVED,
      notes: context.notes,
      timestamp: new Date(),
    };
  }

  async rejectFact(
    factId: UUID,
    context: ApprovalContext
  ): Promise<ApprovalRecord> {
    const { data: fact, error: fetchError } = await this.supabase
      .from("memory_facts")
      .select("*")
      .eq("id", factId)
      .single();

    if (fetchError || !fact) {
      throw new ApprovalError(`Fact ${factId} not found.`);
    }

    const { data: approval, error: approvalError } = await this.supabase
      .from("memory_approvals")
      .insert({
        tenant_id: this.tenantId,
        resource_type: "fact",
        resource_id: factId,
        approver_id: context.approverId,
        decision: ApprovalDecision.REJECTED,
        comments: context.notes,
      })
      .select()
      .single();

    if (approvalError) throw approvalError;

    return {
      id: approval.id,
      object_id: factId,
      version: fact.version,
      approver_id: context.approverId,
      decision: ApprovalDecision.REJECTED,
      notes: context.notes,
      timestamp: new Date(),
    };
  }

  async approveNarrative(
    narrativeId: UUID,
    context: ApprovalContext
  ): Promise<ApprovalRecord> {
    const { data: narrative, error: fetchError } = await this.supabase
      .from("memory_narratives")
      .select("*")
      .eq("id", narrativeId)
      .single();

    if (fetchError || !narrative) {
      throw new ApprovalError(`Narrative ${narrativeId} not found.`);
    }

    if (
      narrative.status !== NarrativeStatus.DRAFT &&
      narrative.status !== NarrativeStatus.REVIEW
    ) {
      throw new ApprovalError(
        `Only Draft or Review narratives can be approved. Current status: ${narrative.status}`
      );
    }

    const { error: updateError } = await this.supabase
      .from("memory_narratives")
      .update({
        status: NarrativeStatus.FINAL,
        updated_at: new Date().toISOString(),
      })
      .eq("id", narrativeId);

    if (updateError) throw updateError;

    const { data: approval, error: approvalError } = await this.supabase
      .from("memory_approvals")
      .insert({
        tenant_id: this.tenantId,
        resource_type: "narrative",
        resource_id: narrativeId,
        approver_id: context.approverId,
        decision: ApprovalDecision.APPROVED,
        comments: context.notes,
      })
      .select()
      .single();

    if (approvalError) throw approvalError;

    return {
      id: approval.id,
      object_id: narrativeId,
      version: narrative.version,
      approver_id: context.approverId,
      decision: ApprovalDecision.APPROVED,
      notes: context.notes,
      timestamp: new Date(),
    };
  }

  async isExportable(
    resourceType: "fact" | "narrative",
    resourceId: UUID
  ): Promise<boolean> {
    const table =
      resourceType === "fact" ? "memory_facts" : "memory_narratives";
    const approvedStatus =
      resourceType === "fact" ? FactStatus.APPROVED : NarrativeStatus.FINAL;

    const { data, error } = await this.supabase
      .from(table)
      .select("status")
      .eq("id", resourceId)
      .single();

    if (error || !data) return false;

    return data.status === approvedStatus;
  }

  async getApprovalHistory(
    resourceType: "fact" | "narrative",
    resourceId: UUID
  ): Promise<ApprovalRecord[]> {
    const { data, error } = await this.supabase
      .from("memory_approvals")
      .select("*")
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((a) => ({
      id: a.id,
      object_id: a.resource_id,
      version: 1,
      approver_id: a.approver_id,
      decision: a.decision as ApprovalDecision,
      notes: a.comments,
      timestamp: new Date(a.created_at),
    }));
  }

  async deprecateFact(factId: UUID, context: ApprovalContext): Promise<void> {
    const { error } = await this.supabase
      .from("memory_facts")
      .update({
        status: FactStatus.DEPRECATED,
        updated_at: new Date().toISOString(),
      })
      .eq("id", factId);

    if (error) throw error;

    await this.supabase.from("memory_approvals").insert({
      tenant_id: this.tenantId,
      resource_type: "fact",
      resource_id: factId,
      approver_id: context.approverId,
      decision: "deprecated",
      comments: context.notes || "Deprecated by admin",
    });
  }
}
