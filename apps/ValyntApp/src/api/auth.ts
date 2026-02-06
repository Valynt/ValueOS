/**
 * Auth API Endpoints
 *
 * Wrapped with standard security middlewares:
 * - Security headers
 * - Service identity + nonce/timestamp
 * - CSRF protection
 * - Session idle/absolute timeout enforcement
 * - Rate limiting (strict by default)
 */

import { Request, Response } from "express";
import { createSecureRouter } from "../middleware/secureRouter";
import { requireAuth } from "../middleware/auth";
import { validateRequest, ValidationSchemas } from "../middleware/inputValidation";
import { authService } from "../services/AuthService";
import { AuthenticationError, RateLimitError, ValidationError } from "../services/errors";
import { createLogger } from "../lib/logger";
import { sanitizeForLogging } from "../lib/piiFilter";
import { auditLogService } from "../services/AuditLogService";
import { createServerSupabaseClient } from "../lib/supabase";
import { sanitizeErrorMessage } from "../utils/security";

const logger = createLogger({ component: "AuthAPI" });
const router = createSecureRouter("strict");
let serverSupabase: ReturnType<typeof createServerSupabaseClient> | null = null;

function getServerSupabase() {
  if (!serverSupabase) {
    serverSupabase = createServerSupabaseClient();
  }
  return serverSupabase;
}

function resolveActor(user?: any) {
  return {
    id: user?.id,
    email: user?.email,
    name:
      user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Unknown User",
  };
}

