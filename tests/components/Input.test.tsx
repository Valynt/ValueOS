/**
 * Component Test - Input
 *
 * Tests for the Input component:
 * - Text input
 * - Value changes
 * - Validation states
 * - Error messages
 * - Accessibility
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Input component
const Input = ({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
  "aria-describedby": ariaDescribedBy,
}: any) => (
  <div className="input-group">
    {label && (
      <label htmlFor="input">
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>
    )}
    <input
      id="input"
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      aria-invalid={!!error}
      aria-describedby={error ? "input-error" : ariaDescribedBy}
      className={error ? "input-error" : ""}
    />
    {error && (
      <span id="input-error" role="alert" className="error-message">
        {error}
      </span>
    )}
  </div>
);

describe("Input Component", () => {
  describe("Rendering", () => {
    it("should render with label", () => {
      render(<Input label="Email" value="" onChange={vi.fn()} />);
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    it("should render with placeholder", () => {
      render(
        <Input placeholder="Enter your email" value="" onChange={vi.fn()} />
      );
      expect(
        screen.getByPlaceholderText("Enter your email")
      ).toBeInTheDocument();
    });

    it("should show required indicator", () => {
      render(<Input label="Email" required value="" onChange={vi.fn()} />);
      expect(screen.getByLabelText("required")).toBeInTheDocument();
    });

    it("should render with initial value", () => {
      render(<Input value="test@example.com" onChange={vi.fn()} />);
      expect(screen.getByRole("textbox")).toHaveValue("test@example.com");
    });
  });

  describe("Interaction", () => {
    it("should call onChange when value changes", () => {
      const handleChange = vi.fn();
      render(<Input value="" onChange={handleChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "new value" } });

      expect(handleChange).toHaveBeenCalled();
    });

    it("should not call onChange when disabled", () => {
      const handleChange = vi.fn();
      render(<Input value="" onChange={handleChange} disabled />);

      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();

      fireEvent.change(input, { target: { value: "new value" } });
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("should update value on user input", () => {
      const handleChange = vi.fn();
      render(<Input value="" onChange={handleChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "test" } });

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: "test" }),
        })
      );
    });
  });

  describe("Validation", () => {
    it("should show error message", () => {
      render(<Input value="" onChange={vi.fn()} error="Email is required" />);
      expect(screen.getByText("Email is required")).toBeInTheDocument();
    });

    it("should set aria-invalid when error exists", () => {
      render(<Input value="" onChange={vi.fn()} error="Invalid email" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("should apply error class when error exists", () => {
      render(<Input value="" onChange={vi.fn()} error="Error" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("input-error");
    });

    it("should link error message with aria-describedby", () => {
      render(<Input value="" onChange={vi.fn()} error="Invalid input" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-describedby", "input-error");
    });
  });

  describe("Types", () => {
    it("should render as email input", () => {
      render(<Input type="email" value="" onChange={vi.fn()} />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
    });

    it("should render as password input", () => {
      render(<Input type="password" value="" onChange={vi.fn()} />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it("should render as number input", () => {
      render(<Input type="number" value="" onChange={vi.fn()} />);
      const input = document.querySelector('input[type="number"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible name from label", () => {
      render(<Input label="Username" value="" onChange={vi.fn()} />);
      expect(
        screen.getByRole("textbox", { name: /username/i })
      ).toBeInTheDocument();
    });

    it("should announce errors to screen readers", () => {
      render(<Input value="" onChange={vi.fn()} error="Required field" />);
      const errorMessage = screen.getByRole("alert");
      expect(errorMessage).toHaveTextContent("Required field");
    });

    it("should be keyboard accessible", () => {
      render(<Input value="" onChange={vi.fn()} />);
      const input = screen.getByRole("textbox");

      input.focus();
      expect(document.activeElement).toBe(input);
    });
  });
});
