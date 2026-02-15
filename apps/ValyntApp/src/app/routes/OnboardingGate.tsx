import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCompanyValueContext } from "@/contexts/CompanyContextProvider";
import { useTenant } from "@/contexts/TenantContext";
import { isOnboardingBypassed } from "@/lib/onboarding-bypass";

/**
 * Redirects authenticated users to /onboarding if their tenant
 * has no company context yet. Skips the gate for the /onboarding
 * route itself to avoid redirect loops.
 */
export function OnboardingGate() {
  const { onboardingStatus, isLoading } = useCompanyValueContext();
  const { currentTenant } = useTenant();
  const location = useLocation();

  const hasBypassedOnboarding = isOnboardingBypassed(currentTenant?.id);

  // Don't gate the onboarding page itself, or settings (where they might configure things)
  const exempt = location.pathname.startsWith("/onboarding") || location.pathname.startsWith("/settings");
  if (exempt) return <Outlet />;

  // While loading, render children — avoids flash
  if (isLoading) return <Outlet />;

  // If no context exists or onboarding is incomplete, redirect
  if ((onboardingStatus === "none" || onboardingStatus === "pending") && !hasBypassedOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
