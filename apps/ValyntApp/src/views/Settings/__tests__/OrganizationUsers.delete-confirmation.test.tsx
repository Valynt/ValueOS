import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationUsers } from "../OrganizationUsers";

const successToastMock = vi.fn();
const errorToastMock = vi.fn();
const getMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "token" },
  }),
}));

vi.mock("../../../components/common/Toast", () => ({
  useToast: () => ({
    success: successToastMock,
    error: errorToastMock,
  }),
}));

vi.mock("../../../api/client/unified-api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock("../../../lib/analyticsClient", () => ({
  analyticsClient: {
    trackWorkflowEvent: vi.fn(),
  },
}));

describe("OrganizationUsers destructive confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({
      success: true,
      data: {
        users: [
          {
            userUuid: "user-1",
            tenantId: "tenant-1",
            email: "person@example.com",
            emailVerified: true,
            displayName: "Pat User",
            role: "member",
            status: "active",
            lastLoginAt: null,
            creationSource: "invite",
            mfaEnrolled: false,
            deviceCount: 0,
            deviceListReference: "",
          },
        ],
      },
    });
    deleteMock.mockResolvedValue({ success: true });
  });

  const openRemoveFlow = async () => {
    render(<OrganizationUsers />);
    await screen.findByText("person@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    return screen.getByRole("button", { name: "Remove user" });
  };

  it("blocks removal until typed email phrase matches", async () => {
    const confirmButton = await openRemoveFlow();

    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type\s+person@example\.com\s+to confirm/i), {
      target: { value: "wrong@example.com" },
    });

    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type\s+person@example\.com\s+to confirm/i), {
      target: { value: "person@example.com" },
    });

    expect(confirmButton).toBeEnabled();
  });

  it("does not call delete API on cancel", async () => {
    await openRemoveFlow();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("calls delete endpoint exactly once when confirmed", async () => {
    const confirmButton = await openRemoveFlow();

    fireEvent.change(screen.getByLabelText(/Type\s+person@example\.com\s+to confirm/i), {
      target: { value: "person@example.com" },
    });

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
    expect(deleteMock).toHaveBeenCalledWith("/api/admin/users/user-1");
  });
});
