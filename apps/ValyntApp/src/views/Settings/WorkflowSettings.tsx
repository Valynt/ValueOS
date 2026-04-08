import { Archive, Check, Loader2, Lock, RotateCcw, Save } from "lucide-react";
import React, { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { useConfigAccess } from "@/hooks/useConfigAccess";
import { useWorkflowSettings } from "@/hooks/useOrganizationSettings";

interface WorkflowSettingsProps {
  organizationId: string;
  userRole: "tenant_admin" | "vendor_admin" | "user" | "viewer";
}

export const WorkflowSettings: React.FC<WorkflowSettingsProps> = ({
  organizationId,
  userRole,
}) => {
  const { checkAccess } = useConfigAccess(userRole);
  const workflowAccess = checkAccess("workflow");

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
    getWorkflowValue,
  } = useWorkflowSettings(organizationId, userRole);

  const effectiveCanEdit = canEdit && workflowAccess.canEdit;

  // Get values with fallbacks
  const defaultTaskStatus = getWorkflowValue("workflow.defaultTaskStatus");
  const requireApproval = getWorkflowValue("workflow.requireApproval");
  const autoArchive = getWorkflowValue("workflow.autoArchive");
  const archiveDays = getWorkflowValue("workflow.archiveDays");
  const defaultAssignee = getWorkflowValue("workflow.defaultAssignee");

  // Handle changes
  const handleStatusChange = useCallback(
    (value: string) => {
      void updateSetting("workflow.defaultTaskStatus", value);
      markDirty("workflow.defaultTaskStatus");
    },
    [updateSetting, markDirty]
  );

  const handleAssigneeChange = useCallback(
    (value: string) => {
      void updateSetting("workflow.defaultAssignee", value);
      markDirty("workflow.defaultAssignee");
    },
    [updateSetting, markDirty]
  );

  const handleToggle = useCallback(
    (key: "workflow.requireApproval" | "workflow.autoArchive") =>
      (checked: boolean) => {
        void updateSetting(key, checked);
        markDirty(key);
      },
    [updateSetting, markDirty]
  );

  const handleArchiveDaysChange = useCallback(
    (value: number) => {
      void updateSetting("workflow.archiveDays", value);
      markDirty("workflow.archiveDays");
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">Failed to load workflow settings: {error.message}</p>
      </div>
    );
  }

  const hasDirtyFields = dirtyFields.size > 0;

  return (
    <div className="space-y-4">
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
            {workflowAccess.denialReason && ` ${workflowAccess.denialReason}`}
          </span>
        </div>
      )}

      <div className="space-y-4 max-w-2xl">
        <div>
          <label
            htmlFor="defaultTaskStatus"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Default Task Status
          </label>
          <select
            id="defaultTaskStatus"
            value={defaultTaskStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={!effectiveCanEdit || pendingFields.has("workflow.defaultTaskStatus")}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            New tasks will be created with this status by default
          </p>
        </div>

        <div>
          <label
            htmlFor="defaultAssignee"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Default Assignee
          </label>
          <select
            id="defaultAssignee"
            value={defaultAssignee}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            disabled={!effectiveCanEdit || pendingFields.has("workflow.defaultAssignee")}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="unassigned">Unassigned</option>
            <option value="creator">Task Creator</option>
            <option value="project_owner">Project Owner</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
          <div className="flex items-start space-x-3">
            <Check className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Require Approval</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tasks must be approved before marking as complete
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={requireApproval}
              onChange={(e) => handleToggle("workflow.requireApproval")(e.target.checked)}
              disabled={!effectiveCanEdit || pendingFields.has("workflow.requireApproval")}
              aria-label="Require Approval"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
          </label>
        </div>

        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-start space-x-3">
              <Archive className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Auto-Archive Projects</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically archive inactive projects
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={autoArchive}
                onChange={(e) => handleToggle("workflow.autoArchive")(e.target.checked)}
                disabled={!effectiveCanEdit || pendingFields.has("workflow.autoArchive")}
                aria-label="Auto-Archive Projects"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
            </label>
          </div>

          {autoArchive && (
            <div className="ml-8 pt-3 border-t border-border">
              <label
                htmlFor="archiveDays"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Archive after (days)
              </label>
              <input
                id="archiveDays"
                type="number"
                value={archiveDays}
                onChange={(e) => handleArchiveDaysChange(parseInt(e.target.value) || 30)}
                disabled={!effectiveCanEdit || pendingFields.has("workflow.archiveDays")}
                min="30"
                max="365"
                className="w-32 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
