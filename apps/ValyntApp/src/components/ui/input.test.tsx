import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SearchInput } from "./input";

describe("SearchInput component", () => {
  it("renders a search input", () => {
    render(<SearchInput placeholder="Search..." />);
    const input = screen.getByRole("searchbox");
    expect(input).toBeInTheDocument();
  });

  it("renders with type='search'", () => {
    render(<SearchInput />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("type", "search");
  });
});
