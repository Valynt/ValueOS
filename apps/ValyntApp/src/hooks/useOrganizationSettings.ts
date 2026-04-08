/**
 * useOrganizationSettings
 *
 * Specialized hook for tenant/organization-scoped settings with
 * branding-specific features and permission checks.
 */

import { useCallback, useMemo } from "react";

import { useSettingsGroup, type UseSettingsOptions } from "@/hooks/useSettings";
import { useConfigAccess } from "@/hooks/useConfigAccess";
import type { AccessLevel, ConfigCategory } from "@/config/settingsMatrix";

// ============================================================================
// Types
// ============================================================================

export interface OrganizationBrandingSettings {
  "branding.logoUrl": string;
  "branding.faviconUrl": string;
  "branding.primaryColor": string;
  "branding.secondaryColor": string;
  "branding.fontFamily": string;
  "branding.customCss": string;
  "org.name": string;
  "org.domain": string;
  "org.industry": string;
  "org.size": string;
}

export interface TeamNotificationSettings {
  "notifications.mentions": boolean;
  "notifications.taskAssignments": boolean;
  "notifications.weeklyDigest": boolean;
  "notifications.projectUpdates": boolean;
  "notifications.emailNotifications": boolean;
  "notifications.slackNotifications": boolean;
}

export interface UseOrganizationSettingsOptions {
  organizationId: string;
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer";
  /** Specific settings categories to load */
  categories?: ConfigCategory[];
}

// ============================================================================
// Organization Setting Keys by Category
// ============================================================================

const BRANDING_SETTING_KEYS = [
  "branding.logoUrl",
  "branding.faviconUrl",
  "branding.primaryColor",
  "branding.secondaryColor",
  "branding.fontFamily",
  "branding.customCss",
  "org.name",
  "org.domain",
  "org.industry",
  "org.size",
];

const NOTIFICATION_SETTING_KEYS = [
  "notifications.mentions",
  "notifications.taskAssignments",
  "notifications.weeklyDigest",
  "notifications.projectUpdates",
  "notifications.emailNotifications",
  "notifications.slackNotifications",
];

const SECURITY_SETTING_KEYS = [
  "security.authPolicy",
  "security.ssoConfig",
  "security.sessionControl",
  "security.ipWhitelist",
];

const BILLING_SETTING_KEYS = [
  "billing.tokenDashboard",
  "billing.valueMetering",
  "billing.subscriptionPlan",
  "billing.invoicing",
];

// ============================================================================
// Validation Rules
// ============================================================================

const ORGANIZATION_VALIDATORS: Record<string, (value: string) => string | undefined> = {
  "org.name": (value) => {
    if (!value || value.trim().length === 0) return "Organization name is required";
    if (value.trim().length < 2) return "Name must be at least 2 characters";
    return undefined;
  },
  "org.domain": (value) => {
    if (!value || value.trim().length === 0) return "Domain is required";
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(value)) return "Invalid domain format (e.g., acme.com)";
    return undefined;
  },
  "branding.primaryColor": (value) => {
    if (!value) return "Primary color is required";
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(value)) return "Invalid hex color (e.g., #3B82F6)";
    return undefined;
  },
  "branding.secondaryColor": (value) => {
    if (!value) return "Secondary color is required";
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(value)) return "Invalid hex color (e.g., #10B981)";
    return undefined;
  },
  "branding.logoUrl": (value) => {
    if (!value) return undefined; // Optional
    if (value.length > 5 * 1024 * 1024) return "Logo must be smaller than 5MB";
    if (!value.startsWith("data:image/")) return "Logo must be a valid image";
    return undefined;
  },
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for organization branding settings with config access checks
 */
