/**
 * ProfilePage - Edit-in-place profile settings
 *
 * Connected to backend via useSettingsGroup with optimistic updates,
 * validation, dirty tracking, and bulk save support.
 */

import { Camera, Loader2, RotateCcw, Save } from "lucide-react";
import { useCallback, useMemo } from "react";

import {
  AuditIndicator,
  SettingsAlert,
  SettingsRow,
  SettingsSection,
} from "@/components/settings";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { useSettingsGroup } from "@/hooks/useSettings";
import { useConfigAccess } from "@/hooks/useConfigAccess";
import { logger } from "@/lib/logger";

// Profile settings keys mapping
const PROFILE_SETTING_KEYS = [
  "profile.fullName",
  "profile.email",
  "profile.username",
  "profile.jobTitle",
  "profile.timezone",
  "profile.language",
] as const;

type ProfileSettingKey = (typeof PROFILE_SETTING_KEYS)[number];

// Validation rules
const VALIDATION_RULES: Record<string, (value: string) => string | undefined> = {
  "profile.email": (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Please enter a valid email address";
    return undefined;
  },
  "profile.username": (value) => {
    if (value.length < 3) return "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return "Username can only contain letters, numbers, and underscores";
    return undefined;
  },
  "profile.fullName": (value) => {
    if (value.trim().length < 2) return "Full name must be at least 2 characters";
    return undefined;
  },
};

interface ProfilePageProps {
  /** User ID for scoping */
  userId: string;
  /** User's role for permission checking */
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer";
  /** Whether email is verified */
  emailVerified?: boolean;
}

