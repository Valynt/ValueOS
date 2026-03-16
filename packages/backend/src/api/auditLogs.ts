/**
 * GET /api/v1/audit-logs
 *
 * Tenant-scoped, paginated audit log query for admin users.
 * Requires admin:audit permission. Cross-tenant reads return 403.
 */

import { Request, Response } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { auditLogService } from "../services/security/AuditLogService.js";

const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware());

const querySchema = z.object({
  action: z.string().optional(),
  resource_type: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(), // ISO timestamp used as cursor for keyset pagination
});

router.get(
  "/",
  requirePermission("admin:audit"),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
    }

    const { action, resource_type, start_date, end_date, limit, cursor } = parsed.data;

    let entries;
    try {
      entries = await auditLogService.query({
        tenantId,
        action,
        resourceType: resource_type,
        startDate: cursor ?? start_date,
        endDate: end_date,
        limit: limit + 1, // fetch one extra to determine if there is a next page
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to query audit logs" });
    }

    const hasNextPage = entries.length > limit;
    const page = hasNextPage ? entries.slice(0, limit) : entries;
    const nextCursor = hasNextPage ? page[page.length - 1]?.timestamp : undefined;

    return res.json({
      data: page,
      pagination: {
        limit,
        has_next_page: hasNextPage,
        next_cursor: nextCursor ?? null,
      },
    });
  }
);

export { router as auditLogsRouter };
