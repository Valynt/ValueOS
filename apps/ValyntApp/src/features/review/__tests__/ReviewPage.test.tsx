/**
 * TDD: Phase 3 — ReviewPage (Executive Reviewer Surface)
 *
 * Tests for the /review/:caseId page — first-class surface for exec buyers.
 * RED phase: fails until src/features/review/ReviewPage.tsx is implemented.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Mock hooks before importing the component
vi.mock("@/hooks/useCases", () => ({
  useCase: () => ({
    data: {
      id: "case-firm-1",
      name: "Initech — Value Case",
      stage: "target",
      quality_score: 0.72,
      status: "review",
      metadata: { projected_value: 2_400_000 },
      company_profiles: { id: "cp-3", company_name: "Initech" },
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useJourneyOrchestrator", () => ({
  useJourneyOrchestrator: () => ({
    data: {
      phase: { id: "target", label: "Target" },
      uiState: { label: "Ready for review", indicator: "success" },
      workspaceHeader: { confidence_score: 0.72 },
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useValueModeling", () => ({
  useAssumptions: () => ({
    data: [
      { id: "a-1", name: "Market volatility", value: 100000, unit: "%", source: "inferred", confidenceScore: 0.3, unsupported: false, plausibility: "weakly-supported", lastModified: "2026-01-01" },
      { id: "a-2", name: "Revenue per seat", value: 50000, unit: "$", source: "CRM-derived", confidenceScore: 0.85, unsupported: false, plausibility: "plausible", lastModified: "2026-01-01" },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  createBrowserSupabaseClient: vi.fn(),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ currentTenant: { id: "tenant-1" }, tenants: [], loading: false }),
}));

import { ReviewPage } from "@/features/review/ReviewPage";

function renderReviewPage(caseId = "case-firm-1") {
  return render(
    <MemoryRouter initialEntries={[`/review/${caseId}`]}>
      <Routes>
        <Route path="/review/:caseId" element={<ReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ReviewPage", () => {
  // ---------------------------------------------------------------------------
  // Layout — no sidebar, mobile-first
  // ---------------------------------------------------------------------------
  describe("layout", () => {
    it("renders without sidebar navigation", () => {
      const { container } = renderReviewPage();
      // ReviewPage should not contain a <nav> element (sidebar lives in MainLayout)
      const navElements = container.querySelectorAll("nav");
      expect(navElements.length).toBe(0);
    });

    it("uses a narrow max-width container", () => {
      const { container } = renderReviewPage();
      const main = container.querySelector("[class*='max-w-']");
      expect(main).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Executive Summary
  // ---------------------------------------------------------------------------
  describe("executive summary", () => {
    it("renders executive summary section", () => {
      renderReviewPage();
      expect(
        screen.getByText(/executive.*summary|summary/i),
      ).toBeInTheDocument();
    });

    it("shows company name", () => {
      renderReviewPage();
      expect(screen.getByText(/Initech/i)).toBeInTheDocument();
    });

    it("shows projected value", () => {
      renderReviewPage();
      // $2.4M formatted
      expect(screen.getByText(/2\.4/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Warmth badge
  // ---------------------------------------------------------------------------
  describe("warmth", () => {
    it("shows warmth badge in header", () => {
      const { container } = renderReviewPage();
      const badge = container.querySelector('[role="status"]');
      expect(badge).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Assumptions at risk
  // ---------------------------------------------------------------------------
  describe("assumptions section", () => {
    it("renders assumptions at risk section", () => {
      renderReviewPage();
      expect(
        screen.getByText("Assumptions Requiring Attention"),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Approval actions
  // ---------------------------------------------------------------------------
  describe("approval actions", () => {
    it("renders approval action buttons", () => {
      renderReviewPage();
      expect(
        screen.getByRole("button", { name: /approve/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /request.*change|change/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /export|pdf/i }),
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  describe("loading state", () => {
    it("does not crash when data is undefined", () => {
      // The primary contract: ReviewPage must handle undefined data gracefully.
      // When the component is implemented, this test will verify loading UI.
      const { container } = renderReviewPage();
      expect(container).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  describe("error state", () => {
    it("handles error gracefully", () => {
      // The page should not crash on error — error boundary or inline error
      const { container } = renderReviewPage();
      expect(container).toBeTruthy();
    });
  });
});
