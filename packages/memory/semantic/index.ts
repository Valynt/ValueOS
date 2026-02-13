/**
 * @valueos/memory/semantic
 *
 * Semantic memory — facts, knowledge, learned information.
 *
 * Implements a Knowledge Graph in vector space with contradiction detection,
 * fact lifecycle management (draft → approved → deprecated), and provenance
 * attachment for the "CFO Defence" requirement.
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export type SemanticFactType =
  | 'value_proposition'
  | 'target_definition'
  | 'opportunity'
  | 'integrity_check'
  | 'workflow_result';

export type SemanticFactStatus = 'draft' | 'approved' | 'deprecated';

export interface SemanticFact {
  id: string;
  type: SemanticFactType;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  status: SemanticFactStatus;
  version: number;
  organizationId: string;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface SemanticSearchResult {
  fact: SemanticFact;
  similarity: number;
  provenance?: SemanticFactProvenance;
}

export interface SemanticFactProvenance {
  source: string;
  sourceId?: string;
  confidenceScore: number;
  evidenceTier: 1 | 2 | 3;
  lineageDepth: number;
}

export interface ContradictionResult {
  hasContradiction: boolean;
  conflictingFacts: Array<{
    fact: SemanticFact;
    similarity: number;
  }>;
  /** When true, the new fact should be routed to adversarial review */
  requiresReview: boolean;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const SemanticFactTypeSchema = z.enum([
  'value_proposition',
  'target_definition',
  'opportunity',
  'integrity_check',
  'workflow_result',
]);

export const SemanticFactStatusSchema = z.enum([
  'draft',
  'approved',
  'deprecated',
]);

export const SemanticFactInputSchema = z.object({
  type: SemanticFactTypeSchema,
  content: z.string().min(1).max(50_000),
  embedding: z.array(z.number()).length(1536),
  metadata: z.record(z.unknown()).default({}),
  organizationId: z.string().uuid(),
  confidenceScore: z.number().min(0).max(1),
  createdBy: z.string().uuid().optional(),
});

export type SemanticFactInput = z.infer<typeof SemanticFactInputSchema>;

export const SemanticSearchOptionsSchema = z.object({
  embedding: z.array(z.number()).length(1536),
  organizationId: z.string().uuid(),
  type: SemanticFactTypeSchema.optional(),
  threshold: z.number().min(0).max(1).default(0.7),
  limit: z.number().int().min(1).max(100).default(10),
  statusFilter: z.array(SemanticFactStatusSchema).optional(),
  attachProvenance: z.boolean().default(true),
});

export type SemanticSearchOptions = z.infer<typeof SemanticSearchOptionsSchema>;

// ============================================================================
// Persistence Interface (dependency injection)
// ============================================================================

export interface SemanticStore {
  insert(fact: SemanticFact): Promise<void>;
  update(id: string, updates: Partial<Pick<SemanticFact, 'status' | 'version' | 'updatedAt' | 'metadata'>>): Promise<void>;
  findById(id: string): Promise<SemanticFact | null>;
  findByOrganization(organizationId: string, type?: SemanticFactType): Promise<SemanticFact[]>;

  /**
   * Vector similarity search against semantic_memory / memory_facts.
   * Maps to the `search_semantic_memory()` DB function.
   */
  searchByEmbedding(
    embedding: number[],
    organizationId: string,
    options: { threshold: number; limit: number; type?: SemanticFactType; statusFilter?: SemanticFactStatus[] },
  ): Promise<Array<{ fact: SemanticFact; similarity: number }>>;

  /** Fetch provenance metadata for a fact (joins memory_provenance / agent_memory provenance JSONB) */
  getProvenance(factId: string): Promise<SemanticFactProvenance | null>;
}

// ============================================================================
// Contradiction Detection
// ============================================================================

/**
 * Similarity above this threshold with different content signals a potential
 * contradiction. Tuned to catch near-duplicates that disagree on values.
 */
const CONTRADICTION_SIMILARITY_THRESHOLD = 0.85;

/**
 * Check whether a new fact contradicts existing approved facts.
 *
 * Two facts "contradict" when they occupy nearly the same vector-space
 * region (high cosine similarity) but carry different content. This is
 * a heuristic — the adversarial review stage makes the final call.
 */
