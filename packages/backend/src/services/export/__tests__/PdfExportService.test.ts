import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://storage.example.com/signed-pdf" },
  error: null,
});

const mockServerClient = {
  storage: {
    from: vi.fn().mockReturnValue({
      upload: mockUpload,
      createSignedUrl: mockCreateSignedUrl,
    }),
  },
};

// Track which factory was called so the test can assert the correct one.
const createServerSupabaseClientSpy = vi.fn().mockReturnValue(mockServerClient);
const createUserSupabaseClientSpy = vi.fn();

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClientSpy(...args),
  createUserSupabaseClient: (...args: unknown[]) => createUserSupabaseClientSpy(...args),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PdfExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses createServerSupabaseClient, not createUserSupabaseClient", async () => {
    // Import after mocks are set up
    const { PdfExportService } = await import("../PdfExportService.js");
    new PdfExportService();

    expect(createServerSupabaseClientSpy).toHaveBeenCalledOnce();
    // Called with no arguments — service-role client requires none
    expect(createServerSupabaseClientSpy).toHaveBeenCalledWith();
    expect(createUserSupabaseClientSpy).not.toHaveBeenCalled();
  });

  it("does not pass undefined as a token to any Supabase factory", async () => {
    const { PdfExportService } = await import("../PdfExportService.js");
    new PdfExportService();

    const calls = createServerSupabaseClientSpy.mock.calls;
    for (const args of calls) {
      // service-role factory takes no args; first arg should be absent
      expect(args.length).toBe(0);
    }
  });

  it("getPdfExportService returns a singleton instance", async () => {
    const { getPdfExportService } = await import("../PdfExportService.js");
    const instance1 = getPdfExportService();
    const instance2 = getPdfExportService();

    expect(instance1).toBe(instance2);
  });

  describe("exportValueCase", () => {
    const input = {
      organizationId: "org-1",
      caseId: "case-1",
      renderUrl: "https://example.com/render",
      authToken: "token-123",
      title: "Test PDF",
    };

    it("throws error if puppeteer is not available", async () => {
      // Mock puppeteer import to fail
      vi.doMock("puppeteer", () => {
        throw new Error("Cannot find module 'puppeteer'");
      });
      const { PdfExportService } = await import("../PdfExportService.js");
      const service = new PdfExportService();

      await expect(service.exportValueCase(input)).rejects.toThrow(/Puppeteer is not installed/);
      vi.doUnmock("puppeteer");
    });

    it("successfully generates PDF and uploads it", async () => {
      const mockGoto = vi.fn().mockResolvedValue(null);
      const mockPdf = vi.fn().mockResolvedValue(Buffer.from("fake-pdf-content"));
      const mockSetCookie = vi.fn().mockResolvedValue(null);
      const mockClose = vi.fn().mockResolvedValue(null);
      const mockWaitForSelector = vi.fn().mockResolvedValue(null);
      const mockNewPage = vi.fn().mockResolvedValue({
        goto: mockGoto,
        pdf: mockPdf,
        setCookie: mockSetCookie,
        waitForSelector: mockWaitForSelector,
      });
      const mockLaunch = vi.fn().mockResolvedValue({
        newPage: mockNewPage,
        close: mockClose,
      });

      vi.doMock("puppeteer", () => ({
        default: {
          launch: mockLaunch,
        },
      }));

      const { PdfExportService } = await import("../PdfExportService.js");
      const service = new PdfExportService();

      const result = await service.exportValueCase(input);

      expect(mockLaunch).toHaveBeenCalled();
      expect(mockNewPage).toHaveBeenCalled();
      expect(mockSetCookie).toHaveBeenCalledWith({
        name: "sb-access-token",
        value: "token-123",
        domain: "example.com",
        path: "/",
        httpOnly: true,
        secure: true,
      });
      expect(mockGoto).toHaveBeenCalledWith("https://example.com/render", {
        waitUntil: "networkidle0",
        timeout: 30_000,
      });
      expect(mockPdf).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();

      expect(mockUpload).toHaveBeenCalled();
      expect(mockCreateSignedUrl).toHaveBeenCalled();

      expect(result.signedUrl).toBe("https://storage.example.com/signed-pdf");
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.storagePath).toMatch(/org-1\/value-cases\/case-1\/.*\.pdf/);

      vi.doUnmock("puppeteer");
    });

    it("throws error if upload fails", async () => {
      const mockGoto = vi.fn().mockResolvedValue(null);
      const mockPdf = vi.fn().mockResolvedValue(Buffer.from("fake-pdf-content"));
      const mockSetCookie = vi.fn().mockResolvedValue(null);
      const mockClose = vi.fn().mockResolvedValue(null);
      const mockWaitForSelector = vi.fn().mockResolvedValue(null);
      const mockNewPage = vi.fn().mockResolvedValue({
        goto: mockGoto,
        pdf: mockPdf,
        setCookie: mockSetCookie,
        waitForSelector: mockWaitForSelector,
      });
      const mockLaunch = vi.fn().mockResolvedValue({
        newPage: mockNewPage,
        close: mockClose,
      });

      vi.doMock("puppeteer", () => ({
        default: {
          launch: mockLaunch,
        },
      }));

      mockUpload.mockResolvedValueOnce({ error: new Error("Upload failed") });

      const { PdfExportService } = await import("../PdfExportService.js");
      const service = new PdfExportService();

      await expect(service.exportValueCase(input)).rejects.toThrow(/PDF upload failed: Upload failed/);

      vi.doUnmock("puppeteer");
    });

    it("throws error if signed URL creation fails", async () => {
      const mockGoto = vi.fn().mockResolvedValue(null);
      const mockPdf = vi.fn().mockResolvedValue(Buffer.from("fake-pdf-content"));
      const mockSetCookie = vi.fn().mockResolvedValue(null);
      const mockClose = vi.fn().mockResolvedValue(null);
      const mockWaitForSelector = vi.fn().mockResolvedValue(null);
      const mockNewPage = vi.fn().mockResolvedValue({
        goto: mockGoto,
        pdf: mockPdf,
        setCookie: mockSetCookie,
        waitForSelector: mockWaitForSelector,
      });
      const mockLaunch = vi.fn().mockResolvedValue({
        newPage: mockNewPage,
        close: mockClose,
      });

      vi.doMock("puppeteer", () => ({
        default: {
          launch: mockLaunch,
        },
      }));

      mockCreateSignedUrl.mockResolvedValueOnce({ error: new Error("Sign failed"), data: null });

      const { PdfExportService } = await import("../PdfExportService.js");
      const service = new PdfExportService();

      await expect(service.exportValueCase(input)).rejects.toThrow(/Failed to create signed URL: Sign failed/);

      vi.doUnmock("puppeteer");
    });
  });
});
