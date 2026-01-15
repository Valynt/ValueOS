/**
 * ValueOS Memory-First Architecture
 * TypeScript Type Definitions v1.0.0
 * 
 * This file defines the core data structures for a B2B deal-centric knowledge OS.
 * It follows the multi-layered memory model: Episodic, Semantic, and Computational.
 */

/**
 * Fundamental Types
 */
export type UUID = string;
export type Vector1536 = number[]; // Optimized for OpenAI/Modern embeddings
export type JSONB = Record<string, any>;

/**
 * Enumerations for Governance and Status Tracking
 */
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  GUEST = 'guest'
}

export enum ValueCaseStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  WON = 'won',
  LOST = 'lost'
}

export enum FactStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  DEPRECATED = 'deprecated'
}

export enum NarrativeStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  FINAL = 'final',
  DEPRECATED = 'deprecated'
}

export enum ApprovalDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum AccessGrantTier {
  READ_ONLY = 'read_only',
  COMMENTER = 'commenter',
  FULL_ACCESS = 'full_access'
}

/**
 * Metadata Interfaces for JSONB fields
 */
export interface TenantSettings extends JSONB {
  allowed_domains?: string[];
  theme?: Record<string, string>;
  ai_config?: {
    preferred_model?: string;
    temperature?: number;
  };
}

export interface ArtifactMetadata extends JSONB {
  page_count?: number;
  author?: string;
  source_type?: 'email' | 'meeting_transcript' | 'pdf' | 'spreadsheet';
  file_size_bytes?: number;
}

export interface ModelRunInputs extends JSONB {
  temperature: number;
  max_tokens: number;
  system_fingerprint?: string;
  tools_enabled?: string[];
}

/**
 * ==========================================
 * 1. CORE IDENTITY & ISOLATION
 * ==========================================
 */

/**
 * Represents a corporate entity or account isolation boundary.
 */
export interface Tenant {
  id: UUID;
  name: string;
  slug: string;
  settings: TenantSettings;
  created_at: Date;
  updated_at: Date;
}

/**
 * User profile extending the core authentication layer.
 */
