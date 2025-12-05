/**
 * Agent Intent Converter
 * 
 * Converts agent outputs to UI intents, decoupling agents from specific components.
 * Uses a generic, defensive approach to handle any agent output structure.
 * 
 * This replaces the hardcoded switch statements in AgentSDUIAdapter.
 */

import { logger } from '../lib/logger';
import { UIIntent, createIntent } from '../types/intent';

/**
 * Generic agent output - any object with agentType
 */
interface GenericAgentOutput {
  agentType: string;
  agentId?: string;
  [key: string]: unknown;
}

/**
 * Agent Intent Converter interface
 */
export interface IAgentIntentConverter {
  canConvert(agentType: string): boolean;
  convert(output: GenericAgentOutput): UIIntent[];
}

/**
 * Helper to safely get nested values
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Base converter with common functionality
 */
abstract class BaseAgentConverter implements IAgentIntentConverter {
  abstract readonly supportedAgentTypes: string[];
  
  canConvert(agentType: string): boolean {
    return this.supportedAgentTypes.some(t => 
      agentType.toLowerCase().includes(t.toLowerCase())
    );
  }
  
  abstract convert(output: GenericAgentOutput): UIIntent[];
  
  protected createSource(output: GenericAgentOutput) {
    return {
      agentId: String(output.agentId || 'unknown'),
      agentType: output.agentType,
      timestamp: Date.now(),
    };
  }
}

/**
 * SystemMapperAgent converter
 */
class SystemMapperConverter extends BaseAgentConverter {
  readonly supportedAgentTypes = ['systemmapper', 'system-mapper', 'system_mapper'];
  
  convert(output: GenericAgentOutput): UIIntent[] {
    const intents: UIIntent[] = [];
    const source = this.createSource(output);
    
    const systemMap = getNestedValue(output, 'systemMap') as Record<string, unknown> | undefined;
    const leveragePoints = getNestedValue(output, 'leveragePoints') as unknown[] | undefined;
    
    if (systemMap) {
      intents.push(createIntent(
        'visualize_graph',
        {
          entities: systemMap.entities || [],
          relationships: systemMap.relationships || [],
          leveragePoints: leveragePoints || [],
          title: 'System Map',
        },
        { priority: 'high', size: 'large' },
        source
      ));
    }
    
    if (leveragePoints && leveragePoints.length > 0) {
      intents.push(createIntent(
        'display_list',
        { items: leveragePoints, title: 'Leverage Points' },
        { priority: 'medium', position: 'sidebar' },
        source
      ));
    }
    
    return intents;
  }
}

/**
 * TargetAgent converter
 */
class InterventionDesignerConverter extends BaseAgentConverter {
  readonly supportedAgentTypes = ['interventiondesigner', 'intervention-designer', 'intervention_designer'];
  
  convert(output: GenericAgentOutput): UIIntent[] {
    const intents: UIIntent[] = [];
    const source = this.createSource(output);
    
    const interventions = getNestedValue(output, 'interventions') as unknown[] | undefined;
    
    if (interventions && interventions.length > 0) {
      intents.push(createIntent(
        'input_form',
        { interventions, fields: interventions },
        { priority: 'high' },
        source
      ));
    }
    
    return intents;
  }
}

/**
 * OpportunityAgent converter
 */
class OutcomeEngineerConverter extends BaseAgentConverter {
  readonly supportedAgentTypes = ['outcomeengineer', 'outcome-engineer', 'outcome_engineer'];
  
  convert(output: GenericAgentOutput): UIIntent[] {
    const intents: UIIntent[] = [];
    const source = this.createSource(output);
    
    const hypotheses = getNestedValue(output, 'hypotheses') as unknown[] | undefined;
    const kpis = getNestedValue(output, 'kpis') as unknown[] | undefined;
    
    if (hypotheses && hypotheses.length > 0) {
      intents.push(createIntent(
        'display_metrics_grid',
        { metrics: hypotheses, kpis: kpis || [] },
        { priority: 'high', size: 'large' },
        source
      ));
    }
    
    return intents;
  }
}

/**
 * RealizationAgent converter
 */
class RealizationLoopConverter extends BaseAgentConverter {
  readonly supportedAgentTypes = ['realizationloop', 'realization-loop', 'realization_loop'];
  
