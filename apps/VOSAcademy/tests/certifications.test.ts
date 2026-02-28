import { beforeEach, describe, expect, it, vi } from "vitest";

import { appRouter } from "../src/data/routers/index";
import type { Context } from "../src/data/_core/trpc";

// Mock the database module
vi.mock("../src/data/db", () => ({
  getUserCertifications: vi.fn(),
  getUserById: vi.fn(),
  getPillarById: vi.fn(),
}));

import * as db from "../src/data/db";

type AuthenticatedUser = NonNullable<Context["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: Context } {
  const user: AuthenticatedUser = {
    id: 1, // Changed to number to match existing test, though schema says uuid
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    vosRole: "Sales",
    maturityLevel: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: Context = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as Context["req"],
    res: {} as Context["res"],
  };

  return { ctx };
}

describe("Certifications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock implementation
    vi.mocked(db.getUserCertifications).mockResolvedValue([]);
  });

  describe("getUserCertifications", () => {
    it("returns empty array for user with no certifications", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      vi.mocked(db.getUserCertifications).mockResolvedValue([]);

      const result = await caller.certifications.getUserCertifications();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("returns certifications with correct structure", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockCert = {
        id: 1,
        userId: "user-1",
        pillarId: 1,
        badgeName: "Pillar 1 - Sales Certified",
        vosRole: "Sales",
        tier: "gold",
        score: 95,
        awardedAt: new Date(),
      };
      // @ts-ignore
      vi.mocked(db.getUserCertifications).mockResolvedValue([mockCert]);

      const result = await caller.certifications.getUserCertifications();

      expect(result).toHaveLength(1);
      const cert = result[0];

      expect(cert).toHaveProperty("id");
      expect(cert).toHaveProperty("pillarNumber");
      expect(cert).toHaveProperty("pillarTitle");
      expect(cert).toHaveProperty("tier");
      expect(cert).toHaveProperty("score");
      expect(cert).toHaveProperty("earnedAt");
      expect(cert).toHaveProperty("expiresAt");

      expect(cert.tier).toBe("gold");
      expect(cert.score).toBe(95);
    });

    it("requires authentication", async () => {
      const ctx: Context = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as Context["req"],
        res: {} as Context["res"],
      };

      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.certifications.getUserCertifications()
      ).rejects.toThrow();
    });
  });

  describe("Certification Tiers", () => {
    it("Bronze tier: awarded for passing knowledge checks (<80% but passed)", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Score 79 should be bronze
      const mockCert = {
        id: 1,
        userId: "user-1",
        pillarId: 1,
        badgeName: "Pillar 1 - Sales Certified",
        vosRole: "Sales",
        tier: "bronze",
        score: 79,
        awardedAt: new Date(),
      };
      // @ts-ignore
      vi.mocked(db.getUserCertifications).mockResolvedValue([mockCert]);

      const result = await caller.certifications.getUserCertifications();

      expect(result[0].tier).toBe("bronze");
    });

    it("Silver tier: awarded for 80%+ on final simulation", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Score 80 should be silver (updated threshold from 85)
      const mockCert80 = {
        id: 2,
        userId: "user-1",
        pillarId: 1,
        badgeName: "Pillar 1 - Sales Certified",
        vosRole: "Sales",
        tier: "bronze", // DB says bronze, but dynamic check should say silver based on score
        score: 80,
        awardedAt: new Date(),
      };

       // Score 94 should be silver
       const mockCert94 = {
        id: 3,
        userId: "user-1",
        pillarId: 1,
        badgeName: "Pillar 1 - Sales Certified",
        vosRole: "Sales",
        tier: "bronze",
        score: 94,
        awardedAt: new Date(),
      };

      // @ts-ignore
      vi.mocked(db.getUserCertifications).mockResolvedValue([mockCert80, mockCert94]);

      const result = await caller.certifications.getUserCertifications();

      expect(result[0].score).toBe(80);
      expect(result[0].tier).toBe("silver");

      expect(result[1].score).toBe(94);
      expect(result[1].tier).toBe("silver");
    });

    it("Gold tier: awarded for 95%+ with exceptional insight", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Score 95 should be gold
      const mockCert = {
        id: 4,
        userId: "user-1",
        pillarId: 1,
        badgeName: "Pillar 1 - Sales Certified",
        vosRole: "Sales",
        tier: "silver", // DB value might be outdated, we check calculated tier
        score: 95,
        awardedAt: new Date(),
      };

      // Score 100 should be gold
      const mockCert100 = {
        id: 5,
        userId: "user-1",
        pillarId: 1,
        badgeName: "Pillar 1 - Sales Certified",
        vosRole: "Sales",
        tier: "silver",
        score: 100,
        awardedAt: new Date(),
      };

      // @ts-ignore
      vi.mocked(db.getUserCertifications).mockResolvedValue([mockCert, mockCert100]);

      const result = await caller.certifications.getUserCertifications();

      expect(result[0].score).toBe(95);
      expect(result[0].tier).toBe("gold");

      expect(result[1].score).toBe(100);
      expect(result[1].tier).toBe("gold");
    });
  });
});
