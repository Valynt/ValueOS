/**
 * Guest Permissions System
 *
 * Manages permission checks and access control for guest users
 */

import { logger } from "./lib/logger";

import { GuestPermissions } from "@/GuestAccessService";

// Permission action types
export enum PermissionAction {
  VIEW = "view",
  COMMENT = "comment",
  EDIT = "edit",
  EXPORT = "export",
  SHARE = "share",
}

// Resource types
export enum ResourceType {
  VALUE_CASE = "value_case",
  CANVAS_ELEMENT = "canvas_element",
  METRIC = "metric",
  COMMENT = "comment",
  BENCHMARK = "benchmark",
}

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

class GuestPermissionManager {
  /**
   * Check if guest has permission for an action
   */
  public checkPermission(
    permissions: GuestPermissions,
    action: PermissionAction,
    resource: ResourceType
  ): PermissionCheckResult {
    // View permission
    if (action === PermissionAction.VIEW) {
      if (!permissions.can_view) {
        return {
          allowed: false,
          reason: "Guest does not have view permission",
        };
      }
      return { allowed: true };
    }

    // Comment permission
    if (action === PermissionAction.COMMENT) {
      if (!permissions.can_view) {
        return {
          allowed: false,
          reason: "Guest must have view permission to comment",
        };
      }
      if (!permissions.can_comment) {
        return {
          allowed: false,
          reason: "Guest does not have comment permission",
        };
      }
      return { allowed: true };
    }

    // Edit permission
    if (action === PermissionAction.EDIT) {
      if (!permissions.can_view) {
        return {
          allowed: false,
          reason: "Guest must have view permission to edit",
        };
      }
      if (!permissions.can_edit) {
        return {
          allowed: false,
          reason: "Guest does not have edit permission",
        };
      }
      return { allowed: true };
    }

    // Export permission (requires view)
    if (action === PermissionAction.EXPORT) {
      if (!permissions.can_view) {
        return {
          allowed: false,
          reason: "Guest must have view permission to export",
        };
      }
      return { allowed: true };
    }

    // Share permission (requires view)
    if (action === PermissionAction.SHARE) {
      if (!permissions.can_view) {
        return {
          allowed: false,
          reason: "Guest must have view permission to share",
        };
      }
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "Unknown permission action",
    };
  }

  /**
   * Check multiple permissions at once
   */
  public checkMultiplePermissions(
    permissions: GuestPermissions,
    checks: Array<{ action: PermissionAction; resource: ResourceType }>
  ): Record<string, PermissionCheckResult> {
    const results: Record<string, PermissionCheckResult> = {};

    checks.forEach(({ action, resource }) => {
      const key = `${action}:${resource}`;
      results[key] = this.checkPermission(permissions, action, resource);
    });

    return results;
  }

  /**
   * Get allowed actions for guest
   */
  public getAllowedActions(permissions: GuestPermissions): PermissionAction[] {
    const allowed: PermissionAction[] = [];

    if (permissions.can_view) {
      allowed.push(PermissionAction.VIEW);
      allowed.push(PermissionAction.EXPORT);
      allowed.push(PermissionAction.SHARE);
    }

    if (permissions.can_comment) {
      allowed.push(PermissionAction.COMMENT);
    }

    if (permissions.can_edit) {
      allowed.push(PermissionAction.EDIT);
    }

    return allowed;
  }

  /**
   * Get permission summary
   */
  public getPermissionSummary(permissions: GuestPermissions): {
    level: "view-only" | "comment" | "edit";
    description: string;
    actions: string[];
  } {
    if (permissions.can_edit) {
      return {
        level: "edit",
        description: "Can view, comment, and edit",
        actions: [
          "View all content",
          "Add comments",
          "Edit elements",
          "Export reports",
          "Share via email",
        ],
      };
    }

    if (permissions.can_comment) {
      return {
        level: "comment",
        description: "Can view and comment",
        actions: ["View all content", "Add comments", "Export reports", "Share via email"],
      };
    }

    return {
      level: "view-only",
      description: "Can only view",
      actions: ["View all content", "Export reports", "Share via email"],
    };
  }

  /**
   * Create permission preset
   */
  public createPermissionPreset(preset: "view-only" | "comment" | "edit"): GuestPermissions {
    switch (preset) {
      case "view-only":
        return {
          can_view: true,
          can_comment: false,
          can_edit: false,
        };

      case "comment":
        return {
          can_view: true,
          can_comment: true,
          can_edit: false,
        };

      case "edit":
        return {
          can_view: true,
          can_comment: true,
          can_edit: true,
        };

      default:
        return {
          can_view: true,
          can_comment: false,
          can_edit: false,
        };
    }
  }

  /**
   * Validate permissions object
   */
  public validatePermissions(permissions: unknown): permissions is GuestPermissions {
    if (typeof permissions !== "object" || permissions === null) {
      return false;
    }

    if (typeof permissions.can_view !== "boolean") {
      return false;
    }

    if (typeof permissions.can_comment !== "boolean") {
      return false;
    }

    if (typeof permissions.can_edit !== "boolean") {
      return false;
    }

    // Logical validation: can't comment or edit without view
    if (!permissions.can_view && (permissions.can_comment || permissions.can_edit)) {
      return false;
    }

    return true;
  }

  /**
   * Log permission check
   */
  public logPermissionCheck(
    guestUserId: string,
    action: PermissionAction,
    resource: ResourceType,
    result: PermissionCheckResult
  ): void {
    logger.debug("Guest permission check", {
      guestUserId,
      action,
      resource,
      allowed: result.allowed,
      reason: result.reason,
    });
  }
}

// Singleton instance
let permissionManagerInstance: GuestPermissionManager | null = null;

/**
 * Get permission manager instance
 */
export function getGuestPermissionManager(): GuestPermissionManager {
  if (!permissionManagerInstance) {
    permissionManagerInstance = new GuestPermissionManager();
  }
  return permissionManagerInstance;
}

/**
 * Helper function to check permission
 */
export function checkGuestPermission(
  permissions: GuestPermissions,
  action: PermissionAction,
  resource: ResourceType
): PermissionCheckResult {
  return getGuestPermissionManager().checkPermission(permissions, action, resource);
}

/**
 * Helper function to get allowed actions
 */
export function getGuestAllowedActions(permissions: GuestPermissions): PermissionAction[] {
  return getGuestPermissionManager().getAllowedActions(permissions);
}

/**
 * Helper function to create permission preset
 */
export function createGuestPermissionPreset(
  preset: "view-only" | "comment" | "edit"
): GuestPermissions {
  return getGuestPermissionManager().createPermissionPreset(preset);
}

// Export singleton instance getter
export default getGuestPermissionManager;
