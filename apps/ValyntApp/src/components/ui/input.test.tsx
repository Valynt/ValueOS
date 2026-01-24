import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Input, SearchInput, Textarea } from "./input";

describe("Input", () => {
  it("renders with error state correctly", () => {
    render(<Input error placeholder="Error input" />);
    const input = screen.getByPlaceholderText("Error input");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("does not have aria-invalid when no error", () => {
    render(<Input placeholder="Normal input" />);
    const input = screen.getByPlaceholderText("Normal input");
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});

describe("SearchInput", () => {
  it("renders search icon as decorative", () => {
    const { container } = render(<SearchInput />);
    // The search icon is the first SVG in the container
    const searchIcon = container.querySelector("svg");
    expect(searchIcon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders clear button with aria-label", () => {
    const onClear = vi.fn();
    render(<SearchInput value="test" onClear={onClear} />);

    // Should be able to find by role button and name
    const clearButton = screen.getByRole("button", { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalled();
  });
});

describe("Textarea", () => {
  it("renders with error state correctly", () => {
    render(<Textarea error placeholder="Error textarea" />);
    const textarea = screen.getByPlaceholderText("Error textarea");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });
});
