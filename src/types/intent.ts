/**
 * Intent-Based UI System
 * 
 * Decouples agents from specific UI components by using "intents" as an
 * intermediate layer. Agents express WHAT they want to show (intent),
 * and the IntentRegistry determines HOW to show it (component).
 * 
 * This enables:
 * - Adding new agents without modifying core services
 * - Swapping components without changing agent code
 * - A/B testing different UI representations
 * - Tenant-specific component overrides
 */

/**
 * UI Intent Types - What the agent wants to display
 */
export type UIIntentType =
  // Visualization intents
  | 'visualize_graph'           // Display a graph/network visualization
  | 'visualize_tree'            // Display a hierarchical tree
  | 'visualize_timeline'        // Display a timeline
  | 'visualize_flow'            // Display a flow diagram
  
  // Data display intents
  | 'display_metric'            // Display a single metric/KPI
  | 'display_metrics_grid'      // Display multiple metrics in a grid
  | 'display_table'             // Display tabular data
  | 'display_list'              // Display a list of items
  | 'display_comparison'        // Display comparison data
  
  // Form/input intents
  | 'input_form'                // Display a form for user input
  | 'input_selection'           // Display selection options
  | 'input_confirmation'        // Request user confirmation
  
  // Agent-specific intents
  | 'show_agent_response'       // Display agent response with reasoning
  | 'show_agent_progress'       // Display agent workflow progress
  | 'show_confidence'           // Display confidence/certainty indicator
  
  // Feedback intents
  | 'show_success'              // Display success message
  | 'show_warning'              // Display warning message
  | 'show_error'                // Display error message
  | 'show_info'                 // Display informational message
  
  // Custom intent (extensible)
  | `custom:${string}`;

/**
 * Intent priority levels
 */
export type IntentPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Intent context - additional metadata for rendering decisions
 */
export interface IntentContext {
  /** Priority level for display ordering */
  priority?: IntentPriority;
  
  /** Suggested position in the layout */
  position?: 'top' | 'center' | 'bottom' | 'sidebar';
  
  /** Size hint for the component */
  size?: 'small' | 'medium' | 'large' | 'full';
  
  /** Whether this requires immediate attention */
  urgent?: boolean;
  
  /** Tenant-specific overrides */
  tenantId?: string;
  
  /** Feature flags that affect rendering */
  featureFlags?: Record<string, boolean>;
  
  /** Custom context data */
  [key: string]: unknown;
}

/**
 * UI Intent - The contract between agents and UI
 * 
 * Agents emit intents describing what they want to display.
 * The IntentRegistry resolves these to specific React components.
 */
export interface UIIntent {
  /** The type of intent */
  type: UIIntentType;
  
  /** The data to display */
  data: Record<string, unknown>;
  
  /** Optional context for rendering decisions */
  context?: IntentContext;
  
  /** Source agent that generated this intent */
  source?: {
    agentId: string;
    agentType: string;
    timestamp: number;
  };
  
  /** Unique identifier for this intent instance */
  id?: string;
}

/**
 * Intent Resolution Result
 */
export interface IntentResolution {
  /** The React component name to render */
  component: string;
  
  /** Props to pass to the component */
  props: Record<string, unknown>;
  
  /** Fallback component if primary fails */
  fallback?: string;
  
  /** Whether this intent was successfully resolved */
  resolved: boolean;
  
  /** Resolution metadata */
  metadata?: {
    source: 'registry' | 'default' | 'fallback';
    matchedRule?: string;
  };
}

/**
 * Registry entry configuration
 */
export interface IntentRegistryEntry {
  /** Intent type this entry handles */
  intentType: UIIntentType;
  
  /** Primary component to render */
  component: string;
  
  /** Fallback component if primary unavailable */
  fallback?: string;
  
  /** Prop mappings from intent data to component props */
  propMappings?: Record<string, string | PropTransform>;
  
  /** Conditions for this entry to apply */
  conditions?: IntentCondition[];
  
  /** Priority when multiple entries match */
  priority?: number;
}

/**
 * Prop transformation function or path
 */
export type PropTransform = {
  /** Path to extract data from (e.g., "data.metrics[0].value") */
  path: string;
  
  /** Optional transform to apply */
  transform?: 'currency' | 'percentage' | 'date' | 'number' | 'json';
  
  /** Default value if path doesn't exist */
  default?: unknown;
};

/**
 * Condition for intent matching
 */
export interface IntentCondition {
  /** Field to check in the intent */
  field: string;
  
  /** Operator for comparison */
  operator: 'equals' | 'contains' | 'exists' | 'gt' | 'lt' | 'matches';
  
  /** Value to compare against */
  value?: unknown;
}

/**
 * Intent Registry Configuration
 */
export interface IntentRegistryConfig {
  /** Version of the config schema */
  version: string;
  
  /** Default fallback component */
  defaultFallback: string;
  
  /** Intent to component mappings */
  intents: IntentRegistryEntry[];
  
  /** Tenant-specific overrides */
  tenantOverrides?: Record<string, Partial<IntentRegistryEntry>[]>;
}

/**
 * Helper function to create an intent
 */
export function createIntent(
  type: UIIntentType,
  data: Record<string, unknown>,
  context?: IntentContext,
  source?: UIIntent['source']
): UIIntent {
  return {
    type,
    data,
    context,
    source,
    id: `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
}

/**
 * Type guard to check if a string is a valid intent type
 */
export function isValidIntentType(type: string): type is UIIntentType {
  const validTypes: string[] = [
    'visualize_graph', 'visualize_tree', 'visualize_timeline', 'visualize_flow',
    'display_metric', 'display_metrics_grid', 'display_table', 'display_list', 'display_comparison',
    'input_form', 'input_selection', 'input_confirmation',
    'show_agent_response', 'show_agent_progress', 'show_confidence',
    'show_success', 'show_warning', 'show_error', 'show_info',
  ];
  
  return validTypes.includes(type) || type.startsWith('custom:');
}
