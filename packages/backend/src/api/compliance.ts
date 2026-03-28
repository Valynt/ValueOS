import { PERMISSIONS } from "@shared/lib/permissions";
import { Request, Response } from "express";
import { z } from "zod";

import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js";
import { complianceControlStatusService } from "../services/integrity/ComplianceControlStatusService.js";
import { complianceReportGeneratorService, MissingEvidenceError } from "../services/integrity/ComplianceReportGeneratorService.js";
import { auditLogService } from "../services/AuditLogService.js";
import { complianceControlCheckService } from "../services/security/ComplianceControlCheckService.js";
import { complianceControlMappingRegistry } from "../services/security/ComplianceControlMappingRegistry.js";
import {
  ALL_COMPLIANCE_FRAMEWORKS,
  complianceFrameworkCapabilityGate,
  UnsupportedComplianceFrameworkError,
} from "../services/security/ComplianceFrameworkCapabilityGate.js";

const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware(), tenantDbContextMiddleware());

const complianceFrameworkSchema = z
  .string()
  .refine(
    (value): value is typeof ALL_COMPLIANCE_FRAMEWORKS[number] => complianceFrameworkCapabilityGate.isKnownFramework(value),
    { message: "Unsupported compliance framework" },
  );

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
  return req.tenantId ?? null;
}

function getActorId(req: Request): string {
  return req.user?.id ?? req.user?.sub ?? "system";
}

async function getFrameworkModeStatuses(tenantId: string) {
  const statuses = await complianceFrameworkCapabilityGate.getCapabilityStatuses(tenantId);
  return statuses.map((status) => ({
    framework: status.framework,
    availability: status.availability,
    selectable: status.supported,
    declared: status.declared,
    verified: status.verified,
    prerequisites_met: status.prerequisites_met,
    gate_label: status.gate_label,
    required_signals: status.required_signals,
    signal_statuses: status.signal_statuses,
    missing_prerequisites: status.missingPrerequisites,
  }));
}

router.get("/control-status", requirePermission(PERMISSIONS.COMPLIANCE_READ), async (req: Request, res: Response) => {
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

router.post("/reports/generate", requirePermission(PERMISSIONS.COMPLIANCE_READ), async (req: Request, res: Response) => {
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

    const frameworkStatuses = (await complianceFrameworkCapabilityGate.getCapabilityStatuses(tenantId))
      .filter((status) => parsed.data.frameworks.includes(status.framework))
      .map((status) => ({
        framework: status.framework,
        declared: status.declared,
        verified: status.verified,
        missing_prerequisites: status.missingPrerequisites,
        required_signals: status.required_signals,
      }));

    return res.status(201).json({
      report_id: report.report_id,
      evidence_manifest_id: report.evidence_manifest_id,
      status: report.status,
      signature: report.signature,
      declared_capability: report.declared_capability,
      configured_controls: report.configured_controls,
      technically_validated_controls: report.technically_validated_controls,
      framework_breakdown: report.framework_breakdown,
      framework_statuses: frameworkStatuses,
      missing_evidence: report.missing_evidence,
      retention_summary: report.retention_summary,
      generated_at: report.generated_at,
    });
  } catch (error) {
    if (error instanceof UnsupportedComplianceFrameworkError) {
      return res.status(422).json({
        error: error.message,
        unsupported_frameworks: error.unsupportedFrameworks,
        prerequisite_status: error.prerequisiteStatus,
        capability_status: error.capabilityStatus,
      });
    }
    if (error instanceof MissingEvidenceError) {
      return res.status(422).json({ error: error.message, missing_evidence: error.missingEvidence });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate report" });
  }
});

router.post("/reports/scheduled", requirePermission(PERMISSIONS.COMPLIANCE_READ), async (req: Request, res: Response) => {
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

    const frameworkStatuses = (await complianceFrameworkCapabilityGate.getCapabilityStatuses(tenantId))
      .filter((status) => parsed.data.frameworks.includes(status.framework))
      .map((status) => ({
        framework: status.framework,
        declared: status.declared,
        verified: status.verified,
        missing_prerequisites: status.missingPrerequisites,
        required_signals: status.required_signals,
      }));

    return res.status(201).json({
      schedule_id: parsed.data.schedule_id,
      status: "generated",
      report_id: report.report_id,
      evidence_manifest_id: report.evidence_manifest_id,
      report_status: report.status,
      signature: report.signature,
      declared_capability: report.declared_capability,
      configured_controls: report.configured_controls,
      technically_validated_controls: report.technically_validated_controls,
      framework_breakdown: report.framework_breakdown,
      framework_statuses: frameworkStatuses,
      missing_evidence: report.missing_evidence,
      retention_summary: report.retention_summary,
    });
  } catch (error) {
    if (error instanceof UnsupportedComplianceFrameworkError) {
      return res.status(422).json({
        error: error.message,
        unsupported_frameworks: error.unsupportedFrameworks,
        prerequisite_status: error.prerequisiteStatus,
        capability_status: error.capabilityStatus,
      });
    }
    if (error instanceof MissingEvidenceError) {
      return res.status(422).json({ error: error.message, missing_evidence: error.missingEvidence });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate scheduled report" });
  }
});

router.post("/reports/:reportId/download", requirePermission(PERMISSIONS.COMPLIANCE_READ), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  try {
    const report = await (complianceReportGeneratorService as unknown as { getReportById(id: string): Promise<unknown> }).getReportById(req.params.reportId);

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    if ((report as { tenant_id?: string; tenantId?: string }).tenant_id !== tenantId &&
        (report as { tenant_id?: string; tenantId?: string }).tenantId !== tenantId) {
      return res.status(403).json({ error: "Forbidden: report does not belong to this tenant" });
    }

    await complianceReportGeneratorService.auditDownloadAccess(tenantId, req.params.reportId, getActorId(req));
    return res.status(202).json({
      report_id: req.params.reportId,
      download_audit_logged: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to log report download",
    });
  }
});

router.get("/stream", requirePermission(PERMISSIONS.COMPLIANCE_READ), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let closed = false;
  const interval = setInterval(() => void push(), 30_000);

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(interval);
    res.end();
  };

  const push = async () => {
    if (closed) return;
    try {
      const controls = await complianceControlStatusService.refreshControlStatus(tenantId);
      // Guard again: client may have disconnected during the async DB query.
      if (closed) return;
      const payload = {
        type: "control_status_updated",
        generated_at: new Date().toISOString(),
        summary: complianceControlStatusService.summarize(controls),
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      logger.error("Error in /compliance/stream SSE push", {
        tenantId,
        method: req.method,
        url: req.originalUrl,
        error: err,
      });
      cleanup();
    }
  };

  await push();

  req.on("close", cleanup);
  res.on("error", cleanup);
});


