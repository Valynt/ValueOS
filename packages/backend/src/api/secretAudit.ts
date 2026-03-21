import { Request, Response, Router } from "express";
import { z } from "zod";

import { StructuredSecretAuditLogger } from "../config/secrets/SecretAuditLogger.js";
import { asyncHandler } from "../middleware/globalErrorHandler";

const router = Router();
const auditLogger = new StructuredSecretAuditLogger();

const secretAuditSchema = z.object({
  tenantId: z.string().min(1),
  secretKey: z.string().min(1).max(1024),
  action: z.enum(["READ", "WRITE", "ROTATE", "DELETE", "LIST"]),
  result: z.enum(["SUCCESS", "FAILURE"]),
  userId: z.string().min(1).optional(),
  error: z.string().min(1).max(2048).optional(),
  reason: z.string().min(1).max(2048).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

router.post(
  "/secrets/audit",
  asyncHandler(async (req: Request, res: Response) => {
    const payload = secretAuditSchema.parse(req.body);
    const requestTenantId = req.tenantId;
    const requestUserId = req.user?.id;

    if (!requestTenantId || requestTenantId !== payload.tenantId) {
      res.status(403).json({
        error: {
          code: "TENANT_MISMATCH",
          message: "Secret audit events must use the authenticated tenant context.",
        },
      });
      return;
    }

    const event = {
      ...payload,
      userId: payload.userId ?? requestUserId,
    };

    if (payload.reason) {
      await auditLogger.logDenied({
        ...event,
        reason: payload.reason,
      });
    } else if (payload.action === "ROTATE") {
      await auditLogger.logRotation(event);
    } else {
      await auditLogger.logAccess(event);
    }

    res.status(202).json({ success: true });
  })
);

export { router as secretAuditRouter };
