/**
 * Semantic Memory Service
 *
 * Long-term semantic memory using pgvector for RAG (Retrieval-Augmented Generation).
 * Enables agents to recall past successful patterns, decisions, and outcomes.
 */

import { createClient } from "@supabase/supabase-js";

import { logger } from "./logger";
import { createServerSupabaseClient } from "./supabase";

export interface MemoryEntry {
  id: string;
  type:
    | "value_proposition"
    | "target_definition"
    | "opportunity"
    | "integrity_check"
    | "workflow_result"
    | "sec_filing_chunk"
    | "web_chunk";
  content: string;
  embedding: number[];
  metadata: {
    agentType: string;
    industry?: string;
    targetMarket?: string;
    score?: number;
    timestamp: Date;
    organization_id?: string;
    external_sub?: string;
    session_id?: string;
    userId?: string;
    workflowId?: string;
    tags?: string[];
    source_url?: string;
    chunk_index?: number;
    total_chunks?: number;
    tier?: 'tier1' | 'tier2' | 'tier3';
  };
  createdAt: Date;
}

export interface SemanticSearchResult {
  entry: MemoryEntry;
  similarity: number;
}

export class SemanticMemoryService {
  private _supabase: any = null;
  private embeddingModel = "togethercomputer/m2-bert-80M-8k-retrieval"; // Together AI embedding model
  private embeddingDimension = 768;

  private get supabase(): any {
    if (!this._supabase) {
      this._supabase = createServerSupabaseClient();
    }
    return this._supabase;
  }

  constructor() {}

  /**
   * Split text into chunks using recursive character splitting for better context preservation.
   */
  chunkText(text: string, size: number = 2000, overlap: number = 200): string[] {
    if (!text) return [];
    if (text.length <= size) return [text];

    const chunks: string[] = [];
    const separators = ["\n##", "\n#", "\n\n", "\n", ". ", " ", ""];

    const splitRecursive = (currentText: string, separatorIdx: number): string[] => {
      if (currentText.length <= size) return [currentText];

      const separator = separators[separatorIdx];
      if (separator === undefined) return [currentText.substring(0, size)]; // Fallback to hard cut

      const parts = currentText.split(separator);
      const result: string[] = [];
      let currentChunk = '';

      for (const part of parts) {
        if ((currentChunk + separator + part).length <= size) {
          currentChunk += (currentChunk ? separator : '') + part;
        } else {
          if (currentChunk) result.push(currentChunk);

          if (part.length > size) {
            // Part itself is too big, recurse with next separator
            result.push(...splitRecursive(part, separatorIdx + 1));
            currentChunk = '';
          } else {
            currentChunk = part;
          }
        }
      }

      if (currentChunk) result.push(currentChunk);
      return result;
    };

    const initialChunks = splitRecursive(text, 0);

    // Apply overlap
    if (overlap > 0 && initialChunks.length > 1) {
      for (let i = 0; i < initialChunks.length; i++) {
        let chunk = initialChunks[i];
        if (i > 0) {
          const prevChunk = initialChunks[i - 1];
          if (prevChunk) {
            const overlapText = prevChunk.substring(prevChunk.length - overlap);
            chunk = overlapText + chunk;
          }
        }
        if (chunk) {
          chunks.push(chunk);
        }
      }
      return chunks;
    }

    return initialChunks;
  }

