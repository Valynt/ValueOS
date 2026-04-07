/**
 * Unit tests for PptxExportService.
 *
 * Tests cover:
 * - Supabase client selection regression (existing)
 * - exportValueCase() - full deck generation with all slide types
 * - Storage upload and signed URL generation
 * - Progress callback invocation at each stage
 * - Missing data handling (no narrative, no financial model, no hypotheses)
 * - pptxgenjs not installed error
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://storage.example.com/signed-pptx" },
  error: null,
});

const mockServerClient = {
  storage: {
    from: () => ({
      upload: mockUpload,
      createSignedUrl: mockCreateSignedUrl,
    }),
  },
};

const mockNarrativeRepo = {
  getLatestForCase: vi.fn().mockResolvedValue(null),
};

const mockSnapshotRepo = {
  getLatestSnapshotForCase: vi.fn().mockResolvedValue(null),
};

const mockHypothesisService = {
  getLatestForCase: vi.fn().mockResolvedValue(null),
};

// Track which factory was called so the test can assert the correct one.
const createWorkerServiceSupabaseClientSpy = vi.fn().mockReturnValue(mockServerClient);
const createUserSupabaseClientSpy = vi.fn();

vi.mock("../../../lib/supabase/privileged/index.js", () => ({
  createWorkerServiceSupabaseClient: (...args: unknown[]) => createWorkerServiceSupabaseClientSpy(...args),
}));

vi.mock("../../../repositories/NarrativeDraftRepository.js", () => ({
  NarrativeDraftRepository: class {
    getLatestForCase = mockNarrativeRepo.getLatestForCase;
  },
}));

vi.mock("../../../repositories/FinancialModelSnapshotRepository.js", () => ({
  FinancialModelSnapshotRepository: class {
    getLatestSnapshotForCase = mockSnapshotRepo.getLatestSnapshotForCase;
  },
}));

vi.mock("../../value/HypothesisOutputService.js", () => ({
  HypothesisOutputService: class {
    getLatestForCase = mockHypothesisService.getLatestForCase;
  },
}));

// pptxgenjs dynamic import mock
vi.mock("pptxgenjs", () => ({
  default: class {
    ShapeType = { rect: "rect" };
    addSlide = () => ({
      addShape: vi.fn(),
      addText: vi.fn(),
      addImage: vi.fn(),
      addTable: vi.fn(),
    });
    write = vi.fn().mockResolvedValue(Buffer.from("pptx-buffer-content"));
  },
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PptxExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.com/signed-pptx" },
      error: null,
    });
    mockNarrativeRepo.getLatestForCase.mockResolvedValue(null);
    mockSnapshotRepo.getLatestSnapshotForCase.mockResolvedValue(null);
    mockHypothesisService.getLatestForCase.mockResolvedValue(null);
  });

  // ---------------------------------------------------------------------------
  // Existing tests - Supabase client selection
  // ---------------------------------------------------------------------------

  describe("Supabase client selection", () => {
    it("uses createWorkerServiceSupabaseClient, not createUserSupabaseClient", async () => {
      const { PptxExportService } = await import("../PptxExportService.js");
      new PptxExportService();

      expect(createWorkerServiceSupabaseClientSpy).toHaveBeenCalledOnce();
      expect(createWorkerServiceSupabaseClientSpy).toHaveBeenCalledWith({
        justification: "service-role:justified PptxExportService reads case data and uploads exports",
      });
      expect(createUserSupabaseClientSpy).not.toHaveBeenCalled();
    });

    it("does not pass undefined as a token to any Supabase factory", async () => {
      const { PptxExportService } = await import("../PptxExportService.js");
      new PptxExportService();

      const calls = createWorkerServiceSupabaseClientSpy.mock.calls;
      for (const args of calls) {
        expect(args[0]).not.toBe(undefined);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // exportValueCase()
  // ---------------------------------------------------------------------------

  describe("exportValueCase", () => {
    it("uploads PPTX to storage and returns signed URL", async () => {
      const { PptxExportService } = await import("../PptxExportService.js");
      const service = new PptxExportService();

      const result = await service.exportValueCase({
        organizationId: "org-1",
        caseId: "case-1",
        title: "Test Deck",
        ownerName: "Test Owner",
      });

      expect(result).toMatchObject({
        signedUrl: "https://storage.example.com/signed-pptx",
        storagePath: expect.stringContaining("org-1/value-cases/case-1/"),
        sizeBytes: expect.any(Number),
        createdAt: expect.any(String),
      });
      expect(result.storagePath).toMatch(/\.pptx$/);
    });

    it("throws when storage upload fails", async () => {
      mockUpload.mockResolvedValue({ error: { message: "Bucket not found" } });

      const { PptxExportService } = await import("../PptxExportService.js");
      const service = new PptxExportService();

      await expect(
        service.exportValueCase({
          organizationId: "org-1",
          caseId: "case-1",
          title: "Test Deck",
        })
      ).rejects.toThrow("Storage upload failed: Bucket not found");
    });

    it("throws when signed URL generation fails", async () => {
      mockUpload.mockResolvedValue({ error: null });
      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: "Permission denied" },
      });

      const { PptxExportService } = await import("../PptxExportService.js");
      const service = new PptxExportService();

      await expect(
        service.exportValueCase({
          organizationId: "org-1",
          caseId: "case-1",
          title: "Test Deck",
        })
      ).rejects.toThrow("Failed to create signed URL: unknown");
    });

    it("invokes progress callback during export", async () => {
      const progressCallback = vi.fn().mockResolvedValue(undefined);

      const { PptxExportService } = await import("../PptxExportService.js");
      const service = new PptxExportService(progressCallback);

      await service.exportValueCase({
        organizationId: "org-1",
        caseId: "case-1",
        title: "Test Deck",
      });

      // Should have been called with fetch, build, upload, and finalize steps
      expect(progressCallback).toHaveBeenCalledWith("fetch", 50, "Loading case data...");
      expect(progressCallback).toHaveBeenCalledWith("fetch", 100, "Data loaded");
      expect(progressCallback).toHaveBeenCalledWith("build", 25, "Building presentation...");
      expect(progressCallback).toHaveBeenCalledWith("upload", 50, "Uploading to storage...");
      expect(progressCallback).toHaveBeenCalledWith("upload", 100, "Upload complete");
      expect(progressCallback).toHaveBeenCalledWith("finalize", 50, "Creating download link...");
      expect(progressCallback).toHaveBeenCalledWith("finalize", 100, "Export complete");
    });

    it("generates correct storage path with organization and case IDs", async () => {
      const { PptxExportService } = await import("../PptxExportService.js");
      const service = new PptxExportService();

      const result = await service.exportValueCase({
        organizationId: "my-org",
        caseId: "my-case",
        title: "Test Deck",
      });

      expect(result.storagePath).toContain("my-org");
      expect(result.storagePath).toContain("my-case");
      expect(result.storagePath).toMatch(/\.pptx$/);
    });

    it("handles missing narrative, financial model, and hypotheses gracefully", async () => {
      // All repos return null (already set in beforeEach)
      const { PptxExportService } = await import("../PptxExportService.js");
      const service = new PptxExportService();

      // Should not throw - missing data is handled gracefully
      const result = await service.exportValueCase({
        organizationId: "org-1",
        caseId: "case-1",
        title: "Test Deck",
      });

      expect(result.signedUrl).toBe("https://storage.example.com/signed-pptx");
    });

    it("fetches data from all repositories in parallel", async () => {
      mockNarrativeRepo.getLatestForCase.mockResolvedValue({ content: "Executive summary content" });
      mockSnapshotRepo.getLatestSnapshotForCase.mockResolvedValue({
        roi: 0.25,
        npv: 5000000,
        payback_period_months: 12,
      });
      mockHypothesisService.getLatestForCase.mockResolvedValue({
        hypotheses: [
          { title: "Hypothesis 1", category: "Revenue", estimated_impact: { value: 100000 }, confidence: 0.8 },
        ],
      });

      const { PptxExportService } = await import("../PptxExportService.js");
      const service = new PptxExportService();

      await service.exportValueCase({
        organizationId: "org-1",
        caseId: "case-1",
        title: "Test Deck",
      });

      expect(mockNarrativeRepo.getLatestForCase).toHaveBeenCalledWith("case-1", "org-1");
      expect(mockSnapshotRepo.getLatestSnapshotForCase).toHaveBeenCalledWith("case-1", "org-1");
      expect(mockHypothesisService.getLatestForCase).toHaveBeenCalledWith("case-1", "org-1");
    });

    it("throws when pptxgenjs is not installed", async () => {
      vi.doMock("pptxgenjs", () => {
        throw new Error("Module not found");
      });

      const { PptxExportService } = await import("../PptxExportService.js");
      const service = new PptxExportService();

      await expect(
        service.exportValueCase({
          organizationId: "org-1",
          caseId: "case-1",
          title: "Test Deck",
        })
      ).rejects.toThrow("pptxgenjs is not installed");
    });
  });
});
