import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { Permission, PERMISSIONS } from "../../lib/permissions";

const ADMIN_ROLES = new Set(["ADMIN", "admin"]);

interface PermissionRouteProps {
  requiredPermissions: Permission[];
  fallbackPath?: string;
}

function hasRequiredPermissions(userPermissions: string[], requiredPermissions: Permission[]) {
  if (requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.every((permission) => userPermissions.includes(permission));
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
  requiredPermissions,
  fallbackPath = "/dashboard",
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
  const isAdmin = roles.some((role) => ADMIN_ROLES.has(role));

  if (!isAdmin && !hasRequiredPermissions(effectivePermissions, requiredPermissions)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}

export const SENSITIVE_ROUTE_PERMISSIONS = {
  INTEGRATIONS: [PERMISSIONS.ADMIN_ACCESS] as Permission[],
  SETTINGS: [PERMISSIONS.SETTINGS_EDIT] as Permission[],
};
