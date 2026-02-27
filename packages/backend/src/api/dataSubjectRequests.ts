/**
 * Data Subject Request (DSR) API
 *
 * GDPR Article 15/17 compliance endpoints for data export and erasure.
 * Restricted to admin users with the `users.delete` permission.
 */

import { Request, Response } from "express";
import { createSecureRouter } from "../middleware/secureRouter.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { requirePermission } from "../middleware/rbac.js";
import { createLogger } from "@shared/lib/logger";
import { createServerSupabaseClient } from "../lib/supabase.js";

const logger = createLogger({ component: "DSR-API" });
const router = createSecureRouter("strict");

router.use(requireAuth, tenantContextMiddleware());

// Tables that may contain PII, keyed by the column holding the user reference
const PII_TABLES: Array<{ table: string; userColumn: string }> = [
  { table: "users", userColumn: "id" },
  { table: "cases", userColumn: "user_id" },
  { table: "messages", userColumn: "user_id" },
  { table: "agent_sessions", userColumn: "user_id" },
  { table: "agent_memory", userColumn: "user_id" },
  { table: "audit_logs", userColumn: "user_id" },
];

// ── helpers ──────────────────────────────────────────────────────────────────

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
  for (const { table, userColumn } of PII_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(userColumn, userId)
      .eq("tenant_id", tenantId);
    if (error) {
      logger.warn(`DSR: failed to read ${table}`, { error: error.message });
      footprint[table] = [];
    } else {
      footprint[table] = data ?? [];
    }
  }
  return footprint;
}

async function auditDsr(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  action: string,
  actorId: string,
  targetEmail: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("security_audit_log").insert({
    event_type: `dsr_${action}`,
    actor: actorId,
    action,
    resource: "dsr",
    request_path: "/api/dsr",
    severity: "high",
    event_data: { target_email: targetEmail, ...details },
  });
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
    const tenantId = (req as any).tenantId as string | undefined;
    const actorId = (req as any).userId as string | undefined;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    try {
      const supabase = createServerSupabaseClient();
      const userId = await resolveUserId(supabase, email, tenantId);

      if (!userId) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      const footprint = await gatherFootprint(supabase, userId, tenantId);
      await auditDsr(supabase, "export", actorId ?? "unknown", email, {
        tables: Object.keys(footprint),
      });

      logger.info("DSR export completed", { email, tenantId });

      return res.json({
        request_type: "export",
        email,
        exported_at: new Date().toISOString(),
        data: footprint,
      });
    } catch (err) {
      logger.error("DSR export failed", { error: err, email });
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
    const tenantId = (req as any).tenantId as string | undefined;
    const actorId = (req as any).userId as string | undefined;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

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

      await auditDsr(supabase, "erase", actorId ?? "unknown", email, {
        anonymized_to: placeholderEmail,
        tables_scrubbed: ["users", "messages", "cases", "agent_memory"],
      });

      logger.info("DSR erasure completed", { email, tenantId });

      return res.json({
        request_type: "erase",
        email,
        anonymized_to: placeholderEmail,
        erased_at: redactedTs,
      });
    } catch (err) {
      logger.error("DSR erasure failed", { error: err, email });
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
    const tenantId = (req as any).tenantId as string | undefined;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    try {
      const supabase = createServerSupabaseClient();
      const userId = await resolveUserId(supabase, email, tenantId);

      if (!userId) {
        return res.status(404).json({ error: "User not found in this tenant" });
      }

      const footprint = await gatherFootprint(supabase, userId, tenantId);
      const summary = Object.fromEntries(
        Object.entries(footprint).map(([table, rows]) => [table, (rows as unknown[]).length]),
      );

      return res.json({ email, user_id: userId, record_counts: summary });
    } catch (err) {
      logger.error("DSR status failed", { error: err, email });
      return res.status(500).json({ error: "Status check failed" });
    }
  },
);

export default router;
