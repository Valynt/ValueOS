/**
 * TenantGate
 *
 * Route guard that blocks child routes until tenant context resolves.
 * Handles three states: loading, error, and no-tenants.
 * Without this, downstream providers (CompanyContextProvider, OnboardingGate)
 * receive currentTenant=null during loading, causing false onboarding redirects.
 */

import { Outlet } from "react-router-dom";
import { AlertTriangle, Building2, RefreshCw, LogOut } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function TenantGate() {
  const { currentTenant, isLoading, error, refreshTenants, tenants } = useTenant();
  const { logout } = useAuth();

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

  if (tenants.length === 0 || !currentTenant) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa] px-4">
        <div className="max-w-sm w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
            <Building2 className="h-6 w-6 text-zinc-400" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 mb-1">
            No workspace found
          </h1>
          <p className="text-sm text-zinc-500 mb-6">
            Your account isn&apos;t associated with any workspace yet.
            Contact your administrator or sign in with a different account.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => refreshTenants()} variant="default" size="default">
              <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Refresh
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

  return <Outlet />;
}
