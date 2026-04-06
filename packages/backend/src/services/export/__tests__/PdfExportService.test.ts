import { describe, expect, it, vi, beforeEach } from 'vitest';

// We intentionally do not import from PdfExportService directly here
// to ensure a clean module state for each test if we were to use resetModules,
// but for these tests we can rely on dynamic imports.

// Mock dependencies
vi.mock('../../../lib/supabase.js', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
      })),
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

describe('getPdfExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an instance of PdfExportService', async () => {
    // We dynamically import so that the module state is isolated
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