export function useOrganizationBranding(
  organizationId: string,
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer"
) {
  const { checkAccess, isAdmin } = useConfigAccess(userRole);

  // Check customBranding permission from matrix
  const brandingAccess = useMemo(() => checkAccess("customBranding"), [checkAccess]);

  const settingsResult = useSettingsGroup({
    scope: "organization",
    scopeId: organizationId,
    keys: BRANDING_SETTING_KEYS,
    validation: ORGANIZATION_VALIDATORS,
    accessLevel: userRole as AccessLevel,
  });

  // Apply branding to document (theme application)
  const applyBranding = useCallback((primaryColor: string, secondaryColor: string) => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", primaryColor);
    root.style.setProperty("--brand-secondary", secondaryColor);
  }, []);

  // Preview branding without saving
  const previewBranding = useCallback(
    (primaryColor: string, secondaryColor: string) => {
      if (!brandingAccess.canEdit) {
        console.warn("User attempted to preview branding without edit permission");
        return;
      }
      applyBranding(primaryColor, secondaryColor);
    },
    [applyBranding, brandingAccess.canEdit]
  );

  // Reset to default branding
  const resetToDefaults = useCallback(() => {
    const root = document.documentElement;
    root.style.removeProperty("--brand-primary");
    root.style.removeProperty("--brand-secondary");
  }, []);

  // Bulk save all branding settings
  const saveBranding = useCallback(async () => {
    if (!brandingAccess.canEdit) {
      throw new Error("Insufficient permissions to save branding");
    }

    const brandingValues = BRANDING_SETTING_KEYS.reduce((acc, key) => {
      if (settingsResult.values[key] !== undefined) {
        acc[key] = settingsResult.values[key];
      }
      return acc;
    }, {} as Record<string, unknown>);

    // Apply after successful save
    const primaryColor = brandingValues["branding.primaryColor"] as string;
    const secondaryColor = brandingValues["branding.secondaryColor"] as string;
    if (primaryColor && secondaryColor) {
      applyBranding(primaryColor, secondaryColor);
    }
  }, [brandingAccess.canEdit, settingsResult.values, applyBranding]);

  return {
    ...settingsResult,
    brandingAccess,
    canEdit: brandingAccess.canEdit && settingsResult.canEdit,
    isAdmin,
    previewBranding,
    saveBranding,
    resetToDefaults,
    applyBranding,
  };
}

/**
 * Hook for team notification settings
 */
export function useTeamNotifications(
  organizationId: string,
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer"
) {
  const { checkAccess } = useConfigAccess(userRole);

  // Notifications typically inherit from general tenant settings
  const notificationAccess = useMemo(() => checkAccess("webhooks"), [checkAccess]);

  return useSettingsGroup({
    scope: "organization",
    scopeId: organizationId,
    keys: NOTIFICATION_SETTING_KEYS,
    accessLevel: userRole as AccessLevel,
  });
}

/**
 * Hook for organization security settings (tenant_admin + vendor_admin only)
 */
export function useOrganizationSecurity(
  organizationId: string,
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer"
) {
  const { checkAccess } = useConfigAccess(userRole);

  const securityAccess = useMemo(() => {
    return {
      authPolicy: checkAccess("authPolicy"),
      ssoConfig: checkAccess("ssoConfig"),
      sessionControl: checkAccess("sessionControl"),
      ipWhitelist: checkAccess("ipWhitelist"),
    };
  }, [checkAccess]);

  const settingsResult = useSettingsGroup({
    scope: "organization",
    scopeId: organizationId,
    keys: SECURITY_SETTING_KEYS,
    accessLevel: userRole as AccessLevel,
  });

  return {
    ...settingsResult,
    securityAccess,
    canEditAny: Object.values(securityAccess).some((a) => a.canEdit),
  };
}

/**
 * Vendor-only settings hook for platform administration
 */
