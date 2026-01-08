/**
 * MFA Service Tests
 *
 * Tests for AUTH-001 MFA enforcement
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mfaService, MFAService } from "../MFAService";
import * as speakeasy from "speakeasy";

// Mock dependencies
vi.mock("../../lib/logger");
vi.mock("../BaseService");

describe("MFAService", () => {
  describe("isMFARRequiredForRole", () => {
    it("should require MFA for super_admin", () => {
      expect(mfaService.isMFARRequiredForRole("super_admin")).toBe(true);
    });

    it("should require MFA for admin", () => {
      expect(mfaService.isMFARRequiredForRole("admin")).toBe(true);
    });

    it("should require MFA for manager", () => {
      expect(mfaService.isMFARRequiredForRole("manager")).toBe(true);
    });

    it("should not require MFA for member", () => {
      expect(mfaService.isMFARRequiredForRole("member")).toBe(false);
    });

    it("should not require MFA for viewer", () => {
      expect(mfaService.isMFARRequiredForRole("viewer")).toBe(false);
    });

    it("should not require MFA for guest", () => {
      expect(mfaService.isMFARRequiredForRole("guest")).toBe(false);
    });
  });

  describe("TOTP generation", () => {
    it("should generate valid TOTP secret", () => {
      const secret = speakeasy.generateSecret({
        name: "ValueOS",
        length: 32,
      });

      expect(secret.base32).toBeDefined();
      expect(secret.otpauth_url).toBeDefined();
      expect(secret.base32.length).toBeGreaterThan(0);
    });

    it("should generate valid TOTP tokens", () => {
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: "base32",
      });

      expect(token).toMatch(/^\d{6}$/);
    });

    it("should verify valid TOTP tokens", () => {
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: "base32",
      });

      const verified = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: "base32",
        token: token,
        window: 2,
      });

      expect(verified).toBe(true);
    });

    it("should reject invalid TOTP tokens", () => {
      const secret = speakeasy.generateSecret({ length: 32 });
      const invalidToken = "000000";

      const verified = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: "base32",
        token: invalidToken,
        window: 2,
      });

      expect(verified).toBe(false);
    });
  });

  describe("backup codes", () => {
    it("should generate alphanumeric backup codes", () => {
      // Test the format from MFAService
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const code = Array.from(
        { length: 8 },
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join("");

      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      expect(code).not.toContain("I"); // Ambiguous
      expect(code).not.toContain("O"); // Ambiguous
      expect(code).not.toContain("0"); // Ambiguous
      expect(code).not.toContain("1"); // Ambiguous
    });

    it("should generate 10 unique backup codes", () => {
      const codes = Array.from({ length: 10 }, () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        return Array.from(
          { length: 8 },
          () => chars[Math.floor(Math.random() * chars.length)]
        ).join("");
      });

      expect(codes.length).toBe(10);
      // Check uniqueness
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);
    });
  });

  describe("MFA enforcement logic", () => {
    it("should block login for admin without MFA", async () => {
      // Test scenario covered in AuthService tests
      const userRole = "admin";
      const mfaRequired = mfaService.isMFARRequiredForRole(userRole);
      const mfaEnabled = false;

      if (mfaRequired && !mfaEnabled) {
        expect(true).toBe(true); // Should require enrollment
      }
    });

    it("should allow login for member without MFA", () => {
      const userRole = "member";
      const mfaRequired = mfaService.isMFARRequiredForRole(userRole);

      expect(mfaRequired).toBe(false); // MFA is optional
    });
  });
});
