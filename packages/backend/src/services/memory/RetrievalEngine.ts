import { SupabaseClient } from "@supabase/supabase-js";
import {
  EvidenceCard,
  EvidenceFirstPayload,
  Fact,
  FactStatus,
  RerankedResult,
  RetrievalOptions,
  UUID,
  Vector1536,
} from "./types";

export class RetrievalEngine {
  constructor(private supabase: SupabaseClient) {}

  public async retrieve(
    options: RetrievalOptions
  ): Promise<EvidenceFirstPayload> {
    const startTime = Date.now();

    const rawResults = await this.hybridSearch(options);
    const reranked = this.rerankResults(rawResults);
    const cards = await this.composeEvidenceCards(reranked, options.tenant_id);

    return {
      summary: `Retrieved ${cards.length} high-confidence evidence points for the current deal context.`,
      cards,
      metadata: {
        total_retrieved: rawResults.length,
        processing_ms: Date.now() - startTime,
        deal_id: options.value_case_id,
      },
    };
  }

  private async hybridSearch(options: RetrievalOptions): Promise<Fact[]> {
    const { data: vectorMatch, error: vError } = await this.supabase.rpc(
      "memory_match_chunks",
      {
        query_embedding: options.query_embedding,
        match_threshold: 0.5,
        match_count: options.limit || 10,
        p_tenant_id: options.tenant_id,
        p_value_case_id: options.value_case_id,
      }
    );

    if (vError) throw vError;

    const { data: ftsMatch, error: fError } = await this.supabase
      .from("memory_facts")
      .select("*")
      .eq("tenant_id", options.tenant_id)
      .textSearch("fts", options.query_text)
      .limit(options.limit || 10);

    if (fError) throw fError;

    const combined = [...(vectorMatch || []), ...(ftsMatch || [])];
    const uniqueIds = new Set<string>();
    return combined.filter((item) => {
      if (!uniqueIds.has(item.id)) {
        uniqueIds.add(item.id);
        return true;
      }
      return false;
    });
  }

  private rerankResults(
    results: Array<
      Fact & { similarity?: number; metadata?: Record<string, unknown> }
    >
  ): RerankedResult[] {
    const now = new Date().getTime();
    const halfLife = 30 * 24 * 60 * 60 * 1000;

    return results
      .map((fact) => {
        let score = fact.similarity || 0.5;
        let statusBoost = 0;
        let tierBoost = 0;

        if (fact.status === FactStatus.APPROVED) {
          statusBoost = 0.5;
        }

        const tier = (fact.metadata as Record<string, unknown>)?.tier as
          | string
          | undefined;
        if (tier === "tier_1") tierBoost = 0.3;
        else if (tier === "tier_2") tierBoost = 0.1;

        const age = now - new Date(fact.updated_at).getTime();
        const recencyDecay = Math.pow(0.5, age / halfLife);

        const final_score = (score + statusBoost + tierBoost) * recencyDecay;

        return {
          ...fact,
          base_score: score,
          final_score,
          metadata: {
            tier,
            recency_boost: recencyDecay,
            status_boost: statusBoost,
          },
        };
      })
      .sort((a, b) => b.final_score - a.final_score);
  }

  private async composeEvidenceCards(
    rankedFacts: RerankedResult[],
    tenantId: UUID
  ): Promise<EvidenceCard[]> {
    const factIds = rankedFacts.map((f) => f.id);

    if (factIds.length === 0) return [];

    const { data: evidenceLinks, error } = await this.supabase
      .from("memory_fact_evidence")
      .select(
        `
        fact_id,
        quote,
        confidence_score,
        chunk_id,
        memory_artifact_chunks (
          content,
          memory_artifacts (
            title,
            source_url,
            metadata
          )
        )
      `
      )
      .in("fact_id", factIds)
      .eq("tenant_id", tenantId);

    if (error) throw error;

    return rankedFacts.map((fact) => {
      const factEvidence = (evidenceLinks || [])
        .filter((e) => e.fact_id === fact.id)
        .map((e) => {
          const chunk = e.memory_artifact_chunks as unknown as {
            content?: string;
            memory_artifacts?: {
              title?: string;
              source_url?: string;
              metadata?: { page_count?: number };
            };
          } | null;
          const artifact = chunk?.memory_artifacts || null;

          return {
            quote: e.quote,
            source_artifact_title: artifact?.title || "Unknown Source",
            source_artifact_url: artifact?.source_url || null,
            chunk_content: chunk?.content || "",
            page_number: artifact?.metadata?.page_count,
          };
        });

      return {
        fact_id: fact.id,
        claim: fact.claim,
        status: fact.status,
        confidence_score: fact.final_score,
        evidence: factEvidence,
        rank_score: fact.final_score,
      };
    });
  }

  public async searchFacts(
    tenantId: UUID,
    query: string,
    embedding: Vector1536,
    limit: number = 10
  ): Promise<Fact[]> {
    const { data: vectorResults, error: vErr } = await this.supabase.rpc(
      "memory_match_chunks",
      {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: limit,
        p_tenant_id: tenantId,
      }
    );

    if (vErr) throw vErr;

    const { data: ftsResults, error: fErr } = await this.supabase
      .from("memory_facts")
      .select("*")
      .eq("tenant_id", tenantId)
      .textSearch("fts", query)
      .limit(limit);

    if (fErr) throw fErr;

    const combined = [...(vectorResults || []), ...(ftsResults || [])];
    const uniqueIds = new Set<string>();
    return combined.filter((item) => {
      if (!uniqueIds.has(item.id)) {
        uniqueIds.add(item.id);
        return true;
      }
      return false;
    }) as Fact[];
  }
}
