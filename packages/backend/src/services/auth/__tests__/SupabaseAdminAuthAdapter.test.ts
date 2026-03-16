import { describe, expect, it, vi } from "vitest";

import { SupabaseAdminAuthAdapter } from "@shared/lib/auth/supabaseAdminAuth";

describe("SupabaseAdminAuthAdapter", () => {
  it("returns null when Supabase returns no user", async () => {
    const adapter = new SupabaseAdminAuthAdapter({
      auth: {
        admin: {
          getUserByEmail: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      },
    });

    await expect(adapter.getUserByEmail("none@example.com")).resolves.toBeNull();
  });

  it("throws descriptive error when Supabase admin call fails", async () => {
    const adapter = new SupabaseAdminAuthAdapter({
      auth: {
        admin: {
          getUserByEmail: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "upstream failure" },
          }),
        },
      },
    });

    await expect(adapter.getUserByEmail("fail@example.com")).rejects.toThrow(
      "Supabase admin getUserByEmail failed: upstream failure"
    );
  });
});
