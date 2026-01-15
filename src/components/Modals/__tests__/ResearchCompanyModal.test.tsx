/**
 * Research Company Modal Tests
 *
 * Tests for the Research Company modal component.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { ResearchCompanyModal } from "../ResearchCompanyModal";

describe("ResearchCompanyModal", () => {
  const mockOnClose = vi.fn();
  const mockOnResearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders when open", () => {
      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      expect(screen.getByText(/Research Company/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Enter a domain to gather intelligence/i)
      ).toBeInTheDocument();
    });

    it("does not render when closed", () => {
      render(
        <ResearchCompanyModal
          isOpen={false}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      expect(screen.queryByText(/Research Company/i)).not.toBeInTheDocument();
    });

    it("renders domain input field", () => {
      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const input = screen.getByPlaceholderText(/e.g. acmecorp.com/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "text");
    });

    it("renders what we'll gather section", () => {
      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      expect(screen.getByText(/What we'll gather:/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Recent news & press releases/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Financial reports \(10-K, 10-Q\)/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Key executive profiles/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Market positioning analysis/i)
      ).toBeInTheDocument();
    });

    it("renders action buttons", () => {
      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      expect(
        screen.getByRole("button", { name: /Cancel/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Start Research/i })
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("allows typing in domain input", async () => {
      const user = userEvent.setup();

      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const input = screen.getByPlaceholderText(/e.g. acmecorp.com/i);
      await user.type(input, "nike.com");

      expect(input).toHaveValue("nike.com");
    });

    it("submit button is disabled when domain is empty", () => {
      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const submitButton = screen.getByRole("button", {
        name: /Start Research/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("submit button is enabled when domain is provided", async () => {
      const user = userEvent.setup();

      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const input = screen.getByPlaceholderText(/e.g. acmecorp.com/i);
      await user.type(input, "nike.com");

      const submitButton = screen.getByRole("button", {
        name: /Start Research/i,
      });
      expect(submitButton).not.toBeDisabled();
    });

    it("calls onClose when cancel button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when X button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const xButton = screen.getByRole("button", { name: /close modal/i });
      await user.click(xButton);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Form Submission", () => {
    it("shows loading state when submitting", async () => {
      const user = userEvent.setup();

      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const input = screen.getByPlaceholderText(/e.g. acmecorp.com/i);
      await user.type(input, "nike.com");

      const submitButton = screen.getByRole("button", {
        name: /Start Research/i,
      });
      await user.click(submitButton);

      // Should show loading state briefly
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it("calls onResearch with domain after loading", async () => {
      const user = userEvent.setup();

      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const input = screen.getByPlaceholderText(/e.g. acmecorp.com/i);
      await user.type(input, "nike.com");

      const submitButton = screen.getByRole("button", {
        name: /Start Research/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnResearch).toHaveBeenCalledWith("nike.com");
      });
    });

    it("calls onClose after successful submission", async () => {
      const user = userEvent.setup();

      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const input = screen.getByPlaceholderText(/e.g. acmecorp.com/i);
      await user.type(input, "nike.com");

      const submitButton = screen.getByRole("button", {
        name: /Start Research/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("handles form submission via Enter key", async () => {
      const user = userEvent.setup();

      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const input = screen.getByPlaceholderText(/e.g. acmecorp.com/i);
      await user.type(input, "nike.com{Enter}");

      await waitFor(() => {
        expect(mockOnResearch).toHaveBeenCalledWith("nike.com");
      });
    });
  });

  describe("Keyboard Interactions", () => {
    it("closes modal when Escape key is pressed", () => {
      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("autofocuses domain input when modal opens", () => {
      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const input = screen.getByPlaceholderText(/e.g. acmecorp.com/i);
      expect(input).toHaveFocus();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      const { container } = render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      const modal = container.querySelector('[role="dialog"]');
      expect(modal).toBeInTheDocument();
    });

    it("has accessible label for domain input", () => {
      render(
        <ResearchCompanyModal
          isOpen={true}
          onClose={mockOnClose}
          onResearch={mockOnResearch}
        />
      );

      expect(screen.getByLabelText(/Company Domain/i)).toBeInTheDocument();
    });
  });
});
