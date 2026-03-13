/**
 * Canvas Action Applier
 *
 * Pure functions for applying AtomicUIActions to an SDUIPageDefinition.
 * Extracted from CanvasSchemaService to keep that class focused on
 * schema generation and caching concerns.
 */

import {
  AddComponentAction,
  AtomicUIAction,
  ComponentSelector,
  MutateComponentAction,
  PropertyMutation,
  RemoveComponentAction,
  ReorderComponentsAction,
  UpdateLayoutAction,
} from "@sdui/AtomicUIActions";
import { SDUIComponentSection, SDUILayoutDirective, SDUIPageDefinition } from "@valueos/sdui";

import { logger } from "../../lib/logger.js";

/**
 * Apply a list of atomic actions to a schema, returning a new schema.
 * The input schema is not mutated.
 */
export async function applyAtomicActions(
  schema: SDUIPageDefinition,
  actions: AtomicUIAction[]
): Promise<SDUIPageDefinition> {
  const newSchema = JSON.parse(JSON.stringify(schema)) as SDUIPageDefinition;

  logger.debug("Applying atomic actions", { actionCount: actions.length });

  for (const action of actions) {
    try {
      await applyAction(newSchema, action as AtomicUIAction);
    } catch (error) {
      logger.warn("Failed to apply atomic action", {
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return newSchema;
}

async function applyAction(
  schema: SDUIPageDefinition,
  action: AtomicUIAction
): Promise<void> {
  switch (action.type) {
    case "mutate_component":
      applyMutateComponent(schema, action);
      break;
    case "add_component":
      applyAddComponent(schema, action);
      break;
    case "remove_component":
      applyRemoveComponent(schema, action);
      break;
    case "reorder_components":
      applyReorderComponents(schema, action);
      break;
    case "update_layout":
      applyUpdateLayout(schema, action);
      break;
    case "batch":
      for (const subAction of action.actions) {
        await applyAction(schema, subAction);
      }
      break;
  }
}

function applyMutateComponent(
  schema: SDUIPageDefinition,
  action: MutateComponentAction
): void {
  const indices = findComponentIndices(schema, action.selector);

  if (indices.length === 0) {
    logger.debug("No component found for mutation", { selector: action.selector });
    return;
  }

  for (const index of indices) {
    const section = schema.sections[index];
    if (section.type !== "component") continue;

    for (const mutation of action.mutations) {
      applyPropertyMutation(section as unknown as Record<string, unknown>, mutation);
    }
  }
}

function applyPropertyMutation(obj: Record<string, unknown>, mutation: PropertyMutation): void {
  const { path, operation, value } = mutation;
  const parts = path.split(/\.|\[|\]/).filter((p) => p !== "");
  const last = parts.pop();

  if (!last) return;

  let current = obj;
  for (const part of parts) {
    if (Array.isArray(current)) {
      const idx = parseInt(part, 10);
      if (isNaN(idx)) return;
      current = current[idx] as Record<string, unknown>;
    } else {
      if (!(part in current)) current[part] = {};
      current = current[part] as Record<string, unknown>;
    }
    if (current === undefined || current === null) return;
  }

  switch (operation) {
    case "set":
    case "replace":
      if (Array.isArray(current) && !isNaN(parseInt(last, 10))) {
        (current as unknown[])[parseInt(last, 10)] = value;
      } else {
        current[last] = value;
      }
      break;
    case "merge":
      if (current[last] && typeof current[last] === "object") {
        Object.assign(current[last] as object, value);
      } else {
        current[last] = value;
      }
      break;
    case "append":
      if (!current[last]) current[last] = [];
      if (Array.isArray(current[last])) (current[last] as unknown[]).push(value);
      break;
    case "prepend":
      if (!current[last]) current[last] = [];
      if (Array.isArray(current[last])) (current[last] as unknown[]).unshift(value);
      break;
    case "remove":
      if (Array.isArray(current)) {
        const idx = parseInt(last, 10);
        if (!isNaN(idx)) current.splice(idx, 1);
      } else {
        delete current[last];
      }
      break;
  }
}

function applyAddComponent(schema: SDUIPageDefinition, action: AddComponentAction): void {
  const newSection: SDUIComponentSection = {
    type: "component",
    component: action.component.component,
    version: action.component.version ? parseInt(action.component.version, 10) : 1,
    props: action.component.props || {},
  };

  const { position } = action;
  let insertIndex = schema.sections.length;

  if (position.index !== undefined) {
    insertIndex = position.index;
  } else if (position.before) {
    const indices = findComponentIndices(schema, position.before);
    if (indices.length > 0) insertIndex = indices[0];
  } else if (position.after) {
    const indices = findComponentIndices(schema, position.after);
    if (indices.length > 0) insertIndex = indices[0] + 1;
  } else if (position.append) {
    insertIndex = schema.sections.length;
  }

  if (insertIndex < 0) insertIndex = 0;
  if (insertIndex > schema.sections.length) insertIndex = schema.sections.length;

  schema.sections.splice(insertIndex, 0, newSection);
}

function applyRemoveComponent(schema: SDUIPageDefinition, action: RemoveComponentAction): void {
  const indices = findComponentIndices(schema, action.selector);
  indices.sort((a, b) => b - a);
  for (const index of indices) {
    schema.sections.splice(index, 1);
  }
}

function applyReorderComponents(schema: SDUIPageDefinition, action: ReorderComponentsAction): void {
  const { order } = action;
  if (!Array.isArray(order) || order.length === 0) return;

  const existingSections = [...schema.sections];
  const newSections: typeof schema.sections = [];

  if (typeof order[0] === "number") {
    const indices = order as number[];
    if (indices.some((i) => i < 0 || i >= existingSections.length)) return;

    for (const idx of indices) newSections.push(existingSections[idx]);
    existingSections.forEach((_, idx) => {
      if (!indices.includes(idx)) newSections.push(existingSections[idx]);
    });
    schema.sections = newSections;
  } else if (typeof order[0] === "string") {
    const ids = order as string[];
    const sectionsById = new Map<string, SDUIComponentSection>();
    const sectionsWithoutId: SDUIComponentSection[] = [];

    existingSections.forEach((s) => {
      if (s.type === "component" && s.props?.id) {
        sectionsById.set(s.props.id as string, s as SDUIComponentSection);
      } else {
        sectionsWithoutId.push(s as SDUIComponentSection);
      }
    });

    const reorderedWithIds: SDUIComponentSection[] = [];
    ids.forEach((id) => {
      const s = sectionsById.get(id);
      if (s) {
        reorderedWithIds.push(s);
        sectionsById.delete(id);
      }
    });

    schema.sections = [
      ...reorderedWithIds,
      ...Array.from(sectionsById.values()),
      ...sectionsWithoutId,
    ];
  }
}

function applyUpdateLayout(schema: SDUIPageDefinition, action: UpdateLayoutAction): void {
  const layoutIndex = schema.sections.findIndex((s) => s.type === "layout.directive");
  if (layoutIndex !== -1) {
    const section = schema.sections[layoutIndex];
    if (section.type === "layout.directive") {
      section.layout = action.layout as SDUILayoutDirective["layout"];
    }
  }
}

export function findComponentIndices(
  schema: SDUIPageDefinition,
  selector: ComponentSelector
): number[] {
  const indices: number[] = [];

  if (typeof selector.index === "number") {
    if (selector.index >= 0 && selector.index < schema.sections.length) {
      return [selector.index];
    }
    return [];
  }

  schema.sections.forEach((section, index) => {
    if (section.type !== "component") return;

    let match = true;
    if (selector.id && section.props?.id !== selector.id) match = false;
    if (match && selector.type && section.component !== selector.type) match = false;
    if (match && selector.props) {
      for (const [key, value] of Object.entries(selector.props)) {
        if (section.props?.[key] !== value) { match = false; break; }
      }
    }

    if (match) indices.push(index);
  });

  return indices;
}
