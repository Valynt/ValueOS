/**
 * React Query hooks for value cases.
 *
 * Replaces mock data constants in CasesPage, HomePage, and CaseWorkspace
 * with live Supabase queries scoped to the current tenant.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTenant } from "@/contexts/TenantContext";
import { CasesService } from "@/services/supabase/cases";
import type { ValueCaseInsert } from "@/services/supabase/types";

/** List all cases for the current tenant. */
export function useCasesList() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["cases", tenantId],
    queryFn: () => CasesService.listCases(tenantId!),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

/** Fetch a single case by ID. */
export function useCase(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["case", caseId, tenantId],
    queryFn: () => CasesService.getCase(caseId!, tenantId!),
    enabled: !!caseId && !!tenantId,
  });
}

/** Create a new case. Invalidates the cases list on success. */
export function useCreateCase() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: (input: Omit<ValueCaseInsert, "tenant_id">) =>
      CasesService.createCase({ ...input, tenant_id: tenantId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-value", tenantId] });
    },
  });
}

/** Portfolio value rollup for the current tenant. */
export function usePortfolioValue() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["portfolio-value", tenantId],
    queryFn: () => CasesService.getPortfolioValue(tenantId!),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

/** Recent cases (last 5) for the home page. */
export function useRecentCases(limit = 5) {
  const { data: allCases, ...rest } = useCasesList();

  return {
    ...rest,
    data: allCases?.slice(0, limit),
  };
}
