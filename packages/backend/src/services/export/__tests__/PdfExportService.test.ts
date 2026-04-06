/**
 * Unit tests for PdfExportService.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://storage.example.com/signed.pdf" },
  error: null,
});

const mockServerClient = {
  storage: {
    from: vi.fn(() => ({
      upload: mockUpload,
      createSignedUrl: mockCreateSignedUrl,
    })),
  },
};

const createServerSupabaseClientSpy = vi.fn().mockReturnValue(mockServerClient);
const createUserSupabaseClientSpy = vi.fn();

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClientSpy(...args),
  createUserSupabaseClient: (...args: unknown[]) => createUserSupabaseClientSpy(...args),
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock("@shared/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withContext: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockClose = vi.fn();
const mockSetCookie = vi.fn();
const mockGoto = vi.fn();
const mockWaitForSelector = vi.fn().mockResolvedValue(true);
const mockPdf = vi.fn().mockResolvedValue(Buffer.from("mock-pdf-content"));

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue({
    setCookie: mockSetCookie,
    goto: mockGoto,
    waitForSelector: mockWaitForSelector,
    pdf: mockPdf,
  }),
  close: mockClose,
};

// Mock puppeteer
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PdfExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("uses createServerSupabaseClient, not createUserSupabaseClient", async () => {
      const { PdfExportService } = await import("../PdfExportService.js");
      new PdfExportService();

      expect(createServerSupabaseClientSpy).toHaveBeenCalledOnce();
      expect(createUserSupabaseClientSpy).not.toHaveBeenCalled();
    });
  });

  describe("exportValueCase", () => {
    it("generates and uploads a PDF successfully", async () => {
      const { PdfExportService } = await import("../PdfExportService.js");
      const service = new PdfExportService();

      const input = {
        organizationId: "org-1",
        caseId: "case-1",
        renderUrl: "https://example.com/render",
        authToken: "mock-token",
        title: "Test PDF",
      };

      const result = await service.exportValueCase(input);

      // Verify result
      expect(result.signedUrl).toBe("https://storage.example.com/signed.pdf");
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.storagePath).toContain("org-1/value-cases/case-1/");
      expect(result.storagePath).toContain(".pdf");
      expect(result.createdAt).toBeDefined();

      // Verify puppeteer actions
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockSetCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "sb-access-token",
          value: "mock-token",
        })
      );
      expect(mockGoto).toHaveBeenCalledWith(
        "https://example.com/render",
        expect.any(Object)
      );
      expect(mockPdf).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();

      // Verify supabase actions
      expect(mockServerClient.storage.from).toHaveBeenCalledWith("exports");
      expect(mockUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        expect.objectContaining({ contentType: "application/pdf" })
      );
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        expect.any(String),
        60 * 60
      );
    });

    it("handles Supabase upload failure", async () => {
      const { PdfExportService } = await import("../PdfExportService.js");
      const service = new PdfExportService();

      mockUpload.mockResolvedValueOnce({
        error: { message: "Upload permission denied" },
      });

      const input = {
        organizationId: "org-1",
        caseId: "case-1",
        renderUrl: "https://example.com/render",
      };

      await expect(service.exportValueCase(input)).rejects.toThrow(
        "PDF upload failed: Upload permission denied"
      );
    });

    it("handles Supabase createSignedUrl failure", async () => {
      const { PdfExportService } = await import("../PdfExportService.js");
      const service = new PdfExportService();

      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: "URL generation failed" },
      });

      const input = {
        organizationId: "org-1",
        caseId: "case-1",
        renderUrl: "https://example.com/render",
      };

      await expect(service.exportValueCase(input)).rejects.toThrow(
        "Failed to create signed URL: URL generation failed"
      );
    });
  });
});
