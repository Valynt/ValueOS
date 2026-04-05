import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

describe("createWorkerServiceSupabaseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";

    const { createWorkerServiceSupabaseClient } = await import("./createWorkerServiceSupabaseClient.js");

    expect(() =>
      createWorkerServiceSupabaseClient({
        justification: "service-role:justified test worker privileged access",
      }),
    ).toThrow(
      "createWorkerServiceSupabaseClient requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  it("creates a client when service-role key is present and disables session persistence", async () => {
    const fakeClient = { from: vi.fn() };
    mockCreateClient.mockReturnValue(fakeClient);

    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { createWorkerServiceSupabaseClient } = await import("./createWorkerServiceSupabaseClient.js");

    const client = createWorkerServiceSupabaseClient({
      justification: "service-role:justified test worker privileged access",
    });

    expect(client).toBe(fakeClient);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      {
        auth: {
          persistSession: false,
        },
      },
    );
  });
});
