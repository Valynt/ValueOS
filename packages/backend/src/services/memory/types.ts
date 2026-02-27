/**
 * ValueOS Memory-First Architecture
 * TypeScript Type Definitions v1.0.0
 */

export type UUID = string;
export type Vector1536 = number[];
export type JSONB = Record<string, unknown>;

export enum UserRole {
  ADMIN = "admin",
  EDITOR = "editor",
  VIEWER = "viewer",
  GUEST = "guest",
}

export enum ValueCaseStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
  WON = "won",
  LOST = "lost",
}

export enum FactStatus {
  DRAFT = "draft",
  APPROVED = "approved",
  DEPRECATED = "deprecated",
}

export enum NarrativeStatus {
  DRAFT = "draft",
  REVIEW = "review",
  FINAL = "final",
  DEPRECATED = "deprecated",
}

export enum ApprovalDecision {
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum AccessGrantTier {
  READ_ONLY = "read_only",
  COMMENTER = "commenter",
  FULL_ACCESS = "full_access",
}

export enum VersionStatus {
  DRAFT = "draft",
  PENDING = "pending",
  APPROVED = "approved",
  SUPERSEDED = "superseded",
  REJECTED = "rejected",
}

export enum BenchmarkTier {
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3,
}

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
  source_type?: "email" | "meeting_transcript" | "pdf" | "spreadsheet";
  file_size_bytes?: number;
  content_hash?: string;
}

export interface ModelRunInputs extends JSONB {
  temperature: number;
  max_tokens: number;
  system_fingerprint?: string;
  tools_enabled?: string[];
}

export interface Tenant {
  id: UUID;
  name: string;
  slug: string;
  settings: TenantSettings;
  created_at: Date;
  updated_at: Date;
}

export interface Profile {
  id: UUID;
  tenant_id: UUID;
  full_name: string | null;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export interface ValueCase {
  id: UUID;
  tenant_id: UUID;
  title: string;
  description: string | null;
  status: ValueCaseStatus;
  domain_pack_id: UUID | null;
  domain_pack_version: string | null;
  domain_pack_snapshot: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

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

export interface ArtifactChunk {
  id: UUID;
  tenant_id: UUID;
  artifact_id: UUID;
  content: string;
  embedding: Vector1536 | null;
  chunk_index: number;
  metadata: JSONB;
}

export interface Entity {
  id: UUID;
  tenant_id: UUID;
  name: string;
  entity_type: string;
  description: string | null;
  embedding: Vector1536 | null;
  created_at: Date;
}

export interface EntityEdge {
  id: UUID;
  tenant_id: UUID;
  source_id: UUID;
  target_id: UUID;
  relationship_type: string;
  weight: number;
  metadata: JSONB;
  created_at: Date;
}

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

export interface FactEvidence {
  id: UUID;
  tenant_id: UUID;
  fact_id: UUID;
  chunk_id: UUID | null;
  quote: string | null;
  confidence_score: number | null;
  created_at: Date;
}

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
  parent_id: UUID | null;
  version: number;
  name: string;
  industry: string;
  geo: string;
  company_size_range: string;
  tier: BenchmarkTier;
  metrics: Record<string, unknown>;
  checksum: string;
  is_active: boolean;
  created_at: Date;
  benchmark_id?: string;
  version_id?: string;
  value_at_execution?: number;
  label?: string;
}

export interface ModelRun {
  id: UUID;
  tenant_id: UUID;
  value_case_id?: string;
  model_name: string;
  engine_version?: string;
  run_hash?: string;
  input_prompt: string | null;
  output_response: string | null;
  inputs?: Record<string, unknown>;
  results?: Record<string, number>;
  benchmarks?: BenchmarkSlice[];
  tokens_used: number | null;
  latency_ms: number | null;
  status: string;
  created_at: Date;
}

export interface ModelRunEvidence {
  id: UUID;
  model_run_id: UUID;
  fact_id: UUID | null;
  relevance_score: number | null;
}

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

export interface Approval {
  id: UUID;
  tenant_id: UUID;
  resource_type: "fact" | "narrative";
  resource_id: UUID;
  approver_id: UUID | null;
  decision: ApprovalDecision;
  comments: string | null;
  created_at: Date;
}

export interface ApprovalRecord {
  id?: UUID;
  object_id: string;
  version: number;
  approver_id: UUID;
  decision: ApprovalDecision;
  notes?: string;
  timestamp: Date;
}

export interface ApprovalContext {
  approverId: UUID;
  notes?: string;
}

export interface VersionableObject {
  id: string;
  version: number;
  status: VersionStatus;
  approved_at?: Date;
  approved_by?: UUID;
}

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

export interface MemoryEnvelope<TInput = unknown, TOutput = unknown> {
  invocation_id: UUID;
  timestamp: Date;
  agent_id: string;
  input: TInput;
  output: TOutput;
  evidence_used: {
    facts: Fact[];
    chunks: ArtifactChunk[];
    retrieval_scores: Record<UUID, number>;
  };
  memory_writes: {
    facts_created: UUID[];
    entities_extracted: UUID[];
    narratives_generated: UUID[];
  };
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

export interface HybridSearchResult {
  id: UUID;
  content: string;
  metadata: ArtifactMetadata;
  similarity: number;
  fts_rank: number;
  combined_score: number;
  citation_label?: string;
}

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

export interface BenchmarkFilter {
  industry?: string;
  geo?: string;
  size_range?: string;
  tier?: BenchmarkTier;
  tags?: string[];
}

export interface LockedBenchmarkRun {
  lock_id: string;
  slice_id: string;
  provenance_hash: string;
  timestamp: Date;
}

export interface ModelDiff {
  [key: string]: {
    absolute_delta: number;
    percentage_change: number;
  };
}

export interface GrantCreationParams {
  tenantId: UUID;
  resourceType: "value_case" | "artifact" | "narrative";
  resourceId: UUID;
  granteeEmail: string;
  tier: AccessGrantTier;
  expiresInDays?: number;
  createdBy: UUID;
}

export interface ValidationResult {
  isValid: boolean;
  grant?: AccessGrant;
  error?: string;
}

export interface RetrievalOptions {
  query_text: string;
  query_embedding: Vector1536;
  value_case_id: UUID;
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

export interface ExtractedKnowledge {
  facts: Array<{ claim: string; quote: string; confidence: number }>;
  entities: Array<{ name: string; type: string; description: string }>;
}

export interface Chunk {
  content: string;
  metadata: JSONB;
}

export enum PersonaType {
  CFO = "CFO",
  VP_SALES = "VP_SALES",
}

export interface NarrativeRequest {
  valueCaseId: UUID;
  persona: PersonaType;
  title: string;
  additionalContext?: string;
}
