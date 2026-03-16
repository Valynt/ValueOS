/**
 * Data Subject Request (DSR) API
 *
 * GDPR Article 15/17 compliance endpoints for data export and erasure.
 * Restricted to admin users with the `users.delete` permission.
 */

import { createHash } from "crypto";

import { createLogger } from "@shared/lib/logger";
import { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.js";

import { createServerSupabaseClient } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { getDsrMappedPiiAssets } from "../observability/dataAssetInventoryRegistry.js";

const logger = createLogger({ component: "DSR-API" });
const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware());

const DSR_PII_ASSETS = getDsrMappedPiiAssets();

interface DsrAssetCoverage {
  included: string[];
  excluded: Array<{ asset: string; reason: string }>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** One-way hash for PII identifiers used in logs and audit records. */
function hashEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

async function resolveUserId(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  email: string,
  tenantId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data?.id ?? null;
}

async function gatherFootprint(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  tenantId: string,
) {
  const footprint: Record<string, unknown[]> = {};
  const coverage: DsrAssetCoverage = { included: [], excluded: [] };

  for (const entry of DSR_PII_ASSETS) {
    const { asset, dsr } = entry;
    if (!dsr.exportable || !dsr.userColumn || !dsr.tenantColumn) {
      coverage.excluded.push({ asset, reason: "not_exportable" });
      continue;
    }

    const { data, error } = await supabase
      .from(asset)
      .select("*")
      .eq(dsr.userColumn, userId)
      .eq(dsr.tenantColumn, tenantId);

    if (error) {
      logger.warn(`DSR: failed to read ${asset}`, { error: error.message });
      footprint[asset] = [];
      coverage.excluded.push({ asset, reason: `read_error:${error.code ?? "unknown"}` });
    } else {
      footprint[asset] = data ?? [];
      coverage.included.push(asset);
    }
  }

  return { footprint, coverage };
}

async function auditDsr(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  action: string,
  actorId: string,
  targetEmail: string,
  tenantId: string,
  requestId: string,
  details: Record<string, unknown> = {},
) {
  const eventData = {
    target_email_hash: hashEmail(targetEmail),
    ...details,
  };
  // Immutable checksum over the canonical event fields for forensic integrity.
  const checksum = createHash("sha256")
    .update(JSON.stringify({ action, actorId, tenantId, requestId, eventData }))
    .digest("hex");

  const { error: insertError } = await supabase.from("security_audit_log").insert({
    event_type: `dsr_${action}`,
    actor: actorId,
    action,
    resource: "dsr",
    request_path: "/api/dsr",
    severity: "high",
    tenant_id: tenantId,
    request_id: requestId,
    event_data: { ...eventData, checksum },
  });

  if (insertError) {
    throw new Error(`DSR audit insert failed: ${insertError.message} (code: ${insertError.code})`);
  }
}

// ── routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/dsr/export
 * Export all PII for a given user (GDPR Art. 15 — right of access).
 */
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
      const supabase = createServerSupabaseClient();
      const userId = await resolveUserId(supabase, email, tenantId);

      if (!userId) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      const { footprint, coverage } = await gatherFootprint(supabase, userId, tenantId);

      try {
        await auditDsr(supabase, "export", actorId, email, tenantId, requestId, {
          tables: Object.keys(footprint),
          pii_assets_included: coverage.included,
          pii_assets_excluded: coverage.excluded,
        });
      } catch (auditErr) {
        // Audit failure must not suppress a completed operation. Log for out-of-band remediation.
        logger.error("DSR audit write failed", auditErr instanceof Error ? auditErr : undefined, {
          emailHash, tenantId, requestId, action: "export",
        });
      }

      logger.info("DSR export completed", { emailHash, tenantId });

      return res.json({
        request_type: "export",
        email,
        exported_at: new Date().toISOString(),
        data: footprint,
        pii_assets_included: coverage.included,
        pii_assets_excluded: coverage.excluded,
      });
    } catch (err) {
      logger.error("DSR export failed", err instanceof Error ? err : undefined, { emailHash });
      return res.status(500).json({ error: "Export failed" });
    }
  },
);

