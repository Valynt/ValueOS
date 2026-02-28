import { createContext, type ReactNode, useContext } from "react";

import { useTenant } from "@/contexts/TenantContext";
import { useCompanyContext, useOnboardingStatus } from "@/hooks/company-context";
import type { CompanyValueContext } from "@/hooks/company-context/types";

interface CompanyContextState {
  /** Full hydrated company context, null if not yet onboarded */
  companyContext: CompanyValueContext | null;
  /** Loading state */
  isLoading: boolean;
  /** Onboarding status: 'none' means no context exists yet */
  onboardingStatus: "none" | "pending" | "in_progress" | "completed" | "needs_refresh";
  /** Whether onboarding is complete and context is usable */
  isReady: boolean;
  /** Refetch the context */
  refetch: () => void;
}

const CompanyCtx = createContext<CompanyContextState>({
  companyContext: null,
  isLoading: true,
  onboardingStatus: "none",
  isReady: false,
  refetch: () => {},
});

export function CompanyContextProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const {
    data: companyContext,
    isLoading: contextLoading,
    refetch,
  } = useCompanyContext(tenantId);

  const { data: status, isLoading: statusLoading } = useOnboardingStatus(tenantId);

  const isLoading = contextLoading || statusLoading;
  const onboardingStatus = status ?? "none";
  const isReady = onboardingStatus === "completed" && companyContext !== null;

  return (
    <CompanyCtx.Provider
      value={{
        companyContext: companyContext ?? null,
        isLoading,
        onboardingStatus,
        isReady,
        refetch,
      }}
    >
      {children}
    </CompanyCtx.Provider>
  );
}

export function useCompanyValueContext() {
  return useContext(CompanyCtx);
}
