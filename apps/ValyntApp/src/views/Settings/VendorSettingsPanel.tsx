import { Globe, Layers, Loader2, Lock, RefreshCw, RotateCcw, Save, Server, Shield, Sliders, Zap } from "lucide-react";
import React, { useCallback } from "react";

import { SettingsSection } from "@/components/settings";
import { Button } from "@/components/ui/button";
import { useVendorSettings } from "@/hooks/useOrganizationSettings";

interface VendorSettingsPanelProps {
  organizationId: string;
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer";
}

export const VendorSettingsPanel: React.FC<VendorSettingsPanelProps> = ({
  organizationId,
  userRole,
}) => {
  const {
    values,
    isLoading,
    error,
    updateSetting,
    dirtyFields,
    markDirty,
    markClean,
    revert,
    canEdit,
    vendorAccess,
    showVendorSettings,
    canEditAnyVendor,
  } = useVendorSettings(organizationId, userRole);

  // Hooks must be called before any early returns
  const handleToggle = useCallback(
    (key: string) => (checked: boolean) => {
      void updateSetting(key, checked);
      markDirty(key);
    },
    [updateSetting, markDirty]
  );

  const handleStringChange = useCallback(
    (key: string) => (value: string) => {
      void updateSetting(key, value);
      markDirty(key);
    },
    [updateSetting, markDirty]
  );

  // Bulk save
  const handleBulkSave = useCallback(async () => {
    const promises = Array.from(dirtyFields).map((key) =>
      updateSetting(key, values[key])
    );
    await Promise.all(promises);
    dirtyFields.forEach((key) => markClean(key));
  }, [dirtyFields, values, updateSetting, markClean]);

  // Only render for vendor admins
  if (!showVendorSettings) {
    return (
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          Vendor settings are only accessible to platform administrators.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">Failed to load vendor settings: {error.message}</p>
      </div>
    );
  }

  const hasDirtyFields = dirtyFields.size > 0;
  const effectiveCanEdit = canEdit && canEditAnyVendor;

  return (
    <div className="space-y-6">
      {/* Floating bulk action bar */}
      {hasDirtyFields && effectiveCanEdit && (
        <div className="sticky top-4 z-10 mb-4 animate-in slide-in-from-top-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
            <span className="text-sm text-amber-800">
              {dirtyFields.size} unsaved change{dirtyFields.size !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={revert}
                className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={() => void handleBulkSave()}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Save className="h-4 w-4 mr-1" />
                Save all
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Read-only indicator */}
      {!effectiveCanEdit && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>You have view-only access to vendor settings.</span>
        </div>
      )}

      <SettingsSection
        title="Tenant Provisioning"
        description="Configure automated tenant onboarding and resource allocation"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <Server className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Auto-Provision Tenants</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically create tenant resources on signup
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(values["vendor.tenantProvisioning"])}
                onChange={(e) => handleToggle("vendor.tenantProvisioning")(e.target.checked)}
                disabled={!effectiveCanEdit || !vendorAccess.tenantProvisioning.canEdit}
                aria-label="Auto-Provision Tenants"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Data Residency Enforcement</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Restrict data to specific geographic regions
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(values["vendor.dataResidency"])}
                onChange={(e) => handleToggle("vendor.dataResidency")(e.target.checked)}
                disabled={!effectiveCanEdit || !vendorAccess.dataResidency.canEdit}
                aria-label="Data Residency Enforcement"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Model & Routing"
        description="Configure AI model routing and namespace isolation"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <Layers className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Namespace Isolation</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Strict isolation between tenant namespaces
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(values["vendor.namespaceIsolation"])}
                onChange={(e) => handleToggle("vendor.namespaceIsolation")(e.target.checked)}
                disabled={!effectiveCanEdit || !vendorAccess.namespaceIsolation.canEdit}
                aria-label="Namespace Isolation"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>

          <div>
            <label
              htmlFor="modelRouting"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Model Routing Strategy
            </label>
            <select
              id="modelRouting"
              value={String(values["vendor.modelRouting"] ?? "cost-optimized")}
              onChange={(e) => handleStringChange("vendor.modelRouting")(e.target.value)}
              disabled={!effectiveCanEdit || !vendorAccess.modelRouting.canEdit}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <option value="cost-optimized">Cost Optimized</option>
              <option value="performance">Performance Priority</option>
              <option value="balanced">Balanced</option>
              <option value="custom">Custom Routing</option>
            </select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Platform Operations"
        description="Feature flags and operational controls"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <Sliders className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Advanced Feature Flags</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable beta features for selective tenants
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(values["vendor.featureFlags"])}
                onChange={(e) => handleToggle("vendor.featureFlags")(e.target.checked)}
                disabled={!effectiveCanEdit || !vendorAccess.featureFlags.canEdit}
                aria-label="Advanced Feature Flags"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <Zap className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Adaptive Rate Limiting</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Dynamic rate limits based on tenant tier
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(values["vendor.rateLimiting"])}
                onChange={(e) => handleToggle("vendor.rateLimiting")(e.target.checked)}
                disabled={!effectiveCanEdit || !vendorAccess.rateLimiting.canEdit}
                aria-label="Adaptive Rate Limiting"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <RefreshCw className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Cache Management</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable distributed cache invalidation
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(values["vendor.cacheManagement"])}
                onChange={(e) => handleToggle("vendor.cacheManagement")(e.target.checked)}
                disabled={!effectiveCanEdit || !vendorAccess.cacheManagement.canEdit}
                aria-label="Cache Management"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Security & Compliance"
        description="Security controls for platform-wide operations"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">RLS Monitoring</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Real-time Row Level Security violation alerts
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(values["vendor.rlsMonitoring"])}
                onChange={(e) => handleToggle("vendor.rlsMonitoring")(e.target.checked)}
                disabled={!effectiveCanEdit || !vendorAccess.rlsMonitoring.canEdit}
                aria-label="RLS Monitoring"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <RefreshCw className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Auto Secret Rotation</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatic rotation of service credentials
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={Boolean(values["vendor.secretRotation"])}
                onChange={(e) => handleToggle("vendor.secretRotation")(e.target.checked)}
                disabled={!effectiveCanEdit || !vendorAccess.secretRotation.canEdit}
                aria-label="Auto Secret Rotation"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
