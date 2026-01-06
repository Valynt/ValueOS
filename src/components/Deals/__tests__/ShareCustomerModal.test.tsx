import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareCustomerModal } from "../ShareCustomerModal";
import { customerAccessService } from "@/services/CustomerAccessService";

vi.mock("@/services/CustomerAccessService", () => ({
  customerAccessService: {
    generateCustomerToken: vi.fn(),
    sendPortalAccessEmail: vi.fn(),
    getActiveTokensForValueCase: vi.fn(),
    revokeCustomerToken: vi.fn(),
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

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, type }: any) => (
    <button type={type || "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    readOnly,
    type,
    id,
    disabled,
    min,
    max,
    className,
  }: any) => (
    <input
      id={id}
      type={type || "text"}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      min={min}
      max={max}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

describe("ShareCustomerModal", () => {
  const DEFAULT_EXPIRES_IN_DAYS = 90;

  const valueCase = {
    id: "vc-1",
    name: "Deal",
    company: "Acme",
    stage: "opportunity",
    status: "in-progress",
    created_at: new Date(),
    updated_at: new Date(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (customerAccessService.generateCustomerToken as any).mockResolvedValue({
      token: "tok",
      expires_at: "2026-01-01T00:00:00Z",
      portal_url: "https://example.com/customer/portal?token=tok",
    });
    (customerAccessService.sendPortalAccessEmail as any).mockResolvedValue(
      undefined
    );
    (
      customerAccessService.getActiveTokensForValueCase as any
    ).mockResolvedValue([
      {
        id: "t1",
        token: "tok",
        revoked_at: null,
        expires_at: "2999-01-01T00:00:00Z",
      },
    ]);
    (customerAccessService.revokeCustomerToken as any).mockResolvedValue(true);
  });

  it("generates token and sends email", async () => {
    render(
      <ShareCustomerModal
        open={true}
        onClose={() => {}}
        valueCase={valueCase}
        revokedByUserId="user-1"
      />
    );

    fireEvent.change(screen.getByLabelText(/customer email/i), {
      target: { value: "buyer@acme.com" },
    });

    fireEvent.click(screen.getByText(/generate & send/i));

    await waitFor(() => {
      expect(customerAccessService.generateCustomerToken).toHaveBeenCalledWith(
        "vc-1",
        DEFAULT_EXPIRES_IN_DAYS
      );
    });

    expect(customerAccessService.sendPortalAccessEmail).toHaveBeenCalledWith(
      "buyer@acme.com",
      "Acme",
      "https://example.com/customer/portal?token=tok"
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/portal link/i)).toBeInTheDocument();
    });
  });

  it("revokes most recent active token", async () => {
    render(
      <ShareCustomerModal
        open={true}
        onClose={() => {}}
        valueCase={valueCase}
        revokedByUserId="user-1"
      />
    );

    fireEvent.change(screen.getByLabelText(/customer email/i), {
      target: { value: "buyer@acme.com" },
    });

    fireEvent.click(screen.getByText(/generate & send/i));

    await waitFor(() => {
      expect(screen.getByText(/revoke/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/^revoke$/i));

    await waitFor(() => {
      expect(customerAccessService.revokeCustomerToken).toHaveBeenCalledWith(
        "tok",
        "user-1",
        "Revoked from share modal"
      );
    });
  });
});
