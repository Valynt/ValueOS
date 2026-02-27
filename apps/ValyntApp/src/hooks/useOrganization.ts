/**
 * useOrganization hook
 *
 * Derives the current organization ID from TenantContext.
 * Replaces the previous hardcoded 'default-org-id' stub.
 */

import { useTenant } from "@/contexts/TenantContext";

export interface UseOrganizationReturn {
  organizationId: string | null;
  organizationName: string | null;
  isLoading: boolean;
}

export function useOrganization(): UseOrganizationReturn {
  const { currentTenant, isLoading } = useTenant();

  return {
    organizationId: currentTenant?.id ?? null,
    organizationName: currentTenant?.name ?? null,
    isLoading,
  };
}
