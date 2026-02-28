import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasService } from "../CanvasService";

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => mockSupabase,
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("CanvasService", () => {
  let service: CanvasService;

  beforeEach(() => {
    service = new CanvasService();
    vi.clearAllMocks();
  });

  it("should return canvas with nodes and edges", async () => {
    const mockValueCase = {
      id: "vc-1",
      name: "Test Case",
      created_at: "2023-01-01",
      updated_at: "2023-01-02",
    };

    const mockElements = [
      {
        id: "node-1",
        element_type: "card",
        position_x: 100,
        position_y: 200,
        content: { title: "Node 1" },
        style: {},
        value_case_id: "vc-1",
      },
      {
        id: "edge-1",
        element_type: "connector",
        content: { source: "node-1", target: "node-2" },
        value_case_id: "vc-1",
      },
    ];

    // Mock query for value case
    const mockSelectValueCase = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockValueCase, error: null }),
        }),
      }),
    };

    // Mock query for elements
    const mockSelectElements = {
      eq: vi.fn().mockResolvedValue({ data: mockElements, error: null }),
    };

    mockSupabase.from
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue(mockSelectValueCase) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue(mockSelectElements) });

    const result = await service.getCanvas("vc-1", "tenant-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("vc-1");
    expect(result?.name).toBe("Test Case");
    expect(result?.nodes).toHaveLength(1);
    expect(result?.edges).toHaveLength(1);
    expect(result?.nodes[0].id).toBe("node-1");
    expect(result?.nodes[0].type).toBe("card");
    expect(result?.edges[0].id).toBe("edge-1");
    expect(result?.edges[0].source).toBe("node-1");
  });

  it("should return null if value case not found", async () => {
    const mockSelectValueCase = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };

    mockSupabase.from.mockReturnValueOnce({ select: vi.fn().mockReturnValue(mockSelectValueCase) });

    const result = await service.getCanvas("vc-1", "tenant-1");

    expect(result).toBeNull();
  });
});
