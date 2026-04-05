import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { PermissionRoute } from "@/app/routes/route-guards";
import { UsersPage } from "@/pages/admin/UsersPage";
import { PERMISSIONS } from "@/lib/permissions";

const mockUseAuth = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("admin permission integration", () => {
  it("redirects unauthorized roles away from admin routes", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      userClaims: {
        roles: ["member"],
        permissions: [PERMISSIONS.SETTINGS_VIEW],
      },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route
            element={<PermissionRoute requiredPermissions={[PERMISSIONS.ADMIN_MANAGE]} />}
          >
            <Route path="/admin" element={<div>Admin Sensitive Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Admin Sensitive Page")).not.toBeInTheDocument();
  });

  it("hides admin user-management actions for unauthorized roles", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-2" },
      userClaims: {
        roles: ["member"],
        permissions: [PERMISSIONS.SETTINGS_VIEW],
      },
      loading: false,
    });

    render(<UsersPage />);

    expect(screen.queryByRole("button", { name: "Invite User" })).not.toBeInTheDocument();
    const actionButtons = screen.getAllByLabelText("More actions");
    actionButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });
});
