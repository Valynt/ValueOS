import type { NextFunction, Request, Response } from "express";
import { getRequestSupabaseClient } from "@shared/lib/supabase";

import { createLogger } from "../lib/logger.js";
import { securityAuditService } from "../services/post-v1/SecurityAuditService.js";

const logger = createLogger({ component: "billingAccessEnforcement" });

const DEFAULT_WHITELIST = [
  /^\/health(?:\/|$)/,
  /^\/api\/health(?:\/|$)/,
  /^\/api\/billing\/payment-methods\/portal(?:\/|$)/,
  /^\/api\/billing\/portal(?:\/|$)/,
  /^\/api\/workflow\/support(?:\/|$)/,
];

export interface BillingAccessEnforcementOptions {
  whitelist?: RegExp[];
}

function isWhitelistedPath(pathname: string, whitelist: RegExp[]): boolean {
  return whitelist.some((matcher) => matcher.test(pathname));
}

async function auditDecision(
  req: Request,
  decision: "allow" | "deny",
  tenantId: string,
  context: Record<string, unknown>
): Promise<void> {
  await securityAuditService.logRequestEvent({
    requestId: req.requestId ?? `billing-enforcement-${Date.now()}`,
    userId: req.user?.id,
    actor: req.user?.id ?? "system",
    action: `billing_access_${decision}`,
    resource: "tenant_billing_enforcement",
    requestPath: req.originalUrl,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    statusCode: decision === "deny" ? 402 : 200,
    severity: decision === "deny" ? "high" : "low",
    eventType: "billing.access.enforcement",
    eventData: {
      tenant_id: tenantId,
      ...context,
    },
  });
}

export function createBillingAccessEnforcement(
  options: BillingAccessEnforcementOptions = {}
) {
  const whitelist = options.whitelist ?? DEFAULT_WHITELIST;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isWhitelistedPath(req.originalUrl, whitelist)) {
      return next();
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      return next();
    }
    const supabase = getRequestSupabaseClient(req);

    const { data, error } = await supabase
      .from("tenants")
      .select("access_mode, grace_period_enforcement, grace_period_expires_at")
      .eq("id", tenantId)
      .single();

    if (error) {
      logger.warn("Unable to load tenant access enforcement state", {
        tenantId,
        code: error.code,
        message: error.message,
      });
      return next();
    }

    const accessMode = data?.access_mode ?? "full_access";
    const graceEnforced = Boolean(data?.grace_period_enforcement);
    const graceExpiry = data?.grace_period_expires_at
      ? new Date(data.grace_period_expires_at as string)
      : null;
    const isGraceExpired = graceExpiry ? graceExpiry.getTime() <= Date.now() : false;
    const restricted = accessMode === "restricted" || (graceEnforced && isGraceExpired);

    if (restricted) {
      await auditDecision(req, "deny", tenantId, {
        access_mode: accessMode,
        grace_period_enforcement: graceEnforced,
        grace_period_expires_at: data?.grace_period_expires_at ?? null,
      });

      res.status(402).json({
        success: false,
        error: {
          code: "BILLING_ACCESS_RESTRICTED",
          message: "Access restricted due to unresolved billing issues.",
        },
      });
      return;
    }

    await auditDecision(req, "allow", tenantId, {
      access_mode: accessMode,
      grace_period_enforcement: graceEnforced,
    });

    next();
  };
}
