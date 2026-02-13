import { describe, expect, it } from "vitest";
import { resolveSupabaseMode } from "../../scripts/dx/lib/supabase-mode.js";

describe("resolveSupabaseMode", () => {
  it("defaults to local when no flags are set", () => {
    const result = resolveSupabaseMode({ env: {} });
    expect(result.mode).toBe("local");
  });

  it("respects DX_SKIP_SUPABASE", () => {
    const result = resolveSupabaseMode({ env: { DX_SKIP_SUPABASE: "1" } });
    expect(result.mode).toBe("skip");
  });

  it("respects DX_FORCE_SUPABASE", () => {
    const result = resolveSupabaseMode({ env: { DX_FORCE_SUPABASE: "1" } });
    expect(result.mode).toBe("local");
  });

  it("detects cloud mode for remote Supabase URL", () => {
    const result = resolveSupabaseMode({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co" },
    });
    expect(result.mode).toBe("cloud");
  });

  it("treats compose service DNS as local when provided as network host", () => {
    const result = resolveSupabaseMode({
      env: { SUPABASE_URL: "http://supabase:54321" },
      networkHosts: ["supabase"],
    });
    expect(result.mode).toBe("local");
  });

  it("treats docker host gateway as local when provided", () => {
    const result = resolveSupabaseMode({
      env: { SUPABASE_URL: "http://172.17.0.1:54321" },
      localHosts: ["172.17.0.1"],
    });
    expect(result.mode).toBe("local");
  });
});
