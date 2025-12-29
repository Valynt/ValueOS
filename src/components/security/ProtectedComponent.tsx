/**
 * Protected Component - Zero Trust Security Wrapper
 * SOC 2 Compliance: CC6.1 (Access Control), CC6.8 (Audit Logging)
 *
 * Enforces render-level authorization to prevent UI leakage
 */

import React, { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Permission } from "@/types/security";
import { logSecurityEvent } from "@/services/security/auditLogger";
import { AlertTriangle, Lock } from "lucide-react";

interface ProtectedComponentProps {
  children: React.ReactNode;
  requiredPermissions: Permission[];
  fallback?: React.ReactNode; // Custom error UI
  resourceName: string; // For audit logging (e.g., "FinancialDashboard")
  silent?: boolean; // If true, renders nothing instead of error UI
}

export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  children,
  requiredPermissions,
  fallback,
  resourceName,
  silent = false,
}) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const hasLoggedRef = useRef(false); // Prevent duplicate logs on re-renders

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="animate-pulse h-full w-full bg-gray-100 dark:bg-gray-800 rounded" />
    );
  }

  // 2. Logic: Check Permissions
  const hasAccess = (() => {
    if (!isAuthenticated || !user) return false;

    // Check if user has ALL required permissions
    return requiredPermissions.every((p) => user.permissions.includes(p));
  })();

  // 3. Side Effect: Audit Logging
  useEffect(() => {
    if (!isLoading && !hasAccess && !hasLoggedRef.current) {
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        userId: user?.sub || "anonymous",
        action: "ACCESS_DENIED",
        resource: resourceName,
        requiredPermissions: requiredPermissions,
        userPermissions: user?.permissions || [],
      });
      hasLoggedRef.current = true;
    }
  }, [isLoading, hasAccess, user, resourceName, requiredPermissions]);

  // 4. Render Logic
  if (hasAccess) {
    return <>{children}</>;
  }

  // 5. Fallback UI (Access Denied)
  if (silent) return null;

  return fallback ? (
    <>{fallback}</>
  ) : (
    <div className="flex flex-col items-center justify-center p-8 border-2 border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950 rounded-lg text-center h-full min-h-[200px]">
      <div className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-4">
        <Lock className="w-6 h-6 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Access Restricted
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-xs">
        You do not have permission to view <strong>{resourceName}</strong>.
      </p>
      <div className="mt-4 text-xs text-gray-400 dark:text-gray-500 font-mono">
        Missing:{" "}
        {requiredPermissions
          .filter((p) => !user?.permissions.includes(p))
          .join(", ")}
      </div>
      {user && (
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Your roles: {user.roles.join(", ")}
        </div>
      )}
    </div>
  );
};

export default ProtectedComponent;
