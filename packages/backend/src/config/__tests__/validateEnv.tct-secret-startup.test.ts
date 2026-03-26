import { afterEach, describe, expect, it, vi } from "vitest";

import { validateEnvOrThrow } from "../validateEnv.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

const seedRequiredEnv = () => {
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/valueos");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_KEY", "anon-key");
  vi.stubEnv("WEB_SCRAPER_ENCRYPTION_KEY", "a".repeat(64));
};

describe("validateEnvOrThrow TCT_SECRET startup enforcement", () => {
  it.each(["development", "test", "staging", "production"])(
    "fails startup in %s when TCT_SECRET is missing",
    (nodeEnv) => {
      seedRequiredEnv();
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("TCT_SECRET", "");
      vi.stubEnv("REDIS_URL", "");

      expect(() => validateEnvOrThrow()).toThrowError(/Missing TCT_SECRET/);
    }
  );
});
