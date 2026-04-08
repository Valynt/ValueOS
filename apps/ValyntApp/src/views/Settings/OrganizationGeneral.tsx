import { Building2, Loader2, Palette, Upload, X, RotateCcw, Save, Lock } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";

import {
  AuditIndicator,
  SettingsAlert,
  SettingsSection,
} from "@/components/settings";
import { Button } from "@/components/ui/button";
import { ValidatedInput } from "@/components/ui/validated-input";
import { useOrganizationBranding } from "@/hooks/useOrganizationSettings";
import { useSettingsSubscription } from "@/hooks/useSettings";
import { useConfigAccess } from "@/hooks/useConfigAccess";
import {
  applyBrandTheme,
  VALYNT_BRAND_PRIMARY,
  VALYNT_BRAND_SECONDARY,
} from "@/styles/brandTheme";

interface OrganizationGeneralProps {
  organizationId: string;
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer";
}

const BRANDING_PREVIEW_TEXT_COLOR = "#f8fafc";

export const OrganizationGeneral: React.FC<OrganizationGeneralProps> = ({
  organizationId,
  userRole,
}) => {
  // Real-time sync across tabs
  useSettingsSubscription("organization", organizationId);

  // Permission check for customBranding setting
  const { checkAccess } = useConfigAccess(userRole);
  const customBrandingAccess = checkAccess("customBranding");

  // Backend-connected branding settings
  const {
    values,
    isLoading,
    error,
    updateSetting,
    pendingFields,
    dirtyFields,
    markDirty,
    markClean,
    revert,
    canEdit,
    fieldErrors,
    clearFieldError,
    brandingAccess,
    previewBranding,
    applyBranding,
  } = useOrganizationBranding(organizationId, userRole);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived values with fallbacks
  const orgName = (values["org.name"] as string) || "";
  const domain = (values["org.domain"] as string) || "";
  const industry = (values["org.industry"] as string) || "technology";
  const orgSize = (values["org.size"] as string) || "51-200";
  const logo = (values["branding.logoUrl"] as string | null) || null;
  const primaryColor = (values["branding.primaryColor"] as string) || VALYNT_BRAND_PRIMARY;
  const secondaryColor = (values["branding.secondaryColor"] as string) || VALYNT_BRAND_SECONDARY;

  // Apply theme on mount when data loads
  useEffect(() => {
    if (!isLoading && primaryColor && secondaryColor) {
      applyBrandTheme({ primary: primaryColor, secondary: secondaryColor });
    }
  }, [isLoading, primaryColor, secondaryColor]);

  // Handle logo upload
  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      // TODO: Show toast error
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // TODO: Show toast error
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      void updateSetting("branding.logoUrl", base64);
      markDirty("branding.logoUrl");
    };
    reader.readAsDataURL(file);
  }, [updateSetting, markDirty]);

  // Handle field changes
  const handleOrgNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void updateSetting("org.name", e.target.value);
    markDirty("org.name");
    clearFieldError("org.name");
  }, [updateSetting, markDirty, clearFieldError]);

  const handleDomainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void updateSetting("org.domain", e.target.value);
    markDirty("org.domain");
    clearFieldError("org.domain");
  }, [updateSetting, markDirty, clearFieldError]);

  const handleIndustryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    void updateSetting("org.industry", e.target.value);
    markDirty("org.industry");
  }, [updateSetting, markDirty]);

  const handleOrgSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    void updateSetting("org.size", e.target.value);
    markDirty("org.size");
  }, [updateSetting, markDirty]);

  const handleRemoveLogo = useCallback(() => {
    void updateSetting("branding.logoUrl", null);
    markDirty("branding.logoUrl");
  }, [updateSetting, markDirty]);

  // Bulk save all dirty fields
  const handleBulkSave = useCallback(async () => {
    try {
      const promises = Array.from(dirtyFields).map((key) =>
        updateSetting(key, values[key])
      );
      await Promise.all(promises);
      // Only apply branding after successful save of all fields
      applyBranding(primaryColor, secondaryColor);
    } catch (err) {
      // Error is already handled by updateSetting via toast
      console.error("Bulk save failed:", err);
    }
  }, [dirtyFields, values, updateSetting, applyBranding, primaryColor, secondaryColor]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <SettingsAlert
        type="error"
        title="Failed to load organization settings"
        description={error.message}
      />
    );
  }

  const hasDirtyFields = dirtyFields.size > 0;
  const effectiveCanEdit = canEdit && customBrandingAccess.canEdit;

  // Validation helper
  const getFieldError = (key: string) => fieldErrors[key] || "";
  const isFieldPending = (key: string) => pendingFields.has(key);
  const isFieldDirty = (key: string) => dirtyFields.has(key);

  const brandingPreviewStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
    color: BRANDING_PREVIEW_TEXT_COLOR,
  };

  return (
    <div className="space-y-6 relative">
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
                disabled={Array.from(dirtyFields).some(key => !!fieldErrors[key])}
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
          <span>
            You have view-only access to these settings.
            {customBrandingAccess.denialReason && ` ${customBrandingAccess.denialReason}`}
          </span>
        </div>
      )}

      <SettingsSection
        title="Organization Identity"
        description={
          <div className="flex flex-col gap-1">
            <span>Manage your organization's basic information and branding</span>
            <AuditIndicator
              entry={{
                id: "1",
                settingKey: "org.name",
                userId: "system",
                userEmail: "system",
                timestamp: new Date().toISOString(),
                action: "update",
                newValue: orgName,
              }}
            />
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex items-start space-x-6">
            <div>
              <div className="relative group">
                {logo ? (
                  <img
                    src={logo}
                    alt="Organization logo"
                    className="w-24 h-24 rounded-lg object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-24 h-24 bg-card rounded-lg flex items-center justify-center border-2 border-border">
                    <Building2 className="h-12 w-12 text-primary" />
                  </div>
                )}
                {logo && effectiveCanEdit && (
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 p-1.5 bg-error text-error-foreground rounded-full hover:bg-error/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                disabled={!effectiveCanEdit}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!effectiveCanEdit}
                className="mt-3 flex items-center text-sm text-primary hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4 mr-1" />
                {logo ? "Change Logo" : "Upload Logo"}
              </button>
              <p className="text-xs text-muted-foreground mt-1">Max 5MB (PNG, JPG, SVG)</p>
              {getFieldError("branding.logoUrl") && (
                <p className="text-xs text-error mt-1">{getFieldError("branding.logoUrl")}</p>
              )}
              {isFieldPending("branding.logoUrl") && (
                <Loader2 className="h-3 w-3 animate-spin inline ml-2" />
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Organization Name <span className="text-error">*</span>
                </label>
                <ValidatedInput
                  label="Organization Name"
                  value={orgName}
                  onChange={handleOrgNameChange}
                  error={getFieldError("org.name")}
                  valid={!getFieldError("org.name") && orgName.length > 1}
                  showValidation={true}
                  required
                  disabled={!effectiveCanEdit}
                  className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                />
                {getFieldError("org.name") && (
                  <p className="text-sm text-error mt-1">{getFieldError("org.name")}</p>
                )}
                {isFieldDirty("org.name") && (
                  <span className="text-xs text-amber-600">Unsaved changes</span>
                )}
                {isFieldPending("org.name") && (
                  <Loader2 className="h-3 w-3 animate-spin inline ml-2" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Primary Domain <span className="text-error">*</span>
                </label>
                <ValidatedInput
                  label="Primary Domain"
                  value={domain}
                  onChange={handleDomainChange}
                  error={getFieldError("org.domain")}
                  valid={!getFieldError("org.domain") && domain.length > 1}
                  showValidation={true}
                  required
                  disabled={!effectiveCanEdit}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                />
                {getFieldError("org.domain") && (
                  <p className="text-sm text-error mt-1">{getFieldError("org.domain")}</p>
                )}
                {isFieldDirty("org.domain") && (
                  <span className="text-xs text-amber-600">Unsaved changes</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={handleIndustryChange}
                    disabled={!effectiveCanEdit}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="technology">Technology</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="finance">Finance</option>
                    <option value="education">Education</option>
                    <option value="retail">Retail</option>
                    <option value="other">Other</option>
                  </select>
                  {isFieldDirty("org.industry") && (
                    <span className="text-xs text-amber-600 block mt-1">Unsaved</span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Organization Size
                  </label>
                  <select
                    value={orgSize}
                    onChange={handleOrgSizeChange}
                    disabled={!effectiveCanEdit}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-1000">201-1000 employees</option>
                    <option value="1000+">1000+ employees</option>
                  </select>
                  {isFieldDirty("org.size") && (
                    <span className="text-xs text-amber-600 block mt-1">Unsaved</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Tenant Branding Verification Preview"
        description="Deterministic render surfaces sourced from organization custom branding settings."
      >
        <div className="space-y-4">
          <div
            data-testid="tenant-branding-preview-header"
            className="rounded-2xl border border-border p-5 shadow-sm"
            style={brandingPreviewStyle}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {logo ? (
                  <img
                    data-testid="tenant-branding-logo"
                    src={logo}
                    alt={`${orgName} logo preview`}
                    className="h-14 w-auto rounded-xl bg-white/10 p-2"
                  />
                ) : (
                  <div
                    data-testid="tenant-branding-logo-fallback"
                    className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10"
                  >
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/70">
                    Tenant branding validation
                  </p>
                  <h3 className="text-2xl font-semibold">{orgName}</h3>
                  <p className="text-sm text-white/80">{domain}</p>
                </div>
              </div>

              {Boolean(values["branding.faviconUrl"]) && (
                <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2">
                  <img
                    data-testid="tenant-branding-favicon"
                    src={values["branding.faviconUrl"] as string}
                    alt={`${orgName} favicon preview`}
                    className="h-8 w-8 rounded-lg bg-white object-contain p-1"
                  />
                  <span className="text-sm text-white/80">Browser favicon asset</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="tenant-branding-primary-action"
                className="rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-opacity hover:opacity-95"
                style={{ backgroundColor: primaryColor, color: BRANDING_PREVIEW_TEXT_COLOR }}
              >
                Launch workspace
              </button>
              <button
                type="button"
                data-testid="tenant-branding-secondary-action"
                className="rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition-opacity hover:opacity-95"
                style={{
                  backgroundColor: secondaryColor,
                  borderColor: "rgba(248, 250, 252, 0.25)",
                  color: BRANDING_PREVIEW_TEXT_COLOR,
                }}
              >
                Share branded proposal
              </button>
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
                <Palette className="h-3.5 w-3.5" />
                Theme sync from organization settings
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Rendered asset surfaces</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>• Organization logo preview in the identity card</li>
                <li>• Header surface using tenant brand gradient</li>
                <li>• CTA controls rendered with primary + secondary brand colors</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Brand tokens from settings</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="min-w-[10rem] rounded-lg border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Primary</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      data-testid="tenant-branding-primary-swatch"
                      className="h-6 w-6 rounded-full border border-border"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <code className="text-sm text-foreground">{primaryColor}</code>
                  </div>
                </div>
                <div className="min-w-[10rem] rounded-lg border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Secondary</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      data-testid="tenant-branding-secondary-swatch"
                      className="h-6 w-6 rounded-full border border-border"
                      style={{ backgroundColor: secondaryColor }}
                    />
                    <code className="text-sm text-foreground">{secondaryColor}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Branding Colors"
        description="VALYNT colors are fixed to economic intelligence semantics."
      >
        <div className="grid grid-cols-2 gap-6 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Primary Color</label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={primaryColor}
                disabled
                aria-disabled="true"
                className="w-16 h-10 border border-border rounded bg-card cursor-not-allowed opacity-60"
              />
              <input
                type="text"
                value={primaryColor}
                readOnly
                disabled
                aria-disabled="true"
                className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg font-mono text-sm opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Secondary Color
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={secondaryColor}
                disabled
                aria-disabled="true"
                className="w-16 h-10 border border-border rounded bg-card cursor-not-allowed opacity-60"
              />
              <input
                type="text"
                value={secondaryColor}
                readOnly
                disabled
                aria-disabled="true"
                className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg font-mono text-sm opacity-60 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Brand colors are locked to VALYNT system tokens.
        </p>

        <div className="mt-6 p-4 bg-card rounded-lg border border-border">
          <p className="text-sm font-medium text-foreground mb-3">Preview</p>
          <div className="flex space-x-3">
            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-accent transition-colors">
              Primary Button
            </button>
            <button className="px-4 py-2 rounded-lg bg-info text-info-foreground hover:bg-primary transition-colors">
              Secondary Button
            </button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
