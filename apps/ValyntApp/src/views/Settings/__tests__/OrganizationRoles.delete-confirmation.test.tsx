import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { OrganizationRoles } from "../OrganizationRoles";

const successToastMock = vi.fn();
const errorToastMock = vi.fn();

const fetchRoleMatrixMock = vi.fn();
const deleteRoleMock = vi.fn();

vi.mock("@/components/common/Toast", () => ({
  useToast: () => ({
    success: successToastMock,
    error: errorToastMock,
  }),
}));

vi.mock("@/services/adminSettingsService", () => ({
  fetchRoleMatrix: (...args: unknown[]) => fetchRoleMatrixMock(...args),
  createRole: vi.fn(),
  deleteRole: (...args: unknown[]) => deleteRoleMock(...args),
}));

describe("OrganizationRoles destructive confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchRoleMatrixMock.mockResolvedValue([
      {
        id: "role-1",
        name: "Finance Admin",
        description: "Can manage all finance settings",
        permissions: [],
      },
    ]);
    deleteRoleMock.mockResolvedValue(undefined);
  });

  const openDeleteFlow = async () => {
    render(<OrganizationRoles />);

    await screen.findByText("Finance Admin");

    fireEvent.click(screen.getByRole("button", { name: "Delete role Finance Admin" }));

    return screen.getByRole("button", { name: "Delete role" });
  };

  it("blocks action until the role name phrase matches", async () => {
    const confirmButton = await openDeleteFlow();

    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type\s+Finance Admin\s+to confirm/i), {
      target: { value: "Wrong phrase" },
    });

    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type\s+Finance Admin\s+to confirm/i), {
      target: { value: "Finance Admin" },
    });

    expect(confirmButton).toBeEnabled();
  });

  it("does not call delete API on cancel", async () => {
    await openDeleteFlow();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteRoleMock).not.toHaveBeenCalled();
  });

  it("calls delete endpoint exactly once on confirmation", async () => {
    const confirmButton = await openDeleteFlow();

    fireEvent.change(screen.getByLabelText(/Type\s+Finance Admin\s+to confirm/i), {
      target: { value: "Finance Admin" },
    });

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteRoleMock).toHaveBeenCalledTimes(1);
    });
    expect(deleteRoleMock).toHaveBeenCalledWith("role-1");
  });
});
