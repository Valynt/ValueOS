import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "./input";

describe("SearchInput component", () => {
  it("renders with search icon", () => {
    render(<SearchInput placeholder="Search..." />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("shows clear button when value is present and onClear is provided", () => {
    const onClear = vi.fn();
    render(<SearchInput value="test" onClear={onClear} onChange={() => {}} />);

    // This will check for the accessible name
    const clearButton = screen.getByRole("button", { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
  });

  it("calls onClear when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<SearchInput value="test" onClear={onClear} onChange={() => {}} />);

    const clearButton = screen.getByRole("button", { name: /clear search/i });
    await user.click(clearButton);
    expect(onClear).toHaveBeenCalled();
  });
});