router.get("/control-checks/status", requirePermission("system.admin"), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const latest = await complianceControlCheckService.getLatestStatus(tenantId);
  if (!latest) {
    const computed = await complianceControlCheckService.runChecksForTenant(tenantId, "manual");
    return res.json(computed);
  }

  return res.json(latest);
});

router.get("/audit-logs", requirePermission(PERMISSIONS.COMPLIANCE_READ), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const limit = Number(req.query.limit ?? 25);
  const logs = await auditLogService.query({ tenantId, limit });
  return res.json({ logs });
});

router.get("/policy-history", requirePermission(PERMISSIONS.COMPLIANCE_READ), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  const history = await complianceControlStatusService.getPolicyHistory(tenantId);
  return res.json({ history });
});

router.get("/retention", requirePermission(PERMISSIONS.COMPLIANCE_READ), (req: Request, res: Response) => {
  const frameworks = typeof req.query.frameworks === "string"
    ? req.query.frameworks.split(",").map((value) => value.trim()).filter((value): value is z.infer<typeof complianceFrameworkSchema> => complianceFrameworkSchema.safeParse(value).success)
    : undefined;

  return res.json({
    rules: complianceControlMappingRegistry.getRetentionSummary(frameworks),
    supported_frameworks: ALL_COMPLIANCE_FRAMEWORKS,
  });
});

router.get("/dsr", requirePermission(PERMISSIONS.COMPLIANCE_READ), (_req: Request, res: Response) => {
  return res.json({
    queue: [
      { id: "dsr-001", request_type: "access", subject_ref: "subject:hashed:28fd", status: "in_progress", submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(), due_at: new Date(Date.now() + 28 * 86400000).toISOString() },
      { id: "dsr-002", request_type: "erasure", subject_ref: "subject:hashed:a7bc", status: "queued", submitted_at: new Date(Date.now() - 86400000).toISOString(), due_at: new Date(Date.now() + 29 * 86400000).toISOString() },
    ],
  });
});

router.get("/mode", requirePermission(PERMISSIONS.COMPLIANCE_READ), async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  return res.json({
    tenant_id: tenantId,
    active_modes: await complianceFrameworkCapabilityGate.getExposedFrameworks(tenantId),
    framework_statuses: await getFrameworkModeStatuses(tenantId),
    strict_enforcement: true,
    last_changed_at: new Date().toISOString(),
  });
});

export default router;
