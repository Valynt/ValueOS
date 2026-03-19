import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseTenant = vi.fn();

function PassthroughProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

vi.mock("../contexts/AuthContext", () => ({
  AuthProvider: PassthroughProvider,
  useAuth: () => ({
    user: { id: "user-1" },
    loading: false,
    isAuthenticated: true,
    userClaims: null,
    session: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    resendVerificationEmail: vi.fn(),
    signInWithProvider: vi.fn(),
  }),
}));

vi.mock("../contexts/TenantContext", () => ({
  TenantProvider: PassthroughProvider,
  useTenant: () => mockUseTenant(),
}));

vi.mock("../contexts/CompanyContextProvider", () => ({
  CompanyContextProvider: PassthroughProvider,
}));

vi.mock("../contexts/DrawerContext", () => ({
  DrawerProvider: PassthroughProvider,
}));

vi.mock("../components/CommandPalette", () => ({
  CommandPaletteProvider: PassthroughProvider,
}));

vi.mock("../components/common/Toast", () => ({
  ToastProvider: PassthroughProvider,
}));

vi.mock("../i18n/I18nProvider", () => ({
  I18nProvider: PassthroughProvider,
}));

vi.mock("../lib/state/SDUIStateProvider", () => ({
  SDUIStateProvider: PassthroughProvider,
}));

vi.mock("../app/providers/SDUIHumanCheckpointProvider", () => ({
  SDUIHumanCheckpointProvider: PassthroughProvider,
}));

vi.mock("../components/common/ErrorBoundary", () => ({
  default: PassthroughProvider,
}));

vi.mock("../app/routes/route-guards", () => ({
  ProtectedRoute: () => <Outlet />,
}));

vi.mock("../app/routes/TenantGate", () => ({
  TenantGate: () => <Outlet />,
}));

vi.mock("../app/routes/OnboardingGate", () => ({
  OnboardingGate: () => <Outlet />,
}));

vi.mock("../layouts/MainLayout", () => ({
  MainLayout: () => <Outlet />,
}));

vi.mock("../pages/guest/GuestAccessPage", () => ({
  GuestAccessPage: () => <div>Mock Guest Access Page</div>,
}));

vi.mock("../views/Dashboard", () => ({
  default: () => <div>Mock Dashboard</div>,
}));

vi.mock("../components/feedback/BetaFeedbackWidget", () => ({
  BetaFeedbackWidget: () => null,
}));

vi.mock("../components/common/EnvironmentBanner", () => ({
  EnvironmentBanner: () => null,
}));

import { AppRoutes } from "../AppRoutes";

describe("AppRoutes guest access routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTenant.mockReturnValue({
      currentTenant: { id: "tenant-1", slug: "acme" },
      isLoading: false,
    });
    window.history.replaceState({}, "", "/guest/access?token=test-token");
  });

  it("renders the guest access page without redirecting to a tenant dashboard", async () => {
    render(<AppRoutes />);

    expect(await screen.findByText("Mock Guest Access Page")).toBeInTheDocument();
    expect(screen.queryByText("Mock Dashboard")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(window.location.pathname).toBe("/guest/access");
      expect(window.location.search).toBe("?token=test-token");
    });
  });
});
