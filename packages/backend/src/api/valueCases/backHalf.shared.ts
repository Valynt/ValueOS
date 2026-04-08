import { Request } from "express";
import { z } from "zod";

import { AuthenticatedRequest } from "../../middleware/auth.js";

export const INTEGRITY_THRESHOLD = 0.6;

export function getTenantId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  return (
    authReq.tenantId ??
    authReq.organizationId ??
    (authReq.user?.tenant_id as string | undefined) ??
    ""
  );
}

export function getCaseId(req: Request): string {
  return (req.params as Record<string, string>)["id"] ?? "";
}

export const RunAgentBodySchema = z
  .object({
    context: z.record(z.unknown()).optional(),
    parameters: z.record(z.unknown()).optional(),
  })
  .strict();

export const PdfExportBodySchema = z
  .object({
    renderUrl: z.string().url(),
    title: z.string().optional(),
  })
  .strict();

export const PptxExportBodySchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    ownerName: z.string().max(255).optional(),
  })
  .strict();

export const AsyncExportBodySchema = z
  .object({
    format: z.enum(["pdf", "pptx"]),
    exportType: z
      .enum(["full", "executive_summary", "financials_only", "hypotheses_only"])
      .optional(),
    title: z.string().min(1).max(255).optional(),
    ownerName: z.string().max(255).optional(),
    renderUrl: z.string().url().optional(),
  })
  .strict();
