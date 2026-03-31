/**
 * Unit tests for PptxExportService.
 *
 * Focuses on the Supabase client selection regression: the service must use
 * the service-role client (createServerSupabaseClient), not the user-scoped
 * client (createUserSupabaseClient). Using the user-scoped client with no
 * token argument sends "Authorization: Bearer undefined" and fails at runtime.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://storage.example.com/signed" },
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

// Track which factory was called so the test can assert the correct one.
const createServerSupabaseClientSpy = vi.fn().mockReturnValue(mockServerClient);
const createUserSupabaseClientSpy = vi.fn();

vi.mock("../../../lib/supabase.js", () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClientSpy(...args),
  createUserSupabaseClient: (...args: unknown[]) => createUserSupabaseClientSpy(...args),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

vi.mock("../../../repositories/NarrativeDraftRepository.js", () => ({
  NarrativeDraftRepository: class {
    getLatestForCase = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock("../../../repositories/FinancialModelSnapshotRepository.js", () => ({
  financialModelSnapshotRepository: {
    getLatestSnapshotForCase: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../value/HypothesisOutputService.js", () => ({
  HypothesisOutputService: class {
    getLatestForCase = vi.fn().mockResolvedValue(null);
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
    });
    write = vi.fn().mockResolvedValue(Buffer.from("pptx"));
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PptxExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses createServerSupabaseClient, not createUserSupabaseClient", async () => {
    // Import after mocks are set up
    const { PptxExportService } = await import("../PptxExportService.js");
    new PptxExportService();

    expect(createServerSupabaseClientSpy).toHaveBeenCalledOnce();
    // Called with no arguments — service-role client requires none
    expect(createServerSupabaseClientSpy).toHaveBeenCalledWith();
    expect(createUserSupabaseClientSpy).not.toHaveBeenCalled();
  });

  it("does not pass undefined as a token to any Supabase factory", async () => {
    const { PptxExportService } = await import("../PptxExportService.js");
    new PptxExportService();

    const calls = createServerSupabaseClientSpy.mock.calls;
    for (const args of calls) {
      expect(args[0]).not.toBe(undefined);
      // service-role factory takes no args; first arg should be absent
      expect(args.length).toBe(0);
    }
  });
});
