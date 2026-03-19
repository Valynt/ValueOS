import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/providers/SDUIHumanCheckpointProvider", () => ({
  SDUIHumanCheckpointProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../app/routes/OnboardingGate", () => ({
  OnboardingGate: () => <div>Onboarding Gate</div>,
}));
vi.mock("../../../app/routes/route-guards", () => ({
  ProtectedRoute: () => <div>Protected Route</div>,
}));
vi.mock("../../../app/routes/TenantGate", () => ({
  TenantGate: () => <div>Tenant Gate</div>,
}));
vi.mock("../../../components/CommandPalette", () => ({
  CommandPaletteProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../components/common/ErrorBoundary", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../components/common/LoadingSpinner", () => ({
  LoadingSpinner: () => <div>Loading…</div>,
}));
vi.mock("../../../components/common/Toast", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../contexts/CompanyContextProvider", () => ({
  CompanyContextProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../contexts/DrawerContext", () => ({
  DrawerProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../contexts/TenantContext", () => ({
  TenantProvider: ({ children }: { children: ReactNode }) => children,
  useTenant: () => ({ currentTenant: null, isLoading: false }),
}));
vi.mock("../../../i18n/I18nProvider", () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../lib/state/SDUIStateProvider", () => ({
  SDUIStateProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../../lib/supabase", () => ({ supabase: {} }));
vi.mock("../../../components/feedback/BetaFeedbackWidget", () => ({
  BetaFeedbackWidget: () => null,
}));
vi.mock("../../../components/common/EnvironmentBanner", () => ({
  EnvironmentBanner: () => null,
}));
vi.mock("../../../pages/guest", () => ({
  GuestAccessPage: () => <div>Guest Access Page</div>,
}));
vi.mock("../../../views/Auth/ModernLoginPage", () => ({ ModernLoginPage: () => <div>Login Page</div> }));
vi.mock("../../../views/Auth/ModernSignupPage", () => ({ ModernSignupPage: () => <div>Signup Page</div> }));
vi.mock("../../../views/Auth/ResetPasswordPage", () => ({ default: () => <div>Reset Password</div> }));
vi.mock("../../../views/Auth/AuthCallback", () => ({ default: () => <div>Auth Callback</div> }));

beforeEach(() => {
  window.history.pushState({}, "", "/guest/access?token=test-token");
});

describe("AppRoutes guest access route", () => {
  it("renders the guest access page instead of redirecting into tenant routing", async () => {
    const { AppRoutes } = await import("../../../AppRoutes");

    render(<AppRoutes />);

    expect(await screen.findByText("Guest Access Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Route")).not.toBeInTheDocument();
    expect(screen.queryByText("Tenant Gate")).not.toBeInTheDocument();
  });
});
