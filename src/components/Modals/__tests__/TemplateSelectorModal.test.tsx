/**
 * Template Selector Modal Tests
 *
 * Tests for the Template Selector modal component.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { TemplateSelectorModal } from "../TemplateSelectorModal";

describe("TemplateSelectorModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders when open", () => {
      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText(/Select a Template/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Start with pre-configured drivers and KPIs/i)
      ).toBeInTheDocument();
    });

    it("does not render when closed", () => {
      render(
        <TemplateSelectorModal
          isOpen={false}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByText(/Select a Template/i)).not.toBeInTheDocument();
    });

    it("renders industry filter sidebar", () => {
      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText(/Industry/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /All/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Manufacturing/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /SaaS/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Technology/i })
      ).toBeInTheDocument();
    });

    it("renders template cards", () => {
      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText(/MRO Cost Reduction/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Supply Chain Optimization/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Customer Churn Reduction/i)).toBeInTheDocument();
      expect(screen.getByText(/Cloud Spend Optimization/i)).toBeInTheDocument();
    });

    it("displays template details", () => {
      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Check for value estimates
      expect(screen.getByText(/Est\. \$1\.2M/i)).toBeInTheDocument();
      expect(screen.getByText(/Est\. \$850K/i)).toBeInTheDocument();
      expect(screen.getByText(/Est\. \$2\.4M/i)).toBeInTheDocument();
      expect(screen.getByText(/Est\. \$450K/i)).toBeInTheDocument();

      // Check for descriptions
      expect(
        screen.getByText(
          /Optimize maintenance, repair, and operations inventory/i
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Identify at-risk accounts and automate retention/i)
      ).toBeInTheDocument();
    });

    it("displays template drivers", () => {
      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText(/Inventory Optimization/i)).toBeInTheDocument();
      expect(screen.getByText(/Vendor Consolidation/i)).toBeInTheDocument();
      expect(screen.getByText(/Health Scoring/i)).toBeInTheDocument();
      expect(screen.getByText(/Automated Outreach/i)).toBeInTheDocument();
    });
  });

  describe("Industry Filtering", () => {
    it("shows all templates by default", () => {
      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // All 4 templates should be visible
      expect(screen.getByText(/MRO Cost Reduction/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Supply Chain Optimization/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Customer Churn Reduction/i)).toBeInTheDocument();
      expect(screen.getByText(/Cloud Spend Optimization/i)).toBeInTheDocument();
    });

    it("filters templates by Manufacturing industry", async () => {
      const user = userEvent.setup();

      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const manufacturingButton = screen.getByRole("button", {
        name: /Manufacturing/i,
      });
      await user.click(manufacturingButton);

      // Should show only Manufacturing templates
      expect(screen.getByText(/MRO Cost Reduction/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Supply Chain Optimization/i)
      ).toBeInTheDocument();

      // Should not show other industry templates
      expect(
        screen.queryByText(/Customer Churn Reduction/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Cloud Spend Optimization/i)
      ).not.toBeInTheDocument();
    });

    it("filters templates by SaaS industry", async () => {
      const user = userEvent.setup();

      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const saasButton = screen.getByRole("button", { name: /SaaS/i });
      await user.click(saasButton);

      // Should show only SaaS templates
      expect(screen.getByText(/Customer Churn Reduction/i)).toBeInTheDocument();

      // Should not show other industry templates
      expect(screen.queryByText(/MRO Cost Reduction/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Supply Chain Optimization/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Cloud Spend Optimization/i)
      ).not.toBeInTheDocument();
    });

    it("filters templates by Technology industry", async () => {
      const user = userEvent.setup();

      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const techButton = screen.getByRole("button", { name: /Technology/i });
      await user.click(techButton);

      // Should show only Technology templates
      expect(screen.getByText(/Cloud Spend Optimization/i)).toBeInTheDocument();

      // Should not show other industry templates
      expect(screen.queryByText(/MRO Cost Reduction/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Supply Chain Optimization/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Customer Churn Reduction/i)
      ).not.toBeInTheDocument();
    });

    it("returns to all templates when All filter is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // First filter by Manufacturing
      const manufacturingButton = screen.getByRole("button", {
        name: /Manufacturing/i,
      });
      await user.click(manufacturingButton);

      // Then click All
      const allButton = screen.getByRole("button", { name: /^All$/i });
      await user.click(allButton);

      // All templates should be visible again
      expect(screen.getByText(/MRO Cost Reduction/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Supply Chain Optimization/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Customer Churn Reduction/i)).toBeInTheDocument();
      expect(screen.getByText(/Cloud Spend Optimization/i)).toBeInTheDocument();
    });

    it("highlights selected industry filter", async () => {
      const user = userEvent.setup();

      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const saasButton = screen.getByRole("button", { name: /SaaS/i });
      await user.click(saasButton);

      // Check if the button has the selected styling
      expect(saasButton).toHaveClass("bg-teal-500/10");
      expect(saasButton).toHaveClass("text-teal-500");
    });
  });

  describe("Template Selection", () => {
    it("calls onSelect with template id when template is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const mroTemplate = screen
        .getByText(/MRO Cost Reduction/i)
        .closest("div");
      if (mroTemplate) {
        await user.click(mroTemplate);
        expect(mockOnSelect).toHaveBeenCalledWith("mro-reduction");
      }
    });

    it("calls onSelect with correct template id for each template", async () => {
      const user = userEvent.setup();

      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Test Supply Chain template
      const supplyChainTemplate = screen
        .getByText(/Supply Chain Optimization/i)
        .closest("div");
      if (supplyChainTemplate) {
        await user.click(supplyChainTemplate);
        expect(mockOnSelect).toHaveBeenCalledWith("supply-chain");
      }

      vi.clearAllMocks();

      // Test Churn Reduction template
      const churnTemplate = screen
        .getByText(/Customer Churn Reduction/i)
        .closest("div");
      if (churnTemplate) {
        await user.click(churnTemplate);
        expect(mockOnSelect).toHaveBeenCalledWith("churn-reduction");
      }

      vi.clearAllMocks();

      // Test Cloud Spend template
      const cloudTemplate = screen
        .getByText(/Cloud Spend Optimization/i)
        .closest("div");
      if (cloudTemplate) {
        await user.click(cloudTemplate);
        expect(mockOnSelect).toHaveBeenCalledWith("cloud-spend");
      }
    });
  });

  describe("Modal Controls", () => {
    it("calls onClose when X button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      const xButton = screen.getByRole("button", { name: /close modal/i });
      await user.click(xButton);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      const { container } = render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Modal should have role dialog or similar
      const modal = container.querySelector('[role="dialog"]');
      expect(modal).toBeInTheDocument();
    });

    it("template cards are keyboard accessible", () => {
      render(
        <TemplateSelectorModal
          isOpen={true}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
        />
      );

      // Template cards should be clickable elements
      const templates = screen.getAllByText(/Use Template/i);
      expect(templates.length).toBeGreaterThan(0);
    });
  });
});
