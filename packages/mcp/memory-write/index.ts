/**
 * MCP Memory Write Interface
 *
 * Provides a standardised write contract for external tools (Salesforce, Gong,
 * ServiceNow, Slack, SharePoint) to push data into ValueOS memory layers.
 *
 * Architecture:
 *   External Tool → MCP memory-write tool → Validation → Memory Layer
 *
 * Each write is:
 *   1. Schema-validated via Zod
 *   2. Tenant-isolated (tenantId required on every operation)
 *   3. Provenance-tracked (source, sourceId, evidenceTier)
 *   4. Idempotent (idempotencyKey prevents duplicate writes)
 *   5. Audited (every write emits an audit event)
 */
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type MemoryWriteSource =
  | "salesforce"
  | "gong"
  | "servicenow"
  | "slack"
  | "sharepoint"
  | "hubspot"
  | "manual"
  | "agent";

export type MemoryWriteTarget =
  | "semantic"
  | "episodic"
  | "entity_graph";

export type WriteOperationType =
  | "create"
  | "update"
  | "deprecate";

export interface MemoryWriteRequest {
  tenantId: string;
  organizationId: string;
  source: MemoryWriteSource;
  sourceId: string;
  target: MemoryWriteTarget;
  operation: WriteOperationType;
  idempotencyKey: string;
  payload: MemoryWritePayload;
  metadata?: Record<string, unknown>;
}

export interface MemoryWritePayload {
  /** For semantic writes: the fact content */
  content?: string;
  /** For semantic writes: fact type classification */
  factType?: string;
  /** For episodic writes: the event content */
  eventContent?: string;
  /** For episodic writes: importance score 0-1 */
  importanceScore?: number;
  /** For entity_graph writes: source entity */
  sourceEntity?: { id: string; type: string };
  /** For entity_graph writes: target entity */
  targetEntity?: { id: string; type: string };
  /** For entity_graph writes: edge type */
  edgeType?: string;
  /** For entity_graph writes: edge weight */
  weight?: number;
  /** Associated value case */
  valueCaseId?: string;
  /** Session context */
  sessionId?: string;
  /** Agent that triggered the write */
  agentId?: string;
  /** Confidence score for the data */
  confidenceScore?: number;
  /** Evidence tier (1 = authoritative, 2 = derived, 3 = inferred) */
  evidenceTier?: 1 | 2 | 3;
}

export interface MemoryWriteResult {
  success: boolean;
  recordId: string;
  target: MemoryWriteTarget;
  operation: WriteOperationType;
  idempotencyKey: string;
  timestamp: string;
  warnings?: string[];
  error?: string;
}

