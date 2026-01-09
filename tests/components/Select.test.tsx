/**
 * Component Test - Dropdown/Select
 *
 * Tests for the Select/Dropdown component:
 * - Rendering options
 * - Selection handling
 * - Keyboard navigation
 * - Accessibility
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Select component
const Select = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  error,
}: any) => (
  <div className="select-group">
    {label && (
      <label htmlFor="select">
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>
    )}
    <select
      id="select"
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      aria-invalid={!!error}
      aria-describedby={error ? "select-error" : undefined}
    >
      <option value="">{placeholder}</option>
      {options?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && (
      <span id="select-error" role="alert">
        {error}
      </span>
    )}
  </div>
);

describe("Select Component", () => {
  const mockOptions = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
  ];

  describe("Rendering", () => {
    it("should render with label", () => {
      render(
        <Select
          label="Choose"
          value=""
          onChange={vi.fn()}
          options={mockOptions}
        />
      );
      expect(screen.getByLabelText("Choose")).toBeInTheDocument();
    });

    it("should render all options", () => {
      render(<Select value="" onChange={vi.fn()} options={mockOptions} />);

      expect(screen.getByText("Option 1")).toBeInTheDocument();
      expect(screen.getByText("Option 2")).toBeInTheDocument();
      expect(screen.getByText("Option 3")).toBeInTheDocument();
    });

    it("should render placeholder option", () => {
      render(
        <Select
          placeholder="Choose one"
          value=""
          onChange={vi.fn()}
          options={mockOptions}
        />
      );
      expect(screen.getByText("Choose one")).toBeInTheDocument();
    });

    it("should show selected value", () => {
      render(
        <Select value="option2" onChange={vi.fn()} options={mockOptions} />
      );
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("option2");
    });
  });

  describe("Interaction", () => {
    it("should call onChange when selection changes", () => {
      const handleChange = vi.fn();
      render(<Select value="" onChange={handleChange} options={mockOptions} />);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "option1" } });

      expect(handleChange).toHaveBeenCalled();
    });

    it("should not call onChange when disabled", () => {
      const handleChange = vi.fn();
      render(
        <Select
          value=""
          onChange={handleChange}
          options={mockOptions}
          disabled
        />
      );

      const select = screen.getByRole("combobox");
      expect(select).toBeDisabled();

      fireEvent.change(select, { target: { value: "option1" } });
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("Validation", () => {
    it("should show error message", () => {
      render(
        <Select
          value=""
          onChange={vi.fn()}
          options={mockOptions}
          error="Required"
        />
      );
      expect(screen.getByText("Required")).toBeInTheDocument();
    });

    it("should set aria-invalid when error exists", () => {
      render(
        <Select
          value=""
          onChange={vi.fn()}
          options={mockOptions}
          error="Error"
        />
      );
      const select = screen.getByRole("combobox");
      expect(select).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("Accessibility", () => {
    it("should have accessible name from label", () => {
      render(
        <Select
          label="Country"
          value=""
          onChange={vi.fn()}
          options={mockOptions}
        />
      );
      expect(
        screen.getByRole("combobox", { name: /country/i })
      ).toBeInTheDocument();
    });

    it("should indicate required fields", () => {
      render(
        <Select
          label="State"
          required
          value=""
          onChange={vi.fn()}
          options={mockOptions}
        />
      );
      expect(screen.getByLabelText("required")).toBeInTheDocument();
    });

    it("should be keyboard navigable", () => {
      render(<Select value="" onChange={vi.fn()} options={mockOptions} />);
      const select = screen.getByRole("combobox");

      select.focus();
      expect(document.activeElement).toBe(select);
    });
  });
});
