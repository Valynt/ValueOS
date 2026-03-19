import { PERMISSIONS } from "@shared/lib/permissions";
import { Request, Response } from "express";
import { z } from "zod";

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
    (value): value is typeof ALL_COMPLIANCE_FRAMEWORKS[number] => complianceFrameworkCapabilityGate.isSupportedFramework(value),
    { message: "Compliance framework prerequisites not met" },
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

    return res.status(201).json({
      report_id: report.report_id,
      evidence_manifest_id: report.evidence_manifest_id,
      signature: report.signature,
      status: report.status,
      declared_capability: report.declared_capability,
      configured_controls: report.configured_controls,
      technically_validated_controls: report.technically_validated_controls,
      missing_evidence: report.missing_evidence,
      retention_summary: report.retention_summary,
      generated_at: report.generated_at,
    });
  } catch (error) {
    if (error instanceof UnsupportedComplianceFrameworkError) {
      return res.status(422).json({
        error: error.message,
        unsupported_frameworks: error.unsupportedFrameworks,
        prerequisite_status: error.capabilityStatus,
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

    return res.status(201).json({
      schedule_id: parsed.data.schedule_id,
      status: report.status,
      report_id: report.report_id,
      evidence_manifest_id: report.evidence_manifest_id,
      signature: report.signature,
      declared_capability: report.declared_capability,
      configured_controls: report.configured_controls,
      technically_validated_controls: report.technically_validated_controls,
      missing_evidence: report.missing_evidence,
    });
  } catch (error) {
    if (error instanceof UnsupportedComplianceFrameworkError) {
      return res.status(422).json({
        error: error.message,
        unsupported_frameworks: error.unsupportedFrameworks,
        prerequisite_status: error.capabilityStatus,
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
    const report = await complianceReportGeneratorService.getReportById(req.params.reportId);

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

  const latestChecks = await complianceControlCheckService.getLatestStatus(tenantId);
  const frameworkCapabilities = complianceFrameworkCapabilityGate
    .getSupportedFrameworks()
    .map((framework) => complianceFrameworkCapabilityGate.getCapabilityStatus(framework));

  return res.json({
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    latest_checks: latestChecks,
    framework_capabilities: frameworkCapabilities,
    retention_summary: complianceControlMappingRegistry.getRetentionSummary(),
  });
});

export default router;
