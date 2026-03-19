import type { ProvenanceRecord } from "../../provenance/index.js";
import type {
  SemanticFact,
  SemanticFactProvenance,
  SemanticFactStatus,
  SemanticFactType,
  SemanticStore,
} from "../../semantic/index.js";
import type { VectorChunk, VectorStore } from "../../vector/index.js";

const EMBEDDING_DIMENSION = 1536;

export const TENANT_ALPHA_ID = "11111111-1111-1111-1111-111111111111";
export const TENANT_BETA_ID = "22222222-2222-2222-2222-222222222222";

export function createEmbedding(
  seed: number,
  dimensions = EMBEDDING_DIMENSION,
): number[] {
  return Array.from({ length: dimensions }, (_, index) => {
    const raw = Math.sin(seed * 37 + index * 13) * 0.5 + 0.5;
    return Number(raw.toFixed(6));
  });
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    dot += l * r;
    leftMagnitude += l * l;
    rightMagnitude += r * r;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export interface TenantVectorFixture {
  store: VectorStore;
  writeChunk: (input: {
    tenantId: string;
    artifactId: string;
    content: string;
    embedding: number[];
    chunkIndex?: number;
    metadata?: Record<string, unknown>;
  }) => Promise<VectorChunk>;
}

export function createTenantVectorFixture(): TenantVectorFixture {
  const chunks = new Map<string, VectorChunk>();

  const store: VectorStore = {
    async insertChunk(chunk): Promise<void> {
      if (chunk.metadata.tenant_id !== chunk.tenantId) {
        throw new Error(
          "chunk metadata must include tenant_id matching tenantId",
        );
      }
      chunks.set(chunk.id, chunk);
    },
    async insertChunks(inputChunks): Promise<void> {
      for (const chunk of inputChunks) {
        await this.insertChunk(chunk);
      }
    },
    async hybridSearch(queryText, queryEmbedding, tenantId, options) {
      if (!tenantId) {
        throw new Error("hybridSearch requires tenantId filter");
      }

      return Array.from(chunks.values())
        .filter((chunk) => chunk.tenantId === tenantId)
        .map((chunk) => {
          const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
          const ftsRank = chunk.content.includes(queryText) ? 1 : 0;
          const combinedScore =
            similarity * options.vectorWeight + ftsRank * options.ftsWeight;
          return { chunk, similarity, ftsRank, combinedScore };
        })
        .filter((entry) => entry.combinedScore >= options.threshold)
        .sort((left, right) => right.combinedScore - left.combinedScore)
        .slice(0, options.limit);
    },
    async vectorSearch(queryEmbedding, tenantId, options) {
      if (!tenantId) {
        throw new Error("vectorSearch requires tenantId filter");
      }

      return Array.from(chunks.values())
        .filter((chunk) => chunk.tenantId === tenantId)
        .map((chunk) => ({
          chunk,
          similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .filter((entry) => entry.similarity >= options.threshold)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, options.limit);
    },
    async getProvenance(): Promise<ProvenanceRecord | null> {
      return null;
    },
    async deleteByArtifactId(artifactId, tenantId): Promise<number> {
      if (tenantId === "") {
        throw new Error("tenantId is required");
      }

      let deleted = 0;
      for (const [chunkId, chunk] of chunks.entries()) {
        if (chunk.artifactId === artifactId && chunk.tenantId === tenantId) {
          chunks.delete(chunkId);
          deleted += 1;
        }
      }
      return deleted;
    },
  };

  return {
    store,
    async writeChunk(input) {
      const chunk: VectorChunk = {
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        artifactId: input.artifactId,
        content: input.content,
        embedding: input.embedding,
        chunkIndex: input.chunkIndex ?? 0,
        metadata: {
          tenant_id: input.tenantId,
          ...(input.metadata ?? {}),
        },
      };

      await store.insertChunk(chunk);
      return chunk;
    },
  };
}

export interface TenantSemanticFixture {
  store: SemanticStore;
  writeFact: (input: {
    organizationId: string;
    type: SemanticFactType;
    content: string;
    embedding: number[];
    status?: SemanticFactStatus;
    metadata?: Record<string, unknown>;
  }) => Promise<SemanticFact>;
}

export function createTenantSemanticFixture(): TenantSemanticFixture {
  const facts = new Map<string, SemanticFact>();

  const store: SemanticStore = {
    async insert(fact): Promise<void> {
      if (fact.metadata.tenant_id !== fact.organizationId) {
        throw new Error(
          "semantic metadata must include tenant_id matching organizationId",
        );
      }
      facts.set(fact.id, fact);
    },
    async update(id, updates): Promise<void> {
      const existing = facts.get(id);
      if (!existing) {
        return;
      }
      facts.set(id, {
        ...existing,
        ...updates,
      });
    },
    async findById(id): Promise<SemanticFact | null> {
      return facts.get(id) ?? null;
    },
    async findByOrganization(organizationId, type): Promise<SemanticFact[]> {
      return Array.from(facts.values()).filter(
        (fact) =>
          fact.organizationId === organizationId &&
          (!type || fact.type === type),
      );
    },
    async findFiltered({
      organizationId,
      type,
      agentType,
      sessionId,
      memoryType,
      minImportance,
      limit = 10,
    }): Promise<SemanticFact[]> {
      return Array.from(facts.values())
        .filter((fact) => fact.organizationId === organizationId)
        .filter((fact) => (!type ? true : fact.type === type))
        .filter((fact) =>
          !agentType ? true : fact.metadata["agentType"] === agentType,
        )
        .filter((fact) =>
          !sessionId ? true : fact.metadata["session_id"] === sessionId,
        )
        .filter((fact) =>
          !memoryType
            ? true
            : fact.metadata["agent_memory_type"] === memoryType,
        )
        .filter((fact) => {
          const importance =
            typeof fact.metadata["importance"] === "number"
              ? fact.metadata["importance"]
              : 0;
          return minImportance === undefined
            ? true
            : importance >= minImportance;
        })
        .slice(0, limit);
    },
    async searchByEmbedding(embedding, organizationId, options) {
      return Array.from(facts.values())
        .filter((fact) => fact.organizationId === organizationId)
        .filter((fact) => (!options.type ? true : fact.type === options.type))
        .filter((fact) =>
          !options.statusFilter
            ? true
            : options.statusFilter.includes(fact.status),
        )
        .map((fact) => ({
          fact,
          similarity: cosineSimilarity(embedding, fact.embedding),
        }))
        .filter((entry) => entry.similarity >= options.threshold)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, options.limit);
    },
    async getProvenance(): Promise<SemanticFactProvenance | null> {
      return null;
    },
  };

  return {
    store,
    async writeFact(input) {
      const fact: SemanticFact = {
        id: crypto.randomUUID(),
        type: input.type,
        content: input.content,
        embedding: input.embedding,
        metadata: {
          tenant_id: input.organizationId,
          ...(input.metadata ?? {}),
        },
        status: input.status ?? "approved",
        version: 1,
        organizationId: input.organizationId,
        confidenceScore: 0.9,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await store.insert(fact);
      return fact;
    },
  };
}
