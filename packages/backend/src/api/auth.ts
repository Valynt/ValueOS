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

import { SupabaseAdminAuthAdapter } from "@shared/lib/auth/supabaseAdminAuth"
import { createLogger } from "@shared/lib/logger";
import { sanitizeForLogging } from "@shared/lib/piiFilter";
import { createServerSupabaseClient } from "@shared/lib/supabase";
import { Request, Response } from "express";

import { getConfig } from "../config/environment.js"
import { requireAuth, verifyAccessToken } from "../middleware/auth.js"
import { authRateLimiter, recordAuthFailure } from "../middleware/authRateLimiter.js"
import { validateRequest, ValidationSchemas } from "../middleware/inputValidation.js"
import { requireMFA } from "../middleware/mfa.js"
import { emitRequestAuditEvent } from "../middleware/requestAuditMiddleware.js"
import { createSecureRouter } from "../middleware/secureRouter.js"
import { authService } from "../services/auth/AuthService.js"
import { browserSessionService } from "../services/auth/BrowserSessionService.js"
import { userProfileDirectoryService } from "../services/auth/UserProfileDirectoryService.js"
import { AuthenticationError, ValidationError } from "../services/errors.js"
import { auditLogService } from "../services/security/AuditLogService.js"
import { AUDIT_ACTION } from "../types/audit.js"
import { sanitizeErrorMessage } from "../utils/security.js"

const logger = createLogger({ component: "AuthAPI" });
const router = createSecureRouter("strict");
let serverSupabase: ReturnType<typeof createServerSupabaseClient> | null = null;

function getServerSupabase() {
  if (!serverSupabase) {
    serverSupabase = createServerSupabaseClient();
  }
  return serverSupabase;
}

function getSupabaseAdminAuthAdapter() {
  return new SupabaseAdminAuthAdapter(getServerSupabase());
}

type AuthActor = {
  id?: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
};

function resolveActor(user?: AuthActor) {
  return {
    id: user?.id,
    email: user?.email,
    name:
      user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Unknown User",
  };
}


function buildBrowserSessionPayload(expiresAt?: number, rotatedAt?: number) {
  return {
    managedByServer: true,
    expiresAt,
    rotatedAt,
  };
}

function getRequestSessionId(req: Request): string | null {
  return browserSessionService.getSessionIdFromRequest(req);
}