async function detectContradictions(
  store: SemanticStore,
  input: SemanticFactInput,
): Promise<ContradictionResult> {
  const candidates = await store.searchByEmbedding(
    input.embedding,
    input.organizationId,
    {
      threshold: CONTRADICTION_SIMILARITY_THRESHOLD,
      limit: 5,
      type: input.type,
      statusFilter: ['approved'],
    },
  );

  const conflicting = candidates.filter(
    (c) => c.fact.content !== input.content,
  );

  return {
    hasContradiction: conflicting.length > 0,
    conflictingFacts: conflicting,
    requiresReview: conflicting.some(
      (c) => c.similarity >= CONTRADICTION_SIMILARITY_THRESHOLD,
    ),
  };
}

// ============================================================================
// SemanticMemory
// ============================================================================

export class SemanticMemory {
  private _store: SemanticStore;

  constructor(store: SemanticStore) {
    this._store = store;
  }

  // --------------------------------------------------------------------------
  // Write path: Draft → Conflict Check → (Approval) → Active
  // --------------------------------------------------------------------------

  /**
   * Store a new semantic fact.
   *
   * Facts always enter as `draft`. The caller receives a ContradictionResult
   * so it can route to adversarial review when conflicts are detected.
   */
  async store(input: SemanticFactInput): Promise<{
    fact: SemanticFact;
    contradictions: ContradictionResult;
  }> {
    const validated = SemanticFactInputSchema.parse(input);
    const contradictions = await detectContradictions(this._store, validated);

    const fact: SemanticFact = {
      id: crypto.randomUUID(),
      type: validated.type,
      content: validated.content,
      embedding: validated.embedding,
      metadata: validated.metadata,
      status: 'draft',
      version: 1,
      organizationId: validated.organizationId,
      confidenceScore: validated.confidenceScore,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: validated.createdBy,
    };

    await this._store.insert(fact);

    return { fact, contradictions };
  }

  /**
   * Approve a draft fact, promoting it to the active knowledge graph.
   * Bumps version if the fact was previously deprecated and re-approved.
   */
  async approve(factId: string): Promise<SemanticFact> {
    const fact = await this._store.findById(factId);
    if (!fact) throw new Error(`Semantic fact not found: ${factId}`);
    if (fact.status === 'approved') return fact;

    const nextVersion = fact.status === 'deprecated' ? fact.version + 1 : fact.version;

    await this._store.update(factId, {
      status: 'approved',
      version: nextVersion,
      updatedAt: new Date().toISOString(),
    });

    return { ...fact, status: 'approved', version: nextVersion };
  }

  /**
   * Deprecate a fact. Does not delete — preserves audit trail.
   */
  async deprecate(factId: string): Promise<SemanticFact> {
    const fact = await this._store.findById(factId);
    if (!fact) throw new Error(`Semantic fact not found: ${factId}`);

    await this._store.update(factId, {
      status: 'deprecated',
      updatedAt: new Date().toISOString(),
    });

    return { ...fact, status: 'deprecated' };
  }

  // --------------------------------------------------------------------------
  // Read path: Search with automatic provenance attachment
  // --------------------------------------------------------------------------

  /**
   * Search semantic memory by vector similarity.
   *
   * When `attachProvenance` is true (default), each result includes its
   * provenance chain so the UI can render the transparency layer
   * ("Source: Q3 Benchmark Report; Confidence: 92%").
   */
  async search(options: SemanticSearchOptions): Promise<SemanticSearchResult[]> {
    const validated = SemanticSearchOptionsSchema.parse(options);

    const raw = await this._store.searchByEmbedding(
      validated.embedding,
      validated.organizationId,
      {
        threshold: validated.threshold,
        limit: validated.limit,
        type: validated.type,
        statusFilter: validated.statusFilter,
      },
    );

    const results: SemanticSearchResult[] = [];

    for (const entry of raw) {
      let provenance: SemanticFactProvenance | undefined;

      if (validated.attachProvenance) {
        provenance = (await this._store.getProvenance(entry.fact.id)) ?? undefined;
      }

      results.push({
        fact: entry.fact,
        similarity: entry.similarity,
        provenance,
      });
    }

    return results;
  }

  /**
   * Run a contradiction check without storing anything.
   * Useful for pre-flight validation in agent pipelines.
   */
  async checkContradictions(input: SemanticFactInput): Promise<ContradictionResult> {
    const validated = SemanticFactInputSchema.parse(input);
    return detectContradictions(this._store, validated);
  }

  /**
   * Retrieve a single fact by ID.
   */
  async getById(id: string): Promise<SemanticFact | null> {
    return this._store.findById(id);
  }

  /**
   * List all facts for an organization, optionally filtered by type.
   */
  async listByOrganization(
    organizationId: string,
    type?: SemanticFactType,
  ): Promise<SemanticFact[]> {
    return this._store.findByOrganization(organizationId, type);
  }
}
