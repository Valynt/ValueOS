/**
 * TenantGate
 *
 * Route guard that blocks child routes until tenant context resolves.
 * Handles three states: loading, error, and no-tenants.
 * Without this, downstream providers (CompanyContextProvider, OnboardingGate)
 * receive currentTenant=null during loading, causing false onboarding redirects.
 *
 * When user has no tenants, redirects to /create-org so they can provision one.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function TenantGate() {
  const { currentTenant, isLoading, error, refreshTenants, tenants } = useTenant();
  const { logout } = useAuth();
  const location = useLocation();

  // Don't gate the create-org page itself
  if (location.pathname.startsWith("/create-org")) {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa] px-4">
        <div className="max-w-sm w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 mb-1">
            Unable to load workspace
          </h1>
          <p className="text-sm text-zinc-500 mb-6">
            {error.message || "Something went wrong while loading your workspace. Please try again."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => refreshTenants()} variant="default" size="default">
              <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Retry
            </Button>
            <Button onClick={() => logout()} variant="outline" size="default">
              <LogOut className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No tenants → redirect to org creation flow
  if (tenants.length === 0 || !currentTenant) {
    return <Navigate to="/create-org" replace />;
  }

  return <Outlet />;
}
