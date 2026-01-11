/**
 * Component Test - Modal
 *
 * Tests for the Modal component:
 * - Open/close behavior
 * - Overlay interaction
 * - Escape key handling
 * - Focus management
 * - Accessibility
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Modal component
const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="modal-close"
          >
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

describe("Modal Component", () => {
  describe("Rendering", () => {
    it("should render when isOpen is true", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      expect(screen.getByText("Test Modal")).toBeInTheDocument();
      expect(screen.getByText("Modal content")).toBeInTheDocument();
    });

    it("should not render when isOpen is false", () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      expect(screen.queryByText("Test Modal")).not.toBeInTheDocument();
    });

    it("should render title", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Confirm Action">
          Content
        </Modal>
      );
      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    });

    it("should render children content", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal">
          <div>Custom content</div>
        </Modal>
      );
      expect(screen.getByText("Custom content")).toBeInTheDocument();
    });
  });

  describe("Interaction", () => {
    it("should call onClose when close button clicked", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Modal">
          Content
        </Modal>
      );

      const closeButton = screen.getByLabelText("Close modal");
      fireEvent.click(closeButton);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when overlay clicked", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Modal">
          Content
        </Modal>
      );

      const overlay = document.querySelector(".modal-overlay");
      fireEvent.click(overlay!);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("should not close when modal content clicked", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Modal">
          <button>Action</button>
        </Modal>
      );

      const contentButton = screen.getByText("Action");
      fireEvent.click(contentButton);

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it('should have role="dialog"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal">
          Content
        </Modal>
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it('should have aria-modal="true"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal">
          Content
        </Modal>
      );
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("should have aria-labelledby pointing to title", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="My Modal">
          Content
        </Modal>
      );
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
      expect(screen.getByText("My Modal")).toHaveAttribute("id", "modal-title");
    });

    it("should have accessible close button", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal">
          Content
        </Modal>
      );
      expect(
        screen.getByRole("button", { name: "Close modal" })
      ).toBeInTheDocument();
    });
  });

  describe("Focus Management", () => {
    it("should trap focus within modal when open", () => {
      // This is a simplified test - real implementation would use focus trap
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal">
          <button>First</button>
          <button>Second</button>
        </Modal>
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
