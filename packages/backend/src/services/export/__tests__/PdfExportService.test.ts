/**
 * Unit tests for PdfExportService.
 *
 * Tests cover:
 * - Singleton pattern (existing)
 * - exportValueCase() - successful PDF generation and upload
 * - exportValueCase() - storage upload failure handling
 * - exportValueCase() - signed URL generation with expiry
 * - Progress callback invocation during export
 * - Puppeteer fallback - error when not installed
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: 'https://storage.example.com/signed-pdf' },
  error: null,
});

const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  createSignedUrl: mockCreateSignedUrl,
}));

vi.mock('../../../lib/supabase.js', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    storage: {
      from: mockStorageFrom,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
  assertNotTestEnv: vi.fn(),
  createUserSupabaseClient: vi.fn(),
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

vi.mock('@shared/lib/logger', () => ({
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

describe('getPdfExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should return an instance of PdfExportService', async () => {
    const { getPdfExportService, PdfExportService } = await import('../PdfExportService');
    const service = getPdfExportService();
    expect(service).toBeInstanceOf(PdfExportService);
  });

  it('should return the same instance on subsequent calls (singleton)', async () => {
    const { getPdfExportService } = await import('../PdfExportService');
    const instance1 = getPdfExportService();
    const instance2 = getPdfExportService();

    expect(instance1).toBe(instance2);
  });
});

describe('PdfExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/signed-pdf' },
      error: null,
    });
  });

  describe('exportValueCase', () => {
    it('uploads PDF to storage and returns signed URL', async () => {
      // Mock puppeteer to return a PDF buffer
      vi.doMock('puppeteer', () => ({
        default: {
          launch: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              setCookie: vi.fn(),
              goto: vi.fn().mockResolvedValue(undefined),
              waitForSelector: vi.fn().mockResolvedValue(undefined),
              pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
            }),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        },
      }));

      const { PdfExportService } = await import('../PdfExportService');
      const service = new PdfExportService();

      const result = await service.exportValueCase({
        organizationId: 'org-1',
        caseId: 'case-1',
        renderUrl: 'https://example.com/export/case-1',
        title: 'Test Export',
      });

      expect(result).toMatchObject({
        signedUrl: 'https://storage.example.com/signed-pdf',
        storagePath: expect.stringContaining('org-1/value-cases/case-1/'),
        sizeBytes: expect.any(Number),
        createdAt: expect.any(String),
      });
      expect(result.storagePath).toMatch(/\.pdf$/);
    });

    it('throws when storage upload fails', async () => {
      mockUpload.mockResolvedValue({ error: { message: 'Bucket not found' } });

      vi.doMock('puppeteer', () => ({
        default: {
          launch: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              setCookie: vi.fn(),
              goto: vi.fn().mockResolvedValue(undefined),
              waitForSelector: vi.fn().mockResolvedValue(undefined),
              pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
            }),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        },
      }));

      const { PdfExportService } = await import('../PdfExportService');
      const service = new PdfExportService();

      await expect(
        service.exportValueCase({
          organizationId: 'org-1',
          caseId: 'case-1',
          renderUrl: 'https://example.com/export/case-1',
        })
      ).rejects.toThrow('PDF upload failed: Bucket not found');
    });

    it('throws when signed URL generation fails', async () => {
      mockUpload.mockResolvedValue({ error: null });
      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Permission denied' },
      });

      vi.doMock('puppeteer', () => ({
        default: {
          launch: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              setCookie: vi.fn(),
              goto: vi.fn().mockResolvedValue(undefined),
              waitForSelector: vi.fn().mockResolvedValue(undefined),
              pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
            }),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        },
      }));

      const { PdfExportService } = await import('../PdfExportService');
      const service = new PdfExportService();

      await expect(
        service.exportValueCase({
          organizationId: 'org-1',
          caseId: 'case-1',
          renderUrl: 'https://example.com/export/case-1',
        })
      ).rejects.toThrow('Failed to create signed URL: Permission denied');
    });

    it('invokes progress callback during export', async () => {
      const progressCallback = vi.fn().mockResolvedValue(undefined);

      vi.doMock('puppeteer', () => ({
        default: {
          launch: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              setCookie: vi.fn(),
              goto: vi.fn().mockResolvedValue(undefined),
              waitForSelector: vi.fn().mockResolvedValue(undefined),
              pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
            }),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        },
      }));

      const { PdfExportService } = await import('../PdfExportService');
      const service = new PdfExportService(progressCallback);

      await service.exportValueCase({
        organizationId: 'org-1',
        caseId: 'case-1',
        renderUrl: 'https://example.com/export/case-1',
      });

      // Should have been called with launch, upload, and finalize steps
      expect(progressCallback).toHaveBeenCalledWith('launch', 50, 'Launching browser...');
      expect(progressCallback).toHaveBeenCalledWith('launch', 100, 'Browser ready');
      expect(progressCallback).toHaveBeenCalledWith('upload', 50, 'Uploading to storage...');
      expect(progressCallback).toHaveBeenCalledWith('upload', 100, 'Upload complete');
      expect(progressCallback).toHaveBeenCalledWith('finalize', 50, 'Creating download link...');
      expect(progressCallback).toHaveBeenCalledWith('finalize', 100, 'Export complete');
    });

    it('throws when Puppeteer is not installed', async () => {
      // Make puppeteer import fail
      vi.doMock('puppeteer', () => {
        throw new Error('Module not found');
      });

      const { PdfExportService } = await import('../PdfExportService');
      const service = new PdfExportService();

      await expect(
        service.exportValueCase({
          organizationId: 'org-1',
          caseId: 'case-1',
          renderUrl: 'https://example.com/export/case-1',
        })
      ).rejects.toThrow('Puppeteer is not installed');
    });

    it('generates correct storage path with organization and case IDs', async () => {
      vi.doMock('puppeteer', () => ({
        default: {
          launch: vi.fn().mockResolvedValue({
            newPage: vi.fn().mockResolvedValue({
              setCookie: vi.fn(),
              goto: vi.fn().mockResolvedValue(undefined),
              waitForSelector: vi.fn().mockResolvedValue(undefined),
              pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
            }),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        },
      }));

      const { PdfExportService } = await import('../PdfExportService');
      const service = new PdfExportService();

      const result = await service.exportValueCase({
        organizationId: 'my-org',
        caseId: 'my-case',
        renderUrl: 'https://example.com/export/case-1',
      });

      expect(result.storagePath).toContain('my-org');
      expect(result.storagePath).toContain('my-case');
      expect(result.storagePath).toMatch(/\.pdf$/);
    });
  });
});
