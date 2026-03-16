/**
 * BillingOverridesService
 *
 * Manages per-tenant custom pricing and temporary cap increases stored in
 * the `billing_overrides` table. Approval is delegated to BillingApprovalService.
 *
 * Tenant isolation: every query filters on organization_id.
 */

import { z } from 'zod';

import type { BillingMetric } from '../../config/billing.js';
import { createLogger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { BillingApprovalService } from './BillingApprovalService.js';

const logger = createLogger({ component: 'BillingOverridesService' });
const approvalService = new BillingApprovalService();

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const BillingOverrideTypeSchema = z.enum(['contract', 'temporary']);
export type BillingOverrideType = z.infer<typeof BillingOverrideTypeSchema>;

export const BillingOverrideStatusSchema = z.enum([
  'pending', 'approved', 'rejected', 'expired', 'cancelled',
]);
export type BillingOverrideStatus = z.infer<typeof BillingOverrideStatusSchema>;

export const CreateOverrideInputSchema = z.object({
  organizationId: z.string().uuid(),
  metric: z.enum(['llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats']),
  overrideType: BillingOverrideTypeSchema,
  customPrice: z.number().positive().optional(),
  capValue: z.number().int().positive().optional(),
  justification: z.string().min(10),
  requestedBy: z.string().uuid(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveEnd: z.string().datetime().optional(),
}).refine(
  (d) => d.overrideType !== 'temporary' || d.effectiveEnd !== undefined,
  { message: 'effectiveEnd is required for temporary overrides', path: ['effectiveEnd'] },
).refine(
  (d) => d.customPrice !== undefined || d.capValue !== undefined,
  { message: 'At least one of customPrice or capValue must be set' },
);

export type CreateOverrideInput = z.infer<typeof CreateOverrideInputSchema>;

export interface BillingOverride {
  id: string;
  organizationId: string;
  metric: BillingMetric;
  overrideType: BillingOverrideType;
  customPrice: number | null;
  capValue: number | null;
  status: BillingOverrideStatus;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  justification: string | null;
  effectiveFrom: string;
  effectiveEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class BillingOverridesService {
  /**
   * Request a new billing override. Creates a pending record and submits
   * an approval request via BillingApprovalService.
   */
  async requestOverride(input: CreateOverrideInput): Promise<BillingOverride> {
    const parsed = CreateOverrideInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid override input: ${parsed.error.message}`);
    }

    const { data, error } = await supabase
      .from('billing_overrides')
      .insert({
        organization_id: input.organizationId,
        metric: input.metric,
        override_type: input.overrideType,
        custom_price: input.customPrice ?? null,
        cap_value: input.capValue ?? null,
        justification: input.justification,
        requested_by: input.requestedBy,
        effective_from: input.effectiveFrom ?? new Date().toISOString(),
        effective_end: input.effectiveEnd ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !data) {
      logger.error('Failed to create billing override', { error: error?.message, organizationId: input.organizationId });
      throw new Error(`Failed to create billing override: ${error?.message}`);
    }

    logger.info('Billing override requested', {
      id: data.id,
      organizationId: input.organizationId,
      metric: input.metric,
      overrideType: input.overrideType,
    });

    // Submit to approval workflow
    try {
      await approvalService.createApprovalRequest(
        input.organizationId,
        'increase_cap',
        {
          overrideId: data.id,
          metric: input.metric,
          overrideType: input.overrideType,
          capValue: input.capValue ?? null,
          customPrice: input.customPrice ?? null,
          effectiveEnd: input.effectiveEnd ?? null,
          justification: input.justification,
        },
        input.requestedBy,
      );
    } catch (approvalErr) {
      // Non-fatal — override record exists; approval can be re-submitted
      logger.error('Failed to submit approval request for billing override', {
        error: (approvalErr as Error).message,
        overrideId: data.id,
      });
    }

    return this.mapRow(data);
  }

  /**
   * Approve a pending override. Sets status to 'approved' and records approver.
   */
  async approveOverride(
    overrideId: string,
    organizationId: string,
    approvedBy: string,
  ): Promise<BillingOverride> {
    const { data, error } = await supabase
      .from('billing_overrides')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', overrideId)
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to approve override ${overrideId}: ${error?.message}`);
    }

    logger.info('Billing override approved', { id: overrideId, approvedBy, organizationId });
    return this.mapRow(data);
  }

  /**
   * List active (approved, not expired) overrides for a tenant.
   */
  async getActiveOverrides(organizationId: string): Promise<BillingOverride[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('billing_overrides')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'approved')
      .lte('effective_from', now)
      .or(`effective_end.is.null,effective_end.gt.${now}`);

    if (error) {
      throw new Error(`Failed to fetch active overrides: ${error.message}`);
    }

    return (data ?? []).map(this.mapRow);
  }

  /**
   * List all overrides for a tenant (any status), for admin views.
   */
  async listOverrides(organizationId: string): Promise<BillingOverride[]> {
    const { data, error } = await supabase
      .from('billing_overrides')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list overrides: ${error.message}`);
    }

    return (data ?? []).map(this.mapRow);
  }

  /**
   * Expire overrides whose effective_end has passed.
   * Called by a cron job or on-demand.
   */
  async expireStaleOverrides(): Promise<number> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('billing_overrides')
      .update({ status: 'expired' })
      .eq('status', 'approved')
      .lt('effective_end', now)
      .select('id');

    if (error) {
      logger.error('Failed to expire stale overrides', { error: error.message });
      return 0;
    }

    const count = data?.length ?? 0;
    if (count > 0) {
      logger.info('Expired stale billing overrides', { count });
    }
    return count;
  }

  private mapRow(row: Record<string, unknown>): BillingOverride {
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      metric: row.metric as BillingMetric,
      overrideType: row.override_type as BillingOverrideType,
      customPrice: row.custom_price as number | null,
      capValue: row.cap_value as number | null,
      status: row.status as BillingOverrideStatus,
      requestedBy: row.requested_by as string,
      approvedBy: row.approved_by as string | null,
      approvedAt: row.approved_at as string | null,
      justification: row.justification as string | null,
      effectiveFrom: row.effective_from as string,
      effectiveEnd: row.effective_end as string | null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export const billingOverridesService = new BillingOverridesService();
