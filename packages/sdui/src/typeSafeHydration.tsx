/**
 * Type-Safe Hydration for SDUI Components
 *
 * Validates backend JSON schemas against frontend TypeScript types
 * before rendering components to prevent runtime errors.
 */

import { z } from "zod";
import { SDUIComponentSection } from "./schema";
import { ComponentResolutionResult, resolveComponentWithVersion } from "./registry";
import { useDataBindings } from "./useDataBinding";
import { logger } from "@shared/lib/logger";

/**
 * Validation result for component props
 */
export interface PropValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  validatedProps: Record<string, any>;
}

/**
 * Component prop schema registry
 */
const componentPropSchemas = new Map<string, z.ZodSchema<any>>();

/**
 * Register a prop schema for a component
 */
export function registerComponentPropSchema(componentName: string, schema: z.ZodSchema<any>): void {
  componentPropSchemas.set(componentName, schema);
  logger.info("Component prop schema registered", { componentName });
}

/**
 * Get prop schema for a component
 */
export function getComponentPropSchema(componentName: string): z.ZodSchema<any> | null {
  return componentPropSchemas.get(componentName) || null;
}

/**
 * Create a dynamic prop schema from component metadata
 */
function createDynamicPropSchema(
  componentName: string,
  requiredProps: string[] = [],
  optionalProps: string[] = []
): z.ZodSchema<any> {
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
  const props = section.props || {};

  const errors: string[] = [];
  const warnings: string[] = [];

  // Get component metadata from registry
  const metadata = resolveComponentWithVersion(componentName, version);
  if (!metadata) {
    errors.push(`No metadata found for component ${componentName} v${version}`);
    return {
      success: false,
      errors,
      warnings,
      validatedProps: props,
    };
  }

  // Try to get registered schema first
  let schema = getComponentPropSchema(componentName);

  // If no schema registered, create dynamic schema from metadata
  if (!schema) {
    schema = createDynamicPropSchema(
      componentName,
      metadata.requiredProps || [],
      metadata.optionalProps || []
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
  if (metadata.requiredProps) {
    for (const requiredProp of metadata.requiredProps) {
      if (!(requiredProp in props)) {
        errors.push(`${componentName}: Missing required prop '${requiredProp}'`);
      }
    }
  }

  // Validate version compatibility
  if (metadata.deprecated) {
    warnings.push(
      `${componentName} v${version} is deprecated: ${metadata.deprecationMessage || "Component is deprecated"}`
    );
  }

  const validatedProps = validation.success ? validation.data : props;

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
export function useValidatedDataBindings<T extends Record<string, any>>(
  props: T,
  options: {
    resolver?: any;
    context?: any;
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

  // Use existing data binding resolution
  const {
    props: resolvedProps,
    loading,
    errors,
    refresh,
  } = useDataBindings(props, { resolver, context });

  // Perform type validation if component info is provided
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  if (componentName && componentVersion) {
    const componentResult = resolveComponentWithVersion(componentName, componentVersion);
    if (componentResult.component) {
      const section = {
        type: "component" as const,
        component: componentName,
        version: componentVersion,
        props: resolvedProps,
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
