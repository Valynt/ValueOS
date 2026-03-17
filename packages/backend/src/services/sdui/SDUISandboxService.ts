import { z } from 'zod';

import { logger } from '../../lib/logger.js'
import { SDUISanitizer } from '../../lib/security/SDUISanitizer';

export interface ComponentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedPayload?: unknown;
}

export interface SandboxExecutionResult {
  success: boolean;
  renderedOutput?: string;
  errors: string[];
  performance?: {
    renderTime: number;
    memoryUsage?: number;
  };
}

export class SDUISandboxService {
  /**
   * Validate and sanitize SDUI component payload
   */
  async validateComponent(
    intentType: string,
    payload: unknown,
    organizationId: string
  ): Promise<ComponentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Sanitize the payload first
      const sanitized = SDUISanitizer.sanitize(payload);
      
      // Validate against component schema
      const schema = this.getComponentSchema(intentType);
      if (schema) {
        const validation = schema.safeParse(sanitized);
        if (!validation.success) {
          errors.push(...validation.error.errors.map(e => e.message));
        }
      } else {
        warnings.push(`No schema defined for intent type: ${intentType}`);
      }

      // Check for malicious patterns
      const maliciousPatterns = this.detectMaliciousPatterns(sanitized);
      if (maliciousPatterns.length > 0) {
        errors.push(...maliciousPatterns.map(p => `Malicious pattern detected: ${p}`));
      }

      // Organization-specific validation
      const orgValidation = await this.validateOrganizationRules(organizationId, intentType, sanitized);
      errors.push(...orgValidation.errors);
      warnings.push(...orgValidation.warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        sanitizedPayload: sanitized,
      };
    } catch (error) {
      logger.error('SDUI validation failed', error instanceof Error ? error : undefined);
      return {
        valid: false,
        errors: ['Validation service error'],
        warnings: [],
      };
    }
  }

  /**
   * Execute component in sandbox environment
   */
  async executeInSandbox(
    componentName: string,
    props: unknown,
    organizationId: string
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Validate component exists
      if (!this.isComponentAllowed(componentName, organizationId)) {
        errors.push(`Component ${componentName} not allowed for organization`);
        return { success: false, errors };
      }

      // Simulate component rendering (in real implementation, this would use a headless browser or React test renderer)
      const renderResult = await this.simulateRender(componentName, props);
      
      if (!renderResult.success) {
        errors.push(...renderResult.errors);
      }

      const renderTime = Date.now() - startTime;

      return {
        success: errors.length === 0,
        renderedOutput: renderResult.output,
        errors,
        performance: {
          renderTime,
          // memoryUsage would be measured in real implementation
        },
      };
    } catch (error) {
      logger.error('Sandbox execution failed', error instanceof Error ? error : undefined);
      return {
        success: false,
        errors: ['Sandbox execution failed'],
      };
    }
  }

  /**
   * Get Zod schema for component validation
   */
  private getComponentSchema(intentType: string): z.ZodType | null {
    const schemas: Record<string, z.ZodType> = {
      'visualize_graph': z.object({
        entities: z.array(z.object({
          id: z.string(),
          type: z.string(),
          properties: z.record(z.any()).optional(),
        })),
        relationships: z.array(z.object({
          from: z.string(),
          to: z.string(),
          type: z.string(),
        })).optional(),
        title: z.string().optional(),
      }),
      'display_metric': z.object({
        value: z.union([z.string(), z.number()]),
        label: z.string(),
        trend: z.enum(['up', 'down', 'stable']).optional(),
        format: z.string().optional(),
      }),
      // Add more schemas as needed
    };

    return schemas[intentType] || null;
  }

  /**
   * Detect potentially malicious patterns in payload
   */
  private detectMaliciousPatterns(payload: unknown): string[] {
    const patterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\(/i,
      /Function\(/i,
    ];

    const malicious: string[] = [];
    const checkValue = (value: unknown): void => {
      if (typeof value === 'string') {
        patterns.forEach(pattern => {
          if (pattern.test(value)) {
            malicious.push(pattern.source);
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(checkValue);
      }
    };

    checkValue(payload);
    return [...new Set(malicious)]; // Remove duplicates
  }

  /**
   * Organization-specific validation rules
   */
  private async validateOrganizationRules(
    organizationId: string,
    intentType: string,
    payload: unknown
  ): Promise<{ errors: string[]; warnings: string[] }> {
    // In real implementation, this would check organization-specific rules from database
    const errors: string[] = [];
    const warnings: string[] = [];

    // Example: Check if organization has permission for certain components
    if (intentType === 'enterprise_feature' && organizationId !== 'premium-org') {
      errors.push('Enterprise features require premium subscription');
    }

    return { errors, warnings };
  }

  /**
   * Check if component is allowed for organization
   */
  private isComponentAllowed(componentName: string, organizationId: string): boolean {
    // In real implementation, this would check against a component allowlist
    const allowedComponents = [
      'SystemMapCanvas',
      'ValueTreeCard',
      'MetricBadge',
      'DataTable',
      'InfoBanner',
      // Add more as needed
    ];

    return allowedComponents.includes(componentName);
  }

  private isPropsRecord(props: unknown): props is Record<string, unknown> {
    return typeof props === 'object' && props !== null;
  }

  /**
   * Simulate component rendering for validation
   */
  private async simulateRender(
    componentName: string,
    props: unknown
  ): Promise<{ success: boolean; output?: string; errors: string[] }> {
    // In real implementation, this would use React's test renderer or a headless browser
    // For now, we'll do basic validation
    
    const errors: string[] = [];

    if (!this.isPropsRecord(props)) {
      errors.push('Component props must be an object');
      return {
        success: false,
        errors,
      };
    }

    const typedProps: Record<string, unknown> = props;
    
    // Check required props
    const requiredProps = this.getRequiredProps(componentName);
    requiredProps.forEach(prop => {
      if (!(prop in typedProps)) {
        errors.push(`Missing required prop: ${prop}`);
      }
    });

    // Basic type checking
    const title = typedProps.title;
    if (typeof title !== 'undefined' && typeof title !== 'string') {
      errors.push('Title must be a string');
    }

    return {
      success: errors.length === 0,
      output: errors.length === 0 ? `<${componentName}> rendered successfully` : undefined,
      errors,
    };
  }

  /**
   * Get required props for a component
   */
  private getRequiredProps(componentName: string): string[] {
    const requiredPropsMap: Record<string, string[]> = {
      'SystemMapCanvas': ['entities'],
      'ValueTreeCard': ['tree'],
      'MetricBadge': ['value', 'label'],
      'DataTable': ['data', 'columns'],
    };

    return requiredPropsMap[componentName] || [];
  }
}

export const sduiSandboxService = new SDUISandboxService();
