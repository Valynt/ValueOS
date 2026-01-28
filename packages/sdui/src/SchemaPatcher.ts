/**
 * Schema Delta Update System
 *
 * Allows agents to make surgical updates to SDUI schemas without re-rendering entire structures
 *
 * @example
 * ```typescript
 * const delta: SchemaDelta = {
 *   operations: [
 *     { op: 'add_section', section: { type: 'component', component: 'NewComponent', props: {} } }
 *   ],
 *   reason: 'Adding new KPI section',
 *   timestamp: Date.now(),
 * };
 *
 * const newSchema = SchemaPatcher.applyDelta(currentSchema, delta);
 * ```
 */

import { SDUIPageDefinition, SDUISection } from "./schema";

export type SchemaPatchOperation =
  | { op: "replace"; path: string; value: any }
  | { op: "add_section"; section: SDUISection; index?: number }
  | { op: "remove_section"; index: number }
  | { op: "update_section"; index: number; section: Partial<SDUISection> }
  | { op: "update_metadata"; metadata: Record<string, any> };

export interface SchemaDelta {
  operations: SchemaPatchOperation[];
  reason?: string;
  timestamp: number;
}

export class SchemaPatcher {
  /**
   * Apply delta patches to existing schema state
   */
  static applyDelta(currentSchema: SDUIPageDefinition, delta: SchemaDelta): SDUIPageDefinition {
    let newSchema = { ...currentSchema };

    for (const op of delta.operations) {
      switch (op.op) {
        case "replace":
          newSchema = this.applyReplace(newSchema, op.path, op.value);
          break;
        case "add_section":
          newSchema = this.applyAddSection(newSchema, op.section, op.index);
          break;
        case "remove_section":
          newSchema = this.applyRemoveSection(newSchema, op.index);
          break;
        case "update_section":
          newSchema = this.applyUpdateSection(newSchema, op.index, op.section);
          break;
        case "update_metadata":
          newSchema = this.applyUpdateMetadata(newSchema, op.metadata);
          break;
      }
    }

    return newSchema;
  }

  private static applyReplace(
    schema: SDUIPageDefinition,
    path: string,
    value: any
  ): SDUIPageDefinition {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) {
      return value; // Replace entire schema
    }

    const updateNested = (obj: any, keys: string[]): any => {
      if (keys.length === 0) return value;
      const [head, ...tail] = keys;
      if (Array.isArray(obj)) {
        const index = parseInt(head, 10);
        if (isNaN(index)) return obj;
        return obj.map((item, i) => (i === index ? updateNested(item, tail) : item));
      }
      if (obj && typeof obj === "object") {
        return {
          ...obj,
          [head]: updateNested(obj[head], tail),
        };
      }
      return obj;
    };

    return updateNested(schema, parts);
  }

  private static applyAddSection(
    schema: SDUIPageDefinition,
    section: SDUISection,
    index?: number
  ): SDUIPageDefinition {
    const newSections = [...schema.sections];
    const insertIndex =
      index !== undefined ? Math.min(index, newSections.length) : newSections.length;
    newSections.splice(insertIndex, 0, section);
    return {
      ...schema,
      sections: newSections,
    };
  }

  private static applyRemoveSection(schema: SDUIPageDefinition, index: number): SDUIPageDefinition {
    if (index < 0 || index >= schema.sections.length) return schema;
    const newSections = schema.sections.filter((_, i) => i !== index);
    return {
      ...schema,
      sections: newSections,
    };
  }

  private static applyUpdateSection(
    schema: SDUIPageDefinition,
    index: number,
    updates: Partial<SDUISection>
  ): SDUIPageDefinition {
    if (index < 0 || index >= schema.sections.length) return schema;
    const newSections = schema.sections.map((section, i) =>
      i === index ? { ...section, ...updates } : section
    );
    return {
      ...schema,
      sections: newSections,
    };
  }

  private static applyUpdateMetadata(
    schema: SDUIPageDefinition,
    metadata: Record<string, any>
  ): SDUIPageDefinition {
    return {
      ...schema,
      metadata: {
        ...schema.metadata,
        ...metadata,
      },
    };
  }

  /**
   * Validate delta before applying
   */
  static validateDelta(
    schema: SDUIPageDefinition,
    delta: SchemaDelta
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const op of delta.operations) {
      switch (op.op) {
        case "add_section":
          if (!op.section || typeof op.section !== "object") {
            errors.push("add_section: invalid section");
          }
          break;
        case "remove_section":
        case "update_section":
          if (op.index < 0 || op.index >= schema.sections.length) {
            errors.push(`${op.op}: invalid index ${op.index}`);
          }
          break;
        case "update_metadata":
          if (!op.metadata || typeof op.metadata !== "object") {
            errors.push("update_metadata: invalid metadata");
          }
          break;
        case "replace":
          // Path validation could be added here
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
