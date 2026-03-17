/**
 * Memory pattern reference — copy-ready examples for common memory operations.
 *
 * All patterns assume execution inside a BaseAgent subclass where
 * `this.memorySystem`, `this.organizationId`, and `this.name` are available.
 */

// ============================================================================
// Pattern 1: Read prior agent output (most common inter-agent pattern)
// ============================================================================

// Read hypotheses written by OpportunityAgent
async function readUpstreamHypotheses(context: { workspace_id: string; organization_id: string }) {
  const memories = await this.memorySystem.retrieve({
    agent_id: "opportunity",                    // the agent that wrote the data
    workspace_id: context.workspace_id,
    organization_id: context.organization_id,   // REQUIRED
    memory_type: "semantic",
    limit: 20,
    min_importance: 0.5,
  });

  return memories.filter(
    (m) => m.metadata?.type === "hypothesis",   // narrow by metadata type if needed
  );
}

// ============================================================================
// Pattern 2: Write output for downstream agents
// ============================================================================

async function writeResultForDownstream(
  context: { workspace_id: string; organization_id: string },
  result: { title: string; value: number },
) {
  await this.memorySystem.storeSemanticMemory(
    context.workspace_id,         // sessionId
    this.name,                    // agentId — use this.name, not a hardcoded string
    "semantic",                   // type
    `Result: ${result.title} — value: ${result.value}`,  // content (human-readable)
    {
      type: "my_result",          // metadata type — downstream agents filter on this
      title: result.title,
      value: result.value,
      organization_id: context.organization_id,  // include in metadata for filter queries
      importance: 0.7,            // 0–1; higher = less likely to be evicted
    },
    this.organizationId,          // REQUIRED last arg — write scope
  );
}

// ============================================================================
// Pattern 3: Write an episodic record (agent invocation log)
// ============================================================================

async function writeEpisodicRecord(
  context: { workspace_id: string; organization_id: string },
  summary: string,
) {
  await this.memorySystem.storeEpisodicMemory(
    context.workspace_id,
    this.name,
    summary,
    { organization_id: context.organization_id },
    this.organizationId,          // REQUIRED last arg
  );
}

// ============================================================================
// Pattern 4: Vector / hybrid search (packages/memory — cross-session)
// ============================================================================
//
// The packages/memory API is class-based. VectorMemory and SemanticMemory are
// instantiated with a store implementation (dependency injection) — there are
// no free-function exports like hybridSearch() or storeSemanticFact().
//
// hybridSearch() requires a pre-computed embedding (number[1536]).
// Generate it via the LLM embedding API before calling.

import { type HybridSearchOptions, VectorMemory } from "@valueos/memory";

async function vectorSearch(
  vectorMemory: VectorMemory,   // injected — do not construct inline
  organizationId: string,
  queryText: string,
  queryEmbedding: number[],     // number[1536] — pre-computed
) {
  const results = await vectorMemory.hybridSearch({
    queryText,
    queryEmbedding,
    tenantId: organizationId,   // REQUIRED — tenant isolation
    limit: 10,
    attachProvenance: true,     // include confidence chain for CFO-defence traceability
  } satisfies HybridSearchOptions);

  return results.map((r) => ({
    content: r.chunk.content,
    score: r.combinedScore,     // 70% vector + 30% BM25
    confidence: r.confidence,
  }));
}

// ============================================================================
// Pattern 5: Failure guard — check memory before proceeding
// ============================================================================

async function requireUpstreamData(context: { workspace_id: string; organization_id: string }) {
  const memories = await this.memorySystem.retrieve({
    agent_id: "opportunity",
    workspace_id: context.workspace_id,
    organization_id: context.organization_id,
  });

  if (memories.length === 0) {
    // Return a failure output — do not throw, let the orchestrator handle it
    return null;
  }

  return memories;
}