export function useVendorSettings(
  organizationId: string,
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer"
) {
  const { checkAccess, isAdmin } = useConfigAccess(userRole);

  // These settings require vendor_admin access
  const vendorAccess = useMemo(() => {
    return {
      tenantProvisioning: checkAccess("tenantProvisioning"),
      dataResidency: checkAccess("dataResidency"),
      namespaceIsolation: checkAccess("namespaceIsolation"),
      modelRouting: checkAccess("modelRouting"),
      featureFlags: checkAccess("featureFlags"),
      rateLimiting: checkAccess("rateLimiting"),
      observability: checkAccess("observability"),
      cacheManagement: checkAccess("cacheManagement"),
      secretRotation: checkAccess("secretRotation"),
      rlsMonitoring: checkAccess("rlsMonitoring"),
    };
  }, [checkAccess]);

  // All vendor settings keys
  const vendorSettingKeys = useMemo(
    () => [
      "vendor.tenantProvisioning",
      "vendor.dataResidency",
      "vendor.namespaceIsolation",
      "vendor.modelRouting",
      "vendor.featureFlags",
      "vendor.rateLimiting",
      "vendor.observability",
      "vendor.cacheManagement",
      "vendor.secretRotation",
      "vendor.rlsMonitoring",
    ],
    []
  );

  const settingsResult = useSettingsGroup({
    scope: "organization",
    scopeId: organizationId,
    keys: userRole === "vendor_admin" ? vendorSettingKeys : [],
    accessLevel: userRole as AccessLevel,
  });

  // Only show vendor settings if user is actually a vendor admin
  const showVendorSettings = userRole === "vendor_admin" && isAdmin;

  return {
    ...settingsResult,
    vendorAccess,
    showVendorSettings,
    canEditAnyVendor: Object.values(vendorAccess).some((a) => a.canEdit),
  };
}

/**
 * Combined hook that loads all organization-scoped settings with proper filtering
 */
export function useOrganizationSettings(options: UseOrganizationSettingsOptions) {
  const { organizationId, userRole, categories } = options;

  // Determine which keys to load based on categories and role
  const keysToLoad = useMemo(() => {
    const keys: string[] = [];

    if (!categories || categories.includes("multi_tenant")) {
      keys.push(...BRANDING_SETTING_KEYS);
    }
    if (!categories || categories.includes("operational")) {
      keys.push(...NOTIFICATION_SETTING_KEYS);
    }
    if (!categories || categories.includes("security")) {
      keys.push(...SECURITY_SETTING_KEYS);
    }
    if (!categories || categories.includes("billing")) {
      keys.push(...BILLING_SETTING_KEYS);
    }

    // Vendor-only settings
    if (userRole === "vendor_admin" && (!categories || categories.includes("operational"))) {
      keys.push(
        "vendor.tenantProvisioning",
        "vendor.dataResidency",
        "vendor.featureFlags",
        "vendor.rateLimiting"
      );
    }

    return keys;
  }, [categories, userRole]);

  return useSettingsGroup({
    scope: "organization",
    scopeId: organizationId,
    keys: keysToLoad,
    validation: ORGANIZATION_VALIDATORS,
    accessLevel: userRole as AccessLevel,
  });
}

const WORKFLOW_SETTING_KEYS = [
  "workflow.defaultTaskStatus",
  "workflow.requireApproval",
  "workflow.autoArchive",
  "workflow.archiveDays",
  "workflow.defaultAssignee",
];

export interface WorkflowSettings {
  "workflow.defaultTaskStatus": "todo" | "in_progress" | "review" | "done";
  "workflow.requireApproval": boolean;
  "workflow.autoArchive": boolean;
  "workflow.archiveDays": number;
  "workflow.defaultAssignee": "unassigned" | "creator" | "project_owner";
}

/**
 * Hook for workflow-specific settings within a team/organization scope
 */
export function useWorkflowSettings(
  organizationId: string,
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer"
) {
  const { checkAccess } = useConfigAccess(userRole);
  const workflowAccess = checkAccess("workflow");

  const settingsResult = useSettingsGroup({
    scope: "organization",
    scopeId: organizationId,
    keys: WORKFLOW_SETTING_KEYS,
    accessLevel: userRole as AccessLevel,
  });

  // Helper to get typed workflow values with defaults
  const getWorkflowValue = useCallback(
    <K extends keyof WorkflowSettings>(key: K): WorkflowSettings[K] => {
      const value = settingsResult.values[key];
      if (value === undefined) {
        // Return defaults
        const defaults: WorkflowSettings = {
          "workflow.defaultTaskStatus": "todo",
          "workflow.requireApproval": false,
          "workflow.autoArchive": true,
          "workflow.archiveDays": 90,
          "workflow.defaultAssignee": "unassigned",
        };
        return defaults[key];
      }
      return value as WorkflowSettings[K];
    },
    [settingsResult.values]
  );

  return {
    ...settingsResult,
    workflowAccess,
    getWorkflowValue,
    canEditWorkflow: settingsResult.canEdit && workflowAccess.canEdit,
  };
}

export { useOrganizationSettings };
