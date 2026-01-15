```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UUID,
  Vector1536,
  Artifact,
  ArtifactMetadata,
  Fact,
  FactStatus,
  FactEvidence,
  ModelRun,
  Narrative,
  NarrativeStatus,
  HybridSearchResult,
  SearchParams
} from './types';

/**
 * Custom error class for MemoryService operations
 */
export class MemoryServiceError extends Error {
  constructor(public message: string, public cause?: any) {
    super(message);
    this.name = 'MemoryServiceError';
  }
}

/**
 * MemoryService
 * 
 * A production-grade service for managing the ValueOS Memory-First Architecture.
 * Handles the interaction between episodic (artifacts), semantic (facts), 
 * and computational (model runs) memory layers.
 */
export class MemoryService {
  private client: SupabaseClient;
  private tenantId: UUID;

  constructor(supabaseUrl: string, supabaseKey: string, tenantId: UUID) {
    this.client = createClient(supabaseUrl, supabaseKey);
    this.tenantId = tenantId;
  }

  /**
   * ==========================================
   * 1. SEARCH & RETRIEVAL (READ)
   * ==========================================
   */

  /**
   * Performs a Hybrid Search combining Vector Similarity (HNSW) and Full-Text Search (BM25).
   * Calls the `hybrid_search_chunks` Postgres function defined in the schema.
   */
  public async hybridSearch(params: SearchParams): Promise<HybridSearchResult[]> {
    try {
      const { data, error } = await this.client.rpc('hybrid_search_chunks', {
        p_tenant_id: this.tenantId,
        query_text: params.query_text,
        query_embedding: params.query_embedding,
        match_threshold: params.match_threshold,
        match_count: params.match_count,
        full_text_weight: params.weights?.full_text ?? 1.0,
        semantic_weight: params.weights?.semantic ?? 1.0
      });

      if (error) throw error;
      return data as HybridSearchResult[];
    } catch (err) {
      throw new MemoryServiceError('Hybrid search failed', err);
    }
  }

  /**
   * Retrieves high-fidelity context for a specific deal (Value Case).
   * Combines raw episodic chunks and validated semantic facts.
   */
  public async retrieveContext(
    valueCaseId: UUID, 
    query: string, 
    embedding: Vector1536
  ): Promise<{ facts: Fact[]; chunks: HybridSearchResult[] }> {
    try {
      // 1. Fetch relevant chunks via hybrid search
      const chunks = await this.hybridSearch({
        query_text: query,
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5
      });

      // 2. Fetch approved facts related to this value case via FTS or embedding
      // Note: In a production scenario, we'd also use a fact-specific vector search here
      const { data: facts, error } = await this.client
        .from('facts')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('status', FactStatus.APPROVED)
        .textSearch('fts', query)
        .limit(5);

      if (error) throw error;

      return {
        facts: (facts as Fact[]) || [],
        chunks
      };
    } catch (err) {
      throw new MemoryServiceError(`Failed to retrieve context for deal ${valueCaseId}`, err);
    }
  }

  /**
   * Fetches approved narratives for a specific persona or use case.
   */
  public async getPersonaNarrative(valueCaseId: UUID, titleFilter: string): Promise<Narrative[]> {
    try {
      const { data, error } = await this.client
        .from('narratives')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('value_case_id', valueCaseId)
        .eq('status', NarrativeStatus.FINAL)
        .ilike('title', `%${titleFilter}%`);

      if (error) throw error;
      return data as Narrative[];
    } catch (err) {
      throw new MemoryServiceError('Failed to fetch persona narrative', err);
    }
  }

  /**
   * ==========================================
   * 2. KNOWLEDGE COMMITMENT (WRITE)
   * ==========================================
   */

  /**
   * Ingests a raw artifact and initiates the memory pipeline.
   */
  public async ingestArtifact(data: {
    value_case_id: UUID;
    title: string;
    content: string;
    metadata: ArtifactMetadata;
  }): Promise<Artifact> {
    try {
      const { data: artifact, error } = await this.client
        .from('artifacts')
        .insert({
          tenant_id: this.tenantId,
          value_case_id: data.value_case_id,
          title: data.title,
          metadata: data.metadata,
          content_type: data.metadata.source_type
        })
        .select()
        .single();

      if (error) throw error;

      /**
       * TRIGGER PIPELINE (Mock/Async)
       * In production, this would emit a webhook or a Supabase Edge Function call
       * to perform chunking, embedding generation, and entity extraction.
       */
      console.info(`Artifact ${artifact.id} ingested. Triggering chunking pipeline...`);
      
      return artifact as Artifact;
    } catch (err) {
      throw new MemoryServiceError('Artifact ingestion failed', err);
    }
  }

  /**
   * Creates a curated Fact with provenance links to episodic chunks.
   */
  public async createFact(
    claim: string, 
    evidenceRefs: Array<{ chunk_id: UUID; quote: string; confidence: number }>,
    createdBy: UUID
  ): Promise<Fact> {
    try {
      // 1. Create the Fact record
      const { data: fact, error: factError } = await this.client
        .from('facts')
        .insert({
          tenant_id: this.tenantId,
          claim,
          status: FactStatus.DRAFT,
          version: 1,
          created_by: createdBy
        })
        .select()
        .single();

      if (factError) throw factError;

      // 2. Link Evidence (Lineage)
      const evidencePayload = evidenceRefs.map(ref => ({
        tenant_id: this.tenantId,
        fact_id: fact.id,
        chunk_id: ref.chunk_id,
        quote: ref.quote,
        confidence_score: ref.confidence
      }));

      const { error: evidenceError } = await this.client
        .from('fact_evidence')
        .insert(evidencePayload);

      if (evidenceError) throw evidenceError;

      return fact as Fact;
    } catch (err) {
      throw new MemoryServiceError('Fact creation failed', err);
    }
  }

  /**
   * Logs a computational memory event (AI Model Run).
   */
  public async logModelRun(runData: {
    model_name: string;
    input_prompt: string;
    output_response: string;
    tokens_used: number;
    latency_ms: number;
    evidence_fact_ids?: UUID[];
  }): Promise<UUID> {
    try {
      // 1. Log the main run
      const { data: run, error: runError } = await this.client
        .from('model_runs')
        .insert({
          tenant_id: this.tenantId,
          model_name: runData.model_name,
          input_prompt: runData.input_prompt,
          output_response: runData.output_response,
          tokens_used: runData.tokens_used,
          latency_ms: runData.latency_ms,
          status: 'success'
        })
        .select()
        .single();

      if (runError) throw runError;

      // 2. Log cited facts if provided
      if (runData.evidence_fact_ids?.length) {
        const evidenceLinks = runData.evidence_fact_ids.map(factId => ({
          model_run_id: run.id,
          fact_id: factId,
          relevance_score: 1.0 // Default for direct citation
        }));

        await this.client.from('model_run_evidence').insert(evidenceLinks);
      }

      return run.id;
    } catch (err) {
      // We log but don't necessarily crash the agentic flow if telemetry fails
      console.error('Failed to log model run:', err);
      throw new MemoryServiceError('Telemetry logging failed', err);
    }
  }

  /**
   * ==========================================
   * 3. GOVERNANCE & UTILITIES
   * ==========================================
   */

  /**
   * Updates the version of an existing fact, moving the old one to deprecated.
   * Ensures the 'Source of Truth' remains consistent.
   */
  public async updateFactVersion(factId: UUID, newClaim: string): Promise<Fact> {
    try {
      const { data: oldFact, error: fetchError } = await this.client
        .from('facts')
        .select('*')
        .eq('id', factId)
        .single();

      if (fetchError) throw fetchError;

      const { data: newFact, error: insertError } = await this.client
        .from('facts')
        .insert({
          tenant_id: this.tenantId,
          claim: newClaim,
          status: FactStatus.APPROVED,
          version: (oldFact.version || 1) + 1,
          created_by: oldFact.created_by
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Mark previous version as deprecated
      await this.client
        .from('facts')
        .update({ status: FactStatus.DEPRECATED })
        .eq('id', factId);

      return newFact as Fact;
    } catch (err) {
      throw new MemoryServiceError('Fact versioning failed', err);
    }
  }
}
```