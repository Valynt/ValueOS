/**
 * MFA Service Tests
 */

import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import * as OTPAuth from "otpauth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MFAService } from "../MFAService.js";


vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: vi.fn(),
}));

describe("MFAService", () => {
  let service: MFAService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MFAService();
    (service as any).executeRequest = vi.fn(async (operation: () => Promise<unknown>) => operation());
  });

  describe("isMFARequiredForRole", () => {
    it("should require MFA for super_admin", () => {
      expect(service.isMFARequiredForRole("super_admin")).toBe(true);
    });

    it("should not require MFA for member", () => {
      expect(service.isMFARequiredForRole("member")).toBe(false);
    });
  });

  describe("TOTP generation", () => {
    it("should verify valid TOTP tokens", () => {
      const secret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret });
      const token = totp.generate();

      const delta = totp.validate({ token, window: 1 });
      expect(delta).not.toBeNull();
    });

    it("should reject invalid TOTP tokens", () => {
      const secret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret });

      expect(totp.validate({ token: "000000", window: 1 })).toBeNull();
    });
  });

  describe("verifyMFA webauthn", () => {
    it("rejects webauthn verification when challenge is missing", async () => {
      const result = await service.verifyMFA("user-1", "webauthn", {
        response: { rawId: "ZmFrZS1jcmVkZW50aWFs", id: "fake", type: "public-key", response: {} as any, clientExtensionResults: {} },
      });

      expect(result).toEqual({ verified: false });
    });

    it("rejects forged webauthn assertion when verifier returns not verified", async () => {
      const mockedVerify = vi.mocked(verifyAuthenticationResponse);
      mockedVerify.mockResolvedValue({ verified: false } as any);

      const single = vi.fn().mockResolvedValue({
        data: {
          id: "cred-row",
          credential_id: Buffer.from("credential-id").toString("base64"),
          public_key: Buffer.from("public-key").toString("base64"),
          counter: 10,
        },
        error: null,
      });
      const eq2 = vi.fn(() => ({ single }));
      const eq1 = vi.fn(() => ({ eq: eq2 }));
      const select = vi.fn(() => ({ eq: eq1 }));
      const from = vi.fn(() => ({ select }));
      (service as any).supabase = { from };

      const result = await service.verifyMFA("user-1", "webauthn", {
        expectedChallenge: "expected-challenge",
        response: {
          id: "credential-id",
          rawId: Buffer.from("credential-id").toString("base64url"),
          type: "public-key",
          response: {} as any,
          clientExtensionResults: {},
        },
      });

      expect(result).toEqual({ verified: false });
    });

    it("rejects unknown webauthn credential lookup", async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
      const eq2 = vi.fn(() => ({ single }));
      const eq1 = vi.fn(() => ({ eq: eq2 }));
      const select = vi.fn(() => ({ eq: eq1 }));
      const from = vi.fn(() => ({ select }));
      (service as any).supabase = { from };

      const result = await service.verifyMFA("user-1", "webauthn", {
        expectedChallenge: "expected-challenge",
        response: {
          id: "credential-id",
          rawId: Buffer.from("credential-id").toString("base64url"),
          type: "public-key",
          response: {} as any,
          clientExtensionResults: {},
        },
      });

      expect(result).toEqual({ verified: false });
      expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
    });
  });
});
