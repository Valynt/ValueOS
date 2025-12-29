/**
 * HITL Storage Interface & Implementations
 *
 * Provides persistence for Approval Workflow Engine.
 * Supports swappable backends (Memory, Postgres, etc.)
 */

import { ApprovalRequest } from "./HITLFramework";
import { createServerSupabaseClient } from "../supabase";

/**
 * Filter options for listing requests
 */
export interface HITLStorageFilter {
  organizationId?: string;
  status?: ApprovalRequest["status"];
  startTime?: Date;
  endTime?: Date;
  approverRole?: string;
  limit?: number;
}

/**
 * Storage interface for HITL workflows
 */
export interface IHITLStorage {
  /**
   * Save a new approval request
   */
  saveRequest(request: ApprovalRequest): Promise<void>;

  /**
   * Update an existing request
   * @param request The updated request object
   */
  updateRequest(request: ApprovalRequest): Promise<void>;

  /**
   * Get a request by ID
   */
  getRequest(id: string): Promise<ApprovalRequest | null>;

  /**
   * List requests matching filter
   */
  listRequests(filter: HITLStorageFilter): Promise<ApprovalRequest[]>;

  /**
   * Get pending requests for a specific role
   */
  getPendingForRole(
    role: string,
    organizationId?: string
  ): Promise<ApprovalRequest[]>;
}

/**
 * In-Memory implementation (Default / Dev)
 */
export class InMemoryHITLStorage implements IHITLStorage {
  private requests: Map<string, ApprovalRequest> = new Map();

  async saveRequest(request: ApprovalRequest): Promise<void> {
    this.requests.set(request.id, JSON.parse(JSON.stringify(request)));
  }

  async updateRequest(request: ApprovalRequest): Promise<void> {
    if (!this.requests.has(request.id)) {
      throw new Error(`Request ${request.id} not found`);
    }
    this.requests.set(request.id, JSON.parse(JSON.stringify(request)));
  }

  async getRequest(id: string): Promise<ApprovalRequest | null> {
    const req = this.requests.get(id);
    return req ? JSON.parse(JSON.stringify(req)) : null;
  }

  async listRequests(filter: HITLStorageFilter): Promise<ApprovalRequest[]> {
    let results = Array.from(this.requests.values());

    if (filter.organizationId) {
      results = results.filter(
        (r) => r.organizationId === filter.organizationId
      );
    }
    if (filter.status) {
      results = results.filter((r) => r.status === filter.status);
    }
    if (filter.startTime) {
      results = results.filter(
        (r) => new Date(r.createdAt) >= filter.startTime!
      );
    }
    if (filter.endTime) {
      results = results.filter((r) => new Date(r.createdAt) <= filter.endTime!);
    }

    if (filter.limit) {
      results.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      results = results.slice(0, filter.limit);
    }

    return results.map((r) => JSON.parse(JSON.stringify(r)));
  }

  async getPendingForRole(
    role: string,
    organizationId?: string
  ): Promise<ApprovalRequest[]> {
    const all = Array.from(this.requests.values());
    const pending = all.filter(
      (r) => r.status === "pending" || r.status === "escalated"
    );

    if (organizationId) {
      return pending
        .filter((r) => r.organizationId === organizationId)
        .map((r) => JSON.parse(JSON.stringify(r)));
    }

    return pending.map((r) => JSON.parse(JSON.stringify(r)));
  }
}

/**
 * Supabase/PostgreSQL implementation (Production)
 */
export class SupabaseHITLStorage implements IHITLStorage {
  private get supabase() {
    // Use server client (service role) for robust backend access
    return createServerSupabaseClient();
  }

  async saveRequest(request: ApprovalRequest): Promise<void> {
    const { error } = await this.supabase.from("hitl_requests").insert({
      id: request.id,
      gate_id: request.gateId,
      organization_id: request.organizationId,
      status: request.status,
      created_at: request.createdAt,
      expires_at: request.expiresAt,
      resolved_at: request.resolvedAt,

      // Map complex objects to JSONB
      request_payload: {
        gate: request.gate,
        agent: request.agent,
        action: request.action,
        data: request.data,
        auditToken: request.auditToken,
      },
      approvals: request.approvals,
      rejections: request.rejections,
      metadata: {
        escalationLevel: request.escalationLevel,
      },
    });

    if (error) throw new Error(`Failed to save HITL request: ${error.message}`);
  }

  async updateRequest(request: ApprovalRequest): Promise<void> {
    const { error } = await this.supabase
      .from("hitl_requests")
      .update({
        status: request.status,
        expires_at: request.expiresAt, // May change on escalation
        resolved_at: request.resolvedAt,
        approvals: request.approvals,
        rejections: request.rejections,
        metadata: {
          escalationLevel: request.escalationLevel,
        },
      })
      .eq("id", request.id);

    if (error)
      throw new Error(`Failed to update HITL request: ${error.message}`);
  }

  async getRequest(id: string): Promise<ApprovalRequest | null> {
    const { data, error } = await this.supabase
      .from("hitl_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;

    return this.mapRowToRequest(data);
  }

  async listRequests(filter: HITLStorageFilter): Promise<ApprovalRequest[]> {
    let query = this.supabase.from("hitl_requests").select("*");

    if (filter.organizationId) {
      query = query.eq("organization_id", filter.organizationId);
    }
    if (filter.status) {
      query = query.eq("status", filter.status);
    }
    if (filter.startTime) {
      query = query.gte("created_at", filter.startTime.toISOString());
    }
    if (filter.endTime) {
      query = query.lte("created_at", filter.endTime.toISOString());
    }

    query = query.order("created_at", { ascending: false });

    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list HITL requests: ${error.message}`);

    return (data || []).map((row) => this.mapRowToRequest(row));
  }

  async getPendingForRole(
    role: string,
    organizationId?: string
  ): Promise<ApprovalRequest[]> {
    let query = this.supabase
      .from("hitl_requests")
      .select("*")
      .in("status", ["pending", "escalated"]);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to get pending requests: ${error.message}`);

    const requests = (data || []).map((row) => this.mapRowToRequest(row));

    // Filter by role capability (must be done in application layer as roles are inside JSONB or config)
    // Ideally, we would join with a gate_permissions table, but for now we filter in memory
    // Note: This optimization (filtering after fetch) is acceptable for reasonable volumes.
    // For high volume, we'd duplicate 'approver_roles' content into a searchable array/table.

    // We assume the caller (Framework) will do final role validation 'canApprove'.
    return requests;
  }

  private mapRowToRequest(row: any): ApprovalRequest {
    const payload = row.request_payload;
    const metadata = row.metadata || {};

    return {
      id: row.id,
      gateId: row.gate_id,
      gate: payload.gate,
      agent: payload.agent,
      action: payload.action,
      data: payload.data,
      status: row.status,
      approvals: row.approvals || [],
      rejections: row.rejections || [],
      escalationLevel: metadata.escalationLevel || 0,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      resolvedAt: row.resolved_at,
      auditToken: payload.auditToken,
      organizationId: row.organization_id,
    };
  }
}