/**
 * POST /api/dsr/erase
 * Anonymize/delete all PII for a given user (GDPR Art. 17 — right to erasure).
 */
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
      const supabase = createServerSupabaseClient();
      const userId = await resolveUserId(supabase, email, tenantId);

      if (!userId) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      const placeholderEmail = `deleted+${userId}@redacted.local`;
      const redactedTs = new Date().toISOString();

      // 1. Anonymize user profile (scoped to tenant)
      await supabase
        .from("users")
        .update({
          email: placeholderEmail,
          full_name: null,
          display_name: null,
          avatar_url: null,
          metadata: { anonymized: true, anonymized_at: redactedTs },
        })
        .eq("id", userId)
        .eq("tenant_id", tenantId);

      // 2. Scrub content in related tables (scoped to tenant)
      const scrubbed = { content: "[redacted]", metadata: { anonymized: true, redacted_at: redactedTs } };
      await supabase.from("messages").update(scrubbed).eq("user_id", userId).eq("tenant_id", tenantId);
      await supabase.from("cases").update({ description: "[redacted]" }).eq("user_id", userId).eq("tenant_id", tenantId);
      await supabase.from("agent_memory").update({ content: "[redacted]" }).eq("user_id", userId).eq("tenant_id", tenantId);

      const coverage: DsrAssetCoverage = {
        included: ["users", "messages", "cases", "agent_memory"],
        excluded: [],
      };

      const deleteAssets = DSR_PII_ASSETS.filter(
        (entry) => entry.dsr.erasure === "delete" && entry.dsr.userColumn && entry.dsr.tenantColumn,
      );

      for (const entry of deleteAssets) {
        const table = entry.asset;
        const userColumn = entry.dsr.userColumn;
        const tenantColumn = entry.dsr.tenantColumn;
        if (!userColumn || !tenantColumn) {
          coverage.excluded.push({ asset: table, reason: "missing_dsr_columns" });
          continue;
        }

        const { error: delErr } = await supabase
          .from(table)
          .delete()
          .eq(userColumn, userId)
          .eq(tenantColumn, tenantId);
        if (delErr) {
          logger.warn(`DSR erase: failed to delete from ${table}`, {
            error: delErr.message,
            emailHash,
            tenantId,
          });
          coverage.excluded.push({ asset: table, reason: `delete_error:${delErr.code ?? "unknown"}` });
          continue;
        }

        coverage.included.push(table);
      }

      for (const entry of DSR_PII_ASSETS) {
        if (entry.dsr.erasure === "none") {
          coverage.excluded.push({ asset: entry.asset, reason: "not_erasable" });
        }
      }

      try {
        await auditDsr(supabase, "erase", actorId, email, tenantId, requestId, {
          anonymized_to: placeholderEmail,
          tables_scrubbed: coverage.included,
          pii_assets_included: coverage.included,
          pii_assets_excluded: coverage.excluded,
        });
      } catch (auditErr) {
        // Audit failure must not suppress a completed operation. Log for out-of-band remediation.
        logger.error("DSR audit write failed", auditErr instanceof Error ? auditErr : undefined, {
          emailHash, tenantId, requestId, action: "erase",
        });
      }

      logger.info("DSR erasure completed", { emailHash, tenantId });

      return res.json({
        request_type: "erase",
        email,
        anonymized_to: placeholderEmail,
        erased_at: redactedTs,
        pii_assets_included: coverage.included,
        pii_assets_excluded: coverage.excluded,
      });
    } catch (err) {
      logger.error("DSR erasure failed", err instanceof Error ? err : undefined, { emailHash });
      return res.status(500).json({ error: "Erasure failed" });
    }
  },
);

/**
 * POST /api/dsr/status
 * Check what data exists for a user (locate).
 */
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
      const supabase = createServerSupabaseClient();
      const userId = await resolveUserId(supabase, email, tenantId);

      if (!userId) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      const { footprint, coverage } = await gatherFootprint(supabase, userId, tenantId);
      const summary = Object.fromEntries(
        Object.entries(footprint).map(([table, rows]) => [table, (rows as unknown[]).length]),
      );

      return res.json({
        email,
        user_id: userId,
        record_counts: summary,
        pii_assets_included: coverage.included,
        pii_assets_excluded: coverage.excluded,
      });
    } catch (err) {
      logger.error("DSR status failed", err instanceof Error ? err : undefined, { emailHash });
      return res.status(500).json({ error: "Status check failed" });
    }
  },
);

export default router;
