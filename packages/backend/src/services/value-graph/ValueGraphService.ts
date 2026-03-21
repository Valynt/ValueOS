/**
 * ValueGraphService
 *
 * Builds and traverses the canonical Value Graph for an opportunity.
 * The graph connects customer use cases to quantified economic outcomes
 * via a typed, evidence-linked edge structure.
 *
 * Primary operations:
 *   getGraphForOpportunity — loads all nodes and edges for an opportunity
 *   getValuePaths          — returns ordered paths from UseCase to VgValueDriver
 *   writeEdge              — upserts a typed edge (used by agents)
 *   writeCapability        — upserts a VgCapability node
 *   writeMetric            — upserts a VgMetric node
 *   writeValueDriver       — upserts a VgValueDriver node
 *
 * All operations are tenant-scoped via organization_id.
 * Agents call write* methods; the UI and API call read methods.
 *
 * Sprint 47: Initial implementation. Agent integration in Sprint 48.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";
import { supabase as defaultSupabase } from "../../lib/supabase.js";
import type {
  VgCapability,
  VgMetric,
  VgValueDriver,
  ValueGraphEdge,
  ValueGraphEdgeType,
  ValueGraphEntityType,
} from "@valueos/shared";

// ---------------------------------------------------------------------------
// Graph types
// ---------------------------------------------------------------------------

export interface ValueGraphNode {
  entity_type: ValueGraphEntityType;
  entity_id: string;
  /** Resolved entity data — shape depends on entity_type. */
  data: Record<string, unknown>;
}

export interface ValueGraph {
  opportunity_id: string;
  organization_id: string;
  nodes: ValueGraphNode[];
  edges: ValueGraphEdge[];
  ontology_version: string;
}

/**
 * A single traversable path from a UseCase to a VgValueDriver.
 * Represents one causal chain: UseCase → Capability → Metric → ValueDriver.
 */
export interface ValuePath {
  /** Ordered list of edges forming the path. */
  edges: ValueGraphEdge[];
  /** Aggregate confidence: product of all edge confidence_scores. */
  path_confidence: number;
  /** The terminal VgValueDriver node. */
  value_driver: VgValueDriver;
  /** The originating UseCase entity ID. */
  use_case_id: string;
  /** All VgMetric nodes on this path. */
  metrics: VgMetric[];
  /** All VgCapability nodes on this path. */
  capabilities: VgCapability[];
}

// ---------------------------------------------------------------------------
// Write input types (agents use these)
// ---------------------------------------------------------------------------

export interface WriteCapabilityInput {
  opportunity_id: string;
  organization_id: string;
  name: string;
  description: string;
  category: VgCapability["category"];
  ontology_version?: string;
}

export interface WriteMetricInput {
  opportunity_id: string;
  organization_id: string;
  name: string;
  unit: VgMetric["unit"];
  baseline_value?: number | null;
  target_value?: number | null;
  measurement_method?: string | null;
  impact_timeframe_months?: number | null;
  ontology_version?: string;
}

export interface WriteValueDriverInput {
  opportunity_id: string;
  organization_id: string;
  type: VgValueDriver["type"];
  name: string;
  description: string;
  estimated_impact_usd?: number | null;
  ontology_version?: string;
}

