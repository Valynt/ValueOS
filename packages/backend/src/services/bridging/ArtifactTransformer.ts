/**
 * ArtifactTransformer — Agent Output → Domain Object → SDUI Component
 *
 * Defines the typed transformation pipeline that converts raw agent outputs
 * into renderable SDUI component sections. Each agent type has a registered
 * transformer that knows how to:
 *
 *   1. Extract domain objects from the agent's typed output
 *   2. Map domain objects to SDUI component props
 *   3. Produce an SDUIComponentSection ready for the page definition
 *
 * This replaces ad-hoc transformation logic scattered across API routes.
 *
 * Sprint 55: Initial contract definition.
 */

import { z } from "zod";

import type {
  ArtifactSlot,
  ProgressDirective,
  UIIndicator,
  WorkspaceRegion,
} from "@valueos/shared";

// ============================================================================
// Core Transformer Types
// ============================================================================

/**
 * Metadata attached to every transformed artifact for lineage tracking.
 */
export interface TransformationLineage {
  /** Agent that produced the raw output. */
  source_agent: string;
  /** Reasoning trace ID for the invocation that produced this output. */
  trace_id: string | null;
  /** Timestamp of the agent invocation. */
  produced_at: string;
  /** Grounding score from hallucination detection. */
  grounding_score: number | null;
  /** Domain object IDs that this artifact was built from. */
  source_ids: string[];
}

/**
 * A fully resolved SDUI section produced by a transformer.
 * This is what the JourneyOrchestrator assembles into page definitions.
 */
export interface TransformedArtifact {
  /** Which artifact slot this fills. */
  slot_id: string;
  /** Where this artifact should render in the collaborative workspace. */
  region: WorkspaceRegion;
  /** SDUI component name (must exist in the component registry). */
  component: string;
  /** Component version. */
  version: number;
  /** Fully resolved props ready for the component. */
  props: Record<string, unknown>;
  /** Lineage metadata for "why this number?" drilldowns. */
  lineage: TransformationLineage;
  /** Current visual state of this artifact. */
  indicator: UIIndicator;
  /** Badge value (count, alert count, or confidence score). */
  badge_value: number | null;
}

/**
 * Input to a transformer: the raw agent output plus context.
 */
export interface TransformInput<TAgentOutput = unknown> {
  /** The typed agent output (already Zod-validated by secureInvoke). */
  agent_output: TAgentOutput;
  /** Organization ID for tenant-scoped queries. */
  organization_id: string;
  /** Opportunity ID for the current engagement. */
  opportunity_id: string;
  /** Session ID for the current workflow. */
  session_id: string;
  /** Reasoning trace ID from the agent invocation. */
  trace_id: string | null;
  /** Grounding score from hallucination detection. */
  grounding_score: number | null;
  /** The artifact slot this transformer is filling. */
  target_slot: ArtifactSlot;
}

/**
 * The transformer interface. Each agent type implements this to convert
 * its output into a renderable SDUI artifact.
 *
 * Transformers are pure functions with no side effects — they only
 * read domain data (via the injected repository) and produce props.
 */
export interface IArtifactTransformer<TAgentOutput = unknown> {
  /** Agent name this transformer handles (must match BaseAgent.name). */
  readonly agentName: string;

  /**
   * Transform agent output into a renderable SDUI artifact.
   *
   * May return null if the output does not produce a renderable artifact
   * (e.g. a validation agent that only updates confidence scores).
   */
  transform(input: TransformInput<TAgentOutput>): Promise<TransformedArtifact | null>;

  /**
   * Produce a progress directive for in-flight rendering.
   * Called when the agent is still running to show partial/optimistic UI.
   */
  toProgressDirective?(
    partialOutput: Partial<TAgentOutput>,
    slot: ArtifactSlot
  ): ProgressDirective;
}

// ============================================================================
// Transformer Registry
// ============================================================================

/**
 * Registry that maps agent names to their artifact transformers.
 * The JourneyOrchestrator looks up transformers from this registry
 * when assembling page definitions.
 */
export class ArtifactTransformerRegistry {
  private transformers = new Map<string, IArtifactTransformer>();

  /**
   * Register a transformer for an agent.
   * Throws if a transformer is already registered for the same agent name.
   */
  register<T>(transformer: IArtifactTransformer<T>): void {
    if (this.transformers.has(transformer.agentName)) {
      throw new Error(
        `ArtifactTransformerRegistry: transformer already registered for agent '${transformer.agentName}'`
      );
    }
    this.transformers.set(
      transformer.agentName,
      transformer as IArtifactTransformer
    );
  }

  /**
   * Get the transformer for a given agent name.
   * Returns null if no transformer is registered.
   */
  get(agentName: string): IArtifactTransformer | null {
    return this.transformers.get(agentName) ?? null;
  }

  /**
   * Check if a transformer is registered for the given agent name.
   */
  has(agentName: string): boolean {
    return this.transformers.has(agentName);
  }

  /**
   * Get all registered agent names.
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.transformers.keys()).sort();
  }
}

// Singleton instance
let registryInstance: ArtifactTransformerRegistry | null = null;

export function getArtifactTransformerRegistry(): ArtifactTransformerRegistry {
  if (!registryInstance) {
    registryInstance = new ArtifactTransformerRegistry();
  }
  return registryInstance;
}

/**
 * Reset singleton (for testing).
 */
export function resetArtifactTransformerRegistry(): void {
  registryInstance = null;
}

// ============================================================================
// Zod Schema for TransformedArtifact (for API serialization)
// ============================================================================

export const TransformationLineageSchema = z.object({
  source_agent: z.string(),
  trace_id: z.string().nullable(),
  produced_at: z.string().datetime(),
  grounding_score: z.number().min(0).max(1).nullable(),
  source_ids: z.array(z.string()),
});

export const TransformedArtifactSchema = z.object({
  slot_id: z.string(),
  region: z.enum(["header", "left_rail", "center_canvas", "right_panel", "footer"]),
  component: z.string(),
  version: z.number().int().positive(),
  props: z.record(z.unknown()),
  lineage: TransformationLineageSchema,
  indicator: z.enum([
    "idle",
    "progress",
    "streaming",
    "success",
    "warning",
    "error",
    "blocked",
  ]),
  badge_value: z.number().nullable(),
});
