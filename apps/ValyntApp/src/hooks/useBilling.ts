/**
 * React Query hooks for Billing operations.
 *
 * Covers: billing summary, plan management, usage tracking, invoice viewing, approval workflows.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §4.6
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ============================================================================
// Types
// ============================================================================

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing" | "paused";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalDecision = "approve" | "reject";

export interface BillingSummary {
  subscription: {
    id: string;
    status: SubscriptionStatus;
    currentPlan: string;
    currentPlanId: string;
    mrr: number;
    billingPeriod: {
      start: string;
      end: string;
    };
    renewalDate: string;
  };
  usage: {
    aiTokens: {
      used: number;
      cap: number;
      percentage: number;
    };
    apiCalls: {
      used: number;
      cap: number;
      percentage: number;
    };
  };
  recentInvoice?: {
    id: string;
    period: string;
    amount: number;
    status: "paid" | "open" | "overdue";
    dueDate: string;
  };
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  limits: {
    aiTokens: number;
    apiCalls: number;
    seats: number;
  };
  isCurrent: boolean;
}

export interface PlanChangePreview {
  currentPlan: string;
  newPlan: string;
  deltaMrr: number;
  prorationAmount: number;
  effectiveDate: string;
  requiresApproval: boolean;
  approvalThreshold?: number;
}

export interface Invoice {
  id: string;
  number: string;
  period: {
    start: string;
    end: string;
  };
  amount: number;
  status: "paid" | "open" | "overdue" | "draft";
  dueDate: string;
  paidAt?: string;
  pdfUrl?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export interface UsageData {
  period: {
    start: string;
    end: string;
  };
  meters: Array<{
    key: string;
    name: string;
    used: number;
    cap: number;
    unit: string;
    trend: "up" | "down" | "flat";
    trendPercentage: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    aiTokens: number;
    apiCalls: number;
  }>;
}

export interface ApprovalRequest {
  id: string;
  requester: {
    id: string;
    name: string;
    email: string;
  };
  action: string;
  details: string;
  deltaMrr: number;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface PlanChangeInput {
  newPlanId: string;
  effectiveDate?: string;
}

// ============================================================================
// Billing Summary Hooks
// ============================================================================

/**
 * Fetch billing summary for the current tenant.
 * GET /billing/summary
 */
export function useBillingSummary() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<BillingSummary>({
    queryKey: ["billingSummary", tenantId],
    queryFn: async () => {
      const response = await api.getBillingSummary();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch billing summary");
      }
      return response.data as BillingSummary;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

// ============================================================================
// Plan Management Hooks
// ============================================================================

/**
 * Fetch available plans.
 * GET /billing/plans
 */
export function usePlans() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<Plan[]>({
    queryKey: ["plans", tenantId],
    queryFn: async () => {
      const response = await api.getPlans();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch plans");
      }
      return response.data as Plan[];
    },
    enabled: !!tenantId,
    staleTime: 60_000, // Plans rarely change
  });
}

/**
 * Preview a plan change before committing.
 * POST /billing/plan-change/preview
 */
export function usePlanChangePreview() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async (input: PlanChangeInput) => {
      const response = await api.previewPlanChange(input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to preview plan change");
      }
      return response.data as PlanChangePreview;
    },
  });
}

/**
 * Submit a plan change.
 * POST /billing/plan-change/submit
 */
export function useSubmitPlanChange() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async (input: PlanChangeInput) => {
      const response = await api.submitPlanChange(input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to submit plan change");
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate billing data to reflect new plan
      queryClient.invalidateQueries({ queryKey: ["billingSummary", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["plans", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["approvals", tenantId] });
    },
  });
}

// ============================================================================
// Invoice Hooks
// ============================================================================

/**
 * Fetch invoices for the current tenant.
 * GET /billing/invoices
 */
export function useInvoices() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<Invoice[]>({
    queryKey: ["invoices", tenantId],
    queryFn: async () => {
      const response = await api.getInvoices();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch invoices");
      }
      return response.data as Invoice[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

// ============================================================================
// Usage Hooks
// ============================================================================

/**
 * Fetch usage data for the current tenant.
 * GET /billing/usage
 */
export function useUsage() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<UsageData>({
    queryKey: ["usage", tenantId],
    queryFn: async () => {
      const response = await api.getUsage();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch usage");
      }
      return response.data as UsageData;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

// ============================================================================
// Approval Workflow Hooks
// ============================================================================

/**
 * Fetch pending approval requests.
 * GET /billing/approvals
 */
export function useApprovals() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<ApprovalRequest[]>({
    queryKey: ["approvals", tenantId],
    queryFn: async () => {
      const response = await api.getApprovals();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch approvals");
      }
      return response.data as ApprovalRequest[];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Approve or reject a billing approval request.
 * POST /billing/approvals/:id/decide
 */
export function useDecideApproval() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async ({ approvalId, decision }: { approvalId: string; decision: ApprovalDecision }) => {
      const response = await api.decideApproval(approvalId, decision);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to process approval decision");
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate approvals and billing data
      queryClient.invalidateQueries({ queryKey: ["approvals", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["billingSummary", tenantId] });
    },
  });
}
