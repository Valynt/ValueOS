/**
 * Bridging Layer — packages/backend/src/services/bridging
 *
 * Translates backend agent state into user-perceivable experience.
 * See ExperienceModel in @valueos/shared for the type definitions.
 *
 * Sprint 55.
 */

export {
  type IArtifactTransformer,
  type TransformInput,
  type TransformedArtifact,
  type TransformationLineage,
  ArtifactTransformerRegistry,
  getArtifactTransformerRegistry,
  resetArtifactTransformerRegistry,
  TransformationLineageSchema,
  TransformedArtifactSchema,
} from "./ArtifactTransformer.js";

export {
  type JourneyOrchestratorInput,
  type JourneyOrchestratorOutput,
  type ExitConditionResult,
  JourneyOrchestrator,
} from "./JourneyOrchestrator.js";