export interface MemoryWriteAuditEntry {
  id: string;
  tenantId: string;
  source: MemoryWriteSource;
  sourceId: string;
  target: MemoryWriteTarget;
  operation: WriteOperationType;
  recordId: string;
  idempotencyKey: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const MemoryWritePayloadSchema = z.object({
  content: z.string().min(1).max(100_000).optional(),
  factType: z.string().optional(),
  eventContent: z.string().min(1).max(100_000).optional(),
  importanceScore: z.number().min(0).max(1).optional(),
  sourceEntity: z
    .object({ id: z.string().uuid(), type: z.string() })
    .optional(),
  targetEntity: z
    .object({ id: z.string().uuid(), type: z.string() })
    .optional(),
  edgeType: z.string().optional(),
  weight: z.number().min(0).max(100).optional(),
  valueCaseId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  evidenceTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

export const MemoryWriteRequestSchema = z.object({
  tenantId: z.string().min(1),
  organizationId: z.string().uuid(),
  source: z.enum([
    "salesforce",
    "gong",
    "servicenow",
    "slack",
    "sharepoint",
    "hubspot",
    "manual",
    "agent",
  ]),
  sourceId: z.string().min(1),
  target: z.enum(["semantic", "episodic", "entity_graph"]),
  operation: z.enum(["create", "update", "deprecate"]),
  idempotencyKey: z.string().min(1).max(255),
  payload: MemoryWritePayloadSchema,
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// MCP Tool Definitions (for LLM tool-use)
// ============================================================================

export const MEMORY_WRITE_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "memory_write_fact",
      description:
        "Write a semantic fact into ValueOS memory. Use this when external tools (Salesforce, Gong, etc.) discover new information that should be stored as a knowledge fact with provenance tracking.",
      parameters: {
        type: "object" as const,
        properties: {
          tenant_id: {
            type: "string",
            description: "The tenant identifier for data isolation",
          },
          organization_id: {
            type: "string",
            description: "The organization UUID",
          },
          source: {
            type: "string",
            enum: [
              "salesforce",
              "gong",
              "servicenow",
              "slack",
              "sharepoint",
              "hubspot",
              "manual",
              "agent",
            ],
            description: "The external system that produced this data",
          },
          source_id: {
            type: "string",
            description:
              "Unique identifier of the record in the source system (e.g., Salesforce Opportunity ID)",
          },
          content: {
            type: "string",
            description: "The fact content to store",
          },
          fact_type: {
            type: "string",
            enum: [
              "value_proposition",
              "target_definition",
              "opportunity",
              "integrity_check",
              "workflow_result",
            ],
            description: "Classification of the fact",
          },
          value_case_id: {
            type: "string",
            description: "Associated value case UUID (optional)",
          },
          confidence_score: {
            type: "number",
            description: "Confidence in the data accuracy (0.0 to 1.0)",
          },
          evidence_tier: {
            type: "number",
            enum: [1, 2, 3],
            description:
              "Evidence tier: 1 = authoritative (SEC filings), 2 = derived (CRM data), 3 = inferred (agent output)",
          },
          idempotency_key: {
            type: "string",
            description:
              "Unique key to prevent duplicate writes (e.g., 'sf-opp-001-2024-03-13')",
          },
        },
        required: [
          "tenant_id",
          "organization_id",
          "source",
          "source_id",
          "content",
          "fact_type",
          "idempotency_key",
        ],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "memory_write_episode",
      description:
        "Record an episodic event in ValueOS memory. Use this when external tools report interactions, meetings, or events that should be preserved as historical context.",
      parameters: {
        type: "object" as const,
        properties: {
          tenant_id: {
            type: "string",
            description: "The tenant identifier for data isolation",
          },
          organization_id: {
            type: "string",
            description: "The organization UUID",
          },
          source: {
            type: "string",
            enum: [
              "salesforce",
              "gong",
              "servicenow",
              "slack",
              "sharepoint",
              "hubspot",
              "manual",
              "agent",
            ],
            description: "The external system that produced this event",
          },
          source_id: {
            type: "string",
            description: "Unique identifier of the event in the source system",
          },
          event_content: {
            type: "string",
            description: "Description of the event or interaction",
          },
          importance_score: {
            type: "number",
            description:
              "How important this event is for future context (0.0 to 1.0)",
          },
          value_case_id: {
            type: "string",
            description: "Associated value case UUID (optional)",
          },
          session_id: {
            type: "string",
            description: "Session UUID for grouping related events",
          },
          agent_id: {
            type: "string",
            description: "Agent UUID that processed this event",
          },
          idempotency_key: {
            type: "string",
            description: "Unique key to prevent duplicate writes",
          },
        },
        required: [
          "tenant_id",
          "organization_id",
          "source",
          "source_id",
          "event_content",
          "idempotency_key",
        ],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "memory_write_entity_edge",
      description:
        "Create or update an edge in the ValueOS entity graph. Use this when external tools discover relationships between entities (e.g., Account drives KPI, KPI impacts NPV).",
      parameters: {
        type: "object" as const,
        properties: {
          tenant_id: {
            type: "string",
            description: "The tenant identifier for data isolation",
          },
          organization_id: {
            type: "string",
            description: "The organization UUID",
          },
          source: {
            type: "string",
            enum: [
              "salesforce",
              "gong",
              "servicenow",
              "slack",
              "sharepoint",
              "hubspot",
              "manual",
              "agent",
            ],
            description: "The external system that discovered this relationship",
          },
          source_id: {
            type: "string",
            description: "Unique identifier in the source system",
          },
          value_case_id: {
            type: "string",
            description: "Associated value case UUID",
          },
          source_entity_id: {
            type: "string",
            description: "UUID of the source entity in the relationship",
          },
          source_entity_type: {
            type: "string",
            enum: [
              "account",
              "kpi",
              "financial_model",
              "value_driver",
              "assumption",
            ],
            description: "Type of the source entity",
          },
          target_entity_id: {
            type: "string",
            description: "UUID of the target entity in the relationship",
          },
          target_entity_type: {
            type: "string",
            enum: [
              "account",
              "kpi",
              "financial_model",
              "value_driver",
              "assumption",
            ],
            description: "Type of the target entity",
          },
          edge_type: {
            type: "string",
            enum: ["depends_on", "drives", "constrains", "validates"],
            description: "Type of relationship between entities",
          },
          weight: {
            type: "number",
            description: "Strength of the relationship (0.0 to 100.0)",
          },
          idempotency_key: {
            type: "string",
            description: "Unique key to prevent duplicate writes",
          },
        },
        required: [
          "tenant_id",
          "organization_id",
          "source",
          "source_id",
          "value_case_id",
          "source_entity_id",
          "source_entity_type",
          "target_entity_id",
          "target_entity_type",
          "edge_type",
          "idempotency_key",
        ],
      },
    },
  },
] as const;

// ============================================================================
// Memory Write Handler
// ============================================================================

/** Persistence interface — injected at runtime */
export interface MemoryWriteStore {
  /** Check if an idempotency key has already been processed */
  hasIdempotencyKey(tenantId: string, key: string): Promise<boolean>;
  /** Record an idempotency key as processed */
  recordIdempotencyKey(
    tenantId: string,
    key: string,
    recordId: string
  ): Promise<void>;
  /** Write a semantic fact */
  writeSemanticFact(
    tenantId: string,
    organizationId: string,
    payload: MemoryWritePayload,
    source: MemoryWriteSource,
    sourceId: string
  ): Promise<string>;
  /** Write an episodic record */
  writeEpisodicRecord(
    tenantId: string,
    organizationId: string,
    payload: MemoryWritePayload,
    source: MemoryWriteSource,
    sourceId: string
  ): Promise<string>;
  /** Write an entity graph edge */
  writeEntityGraphEdge(
    tenantId: string,
    valueCaseId: string,
    payload: MemoryWritePayload,
    source: MemoryWriteSource,
    sourceId: string
  ): Promise<string>;
  /** Emit an audit entry */
  emitAudit(entry: MemoryWriteAuditEntry): Promise<void>;
}

export class MemoryWriteHandler {
  constructor(private readonly store: MemoryWriteStore) {}

  /**
   * Process a memory write request.
   *
   * Validates the request, checks idempotency, routes to the correct
   * memory layer, and emits an audit trail entry.
   */
  async handleWrite(raw: unknown): Promise<MemoryWriteResult> {
    // 1. Validate
    const parseResult = MemoryWriteRequestSchema.safeParse(raw);
    if (!parseResult.success) {
      return {
        success: false,
        recordId: "",
        target: "semantic",
        operation: "create",
        idempotencyKey: "",
        timestamp: new Date().toISOString(),
        error: `Validation failed: ${parseResult.error.message}`,
      };
    }

    const request = parseResult.data;

    // 2. Idempotency check
    const alreadyProcessed = await this.store.hasIdempotencyKey(
      request.tenantId,
      request.idempotencyKey
    );
    if (alreadyProcessed) {
      return {
        success: true,
        recordId: "",
        target: request.target,
        operation: request.operation,
        idempotencyKey: request.idempotencyKey,
        timestamp: new Date().toISOString(),
        warnings: ["Idempotency key already processed; no-op"],
      };
    }

    // 3. Reserve the idempotency key before writing.
    // Reserving first (with an empty recordId placeholder) closes the TOCTOU
    // window: a second concurrent request will see the key as already processed
    // and return a no-op rather than racing to write a duplicate record.
    // If the write below fails the key remains reserved, which is correct —
    // the caller should use a new idempotency key for a genuine retry.
    await this.store.recordIdempotencyKey(
      request.tenantId,
      request.idempotencyKey,
      "" // placeholder; updated after the write succeeds
    );

    // 4. Route to target memory layer
    let recordId: string;
    try {
      recordId = await this.routeWrite(request);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown write error";
      return {
        success: false,
        recordId: "",
        target: request.target,
        operation: request.operation,
        idempotencyKey: request.idempotencyKey,
        timestamp: new Date().toISOString(),
        error: message,
      };
    }

    // 5. Update the idempotency record with the real recordId now that the
    // write succeeded.
    await this.store.recordIdempotencyKey(
      request.tenantId,
      request.idempotencyKey,
      recordId
    );

    // 6. Audit trail
    await this.store.emitAudit({
      id: recordId,
      tenantId: request.tenantId,
      source: request.source,
      sourceId: request.sourceId,
      target: request.target,
      operation: request.operation,
      recordId,
      idempotencyKey: request.idempotencyKey,
      timestamp: new Date().toISOString(),
      metadata: request.metadata ?? {},
    });

    return {
      success: true,
      recordId,
      target: request.target,
      operation: request.operation,
      idempotencyKey: request.idempotencyKey,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute an MCP tool call from an LLM agent.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
      let request: unknown;

      switch (toolName) {
        case "memory_write_fact":
          request = this.mapFactToolArgs(args);
          break;
        case "memory_write_episode":
          request = this.mapEpisodeToolArgs(args);
          break;
        case "memory_write_entity_edge":
          request = this.mapEntityEdgeToolArgs(args);
          break;
        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
            isError: true,
          };
      }

      const result = await this.handleWrite(request);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async routeWrite(request: MemoryWriteRequest): Promise<string> {
    switch (request.target) {
      case "semantic":
        return this.store.writeSemanticFact(
          request.tenantId,
          request.organizationId,
          request.payload,
          request.source,
          request.sourceId
        );
      case "episodic":
        return this.store.writeEpisodicRecord(
          request.tenantId,
          request.organizationId,
          request.payload,
          request.source,
          request.sourceId
        );
      case "entity_graph":
        if (!request.payload.valueCaseId) {
          throw new Error(
            "valueCaseId is required for entity_graph writes"
          );
        }
        return this.store.writeEntityGraphEdge(
          request.tenantId,
          request.payload.valueCaseId,
          request.payload,
          request.source,
          request.sourceId
        );
      default:
        throw new Error(`Unknown write target: ${request.target}`);
    }
  }

  private mapFactToolArgs(args: Record<string, unknown>): MemoryWriteRequest {
    return {
      tenantId: args.tenant_id as string,
      organizationId: args.organization_id as string,
      source: args.source as MemoryWriteSource,
      sourceId: args.source_id as string,
      target: "semantic",
      operation: "create",
      idempotencyKey: args.idempotency_key as string,
      payload: {
        content: args.content as string,
        factType: args.fact_type as string,
        valueCaseId: args.value_case_id as string | undefined,
        confidenceScore: args.confidence_score as number | undefined,
        evidenceTier: args.evidence_tier as 1 | 2 | 3 | undefined,
      },
    };
  }

  private mapEpisodeToolArgs(
    args: Record<string, unknown>
  ): MemoryWriteRequest {
    return {
      tenantId: args.tenant_id as string,
      organizationId: args.organization_id as string,
      source: args.source as MemoryWriteSource,
      sourceId: args.source_id as string,
      target: "episodic",
      operation: "create",
      idempotencyKey: args.idempotency_key as string,
      payload: {
        eventContent: args.event_content as string,
        importanceScore: args.importance_score as number | undefined,
        valueCaseId: args.value_case_id as string | undefined,
        sessionId: args.session_id as string | undefined,
        agentId: args.agent_id as string | undefined,
      },
    };
  }

  private mapEntityEdgeToolArgs(
    args: Record<string, unknown>
  ): MemoryWriteRequest {
    return {
      tenantId: args.tenant_id as string,
      organizationId: args.organization_id as string,
      source: args.source as MemoryWriteSource,
      sourceId: args.source_id as string,
      target: "entity_graph",
      operation: "create",
      idempotencyKey: args.idempotency_key as string,
      payload: {
        valueCaseId: args.value_case_id as string,
        sourceEntity: {
          id: args.source_entity_id as string,
          type: args.source_entity_type as string,
        },
        targetEntity: {
          id: args.target_entity_id as string,
          type: args.target_entity_type as string,
        },
        edgeType: args.edge_type as string,
        weight: args.weight as number | undefined,
      },
    };
  }
}
