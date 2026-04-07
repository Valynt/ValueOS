/**
 * ExportHistoryPanel — Component Tests
 *
 * Tests cover:
 * - Loading state (skeleton/shimmer UI)
 * - Empty state ("No exports yet" message)
 * - Export list rendering (format icons, dates, sizes, quality badges)
 * - Download button behavior
 * - Refresh button behavior
 * - Quality badge color coding
 * - Error handling
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExportHistoryPanel } from "../ExportHistoryPanel";
import type { ExportHistoryItem } from "@/hooks/useExportJobs";

// ---------------------------------------------------------------------------
// Mock the hooks
// ---------------------------------------------------------------------------

const mockUseExportHistory = vi.fn();
const mockUseRefreshExportUrl = vi.fn();
const mockMutate = vi.fn();

vi.mock("@/hooks/useExportJobs", () => ({
  useExportHistory: (...args: unknown[]) => mockUseExportHistory(...args),
  useRefreshExportUrl: (...args: unknown[]) => mockUseRefreshExportUrl(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeExportItem = (overrides: Partial<ExportHistoryItem> = {}): ExportHistoryItem => ({
  id: "job-1",
  format: "pptx",
  exportType: "full",
  title: "Business Case Export",
  status: "completed",
  fileSizeBytes: 1234567,
  signedUrl: "https://signed.url/download",
  signedUrlExpiresAt: "2024-01-02T00:00:00.000Z",
  integrityScoreAtExport: 0.85,
  readinessScoreAtExport: 0.92,
  createdAt: "2024-01-01T00:00:00.000Z",
  completedAt: "2024-01-01T00:00:10.000Z",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExportHistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRefreshExportUrl.mockReturnValue({
      mutateAsync: mockMutate,
      isPending: false,
    });
  });

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  describe("Loading State", () => {
    it("renders skeleton UI while loading", () => {
      mockUseExportHistory.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      // Should show skeleton elements
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------

  describe("Error State", () => {
    it("displays error message when fetch fails", () => {
      mockUseExportHistory.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Failed to load"),
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      expect(screen.getByText(/Failed to load export history/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty State
  // ---------------------------------------------------------------------------

  describe("Empty State", () => {
    it("displays 'No exports yet' when empty", () => {
      mockUseExportHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      expect(screen.getByText(/No exports yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Generate your first export/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Export List Rendering
  // ---------------------------------------------------------------------------

  describe("Export List", () => {
    it("renders export items with correct data", () => {
      mockUseExportHistory.mockReturnValue({
        data: [
          makeExportItem({
            id: "job-1",
            format: "pptx",
            title: "Business Case",
            fileSizeBytes: 1234567,
          }),
          makeExportItem({
            id: "job-2",
            format: "pdf",
            title: "Executive Summary",
            fileSizeBytes: 987654,
          }),
        ],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      // Header shows count
      expect(screen.getByText(/2 exports available/i)).toBeInTheDocument();

      // Table headers
      expect(screen.getByText(/Format/i)).toBeInTheDocument();
      expect(screen.getByText(/Date/i)).toBeInTheDocument();
      expect(screen.getByText(/Size/i)).toBeInTheDocument();
      expect(screen.getByText(/Quality/i)).toBeInTheDocument();
      expect(screen.getByText(/Actions/i)).toBeInTheDocument();

      // Export items rendered
      expect(screen.getByText(/Business Case/i)).toBeInTheDocument();
      expect(screen.getByText(/Executive Summary/i)).toBeInTheDocument();
    });

    it("displays correct format labels", () => {
      mockUseExportHistory.mockReturnValue({
        data: [
          makeExportItem({ id: "1", format: "pptx", title: "PPTX Export" }),
          makeExportItem({ id: "2", format: "pdf", title: "PDF Export" }),
        ],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      // Format labels shown
      expect(screen.getByText("PDF")).toBeInTheDocument();
    });

    it("displays correct export type labels", () => {
      mockUseExportHistory.mockReturnValue({
        data: [
          makeExportItem({ id: "1", exportType: "full", title: "Full" }),
          makeExportItem({ id: "2", exportType: "executive_summary", title: "Exec" }),
          makeExportItem({ id: "3", exportType: "financials_only", title: "Fin" }),
          makeExportItem({ id: "4", exportType: "hypotheses_only", title: "Hyp" }),
        ],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      expect(screen.getByText(/Full Proposal/i)).toBeInTheDocument();
      expect(screen.getByText(/Executive Summary Only/i)).toBeInTheDocument();
      expect(screen.getByText(/Financials Only/i)).toBeInTheDocument();
      expect(screen.getByText(/Hypotheses Only/i)).toBeInTheDocument();
    });

    it("formats file sizes correctly", () => {
      mockUseExportHistory.mockReturnValue({
        data: [
          makeExportItem({ id: "1", fileSizeBytes: 1234567, title: "Large" }),
          makeExportItem({ id: "2", fileSizeBytes: 1024, title: "Small" }),
          makeExportItem({ id: "3", fileSizeBytes: 0, title: "Empty" }),
        ],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      expect(screen.getByText(/1.18 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/1 KB/i)).toBeInTheDocument();
      expect(screen.getByText(/0 Bytes/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Quality Badges
  // ---------------------------------------------------------------------------

  describe("Quality Badges", () => {
    it("renders 'Good' badge for high integrity score", () => {
      mockUseExportHistory.mockReturnValue({
        data: [makeExportItem({ id: "1", integrityScoreAtExport: 0.85 })],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      const badge = screen.getByText(/Good \(85%\)/i);
      expect(badge).toBeInTheDocument();
    });

    it("renders 'Fair' badge for medium integrity score", () => {
      mockUseExportHistory.mockReturnValue({
        data: [makeExportItem({ id: "1", integrityScoreAtExport: 0.75 })],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      const badge = screen.getByText(/Fair \(75%\)/i);
      expect(badge).toBeInTheDocument();
    });

    it("renders 'Low' badge for poor integrity score", () => {
      mockUseExportHistory.mockReturnValue({
        data: [makeExportItem({ id: "1", integrityScoreAtExport: 0.55 })],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      const badge = screen.getByText(/Low \(55%\)/i);
      expect(badge).toBeInTheDocument();
    });

    it("handles null integrity score gracefully", () => {
      mockUseExportHistory.mockReturnValue({
        data: [makeExportItem({ id: "1", integrityScoreAtExport: null })],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      // Should not crash, badge not shown
      expect(screen.getByText(/Download/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Download Button
  // ---------------------------------------------------------------------------

  describe("Download Button", () => {
    it("opens signed URL in new tab when clicked", async () => {
      const user = userEvent.setup();
      const mockOpen = vi.fn();
      window.open = mockOpen;

      mockUseExportHistory.mockReturnValue({
        data: [makeExportItem({ id: "1", signedUrl: "https://download.url/file.pptx" })],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      const downloadButton = screen.getByRole("button", { name: /Download/i });
      await user.click(downloadButton);

      expect(mockOpen).toHaveBeenCalledWith(
        "https://download.url/file.pptx",
        "_blank",
        "noopener,noreferrer"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Refresh Button
  // ---------------------------------------------------------------------------

  describe("Refresh Button", () => {
    it("shows refresh button for expired URLs", () => {
      mockUseExportHistory.mockReturnValue({
        data: [
          makeExportItem({
            id: "1",
            signedUrl: null,
            signedUrlExpiresAt: "2024-01-01T00:00:00.000Z", // Expired
          }),
        ],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      expect(screen.getByRole("button", { name: /Refresh Link/i })).toBeInTheDocument();
    });

    it("shows 'Expiring soon' warning for URLs about to expire", () => {
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      mockUseExportHistory.mockReturnValue({
        data: [
          makeExportItem({
            id: "1",
            signedUrl: "https://valid.url",
            signedUrlExpiresAt: fiveMinutesFromNow,
          }),
        ],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      expect(screen.getByText(/Expiring soon/i)).toBeInTheDocument();
    });

    it("calls refresh mutation when refresh button clicked", async () => {
      const user = userEvent.setup();
      mockMutate.mockResolvedValue({ signedUrl: "https://new.url" });
      window.open = vi.fn();

      mockUseExportHistory.mockReturnValue({
        data: [
          makeExportItem({
            id: "job-1",
            signedUrl: null,
            signedUrlExpiresAt: "2024-01-01T00:00:00.000Z",
          }),
        ],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      const refreshButton = screen.getByRole("button", { name: /Refresh Link/i });
      await user.click(refreshButton);

      expect(mockMutate).toHaveBeenCalledWith({ jobId: "job-1" });
    });

    it("disables refresh button while refreshing", async () => {
      mockUseRefreshExportUrl.mockReturnValue({
        mutateAsync: mockMutate,
        isPending: true,
      });

      mockUseExportHistory.mockReturnValue({
        data: [
          makeExportItem({
            id: "job-1",
            signedUrl: null,
            signedUrlExpiresAt: "2024-01-01T00:00:00.000Z",
          }),
        ],
        isLoading: false,
        error: null,
      });

      render(<ExportHistoryPanel caseId="case-1" />);

      const refreshButton = screen.getByRole("button", { name: /Refreshing\.\.\./i });
      expect(refreshButton).toBeDisabled();
    });
  });
});