export interface WriteEdgeInput {
  opportunity_id: string;
  organization_id: string;
  from_entity_type: ValueGraphEntityType;
  from_entity_id: string;
  to_entity_type: ValueGraphEntityType;
  to_entity_id: string;
  edge_type: ValueGraphEdgeType;
  confidence_score?: number;
  evidence_ids?: string[];
  created_by_agent: string;
  ontology_version?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ValueGraphService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient = defaultSupabase) {
    this.supabase = supabaseClient;
  }

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  /**
   * Loads the full Value Graph for an opportunity: all nodes and edges.
   * Tenant-scoped — only data matching organization_id is returned.
   */
  async getGraphForOpportunity(
    opportunityId: string,
    organizationId: string
  ): Promise<ValueGraph> {
    const [capabilitiesResult, metricsResult, valueDriversResult, edgesResult] =
      await Promise.all([
        this.supabase
          .from("vg_capabilities")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .eq("organization_id", organizationId),
        this.supabase
          .from("vg_metrics")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .eq("organization_id", organizationId),
        this.supabase
          .from("vg_value_drivers")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .eq("organization_id", organizationId),
        this.supabase
          .from("value_graph_edges")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .eq("organization_id", organizationId),
      ]);

    for (const result of [
      capabilitiesResult,
      metricsResult,
      valueDriversResult,
      edgesResult,
    ]) {
      if (result.error) {
        logger.error("ValueGraphService: query failed", {
          error: result.error.message,
          opportunityId,
          organizationId,
        });
        throw result.error;
      }
    }

    const capabilities = (capabilitiesResult.data ?? []) as VgCapability[];
    const metrics = (metricsResult.data ?? []) as VgMetric[];
    const valueDrivers = (valueDriversResult.data ?? []) as VgValueDriver[];
    const edges = (edgesResult.data ?? []) as ValueGraphEdge[];

    const nodes: ValueGraphNode[] = [
      ...capabilities.map((c) => ({
        entity_type: "vg_capability" as ValueGraphEntityType,
        entity_id: c.id,
        data: c as unknown as Record<string, unknown>,
      })),
      ...metrics.map((m) => ({
        entity_type: "vg_metric" as ValueGraphEntityType,
        entity_id: m.id,
        data: m as unknown as Record<string, unknown>,
      })),
      ...valueDrivers.map((vd) => ({
        entity_type: "vg_value_driver" as ValueGraphEntityType,
        entity_id: vd.id,
        data: vd as unknown as Record<string, unknown>,
      })),
    ];

    // Determine the ontology version from the first edge (all edges in a run
    // share the same version). Fall back to "1.0" if no edges exist yet.
    const ontologyVersion = edges[0]?.ontology_version ?? "1.0";

    return {
      opportunity_id: opportunityId,
      organization_id: organizationId,
      nodes,
      edges,
      ontology_version: ontologyVersion,
    };
  }

  /**
   * Returns all traversable paths from any UseCase to a VgValueDriver.
   *
   * A path is the ordered sequence of edges:
   *   use_case_enabled_by_capability
   *   → capability_impacts_metric
   *   → metric_maps_to_value_driver
   *
   * Path confidence is the product of all edge confidence_scores.
   * Paths are sorted descending by path_confidence.
   *
   * Tenant-scoped — only data matching organization_id is returned.
   */
  async getValuePaths(
    opportunityId: string,
    organizationId: string
  ): Promise<ValuePath[]> {
    const graph = await this.getGraphForOpportunity(opportunityId, organizationId);

    // Build lookup maps for fast traversal
    const capabilityMap = new Map<string, VgCapability>();
    const metricMap = new Map<string, VgMetric>();
    const valueDriverMap = new Map<string, VgValueDriver>();

    for (const node of graph.nodes) {
      if (node.entity_type === "vg_capability") {
        capabilityMap.set(node.entity_id, node.data as unknown as VgCapability);
      } else if (node.entity_type === "vg_metric") {
        metricMap.set(node.entity_id, node.data as unknown as VgMetric);
      } else if (node.entity_type === "vg_value_driver") {
        valueDriverMap.set(node.entity_id, node.data as unknown as VgValueDriver);
      }
    }

    // Index edges by type for traversal
    const edgesByType = new Map<ValueGraphEdgeType, ValueGraphEdge[]>();
    for (const edge of graph.edges) {
      const list = edgesByType.get(edge.edge_type) ?? [];
      list.push(edge);
      edgesByType.set(edge.edge_type, list);
    }

    const ucCapEdges = edgesByType.get("use_case_enabled_by_capability") ?? [];
    const capMetricEdges = edgesByType.get("capability_impacts_metric") ?? [];
    const metricDriverEdges = edgesByType.get("metric_maps_to_value_driver") ?? [];

    // Index by source for O(1) lookup
    const capMetricByCapId = this.indexEdgesBySource(capMetricEdges);
    const metricDriverByMetricId = this.indexEdgesBySource(metricDriverEdges);

    const paths: ValuePath[] = [];

    for (const ucCapEdge of ucCapEdges) {
      const capabilityId = ucCapEdge.to_entity_id;
      const useCaseId = ucCapEdge.from_entity_id;
      const capability = capabilityMap.get(capabilityId);
      if (!capability) continue;

      const capMetrics = capMetricByCapId.get(capabilityId) ?? [];

      for (const capMetricEdge of capMetrics) {
        const metricId = capMetricEdge.to_entity_id;
        const metric = metricMap.get(metricId);
        if (!metric) continue;

        const metricDrivers = metricDriverByMetricId.get(metricId) ?? [];

        for (const metricDriverEdge of metricDrivers) {
          const driverId = metricDriverEdge.to_entity_id;
          const valueDriver = valueDriverMap.get(driverId);
          if (!valueDriver) continue;

          const pathEdges = [ucCapEdge, capMetricEdge, metricDriverEdge];
          const pathConfidence = pathEdges.reduce(
            (acc, e) => acc * e.confidence_score,
            1
          );

          paths.push({
            edges: pathEdges,
            path_confidence: pathConfidence,
            value_driver: valueDriver,
            use_case_id: useCaseId,
            metrics: [metric],
            capabilities: [capability],
          });
        }
      }
    }

    // Sort by confidence descending — highest-confidence paths first
    paths.sort((a, b) => b.path_confidence - a.path_confidence);

    return paths;
  }

  // -------------------------------------------------------------------------
  // Write operations (called by agents)
  // -------------------------------------------------------------------------

  /**
   * Upserts a VgCapability node. Returns the persisted record.
   * Agents call this when they identify a capability during discovery.
   */
  async writeCapability(input: WriteCapabilityInput): Promise<VgCapability> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("vg_capabilities")
      .insert({
        organization_id: input.organization_id,
        opportunity_id: input.opportunity_id,
        name: input.name,
        description: input.description,
        category: input.category,
        ontology_version: input.ontology_version ?? "1.0",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("ValueGraphService: writeCapability failed", {
        error: error.message,
        opportunityId: input.opportunity_id,
        organizationId: input.organization_id,
      });
      throw error;
    }

    return data as VgCapability;
  }

  /**
   * Upserts a VgMetric node. Returns the persisted record.
   * Agents call this when they identify a measurable outcome.
   */
  async writeMetric(input: WriteMetricInput): Promise<VgMetric> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("vg_metrics")
      .insert({
        organization_id: input.organization_id,
        opportunity_id: input.opportunity_id,
        name: input.name,
        unit: input.unit,
        baseline_value: input.baseline_value ?? null,
        target_value: input.target_value ?? null,
        measurement_method: input.measurement_method ?? null,
        impact_timeframe_months: input.impact_timeframe_months ?? null,
        ontology_version: input.ontology_version ?? "1.0",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("ValueGraphService: writeMetric failed", {
        error: error.message,
        opportunityId: input.opportunity_id,
        organizationId: input.organization_id,
      });
      throw error;
    }

    return data as VgMetric;
  }

  /**
   * Upserts a VgValueDriver node. Returns the persisted record.
   * Agents call this when they map a metric to an EVF category.
   */
  async writeValueDriver(input: WriteValueDriverInput): Promise<VgValueDriver> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("vg_value_drivers")
      .insert({
        organization_id: input.organization_id,
        opportunity_id: input.opportunity_id,
        type: input.type,
        name: input.name,
        description: input.description,
        estimated_impact_usd: input.estimated_impact_usd ?? null,
        ontology_version: input.ontology_version ?? "1.0",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("ValueGraphService: writeValueDriver failed", {
        error: error.message,
        opportunityId: input.opportunity_id,
        organizationId: input.organization_id,
      });
      throw error;
    }

    return data as VgValueDriver;
  }

  /**
   * Upserts a typed edge between two graph entities.
   * On conflict (same org + opp + from + to + edge_type), updates
   * confidence_score, evidence_ids, and updated_at.
   *
   * Agents call this after writing nodes to establish relationships.
   */
  async writeEdge(input: WriteEdgeInput): Promise<ValueGraphEdge> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("value_graph_edges")
      .upsert(
        {
          organization_id: input.organization_id,
          opportunity_id: input.opportunity_id,
          from_entity_type: input.from_entity_type,
          from_entity_id: input.from_entity_id,
          to_entity_type: input.to_entity_type,
          to_entity_id: input.to_entity_id,
          edge_type: input.edge_type,
          confidence_score: input.confidence_score ?? 0.5,
          evidence_ids: input.evidence_ids ?? [],
          created_by_agent: input.created_by_agent,
          ontology_version: input.ontology_version ?? "1.0",
          created_at: now,
          updated_at: now,
        },
        {
          onConflict:
            "organization_id,opportunity_id,from_entity_id,to_entity_id,edge_type",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      logger.error("ValueGraphService: writeEdge failed", {
        error: error.message,
        edgeType: input.edge_type,
        opportunityId: input.opportunity_id,
        organizationId: input.organization_id,
      });
      throw error;
    }

    return data as ValueGraphEdge;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private indexEdgesBySource(
    edges: ValueGraphEdge[]
  ): Map<string, ValueGraphEdge[]> {
    const map = new Map<string, ValueGraphEdge[]>();
    for (const edge of edges) {
      const list = map.get(edge.from_entity_id) ?? [];
      list.push(edge);
      map.set(edge.from_entity_id, list);
    }
    return map;
  }
}

export const valueGraphService = new ValueGraphService();
