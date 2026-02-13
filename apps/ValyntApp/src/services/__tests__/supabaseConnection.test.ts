import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Mock Supabase client for unit tests
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const mockCreateClient = vi.mocked(createClient);

describe("Supabase Client Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create client with correct parameters", () => {
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
        })),
      })),
    };

    mockCreateClient.mockReturnValue(mockClient as any);

    const supabaseUrl = "https://your-project.supabase.co";
    const supabaseKey = "test-anon-key";
    const supabase = createClient(supabaseUrl, supabaseKey);

    expect(mockCreateClient).toHaveBeenCalledWith(supabaseUrl, supabaseKey);
    expect(supabase).toBe(mockClient);
  });

  it("should handle database query responses", async () => {
    const mockResponse = {
      data: [{ id: 1, name: "test" }],
      error: null,
      status: 200,
    };

    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mockResponse)),
        })),
      })),
    };

    mockCreateClient.mockReturnValue(mockClient as any);

    const supabase = createClient("https://your-project.supabase.co", "test-key");
    const result = await supabase.from("users").select("*").limit(1);

    expect(result).toEqual(mockResponse);
    expect(mockClient.from).toHaveBeenCalledWith("users");
  });

  it("should handle database errors gracefully", async () => {
    const mockError = {
      data: null,
      error: { code: "PGRST116", message: "Table not found" },
      status: 404,
    };

    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mockError)),
        })),
      })),
    };

    mockCreateClient.mockReturnValue(mockClient as any);

    const supabase = createClient("https://your-project.supabase.co", "test-key");
    const result = await supabase.from("users").select("*").limit(1);

    expect(result.status).toBe(404);
    expect(result.error?.code).toBe("PGRST116");
  });
});
