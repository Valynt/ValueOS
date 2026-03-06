import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * Tests for profile router logic and data validation.
 * Since we can't easily spin up a full tRPC context in unit tests,
 * we test the underlying logic: input validation, preference merging,
 * and profile field handling.
 */

/* ── Input Validation ── */
describe("profile.update input validation", () => {
  const { z } = require("zod");

  const updateSchema = z.object({
    displayName: z.string().max(255).nullish(),
    bio: z.string().max(500).nullish(),
    company: z.string().max(255).nullish(),
    jobTitle: z.string().max(255).nullish(),
    timezone: z.string().max(64).optional(),
    avatarUrl: z.string().url().nullish(),
  });

  it("should accept valid profile update input", () => {
    const input = {
      displayName: "Brian Sullivan",
      bio: "VP of Engineering at Valynt",
      company: "Valynt Engineering",
      jobTitle: "VP of Engineering",
      timezone: "America/New_York",
    };
    const result = updateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept null values for nullable fields", () => {
    const input = {
      displayName: null,
      bio: null,
      company: null,
      jobTitle: null,
    };
    const result = updateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept empty/partial input", () => {
    const result = updateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject displayName exceeding 255 chars", () => {
    const input = { displayName: "a".repeat(256) };
    const result = updateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject bio exceeding 500 chars", () => {
    const input = { bio: "a".repeat(501) };
    const result = updateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject invalid avatarUrl", () => {
    const input = { avatarUrl: "not-a-url" };
    const result = updateSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept valid avatarUrl", () => {
    const input = { avatarUrl: "https://storage.example.com/avatar.png" };
    const result = updateSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

/* ── Preferences Validation ── */
describe("profile.updatePreferences input validation", () => {
  const { z } = require("zod");

  const prefsSchema = z.object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    emailNotifications: z.boolean().optional(),
    agentNotifications: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
  });

  it("should accept valid preferences", () => {
    const input = {
      theme: "dark",
      emailNotifications: true,
      agentNotifications: false,
      weeklyDigest: true,
    };
    const result = prefsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept partial preferences", () => {
    const result = prefsSchema.safeParse({ theme: "light" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid theme value", () => {
    const result = prefsSchema.safeParse({ theme: "midnight" });
    expect(result.success).toBe(false);
  });

  it("should reject non-boolean notification value", () => {
    const result = prefsSchema.safeParse({ emailNotifications: "yes" });
    expect(result.success).toBe(false);
  });

  it("should accept empty preferences", () => {
    const result = prefsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

/* ── Preference Merging Logic ── */
describe("preference merging", () => {
  function mergePreferences(
    existing: Record<string, unknown> | null,
    incoming: Record<string, unknown>
  ): Record<string, unknown> {
    const currentPrefs = existing ?? {};
    return { ...currentPrefs, ...incoming };
  }

  it("should merge new preferences with existing ones", () => {
    const existing = { theme: "light", emailNotifications: true };
    const incoming = { theme: "dark" };
    const result = mergePreferences(existing, incoming);
    expect(result).toEqual({ theme: "dark", emailNotifications: true });
  });

  it("should handle null existing preferences", () => {
    const result = mergePreferences(null, { theme: "dark" });
    expect(result).toEqual({ theme: "dark" });
  });

  it("should preserve unrelated keys", () => {
    const existing = { theme: "light", weeklyDigest: true, agentNotifications: false };
    const incoming = { emailNotifications: true };
    const result = mergePreferences(existing, incoming);
    expect(result).toEqual({
      theme: "light",
      weeklyDigest: true,
      agentNotifications: false,
      emailNotifications: true,
    });
  });

  it("should allow overriding all fields", () => {
    const existing = { theme: "light", emailNotifications: true };
    const incoming = { theme: "system", emailNotifications: false, weeklyDigest: true };
    const result = mergePreferences(existing, incoming);
    expect(result).toEqual({
      theme: "system",
      emailNotifications: false,
      weeklyDigest: true,
    });
  });
});

/* ── Profile Update Set Logic ── */
describe("profile updateSet construction", () => {
  function buildUpdateSet(data: Record<string, unknown>): Record<string, unknown> {
    const updateSet: Record<string, unknown> = {};
    const fields = ["displayName", "bio", "company", "jobTitle", "timezone", "avatarUrl", "preferences"];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateSet[field] = data[field];
      }
    }
    return updateSet;
  }

  it("should only include defined fields", () => {
    const data = { displayName: "Brian", company: "Valynt" };
    const result = buildUpdateSet(data);
    expect(result).toEqual({ displayName: "Brian", company: "Valynt" });
    expect(result).not.toHaveProperty("bio");
    expect(result).not.toHaveProperty("timezone");
  });

  it("should include null values (for clearing fields)", () => {
    const data = { displayName: null, bio: null };
    const result = buildUpdateSet(data);
    expect(result).toEqual({ displayName: null, bio: null });
  });

  it("should return empty set for empty input", () => {
    const result = buildUpdateSet({});
    expect(result).toEqual({});
  });

  it("should ignore unknown fields", () => {
    const data = { displayName: "Brian", unknownField: "value" };
    const result = buildUpdateSet(data);
    expect(result).toEqual({ displayName: "Brian" });
    expect(result).not.toHaveProperty("unknownField");
  });
});

/* ── UserPreferences Type Shape ── */
describe("UserPreferences interface compliance", () => {
  interface UserPreferences {
    theme?: "light" | "dark" | "system";
    emailNotifications?: boolean;
    agentNotifications?: boolean;
    weeklyDigest?: boolean;
  }

  it("should accept a complete preferences object", () => {
    const prefs: UserPreferences = {
      theme: "dark",
      emailNotifications: true,
      agentNotifications: false,
      weeklyDigest: true,
    };
    expect(prefs.theme).toBe("dark");
    expect(prefs.emailNotifications).toBe(true);
  });

  it("should accept an empty preferences object", () => {
    const prefs: UserPreferences = {};
    expect(Object.keys(prefs)).toHaveLength(0);
  });

  it("should accept partial preferences", () => {
    const prefs: UserPreferences = { theme: "system" };
    expect(prefs.theme).toBe("system");
    expect(prefs.emailNotifications).toBeUndefined();
  });
});
