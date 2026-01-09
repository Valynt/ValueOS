/**
 * Template Component Map
 * 
 * Maps template IDs to React component implementations.
 * Separates metadata (in TemplateLibrary) from implementation (here)
 * to prevent circular dependencies.
 */

import type { FC } from 'react';
import { 
  ImpactCascadeTemplate, 
  QuantumView,
  ScenarioMatrix, 
  StoryArcCanvas,
  type TemplateProps,
  TrinityDashboard,
} from './index';

/**
 * Registry of React-based template components.
 * Keys must match the `componentKey` field in TemplateLibrary.
 */
export const TEMPLATE_COMPONENT_MAP: Record<string, FC<TemplateProps>> = {
  'impact-cascade': ImpactCascadeTemplate,
  'trinity-dashboard': TrinityDashboard,
  'story-arc': StoryArcCanvas,
  'scenario-matrix': ScenarioMatrix,
  'quantum-view': QuantumView,
};

/**
 * Get a template component by its key
 */
export function getTemplateComponent(componentKey: string): FC<TemplateProps> | undefined {
  return TEMPLATE_COMPONENT_MAP[componentKey];
}

/**
 * Check if a component key is registered
 */
export function hasTemplateComponent(componentKey: string): boolean {
  return componentKey in TEMPLATE_COMPONENT_MAP;
}
