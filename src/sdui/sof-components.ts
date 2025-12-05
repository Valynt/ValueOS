/**
 * SOF Component Registry
 * 
 * Registers all Systemic Outcome Framework components with the SDUI system.
 */

import { SystemMapCanvas } from '../components/SOF/SystemMapCanvas';
import { InterventionPointCard } from '../components/SOF/InterventionPointCard';
import { FeedbackLoopViewer } from '../components/SOF/FeedbackLoopViewer';

/**
 * SOF Component Registry
 * 
 * Maps component type strings to React components for SDUI rendering.
 */
export const SOFComponentRegistry = {
  // System Mapping Components
  SystemMapCanvas,
  SystemInsightsPanel: SystemMapCanvas, // Placeholder - would be separate component
  LeveragePointsList: SystemMapCanvas, // Placeholder
  SystemBoundaryCard: SystemMapCanvas, // Placeholder
  
  // Intervention Components
  InterventionPointCard,
  InterventionSummaryCard: InterventionPointCard, // Placeholder
  InterventionSequenceTimeline: InterventionPointCard, // Placeholder
  InterventionPointsList: InterventionPointCard, // Placeholder
  OutcomePathwayMatrix: InterventionPointCard, // Placeholder
  
  // Outcome Components
  OutcomeHypothesisForm: InterventionPointCard, // Placeholder
  OutcomeHypothesisSummary: InterventionPointCard, // Placeholder
  CausalChainVisualization: InterventionPointCard, // Placeholder
  AssumptionValidationChecklist: InterventionPointCard, // Placeholder
  ValueStoryCard: InterventionPointCard, // Placeholder
  
  // Feedback Loop Components
  FeedbackLoopViewer,
  FeedbackLoopSummary: FeedbackLoopViewer, // Placeholder
  FeedbackLoopDiagram: FeedbackLoopViewer, // Placeholder
  BehaviorChangeTimeline: FeedbackLoopViewer, // Placeholder
  SystemUpdateLog: FeedbackLoopViewer, // Placeholder
  LoopMetricsPanel: FeedbackLoopViewer, // Placeholder
  RealizationRecommendations: FeedbackLoopViewer, // Placeholder
  
  // Risk Components
  SystemRiskBadge: InterventionPointCard, // Placeholder
  SystemicRiskPanel: InterventionPointCard, // Placeholder
  
  // Composite Components
  SystemicOutcomePanel: SystemMapCanvas, // Placeholder
  SOFStepper: SystemMapCanvas, // Placeholder
};

/**
 * Get SOF component by type
 */
export function getSOFComponent(type: string): React.ComponentType<any> | undefined {
  return SOFComponentRegistry[type as keyof typeof SOFComponentRegistry];
}

/**
 * Check if component type is SOF component
 */
export function isSOFComponent(type: string): boolean {
  return type in SOFComponentRegistry;
}

/**
 * Get all SOF component types
 */
export function getSOFComponentTypes(): string[] {
  return Object.keys(SOFComponentRegistry);
}

export default SOFComponentRegistry;
