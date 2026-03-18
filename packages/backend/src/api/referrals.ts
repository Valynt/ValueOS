/**
 * Referral API Endpoints
 *
 * API endpoints for the referral program:
 * - Generate referral codes
 * - Claim referrals
 * - View referral statistics and rewards
 */

import { createLogger } from "@shared/lib/logger";
import { sanitizeForLogging } from "@shared/lib/piiFilter";
import { Request, Response } from "express";

import { requireAuth } from "../middleware/auth.js"
import { validateRequest } from "../middleware/inputValidation.js"
import { createRateLimiter } from "../middleware/rateLimiter.js"
import { createSecureRouter } from "../middleware/secureRouter.js"
import { auditLogService } from "../services/security/AuditLogService.js"

import { referralService } from "./services/ReferralService.js"


const logger = createLogger({ component: "ReferralAPI" });
const router: ReturnType<typeof createSecureRouter> = createSecureRouter("standard");

// Strict per-IP rate limiter for unauthenticated referral endpoints
// to prevent code enumeration and claim spam
const referralPublicLimiter = createRateLimiter("strict", {
  message: "Too many referral requests. Please try again later.",
});

/**
 * POST /api/referrals/generate
 * Generate or retrieve referral code for authenticated user
 */
router.post("/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await referralService.generateReferralCode(userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logger.info("Referral code generated", {
      userId: sanitizeForLogging(userId) as string,
      code: result.referral_code?.code,
    });

    await auditLogService.logAudit({
      userId,
      userName: (req.user?.user_metadata?.full_name as string) || req.user?.email || "User",
      userEmail: (req.user?.email as string) || "",
      action: "referral.code_generated",
      resourceType: "referral",
      resourceId: (result.referral_code?.id as string) || "",
      details: {
        referralCode: result.referral_code?.code,
        ipAddress: req.ip,
      },
      status: "success",
    });

    return res.json({
      success: true,
      referral_code: result.referral_code,
    });
  } catch (error) {
    logger.error("Failed to generate referral code", error as Error, {
      userId: sanitizeForLogging(req.user?.id) as string,
    });

    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/referrals/claim
 * Claim a referral code (public endpoint)
 */
router.post(
  "/claim",
  referralPublicLimiter,
  validateRequest({
    referral_code: { type: "string", required: true, minLength: 8, maxLength: 8 },
    referee_email: { type: "email", required: true },
  }),
  async (req: Request, res: Response) => {
    try {
      const { referral_code, referee_email } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get("user-agent");

      const result = await referralService.claimReferral({
        referral_code: referral_code.toUpperCase(),
        referee_email,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      logger.info("Referral claimed", {
        referral_id: result.referral_id,
        referrer_id: sanitizeForLogging(result.referrer_id) as string,
        referee_email: sanitizeForLogging(referee_email) as string,
        referral_code: sanitizeForLogging(referral_code) as string,
      });

      // Note: We don't audit log here since user might not be authenticated yet
      // Audit logging will happen when they complete signup

      return res.json({
        success: true,
        referral_id: result.referral_id,
        reward: result.reward,
        message: "Referral claimed successfully! You'll receive your discount when you sign up.",
      });
    } catch (error) {
      logger.error("Failed to claim referral", error as Error, {
        referral_code: sanitizeForLogging(req.body.referral_code) as string,
        referee_email: sanitizeForLogging(req.body.referee_email) as string,
      });

      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /api/referrals/dashboard
 * Get referral dashboard for authenticated user
 */
router.get("/dashboard", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const dashboard = await referralService.getReferralDashboard(userId);

    if (!dashboard) {
      // Try to generate a referral code if none exists
      const codeResult = await referralService.generateReferralCode(userId);
      if (codeResult.success && codeResult.referral_code) {
        const newDashboard = await referralService.getReferralDashboard(userId);
        return res.json({ success: true, dashboard: newDashboard });
      }

      return res.status(404).json({ error: "Referral dashboard not found" });
    }

    logger.info("Referral dashboard retrieved", {
      userId: sanitizeForLogging(userId) as string,
      total_referrals: dashboard.stats.total_referrals,
    });

    return res.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    logger.error("Failed to get referral dashboard", error as Error, {
      userId: sanitizeForLogging(req.user?.id) as string,
    });

    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/referrals/stats
 * Get referral statistics for authenticated user
 */
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const stats = await referralService.getReferralStats(userId);

    if (!stats) {
      return res.status(404).json({ error: "Referral stats not found" });
    }

    logger.info("Referral stats retrieved", {
      userId: sanitizeForLogging(userId) as string,
      completed_referrals: stats.completed_referrals,
    });

    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error("Failed to get referral stats", error as Error, {
      userId: sanitizeForLogging(req.user?.id) as string,
    });

    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/referrals/rewards
 * Get rewards for authenticated user
 */
router.get("/rewards", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const rewards = await referralService.getUserRewards(userId, limit);

    logger.info("Referral rewards retrieved", {
      userId: sanitizeForLogging(userId) as string,
      rewards_count: rewards.length,
    });

    return res.json({
      success: true,
      rewards,
      count: rewards.length,
    });
  } catch (error) {
    logger.error("Failed to get referral rewards", error as Error, {
      userId: sanitizeForLogging(req.user?.id) as string,
    });

    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/referrals/referrals
 * Get referral list for authenticated user
 */
router.get("/referrals", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const referrals = await referralService.getUserReferrals(userId, limit);

    logger.info("User referrals retrieved", {
      userId: sanitizeForLogging(userId) as string,
      referrals_count: referrals.length,
    });

    return res.json({
      success: true,
      referrals,
      count: referrals.length,
    });
  } catch (error) {
    logger.error("Failed to get user referrals", error as Error, {
      userId: sanitizeForLogging(req.user?.id) as string,
    });

    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/referrals/validate
 * Validate a referral code (public endpoint)
 */
router.post(
  "/validate",
  referralPublicLimiter,
  validateRequest({
    code: { type: "string", required: true, minLength: 8, maxLength: 8 },
  }),
  async (req: Request, res: Response) => {
    try {
      const { code } = req.body;

      const isValid = await referralService.validateReferralCode(code.toUpperCase());

      logger.info("Referral code validation", {
        code: sanitizeForLogging(code) as string,
        is_valid: isValid,
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        valid: isValid,
        message: isValid ? "Referral code is valid" : "Invalid or inactive referral code",
      });
    } catch (error) {
      logger.error("Failed to validate referral code", error as Error, {
        code: sanitizeForLogging(req.body.code) as string,
      });

      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/referrals/complete
 * Complete a referral (internal use - when user converts to paying customer)
 * This endpoint should be called by the billing system after successful subscription
 */
router.post(
  "/complete",
  requireAuth,
  validateRequest({
    referral_id: { type: "string", required: true },
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { referral_id } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const success = await referralService.completeReferral(referral_id, userId);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: "Failed to complete referral - invalid referral ID or already completed",
        });
      }

      logger.info("Referral completed", {
        referral_id: sanitizeForLogging(referral_id) as string,
        referee_id: sanitizeForLogging(userId) as string,
      });

      await auditLogService.logAudit({
        userId,
        userName: (req.user?.user_metadata?.full_name as string) || req.user?.email || "User",
        userEmail: (req.user?.email as string) || "",
        action: "referral.completed",
        resourceType: "referral",
        resourceId: referral_id,
        details: {
          ipAddress: req.ip,
        },
        status: "success",
      });

      return res.json({
        success: true,
        message: "Referral completed successfully! Rewards have been issued.",
      });
    } catch (error) {
      logger.error("Failed to complete referral", error as Error, {
        referral_id: sanitizeForLogging(req.body.referral_id) as string,
        user_id: sanitizeForLogging(req.user?.id) as string,
      });

      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * DELETE /api/referrals/deactivate
 * Deactivate user's referral code
 */
router.delete("/deactivate", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const success = await referralService.deactivateReferralCode(userId);

    if (!success) {
      return res.status(400).json({ error: "Failed to deactivate referral code" });
    }

    logger.info("Referral code deactivated", {
      userId: sanitizeForLogging(userId) as string,
    });

    await auditLogService.logAudit({
      userId,
      userName: (req.user?.user_metadata?.full_name as string) || req.user?.email || "User",
      userEmail: (req.user?.email as string) || "",
      action: "referral.code_deactivated",
      resourceType: "referral",
      resourceId: userId,
      details: {
        ipAddress: req.ip,
      },
      status: "success",
    });

    return res.json({
      success: true,
      message: "Referral code deactivated successfully",
    });
  } catch (error) {
    logger.error("Failed to deactivate referral code", error as Error, {
      userId: sanitizeForLogging(req.user?.id) as string,
    });

    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
