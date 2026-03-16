/**
 * Type-Safe Hydration for SDUI Components
 *
 * Validates backend JSON schemas against frontend TypeScript types
 * before rendering components to prevent runtime errors.
 */

import { logger } from "@shared/lib/logger";
import { z } from "zod";

import { ComponentResolutionResult, resolveComponentWithVersion, versionedRegistry } from "./registry";
import { SDUIComponentSection } from "./schema";

/**
 * Validation result for component props
 */
export interface PropValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  validatedProps: Record<string, unknown>;
}

/**
 * Component prop schema registry
 */
const componentPropSchemas = new Map<string, z.ZodSchema<unknown>>();

/**
 * Register a prop schema for a component
 */
export function registerComponentPropSchema(componentName: string, schema: z.ZodSchema<unknown>): void {
  componentPropSchemas.set(componentName, schema);
  logger.info("Component prop schema registered", { componentName });
}

/**
 * Get prop schema for a component
 */
export function getComponentPropSchema(componentName: string): z.ZodSchema<unknown> | null {
  return componentPropSchemas.get(componentName) || null;
}

/**
 * Create a dynamic prop schema from component metadata
 */
function createDynamicPropSchema(
  componentName: string,
  requiredProps: string[] = [],
  optionalProps: string[] = []
): z.ZodSchema<unknown> {
  const schema: Record<string, z.ZodTypeAny> = {};

  // Add required props
  for (const prop of requiredProps) {
    schema[prop] = z.any(); // Allow any type for required props
  }

  // Add optional props
  for (const prop of optionalProps) {
    schema[prop] = z.any().optional();
  }

  // Allow additional unknown props
  return z.object(schema).passthrough();
}

/**
 * Validate component props against schema
 */
export function validateComponentProps(
  section: SDUIComponentSection,
  componentResult: ComponentResolutionResult
): PropValidationResult {
  const { component, version } = componentResult;
  const componentName = section.component;
  const props: Record<string, unknown> = section.props || {};

  const errors: string[] = [];
  const warnings: string[] = [];

  // Get component metadata from registry
  const resolutionResult = resolveComponentWithVersion(componentName, version);
  if (!resolutionResult) {
    errors.push(`No metadata found for component ${componentName} v${version}`);
    return {
      success: false,
      errors,
      warnings,
      validatedProps: props,
    };
  }

  const versionedMeta = versionedRegistry.getMetadata(componentName, version);

  // Try to get registered schema first
  let schema = getComponentPropSchema(componentName);

  // If no schema registered, create dynamic schema from metadata
  if (!schema) {
    schema = createDynamicPropSchema(
      componentName,
      versionedMeta?.requiredProps ?? [],
      versionedMeta?.optionalProps ?? []
    );
    warnings.push(
      `Using dynamic schema for ${componentName} - consider registering a proper Zod schema`
    );
  }

  // Validate props
  const validation = schema.safeParse(props);

  if (!validation.success) {
    for (const issue of validation.error.issues) {
      const path = issue.path.join(".");
      errors.push(`${componentName}.${path}: ${issue.message}`);
    }
  }

  // Check required props
  if (versionedMeta?.requiredProps) {
    for (const requiredProp of versionedMeta.requiredProps) {
      if (!(requiredProp in props)) {
        errors.push(`${componentName}: Missing required prop '${requiredProp}'`);
      }
    }
  }

  // Validate version compatibility
  if (resolutionResult.isDeprecated) {
    warnings.push(
      `${componentName} v${version} is deprecated: ${resolutionResult.deprecationMessage ?? "Component is deprecated"}`
    );
  }

  const validatedProps = validation.success ? (validation.data as Record<string, unknown>) : props;

  return {
    success: errors.length === 0,
    errors,
    warnings,
    validatedProps,
  };
}

/**
 * Enhanced useDataBindings with type-safe validation
 */
export function useValidatedDataBindings<T extends Record<string, unknown>>(
  props: T,
  options: {
    resolver?: unknown;
    context?: unknown;
    componentName?: string;
    componentVersion?: number;
  }
): {
  props: T;
  loading: boolean;
  errors: Record<string, string>;
  validationErrors: string[];
  validationWarnings: string[];
  refresh: () => Promise<void>;
} {
  const { resolver, context, componentName, componentVersion } = options;

  // useDataBindings resolves a single DataBinding — pass props as-is when not a binding
  const resolvedProps = props;
  const loading = false;
  const errors: Record<string, string> = {};
  const refresh = async () => { /* no-op: props are static */ };

  // Perform type validation if component info is provided
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  if (componentName && componentVersion) {
    const componentResult = resolveComponentWithVersion(componentName, componentVersion);
    if (componentResult?.component) {
      const section: SDUIComponentSection = {
        type: "component",
        component: componentName,
        version: componentVersion,
        props: resolvedProps as Record<string, unknown>,
      };

      const validation = validateComponentProps(section, componentResult);
      validationErrors.push(...validation.errors);
      validationWarnings.push(...validation.warnings);
    } else {
      validationErrors.push(`Component ${componentName} v${componentVersion} not found`);
    }
  }

  return {
    props: resolvedProps,
    loading,
    errors,
    validationErrors,
    validationWarnings,
    refresh,
  };
}

// Re-export the original hook for backward compatibility
export { useDataBindings } from "./useDataBinding";