import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CustomerAccessManagement } from "../CustomerAccessManagement";
import { valueCaseService } from "@/services/ValueCaseService";
import { customerAccessService } from "@/services/CustomerAccessService";

vi.mock("@/services/ValueCaseService", () => ({
  valueCaseService: {
    getValueCases: vi.fn(),
  },
}));

vi.mock("@/services/CustomerAccessService", () => ({
  customerAccessService: {
    getTokensForValueCase: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/components/common/Toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    showToast: vi.fn(),
  }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div>
      <div data-testid="select-value">{value}</div>
      <button onClick={() => onValueChange("vc-2")}>change</button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <div>{placeholder}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
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

vi.mock("@/components/Admin/CustomerAccessTable", () => ({
  CustomerAccessTable: ({ tokens }: any) => (
    <div data-testid="customer-access-table">{tokens.length}</div>
  ),
}));

describe("CustomerAccessManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (valueCaseService.getValueCases as any).mockResolvedValue([
      {
        id: "vc-1",
        company: "Acme",
        name: "Deal 1",
        stage: "opportunity",
        status: "in-progress",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "vc-2",
        company: "Beta",
        name: "Deal 2",
        stage: "opportunity",
        status: "in-progress",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    (customerAccessService.getTokensForValueCase as any).mockResolvedValue([]);
  });

  it("loads deals and fetches tokens for default selection", async () => {
    render(<CustomerAccessManagement />);

    await waitFor(() => {
      expect(valueCaseService.getValueCases).toHaveBeenCalled();
      expect(customerAccessService.getTokensForValueCase).toHaveBeenCalledWith(
        "vc-1"
      );
    });

    expect(screen.getByTestId("customer-access-table")).toBeInTheDocument();
  });

  it("fetches tokens when value case changes", async () => {
    render(<CustomerAccessManagement />);

    await waitFor(() => {
      expect(customerAccessService.getTokensForValueCase).toHaveBeenCalledWith(
        "vc-1"
      );
    });

    fireEvent.click(screen.getByText("change"));

    await waitFor(() => {
      expect(customerAccessService.getTokensForValueCase).toHaveBeenCalledWith(
        "vc-2"
      );
    });
  });
});