router.post(
  "/login",
  authRateLimiter("login"),
  validateRequest(ValidationSchemas.login),
  async (req: Request, res: Response) => {
    try {
      const { email, password, otpCode } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required",
        });
      }

      const result = await authService.login({ email, password, otpCode });

      await userProfileDirectoryService.syncProfile(result.user.id);

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

      const browserSession = result.session ? await browserSessionService.create(result.session) : null;

      if (browserSession) {
        browserSessionService.applySessionCookie(
          res,
          browserSession.sessionId,
          browserSession.refreshTokenExpiresAt
        );
      }

      return res.json({
        user: {
          id: result.user.id,
          email: result.user.email,
          user_metadata: result.user.user_metadata,
        },
        session: browserSession
          ? buildBrowserSessionPayload(browserSession.refreshTokenExpiresAt, browserSession.lastRotatedAt)
          : null,
      });
    } catch (error) {
      logger.error("Login failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });

      if (error instanceof AuthenticationError) {
        recordAuthFailure(req, "login");
        return res.status(401).json({ error: error.message });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/signup",
  authRateLimiter("signup"),
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

      await userProfileDirectoryService.syncProfile(result.user.id);

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

      const browserSession = await browserSessionService.create(result.session);
      browserSessionService.applySessionCookie(
        res,
        browserSession.sessionId,
        browserSession.refreshTokenExpiresAt
      );

      return res.status(201).json({
        user: {
          id: result.user.id,
          email: result.user.email,
          user_metadata: result.user.user_metadata,
        },
        session: buildBrowserSessionPayload(browserSession.refreshTokenExpiresAt, browserSession.lastRotatedAt),
      });
    } catch (error) {
      logger.error("Signup failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });

      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof AuthenticationError) {
        return res.status(409).json({ error: error.message });
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/token",
  authRateLimiter("login"),
  validateRequest(ValidationSchemas.login),
  async (req: Request, res: Response) => {
    try {
      const { email, password, otpCode } = req.body;

      const result = await authService.login({ email, password, otpCode });

      if (!result.session) {
        return res.status(401).json({ error: "Interactive login required" });
      }

      return res.json({
        user: {
          id: result.user.id,
          email: result.user.email,
          user_metadata: result.user.user_metadata,
        },
        token: result.session.access_token,
        expires_at: result.session.expires_at,
        token_type: result.session.token_type ?? "bearer",
        documentation: "Non-browser API clients may request short-lived bearer tokens from /api/auth/token. Browser UI login uses /api/auth/login and receives only a server-managed HttpOnly cookie session.",
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        recordAuthFailure(req, "login");
        return res.status(401).json({ error: error.message });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }

      logger.error("Token issuance failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/password/reset",
  authRateLimiter("passwordReset"),
  validateRequest({
    email: { type: "email" as const, required: true },
  }),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: "Email is required",
        });
      }

      await authService.requestPasswordReset(email);

      logger.info("Password reset requested", {
        email: sanitizeForLogging(email) as string,
      });

      try {
        const resetUser = await getSupabaseAdminAuthAdapter().getUserByEmail(email);
        if (resetUser) {
          await auditLogService.logAudit({
            userId: resetUser.id,
            userName:
              resetUser.user_metadata?.full_name ||
              resetUser.user_metadata?.name ||
              resetUser.email ||
              "User",
            userEmail: resetUser.email || email,
            action: "auth.password_reset_requested",
            resourceType: "auth",
            resourceId: resetUser.id,
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
      return res.json({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      logger.error("Password reset request failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });
      // Don't expose internal errors for security
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/verify/resend",
  authRateLimiter("verifyResend"),
  validateRequest({
    email: { type: "email" as const, required: true },
  }),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const { error } = await getServerSupabase().auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${getConfig().app.url}/auth/callback`,
        },
      });

      if (error) {
        throw new AuthenticationError(sanitizeErrorMessage(error));
      }

      try {
        const verifyUser = await getSupabaseAdminAuthAdapter().getUserByEmail(email);
        if (verifyUser) {
          await auditLogService.logAudit({
            userId: verifyUser.id,
            userName:
              verifyUser.user_metadata?.full_name ||
              verifyUser.user_metadata?.name ||
              verifyUser.email ||
              "User",
            userEmail: verifyUser.email || email,
            action: "auth.verify_resend",
            resourceType: "auth",
            resourceId: verifyUser.id,
            details: {
              ipAddress: req.ip,
            },
            status: "success",
          });
        }
      } catch (auditError) {
        logger.warn("Verification audit lookup failed", { errorMsg: String(auditError) });
      }

      return res.json({ message: "Verification email resent" });
    } catch (error) {
      logger.error("Verification resend failed", error instanceof Error ? error : undefined, {
        errorMsg: String(error),
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/password/update",
  requireAuth,
  requireMFA,
  validateRequest(ValidationSchemas.updatePassword),
  async (req: Request, res: Response) => {
    try {
      const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        error: "New password is required",
      });
    }

    await authService.updatePassword(newPassword);

    logger.info("Password updated successfully", {
      userId: String(sanitizeForLogging(req.user?.id)),
    });

    const actor = resolveActor(req.user);
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

    return res.json({
      message: "Password updated successfully",
    });
  } catch (error) {
    logger.error("Password update failed", error instanceof Error ? error : undefined, {
      errorMsg: String(error),
    });

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = getRequestSessionId(req);
    if (sessionId) {
      await browserSessionService.invalidate(sessionId);
      browserSessionService.clearSessionCookie(res);
    }

    logger.info("User logout successful");

    const actor = resolveActor(req.user);
    if (actor.id) {
      await auditLogService.logAudit({
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
        action: AUDIT_ACTION.AUTH_LOGOUT,
        resourceType: "auth",
        resourceId: actor.id,
        details: {
          ipAddress: req.ip,
        },
        status: "success",
      });
      await emitRequestAuditEvent(req, res, AUDIT_ACTION.AUTH_LOGOUT, "auth.logout", {
        targetUserId: actor.id,
      });
    }

    return res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout failed", error instanceof Error ? error : undefined, {
      errorMsg: String(error),
    });
    // Logout should always succeed on client side
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/session", requireAuth, async (req: Request, res: Response) => {
  try {
    const expiresAt = typeof req.session?.expires_at === "number" ? req.session.expires_at * 1000 : undefined;

    return res.json({
      user: {
        id: req.user?.id,
        email: req.user?.email,
        user_metadata: req.user?.user_metadata,
      },
      session: buildBrowserSessionPayload(expiresAt),
    });
  } catch (error) {
    logger.error("Session retrieval failed", error instanceof Error ? error : undefined, {
      errorMsg: String(error),
    });
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const browserSession = await browserSessionService.resolve(req, res);

    if (!browserSession) {
      return res.status(401).json({ error: "No active session" });
    }

    const verified = await verifyAccessToken(browserSession.record.accessToken, {
      route: req.path,
      method: req.method,
    });

    if (!verified?.user) {
      await browserSessionService.invalidate(browserSession.record.sessionId);
      browserSessionService.clearSessionCookie(res);
      return res.status(401).json({ error: "Session refresh failed" });
    }

    logger.info("Session refresh successful", {
      userId: String(sanitizeForLogging(verified.user.id)),
      rotated: browserSession.rotated,
    });

    return res.json({
      user: {
        id: verified.user.id,
        email: verified.user.email,
        user_metadata: verified.user.user_metadata,
      },
      session: buildBrowserSessionPayload(
        browserSession.record.refreshTokenExpiresAt,
        browserSession.record.lastRotatedAt
      ),
    });
  } catch (error) {
    logger.error("Session refresh failed", error instanceof Error ? error : undefined, {
      errorMsg: String(error),
    });

    if (error instanceof AuthenticationError) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
