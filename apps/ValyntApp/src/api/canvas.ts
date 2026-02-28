import { Request, Response, Router } from "express";

import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { rateLimiters } from "../middleware/rateLimiter";
import { requestSanitizationMiddleware } from "../middleware/requestSanitizationMiddleware";
import { securityHeadersMiddleware } from "../middleware/securityMiddleware";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { canvasService } from "../services/CanvasService";

const router = Router();

// Apply standard middleware
router.use(securityHeadersMiddleware);
router.use(requireAuth);
router.use(tenantContextMiddleware());
router.use(requestSanitizationMiddleware({ params: { id: { maxLength: 128 } } }));

/**
 * Get canvas by ID
 */
router.get("/:id", rateLimiters.standard, async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = (req as any).tenantId;

  if (!tenantId) {
    return res.status(403).json({
      error: "tenant_required",
      message: "Tenant context is required to access canvas",
    });
  }

  try {
    const canvas = await canvasService.getCanvas(id, tenantId);

    if (!canvas) {
      return res.status(404).json({
        error: "not_found",
        message: "Canvas not found",
      });
    }

    res.json({
      success: true,
      data: canvas,
    });
  } catch (error) {
    logger.error("Failed to get canvas", error instanceof Error ? error : undefined, {
      canvasId: id,
      tenantId,
    });

    res.status(500).json({
      error: "internal_error",
      message: "An error occurred while fetching the canvas",
    });
  }
});

export default router;