export function ProfilePage({
  userId,
  userRole,
  emailVerified = false
}: ProfilePageProps) {
  // Check permissions
  const { checkAccess, canEdit: hasEditPermission } = useConfigAccess(userRole);

  // Check individual field access
  const accessMap = useMemo(() => {
    const keys: ProfileSettingKey[] = [
      "profile.fullName",
      "profile.email",
      "profile.username",
      "profile.jobTitle",
      "profile.timezone",
      "profile.language",
    ];
    return keys.reduce((acc, key) => {
      acc[key] = checkAccess(key);
      return acc;
    }, {} as Record<string, ReturnType<typeof checkAccess>>);
  }, [checkAccess]);

  // Settings group with dirty tracking and validation
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
  } = useSettingsGroup({
    scope: "user",
    scopeId: userId,
    keys: PROFILE_SETTING_KEYS as unknown as string[],
    validation: VALIDATION_RULES,
    accessLevel: userRole,
  });

  // Effective edit permission combines role and settings access
  const effectiveCanEdit = canEdit && hasEditPermission;

  // Get display values (fallback to empty string)
  const getValue = useCallback(
    (key: ProfileSettingKey) => (values[key] as string) ?? "",
    [values]
  );

  // Handle field save
  const handleSave = useCallback(
    (field: ProfileSettingKey) => async (value: string) => {
      const access = accessMap[field];
      if (!access?.canEdit) {
        logger.warn(`Attempted to edit ${field} without permission`);
        return;
      }

      await updateSetting(field, value);
      markClean(field);
    },
    [accessMap, updateSetting, markClean]
  );

  // Handle field change (dirty tracking)
  const handleChange = useCallback(
    (field: ProfileSettingKey) => () => {
      markDirty(field);
      clearFieldError(field);
    },
    [markDirty, clearFieldError]
  );

  // Bulk save all dirty fields
  const handleBulkSave = useCallback(async () => {
    const promises = Array.from(dirtyFields).map((key) =>
      updateSetting(key, values[key])
    );
    await Promise.all(promises);
  }, [dirtyFields, values, updateSetting]);

  // Handle email verification
  const handleVerifyEmail = useCallback(() => {
    logger.info("Sending verification email...", { userId });
    // TODO: Call verification API
  }, [userId]);

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
        title="Failed to load profile"
        description={error.message}
      />
    );
  }

  const hasDirtyFields = dirtyFields.size > 0;
  const fullName = getValue("profile.fullName");
  const username = getValue("profile.username");

  return (
    <div className="relative">
      {/* Floating bulk action bar */}
      {hasDirtyFields && (
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

      {/* Email Verification Alert */}
      {!emailVerified && (
        <SettingsAlert
          type="warning"
          title="Verify your email"
          description="Please verify your email address to access all features."
          action={{
            label: "Verify email",
            onClick={ handleVerifyEmail }
          }}
        />
      )}

      {/* Profile Photo Section */}
      <SettingsSection>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserAvatar name={fullName || "User"} size="lg" />
              {effectiveCanEdit && (
                <button
                  className="absolute -bottom-1 -right-1 p-1.5 bg-white border border-border rounded-full shadow-sm hover:bg-muted transition-colors"
                  aria-label="Update profile photo"
                >
                  <Camera className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <div>
              <p className="font-medium">{fullName || "User"}</p>
              <p className="text-sm text-muted-foreground">@{username || "username"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {effectiveCanEdit && (
              <Button variant="outline" size="sm">
                Update
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Personal Information */}
      <SettingsSection
        title="Personal information"
        description={
          <AuditIndicator
            entry={{
              id: "1",
              settingKey: "profile.fullName",
              userEmail: "system",
              timestamp: new Date().toISOString(),
              action: "update",
              newValue: fullName,
            }}
          />
        }
      >
        <div className="px-4">
          <SettingsRow
            label="Full name"
            value={fullName}
            onSave={handleSave("profile.fullName")}
            onChange={handleChange("profile.fullName")}
            validate={VALIDATION_RULES["profile.fullName"]}
            isPending={pendingFields.has("profile.fullName")}
            isDirty={dirtyFields.has("profile.fullName")}
            error={fieldErrors["profile.fullName"]}
            editable={accessMap["profile.fullName"]?.canEdit && effectiveCanEdit}
          />
          <SettingsRow
            label="Email address"
            value={getValue("profile.email")}
            type="email"
            onSave={handleSave("profile.email")}
            onChange={handleChange("profile.email")}
            validate={VALIDATION_RULES["profile.email"]}
            isPending={pendingFields.has("profile.email")}
            isDirty={dirtyFields.has("profile.email")}
            error={fieldErrors["profile.email"]}
            editable={accessMap["profile.email"]?.canEdit && effectiveCanEdit}
            description={emailVerified ? "Verified" : "Not verified"}
          />
          <SettingsRow
            label="Username"
            value={username}
            onSave={handleSave("profile.username")}
            onChange={handleChange("profile.username")}
            validate={VALIDATION_RULES["profile.username"]}
            isPending={pendingFields.has("profile.username")}
            isDirty={dirtyFields.has("profile.username")}
            error={fieldErrors["profile.username"]}
            editable={accessMap["profile.username"]?.canEdit && effectiveCanEdit}
          />
          <SettingsRow
            label="Job title"
            value={getValue("profile.jobTitle")}
            onSave={handleSave("profile.jobTitle")}
            onChange={handleChange("profile.jobTitle")}
            isPending={pendingFields.has("profile.jobTitle")}
            isDirty={dirtyFields.has("profile.jobTitle")}
            error={fieldErrors["profile.jobTitle"]}
            editable={accessMap["profile.jobTitle"]?.canEdit && effectiveCanEdit}
          />
        </div>
      </SettingsSection>

      {/* Preferences */}
      <SettingsSection title="Preferences">
        <div className="px-4">
          <SettingsRow
            label="Timezone"
            value={getValue("profile.timezone")}
            onSave={handleSave("profile.timezone")}
            onChange={handleChange("profile.timezone")}
            isPending={pendingFields.has("profile.timezone")}
            isDirty={dirtyFields.has("profile.timezone")}
            error={fieldErrors["profile.timezone"]}
            editable={accessMap["profile.timezone"]?.canEdit && effectiveCanEdit}
          />
          <SettingsRow
            label="Language"
            value={getValue("profile.language")}
            onSave={handleSave("profile.language")}
            onChange={handleChange("profile.language")}
            isPending={pendingFields.has("profile.language")}
            isDirty={dirtyFields.has("profile.language")}
            error={fieldErrors["profile.language"]}
            editable={accessMap["profile.language"]?.canEdit && effectiveCanEdit}
          />
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection title="Danger zone" description="Irreversible actions">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Delete account
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

// ProfilePage is exported as a named export: export function ProfilePage
