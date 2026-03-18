/**
 * OnboardingGate unit tests
 *
 * Verifies the gate redirects to /onboarding when onboarding is incomplete,
 * renders children when complete, and exempts /onboarding and /settings paths.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseCompanyValueContext = vi.fn();
const mockUseTenant = vi.fn();
const mockIsOnboardingBypassed = vi.fn();

vi.mock("@/contexts/CompanyContextProvider", () => ({
  useCompanyValueContext: () => mockUseCompanyValueContext(),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@/lib/onboarding-bypass", () => ({
  isOnboardingBypassed: (tenantId: string | undefined) => mockIsOnboardingBypassed(tenantId),
}));

import { OnboardingGate } from "../OnboardingGate";

function renderGate(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        <Route element={<OnboardingGate />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          <Route path="/onboarding" element={<div>Onboarding Content (gated)</div>} />
          <Route path="/settings" element={<div>Settings Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("OnboardingGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTenant.mockReturnValue({ currentTenant: { id: "t-1", slug: "acme" } });
    mockIsOnboardingBypassed.mockReturnValue(false);
  });

  it("redirects to /onboarding when onboardingStatus is 'none'", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "none", isLoading: false });
    renderGate("/dashboard");
    expect(screen.getByText("Onboarding Page")).toBeTruthy();
    expect(screen.queryByText("Dashboard Content")).toBeNull();
  });

  it("redirects to /onboarding when onboardingStatus is 'pending'", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "pending", isLoading: false });
    renderGate("/dashboard");
    expect(screen.getByText("Onboarding Page")).toBeTruthy();
  });

  it("renders child route when onboarding is complete", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "complete", isLoading: false });
    renderGate("/dashboard");
    expect(screen.getByText("Dashboard Content")).toBeTruthy();
  });

  it("renders children while loading (avoids flash)", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "none", isLoading: true });
    renderGate("/dashboard");
    expect(screen.getByText("Dashboard Content")).toBeTruthy();
  });

  it("exempts /settings path from onboarding gate", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "none", isLoading: false });
    renderGate("/settings");
    expect(screen.getByText("Settings Content")).toBeTruthy();
  });

  it("allows access when onboarding is bypassed", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "none", isLoading: false });
    mockIsOnboardingBypassed.mockReturnValue(true);
    renderGate("/dashboard");
    expect(screen.getByText("Dashboard Content")).toBeTruthy();
  });

  it("passes tenant ID to isOnboardingBypassed", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "complete", isLoading: false });
    renderGate("/dashboard");
    expect(mockIsOnboardingBypassed).toHaveBeenCalledWith("t-1");
  });
});
