/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 * Enforces RBAC permissions when specified
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { AccessDenied } from "./AccessDenied";
import type { Permission } from "../../lib/permissions";
import { hasAllPermissions, hasAnyPermission } from "../../lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Required permissions - user must have ALL of these */
  requiredPermissions?: Permission[];
  /** Alternative permissions - user must have ANY of these */
  anyPermissions?: Permission[];
  /** Custom fallback component when access is denied */
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  anyPermissions,
  fallback,
}: ProtectedRouteProps) {
  const { user, userClaims, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check RBAC permissions if specified
  const userPermissions = userClaims?.permissions as string[] | undefined;

  // Check required permissions (must have ALL)
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!hasAllPermissions(userPermissions, requiredPermissions)) {
      if (fallback) return <>{fallback}</>;
      return (
        <AccessDenied
          title="Access Denied"
          message="You don't have the required permissions to access this page."
          requiredPermission={requiredPermissions.join(", ")}
        />
      );
    }
  }

  // Check any permissions (must have at least ONE)
  if (anyPermissions && anyPermissions.length > 0) {
    if (!hasAnyPermission(userPermissions, anyPermissions)) {
      if (fallback) return <>{fallback}</>;
      return (
        <AccessDenied
          title="Access Denied"
          message="You don't have the required permissions to access this page."
          requiredPermission={`One of: ${anyPermissions.join(", ")}`}
        />
      );
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
