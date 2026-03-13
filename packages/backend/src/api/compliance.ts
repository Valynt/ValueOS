import { Request, Response } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js";
import { auditLogService } from "../services/AuditLogService.js";
import { complianceControlStatusService } from "../services/ComplianceControlStatusService.js";
import { complianceReportGeneratorService, MissingEvidenceError } from "../services/ComplianceReportGeneratorService.js";
import { complianceControlMappingRegistry } from "../services/security/ComplianceControlMappingRegistry.js";

const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware(), tenantDbContextMiddleware());

const complianceFrameworkSchema = z.enum(["GDPR", "HIPAA", "CCPA", "SOC2", "ISO27001"]);

const generateReportSchema = z.object({
  frameworks: z.array(complianceFrameworkSchema).min(1),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  strict: z.boolean().optional(),
});

const scheduleReportSchema = z.object({
  frameworks: z.array(complianceFrameworkSchema).min(1),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  schedule_id: z.string().min(1),
  run_now: z.boolean().default(true),
  strict: z.boolean().optional(),
});

function getTenantId(req: Request): string | null {
  const tenantId = (req as { tenantId?: string }).tenantId;
  return tenantId ?? null;
}

function getActorId(req: Request): string {
  const user = req.user as { id?: string; sub?: string } | undefined;
  return user?.id ?? user?.sub ?? "system";
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

router.post("/reports/generate", requirePermission("users.read"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const parsed = generateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid report request", details: parsed.error.flatten() });
  }

  try {
    const report = await complianceReportGeneratorService.generateReport({
      tenantId,
      frameworks: parsed.data.frameworks,
      startAt: parsed.data.start_at,
      endAt: parsed.data.end_at,
      generatedBy: getActorId(req),
      mode: "on_demand",
      strict: parsed.data.strict,
    });

    return res.status(201).json({
      report_id: report.report_id,
      evidence_manifest_id: report.evidence_manifest_id,
      signature: report.signature,
      missing_evidence: report.missing_evidence,
      retention_summary: report.retention_summary,
      generated_at: report.generated_at,
    });
  } catch (error) {
    if (error instanceof MissingEvidenceError) {
      return res.status(422).json({ error: error.message, missing_evidence: error.missingEvidence });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate report" });
  }
});

router.post("/reports/scheduled", requirePermission("users.read"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const parsed = scheduleReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid schedule payload", details: parsed.error.flatten() });
  }

  await auditLogService.createEntry({
    userId: getActorId(req),
    userName: getActorId(req),
    userEmail: "system@valueos.local",
    action: "compliance:report_schedule_created",
    resourceType: "compliance_schedule",
    resourceId: parsed.data.schedule_id,
    details: {
      tenant_id: tenantId,
      frameworks: parsed.data.frameworks,
      start_at: parsed.data.start_at,
      end_at: parsed.data.end_at,
      strict: parsed.data.strict ?? true,
    },
    status: "success",
  });

  if (!parsed.data.run_now) {
    return res.status(202).json({
      schedule_id: parsed.data.schedule_id,
      status: "queued",
      run_now: false,
    });
  }

  try {
    const report = await complianceReportGeneratorService.generateReport({
      tenantId,
      frameworks: parsed.data.frameworks,
      startAt: parsed.data.start_at,
      endAt: parsed.data.end_at,
      generatedBy: getActorId(req),
      mode: "scheduled",
      strict: parsed.data.strict,
    });

    return res.status(201).json({
      schedule_id: parsed.data.schedule_id,
      status: "generated",
      report_id: report.report_id,
      evidence_manifest_id: report.evidence_manifest_id,
      signature: report.signature,
    });
  } catch (error) {
    if (error instanceof MissingEvidenceError) {
      return res.status(422).json({ error: error.message, missing_evidence: error.missingEvidence });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate scheduled report" });
  }
});

router.post("/reports/:reportId/download", requirePermission("users.read"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  await complianceReportGeneratorService.auditDownloadAccess(tenantId, req.params.reportId, getActorId(req));
  return res.status(202).json({
    report_id: req.params.reportId,
    download_audit_logged: true,
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

router.get("/retention", requirePermission("users.read"), (req: Request, res: Response) => {
  const frameworks = typeof req.query.frameworks === "string"
    ? req.query.frameworks.split(",").map((value) => value.trim()).filter((value): value is z.infer<typeof complianceFrameworkSchema> => complianceFrameworkSchema.safeParse(value).success)
    : undefined;

  return res.json({
    rules: complianceControlMappingRegistry.getRetentionSummary(frameworks),
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
