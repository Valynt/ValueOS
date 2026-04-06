/**
 * Integration Tests for UI Template Workflows
 * Tests complete user journeys across multiple templates
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, vi } from "vitest";

import ImpactCascade from "../ImpactCascade";
import QuantumView from "../QuantumView";
import type { PersonaType } from "../QuantumView";
import ROICalculator from "../ROICalculator";
import ValueCanvas from "../ValueCanvas";

vi.mock("../../components/chat-canvas/ChatCanvasLayout", () => ({
  ChatCanvasLayout: ({
    initialAction,
  }: {
    initialAction?: { type: string; data: unknown } | null;
  }) => (
    <div data-testid="chat-canvas-layout" data-action={initialAction?.type ?? "none"}>
      {initialAction ? JSON.stringify(initialAction.data) : "No initial action"}
    </div>
  ),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

const mockOpenDrawer = vi.fn();

vi.mock("../../contexts/DrawerContext", () => ({
  useDrawer: () => ({
    openDrawer: mockOpenDrawer,
  }),
}));

describe("Template Integration Workflows", () => {
  describe("Financial Analysis Workflow", () => {
    it("should complete ROI analysis to Impact Cascade flow", async () => {
      mockOpenDrawer.mockClear();
      render(
        <MemoryRouter initialEntries={["/roi-calculator"]}>
          <Routes>
            <Route path="/roi-calculator" element={<ROICalculator />} />
            <Route path="/impact-cascade" element={<ImpactCascade />} />
          </Routes>
        </MemoryRouter>
      );

      // Step 1: ROI Calculator
      const roiCard = screen.getByText("Cost Inputs").closest("button");
      fireEvent.click(roiCard!);

      expect(mockOpenDrawer).toHaveBeenCalledWith("Cost Inputs", expect.anything());

      // Step 2: Navigate to Impact Cascade
      // In real app, this would be triggered by "Analyze Impact" button
      // For testing, we simulate navigation
      render(
        <MemoryRouter initialEntries={["/impact-cascade"]}>
          <Routes>
            <Route path="/impact-cascade" element={<ImpactCascade />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify Impact Cascade renders
      expect(screen.getByText("Phase 2: Value Architecture")).toBeInTheDocument();
      expect(screen.getByText("Total Impact")).toBeInTheDocument();
    });

    it.todo("should handle scenario selection workflow");
  });

  describe("Value Canvas Integration", () => {
    it("should render Value Canvas with proper layout", () => {
      render(<ValueCanvas />);

      expect(screen.getByTestId("chat-canvas-layout")).toBeInTheDocument();
      expect(screen.getByText("No initial action")).toBeInTheDocument();
    });
  });

  describe("Quantum View Integration", () => {
    it("should render Quantum View with persona analyses", () => {
      const mockAnalyses: {
        id: string;
        persona: PersonaType;
        title: string;
        summary: string;
        confidence: number;
        keyMetrics: { label: string; value: string; unit: string }[];
        recommendations: string[];
        risks: string[];
        consensus: boolean;
      }[] = [
        {
          id: "financial-1",
          persona: "financial" as PersonaType,
          title: "Financial Analysis",
          summary: "Strong ROI potential",
          confidence: 85,
          keyMetrics: [{ label: "NPV", value: "2.3M", unit: "USD" }],
          recommendations: ["Increase investment"],
          risks: ["Market volatility"],
          consensus: true,
        },
        {
          id: "technical-1",
          persona: "technical" as PersonaType,
          title: "Technical Assessment",
          summary: "Architecture supports scale",
          confidence: 78,
          keyMetrics: [{ label: "Capacity", value: "10000", unit: "users" }],
          recommendations: ["Upgrade infrastructure"],
          risks: ["Technical debt"],
          consensus: true,
        },
      ];

      render(<QuantumView analyses={mockAnalyses} showConsensus={true} />);

      // Step 1: View overview
      expect(screen.getByText("Quantum View")).toBeInTheDocument();
      expect(screen.getByText("Total Personas")).toBeInTheDocument();
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);

      const financialCard = screen.getByTestId("persona-card-financial");
      fireEvent.click(financialCard);

      // Step 3: View details
      expect(screen.getByText("Financial Analysis")).toBeInTheDocument();
      expect(screen.getByText("Strong ROI potential")).toBeInTheDocument();

      // Step 4: View consensus
      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      expect(screen.getByText("Consensus View")).toBeInTheDocument();
    });
  });
});
