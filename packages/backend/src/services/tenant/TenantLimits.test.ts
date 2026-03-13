import { describe, expect, it } from "vitest";

import {
  getTenantFeatures,
  getTenantLimits,
  hasFeature,
  isWithinLimits,
  TIER_FEATURES,
  TIER_LIMITS,
} from "./TenantLimits.js";
import type { TenantLimits, TenantUsage } from "./TenantProvisioning.js";

describe("TIER_LIMITS", () => {
  it("defines limits for all four tiers", () => {
    expect(TIER_LIMITS.free).toBeDefined();
    expect(TIER_LIMITS.starter).toBeDefined();
    expect(TIER_LIMITS.professional).toBeDefined();
    expect(TIER_LIMITS.enterprise).toBeDefined();
  });

  it("enterprise tier has unlimited (-1) values", () => {
    const enterprise = TIER_LIMITS.enterprise;
    expect(enterprise.maxUsers).toBe(-1);
    expect(enterprise.maxTeams).toBe(-1);
    expect(enterprise.maxProjects).toBe(-1);
    expect(enterprise.maxStorage).toBe(-1);
    expect(enterprise.maxApiCalls).toBe(-1);
    expect(enterprise.maxAgentCalls).toBe(-1);
  });

  it("free tier has the most restrictive limits", () => {
    expect(TIER_LIMITS.free.maxUsers).toBeLessThan(TIER_LIMITS.starter.maxUsers);
    expect(TIER_LIMITS.free.maxTeams).toBeLessThan(TIER_LIMITS.starter.maxTeams);
    expect(TIER_LIMITS.free.maxProjects).toBeLessThan(TIER_LIMITS.starter.maxProjects);
  });
});

describe("TIER_FEATURES", () => {
  it("defines features for all four tiers", () => {
    expect(TIER_FEATURES.free.length).toBeGreaterThan(0);
    expect(TIER_FEATURES.enterprise.length).toBeGreaterThan(TIER_FEATURES.free.length);
  });

  it("enterprise includes basic_canvas (shared across all tiers)", () => {
    // Enterprise uses advanced_* variants rather than basic_* for agents/workflows,
    // but basic_canvas is present in all tiers.
    expect(TIER_FEATURES.enterprise).toContain("basic_canvas");
    expect(TIER_FEATURES.enterprise).toContain("advanced_agents");
    expect(TIER_FEATURES.enterprise).toContain("advanced_workflows");
  });
});

describe("getTenantLimits", () => {
  it("returns correct limits for each tier", () => {
    expect(getTenantLimits("free")).toEqual(TIER_LIMITS.free);
    expect(getTenantLimits("starter")).toEqual(TIER_LIMITS.starter);
    expect(getTenantLimits("professional")).toEqual(TIER_LIMITS.professional);
    expect(getTenantLimits("enterprise")).toEqual(TIER_LIMITS.enterprise);
  });
});

describe("getTenantFeatures", () => {
  it("returns correct features for each tier", () => {
    expect(getTenantFeatures("free")).toEqual(TIER_FEATURES.free);
    expect(getTenantFeatures("enterprise")).toEqual(TIER_FEATURES.enterprise);
  });
});

describe("hasFeature", () => {
  it("returns true for a feature the tier has", () => {
    expect(hasFeature("enterprise", "sso")).toBe(true);
    expect(hasFeature("free", "basic_canvas")).toBe(true);
  });

  it("returns false for a feature the tier does not have", () => {
    expect(hasFeature("free", "sso")).toBe(false);
    expect(hasFeature("starter", "sla")).toBe(false);
  });
});

describe("isWithinLimits", () => {
  const makeLimits = (overrides: Partial<TenantLimits> = {}): TenantLimits => ({
    maxUsers: 10,
    maxTeams: 3,
    maxProjects: 25,
    maxStorage: 10_000,
    maxApiCalls: 1000,
    maxAgentCalls: 100,
    ...overrides,
  });

  const makeUsage = (overrides: Partial<TenantUsage> = {}): TenantUsage => ({
    organizationId: "org-1",
    period: "2026-07",
    users: 5,
    teams: 2,
    projects: 10,
    storage: 5_000,
    apiCalls: 500,
    agentCalls: 50,
    lastUpdated: new Date(),
    ...overrides,
  });

  it("returns within=true when all usage is below limits", () => {
    const result = isWithinLimits(makeUsage(), makeLimits());
    expect(result.within).toBe(true);
    expect(result.exceeded).toHaveLength(0);
  });

  it("returns within=false and lists exceeded dimensions", () => {
    const result = isWithinLimits(
      makeUsage({ users: 15, apiCalls: 2000 }),
      makeLimits()
    );
    expect(result.within).toBe(false);
    expect(result.exceeded).toContain("users");
    expect(result.exceeded).toContain("apiCalls");
    expect(result.exceeded).not.toContain("teams");
  });

  it("treats -1 limits as unlimited", () => {
    const result = isWithinLimits(
      makeUsage({ users: 99999 }),
      makeLimits({ maxUsers: -1 })
    );
    expect(result.within).toBe(true);
    expect(result.exceeded).not.toContain("users");
  });

  it("detects storage, teams, projects, and agentCalls violations", () => {
    const result = isWithinLimits(
      makeUsage({ storage: 20_000, teams: 5, projects: 30, agentCalls: 200 }),
      makeLimits()
    );
    expect(result.exceeded).toContain("storage");
    expect(result.exceeded).toContain("teams");
    expect(result.exceeded).toContain("projects");
    expect(result.exceeded).toContain("agentCalls");
  });
});
