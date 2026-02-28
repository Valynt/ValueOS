/**
 * Document Upload API
 *
 * Enforces lineage metadata for knowledge base ingestion and RAG.
 */

import { logger } from "@shared/lib/logger";
import { Request, Response, Router } from "express";

import {
  contentTypeValidationMiddleware,
  fileUploadSecurityMiddleware,
} from "../middleware/fileUploadSecurity.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  csrfProtectionMiddleware,
  securityHeadersMiddleware,
} from "../middleware/securityMiddleware";
import { serviceIdentityMiddleware } from "../middleware/serviceIdentityMiddleware.js";

interface LineageMetadata {
  source_origin: string;
  data_sensitivity_level: string;
  [key: string]: any;
}

const router = Router();
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
router.use(requirePermission("data.import"));

router.post(
  "/upload",
  rateLimiters.standard,
  contentTypeValidationMiddleware,
  fileUploadSecurityMiddleware(),
  csrfProtectionMiddleware,
  async (req: Request, res: Response) => {
    const { documentId, metadata } = req.body as {
      documentId?: string;
      content?: string;
      metadata?: LineageMetadata;
    };

    const sourceOrigin = metadata?.source_origin?.trim();
    const sensitivity = metadata?.data_sensitivity_level?.trim();

    if (!sourceOrigin || !sensitivity) {
      return res.status(400).json({
        error: "Invalid lineage metadata",
        message: "source_origin and data_sensitivity_level are required for uploads.",
      });
    }

    if (sourceOrigin.toLowerCase() === "unknown" || sensitivity.toLowerCase() === "unknown") {
      return res.status(400).json({
        error: "Invalid lineage metadata",
        message: "Lineage metadata cannot be marked as unknown.",
      });
    }

    logger.info("Knowledge document upload accepted", {
      documentId: documentId || "untracked",
      lineage: {
        source_origin: sourceOrigin,
        data_sensitivity_level: sensitivity,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        documentId: documentId || "untracked",
        lineage: {
          source_origin: sourceOrigin,
          data_sensitivity_level: sensitivity,
        },
        evidence_log: `Lineage recorded: ${sourceOrigin} (sensitivity: ${sensitivity})`,
      },
    });
  }
);

export default router;
