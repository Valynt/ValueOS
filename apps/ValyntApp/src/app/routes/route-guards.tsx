import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { Permission, PERMISSIONS } from "../../lib/permissions";
import { hasAllPermissions, hasAnyPermission } from "../../lib/permissions/types";

const ADMIN_ROLES = new Set(["ADMIN", "admin"]);

interface PermissionRouteProps {
  requiredPermissions?: Permission[];
  requireAnyPermissions?: Permission[];
  fallbackPath?: string;
  allowAdminBypass?: boolean;
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Authenticating...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function PermissionRoute({
  requiredPermissions = [],
  requireAnyPermissions = [],
  fallbackPath = "/dashboard",
  allowAdminBypass = true,
}: PermissionRouteProps) {
  const { user, userClaims, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Authorizing...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const effectivePermissions = userClaims?.permissions ?? [];
  const roles = userClaims?.roles ?? [];
  const isAdmin = allowAdminBypass && roles.some((role) => ADMIN_ROLES.has(role));
  const hasEveryRequiredPermission = hasAllPermissions(effectivePermissions, requiredPermissions);
  const hasAnyRequiredPermission =
    requireAnyPermissions.length === 0 ||
    hasAnyPermission(effectivePermissions, requireAnyPermissions);

  if (!isAdmin && (!hasEveryRequiredPermission || !hasAnyRequiredPermission)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}

export const SENSITIVE_ROUTE_PERMISSIONS = {
  ADMIN_AGENTS: [PERMISSIONS.ADMIN_MANAGE] as Permission[],
  INTEGRATIONS: [PERMISSIONS.SETTINGS_EDIT] as Permission[],
  SETTINGS: [PERMISSIONS.SETTINGS_EDIT] as Permission[],
  BILLING: [PERMISSIONS.BILLING_MANAGE] as Permission[],
};