export interface Profile {
  id: UUID;
  tenant_id: UUID;
  full_name: string | null;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

/**
 * ==========================================
 * 2. EPISODIC MEMORY LAYER
 * Captures raw inputs, artifacts, and time-bound events.
 * ==========================================
 */

/**
 * High-level business initiatives or deal containers.
 */
export interface ValueCase {
  id: UUID;
  tenant_id: UUID;
  title: string;
  description: string | null;
  status: ValueCaseStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * Raw knowledge inputs (Documents, Emails, Transcripts).
 */
export interface Artifact {
  id: UUID;
  tenant_id: UUID;
  value_case_id: UUID | null;
  source_url: string | null;
  title: string;
  content_type: string | null;
  metadata: ArtifactMetadata;
  created_at: Date;
}

/**
 * Atomic segments of artifacts for vector retrieval and hybrid search.
 */
export interface ArtifactChunk {
  id: UUID;
  tenant_id: UUID;
  artifact_id: UUID;
  content: string;
  embedding: Vector1536 | null;
  chunk_index: number;
  metadata: JSONB;
}

/**
 * ==========================================
 * 3. SEMANTIC MEMORY LAYER
 * The Knowledge Graph: Entities and their inter-relationships.
 * ==========================================
 */

/**
 * Extracted business entities (People, Organizations, Products).
 */
export interface Entity {
  id: UUID;
  tenant_id: UUID;
  name: string;
  entity_type: string; // e.g., 'PERSON', 'ORG'
  description: string | null;
  embedding: Vector1536 | null;
  created_at: Date;
}

/**
 * Relationships connecting entities within the semantic graph.
 */
export interface EntityEdge {
  id: UUID;
  tenant_id: UUID;
  source_id: UUID;
  target_id: UUID;
  relationship_type: string; // e.g., 'WORKS_AT'
  weight: number;
  metadata: JSONB;
  created_at: Date;
}

/**
 * ==========================================
 * 4. DECLARATIVE / HIGH-FIDELITY LAYER
 * Curated truths with strict versioning and evidence lineage.
 * ==========================================
 */

/**
 * Validated claims representing the "Source of Truth" for the tenant.
 */
export interface Fact {
  id: UUID;
  tenant_id: UUID;
  claim: string;
  status: FactStatus;
  version: number;
  embedding: Vector1536 | null;
  created_by: UUID | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Links facts back to the episodic chunks they were derived from (Provenance).
 */
export interface FactEvidence {
  id: UUID;
  tenant_id: UUID;
  fact_id: UUID;
  chunk_id: UUID | null;
  quote: string | null;
  confidence_score: number | null;
  created_at: Date;
}

/**
 * ==========================================
 * 5. COMPUTATIONAL & EVALUATION LAYER
 * Tracks agent performance, benchmarks, and inference history.
 * ==========================================
 */

export interface BenchmarkDataset {
  id: UUID;
  tenant_id: UUID;
  name: string;
  description: string | null;
  created_at: Date;
}

export interface BenchmarkVersion {
  id: UUID;
  dataset_id: UUID;
  version_tag: string;
  is_active: boolean;
  created_at: Date;
}

export interface BenchmarkSlice {
  id: UUID;
  version_id: UUID;
  slice_name: string;
  filter_criteria: JSONB;
}

/**
 * Execution log of an AI model invocation.
 */
export interface ModelRun {
  id: UUID;
  tenant_id: UUID;
  model_name: string;
  input_prompt: string | null;
  output_response: string | null;
  tokens_used: number | null;
  latency_ms: number | null;
  status: string; // e.g., 'success', 'error'
  created_at: Date;
}

/**
 * Facts cited or used by a model during a specific run.
 */
export interface ModelRunEvidence {
  id: UUID;
  model_run_id: UUID;
  fact_id: UUID | null;
  relevance_score: number | null;
}

/**
 * ==========================================
 * 6. OUTPUT & GOVERNANCE LAYER
 * Final generated content and audit trails.
 * ==========================================
 */

/**
 * Synthesized AI reports or outbound content.
 */
export interface Narrative {
  id: UUID;
  tenant_id: UUID;
  value_case_id: UUID | null;
  title: string;
  body: string;
  status: NarrativeStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Audit trail for approvals of facts or narratives.
 */
export interface Approval {
  id: UUID;
  tenant_id: UUID;
  resource_type: 'fact' | 'narrative';
  resource_id: UUID;
  approver_id: UUID | null;
  decision: ApprovalDecision;
  comments: string | null;
  created_at: Date;
}

/**
 * Temporary or scoped access for external stakeholders.
 */
export interface AccessGrant {
  id: UUID;
  tenant_id: UUID;
  resource_type: string;
  resource_id: UUID;
  grantee_email: string | null;
  token_hash: string | null;
  tier: AccessGrantTier;
  expires_at: Date | null;
  created_at: Date;
}

/**
 * ==========================================
 * 7. SYSTEM ARCHITECTURE WRAPPERS
 * Specialized types for search and agentic flow.
 * ==========================================
 */

/**
 * The 'Memory Envelope' wraps agentic actions with full contextual awareness.
 * Used for auditing how an agent interacted with the memory systems.
 */
export interface MemoryEnvelope<TInput = any, TOutput = any> {
  invocation_id: UUID;
  timestamp: Date;
  agent_id: string;
  
  /** The specific instruction or payload sent to the agent */
  input: TInput;
  
  /** The raw response from the LLM or Tool */
  output: TOutput;
  
  /** Lineage: What facts or chunks were retrieved to generate this output */
  evidence_used: {
    facts: Fact[];
    chunks: ArtifactChunk[];
    retrieval_scores: Record<UUID, number>;
  };
  
  /** Side-effects: What new information was committed to memory layers */
  memory_writes: {
    facts_created: UUID[];
    entities_extracted: UUID[];
    narratives_generated: UUID[];
  };
  
  /** Performance and cost metadata */
  telemetry: {
    latency_ms: number;
    token_usage: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost_usd: number;
  };
}

/**
 * Represents the structured result of a Hybrid (Vector + FTS) search.
 */
export interface HybridSearchResult {
  /** Reference to the artifact chunk */
  id: UUID;
  
  /** The text content found */
  content: string;
  
  /** Source artifact metadata for citation UI */
  metadata: ArtifactMetadata;
  
  /** Distance-based similarity (0 to 1) */
  similarity: number;
  
  /** BM25/FTS ranking score */
  fts_rank: number;
  
  /** Weighted combination of similarity and fts_rank */
  combined_score: number;
  
  /** Contextual citation string, e.g., "Source: Q3 Earnings Call, p. 12" */
  citation_label?: string;
}

/**
 * Search Parameters for the Hybrid Search Utility
 */
export interface SearchParams {
  query_text: string;
  query_embedding: Vector1536;
  match_threshold: number;
  match_count: number;
  weights?: {
    full_text: number;
    semantic: number;
  };
}