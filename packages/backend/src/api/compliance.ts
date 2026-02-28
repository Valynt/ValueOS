import { Request, Response } from "express";

import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js";
import { auditLogService } from "../services/AuditLogService.js";
import { complianceControlStatusService } from "../services/ComplianceControlStatusService.js";

const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware(), tenantDbContextMiddleware());

function getTenantId(req: Request): string | null {
  const tenantId = (req as { tenantId?: string }).tenantId;
  return tenantId ?? null;
}

router.get("/control-status", requirePermission("users.read"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const controls = await complianceControlStatusService.getLatestControlStatus(tenantId);
  const now = Date.now();

  return res.json({
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    summary: complianceControlStatusService.summarize(controls),
    controls: controls.map((control) => ({
      ...control,
      evidence_recency_minutes: Math.max(0, (now - new Date(control.evidence_ts).getTime()) / 60000),
    })),
  });
});

router.get("/stream", requirePermission("users.read"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const push = async () => {
    const controls = await complianceControlStatusService.refreshControlStatus(tenantId);
    const payload = {
      type: "control_status_updated",
      generated_at: new Date().toISOString(),
      summary: complianceControlStatusService.summarize(controls),
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  await push();
  const interval = setInterval(() => {
    void push();
  }, 30000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

router.get("/audit-logs", requirePermission("users.read"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const limit = Number(req.query.limit ?? 25);
  const logs = await auditLogService.query({ tenantId, limit });
  return res.json({ logs });
});

router.get("/policy-history", requirePermission("users.read"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const history = await complianceControlStatusService.getPolicyHistory(tenantId);
  return res.json({ history });
});

router.get("/retention", requirePermission("users.read"), (_req: Request, res: Response) => {
  return res.json({
    rules: [
      { id: "logs", data_class: "Audit Logs", retention_days: 2555, legal_hold: true, last_reviewed_at: new Date().toISOString() },
      { id: "security-events", data_class: "Security Events", retention_days: 365, legal_hold: false, last_reviewed_at: new Date().toISOString() },
      { id: "dsr", data_class: "DSR Cases", retention_days: 1095, legal_hold: true, last_reviewed_at: new Date().toISOString() },
    ],
  });
});

router.get("/dsr", requirePermission("users.read"), (_req: Request, res: Response) => {
  return res.json({
    queue: [
      { id: "dsr-001", request_type: "access", subject_ref: "subject:hashed:28fd", status: "in_progress", submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(), due_at: new Date(Date.now() + 28 * 86400000).toISOString() },
      { id: "dsr-002", request_type: "erasure", subject_ref: "subject:hashed:a7bc", status: "queued", submitted_at: new Date(Date.now() - 86400000).toISOString(), due_at: new Date(Date.now() + 29 * 86400000).toISOString() },
    ],
  });
});

router.get("/mode", requirePermission("users.read"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  return res.json({
    tenant_id: tenantId,
    active_modes: ["SOC2", "GDPR"],
    strict_enforcement: true,
    last_changed_at: new Date().toISOString(),
  });
});

export default router;
