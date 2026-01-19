// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  __getEnvSourceForTests,
  __setEnvSourceForTests,
  getServerSupabaseConfig,
} from "../env";

const originalEnv = __getEnvSourceForTests();

const resetEnv = (nextEnv: Record<string, string>) => {
  const currentEnv = __getEnvSourceForTests();
  for (const key of Object.keys(currentEnv)) {
    if (!(key in nextEnv)) {
      delete process.env[key];
    }
  }
  __setEnvSourceForTests(nextEnv);
};

describe("getServerSupabaseConfig", () => {
  afterEach(() => {
    resetEnv(originalEnv);
  });

  it("throws a clear error when required env is missing", () => {
    resetEnv({});

    expect(() => getServerSupabaseConfig({ required: true })).toThrow(
      "Missing required server environment variable"
    );
  });

  it("returns config when required env is present", () => {
    resetEnv({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    const config = getServerSupabaseConfig({ required: true });

    expect(config).toEqual({
      url: "https://example.supabase.co",
      serviceRoleKey: "service-role-key",
    });
  });
});
