import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("renders with type password by default", () => {
    render(<PasswordInput placeholder="Enter password" />);
    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggles password visibility", () => {
    render(<PasswordInput placeholder="Enter password" />);
    const input = screen.getByPlaceholderText("Enter password");
    const toggleButton = screen.getByLabelText("Show password");

    // Initially password
    expect(input).toHaveAttribute("type", "password");

    // Click toggle
    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Hide password")).toBeInTheDocument();

    // Click toggle again
    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Show password")).toBeInTheDocument();
  });

  it("forwards refs", () => {
    const ref = { current: null };
    render(<PasswordInput ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("applies custom className", () => {
    render(<PasswordInput data-testid="password-input" className="custom-class" />);
    const input = screen.getByTestId("password-input");
    expect(input).toHaveClass("custom-class");
  });
});
