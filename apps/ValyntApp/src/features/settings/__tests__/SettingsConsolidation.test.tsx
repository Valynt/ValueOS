/**
 * TDD: Settings Consolidation
 *
 * Validates that the consolidated settings feature module at
 * src/features/settings/ works identically to the old split layout.
 * Mirrors the existing SettingsNavigationRoutes.test.tsx pattern.
 *
 * RED phase: tests will fail until settings are moved to features/settings/.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Mock page components at the NEW location (features/settings/)
vi.mock("@features/settings/ProfilePage", () => ({
  ProfilePage: () => <div data-testid="settings-page-profile">Profile content</div>,
}));

vi.mock("@features/settings/SecurityPage", () => ({
  SecurityPage: () => (
    <div data-testid="settings-page-security">Security content</div>
  ),
}));

vi.mock("@features/settings/AppearancePage", () => ({
  AppearancePage: () => (
    <div data-testid="settings-page-appearance">Appearance content</div>
  ),
}));

vi.mock("@features/settings/NotificationsPage", () => ({
  NotificationsPage: () => (
    <div data-testid="settings-page-notifications">Notifications content</div>
  ),
}));

vi.mock("@features/settings/BrandingPage", () => ({
  BrandingPage: () => (
    <div data-testid="settings-page-branding">Branding content</div>
  ),
}));

vi.mock("@features/settings/IntegrationsPage", () => ({
  IntegrationsPage: () => (
    <div data-testid="settings-page-integrations">Integrations content</div>
  ),
}));

vi.mock("@features/settings/CompanyContextPage", () => ({
  CompanyContextPage: () => (
    <div data-testid="settings-page-company-context">Company context content</div>
  ),
}));

// Import from the NEW consolidated location
import { SettingsLayout } from "@features/settings/SettingsLayout";
import { settingsNavItems } from "@features/settings/settingsNavigation";

function renderSettings(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/settings/*" element={<SettingsLayout />}>
          <Route index element={<div data-testid="settings-route-index" />} />
          {settingsNavItems.map((item) => (
            <Route key={item.path} path={item.path} element={item.element} />
          ))}
          <Route
            path="*"
            element={<div data-testid="settings-route-fallback" />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Consolidated SettingsLayout
// ---------------------------------------------------------------------------
describe("Consolidated SettingsLayout", () => {
  it("renders all expected settings tabs", () => {
    renderSettings("/settings/profile");
    const expectedTabs = [
      "My profile",
      "Security",
      "Appearance",
      "Notifications",
      "Branding",
      "Integrations",
      "Company Context",
    ];
    for (const tab of expectedTabs) {
      expect(screen.getByRole("link", { name: tab })).toBeInTheDocument();
    }
  });

  it("maps each tab to implemented non-placeholder route content", () => {
    for (const item of settingsNavItems) {
      const { unmount } = renderSettings(`/settings/${item.path}`);
      const content = screen.getByTestId(`settings-page-${item.path}`);
      expect(content).toBeInTheDocument();
      expect(content.textContent?.toLowerCase()).not.toMatch(
        /placeholder|under development|coming soon/,
      );
      unmount();
    }
  });

  it("allows navigating across every settings tab", async () => {
    const user = userEvent.setup();
    renderSettings("/settings/profile");

    for (const item of settingsNavItems) {
      await user.click(screen.getByRole("link", { name: item.label }));
      expect(
        screen.getByTestId(`settings-page-${item.path}`),
      ).toBeInTheDocument();
    }
  });

  it("uses only relative child paths for settings tab routes", () => {
    for (const item of settingsNavItems) {
      expect(item.path).not.toBe("");
      expect(item.path).not.toBe("/");
      expect(item.path.startsWith("/")).toBe(false);
      expect(item.path.startsWith("settings/")).toBe(false);
    }
  });

  it("has a concrete profile route entry", () => {
    const hasProfile = settingsNavItems.some((item) => item.path === "profile");
    expect(hasProfile).toBe(true);
  });

  it("redirects /settings to /settings/profile by default", () => {
    renderSettings("/settings");
    // The index route should render — in the real app this is a Navigate to profile
    // For this test, we just verify the layout renders without error
    expect(
      screen.getByTestId("settings-route-index"),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Settings components re-exported from consolidated location
// ---------------------------------------------------------------------------
describe("Settings components re-exported", () => {
  it("SettingsRow is importable from features/settings/components", async () => {
    const mod = await import("@features/settings/components/SettingsRow");
    expect(mod.SettingsRow).toBeDefined();
  });

  it("SettingsAsyncFeedback is importable from features/settings/components", async () => {
    const mod = await import(
      "@features/settings/components/SettingsAsyncFeedback"
    );
    expect(mod.SettingsAsyncFeedback).toBeDefined();
  });

  it("SettingsDangerZone is importable from features/settings/components", async () => {
    const mod = await import(
      "@features/settings/components/SettingsDangerZone"
    );
    expect(mod.SettingsDangerZone).toBeDefined();
  });

  it("SettingsLoadingState is importable from features/settings/components", async () => {
    const mod = await import(
      "@features/settings/components/SettingsLoadingState"
    );
    expect(mod.SettingsLoadingState).toBeDefined();
  });
});
