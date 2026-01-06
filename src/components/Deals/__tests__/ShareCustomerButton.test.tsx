import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ShareCustomerButton } from "../ShareCustomerButton";

vi.mock("lucide-react", () => ({
  Share2: () => <svg />,
}));

vi.mock("../ShareCustomerModal", () => ({
  ShareCustomerModal: ({ open }: any) => (open ? <div>Modal Open</div> : null),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe("ShareCustomerButton", () => {
  it("opens modal when clicked", () => {
    render(
      <ShareCustomerButton
        valueCase={{ id: "vc-1", company: "Acme" } as any}
        userId="user-1"
      />
    );

    fireEvent.click(screen.getByText(/share with customer/i));

    expect(screen.getByText("Modal Open")).toBeInTheDocument();
  });
});
