import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Input, SearchInput, Textarea } from "./input";

describe("Input component", () => {
  it("renders correctly", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("handles error state", () => {
    render(<Input error />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-destructive");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});

describe("SearchInput component", () => {
  it("renders with search type", () => {
    render(<SearchInput placeholder="Search..." />);
    const input = screen.getByPlaceholderText("Search...");
    expect(input).toHaveAttribute("type", "search");
  });

  it("shows clear button when value is present", async () => {
    const onClear = vi.fn();
    const { rerender } = render(<SearchInput value="" onClear={onClear} onChange={() => {}} />);

    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();

    rerender(<SearchInput value="test" onClear={onClear} onChange={() => {}} />);

    const clearButton = screen.getByLabelText("Clear search");
    expect(clearButton).toBeInTheDocument();

    await userEvent.click(clearButton);
    expect(onClear).toHaveBeenCalled();
  });

  it("should have class to hide native webkit clear button", () => {
    render(<SearchInput />);
    const input = screen.getByRole("searchbox");
    // Check that the class name contains the specific Tailwind arbitrary variant
    expect(input.className).toContain("[&::-webkit-search-cancel-button]:hidden");
  });
});

describe("Textarea component", () => {
  it("renders correctly", () => {
    render(<Textarea placeholder="Enter long text" />);
    expect(screen.getByPlaceholderText("Enter long text")).toBeInTheDocument();
  });
});
