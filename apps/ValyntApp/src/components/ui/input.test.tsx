import { render, screen, fireEvent } from "@testing-library/react";
import { SearchInput } from "./input";
import { describe, it, vi } from "vitest";

describe("SearchInput", () => {
  it("renders search icon with aria-hidden='true'", () => {
    const { container } = render(<SearchInput />);
    // The search icon has the class 'lucide-search'
    const icon = container.querySelector(".lucide-search");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders clear button with accessible label when value is present", () => {
    const handleClear = vi.fn();
    render(<SearchInput value="test" onClear={handleClear} onChange={() => {}} />);

    // This looks for an element with aria-label="Clear search"
    const clearButton = screen.getByLabelText("Clear search");
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(handleClear).toHaveBeenCalled();
  });
});