const AUTH_DETAIL_REDACTIONS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "password",
  "authorization",
  "cookie",
  "set-cookie",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeAuthDetails(details: unknown): Record<string, unknown> | undefined {
  if (!isRecord(details)) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (AUTH_DETAIL_REDACTIONS.has(key.toLowerCase())) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function buildAuthErrorPayload(message: string, code?: string, details?: unknown) {
  return {
    error: message,
    ...(code ? { code } : {}),
    details: sanitizeAuthDetails(details) ?? {},
  };
}

function resolveAuthErrorCode(error: AuthenticationError): string {
  if (typeof error.authCode === "string") {
    return error.authCode;
  }
  const details = isRecord(error.details) ? error.details : undefined;
  if (typeof details?.code === "string") {
    return details.code;
  }
  return "AUTHENTICATION_FAILED";
}

function resolveValidationErrorCode(error: ValidationError): string {
  const details = isRecord(error.details) ? error.details : undefined;
  return typeof details?.code === "string" ? details.code : "VALIDATION_ERROR";
}

async function buildMFAEnrollmentRequiredPayload(error: AuthenticationError, email?: string) {
  const details = (error.details ?? {}) as Record<string, unknown>;
  let userId = typeof details.userId === "string" ? details.userId : undefined;
  let role = typeof details.role === "string" ? details.role : undefined;

  if ((!userId || !role) && email) {
    try {
      const supabaseAdmin = getServerSupabase();
      const { data: lookup } = await (supabaseAdmin.auth.admin as any).getUserByEmail(email);
      if (lookup?.user) {
        userId = userId ?? lookup.user.id;
        const metadataRole = lookup.user.user_metadata?.role;
        role = role ?? (typeof metadataRole === "string" ? metadataRole : undefined);
      }
    } catch (lookupError) {
      logger.warn("Unable to resolve MFA enrollment contract from profile lookup", {
        email: sanitizeForLogging(email),
        error: sanitizeForLogging(lookupError),
      });
    }
  }

  return {
    error: error.message,
    code: "MFA_ENROLLMENT_REQUIRED" as const,
    details: {
      ...(sanitizeAuthDetails(error.details) ?? {}),
      userId: userId ?? "unknown",
      role: role ?? "manager",
    },
  };
}

router.post(
  "/login",
  validateRequest(ValidationSchemas.login),
  async (req: Request, res: Response) => {
    try {
      const { email, password, otpCode } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json(buildAuthErrorPayload("Email and password are required", "VALIDATION_ERROR"));
      }

      const result = await authService.login({ email, password, otpCode });

      logger.info("User login successful", {
        userId: String(sanitizeForLogging(result.user.id)),
        email: String(sanitizeForLogging(email)),
      });

      await auditLogService.logAudit({
        userId: result.user.id,
        userName:
          result.user.user_metadata?.full_name ||
          result.user.user_metadata?.name ||
          result.user.email ||
          "User",
        userEmail: result.user.email || email,
        action: "auth.login",
        resourceType: "auth",
        resourceId: result.user.id,
        details: {
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        },
        status: "success",
      });

      // Return session info (client will handle token storage)
      res.json({
        user: {
          id: result.user.id,
          email: result.user.email,
          user_metadata: result.user.user_metadata,
        },
        session: result.session
          ? {
              access_token: result.session.access_token,
              refresh_token: result.session.refresh_token,
              expires_at: result.session.expires_at,
            }
          : null,
      });
    } catch (error) {
      logger.error("Login failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });

      if (error instanceof RateLimitError) {
        if (typeof error.retryAfter === "number") {
          res.setHeader("Retry-After", String(error.retryAfter));
        }
        return res
          .status(429)
          .json(buildAuthErrorPayload(error.message, "RATE_LIMIT_EXCEEDED", { retryAfter: error.retryAfter }));
      }
      if (error instanceof AuthenticationError) {
        if (error.authCode === "MFA_ENROLLMENT_REQUIRED") {
          const payload = await buildMFAEnrollmentRequiredPayload(error, email);
          return res.status(403).json(payload);
        }

        const statusCode = error.statusCode ?? 401;
        return res
          .status(statusCode)
          .json(buildAuthErrorPayload(error.message, resolveAuthErrorCode(error), error.details));
      }
      if (error instanceof ValidationError) {
        const payload = buildAuthErrorPayload(
          error.message,
          resolveValidationErrorCode(error),
          error.details
        );
        return res.status(400).json({
          ...payload,
          ...(typeof error.code === "string" ? { errorCode: error.code } : {}),
        });
      }

      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/signup",
  validateRequest(ValidationSchemas.signup),
  async (req: Request, res: Response) => {
    try {
      const { email, password, fullName } = req.body;

      if (!email || !password || !fullName) {
        return res.status(400).json({
          error: "Email, password, and full name are required",
        });
      }

      const result = await authService.signup({ email, password, fullName });

      logger.info("User signup successful", {
        userId: String(sanitizeForLogging(result.user.id)),
        email: String(sanitizeForLogging(email)),
      });

      await auditLogService.logAudit({
        userId: result.user.id,
        userName:
          result.user.user_metadata?.full_name ||
          result.user.user_metadata?.name ||
          result.user.email ||
          "User",
        userEmail: result.user.email || email,
        action: "auth.signup",
        resourceType: "auth",
        resourceId: result.user.id,
        details: {
          requiresEmailVerification: !result.session,
          ipAddress: req.ip,
        },
        status: "success",
      });

      if (!result.session) {
        return res.status(202).json({
          user: {
            id: result.user.id,
            email: result.user.email,
            user_metadata: result.user.user_metadata,
          },
          session: null,
          requiresEmailVerification: true,
        });
      }

      res.status(201).json({
        user: {
          id: result.user.id,
          email: result.user.email,
          user_metadata: result.user.user_metadata,
        },
        session: {
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
          expires_at: result.session.expires_at,
        },
      });
    } catch (error) {
      logger.error("Signup failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });

      if (error instanceof ValidationError) {
        return res
          .status(400)
          .json(buildAuthErrorPayload(error.message, resolveValidationErrorCode(error), error.details));
      }
      if (error instanceof AuthenticationError) {
        return res
          .status(error.statusCode ?? 409)
          .json(buildAuthErrorPayload(error.message, resolveAuthErrorCode(error), error.details));
      }

      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/password/reset",
  validateRequest({
    email: { type: "email" as const, required: true },
  }),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res
          .status(400)
          .json(buildAuthErrorPayload("Email is required", "VALIDATION_ERROR"));
      }

      await authService.requestPasswordReset(email);

      logger.info("Password reset requested", {
        email: sanitizeForLogging(email),
      });

      try {
        const supabaseAdmin = getServerSupabase();
        const { data: resetUser } = await (supabaseAdmin.auth.admin as any).getUserByEmail(email);
        if (resetUser?.user) {
          await auditLogService.logAudit({
            userId: resetUser.user.id,
            userName:
              resetUser.user.user_metadata?.full_name ||
              resetUser.user.user_metadata?.name ||
              resetUser.user.email ||
              "User",
            userEmail: resetUser.user.email || email,
            action: "auth.password_reset_requested",
            resourceType: "auth",
            resourceId: resetUser.user.id,
            details: {
              ipAddress: req.ip,
            },
            status: "success",
          });
        }
      } catch (auditError) {
        logger.warn("Password reset audit lookup failed", { errorMsg: String(auditError) });
      }

      // Always return success to prevent email enumeration
      res.json({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      logger.error("Password reset request failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });
      if (error instanceof RateLimitError) {
        if (typeof error.retryAfter === "number") {
          res.setHeader("Retry-After", String(error.retryAfter));
        }
        return res
          .status(429)
          .json(buildAuthErrorPayload(error.message, "RATE_LIMIT_EXCEEDED", { retryAfter: error.retryAfter }));
      }
      if (error instanceof AuthenticationError) {
        return res
          .status(error.statusCode ?? 401)
          .json(buildAuthErrorPayload(error.message, resolveAuthErrorCode(error), error.details));
      }
      if (error instanceof ValidationError) {
        return res
          .status(400)
          .json(buildAuthErrorPayload(error.message, resolveValidationErrorCode(error), error.details));
      }
      // Don't expose internal errors for security
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/verify/resend",
  validateRequest({
    email: { type: "email" as const, required: true },
  }),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res
          .status(400)
          .json(buildAuthErrorPayload("Email is required", "VALIDATION_ERROR"));
      }

      const { error } = await getServerSupabase().auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${req.protocol}://${req.get("host")}/auth/callback`,
        },
      });

      if (error) {
        throw new AuthenticationError(sanitizeErrorMessage(error));
      }

      try {
        const { data: verifyUser } = await (getServerSupabase().auth.admin as any).getUserByEmail(
          email
        );
        if (verifyUser?.user) {
          await auditLogService.logAudit({
            userId: verifyUser.user.id,
            userName:
              verifyUser.user.user_metadata?.full_name ||
              verifyUser.user.user_metadata?.name ||
              verifyUser.user.email ||
              "User",
            userEmail: verifyUser.user.email || email,
            action: "auth.verify_resend",
            resourceType: "auth",
            resourceId: verifyUser.user.id,
            details: {
              ipAddress: req.ip,
            },
            status: "success",
          });
        }
      } catch (auditError) {
        logger.warn("Verification audit lookup failed", { errorMsg: String(auditError) });
      }

      res.json({ message: "Verification email resent" });
    } catch (error) {
      logger.error("Verification resend failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });
      if (error instanceof RateLimitError) {
        if (typeof error.retryAfter === "number") {
          res.setHeader("Retry-After", String(error.retryAfter));
        }
        return res
          .status(429)
          .json(buildAuthErrorPayload(error.message, "RATE_LIMIT_EXCEEDED", { retryAfter: error.retryAfter }));
      }
      if (error instanceof AuthenticationError) {
        return res
          .status(error.statusCode ?? 401)
          .json(buildAuthErrorPayload(error.message, resolveAuthErrorCode(error), error.details));
      }
      if (error instanceof ValidationError) {
        return res
          .status(400)
          .json(buildAuthErrorPayload(error.message, resolveValidationErrorCode(error), error.details));
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post("/password/update", requireAuth, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res
        .status(400)
        .json(buildAuthErrorPayload("New password is required", "VALIDATION_ERROR"));
    }

    await authService.updatePassword(newPassword);

    logger.info("Password updated successfully", {
      userId: String(sanitizeForLogging((req as any).user?.id)),
    });

    const actor = resolveActor((req as any).user);
    if (actor.id) {
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "auth.password_updated",
        resourceType: "auth",
        resourceId: actor.id,
        details: {
          ipAddress: req.ip,
        },
        status: "success",
      });
    }

    res.json({
      message: "Password updated successfully",
    });
  } catch (error) {
    logger.error("Password update failed", error instanceof Error ? error : undefined, {
      errorMsg: String(error),
    });

    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(buildAuthErrorPayload(error.message, resolveValidationErrorCode(error), error.details));
    }
    if (error instanceof RateLimitError) {
      if (typeof error.retryAfter === "number") {
        res.setHeader("Retry-After", String(error.retryAfter));
      }
      return res
        .status(429)
        .json(buildAuthErrorPayload(error.message, "RATE_LIMIT_EXCEEDED", { retryAfter: error.retryAfter }));
    }
    if (error instanceof AuthenticationError) {
      return res
        .status(error.statusCode ?? 401)
        .json(buildAuthErrorPayload(error.message, resolveAuthErrorCode(error), error.details));
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    await authService.logout();

    logger.info("User logout successful");

    const actor = resolveActor((req as any).user);
    if (actor.id) {
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: "auth.logout",
        resourceType: "auth",
        resourceId: actor.id,
        details: {
          ipAddress: req.ip,
        },
        status: "success",
      });
    }

    res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout failed", error instanceof Error ? error : undefined, {
      errorMsg: String(error),
    });
    if (error instanceof RateLimitError) {
      if (typeof error.retryAfter === "number") {
        res.setHeader("Retry-After", String(error.retryAfter));
      }
      return res
        .status(429)
        .json(buildAuthErrorPayload(error.message, "RATE_LIMIT_EXCEEDED", { retryAfter: error.retryAfter }));
    }
    if (error instanceof AuthenticationError) {
      return res
        .status(error.statusCode ?? 401)
        .json(buildAuthErrorPayload(error.message, resolveAuthErrorCode(error), error.details));
    }
    // Logout should always succeed on client side
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/session", async (_req: Request, res: Response) => {
  try {
    const session = await authService.getSession();

    if (!session) {
      return res.status(401).json({ error: "No active session" });
    }

    res.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata,
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
    });
  } catch (error) {
    logger.error("Session retrieval failed", error instanceof Error ? error : undefined, {
      errorMsg: String(error),
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/refresh", async (_req: Request, res: Response) => {
  try {
    const result = await authService.refreshSession();

    logger.info("Session refresh successful", {
      userId: String(sanitizeForLogging(result.user.id)),
    });

    res.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        user_metadata: result.user.user_metadata,
      },
      session: result.session
        ? {
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
            expires_at: result.session.expires_at,
          }
        : null,
    });
  } catch (error) {
    logger.error("Session refresh failed", error instanceof Error ? error : undefined, {
      errorMsg: String(error),
    });

    if (error instanceof RateLimitError) {
      if (typeof error.retryAfter === "number") {
        res.setHeader("Retry-After", String(error.retryAfter));
      }
      return res
        .status(429)
        .json(buildAuthErrorPayload(error.message, "RATE_LIMIT_EXCEEDED", { retryAfter: error.retryAfter }));
    }
    if (error instanceof AuthenticationError) {
      return res
        .status(error.statusCode ?? 401)
        .json(buildAuthErrorPayload(error.message, resolveAuthErrorCode(error), error.details));
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
