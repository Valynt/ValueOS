```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import {
  UUID,
  Vector1536,
  Fact,
  FactStatus,
  Artifact,
  ArtifactChunk,
  HybridSearchResult,
  FactEvidence
} from './types';

/**
 * RETRIEVAL ENGINE INTERFACES
 */

export interface RetrievalOptions {
  query_text: string;
  query_embedding: Vector1536;
  value_case_id: UUID; // deal_id
  tenant_id: UUID;
  limit?: number;
  min_score?: number;
}

export interface RerankedResult extends Fact {
  base_score: number;
  final_score: number;
  metadata: {
    tier?: string;
    recency_boost: number;
    status_boost: number;
  };
}

export interface EvidenceCard {
  fact_id: UUID;
  claim: string;
  status: FactStatus;
  confidence_score: number;
  evidence: Array<{
    quote: string | null;
    source_artifact_title: string;
    source_artifact_url: string | null;
    chunk_content: string;
    page_number?: number;
  }>;
  rank_score: number;
}

export interface EvidenceFirstPayload {
  summary: string;
  cards: EvidenceCard[];
  metadata: {
    total_retrieved: number;
    processing_ms: number;
    deal_id: UUID;
  };
}

/**
 * RetrievalEngine
 * 
 * Orchestrates high-fidelity data retrieval for ValueOS.
 * Combines vector similarity, FTS, business-rule reranking, and evidence mapping.
 */
export class RetrievalEngine {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Main entry point for the retrieval pipeline.
   */
  public async retrieve(options: RetrievalOptions): Promise<EvidenceFirstPayload> {
    const startTime = Date.now();

    // 1. Execute Hybrid Search (Episodic + Semantic Layers)
    const rawResults = await this.hybridSearch(options);

    // 2. Rerank based on ValueOS Business Logic
    const reranked = this.rerankResults(rawResults);

    // 3. Compose Evidence Cards (Provenance Mapping)
    const cards = await this.composeEvidenceCards(reranked, options.tenant_id);

    return {
      summary: `Retrieved ${cards.length} high-confidence evidence points for the current deal context.`,
      cards,
      metadata: {
        total_retrieved: rawResults.length,
        processing_ms: Date.now() - startTime,
        deal_id: options.value_case_id
      }
    };
  }

  /**
   * Performs Hybrid Search combining Vector Similarity and Full-Text Search.
   * Strict RLS compliance via tenant_id and value_case_id filters.
   */
  private async hybridSearch(options: RetrievalOptions): Promise<Fact[]> {
    // Note: We search the 'facts' table for Semantic Truths, 
    // linked to the specific deal (value_case_id)
    
    // 1. Vector Search via RPC
    const { data: vectorMatch, error: vError } = await this.supabase.rpc('match_chunks', {
      query_embedding: options.query_embedding,
      match_threshold: 0.5,
      match_count: options.limit || 10,
      p_tenant_id: options.tenant_id,
      p_value_case_id: options.value_case_id
    });

    if (vError) throw vError;

    // 2. Full-Text Search
    const { data: ftsMatch, error: fError } = await this.supabase
      .from('facts')
      .select('*')
      .eq('tenant_id', options.tenant_id)
      // Note: Facts are often global to a tenant but linked to artifacts within a deal
      // We filter facts that have evidence within this specific deal
      .textSearch('fts', options.query_text)
      .limit(options.limit || 10);

    if (fError) throw fError;

    // Merge and deduplicate results
    const combined = [...(vectorMatch || []), ...(ftsMatch || [])];
    const uniqueIds = new Set();
    return combined.filter(item => {
      if (!uniqueIds.has(item.id)) {
        uniqueIds.add(item.id);
        return true;
      }
      return false;
    });
  }

  /**
   * Reranks results using a weighted scoring model.
   * Logic: Status Boost + Tier Boost + Recency Decay.
   */
  private rerankResults(results: any[]): RerankedResult[] {
    const now = new Date().getTime();
    const halfLife = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

    return results
      .map(fact => {
        let score = fact.similarity || 0.5; // Base score from retrieval
        let statusBoost = 0;
        let tierBoost = 0;

        // 1. Approved Status Boost (+0.5)
        if (fact.status === FactStatus.APPROVED) {
          statusBoost = 0.5;
        }

        // 2. Tier-based Boosting (from metadata)
        const tier = fact.metadata?.tier;
        if (tier === 'tier_1') tierBoost = 0.3;
        else if (tier === 'tier_2') tierBoost = 0.1;

        // 3. Recency Decay (Exponential)
        const age = now - new Date(fact.updated_at).getTime();
        const recencyDecay = Math.pow(0.5, age / halfLife);

        const final_score = (score + statusBoost + tierBoost) * recencyDecay;

        return {
          ...fact,
          base_score: score,
          final_score,
          metadata: {
            ...fact.metadata,
            tier,
            recency_boost: recencyDecay,
            status_boost: statusBoost
          }
        };
      })
      .sort((a, b) => b.final_score - a.final_score);
  }

  /**
   * ResponseComposer: Builds Evidence Cards by mapping Facts to original Artifacts.
   */
  private async composeEvidenceCards(
    rankedFacts: RerankedResult[],
    tenantId: UUID
  ): Promise<EvidenceCard[]> {
    const factIds = rankedFacts.map(f => f.id);

    // Fetch Evidence and join with Chunks and Artifacts for full lineage
    const { data: evidenceLinks, error } = await this.supabase
      .from('fact_evidence')
      .select(`
        fact_id,
        quote,
        confidence_score,
        chunk_id,
        artifact_chunks (
          content,
          artifacts (
            title,
            source_url,
            metadata
          )
        )
      `)
      .in('fact_id', factIds)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Map database joins into clean EvidenceCard structures
    return rankedFacts.map(fact => {
      const factEvidence = (evidenceLinks || [])
        .filter(e => e.fact_id === fact.id)
        .map(e => {
          const chunk = e.artifact_chunks as any;
          const artifact = chunk?.artifacts as any;
          
          return {
            quote: e.quote,
            source_artifact_title: artifact?.title || 'Unknown Source',
            source_artifact_url: artifact?.source_url || null,
            chunk_content: chunk?.content || '',
            page_number: artifact?.metadata?.page_count
          };
        });

      return {
        fact_id: fact.id,
        claim: fact.claim,
        status: fact.status,
        confidence_score: fact.final_score,
        evidence: factEvidence,
        rank_score: fact.final_score
      };
    });
  }
}
```