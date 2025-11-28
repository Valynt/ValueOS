/**
 * Intent Registry Service
 * 
 * Configuration-driven registry that maps UI intents to React components.
 * Enables decoupling between agents and UI components.
 * 
 * Key features:
 * - Load config from YAML/JSON
 * - Tenant-specific overrides
 * - Condition-based matching
 * - Fallback components
 * - Runtime registration
 */

import { logger } from '../lib/logger';
import {
  UIIntent,
  UIIntentType,
  IntentResolution,
  IntentRegistryEntry,
  IntentRegistryConfig,
  PropTransform,
  IntentCondition,
} from '../types/intent';

/**
 * Default registry configuration
 */
const DEFAULT_CONFIG: IntentRegistryConfig = {
  version: '1.0.0',
  defaultFallback: 'JsonViewer',
  intents: [
    // Visualization intents
    {
      intentType: 'visualize_graph',
      component: 'SystemMapCanvas',
      fallback: 'JsonViewer',
      propMappings: {
        entities: 'data.entities',
        relationships: 'data.relationships',
        leveragePoints: 'data.leveragePoints',
      },
    },
    {
      intentType: 'visualize_tree',
      component: 'ValueTreeCard',
      fallback: 'JsonViewer',
      propMappings: {
        tree: 'data.tree',
        title: 'data.title',
      },
    },
    {
      intentType: 'visualize_timeline',
      component: 'LifecyclePanel',
      fallback: 'DataTable',
      propMappings: {
        stages: 'data.stages',
        currentStage: 'data.currentStage',
      },
    },
    {
      intentType: 'visualize_flow',
      component: 'WorkflowDiagram',
      fallback: 'JsonViewer',
    },
    
    // Data display intents
    {
      intentType: 'display_metric',
      component: 'MetricBadge',
      fallback: 'StatCard',
      propMappings: {
        value: 'data.value',
        label: 'data.label',
        trend: 'data.trend',
        format: 'data.format',
      },
    },
    {
      intentType: 'display_metrics_grid',
      component: 'MetricsGrid',
      fallback: 'DataTable',
      propMappings: {
        metrics: 'data.metrics',
        columns: 'data.columns',
      },
    },
    {
      intentType: 'display_table',
      component: 'DataTable',
      fallback: 'JsonViewer',
      propMappings: {
        data: 'data.rows',
        columns: 'data.columns',
        sortable: 'context.sortable',
        filterable: 'context.filterable',
      },
    },
    {
      intentType: 'display_list',
      component: 'ItemList',
      fallback: 'DataTable',
      propMappings: {
        items: 'data.items',
        renderItem: 'data.renderItem',
      },
    },
    {
      intentType: 'display_comparison',
      component: 'ComparisonChart',
      fallback: 'DataTable',
      propMappings: {
        baseline: 'data.baseline',
        target: 'data.target',
        actual: 'data.actual',
      },
    },
    
    // Form/input intents
    {
      intentType: 'input_form',
      component: 'SDUIForm',
      fallback: 'BasicForm',
      propMappings: {
        fields: 'data.fields',
        onSubmit: 'data.onSubmit',
        initialValues: 'data.initialValues',
      },
    },
    {
      intentType: 'input_selection',
      component: 'SelectionPanel',
      fallback: 'RadioGroup',
      propMappings: {
        options: 'data.options',
        multiple: 'data.multiple',
        onSelect: 'data.onSelect',
      },
    },
    {
      intentType: 'input_confirmation',
      component: 'ConfirmationDialog',
      fallback: 'AlertDialog',
      propMappings: {
        title: 'data.title',
        message: 'data.message',
        onConfirm: 'data.onConfirm',
        onCancel: 'data.onCancel',
      },
    },
    
    // Agent-specific intents
    {
      intentType: 'show_agent_response',
      component: 'AgentResponseCard',
      fallback: 'InfoBanner',
      propMappings: {
        response: 'data.response',
        reasoning: 'data.reasoning',
        confidence: 'data.confidence',
        agentName: 'source.agentType',
      },
    },
    {
      intentType: 'show_agent_progress',
      component: 'AgentWorkflowPanel',
      fallback: 'ProgressBar',
      propMappings: {
        stages: 'data.stages',
        currentStage: 'data.currentStage',
        progress: 'data.progress',
      },
    },
    {
      intentType: 'show_confidence',
      component: 'ConfidenceIndicator',
      fallback: 'ProgressBar',
      propMappings: {
        value: 'data.confidence',
        label: 'data.label',
        breakdown: 'data.breakdown',
      },
    },
    
    // Feedback intents
    {
      intentType: 'show_success',
      component: 'SuccessAlert',
      fallback: 'InfoBanner',
      propMappings: {
        message: 'data.message',
        title: 'data.title',
        actions: 'data.actions',
      },
    },
    {
      intentType: 'show_warning',
      component: 'WarningAlert',
      fallback: 'InfoBanner',
      propMappings: {
        message: 'data.message',
        title: 'data.title',
        actions: 'data.actions',
      },
    },
    {
      intentType: 'show_error',
      component: 'ErrorAlert',
      fallback: 'InfoBanner',
      propMappings: {
        message: 'data.message',
        title: 'data.title',
        error: 'data.error',
      },
    },
    {
      intentType: 'show_info',
      component: 'InfoBanner',
      fallback: 'TextBlock',
      propMappings: {
        message: 'data.message',
        title: 'data.title',
        variant: 'data.variant',
      },
    },
  ],
};

