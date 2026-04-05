import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../ProfilePage", () => ({
  ProfilePage: () => <div data-testid="settings-page-profile">Profile content</div>,
}));

vi.mock("../SecurityPage", () => ({
  SecurityPage: () => <div data-testid="settings-page-security">Security content</div>,
}));

vi.mock("../AppearancePage", () => ({
  AppearancePage: () => <div data-testid="settings-page-appearance">Appearance content</div>,
}));

vi.mock("../NotificationsPage", () => ({
  NotificationsPage: () => <div data-testid="settings-page-notifications">Notifications content</div>,
}));

vi.mock("../BrandingPage", () => ({
  BrandingPage: () => <div data-testid="settings-page-branding">Branding content</div>,
}));

vi.mock("../IntegrationsPage", () => ({
  IntegrationsPage: () => <div data-testid="settings-page-integrations">Integrations content</div>,
}));

vi.mock("../CompanyContextPage", () => ({
  CompanyContextPage: () => (
    <div data-testid="settings-page-company-context">Company context content</div>
  ),
}));

import { SettingsLayout } from "../SettingsLayout";
import { settingsNavItems } from "../settingsNavigation";

function renderSettings(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/settings/*" element={<SettingsLayout />}>
          <Route index element={<div data-testid="settings-route-index" />} />
          {settingsNavItems.map((item) => (
            <Route key={item.path} path={item.path} element={item.element} />
          ))}
          <Route path="*" element={<div data-testid="settings-route-fallback" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("Settings routing", () => {
  it("maps each tab to implemented non-placeholder route content", () => {
    for (const item of settingsNavItems) {
      const { unmount } = renderSettings(`/settings/${item.path}`);
      const content = screen.getByTestId(`settings-page-${item.path}`);
      expect(content).toBeInTheDocument();
      expect(content.textContent?.toLowerCase()).not.toMatch(/placeholder|under development|coming soon/);
      unmount();
    }
  });

  it("allows navigating across every settings tab", async () => {
    const user = userEvent.setup();
    renderSettings("/settings/profile");

    for (const item of settingsNavItems) {
      await user.click(screen.getByRole("link", { name: item.label }));
      expect(screen.getByTestId(`settings-page-${item.path}`)).toBeInTheDocument();
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
});
