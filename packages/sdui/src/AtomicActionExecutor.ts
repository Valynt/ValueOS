/**
 * Atomic Action Executor
 *
 * Executes AtomicUIActions against an SDUIPageDefinition with idempotency
 * key tracking. Repeated actions with the same key return the cached result
 * without re-applying mutations.
 */

import { SDUIPageDefinition, SDUISection } from "./schema";
import { SchemaDelta, SchemaPatcher } from "./SchemaPatcher";
import { AtomicUIAction } from "./AtomicUIActions";

export interface ActionExecutionResult {
  success: boolean;
  schema: SDUIPageDefinition;
  affected_components: string[];
  idempotent_hit: boolean;
  changes_made: string[];
  error?: string;
}

const MAX_IDEMPOTENCY_KEYS = 1000;

export class AtomicActionExecutor {
  private executedKeys = new Map<string, ActionExecutionResult>();

  /**
   * Execute an atomic action against a schema.
   * If the action carries an idempotencyKey that was already executed,
   * the previous result is returned without re-applying.
   */
  execute(action: AtomicUIAction, schema: SDUIPageDefinition): ActionExecutionResult {
    // Idempotency check
    if (action.idempotencyKey && this.executedKeys.has(action.idempotencyKey)) {
      const cached = this.executedKeys.get(action.idempotencyKey)!;
      return { ...cached, idempotent_hit: true };
    }

    let result: ActionExecutionResult;

    try {
      result = this.applyAction(action, schema);
    } catch (err) {
      result = {
        success: false,
        schema,
        affected_components: [],
        idempotent_hit: false,
        changes_made: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Store result for idempotency
    if (action.idempotencyKey) {
      this.executedKeys.set(action.idempotencyKey, result);
      this.evictOldKeys();
    }

    return result;
  }

  private applyAction(
    action: AtomicUIAction,
    schema: SDUIPageDefinition
  ): ActionExecutionResult {
    switch (action.type) {
      case "mutate_component":
        return this.applyMutate(action, schema);
      case "add_component":
        return this.applyAdd(action, schema);
      case "remove_component":
        return this.applyRemove(action, schema);
      case "reorder_components":
        return this.applyReorder(action, schema);
      case "update_layout":
        return this.applyLayoutUpdate(action, schema);
      case "batch":
        return this.applyBatch(action, schema);
    }
  }

  private applyMutate(
    action: Extract<AtomicUIAction, { type: "mutate_component" }>,
    schema: SDUIPageDefinition
  ): ActionExecutionResult {
    const idx = this.findSectionIndex(schema, action.selector);
    const found = idx >= 0 ? schema.sections[idx] : undefined;
    if (idx === -1 || !found) {
      return this.noMatch(schema, "mutate_component: no matching section");
    }

    const section = { ...found };
    let props = { ...section.props };

    for (const mutation of action.mutations) {
      const key = mutation.path.replace(/^props\./, "");
      switch (mutation.operation) {
        case "set":
          props[key] = mutation.value;
          break;
        case "merge":
          props[key] =
            typeof props[key] === "object" && typeof mutation.value === "object"
              ? { ...props[key], ...mutation.value }
              : mutation.value;
          break;
        case "remove":
          delete props[key];
          break;
        case "replace":
          props = mutation.value ?? {};
          break;
        case "append":
          if (Array.isArray(props[key])) {
            props[key] = [...props[key], mutation.value];
          }
          break;
        case "prepend":
          if (Array.isArray(props[key])) {
            props[key] = [mutation.value, ...props[key]];
          }
          break;
      }
    }

    section.props = props;
    const newSections = [...schema.sections];
    newSections[idx] = section;

    return {
      success: true,
      schema: { ...schema, sections: newSections },
      affected_components: [section.component],
      idempotent_hit: false,
      changes_made: action.mutations.map(
        (m) => `${m.operation} ${m.path}`
      ),
    };
  }

  private applyAdd(
    action: Extract<AtomicUIAction, { type: "add_component" }>,
    schema: SDUIPageDefinition
  ): ActionExecutionResult {
    const newSection: SDUISection = {
      type: "component" as const,
      component: action.component.component,
      version: Number(action.component.version) || 1,
      props: action.component.props,
    };

    const delta: SchemaDelta = {
      operations: [
        {
          op: "add_section" as const,
          section: newSection,
          index: action.position.index,
        },
      ],
      timestamp: Date.now(),
    };

    const newSchema = SchemaPatcher.applyDelta(schema, delta);

    return {
      success: true,
      schema: newSchema,
      affected_components: [action.component.component],
      idempotent_hit: false,
      changes_made: [action.description ?? `Added ${action.component.component}`],
    };
  }

  private applyRemove(
    action: Extract<AtomicUIAction, { type: "remove_component" }>,
    schema: SDUIPageDefinition
  ): ActionExecutionResult {
    const idx = this.findSectionIndex(schema, action.selector);
    if (idx === -1) {
      return this.noMatch(schema, "remove_component: no matching section");
    }

    const removed = schema.sections[idx];
    if (!removed) {
      return this.noMatch(schema, "remove_component: section not found at index");
    }
    const delta: SchemaDelta = {
      operations: [{ op: "remove_section" as const, index: idx }],
      timestamp: Date.now(),
    };

    const newSchema = SchemaPatcher.applyDelta(schema, delta);

    return {
      success: true,
      schema: newSchema,
      affected_components: [removed.component],
      idempotent_hit: false,
      changes_made: [action.description ?? `Removed section at index ${idx}`],
    };
  }

  private applyReorder(
    action: Extract<AtomicUIAction, { type: "reorder_components" }>,
    schema: SDUIPageDefinition
  ): ActionExecutionResult {
    const newSections = action.order
      .map((ref) => {
        const i = typeof ref === "number" ? ref : schema.sections.findIndex((s) => s.component === ref);
        return schema.sections[i];
      })
      .filter((s): s is SDUISection => s !== undefined);

    return {
      success: true,
      schema: { ...schema, sections: newSections },
      affected_components: newSections.map((s) => s.component),
      idempotent_hit: false,
      changes_made: [action.description ?? "Reordered components"],
    };
  }

  private applyLayoutUpdate(
    action: Extract<AtomicUIAction, { type: "update_layout" }>,
    schema: SDUIPageDefinition
  ): ActionExecutionResult {
    const delta: SchemaDelta = {
      operations: [
        { op: "update_metadata" as const, metadata: { layout: action.layout } },
      ],
      timestamp: Date.now(),
    };

    const newSchema = SchemaPatcher.applyDelta(schema, delta);

    return {
      success: true,
      schema: newSchema,
      affected_components: [],
      idempotent_hit: false,
      changes_made: [action.description ?? `Layout updated to ${action.layout}`],
    };
  }

  private applyBatch(
    action: Extract<AtomicUIAction, { type: "batch" }>,
    schema: SDUIPageDefinition
  ): ActionExecutionResult {
    let currentSchema = schema;
    const allAffected: string[] = [];
    const allChanges: string[] = [];

    for (const subAction of action.actions) {
      const result = this.applyAction(subAction, currentSchema);
      if (!result.success) {
        return {
          ...result,
          affected_components: allAffected,
          changes_made: allChanges,
        };
      }
      currentSchema = result.schema;
      allAffected.push(...result.affected_components);
      allChanges.push(...result.changes_made);
    }

    return {
      success: true,
      schema: currentSchema,
      affected_components: [...new Set(allAffected)],
      idempotent_hit: false,
      changes_made: allChanges,
    };
  }

  private findSectionIndex(
    schema: SDUIPageDefinition,
    selector: { id?: string; type?: string; index?: number; props?: Record<string, any> }
  ): number {
    if (selector.index !== undefined) {
      return selector.index >= 0 && selector.index < schema.sections.length
        ? selector.index
        : -1;
    }

    return schema.sections.findIndex((s) => {
      if (selector.id && s.component !== selector.id && (s as any).id !== selector.id) return false;
      if (selector.type && s.component !== selector.type) return false;
      if (selector.props) {
        for (const [k, v] of Object.entries(selector.props)) {
          if (s.props[k] !== v) return false;
        }
      }
      return true;
    });
  }

  private noMatch(schema: SDUIPageDefinition, error: string): ActionExecutionResult {
    return {
      success: false,
      schema,
      affected_components: [],
      idempotent_hit: false,
      changes_made: [],
      error,
    };
  }

  private evictOldKeys(): void {
    if (this.executedKeys.size > MAX_IDEMPOTENCY_KEYS) {
      const oldest = this.executedKeys.keys().next().value;
      if (oldest !== undefined) {
        this.executedKeys.delete(oldest);
      }
    }
  }

  /** Clear the idempotency cache */
  clearCache(): void {
    this.executedKeys.clear();
  }

  /** Number of cached idempotency keys */
  get cacheSize(): number {
    return this.executedKeys.size;
  }
}
