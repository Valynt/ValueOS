/**
 * Snapshot tests for Phase 2 dark design refactor.
 *
 * Each test renders a key shell/page component inside a `.dark` wrapper
 * to verify the semantic token class structure is stable.
 */

import { render } from "@testing-library/react";
import * as React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// ── Common mocks ──────────────────────────────────────────────────────────────

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { email: "test@example.com", id: "user-1" },
    login: vi.fn(),
    logout: vi.fn(),
    signup: vi.fn(),
    resetPassword: vi.fn(),
    signInWithProvider: vi.fn(),
    resendVerificationEmail: vi.fn(),
  })),
}));

vi.mock("../../i18n/I18nProvider", () => ({
  useI18n: vi.fn(() => ({
    locale: "en",
    setLocale: vi.fn(),
    t: (_key: string, fallback: string) => fallback,
  })),
}));

vi.mock("../../i18n", () => ({
  getSupportedLocales: vi.fn(() => [{ code: "en", label: "English" }]),
}));

vi.mock("../../hooks/useAnalytics", () => ({
  useAnalytics: vi.fn(() => ({
    trackFeatureUsage: vi.fn(),
    trackSearch: vi.fn(),
  })),
}));

vi.mock("../../hooks/useTenant", () => ({
  useTenant: vi.fn(() => ({
    currentTenant: { id: "t1", name: "Acme Inc", color: "#08A0A0" },
    tenants: [],
  })),
}));

vi.mock("../../stores/useNavStore", () => ({
  useNavStore: vi.fn(() => ({
    collapsed: false,
    setCollapsed: vi.fn(),
    frequentRoutes: [],
  })),
}));

// ── Helper ────────────────────────────────────────────────────────────────────

function renderDark(ui: React.ReactElement) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="dark">
      <MemoryRouter>{children}</MemoryRouter>
    </div>
  );
  return render(ui, { wrapper });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Dark design snapshot — Auth pages", () => {
  it("ModernLoginPage renders with semantic token classes", async () => {
    const { ModernLoginPage } = await import("../../views/Auth/ModernLoginPage");
    const { container } = renderDark(<ModernLoginPage />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("ModernSignupPage renders with semantic token classes", async () => {
    const { ModernSignupPage } = await import("../../views/Auth/ModernSignupPage");
    const { container } = renderDark(<ModernSignupPage />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("ResetPasswordPage renders with semantic token classes", async () => {
    const { ResetPasswordPage } = await import("../../views/Auth/ResetPasswordPage");
    const { container } = renderDark(<ResetPasswordPage />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("Dark design snapshot — DashboardPage", () => {
  it("renders KPI grid with semantic token classes", async () => {
    const DashboardPage = (await import("../../pages/app/DashboardPage")).default;
    const { container } = renderDark(<DashboardPage />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// bg-white/N (opacity modifier) is a valid semantic utility — only bare bg-white is forbidden.
const BARE_BG_WHITE = /\bbg-white(?!\/)/;
const BARE_BG_ZINC = /\bbg-zinc-\d+\b/;
const BARE_TEXT_ZINC = /\btext-zinc-\d+\b/;
const BARE_BORDER_ZINC = /\bborder-zinc-\d+\b/;

describe("Dark design snapshot — no hardcoded zinc/white classes in auth pages", () => {
  it("ModernLoginPage has no bare bg-white or bg-zinc-* classes", async () => {
    const { ModernLoginPage } = await import("../../views/Auth/ModernLoginPage");
    const { container } = renderDark(<ModernLoginPage />);
    const html = container.innerHTML;
    expect(html).not.toMatch(BARE_BG_WHITE);
    expect(html).not.toMatch(BARE_BG_ZINC);
    expect(html).not.toMatch(BARE_TEXT_ZINC);
    expect(html).not.toMatch(BARE_BORDER_ZINC);
  });

  it("ModernSignupPage has no bare bg-white or bg-zinc-* classes", async () => {
    const { ModernSignupPage } = await import("../../views/Auth/ModernSignupPage");
    const { container } = renderDark(<ModernSignupPage />);
    const html = container.innerHTML;
    expect(html).not.toMatch(BARE_BG_WHITE);
    expect(html).not.toMatch(BARE_BG_ZINC);
    expect(html).not.toMatch(BARE_TEXT_ZINC);
    expect(html).not.toMatch(BARE_BORDER_ZINC);
  });

  it("ResetPasswordPage has no bare bg-white or bg-zinc-* classes", async () => {
    const { ResetPasswordPage } = await import("../../views/Auth/ResetPasswordPage");
    const { container } = renderDark(<ResetPasswordPage />);
    const html = container.innerHTML;
    expect(html).not.toMatch(BARE_BG_WHITE);
    expect(html).not.toMatch(BARE_BG_ZINC);
    expect(html).not.toMatch(BARE_TEXT_ZINC);
    expect(html).not.toMatch(BARE_BORDER_ZINC);
  });

  it("DashboardPage has no bare bg-white or bg-zinc-* classes", async () => {
    const DashboardPage = (await import("../../pages/app/DashboardPage")).default;
    const { container } = renderDark(<DashboardPage />);
    const html = container.innerHTML;
    expect(html).not.toMatch(BARE_BG_WHITE);
    expect(html).not.toMatch(BARE_BG_ZINC);
    expect(html).not.toMatch(BARE_TEXT_ZINC);
    expect(html).not.toMatch(BARE_BORDER_ZINC);
  });
});
