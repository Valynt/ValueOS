/**
 * useConfigAccess
 *
 * Hook for checking configuration setting access permissions based on
 * CONFIGURATION_ACCESS_MATRIX and user role.
 */

import { useCallback, useMemo } from "react";

import {
  CONFIGURATION_ACCESS_MATRIX,
  type AccessLevel,
  type ConfigCategory,
} from "@/config/settingsMatrix";

// ============================================================================
// Types
// ============================================================================

export type UserRole = "tenant_admin" | "vendor_admin" | "user" | "viewer";

export type ConfigPermission = "none" | "view_only" | "edit" | "admin";

export interface AccessCheckResult {
  /** Whether user has any access to this setting */
  canView: boolean;
  /** Whether user can edit this setting */
  canEdit: boolean;
  /** Whether user can admin (delete/manage) this setting */
  canAdmin: boolean;
  /** The required access level from the matrix */
  requiredLevel: AccessLevel;
  /** The user's effective access level */
  userLevel: AccessLevel;
  /** Setting metadata */
  category?: ConfigCategory;
  /** Description of access denial if canView is false */
  denialReason?: string;
}

export interface UseConfigAccessResult {
  /** Check access for a specific setting */
  checkAccess: (setting: string) => AccessCheckResult;
  /** Get all settings accessible to user */
  getAccessibleSettings: (category?: ConfigCategory) => string[];
  /** Get settings by permission level */
  getSettingsByPermission: (permission: ConfigPermission) => string[];
  /** User's role */
  userRole: UserRole;
  /** Whether user is any kind of admin */
  isAdmin: boolean;
}

// ============================================================================
// Access Hierarchy
// ============================================================================

const ACCESS_HIERARCHY: AccessLevel[] = ["none", "view_only", "tenant_admin", "vendor_admin"];

/**
 * Get numeric level for access comparison
 */
function getAccessLevelNumber(level: AccessLevel): number {
  return ACCESS_HIERARCHY.indexOf(level);
}

/**
 * Determine user's effective access level based on role
 */
function getUserAccessLevel(role: UserRole): AccessLevel {
  switch (role) {
    case "vendor_admin":
      return "vendor_admin";
    case "tenant_admin":
      return "tenant_admin";
    case "user":
      return "view_only";
    case "viewer":
    default:
      return "none";
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for checking configuration access permissions
 */
export function useConfigAccess(userRole: UserRole): UseConfigAccessResult {
  const userLevel = useMemo(() => getUserAccessLevel(userRole), [userRole]);

  /**
   * Check access for a specific setting
   */
  const checkAccess = useCallback(
    (setting: string): AccessCheckResult => {
      // Find setting in matrix
      const config = CONFIGURATION_ACCESS_MATRIX.find((c) => c.setting === setting);

      if (!config) {
        // Unknown setting - default to no access
        return {
          canView: false,
          canEdit: false,
          canAdmin: false,
          requiredLevel: "none",
          userLevel,
          denialReason: "Setting not found in access matrix",
        };
      }

      // Determine required access level for editing
      // vendor_admin can edit if either tenantAdmin or vendorAdmin allows edit
      // tenant_admin can only edit if tenantAdmin allows edit
      let requiredLevel: AccessLevel;
      if (userRole === "vendor_admin") {
        requiredLevel = config.vendorAdmin === "none" ? config.tenantAdmin : config.vendorAdmin;
      } else {
        requiredLevel = config.tenantAdmin;
      }

      const userLevelNum = getAccessLevelNumber(userLevel);
      const requiredLevelNum = getAccessLevelNumber(requiredLevel);

      // View access: view_only or higher
      const canView = userLevelNum >= getAccessLevelNumber("view_only");

      // Edit access: meets required level
      const canEdit = userLevelNum >= requiredLevelNum && requiredLevel !== "none";

      // Admin access: vendor_admin for sensitive settings
      const canAdmin = userLevelNum >= getAccessLevelNumber("vendor_admin");

      let denialReason: string | undefined;
      if (!canView) {
        denialReason = "You do not have permission to view this setting";
      } else if (!canEdit) {
        denialReason = `This setting requires ${requiredLevel.replace("_", " ")} access`;
      }

      return {
        canView,
        canEdit,
        canAdmin,
        requiredLevel,
        userLevel,
        category: config.category,
        denialReason,
      };
    },
    [userLevel, userRole]
  );

  /**
   * Get all settings accessible to user (optionally filtered by category)
   */
  const getAccessibleSettings = useCallback(
    (category?: ConfigCategory): string[] => {
      return CONFIGURATION_ACCESS_MATRIX.filter((config) => {
        // Filter by category if provided
        if (category && config.category !== category) {
          return false;
        }

        // Check if user has at least view access
        const userLevelNum = getAccessLevelNumber(userLevel);
        return userLevelNum >= getAccessLevelNumber("view_only");
      }).map((config) => config.setting);
    },
    [userLevel]
  );

  /**
   * Get settings filtered by permission level
   */
  const getSettingsByPermission = useCallback(
    (permission: ConfigPermission): string[] => {
      return CONFIGURATION_ACCESS_MATRIX.filter((config) => {
        const access = checkAccess(config.setting);

        switch (permission) {
          case "none":
            return !access.canView;
          case "view_only":
            return access.canView && !access.canEdit;
          case "edit":
            return access.canEdit && !access.canAdmin;
          case "admin":
            return access.canAdmin;
          default:
            return false;
        }
      }).map((config) => config.setting);
    },
    [checkAccess]
  );

  const isAdmin = userRole === "tenant_admin" || userRole === "vendor_admin";

  return {
    checkAccess,
    getAccessibleSettings,
    getSettingsByPermission,
    userRole,
    isAdmin,
  };
}

/**
 * Convenience hook for checking a single setting's access
 */
export function useSettingAccess(setting: string, userRole: UserRole): AccessCheckResult {
  const { checkAccess } = useConfigAccess(userRole);
  return useMemo(() => checkAccess(setting), [checkAccess, setting]);
}

/**
 * Hook to determine if user should see vendor-level settings
 */
export function useVendorMode(userRole: UserRole): boolean {
  return userRole === "vendor_admin";
}

/**
 * Component helper: conditionally render based on access
 */
export function useAccessGate(userRole: UserRole) {
  const { checkAccess, isAdmin } = useConfigAccess(userRole);

  const requireView = useCallback(
    (setting: string): boolean => {
      return checkAccess(setting).canView;
    },
    [checkAccess]
  );

  const requireEdit = useCallback(
    (setting: string): boolean => {
      return checkAccess(setting).canEdit;
    },
    [checkAccess]
  );

  const requireAdmin = useCallback(
    (setting: string): boolean => {
      return checkAccess(setting).canAdmin;
    },
    [checkAccess]
  );

  return {
    requireView,
    requireEdit,
    requireAdmin,
    isAdmin,
  };
}
