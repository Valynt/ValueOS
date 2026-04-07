/**
 * Unit tests for TeamSettings component.
 *
 * Tests cover:
 * - Loading state rendering
 * - Error state rendering
 * - Notification toggle interactions
 * - Bulk save with dirty fields
 * - Discard changes (revert)
 * - Export settings - JSON download
 * - Import settings - file validation and parsing
 * - Read-only access indicator
 * - Permission-based edit enforcement
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);
const mockMarkDirty = vi.fn();
const mockMarkClean = vi.fn();
const mockRevert = vi.fn();

vi.mock("@/hooks/useOrganizationSettings", () => ({
  useTeamNotifications: () => ({
    values: {
      "notifications.mentions": true,
      "notifications.taskAssignments": false,
      "notifications.weeklyDigest": true,
      "notifications.projectUpdates": false,
      "notifications.emailNotifications": true,
      "notifications.slackNotifications": false,
    },
    isLoading: false,
    error: null,
    updateSetting: mockUpdateSetting,
    pendingFields: new Set<string>(),
    dirtyFields: new Set<string>(),
    markDirty: mockMarkDirty,
    markClean: mockMarkClean,
    revert: mockRevert,
    canEdit: true,
  }),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettingsSubscription: vi.fn(),
}));

vi.mock("@/hooks/useConfigAccess", () => ({
  useConfigAccess: () => ({
    checkAccess: () => ({ canEdit: true, denialReason: null }),
  }),
}));

vi.mock("@/components/settings", () => ({
  SettingsSection: ({ children, title }: { children: React.ReactNode; title: string }) =>
    React.createElement("section", { "data-testid": `section-${title}` }, children),
  SettingsAlert: ({ title, description }: { title: string; description: string }) =>
    React.createElement("div", { "data-testid": "settings-alert" }, `${title}: ${description}`),
  AuditIndicator: () => React.createElement("div", { "data-testid": "audit-indicator" }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void;[key: string]: unknown }) =>
    React.createElement("button", { onClick, ...props }, children),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("./WorkflowSettings", () => ({
  WorkflowSettings: () => React.createElement("div", { "data-testid": "workflow-settings" }),
}));

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
vi.stubGlobal("URL", { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { TeamSettings } from "../TeamSettings.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTeamSettings(overrides: { userRole?: string } = {}) {
  return render(
    React.createElement(TeamSettings, {
      organizationId: "org-1",
      userRole: (overrides.userRole || "tenant_admin") as "tenant_admin" | "vendor_admin" | "user" | "viewer",
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TeamSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading state", () => {
    it("renders loading spinner when isLoading is true", async () => {
      vi.doMock("@/hooks/useOrganizationSettings", () => ({
        useTeamNotifications: () => ({
          values: {},
          isLoading: true,
          error: null,
          updateSetting: vi.fn(),
          pendingFields: new Set(),
          dirtyFields: new Set(),
          markDirty: vi.fn(),
          markClean: vi.fn(),
          revert: vi.fn(),
          canEdit: true,
        }),
      }));

      const { useTeamNotifications } = await import("@/hooks/useOrganizationSettings");
      vi.mocked(useTeamNotifications).mockReturnValue({
        values: {},
        isLoading: true,
        error: null,
        updateSetting: vi.fn(),
        pendingFields: new Set(),
        dirtyFields: new Set(),
        markDirty: vi.fn(),
        markClean: vi.fn(),
        revert: vi.fn(),
        canEdit: true,
        fieldErrors: {},
        clearFieldError: vi.fn(),
      });

      // Re-render to pick up the mock change
      const { container } = renderTeamSettings();
      expect(container.querySelector("svg")).toBeTruthy();
    });
  });

  describe("Error state", () => {
    it("renders error alert when error is present", async () => {
      const { useTeamNotifications } = await import("@/hooks/useOrganizationSettings");
      vi.mocked(useTeamNotifications).mockReturnValue({
        values: {},
        isLoading: false,
        error: new Error("Failed to load"),
        updateSetting: vi.fn(),
        pendingFields: new Set(),
        dirtyFields: new Set(),
        markDirty: vi.fn(),
        markClean: vi.fn(),
        revert: vi.fn(),
        canEdit: true,
        fieldErrors: {},
        clearFieldError: vi.fn(),
      });

      renderTeamSettings();

      expect(screen.getByTestId("settings-alert")).toBeTruthy();
    });
  });

  describe("Notification toggles", () => {
    it("renders all notification toggles", () => {
      renderTeamSettings();

      expect(screen.getByLabelText("@Mentions")).toBeTruthy();
      expect(screen.getByLabelText("Task Assignments")).toBeTruthy();
      expect(screen.getByLabelText("Weekly Digest")).toBeTruthy();
      expect(screen.getByLabelText("Project Updates")).toBeTruthy();
      expect(screen.getByLabelText("Email Notifications")).toBeTruthy();
      expect(screen.getByLabelText("Slack Notifications")).toBeTruthy();
    });

    it("calls updateSetting and markDirty when toggle changes", () => {
      renderTeamSettings();

      const mentionsToggle = screen.getByLabelText("@Mentions");
      fireEvent.click(mentionsToggle);

      expect(mockUpdateSetting).toHaveBeenCalledWith("notifications.mentions", false);
      expect(mockMarkDirty).toHaveBeenCalledWith("notifications.mentions");
    });
  });

  describe("Bulk save", () => {
    it("shows bulk action bar when there are dirty fields", async () => {
      const { useTeamNotifications } = await import("@/hooks/useOrganizationSettings");
      vi.mocked(useTeamNotifications).mockReturnValue({
        values: { "notifications.mentions": true },
        isLoading: false,
        error: null,
        updateSetting: mockUpdateSetting,
        pendingFields: new Set(),
        dirtyFields: new Set(["notifications.mentions"]),
        markDirty: mockMarkDirty,
        markClean: mockMarkClean,
        revert: mockRevert,
        canEdit: true,
        fieldErrors: {},
        clearFieldError: vi.fn(),
      });

      renderTeamSettings();

      expect(screen.getByText("1 unsaved change")).toBeTruthy();
      expect(screen.getByText("Discard")).toBeTruthy();
      expect(screen.getByText("Save all")).toBeTruthy();
    });

    it("calls revert when Discard is clicked", async () => {
      const { useTeamNotifications } = await import("@/hooks/useOrganizationSettings");
      vi.mocked(useTeamNotifications).mockReturnValue({
        values: { "notifications.mentions": true },
        isLoading: false,
        error: null,
        updateSetting: mockUpdateSetting,
        pendingFields: new Set(),
        dirtyFields: new Set(["notifications.mentions"]),
        markDirty: mockMarkDirty,
        markClean: mockMarkClean,
        revert: mockRevert,
        canEdit: true,
        fieldErrors: {},
        clearFieldError: vi.fn(),
      });

      renderTeamSettings();

      fireEvent.click(screen.getByText("Discard"));

      expect(mockRevert).toHaveBeenCalled();
    });

    it("calls updateSetting for all dirty fields when Save all is clicked", async () => {
      const { useTeamNotifications } = await import("@/hooks/useOrganizationSettings");
      vi.mocked(useTeamNotifications).mockReturnValue({
        values: { "notifications.mentions": true, "notifications.weeklyDigest": false },
        isLoading: false,
        error: null,
        updateSetting: mockUpdateSetting,
        pendingFields: new Set(),
        dirtyFields: new Set(["notifications.mentions", "notifications.weeklyDigest"]),
        markDirty: mockMarkDirty,
        markClean: mockMarkClean,
        revert: mockRevert,
        canEdit: true,
        fieldErrors: {},
        clearFieldError: vi.fn(),
      });

      renderTeamSettings();

      fireEvent.click(screen.getByText("Save all"));

      await waitFor(() => {
        expect(mockUpdateSetting).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("Export settings", () => {
    it("exports settings as JSON when Export button is clicked", () => {
      renderTeamSettings();

      const exportButton = screen.getByText("Export Settings");
      fireEvent.click(exportButton);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe("Import settings", () => {
    it("imports settings from valid JSON file", async () => {
      renderTeamSettings();

      const fileInput = screen.getByLabelText("Import Settings") as HTMLInputElement;
      const validJson = JSON.stringify({
        notifications: {
          mentions: false,
          weeklyDigest: true,
        },
      });
      const file = new File([validJson], "settings.json", { type: "application/json" });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockUpdateSetting).toHaveBeenCalledWith("notifications.mentions", false);
        expect(mockUpdateSetting).toHaveBeenCalledWith("notifications.weeklyDigest", true);
      });
    });

    it("rejects files larger than 5MB", async () => {
      const { logger } = await import("@/lib/logger");
      renderTeamSettings();

      const fileInput = screen.getByLabelText("Import Settings") as HTMLInputElement;
      const largeContent = "x".repeat(6 * 1024 * 1024); // 6MB
      const file = new File([largeContent], "settings.json", { type: "application/json" });

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(logger.error).toHaveBeenCalledWith("Import failed: File too large (max 5MB)");
      expect(mockUpdateSetting).not.toHaveBeenCalled();
    });

    it("rejects non-JSON files", async () => {
      const { logger } = await import("@/lib/logger");
      renderTeamSettings();

      const fileInput = screen.getByLabelText("Import Settings") as HTMLInputElement;
      const file = new File(["not json"], "settings.txt", { type: "text/plain" });

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(logger.error).toHaveBeenCalledWith("Import failed: Invalid file type (expected JSON)");
    });
  });

  describe("Read-only access", () => {
    it("shows read-only indicator when user cannot edit", async () => {
      const { useConfigAccess } = await import("@/hooks/useConfigAccess");
      vi.mocked(useConfigAccess).mockReturnValue({
        checkAccess: () => ({ canEdit: false, denialReason: "Insufficient permissions", canView: true, canAdmin: false, requiredLevel: "tenant_admin", userLevel: "view_only" }),
        getAccessibleSettings: vi.fn(() => []),
        getSettingsByPermission: vi.fn(() => []),
        userRole: "viewer",
        isAdmin: false,
      });

      const { useTeamNotifications } = await import("@/hooks/useOrganizationSettings");
      vi.mocked(useTeamNotifications).mockReturnValue({
        values: {},
        isLoading: false,
        error: null,
        updateSetting: vi.fn(),
        pendingFields: new Set(),
        dirtyFields: new Set(),
        markDirty: vi.fn(),
        markClean: vi.fn(),
        revert: vi.fn(),
        canEdit: false,
        fieldErrors: {},
        clearFieldError: vi.fn(),
      });

      renderTeamSettings();

      expect(screen.getByText("You have view-only access to these settings.")).toBeTruthy();
    });
  });
});
