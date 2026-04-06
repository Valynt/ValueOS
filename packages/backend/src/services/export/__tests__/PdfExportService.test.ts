import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getPdfExportService, PdfExportService } from '../PdfExportService';

// Mock the logger
vi.mock('@shared/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock the Supabase client creation
vi.mock('../../../lib/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/supabase.js')>();
  return {
    ...actual,
    assertNotTestEnv: vi.fn(),
    createServerSupabaseClient: vi.fn(() => ({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          createSignedUrl: vi.fn(),
        })),
      },
    })),
  };
});

describe('PdfExportService', () => {
  describe('getPdfExportService', () => {
    it('should return an instance of PdfExportService', () => {
      const instance = getPdfExportService();
      expect(instance).toBeInstanceOf(PdfExportService);
    });

    it('should return the exact same instance on subsequent calls (singleton)', () => {
      const instance1 = getPdfExportService();
      const instance2 = getPdfExportService();

      expect(instance1).toBe(instance2);
    });
  });
});
