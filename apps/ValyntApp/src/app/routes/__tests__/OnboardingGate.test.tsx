/**
 * OnboardingGate unit tests
 *
 * Verifies the gate redirects to /onboarding when onboarding is incomplete,
 * renders children when complete, and exempts /onboarding and /settings paths.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div>Navigate:{to}</div>,
    Outlet: () => <div>Outlet Content</div>,
  };
});

import { OnboardingGate } from "../OnboardingGate";

function renderGate(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <OnboardingGate />
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
    expect(screen.getByText("Navigate:/onboarding")).toBeTruthy();
    expect(screen.queryByText("Outlet Content")).toBeNull();
  });

  it("redirects to /onboarding when onboardingStatus is 'pending'", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "pending", isLoading: false });
    renderGate("/dashboard");
    expect(screen.getByText("Navigate:/onboarding")).toBeTruthy();
  });

  it("renders child route when onboarding is complete", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "complete", isLoading: false });
    renderGate("/dashboard");
    expect(screen.getByText("Outlet Content")).toBeTruthy();
  });

  it("renders children while loading (avoids flash)", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "none", isLoading: true });
    renderGate("/dashboard");
    expect(screen.getByText("Outlet Content")).toBeTruthy();
  });

  it("exempts /settings path from onboarding gate", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "none", isLoading: false });
    renderGate("/settings");
    expect(screen.getByText("Outlet Content")).toBeTruthy();
  });

  it("allows access when onboarding is bypassed", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "none", isLoading: false });
    mockIsOnboardingBypassed.mockReturnValue(true);
    renderGate("/dashboard");
    expect(screen.getByText("Outlet Content")).toBeTruthy();
  });

  it("passes tenant ID to isOnboardingBypassed", () => {
    mockUseCompanyValueContext.mockReturnValue({ onboardingStatus: "complete", isLoading: false });
    renderGate("/dashboard");
    expect(mockIsOnboardingBypassed).toHaveBeenCalledWith("t-1");
  });
});
