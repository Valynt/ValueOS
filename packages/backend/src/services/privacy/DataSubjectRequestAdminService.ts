import { createHash } from "crypto";

import { createLogger } from "@shared/lib/logger";

// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from "../../lib/supabase.js";
import { getDsrMappedPiiAssets } from "../../observability/dataAssetInventoryRegistry";

const logger = createLogger({ component: "DataSubjectRequestAdminService" });
const DSR_PII_ASSETS = getDsrMappedPiiAssets();

type DsrAssetCoverage = {
  included: string[];
  excluded: Array<{ asset: string; reason: string }>;
};

type DsrExportResult = {
  footprint: Record<string, unknown[]>;
  coverage: DsrAssetCoverage;
};

function hashEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 16);
}

export class DataSubjectRequestAdminService {
  private readonly supabase = createServerSupabaseClient();

  private async resolveUserId(email: string, tenantId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return data?.id ?? null;
  }

  private async gatherFootprint(userId: string, tenantId: string): Promise<DsrExportResult> {
    const footprint: Record<string, unknown[]> = {};
    const coverage: DsrAssetCoverage = { included: [], excluded: [] };

    for (const entry of DSR_PII_ASSETS) {
      const { asset, dsr } = entry;
      if (!dsr.exportable || !dsr.userColumn || !dsr.tenantColumn) {
        coverage.excluded.push({ asset, reason: "not_exportable" });
        continue;
      }

      const { data, error } = await this.supabase
        .from(asset)
        .select("*")
        .eq(dsr.userColumn, userId)
        .eq(dsr.tenantColumn, tenantId);

      if (error) {
        logger.warn(`DSR: failed to read ${asset}`, { error: error.message });
        footprint[asset] = [];
        coverage.excluded.push({ asset, reason: `read_error:${error.code ?? "unknown"}` });
        continue;
      }

      footprint[asset] = data ?? [];
      coverage.included.push(asset);
    }

    return { footprint, coverage };
  }

  private async auditDsr(
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
    const checksum = createHash("sha256")
      .update(JSON.stringify({ action, actorId, tenantId, requestId, eventData }))
      .digest("hex");

    const { error: insertError } = await this.supabase.from("security_audit_log").insert({
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

  async exportUserData(input: { email: string; tenantId: string; actorId: string; requestId: string }) {
    const { email, tenantId, actorId, requestId } = input;
    const emailHash = hashEmail(email);
    const userId = await this.resolveUserId(email, tenantId);

    if (!userId) {
      return { notFound: true as const };
    }

    const { footprint, coverage } = await this.gatherFootprint(userId, tenantId);

    try {
      await this.auditDsr("export", actorId, email, tenantId, requestId, {
        tables: Object.keys(footprint),
        pii_assets_included: coverage.included,
        pii_assets_excluded: coverage.excluded,
      });
    } catch (auditErr) {
      logger.error("DSR audit write failed", auditErr instanceof Error ? auditErr : undefined, {
        emailHash,
        tenantId,
        requestId,
        action: "export",
      });
    }

    logger.info("DSR export completed", { emailHash, tenantId });

    return {
      notFound: false as const,
      exportedAt: new Date().toISOString(),
      footprint,
      coverage,
    };
  }

  async eraseUserData(input: { email: string; tenantId: string; actorId: string; requestId: string }) {
    const { email, tenantId, actorId, requestId } = input;
    const emailHash = hashEmail(email);
    const userId = await this.resolveUserId(email, tenantId);

    if (!userId) {
      return { notFound: true as const };
    }

    const placeholderEmail = `deleted+${userId}@redacted.local`;
    const redactedTs = new Date().toISOString();

    await this.supabase
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

    const scrubbed = { content: "[redacted]", metadata: { anonymized: true, redacted_at: redactedTs } };
    await this.supabase.from("messages").update(scrubbed).eq("user_id", userId).eq("tenant_id", tenantId);
    await this.supabase.from("cases").update({ description: "[redacted]" }).eq("user_id", userId).eq("tenant_id", tenantId);
    await this.supabase.from("agent_memory").update({ content: "[redacted]" }).eq("user_id", userId).eq("tenant_id", tenantId);

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

      const { error } = await this.supabase.from(table).delete().eq(userColumn, userId).eq(tenantColumn, tenantId);
      if (error) {
        logger.warn(`DSR erase: failed to delete ${table}`, { error: error.message });
        coverage.excluded.push({ asset: table, reason: `delete_error:${error.code ?? "unknown"}` });
        continue;
      }
      coverage.included.push(table);
    }

    try {
      await this.auditDsr("erase", actorId, email, tenantId, requestId, {
        user_id: userId,
        pii_assets_included: coverage.included,
        pii_assets_excluded: coverage.excluded,
      });
    } catch (auditErr) {
      logger.error("DSR audit write failed", auditErr instanceof Error ? auditErr : undefined, {
        emailHash,
        tenantId,
        requestId,
        action: "erase",
      });
    }

    logger.info("DSR erase completed", { emailHash, tenantId });

    return {
      notFound: false as const,
      anonymizedAt: redactedTs,
      userId,
      coverage,
      placeholderEmail,
    };
  }


  async getStatus(input: { email: string; tenantId: string }) {
    const { email, tenantId } = input;
    const userId = await this.resolveUserId(email, tenantId);

    if (!userId) {
      return { notFound: true as const };
    }

    const { footprint, coverage } = await this.gatherFootprint(userId, tenantId);
    return {
      notFound: false as const,
      userId,
      footprint,
      coverage,
    };
  }

  async deleteAuditTrail(input: { email: string; tenantId: string; actorId: string; requestId: string }) {
    const { email, tenantId, actorId, requestId } = input;
    const emailHash = hashEmail(email);
    const { error } = await this.supabase
      .from("security_audit_log")
      .delete()
      .eq("tenant_id", tenantId)
      .contains("event_data", { target_email_hash: emailHash });

    if (error) {
      throw new Error(`DSR audit deletion failed: ${error.message}`);
    }

    await this.auditDsr("delete_audit_trail", actorId, email, tenantId, requestId, {
      target_email_hash: emailHash,
    });

    logger.info("DSR audit trail deleted", { emailHash, tenantId, requestId });
  }
}

export const dataSubjectRequestAdminService = new DataSubjectRequestAdminService();
