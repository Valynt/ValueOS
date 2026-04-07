import { logger } from "@/lib/logger";
import {
  AlertCircle,
  Archive,
  Bell,
  Check,
  Download,
  FileText,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  RotateCcw,
  Save,
  Upload,
  Workflow,
} from "lucide-react";
import React, { useCallback, useMemo } from "react";

import {
  AuditIndicator,
  SettingsAlert,
  SettingsSection,
} from "@/components/settings";
import { Button } from "@/components/ui/button";
import { useTeamNotifications } from "@/hooks/useOrganizationSettings";
import { useConfigAccess } from "@/hooks/useConfigAccess";

interface TeamSettingsProps {
  organizationId: string;
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer";
}

export const TeamSettings: React.FC<TeamSettingsProps> = ({
  organizationId,
  userRole,
}) => {
  // Permission check
  const { checkAccess } = useConfigAccess(userRole);
  const webhooksAccess = checkAccess("webhooks");

  // Backend-connected notification settings
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
  } = useTeamNotifications(organizationId, userRole);

  const effectiveCanEdit = canEdit && webhooksAccess.canEdit;

  // Get values with fallbacks
  const getBoolValue = useCallback(
    (key: string) => Boolean(values[key]),
    [values]
  );

  // Handle toggle changes
  const handleToggle = useCallback(
    (key: string) => (checked: boolean) => {
      void updateSetting(key, checked);
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

  // Export settings
  const handleExport = useCallback(() => {
    const settings = {
      notifications: {
        mentions: getBoolValue("notifications.mentions"),
        taskAssignments: getBoolValue("notifications.taskAssignments"),
        weeklyDigest: getBoolValue("notifications.weeklyDigest"),
        projectUpdates: getBoolValue("notifications.projectUpdates"),
        emailNotifications: getBoolValue("notifications.emailNotifications"),
        slackNotifications: getBoolValue("notifications.slackNotifications"),
      },
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workspace-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getBoolValue]);

  // Import settings
  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);

        if (imported.notifications) {
          Object.entries(imported.notifications).forEach(([key, value]) => {
            const settingKey = `notifications.${key}`;
            void updateSetting(settingKey, value);
            markDirty(settingKey);
          });
        }
      } catch (err) {
        logger.error("Import failed:", err);
      }
    },
    [updateSetting, markDirty]
  );

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
        title="Failed to load team settings"
        description={error.message}
      />
    );
  }

  const hasDirtyFields = dirtyFields.size > 0;

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
            {webhooksAccess.denialReason && ` ${webhooksAccess.denialReason}`}
          </span>
        </div>
      )}

      <SettingsSection
        title="Notification Preferences"
        description={
          <div className="flex flex-col gap-1">
            <span>Configure how workspace members receive notifications</span>
            <AuditIndicator
              entry={{
                id: "1",
                settingKey: "notifications.email",
                userId: "system",
                userEmail: "system",
                timestamp: new Date().toISOString(),
                action: "update",
                newValue: "enabled",
              }}
            />
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-3">
                <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">@Mentions</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Notify members when they are mentioned
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={getBoolValue("notifications.mentions")}
                  onChange={(e) => handleToggle("notifications.mentions")(e.target.checked)}
                  disabled={!effectiveCanEdit || pendingFields.has("notifications.mentions")}
                  aria-label="@Mentions"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
              </label>
            </div>

            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">
                    Task Assignments
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Notify when tasks are assigned
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={getBoolValue("notifications.taskAssignments")}
                  onChange={(e) => handleToggle("notifications.taskAssignments")(e.target.checked)}
                  disabled={!effectiveCanEdit || pendingFields.has("notifications.taskAssignments")}
                  aria-label="Task Assignments"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
              </label>
            </div>

            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Weekly Digest</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send weekly activity summary
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={getBoolValue("notifications.weeklyDigest")}
                  onChange={(e) => handleToggle("notifications.weeklyDigest")(e.target.checked)}
                  disabled={!effectiveCanEdit || pendingFields.has("notifications.weeklyDigest")}
                  aria-label="Weekly Digest"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
              </label>
            </div>

            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-3">
                <Workflow className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Project Updates</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Notify on project status changes
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={getBoolValue("notifications.projectUpdates")}
                  onChange={(e) => handleToggle("notifications.projectUpdates")(e.target.checked)}
                  disabled={!effectiveCanEdit || pendingFields.has("notifications.projectUpdates")}
                  aria-label="Project Updates"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-3">
              Delivery Channels
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Email Notifications
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={getBoolValue("notifications.emailNotifications")}
                    onChange={(e) =>
                      handleToggle("notifications.emailNotifications")(e.target.checked)
                    }
                    disabled={!effectiveCanEdit || pendingFields.has("notifications.emailNotifications")}
                    aria-label="Email Notifications"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Slack Notifications
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={getBoolValue("notifications.slackNotifications")}
                    onChange={(e) =>
                      handleToggle("notifications.slackNotifications")(e.target.checked)
                    }
                    disabled={!effectiveCanEdit || pendingFields.has("notifications.slackNotifications")}
                    aria-label="Slack Notifications"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* TODO: Connect Workflow Settings to backend (future P2 enhancement) */}

      <SettingsSection
        title="Settings Management"
        description="Import or export workspace settings as templates"
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted border border-border rounded-lg">
            <div className="flex items-start space-x-3 mb-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  Settings Templates
                </p>
                <p>
                  Export your current workspace settings to share with other
                  workspaces or use as a template. Settings include notification
                  preferences, workflow configurations, and default values.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleExport}
                className="flex items-center px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Settings
              </button>

              <label className="flex items-center px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Import Settings
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </SettingsSection>

    </div>
  );
};
