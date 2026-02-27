import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as OTPAuth from "otpauth";
import { requireMFA } from "../middleware/mfa.js";
import { mfaService } from "../services/MFAService.js";

function createMfaSupabase(secretBase32: string) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { enabled: true }, error: null });
  const single = vi.fn().mockResolvedValue({
    data: { secret: secretBase32, backup_codes: [] },
    error: null,
  });

  const eqEnabled = vi.fn(() => ({ maybeSingle }));
  const selectEnabled = vi.fn(() => ({ eq: eqEnabled }));

  const eqToken = vi.fn(() => ({ single }));
  const selectToken = vi.fn(() => ({ eq: eqToken }));

  const from = vi.fn((table: string) => {
    if (table !== "mfa_secrets") {
      throw new Error(`Unexpected table ${table}`);
    }

    return {
      select: (fields: string) => {
        if (fields === "enabled") {
          return { eq: eqEnabled };
        }
        if (fields === "secret, backup_codes") {
          return { eq: eqToken };
        }
        throw new Error(`Unexpected select fields ${fields}`);
      },
    };
  });

  return { from, maybeSingle, single };
}

describe("/api/auth/password/update MFA integration", () => {
  beforeEach(() => {
    (mfaService as any).executeRequest = vi.fn(async (operation: () => Promise<unknown>) => operation());
  });

  it("enforces requireMFA and accepts only valid real TOTP factors", async () => {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const supabaseMock = createMfaSupabase(secret);
    (mfaService as any).supabase = { from: supabaseMock.from };

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: "user-123" };
      next();
    });
    app.post("/api/auth/password/update", requireMFA, (_req, res) => {
      res.status(200).json({ message: "Password updated successfully" });
    });

    const missingMfa = await request(app)
      .post("/api/auth/password/update")
      .send({ newPassword: "StrongPassword123!" });
    expect(missingMfa.status).toBe(403);
    expect(missingMfa.body.error).toBe("MFA_REQUIRED");

    const invalidMfa = await request(app)
      .post("/api/auth/password/update")
      .set("x-mfa-code", "000000")
      .send({ newPassword: "StrongPassword123!" });
    expect(invalidMfa.status).toBe(403);
    expect(invalidMfa.body.error).toBe("INVALID_MFA_CODE");

    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const validMfa = await request(app)
      .post("/api/auth/password/update")
      .set("x-mfa-code", totp.generate())
      .send({ newPassword: "StrongPassword123!" });

    expect(validMfa.status).toBe(200);
    expect(validMfa.body.message).toBe("Password updated successfully");
  });
});
