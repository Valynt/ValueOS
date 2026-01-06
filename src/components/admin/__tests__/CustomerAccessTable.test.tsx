import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CustomerAccessTable } from "../CustomerAccessTable";
import { customerAccessService } from "@/services/CustomerAccessService";

vi.mock("@/services/CustomerAccessService", () => ({
  customerAccessService: {
    revokeCustomerToken: vi.fn(),
    regenerateToken: vi.fn(),
    getPortalUrl: vi.fn(),
  },
}));

vi.mock("@/components/Common/Toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    showToast: vi.fn(),
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange }: any) => (
    <input value={value} onChange={onChange} />
  ),
}));

describe("CustomerAccessTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (customerAccessService.revokeCustomerToken as any).mockResolvedValue(true);
    (customerAccessService.regenerateToken as any).mockResolvedValue({
      token: "new",
      expires_at: "2026-01-01T00:00:00Z",
      portal_url: "https://example.com/customer/portal?token=new",
    });
    (customerAccessService.getPortalUrl as any).mockReturnValue(
      "https://example.com/customer/portal?token=tok"
    );

    (navigator as any).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("renders tokens and copies link", async () => {
    render(
      <CustomerAccessTable
        tokens={[
          {
            id: "1",
            value_case_id: "vc-1",
            token: "tok",
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2999-01-01T00:00:00Z",
            last_accessed_at: null,
            access_count: 0,
            revoked_at: null,
            revoked_by: null,
            revoke_reason: null,
          },
        ]}
        valueCaseId="vc-1"
        userId="user-1"
        onRefresh={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByText(/copy link/i));

    await waitFor(() => {
      expect(customerAccessService.getPortalUrl).toHaveBeenCalledWith("tok");
      expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith(
        "https://example.com/customer/portal?token=tok"
      );
    });
  });

  it("revokes token", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <CustomerAccessTable
        tokens={[
          {
            id: "1",
            value_case_id: "vc-1",
            token: "tok",
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2999-01-01T00:00:00Z",
            last_accessed_at: null,
            access_count: 0,
            revoked_at: null,
            revoked_by: null,
            revoke_reason: null,
          },
        ]}
        valueCaseId="vc-1"
        userId="user-1"
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByText(/^revoke$/i));

    await waitFor(() => {
      expect(customerAccessService.revokeCustomerToken).toHaveBeenCalledWith(
        "tok",
        "user-1",
        "Revoked from admin"
      );
      expect(onRefresh).toHaveBeenCalled();
    });
  });
});
