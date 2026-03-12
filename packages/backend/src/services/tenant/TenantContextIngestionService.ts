/**
 * TenantContextIngestionService
 *
 * Ingests company context (website, product description, ICP, competitors)
 * into tenant-scoped semantic memory so agents can reference firm-specific
 * context during value case generation.
 *
 * Each ingest call replaces the prior context entries for the tenant —
 * memory entries are tagged with `context_type: "tenant_context"` so they
 * can be selectively invalidated without touching other agent memories.
 */

import { createLogger } from "@shared/lib/logger";
import { z } from "zod";

import { MemorySystem } from "../../lib/agent-fabric/MemorySystem.js";
import { SupabaseMemoryBackend } from "../../lib/agent-fabric/SupabaseMemoryBackend.js";
import { createServerSupabaseClient } from "../../lib/supabase.js";

const logger = createLogger({ component: "TenantContextIngestionService" });

// ---------------------------------------------------------------------------
// Public schema — validated at the API boundary before calling ingest()
// ---------------------------------------------------------------------------

export const TenantContextPayloadSchema = z.object({
  websiteUrl: z.string().url().optional(),
  productDescription: z.string().min(1).max(4000),
  icpDefinition: z.string().min(1).max(4000),
  competitorList: z.array(z.string().min(1).max(200)).max(20).default([]),
});

export type TenantContextPayload = z.infer<typeof TenantContextPayloadSchema>;

export interface IngestResult {
  stored: true;
  memoryEntries: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TenantContextIngestionService {
  private readonly memorySystem: MemorySystem;

  constructor(memorySystem?: MemorySystem) {
    this.memorySystem = memorySystem ?? new MemorySystem(
      { max_memories: 1000, enable_persistence: true },
      new SupabaseMemoryBackend(),
    );
  }

  /**
   * Ingest company context for a tenant.
   *
   * Stores each context section as a separate semantic memory entry so
   * agents can retrieve the most relevant section via vector similarity.
   * Prior tenant context entries are removed before writing new ones.
   */
  async ingest(organizationId: string, payload: TenantContextPayload): Promise<IngestResult> {
    // Remove stale context entries for this tenant before writing new ones.
    await this.clearPriorContext(organizationId);

    const sessionId = `tenant-context-${organizationId}`;
    const agentId = "TenantContextIngestionService";
    const baseMetadata = {
      context_type: "tenant_context",
      organization_id: organizationId,
      importance: 0.9,
    };

    const entries: Array<{ content: string; label: string }> = [
      {
        label: "product_description",
        content: `Product description for tenant ${organizationId}: ${payload.productDescription}`,
      },
      {
        label: "icp_definition",
        content: `Ideal customer profile for tenant ${organizationId}: ${payload.icpDefinition}`,
      },
    ];

    if (payload.websiteUrl) {
      entries.push({
        label: "website_url",
        content: `Company website for tenant ${organizationId}: ${payload.websiteUrl}`,
      });
    }

    if (payload.competitorList.length > 0) {
      entries.push({
        label: "competitor_list",
        content: `Competitors for tenant ${organizationId}: ${payload.competitorList.join(", ")}`,
      });
    }

    let stored = 0;
    for (const entry of entries) {
      try {
        await this.memorySystem.storeSemanticMemory(
          sessionId,
          agentId,
          "semantic",
          entry.content,
          { ...baseMetadata, label: entry.label },
          organizationId,
        );
        stored++;
      } catch (err) {
        logger.error(`Failed to store context entry "${entry.label}"`, err instanceof Error ? err : new Error(String(err)), {
          organizationId,
          label: entry.label,
        });
        // Continue — partial ingestion is better than a full failure.
      }
    }

    logger.info("Tenant context ingested", { organizationId, memoryEntries: stored });
    return { stored: true, memoryEntries: stored };
  }

  /**
   * Return a summary of the most recently ingested context for a tenant.
   * Returns null if no context has been ingested.
   */
  async getSummary(organizationId: string): Promise<TenantContextSummary | null> {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("semantic_memory")
      .select("content, metadata, created_at")
      .eq("organization_id", organizationId)
      .contains("metadata", { context_type: "tenant_context" })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      logger.error("Failed to fetch tenant context summary", error, { organizationId });
      return null;
    }

    if (!data || data.length === 0) return null;

    const entries = data as Array<{
      content: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }>;

    const lastIngestedAt = entries[0]?.created_at ?? null;
    const labels = entries.map((e) => (e.metadata?.label as string | undefined) ?? "unknown");

    return {
      organizationId,
      entryCount: entries.length,
      labels,
      lastIngestedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async clearPriorContext(organizationId: string): Promise<void> {
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from("semantic_memory")
      .delete()
      .eq("organization_id", organizationId)
      .contains("metadata", { context_type: "tenant_context" });

    if (error) {
      // Non-fatal — stale entries will be overwritten by the new ingest.
      logger.warn("Could not clear prior tenant context entries", { organizationId, error: error.message });
    }
  }
}

export interface TenantContextSummary {
  organizationId: string;
  entryCount: number;
  labels: string[];
  lastIngestedAt: string | null;
}

export const tenantContextIngestionService = new TenantContextIngestionService();
