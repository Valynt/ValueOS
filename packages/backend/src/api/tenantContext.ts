/**
 * Tenant Context API
 *
 * POST /api/v1/tenant/context — ingest company context into semantic memory
 * GET  /api/v1/tenant/context — retrieve the current context summary
 *
 * Both endpoints are tenant-scoped via tenantContextMiddleware.
 * organizationId is always sourced from req.tenantId — never from the request body.
 */

import { createLogger } from "@shared/lib/logger";
import { Request, Response, Router } from "express";

import { auditOperation } from "../middleware/auditHooks.js";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import {
  TenantContextPayloadSchema,
  tenantContextIngestionService,
} from "../services/tenant/TenantContextIngestionService.js";

const logger = createLogger({ component: "TenantContextAPI" });
const router = Router();

router.use(requireAuth);
router.use(tenantContextMiddleware());

// ---------------------------------------------------------------------------
// POST /api/v1/tenant/context
// ---------------------------------------------------------------------------

router.post(
  "/",
  requirePermission("admin"),
  auditOperation("tenant_context_ingested", "tenant_context"),
  async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const parsed = TenantContextPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    }

    try {
      const result = await tenantContextIngestionService.ingest(tenantId, parsed.data);
      logger.info("Tenant context ingested via API", { tenantId, memoryEntries: result.memoryEntries });
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Tenant context ingestion failed", err instanceof Error ? err : new Error(String(err)), { tenantId });
      return res.status(500).json({ error: "Ingestion failed" });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/v1/tenant/context
// ---------------------------------------------------------------------------

router.get(
  "/",
  requirePermission("viewer"),
  async (req: Request, res: Response) => {
    const tenantId = (req as AuthenticatedRequest).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    try {
      const summary = await tenantContextIngestionService.getSummary(tenantId);
      return res.status(200).json({ data: summary });
    } catch (err) {
      logger.error("Failed to fetch tenant context summary", err instanceof Error ? err : new Error(String(err)), { tenantId });
      return res.status(500).json({ error: "Failed to fetch context" });
    }
  },
);

export { router as tenantContextRouter };
