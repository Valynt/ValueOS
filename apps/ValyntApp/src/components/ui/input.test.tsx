import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input, SearchInput, Textarea } from "./input";

describe("Input component", () => {
  it("renders standard input", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("applies aria-invalid when error prop is true", () => {
    render(<Input error />);
    // Use try/catch or expect to fail until fixed
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("does not apply aria-invalid when error prop is false", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});

describe("Textarea component", () => {
  it("applies aria-invalid when error prop is true", () => {
    render(<Textarea error />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });
});

describe("SearchInput component", () => {
  it("renders search input", () => {
    render(<SearchInput placeholder="Search" />);
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });

  it("hides decorative search icon from assistive technology", () => {
    const { container } = render(<SearchInput />);
    // The search icon is the first SVG inside the relative container
    // Lucide icons are SVGs
    const svg = container.querySelector("svg.lucide-search");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("provides accessible name for clear button", () => {
    const onClear = vi.fn();
    render(<SearchInput value="test" onClear={onClear} readOnly />);

    // Check if button exists and has accessible name
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName(/clear search/i);
  });
});
