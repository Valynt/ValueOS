/**
 * Component Mutation Service
 * 
 * Applies atomic UI actions to SDUI layouts without full regeneration.
 * Enables snappy, responsive UI updates in the Playground.
 */

import { logger } from '../lib/logger';
import { SDUIPageDefinition, SDUIComponentSection } from '../sdui/schema';
import {
  AtomicUIAction,
  MutateComponentAction,
  AddComponentAction,
  RemoveComponentAction,
  ReorderComponentsAction,
  UpdateLayoutAction,
  BatchAction,
  ComponentSelector,
  PropertyMutation,
  ActionResult,
  validateAtomicAction,
} from '../sdui/AtomicUIActions';

/**
 * Component Mutation Service
 */
export class ComponentMutationService {
  /**
   * Apply an atomic action to a layout
   */
  async applyAction(
    layout: SDUIPageDefinition,
    action: AtomicUIAction
  ): Promise<{ layout: SDUIPageDefinition; result: ActionResult }> {
    const startTime = Date.now();

    // Validate action
    const validation = validateAtomicAction(action);
    if (!validation.valid) {
      return {
        layout,
        result: {
          success: false,
          error: `Invalid action: ${validation.errors.join(', ')}`,
          affected_components: [],
          changes_made: [],
          duration_ms: Date.now() - startTime,
        },
      };
    }

    try {
      // Clone layout to avoid mutations
      const newLayout = JSON.parse(JSON.stringify(layout)) as SDUIPageDefinition;

      let result: ActionResult;

      switch (action.type) {
        case 'mutate_component':
          result = await this.applyMutateComponent(newLayout, action);
          break;
        case 'add_component':
          result = await this.applyAddComponent(newLayout, action);
          break;
        case 'remove_component':
          result = await this.applyRemoveComponent(newLayout, action);
          break;
        case 'reorder_components':
          result = await this.applyReorderComponents(newLayout, action);
          break;
        case 'update_layout':
          result = await this.applyUpdateLayout(newLayout, action);
          break;
        case 'batch':
          result = await this.applyBatchAction(newLayout, action);
          break;
        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }

      result.duration_ms = Date.now() - startTime;

      logger.info('Applied atomic UI action', {
        action_type: action.type,
        success: result.success,
        affected_components: result.affected_components.length,
        duration_ms: result.duration_ms,
      });

      return { layout: newLayout, result };
    } catch (error) {
      logger.error('Failed to apply atomic action', {
        action_type: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        layout,
        result: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          affected_components: [],
          changes_made: [],
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Apply mutate component action
   */
  private async applyMutateComponent(
    layout: SDUIPageDefinition,
    action: MutateComponentAction
  ): Promise<ActionResult> {
    const components = this.findComponents(layout, action.selector);

    if (components.length === 0) {
      return {
        success: false,
        error: 'No components matched selector',
        affected_components: [],
        changes_made: [],
        duration_ms: 0,
      };
    }

    const affectedComponents: string[] = [];
    const changesMade: string[] = [];

    for (const { section, index } of components) {
      // Apply each mutation
      for (const mutation of action.mutations) {
        try {
          this.applyPropertyMutation(section, mutation);
          affectedComponents.push(this.getComponentId(section, index));
          changesMade.push(
            `${mutation.operation} ${mutation.path} on ${section.component}`
          );
        } catch (error) {
          logger.warn('Failed to apply mutation', {
            component: section.component,
            mutation,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return {
      success: affectedComponents.length > 0,
      error: affectedComponents.length === 0 ? 'No mutations applied' : undefined,
      affected_components: affectedComponents,
      changes_made: changesMade,
      duration_ms: 0,
    };
  }

  /**
   * Apply add component action
   */
  private async applyAddComponent(
    layout: SDUIPageDefinition,
    action: AddComponentAction
  ): Promise<ActionResult> {
    const newSection: SDUIComponentSection = {
      component: action.component.component,
      version: action.component.version || '1.0',
      props: action.component.props,
      type: action.component.type,
      layout: action.component.layout,
    };

    let insertIndex: number;

    if (action.position.index !== undefined) {
      insertIndex = action.position.index;
    } else if (action.position.before) {
      const components = this.findComponents(layout, action.position.before);
      if (components.length === 0) {
        return {
          success: false,
          error: 'Before component not found',
          affected_components: [],
          changes_made: [],
          duration_ms: 0,
        };
      }
      insertIndex = components[0].index;
    } else if (action.position.after) {
      const components = this.findComponents(layout, action.position.after);
      if (components.length === 0) {
        return {
          success: false,
          error: 'After component not found',
          affected_components: [],
          changes_made: [],
          duration_ms: 0,
        };
      }
      insertIndex = components[0].index + 1;
    } else {
      // Append to end
      insertIndex = layout.sections.length;
    }

    layout.sections.splice(insertIndex, 0, newSection);

    return {
      success: true,
      affected_components: [this.getComponentId(newSection, insertIndex)],
      changes_made: [`Added ${newSection.component} at index ${insertIndex}`],
      duration_ms: 0,
    };
  }

  /**
   * Apply remove component action
   */
  private async applyRemoveComponent(
    layout: SDUIPageDefinition,
    action: RemoveComponentAction
  ): Promise<ActionResult> {
    const components = this.findComponents(layout, action.selector);

    if (components.length === 0) {
      return {
        success: false,
        error: 'No components matched selector',
        affected_components: [],
        changes_made: [],
        duration_ms: 0,
      };
    }

    const affectedComponents: string[] = [];
    const changesMade: string[] = [];

    // Remove in reverse order to maintain indices
    for (let i = components.length - 1; i >= 0; i--) {
      const { section, index } = components[i];
      affectedComponents.push(this.getComponentId(section, index));
      changesMade.push(`Removed ${section.component} at index ${index}`);
      layout.sections.splice(index, 1);
    }

    return {
      success: true,
      affected_components: affectedComponents,
      changes_made: changesMade,
      duration_ms: 0,
    };
  }

  /**
   * Apply reorder components action
   */
  private async applyReorderComponents(
    layout: SDUIPageDefinition,
    action: ReorderComponentsAction
  ): Promise<ActionResult> {
    const newSections: SDUIComponentSection[] = [];

    for (const item of action.order) {
      const index = typeof item === 'number' ? item : parseInt(item, 10);
      if (index >= 0 && index < layout.sections.length) {
        newSections.push(layout.sections[index]);
      }
    }

    if (newSections.length === 0) {
      return {
        success: false,
        error: 'No valid indices in order array',
        affected_components: [],
        changes_made: [],
        duration_ms: 0,
      };
    }

    layout.sections = newSections;

    return {
      success: true,
      affected_components: newSections.map((s, i) => this.getComponentId(s, i)),
      changes_made: ['Reordered components'],
      duration_ms: 0,
    };
  }

  /**
   * Apply update layout action
   */
  private async applyUpdateLayout(
    layout: SDUIPageDefinition,
    action: UpdateLayoutAction
  ): Promise<ActionResult> {
    // Find layout directive section
    const layoutSection = layout.sections.find(
      (s) => s.type === 'layout.directive'
    );

    if (!layoutSection) {
      // Add new layout directive
      layout.sections.unshift({
        component: 'LayoutDirective',
        version: '1.0',
        type: 'layout.directive',
        layout: action.layout,
        props: {},
      });

      return {
        success: true,
        affected_components: ['layout_directive'],
        changes_made: [`Set layout to ${action.layout}`],
        duration_ms: 0,
      };
    }

    // Update existing layout directive
    layoutSection.layout = action.layout;

    return {
      success: true,
      affected_components: ['layout_directive'],
      changes_made: [`Changed layout to ${action.layout}`],
      duration_ms: 0,
    };
  }

  /**
   * Apply batch action
   */
  private async applyBatchAction(
    layout: SDUIPageDefinition,
    action: BatchAction
  ): Promise<ActionResult> {
    const allAffectedComponents: string[] = [];
    const allChangesMade: string[] = [];
    let allSucceeded = true;

    for (const subAction of action.actions) {
      const { result } = await this.applyAction(layout, subAction);

      if (!result.success) {
        allSucceeded = false;
        logger.warn('Batch action sub-action failed', {
          action_type: subAction.type,
          error: result.error,
        });
      }

      allAffectedComponents.push(...result.affected_components);
      allChangesMade.push(...result.changes_made);
    }

    return {
      success: allSucceeded,
      affected_components: [...new Set(allAffectedComponents)],
      changes_made: allChangesMade,
      duration_ms: 0,
    };
  }

  /**
   * Find components matching selector
   */
  private findComponents(
    layout: SDUIPageDefinition,
    selector: ComponentSelector
  ): Array<{ section: SDUIComponentSection; index: number }> {
    const matches: Array<{ section: SDUIComponentSection; index: number }> = [];

    for (let i = 0; i < layout.sections.length; i++) {
      const section = layout.sections[i];

      // Check ID match
      if (selector.id && this.getComponentId(section, i) === selector.id) {
        matches.push({ section, index: i });
        continue;
      }

      // Check type match
      if (selector.type && section.component !== selector.type) {
        continue;
      }

      // Check index match
      if (selector.index !== undefined && i !== selector.index) {
        continue;
      }

      // Check props match
      if (selector.props) {
        if (!this.propsMatch(section.props, selector.props)) {
          continue;
        }
      }

      // Check description match (fuzzy)
      if (selector.description) {
        const description = selector.description.toLowerCase();
        const componentName = section.component.toLowerCase();
        const propsStr = JSON.stringify(section.props).toLowerCase();

        if (!componentName.includes(description) && !propsStr.includes(description)) {
          continue;
        }
      }

      matches.push({ section, index: i });
    }

    return matches;
  }

  /**
   * Check if props match selector
   */
  private propsMatch(
    componentProps: Record<string, any>,
    selectorProps: Record<string, any>
  ): boolean {
    for (const [key, value] of Object.entries(selectorProps)) {
      if (componentProps[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Apply property mutation to component
   */
  private applyPropertyMutation(
    section: SDUIComponentSection,
    mutation: PropertyMutation
  ): void {
    const { path, operation, value } = mutation;

    // Parse path
    const parts = this.parsePath(path);
    if (parts.length === 0) {
      throw new Error('Invalid path');
    }

    // Navigate to parent object
    let current: any = section;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part.type === 'property') {
        if (!(part.key in current)) {
          current[part.key] = {};
        }
        current = current[part.key];
      } else if (part.type === 'array') {
        if (!Array.isArray(current)) {
          throw new Error(`Expected array at ${part.key}`);
        }
        current = current[part.index];
      }
    }

    // Apply operation
    const lastPart = parts[parts.length - 1];

    if (lastPart.type === 'property') {
      switch (operation) {
        case 'set':
          current[lastPart.key] = value;
          break;
        case 'merge':
          if (typeof current[lastPart.key] === 'object' && typeof value === 'object') {
            current[lastPart.key] = { ...current[lastPart.key], ...value };
          } else {
            current[lastPart.key] = value;
          }
          break;
        case 'append':
          if (!Array.isArray(current[lastPart.key])) {
            current[lastPart.key] = [];
          }
          current[lastPart.key].push(value);
          break;
        case 'prepend':
          if (!Array.isArray(current[lastPart.key])) {
            current[lastPart.key] = [];
          }
          current[lastPart.key].unshift(value);
          break;
        case 'remove':
          delete current[lastPart.key];
          break;
        case 'replace':
          current[lastPart.key] = value;
          break;
      }
    } else if (lastPart.type === 'array') {
      if (!Array.isArray(current)) {
        throw new Error('Expected array');
      }

      switch (operation) {
        case 'set':
        case 'replace':
          current[lastPart.index] = value;
          break;
        case 'remove':
          current.splice(lastPart.index, 1);
          break;
        default:
          throw new Error(`Operation ${operation} not supported for array index`);
      }
    }
  }

  /**
   * Parse property path
   */
  private parsePath(
    path: string
  ): Array<{ type: 'property'; key: string } | { type: 'array'; key: string; index: number }> {
    const parts: Array<
      { type: 'property'; key: string } | { type: 'array'; key: string; index: number }
    > = [];

    const segments = path.split('.');

    for (const segment of segments) {
      // Check for array access: key[index]
      const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        parts.push({ type: 'property', key });
        parts.push({ type: 'array', key, index: parseInt(indexStr, 10) });
      } else {
        parts.push({ type: 'property', key: segment });
      }
    }

    return parts;
  }

  /**
   * Get component ID
   */
  private getComponentId(section: SDUIComponentSection, index: number): string {
    // Use component name + index as ID
    return `${section.component}_${index}`;
  }

  /**
   * Apply multiple actions in sequence
   */
  async applyActions(
    layout: SDUIPageDefinition,
    actions: AtomicUIAction[]
  ): Promise<{ layout: SDUIPageDefinition; results: ActionResult[] }> {
    let currentLayout = layout;
    const results: ActionResult[] = [];

    for (const action of actions) {
      const { layout: newLayout, result } = await this.applyAction(currentLayout, action);
      currentLayout = newLayout;
      results.push(result);

      if (!result.success) {
        logger.warn('Action failed, stopping batch', {
          action_type: action.type,
          error: result.error,
        });
        break;
      }
    }

    return { layout: currentLayout, results };
  }
}

// Singleton instance
let mutationServiceInstance: ComponentMutationService | null = null;

export function getComponentMutationService(): ComponentMutationService {
  if (!mutationServiceInstance) {
    mutationServiceInstance = new ComponentMutationService();
  }
  return mutationServiceInstance;
}

export default ComponentMutationService;
