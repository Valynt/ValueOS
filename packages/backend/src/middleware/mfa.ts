import { Request, Response, NextFunction } from "express";
import { createLogger } from "@shared/lib/logger";
import { mfaService } from "../services/MFAService.js"
import { sanitizeForLogging } from "@shared/lib/piiFilter";

const logger = createLogger({ component: "MFAMiddleware" });

/**
 * Middleware to require MFA for sensitive operations.
 * If the user has MFA enabled, they must provide a valid code in X-MFA-Code header.
 */
export async function requireMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userId = user.id;
    const isMFAEnabled = await mfaService.hasMFAEnabled(userId);

    if (isMFAEnabled) {
      const mfaCode = req.headers["x-mfa-code"] as string;

      if (!mfaCode) {
        logger.warn("MFA required but code missing", {
           userId: sanitizeForLogging(userId),
           path: sanitizeForLogging(req.path)
        });
        res.status(403).json({
          error: "MFA_REQUIRED",
          message: "Multi-factor authentication code required (X-MFA-Code header)"
        });
        return;
      }

      const isValid = await mfaService.verifyChallenge(userId, mfaCode);
      if (!isValid) {
         logger.warn("Invalid MFA code provided", {
           userId: sanitizeForLogging(userId),
           path: sanitizeForLogging(req.path)
         });
         res.status(403).json({
           error: "INVALID_MFA_CODE",
           message: "Invalid MFA code"
         });
         return;
      }

      logger.debug("MFA verification successful", { userId: sanitizeForLogging(userId) });
    }

    next();
  } catch (error) {
    logger.error("MFA middleware error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
