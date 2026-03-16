import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi } from "vitest";

import { Badge } from "./badge";

describe("Badge Component", () => {
  it("renders with default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-primary");
  });

  it("renders removable badge with accessible remove button", async () => {
    const onRemove = vi.fn();
    render(<Badge removable onRemove={onRemove}>Removable</Badge>);

    // This expects aria-label="Remove" (or similar) on the button
    const button = screen.getByRole("button", { name: /remove/i });
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);
    expect(onRemove).toHaveBeenCalled();
  });

  it("does not render remove button when not removable", () => {
    render(<Badge>Not Removable</Badge>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
