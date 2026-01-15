import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  UUID,
  Vector1536,
  Artifact,
  ArtifactMetadata,
  Fact,
  FactStatus,
  Narrative,
  NarrativeStatus,
  HybridSearchResult,
  SearchParams,
} from "./types";

export class MemoryServiceError extends Error {
  constructor(
    public override message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "MemoryServiceError";
  }
}

export class MemoryService {
  private client: SupabaseClient;
  private tenantId: UUID;

  constructor(supabaseUrl: string, supabaseKey: string, tenantId: UUID) {
    this.client = createClient(supabaseUrl, supabaseKey);
    this.tenantId = tenantId;
  }

  public async hybridSearch(
    params: SearchParams
  ): Promise<HybridSearchResult[]> {
    try {
      const { data, error } = await this.client.rpc(
        "memory_hybrid_search_chunks",
        {
          p_tenant_id: this.tenantId,
          query_text: params.query_text,
          query_embedding: params.query_embedding,
          match_threshold: params.match_threshold,
          match_count: params.match_count,
          full_text_weight: params.weights?.full_text ?? 1.0,
          semantic_weight: params.weights?.semantic ?? 1.0,
        }
      );

      if (error) throw error;
      return data as HybridSearchResult[];
    } catch (err) {
      throw new MemoryServiceError("Hybrid search failed", err);
    }
  }

  public async retrieveContext(
    valueCaseId: UUID,
    query: string,
    embedding: Vector1536
  ): Promise<{ facts: Fact[]; chunks: HybridSearchResult[] }> {
    try {
      const chunks = await this.hybridSearch({
        query_text: query,
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      });

      const { data: facts, error } = await this.client
        .from("memory_facts")
        .select("*")
        .eq("tenant_id", this.tenantId)
        .eq("status", FactStatus.APPROVED)
        .textSearch("fts", query)
        .limit(5);

      if (error) throw error;

      return {
        facts: (facts as Fact[]) || [],
        chunks,
      };
    } catch (err) {
      throw new MemoryServiceError(
        `Failed to retrieve context for deal ${valueCaseId}`,
        err
      );
    }
  }

  public async getPersonaNarrative(
    valueCaseId: UUID,
    titleFilter: string
  ): Promise<Narrative[]> {
    try {
      const { data, error } = await this.client
        .from("memory_narratives")
        .select("*")
        .eq("tenant_id", this.tenantId)
        .eq("value_case_id", valueCaseId)
        .eq("status", NarrativeStatus.FINAL)
        .ilike("title", `%${titleFilter}%`);

      if (error) throw error;
      return data as Narrative[];
    } catch (err) {
      throw new MemoryServiceError("Failed to fetch persona narrative", err);
    }
  }

  public async ingestArtifact(data: {
    value_case_id: UUID;
    title: string;
    content: string;
    metadata: ArtifactMetadata;
  }): Promise<Artifact> {
    try {
      const { data: artifact, error } = await this.client
        .from("memory_artifacts")
        .insert({
          tenant_id: this.tenantId,
          value_case_id: data.value_case_id,
          title: data.title,
          metadata: data.metadata,
          content_type: data.metadata.source_type,
        })
        .select()
        .single();

      if (error) throw error;

      console.info(
        `Artifact ${artifact.id} ingested. Triggering chunking pipeline...`
      );

      return artifact as Artifact;
    } catch (err) {
      throw new MemoryServiceError("Artifact ingestion failed", err);
    }
  }

  public async createFact(
    claim: string,
    evidenceRefs: Array<{ chunk_id: UUID; quote: string; confidence: number }>,
    createdBy: UUID
  ): Promise<Fact> {
    try {
      const { data: fact, error: factError } = await this.client
        .from("memory_facts")
        .insert({
          tenant_id: this.tenantId,
          claim,
          status: FactStatus.DRAFT,
          version: 1,
          created_by: createdBy,
        })
        .select()
        .single();

      if (factError) throw factError;

      const evidencePayload = evidenceRefs.map((ref) => ({
        tenant_id: this.tenantId,
        fact_id: fact.id,
        chunk_id: ref.chunk_id,
        quote: ref.quote,
        confidence_score: ref.confidence,
      }));

      const { error: evidenceError } = await this.client
        .from("memory_fact_evidence")
        .insert(evidencePayload);

      if (evidenceError) throw evidenceError;

      return fact as Fact;
    } catch (err) {
      throw new MemoryServiceError("Fact creation failed", err);
    }
  }

  public async logModelRun(runData: {
    model_name: string;
    input_prompt: string;
    output_response: string;
    tokens_used: number;
    latency_ms: number;
    evidence_fact_ids?: UUID[];
  }): Promise<UUID> {
    try {
      const { data: run, error: runError } = await this.client
        .from("memory_model_runs")
        .insert({
          tenant_id: this.tenantId,
          model_name: runData.model_name,
          input_prompt: runData.input_prompt,
          output_response: runData.output_response,
          tokens_used: runData.tokens_used,
          latency_ms: runData.latency_ms,
          status: "success",
        })
        .select()
        .single();

      if (runError) throw runError;

      if (runData.evidence_fact_ids?.length) {
        const evidenceLinks = runData.evidence_fact_ids.map((factId) => ({
          model_run_id: run.id,
          fact_id: factId,
          relevance_score: 1.0,
        }));

        await this.client
          .from("memory_model_run_evidence")
          .insert(evidenceLinks);
      }

      return run.id;
    } catch (err) {
      console.error("Failed to log model run:", err);
      throw new MemoryServiceError("Telemetry logging failed", err);
    }
  }

  public async updateFactVersion(
    factId: UUID,
    newClaim: string
  ): Promise<Fact> {
    try {
      const { data: oldFact, error: fetchError } = await this.client
        .from("memory_facts")
        .select("*")
        .eq("id", factId)
        .single();

      if (fetchError) throw fetchError;

      const { data: newFact, error: insertError } = await this.client
        .from("memory_facts")
        .insert({
          tenant_id: this.tenantId,
          claim: newClaim,
          status: FactStatus.APPROVED,
          version: (oldFact.version || 1) + 1,
          created_by: oldFact.created_by,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await this.client
        .from("memory_facts")
        .update({ status: FactStatus.DEPRECATED })
        .eq("id", factId);

      return newFact as Fact;
    } catch (err) {
      throw new MemoryServiceError("Fact versioning failed", err);
    }
  }

  public getClient(): SupabaseClient {
    return this.client;
  }

  public getTenantId(): UUID {
    return this.tenantId;
  }
}