  /**
   * Generate embedding for text using Together AI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch("https://api.together.xyz/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Together AI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      logger.error("Failed to generate embedding", error as Error);
      throw error;
    }
  }

  /**
   * Store a memory entry
   */
  async store(
    entry: Omit<MemoryEntry, "id" | "embedding" | "createdAt">
  ): Promise<string> {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(entry.content);

      const namespace = this.resolveNamespace(entry.metadata);

      // Store in database
      const { data, error } = await this.supabase
        .from("semantic_memory")
        .insert({
          type: entry.type,
          content: entry.content,
          embedding,
          metadata: {
            ...entry.metadata,
            ...namespace,
          },
          organization_id: namespace.organization_id,
          external_sub: namespace.external_sub,
          session_id: namespace.session_id,
        })
        .select("id")
        .single();

      if (error) throw error;

      logger.info("Memory stored", {
        id: data.id,
        type: entry.type,
        agentType: entry.metadata.agentType,
      });

      return data.id;
    } catch (error) {
      logger.error("Failed to store memory", error as Error);
      throw error;
    }
  }

  /**
   * Store a raw content chunk (RAG support)
   */
  async storeChunk(data: {
    type: "sec_filing_chunk" | "web_chunk";
    content: string;
    sourceUrl: string;
    metadata?: Record<string, any>;
    tenantId: string;
    contextId?: string;
  }): Promise<string> {
    return this.store({
      type: data.type,
      content: data.content,
      metadata: {
        agentType: "ResearchWorker",
        timestamp: new Date(),
        organization_id: data.tenantId,
        workflowId: data.contextId,
        session_id: data.contextId,
        source_url: data.sourceUrl,
        ...data.metadata,
      },
    });
  }

  /**
   * Semantic search for similar memories
   */
  async search(
    query: string,
    options: {
      type?: MemoryEntry["type"];
      industry?: string;
      targetMarket?: string;
      minScore?: number;
      limit?: number;
      organizationId?: string;
      externalSub?: string;
      sessionId?: string;
      tenantId?: string;
      workflowId?: string;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      const organizationId = options.organizationId ?? options.tenantId;
      const sessionId = options.sessionId ?? options.workflowId;

      // Perform vector similarity search
      const { data, error } = await this.supabase.rpc(
        "search_semantic_memory",
        {
          query_embedding: queryEmbedding,
          match_threshold: options.minScore || 0.7, // Cosine similarity threshold
          match_count: options.limit || 10,
          p_type: options.type ?? null,
          p_industry: options.industry ?? null,
          p_target_market: options.targetMarket ?? null,
          p_min_score: options.minScore ?? null,
          p_organization_id: organizationId ?? null,
          p_auth_subject: options.externalSub ?? null,
          p_session_id: sessionId ?? null,
        }
      );

      if (error) throw error;

      logger.info("Semantic search completed", {
        query: query.substring(0, 50),
        resultsCount: data?.length || 0,
      });

      return (data || []).map((row: any) => ({
        entry: {
          id: row.id,
          type: row.type,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata,
          createdAt: new Date(row.created_at),
        },
        similarity: row.similarity,
      }));
    } catch (error) {
      logger.error("Semantic search failed", error as Error);
      throw error;
    }
  }

  private resolveNamespace(metadata: MemoryEntry["metadata"]): {
    organization_id: string | null;
    external_sub: string | null;
    session_id: string | null;
  } {
    return {
      organization_id: metadata.organization_id ?? metadata.userId ?? null,
      external_sub: metadata.external_sub ?? null,
      session_id: metadata.session_id ?? metadata.workflowId ?? null,
    };
  }

  /**
   * Store successful value proposition for future reference
   */
  async storeValueProposition(data: {
    content: string;
    industry: string;
    targetMarket: string;
    score: number;
    userId: string;
    workflowId: string;
  }): Promise<string> {
    return this.store({
      type: "value_proposition",
      content: data.content,
      metadata: {
        agentType: "OpportunityAgent",
        industry: data.industry,
        targetMarket: data.targetMarket,
        score: data.score,
        timestamp: new Date(),
        userId: data.userId,
        workflowId: data.workflowId,
        tags: ["successful", "validated"],
      },
    });
  }

  /**
   * Retrieve similar successful value propositions
   */
  async getSimilarValuePropositions(
    businessContext: string,
    industry: string,
    targetMarket: string
  ): Promise<SemanticSearchResult[]> {
    return this.search(businessContext, {
      type: "value_proposition",
      industry,
      targetMarket,
      minScore: 0.7, // Only retrieve high-quality examples
      limit: 5,
    });
  }

  /**
   * Store target definition for learning
   */
  async storeTargetDefinition(data: {
    content: string;
    industry: string;
    score: number;
    userId: string;
    workflowId: string;
  }): Promise<string> {
    return this.store({
      type: "target_definition",
      content: data.content,
      metadata: {
        agentType: "TargetAgent",
        industry: data.industry,
        score: data.score,
        timestamp: new Date(),
        userId: data.userId,
        workflowId: data.workflowId,
      },
    });
  }

  /**
   * Get examples of successful targets for similar contexts
   */
  async getSimilarTargets(
    businessContext: string,
    industry: string
  ): Promise<SemanticSearchResult[]> {
    return this.search(businessContext, {
      type: "target_definition",
      industry,
      minScore: 0.8, // High bar for target examples
      limit: 3,
    });
  }

  /**
   * Store integrity check results for pattern learning
   */
  async storeIntegrityCheck(data: {
    content: string;
    passed: boolean;
    issues: string[];
    userId: string;
    workflowId: string;
  }): Promise<string> {
    return this.store({
      type: "integrity_check",
      content: JSON.stringify({ content: data.content, issues: data.issues }),
      metadata: {
        agentType: "IntegrityAgent",
        score: data.passed ? 1.0 : 0.0,
        timestamp: new Date(),
        userId: data.userId,
        workflowId: data.workflowId,
        tags: data.passed ? ["passed"] : ["failed", ...data.issues],
      },
    });
  }

  /**
   * Learn from past integrity failures
   */
  async getCommonIntegrityIssues(
    contentType: string
  ): Promise<SemanticSearchResult[]> {
    return this.search(contentType, {
      type: "integrity_check",
      minScore: 0.0, // Include failures
      limit: 10,
    });
  }

  /**
   * Store complete workflow result for holistic learning
   */
  async storeWorkflowResult(data: {
    workflowId: string;
    workflowType: string;
    input: any;
    output: any;
    score: number;
    duration: number;
    userId: string;
  }): Promise<string> {
    const content = JSON.stringify({
      type: data.workflowType,
      input: data.input,
      output: data.output,
      duration: data.duration,
    });

    return this.store({
      type: "workflow_result",
      content,
      metadata: {
        agentType: "WorkflowOrchestrator",
        score: data.score,
        timestamp: new Date(),
        userId: data.userId,
        workflowId: data.workflowId,
        tags: [data.workflowType],
      },
    });
  }

  /**
   * Get similar successful workflows
   */
  async getSimilarWorkflows(
    workflowType: string,
    inputContext: string
  ): Promise<SemanticSearchResult[]> {
    return this.search(inputContext, {
      type: "workflow_result",
      minScore: 0.7,
      limit: 5,
    });
  }

  /**
   * Prune old or low-quality memories
   */
  async pruneMemories(options: {
    olderThanDays?: number;
    minScore?: number;
    type?: MemoryEntry["type"];
  }): Promise<number> {
    try {
      const conditions: string[] = [];

      if (options.olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);
        conditions.push(`created_at < '${cutoffDate.toISOString()}'`);
      }

      if (options.minScore !== undefined) {
        conditions.push(`(metadata->>'score')::float < ${options.minScore}`);
      }

      if (options.type) {
        conditions.push(`type = '${options.type}'`);
      }

      if (conditions.length === 0) {
        throw new Error("At least one pruning condition required");
      }

      const { data, error } = await this.supabase
        .from("semantic_memory")
        .delete()
        .filter("id", "neq", "00000000-0000-0000-0000-000000000000") // Dummy filter
        .select("id");

      if (error) throw error;

      const deletedCount = data?.length || 0;

      logger.info("Memories pruned", {
        deletedCount,
        conditions: options,
      });

      return deletedCount;
    } catch (error) {
      logger.error("Failed to prune memories", error as Error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getStatistics(): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    avgScore: number;
    oldestMemory: Date | null;
    newestMemory: Date | null;
  }> {
    try {
      const { data, error } = await this.supabase
        .from("semantic_memory")
        .select("type, metadata, created_at");

      if (error) throw error;

      const byType: Record<string, number> = {};
      let totalScore = 0;
      let scoreCount = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      data?.forEach((row: any) => {
        byType[row.type] = (byType[row.type] || 0) + 1;

        if (row.metadata?.score !== undefined) {
          totalScore += row.metadata.score;
          scoreCount++;
        }

        const date = new Date(row.created_at);
        if (!oldestDate || date < oldestDate) oldestDate = date;
        if (!newestDate || date > newestDate) newestDate = date;
      });

      return {
        totalMemories: data?.length || 0,
        byType,
        avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
        oldestMemory: oldestDate,
        newestMemory: newestDate,
      };
    } catch (error) {
      logger.error("Failed to get memory statistics", error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const semanticMemory = new SemanticMemoryService();
