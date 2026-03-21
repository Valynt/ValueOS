/**
 * Data Subject Request (DSR) API
 *
 * GDPR Article 15/17 compliance endpoints for data export and erasure.
 * Restricted to admin users with the `users.delete` permission.
 */

import { createHash } from "crypto";

import { createLogger } from "@shared/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { createSecureRouter } from "../middleware/secureRouter";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { getDsrMappedPiiAssets } from "../observability/dataAssetInventoryRegistry";

const logger = createLogger({ component: "DSR-API" });
const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware());

const DSR_PII_ASSETS = getDsrMappedPiiAssets();

interface DsrAssetCoverage {
  included: string[];
  excluded: Array<{ asset: string; reason: string }>;
}

interface DsrEraseRpcSummary {
  anonymized_to: string;
  erased_at: string;
  pii_assets_included: string[];
  pii_assets_excluded: Array<{ asset: string; reason: string }>;
  scrubbed_counts: Record<string, number>;
  deleted_counts: Record<string, number>;
  idempotent_replay?: boolean;
}

interface DsrEraseRequestRecord {
  tenant_id: string;
  user_id: string;
  request_token: string;
  request_type: "erase";
  status: "pending" | "completed" | "failed";
  result_summary: DsrEraseRpcSummary | null;
  last_error: string | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** One-way hash for PII identifiers used in logs and audit records. */
function hashEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

async function resolveUserId(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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

async function getEraseRequestRecord(
  supabase: SupabaseClient,
  tenantId: string,
  requestToken: string,
): Promise<DsrEraseRequestRecord | null> {
  const { data, error } = await supabase
    .from("dsr_erasure_requests")
    .select("tenant_id, user_id, request_token, request_type, status, result_summary, last_error")
    .eq("tenant_id", tenantId)
    .eq("request_type", "erase")
    .eq("request_token", requestToken)
    .maybeSingle();

  if (error) {
    throw new Error(`DSR request lookup failed: ${error.message} (code: ${error.code})`);
  }

  return data as DsrEraseRequestRecord | null;
}

async function reserveEraseRequest(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  requestToken: string,
) {
  const existing = await getEraseRequestRecord(supabase, tenantId, requestToken);

  if (existing?.status === "completed" && existing.result_summary) {
    return existing;
  }

  const { error } = await supabase.from("dsr_erasure_requests").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      request_token: requestToken,
      request_type: "erase",
      status: "pending",
      last_error: null,
    },
    {
      onConflict: "tenant_id,request_type,request_token",
      ignoreDuplicates: false,
    },
  );

  if (error) {
    throw new Error(`DSR request reservation failed: ${error.message} (code: ${error.code})`);
  }

  return getEraseRequestRecord(supabase, tenantId, requestToken);
}

async function markEraseRequestFailed(
  supabase: SupabaseClient,
  tenantId: string,
  requestToken: string,
  errorMessage: string,
) {
  const { error } = await supabase
    .from("dsr_erasure_requests")
    .update({
      status: "failed",
      last_error: errorMessage,
    })
    .eq("tenant_id", tenantId)
    .eq("request_type", "erase")
    .eq("request_token", requestToken);

  if (error) {
    logger.warn("DSR request failure status update failed", {
      tenantId,
      requestToken,
      error: error.message,
    });
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
    const tenantId = req.tenantId;
    const actorId = req.userId;
    const requestId = req.requestId ?? "unknown";

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
      if (!req.supabase) {
        return res.status(500).json({ error: "Request-scoped Supabase client required" });
      }

      const supabase = req.supabase;
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
    const tenantId = req.tenantId;
    const actorId = req.userId;
    const requestId = req.requestId ?? "unknown";

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
      if (!req.supabase) {
        return res.status(500).json({ error: "Request-scoped Supabase client required" });
      }

      const supabase = req.supabase;
      const userId = await resolveUserId(supabase, email, tenantId);

      if (!userId) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      const requestTokenHeader = req.headers["idempotency-key"];
      const requestToken = typeof requestTokenHeader === "string" && requestTokenHeader.trim().length > 0
        ? requestTokenHeader.trim()
        : requestId;

      const reservedRequest = await reserveEraseRequest(supabase, tenantId, userId, requestToken);
      if (reservedRequest?.status === "completed" && reservedRequest.result_summary) {
        const summary = reservedRequest.result_summary;
        logger.info("DSR erasure replay served from idempotency record", {
          emailHash,
          tenantId,
          requestToken,
        });

        return res.json({
          request_type: "erase",
          email,
          anonymized_to: summary.anonymized_to,
          erased_at: summary.erased_at,
          pii_assets_included: summary.pii_assets_included,
          pii_assets_excluded: summary.pii_assets_excluded,
          idempotent_replay: true,
        });
      }

      const redactedTs = new Date().toISOString();
      const { data: rpcSummary, error: rpcError } = await supabase.rpc("erase_user_pii", {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_redacted_ts: redactedTs,
        p_request_token: requestToken,
      });

      if (rpcError) {
        await markEraseRequestFailed(supabase, tenantId, requestToken, rpcError.message);
        throw new Error(`erase_user_pii failed: ${rpcError.message} (code: ${rpcError.code})`);
      }

      const summary = rpcSummary as DsrEraseRpcSummary | null;
      if (!summary) {
        await markEraseRequestFailed(supabase, tenantId, requestToken, "RPC returned no summary");
        throw new Error("erase_user_pii returned no summary");
      }

      try {
        await auditDsr(supabase, "erase", actorId, email, tenantId, requestId, {
          request_token: requestToken,
          anonymized_to: summary.anonymized_to,
          tables_scrubbed: summary.pii_assets_included,
          scrubbed_counts: summary.scrubbed_counts,
          deleted_counts: summary.deleted_counts,
          pii_assets_included: summary.pii_assets_included,
          pii_assets_excluded: summary.pii_assets_excluded,
          idempotent_replay: summary.idempotent_replay ?? false,
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
        anonymized_to: summary.anonymized_to,
        erased_at: summary.erased_at,
        pii_assets_included: summary.pii_assets_included,
        pii_assets_excluded: summary.pii_assets_excluded,
        idempotent_replay: summary.idempotent_replay ?? false,
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
    const tenantId = req.tenantId;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const emailHash = hashEmail(email);

    try {
      if (!req.supabase) {
        return res.status(500).json({ error: "Request-scoped Supabase client required" });
      }

      const supabase = req.supabase;
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
