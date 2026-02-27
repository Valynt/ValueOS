/**
 * TenantGate
 *
 * Redirects authenticated users to /create-org when they have no tenants.
 * Sits above OnboardingGate in the route hierarchy.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";

export function TenantGate() {
  const { tenants, isLoading } = useTenant();
  const location = useLocation();

  // Don't gate the create-org page itself
  if (location.pathname.startsWith("/create-org")) {
    return <Outlet />;
  }

  // While loading, render children to avoid flash
  if (isLoading) {
    return <Outlet />;
  }

  // No tenants → redirect to org creation
  if (tenants.length === 0) {
    return <Navigate to="/create-org" replace />;
  }

  return <Outlet />;
}