  convert(output: GenericAgentOutput): UIIntent[] {
    const intents: UIIntent[] = [];
    const source = this.createSource(output);
    
    const metrics = getNestedValue(output, 'metrics') as unknown[] | undefined;
    const feedbackLoops = getNestedValue(output, 'feedbackLoops') as unknown[] | undefined;
    
    if (metrics && metrics.length > 0) {
      intents.push(createIntent(
        'display_metrics_grid',
        { metrics },
        { priority: 'high', size: 'large' },
        source
      ));
    }
    
    if (feedbackLoops && feedbackLoops.length > 0) {
      intents.push(createIntent(
        'visualize_graph',
        { entities: feedbackLoops, title: 'Feedback Loops' },
        { priority: 'medium' },
        source
      ));
    }
    
    return intents;
  }
}

/**
 * IntegrityAgent converter
 */
class ValueEvalConverter extends BaseAgentConverter {
  readonly supportedAgentTypes = ['valueeval', 'value-eval', 'value_eval'];
  
  convert(output: GenericAgentOutput): UIIntent[] {
    const intents: UIIntent[] = [];
    const source = this.createSource(output);
    
    const scores = getNestedValue(output, 'scores') as Record<string, number> | undefined;
    
    if (scores) {
      for (const [metric, score] of Object.entries(scores)) {
        intents.push(createIntent(
          'display_metric',
          {
            value: score,
            label: metric,
            format: typeof score === 'number' && score <= 1 ? 'percentage' : 'number',
          },
          { priority: 'medium' },
          source
        ));
      }
    }
    
    return intents;
  }
}

/**
 * CoordinatorAgent converter
 */
class CoordinatorConverter extends BaseAgentConverter {
  readonly supportedAgentTypes = ['coordinator', 'coordinator-agent'];
  
  convert(output: GenericAgentOutput): UIIntent[] {
    const intents: UIIntent[] = [];
    const source = this.createSource(output);
    
    const layoutDirective = getNestedValue(output, 'layoutDirective');
    
    if (layoutDirective) {
      intents.push(createIntent(
        'show_info',
        { message: 'Layout updated', title: 'Coordinator Update', variant: 'info' },
        { priority: 'low' },
        source
      ));
    }
    
    return intents;
  }
}

/**
 * Generic fallback converter for unknown agents
 */
class GenericAgentConverter extends BaseAgentConverter {
  readonly supportedAgentTypes = ['*'];
  
  canConvert(): boolean {
    return true; // Matches everything as fallback
  }
  
  convert(output: GenericAgentOutput): UIIntent[] {
    const source = this.createSource(output);
    
    return [createIntent(
      'show_agent_response',
      {
        response: JSON.stringify(output, null, 2),
        agentName: output.agentType,
      },
      { priority: 'low' },
      source
    )];
  }
}

/**
 * Agent Intent Converter Registry
 */
export class AgentIntentConverterRegistry {
  private static instance: AgentIntentConverterRegistry;
  private converters: IAgentIntentConverter[] = [];
  private fallbackConverter: IAgentIntentConverter;
  
  private constructor() {
    this.fallbackConverter = new GenericAgentConverter();
    this.registerDefaults();
  }
  
  static getInstance(): AgentIntentConverterRegistry {
    if (!AgentIntentConverterRegistry.instance) {
      AgentIntentConverterRegistry.instance = new AgentIntentConverterRegistry();
    }
    return AgentIntentConverterRegistry.instance;
  }
  
  private registerDefaults(): void {
    this.converters = [
      new SystemMapperConverter(),
      new InterventionDesignerConverter(),
      new OutcomeEngineerConverter(),
      new RealizationLoopConverter(),
      new ValueEvalConverter(),
      new CoordinatorConverter(),
    ];
    
    logger.info('Agent intent converters registered', { count: this.converters.length });
  }
  
  /**
   * Register a custom converter (takes precedence)
   */
  register(converter: IAgentIntentConverter): void {
    this.converters.unshift(converter);
  }
  
  /**
   * Convert agent output to intents
   */
  convert(output: GenericAgentOutput): UIIntent[] {
    const converter = this.converters.find(c => c.canConvert(output.agentType));
    
    if (!converter) {
      logger.debug('Using fallback converter', { agentType: output.agentType });
      return this.fallbackConverter.convert(output);
    }
    
    try {
      const intents = converter.convert(output);
      logger.debug('Converted agent output to intents', {
        agentType: output.agentType,
        intentCount: intents.length,
      });
      return intents;
    } catch (error) {
      logger.error('Failed to convert agent output', {
        agentType: output.agentType,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallbackConverter.convert(output);
    }
  }
  
  /**
   * Check if a converter exists for an agent type
   */
  hasConverter(agentType: string): boolean {
    return this.converters.some(c => c.canConvert(agentType));
  }
}

// Export singleton
export const agentIntentConverter = AgentIntentConverterRegistry.getInstance();
