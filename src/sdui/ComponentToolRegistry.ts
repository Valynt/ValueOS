/**
 * Component Tool Registry
 * 
 * Treats each UI component as a "tool" that agents can use.
 * Provides documentation, examples, and validation for LLM-based component selection.
 */

import { z } from 'zod';

export interface ComponentTool {
  name: string;
  description: string;
  when_to_use: string;
  category: 'visualization' | 'form' | 'layout' | 'data' | 'navigation' | 'feedback';
  required_props: string[];
  optional_props: string[];
  prop_types: Record<string, string>;
  examples: ComponentExample[];
  best_practices: string[];
  common_mistakes: string[];
}

export interface ComponentExample {
  scenario: string;
  props: Record<string, any>;
  layout_recommendation: string;
}

/**
 * Component Tool Registry
 * Documents all available UI components as "tools" for agents
 */
export const COMPONENT_TOOL_REGISTRY: Record<string, ComponentTool> = {
  SystemMapCanvas: {
    name: 'SystemMapCanvas',
    description: 'Interactive visualization of system entities and relationships',
    when_to_use: 'Display complex system maps with entities, relationships, and leverage points',
    category: 'visualization',
    required_props: ['systemMap', 'entities', 'relationships'],
    optional_props: ['onEntityClick', 'onRelationshipClick', 'zoom', 'highlightLeveragePoints'],
    prop_types: {
      systemMap: 'SystemMap',
      entities: 'Entity[]',
      relationships: 'Relationship[]',
      onEntityClick: '(entity: Entity) => void',
      zoom: 'number',
    },
    examples: [
      {
        scenario: 'Display system analysis results',
        props: {
          systemMap: { id: 'map-1', map_name: 'Customer Journey' },
          entities: [{ id: 'e1', entity_name: 'Customer', entity_type: 'actor' }],
          relationships: [{ id: 'r1', source_entity_id: 'e1', target_entity_id: 'e2' }],
          highlightLeveragePoints: true,
        },
        layout_recommendation: 'full_width',
      },
    ],
    best_practices: [
      'Use full_width layout for complex maps',
      'Enable highlightLeveragePoints for analysis views',
      'Provide onEntityClick for interactive exploration',
    ],
    common_mistakes: [
      'Forgetting to include relationships array',
      'Using wrong layout for large maps',
    ],
  },

  InterventionDesigner: {
    name: 'InterventionDesigner',
    description: 'Interface for designing and evaluating interventions',
    when_to_use: 'Allow users to create, modify, and assess intervention strategies',
    category: 'form',
    required_props: ['systemMap', 'leveragePoints'],
    optional_props: ['onInterventionCreated', 'existingInterventions', 'showFeasibility'],
    prop_types: {
      systemMap: 'SystemMap',
      leveragePoints: 'LeveragePoint[]',
      onInterventionCreated: '(intervention: InterventionPoint) => void',
      showFeasibility: 'boolean',
    },
    examples: [
      {
        scenario: 'Design interventions from system analysis',
        props: {
          systemMap: { id: 'map-1' },
          leveragePoints: [{ id: 'lp-1', leverage_type: 'information_flow' }],
          showFeasibility: true,
        },
        layout_recommendation: 'two_column',
      },
    ],
    best_practices: [
      'Use two_column layout for design + preview',
      'Enable showFeasibility for decision support',
      'Provide leveragePoints for context',
    ],
    common_mistakes: [
      'Not providing leverage points',
      'Using full_width when two_column is better',
    ],
  },

  FeedbackLoopViewer: {
    name: 'FeedbackLoopViewer',
    description: 'Displays feedback loop status and behavior changes',
    when_to_use: 'Monitor feedback loops during realization phase',
    category: 'visualization',
    required_props: ['loop'],
    optional_props: ['showMetrics', 'showBehaviorChanges', 'compact'],
    prop_types: {
      loop: 'FeedbackLoop',
      showMetrics: 'boolean',
      showBehaviorChanges: 'boolean',
      compact: 'boolean',
    },
    examples: [
      {
        scenario: 'Monitor active feedback loop',
        props: {
          loop: { id: 'loop-1', loop_type: 'reinforcing', realization_stage: 'active' },
          showMetrics: true,
          showBehaviorChanges: true,
        },
        layout_recommendation: 'dashboard',
      },
    ],
    best_practices: [
      'Use dashboard layout for multiple loops',
      'Enable showMetrics for active monitoring',
      'Use compact mode for overview displays',
    ],
    common_mistakes: [
      'Not showing metrics for active loops',
      'Using wrong layout for multiple loops',
    ],
  },

  PageHeader: {
    name: 'PageHeader',
    description: 'Standard page header with title, subtitle, and breadcrumbs',
    when_to_use: 'Every page should start with a PageHeader',
    category: 'layout',
    required_props: ['title'],
    optional_props: ['subtitle', 'breadcrumbs', 'actions'],
    prop_types: {
      title: 'string',
      subtitle: 'string',
      breadcrumbs: 'Breadcrumb[]',
      actions: 'Action[]',
    },
    examples: [
      {
        scenario: 'Standard page header',
        props: {
          title: 'System Analysis',
          subtitle: 'Generated by SystemMapperAgent',
          breadcrumbs: [
            { label: 'Home', href: '/' },
            { label: 'Analysis' },
          ],
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Always include breadcrumbs for navigation',
      'Use subtitle to show context or agent',
      'Keep title concise and descriptive',
    ],
    common_mistakes: [
      'Forgetting breadcrumbs',
      'Title too long or vague',
    ],
  },

  Card: {
    name: 'Card',
    description: 'Container for grouping related content',
    when_to_use: 'Group related information or components',
    category: 'layout',
    required_props: [],
    optional_props: ['title', 'description', 'children', 'collapsible', 'defaultCollapsed'],
    prop_types: {
      title: 'string',
      description: 'string',
      children: 'ReactNode',
      collapsible: 'boolean',
    },
    examples: [
      {
        scenario: 'Group related metrics',
        props: {
          title: 'System Metrics',
          description: 'Key performance indicators',
          collapsible: true,
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Use title and description for clarity',
      'Make collapsible for optional content',
      'Group logically related items',
    ],
    common_mistakes: [
      'Too many cards on one page',
      'Not using titles effectively',
    ],
  },

  Grid: {
    name: 'Grid',
    description: 'Responsive grid layout for arranging components',
    when_to_use: 'Arrange multiple components in a grid pattern',
    category: 'layout',
    required_props: ['columns'],
    optional_props: ['gap', 'children'],
    prop_types: {
      columns: 'number',
      gap: 'number',
      children: 'ReactNode[]',
    },
    examples: [
      {
        scenario: 'Display metrics in grid',
        props: {
          columns: 3,
          gap: 4,
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Use 2-4 columns for most layouts',
      'Consistent gap spacing',
      'Responsive column counts',
    ],
    common_mistakes: [
      'Too many columns',
      'Inconsistent gaps',
    ],
  },

  StatCard: {
    name: 'StatCard',
    description: 'Display a single metric or statistic',
    when_to_use: 'Show key metrics, KPIs, or statistics',
    category: 'data',
    required_props: ['label', 'value'],
    optional_props: ['icon', 'color', 'trend', 'change'],
    prop_types: {
      label: 'string',
      value: 'string | number',
      icon: 'string',
      color: 'string',
      trend: 'up | down | neutral',
    },
    examples: [
      {
        scenario: 'Display KPI',
        props: {
          label: 'Success Rate',
          value: '85%',
          icon: 'trending-up',
          color: 'green',
          trend: 'up',
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Use in Grid for multiple stats',
      'Include trend indicators',
      'Choose appropriate colors',
    ],
    common_mistakes: [
      'Too much text in label',
      'Missing units on values',
    ],
  },

  Tabs: {
    name: 'Tabs',
    description: 'Tabbed interface for organizing content',
    when_to_use: 'Organize related content into separate views',
    category: 'layout',
    required_props: ['children'],
    optional_props: ['defaultTab'],
    prop_types: {
      children: 'TabPanel[]',
      defaultTab: 'string',
    },
    examples: [
      {
        scenario: 'Organize analysis sections',
        props: {
          defaultTab: 'overview',
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Use for 3-7 related sections',
      'Clear tab labels',
      'Set sensible default tab',
    ],
    common_mistakes: [
      'Too many tabs',
      'Unclear tab labels',
    ],
  },

  TabPanel: {
    name: 'TabPanel',
    description: 'Individual tab content within Tabs',
    when_to_use: 'Define content for each tab',
    category: 'layout',
    required_props: ['id', 'label'],
    optional_props: ['icon', 'children'],
    prop_types: {
      id: 'string',
      label: 'string',
      icon: 'string',
      children: 'ReactNode',
    },
    examples: [
      {
        scenario: 'Tab with icon',
        props: {
          id: 'overview',
          label: 'Overview',
          icon: 'home',
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Unique IDs for each tab',
      'Descriptive labels',
      'Optional icons for clarity',
    ],
    common_mistakes: [
      'Duplicate IDs',
      'Missing labels',
    ],
  },

  Stack: {
    name: 'Stack',
    description: 'Vertical stack of components',
    when_to_use: 'Arrange components vertically with consistent spacing',
    category: 'layout',
    required_props: ['children'],
    optional_props: ['gap'],
    prop_types: {
      children: 'ReactNode[]',
      gap: 'number',
    },
    examples: [
      {
        scenario: 'Stack cards vertically',
        props: {
          gap: 4,
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Consistent gap spacing',
      'Use for vertical layouts',
      'Combine with Grid for complex layouts',
    ],
    common_mistakes: [
      'Inconsistent gaps',
      'Too many items without grouping',
    ],
  },

  ActionBar: {
    name: 'ActionBar',
    description: 'Bar with action buttons',
    when_to_use: 'Provide primary and secondary actions',
    category: 'navigation',
    required_props: ['actions'],
    optional_props: [],
    prop_types: {
      actions: 'Action[]',
    },
    examples: [
      {
        scenario: 'Page actions',
        props: {
          actions: [
            { label: 'Cancel', variant: 'secondary', onClick: 'cancel' },
            { label: 'Save', variant: 'primary', onClick: 'save' },
          ],
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Primary action on right',
      'Secondary actions on left',
      'Clear action labels',
    ],
    common_mistakes: [
      'Too many actions',
      'Unclear labels',
    ],
  },

  Alert: {
    name: 'Alert',
    description: 'Display important messages or notifications',
    when_to_use: 'Show warnings, errors, or informational messages',
    category: 'feedback',
    required_props: ['message'],
    optional_props: ['variant', 'title', 'dismissible'],
    prop_types: {
      variant: 'info | warning | error | success',
      title: 'string',
      message: 'string',
      dismissible: 'boolean',
    },
    examples: [
      {
        scenario: 'Warning message',
        props: {
          variant: 'warning',
          title: 'Incomplete Data',
          message: 'Some required fields are missing',
        },
        layout_recommendation: 'default',
      },
    ],
    best_practices: [
      'Use appropriate variant',
      'Clear, actionable messages',
      'Include title for context',
    ],
    common_mistakes: [
      'Wrong variant for message type',
      'Vague messages',
    ],
  },
};

/**
 * Get component tool by name
 */
export function getComponentTool(name: string): ComponentTool | undefined {
  return COMPONENT_TOOL_REGISTRY[name];
}

/**
 * Get all component tools
 */
export function getAllComponentTools(): ComponentTool[] {
  return Object.values(COMPONENT_TOOL_REGISTRY);
}

/**
 * Get component tools by category
 */
export function getComponentToolsByCategory(
  category: ComponentTool['category']
): ComponentTool[] {
  return getAllComponentTools().filter((tool) => tool.category === category);
}

/**
 * Search component tools by description
 */
export function searchComponentTools(query: string): ComponentTool[] {
  const lowerQuery = query.toLowerCase();
  return getAllComponentTools().filter(
    (tool) =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.when_to_use.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get component tool documentation for LLM
 */
export function getComponentToolDocumentation(): string {
  const tools = getAllComponentTools();
  
  return tools
    .map(
      (tool) => `
## ${tool.name}
**Category**: ${tool.category}
**Description**: ${tool.description}
**When to use**: ${tool.when_to_use}

**Required Props**: ${tool.required_props.join(', ') || 'none'}
**Optional Props**: ${tool.optional_props.join(', ') || 'none'}

**Best Practices**:
${tool.best_practices.map((bp) => `- ${bp}`).join('\n')}

**Common Mistakes**:
${tool.common_mistakes.map((cm) => `- ${cm}`).join('\n')}

**Example**:
\`\`\`json
${JSON.stringify(tool.examples[0], null, 2)}
\`\`\`
`
    )
    .join('\n---\n');
}

/**
 * Validate component selection
 */
export function validateComponentSelection(
  componentName: string,
  props: Record<string, any>
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const tool = getComponentTool(componentName);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tool) {
    errors.push(`Component "${componentName}" not found in registry`);
    return { valid: false, errors, warnings };
  }

  // Check required props
  for (const requiredProp of tool.required_props) {
    if (!(requiredProp in props)) {
      errors.push(`Missing required prop: ${requiredProp}`);
    }
  }

  // Check for unknown props
  const allProps = [...tool.required_props, ...tool.optional_props];
  for (const prop of Object.keys(props)) {
    if (!allProps.includes(prop) && prop !== 'context' && prop !== 'metadata') {
      warnings.push(`Unknown prop: ${prop}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export default COMPONENT_TOOL_REGISTRY;
