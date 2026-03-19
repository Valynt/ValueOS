/**
 * Data Subject Request (DSR) API
 *
 * GDPR Article 15/17 compliance endpoints for data export and erasure.
 * Restricted to admin users with the `users.delete` permission.
 */

import { createHash } from "crypto";

import { createLogger } from "@shared/lib/logger";
import { Request, Response } from "express";

import { type AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { createSecureRouter } from "../middleware/secureRouter";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { dataSubjectRequestAdminService } from "../services/privacy/DataSubjectRequestAdminService";

const logger = createLogger({ component: "DSR-API" });
const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware());

function hashEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

router.post(
  "/export",
  requirePermission("users.delete"),
  async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
    const actorId = (req as AuthenticatedRequest & { userId?: string }).userId as string | undefined;
    const requestId = (req as AuthenticatedRequest & { requestId?: string }).requestId as string | undefined ?? "unknown";

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }
    if (!actorId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const emailHash = hashEmail(email);

    try {
      const result = await dataSubjectRequestAdminService.exportUserData({
        email,
        tenantId,
        actorId,
        requestId,
      });

      if (result.notFound) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      return res.json({
        request_type: "export",
        email,
        exported_at: result.exportedAt,
        data: result.footprint,
        pii_assets_included: result.coverage.included,
        pii_assets_excluded: result.coverage.excluded,
      });
    } catch (err) {
      logger.error("DSR export failed", err instanceof Error ? err : undefined, { emailHash });
      return res.status(500).json({ error: "Export failed" });
    }
  },
);

router.post(
  "/erase",
  requirePermission("users.delete"),
  async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;
    const actorId = (req as AuthenticatedRequest & { userId?: string }).userId as string | undefined;
    const requestId = (req as AuthenticatedRequest & { requestId?: string }).requestId as string | undefined ?? "unknown";

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }
    if (!actorId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const emailHash = hashEmail(email);

    try {
      const result = await dataSubjectRequestAdminService.eraseUserData({
        email,
        tenantId,
        actorId,
        requestId,
      });

      if (result.notFound) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      return res.json({
        request_type: "erase",
        email,
        anonymized_to: result.placeholderEmail,
        erased_at: result.anonymizedAt,
        pii_assets_included: result.coverage.included,
        pii_assets_excluded: result.coverage.excluded,
      });
    } catch (err) {
      logger.error("DSR erasure failed", err instanceof Error ? err : undefined, { emailHash });
      return res.status(500).json({ error: "Erasure failed" });
    }
  },
);

router.post(
  "/status",
  requirePermission("users.delete"),
  async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    const tenantId = (req as AuthenticatedRequest).tenantId as string | undefined;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const emailHash = hashEmail(email);

    try {
      const result = await dataSubjectRequestAdminService.getStatus({ email, tenantId });
      if (result.notFound) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      const summary = Object.fromEntries(
        Object.entries(result.footprint).map(([table, rows]) => [table, rows.length]),
      );

      return res.json({
        email,
        user_id: result.userId,
        record_counts: summary,
        pii_assets_included: result.coverage.included,
        pii_assets_excluded: result.coverage.excluded,
      });
    } catch (err) {
      logger.error("DSR status failed", err instanceof Error ? err : undefined, { emailHash });
      return res.status(500).json({ error: "Status check failed" });
    }
  },
);

export default router;
