/**
 * validateOpportunityAccess middleware
 *
 * Guards all Value Graph API routes that include :opportunityId in the URL.
 * Verifies that the opportunity belongs to the authenticated tenant before
 * any handler logic runs.
 *
 * Must be placed after requireAuth + tenantContextMiddleware +
 * tenantDbContextMiddleware in the middleware chain so that req.tenantId
 * and req.supabase are already populated.
 *
 * On success: attaches req.opportunityId for downstream handlers.
 * On failure: returns 403 without leaking whether the record exists.
 */

import { createLogger } from "@shared/lib/logger";
import type { NextFunction, Request, Response } from "express";

const logger = createLogger({ component: "validateOpportunityAccess" });

export async function validateOpportunityAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { opportunityId } = req.params;

  if (!opportunityId) {
    res.status(400).json({ error: "opportunityId path parameter is required." });
    return;
  }

  const tenantId = req.tenantId;
  const supabase = req.supabase;

  if (!tenantId || !supabase) {
    // tenantContextMiddleware or tenantDbContextMiddleware did not run first
    logger.error("validateOpportunityAccess: missing tenantId or supabase client", {
      hasTenantId: Boolean(tenantId),
      hasSupabase: Boolean(supabase),
      path: req.path,
    });
    res.status(500).json({ error: "Internal server error." });
    return;
  }

  const { data, error } = await supabase
    .from("value_cases")
    .select("tenant_id")
    .eq("id", opportunityId)
    .maybeSingle();

  if (error) {
    logger.error("validateOpportunityAccess: DB query failed", {
      opportunityId,
      error: error.message,
    });
    res.status(500).json({ error: "Internal server error." });
    return;
  }

  if (!data || data.tenant_id !== tenantId) {
    // Return 403 regardless of whether the record exists to avoid enumeration
    res.status(403).json({ error: "Access to this Value Graph is denied." });
    return;
  }

  req.opportunityId = opportunityId;
  next();
}