/**
 * Intent Registry - Singleton service
 */
export class IntentRegistry {
  private static instance: IntentRegistry;
  private config: IntentRegistryConfig;
  private runtimeEntries: Map<UIIntentType, IntentRegistryEntry[]> = new Map();
  
  private constructor() {
    this.config = DEFAULT_CONFIG;
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): IntentRegistry {
    if (!IntentRegistry.instance) {
      IntentRegistry.instance = new IntentRegistry();
    }
    return IntentRegistry.instance;
  }
  
  /**
   * Load configuration from external source
   */
  loadConfig(config: IntentRegistryConfig): void {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      intents: [...DEFAULT_CONFIG.intents, ...(config.intents || [])],
    };
    logger.info('IntentRegistry config loaded', { 
      version: this.config.version,
      intentCount: this.config.intents.length,
    });
  }
  
  /**
   * Register a new intent mapping at runtime
   */
  registerIntent(entry: IntentRegistryEntry): void {
    const existing = this.runtimeEntries.get(entry.intentType) || [];
    existing.push(entry);
    this.runtimeEntries.set(entry.intentType, existing);
    
    logger.debug('Runtime intent registered', {
      intentType: entry.intentType,
      component: entry.component,
    });
  }
  
  /**
   * Unregister a runtime intent mapping
   */
  unregisterIntent(intentType: UIIntentType, component?: string): void {
    if (component) {
      const entries = this.runtimeEntries.get(intentType) || [];
      this.runtimeEntries.set(
        intentType,
        entries.filter(e => e.component !== component)
      );
    } else {
      this.runtimeEntries.delete(intentType);
    }
  }
  
  /**
   * Resolve an intent to a component
   */
  resolve(intent: UIIntent, tenantId?: string): IntentResolution {
    try {
      // Find matching entries (runtime entries take precedence)
      const entries = this.findMatchingEntries(intent, tenantId);
      
      if (entries.length === 0) {
        logger.warn('No matching intent entry found', {
          intentType: intent.type,
          tenantId,
        });
        
        return {
          component: this.config.defaultFallback,
          props: intent.data,
          fallback: undefined,
          resolved: false,
          metadata: { source: 'default' },
        };
      }
      
      // Use highest priority entry
      const entry = entries[0];
      
      // Map props from intent to component
      const props = this.mapProps(intent, entry);
      
      return {
        component: entry.component,
        props,
        fallback: entry.fallback || this.config.defaultFallback,
        resolved: true,
        metadata: {
          source: this.runtimeEntries.has(intent.type) ? 'registry' : 'registry',
          matchedRule: entry.intentType,
        },
      };
    } catch (error) {
      logger.error('Failed to resolve intent', {
        intentType: intent.type,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        component: this.config.defaultFallback,
        props: intent.data,
        resolved: false,
        metadata: { source: 'fallback' },
      };
    }
  }
  
  /**
   * Find all matching registry entries for an intent
   */
  private findMatchingEntries(intent: UIIntent, tenantId?: string): IntentRegistryEntry[] {
    const entries: IntentRegistryEntry[] = [];
    
    // Check runtime entries first
    const runtimeMatches = this.runtimeEntries.get(intent.type) || [];
    entries.push(...runtimeMatches.filter(e => this.matchesConditions(e, intent)));
    
    // Check config entries
    const configMatches = this.config.intents.filter(
      e => e.intentType === intent.type && this.matchesConditions(e, intent)
    );
    entries.push(...configMatches);
    
    // Apply tenant overrides
    if (tenantId && this.config.tenantOverrides?.[tenantId]) {
      const tenantOverrides = this.config.tenantOverrides[tenantId];
      for (const override of tenantOverrides) {
        if (override.intentType === intent.type) {
          // Merge override with base entry
          const baseEntry = entries.find(e => e.intentType === intent.type);
          if (baseEntry) {
            const merged = { ...baseEntry, ...override };
            entries.unshift(merged as IntentRegistryEntry);
          }
        }
      }
    }
    
    // Sort by priority (higher first)
    return entries.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  
  /**
   * Check if an entry's conditions are met
   */
  private matchesConditions(entry: IntentRegistryEntry, intent: UIIntent): boolean {
    if (!entry.conditions || entry.conditions.length === 0) {
      return true;
    }
    
    return entry.conditions.every(condition => this.evaluateCondition(condition, intent));
  }
  
  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: IntentCondition, intent: UIIntent): boolean {
    const value = this.getNestedValue(intent, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return Array.isArray(value) 
          ? value.includes(condition.value)
          : String(value).includes(String(condition.value));
      case 'exists':
        return value !== undefined && value !== null;
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number);
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number);
      case 'matches':
        return new RegExp(String(condition.value)).test(String(value));
      default:
        return false;
    }
  }
  
  /**
   * Map intent data to component props
   */
  private mapProps(intent: UIIntent, entry: IntentRegistryEntry): Record<string, unknown> {
    if (!entry.propMappings) {
      return { ...intent.data, ...intent.context };
    }
    
    const props: Record<string, unknown> = {};
    
    for (const [propName, mapping] of Object.entries(entry.propMappings)) {
      if (typeof mapping === 'string') {
        // Simple path mapping
        props[propName] = this.getNestedValue(intent, mapping);
      } else {
        // Complex transform mapping
        const transform = mapping as PropTransform;
        let value = this.getNestedValue(intent, transform.path);
        
        if (value === undefined) {
          value = transform.default;
        } else if (transform.transform) {
          value = this.applyTransform(value, transform.transform);
        }
        
        props[propName] = value;
      }
    }
    
    // Include any unmapped context
    if (intent.context) {
      for (const [key, value] of Object.entries(intent.context)) {
        if (!(key in props)) {
          props[key] = value;
        }
      }
    }
    
    return props;
  }
  
  /**
   * Get a nested value from an object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array notation like "items[0]"
      const match = part.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        const [, key, index] = match;
        current = (current as Record<string, unknown>)[key];
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }
    
    return current;
  }
  
  /**
   * Apply a transform to a value
   */
  private applyTransform(value: unknown, transform: string): unknown {
    switch (transform) {
      case 'currency':
        return typeof value === 'number' 
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
          : value;
      case 'percentage':
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value;
      case 'date':
        return value instanceof Date 
          ? value.toLocaleDateString()
          : typeof value === 'string' || typeof value === 'number'
            ? new Date(value).toLocaleDateString()
            : value;
      case 'number':
        return typeof value === 'number'
          ? new Intl.NumberFormat('en-US').format(value)
          : value;
      case 'json':
        return JSON.stringify(value, null, 2);
      default:
        return value;
    }
  }
  
  /**
   * Get all registered intent types
   */
  getRegisteredIntentTypes(): UIIntentType[] {
    const types = new Set<UIIntentType>();
    
    this.config.intents.forEach(e => types.add(e.intentType));
    this.runtimeEntries.forEach((_, key) => types.add(key));
    
    return Array.from(types);
  }
  
  /**
   * Get entries for a specific intent type
   */
  getEntriesForIntent(intentType: UIIntentType): IntentRegistryEntry[] {
    return [
      ...(this.runtimeEntries.get(intentType) || []),
      ...this.config.intents.filter(e => e.intentType === intentType),
    ];
  }
}

// Export singleton instance
export const intentRegistry = IntentRegistry.getInstance();
