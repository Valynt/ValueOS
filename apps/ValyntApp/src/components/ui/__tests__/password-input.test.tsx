import { describe, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordInput } from "../password-input";

describe("PasswordInput Component", () => {
  it("should render input with password type by default", () => {
    render(<PasswordInput placeholder="Enter password" />);
    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toHaveAttribute("type", "password");
  });

  it("should toggle password visibility when button is clicked", () => {
    render(<PasswordInput placeholder="Enter password" />);
    const input = screen.getByPlaceholderText("Enter password");
    const toggleButton = screen.getByRole("button", { name: /show password/i });

    // Initial state: password
    expect(input).toHaveAttribute("type", "password");

    // Click to show
    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute("type", "text");
    expect(toggleButton).toHaveAttribute("aria-label", "Hide password");

    // Click to hide
    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute("type", "password");
    expect(toggleButton).toHaveAttribute("aria-label", "Show password");
  });

  it("should forward refs", () => {
    const ref = { current: null };
    render(<PasswordInput ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("should apply custom classes", () => {
    render(<PasswordInput className="custom-class" data-testid="password-input" />);
    const input = screen.getByTestId("password-input");
    expect(input).toHaveClass("custom-class");
    // It should also have the hide-password-toggle class we added
    expect(input).toHaveClass("hide-password-toggle");
  });
});
