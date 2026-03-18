/**
 * Enhanced Input Validation Service
 * Provides comprehensive JSON schema validation and input sanitization
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { createLogger } from '../utils/logger.js';

const logger = createLogger({ component: 'InputValidation' });

export interface ValidationSchema {
  $schema?: string;
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  sanitizedData?: unknown;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  schema: ValidationSchema;
  sanitizers?: Array<(data: unknown) => unknown>;
  preValidators?: Array<(data: unknown) => boolean>;
  postValidators?: Array<(data: unknown) => ValidationResult>;
}

export class EnhancedInputValidator {
  private static instance: EnhancedInputValidator;
  private ajv: Ajv;
  private rules: Map<string, ValidationRule> = new Map();

  private constructor() {
    // Initialize AJV with comprehensive options
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      removeAdditional: false,
      useDefaults: true,
      coerceTypes: false,
      strict: true,
    });

    // Add common formats
    addFormats(this.ajv);

    // Add custom formats
    this.addCustomFormats();

    // Initialize default validation rules
    this.initializeDefaultRules();

    logger.info('Enhanced input validator initialized');
  }

  static getInstance(): EnhancedInputValidator {
    if (!EnhancedInputValidator.instance) {
      EnhancedInputValidator.instance = new EnhancedInputValidator();
    }
    return EnhancedInputValidator.instance;
  }

  /**
   * Add custom validation formats
   */
  private addCustomFormats(): void {
    // Safe string format (no script tags, etc.)
    this.ajv.addFormat('safe-string', (data: string) => {
      if (typeof data !== 'string') return false;

      const dangerousPatterns = [
        /<script[\s>]/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
      ];

      return !dangerousPatterns.some(pattern => pattern.test(data));
    });

    // Agent ID format
    this.ajv.addFormat('agent-id', (data: string) => {
      return typeof data === 'string' &&
             data.length >= 8 &&
             data.length <= 64 &&
             /^[a-zA-Z0-9_-]+$/.test(data);
    });

    // Tenant ID format
    this.ajv.addFormat('tenant-id', (data: string) => {
      return typeof data === 'string' &&
             data.length === 36 &&
             /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data);
    });

    // LLM prompt format (length and content restrictions)
    this.ajv.addFormat('llm-prompt', (data: string) => {
      if (typeof data !== 'string') return false;
      if (data.length > 50000) return false; // Max 50KB

      // Check for prompt injection patterns
      const injectionPatterns = [
        /^\s*system:/i,
        /^\s*ignore\s+(previous|all)/i,
        /jailbreak/i,
        /developer\s+mode/i,
      ];

      return !injectionPatterns.some(pattern => pattern.test(data));
    });
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // LLM Message validation
    this.addRule({
      id: 'llm-message',
      name: 'LLM Message Validation',
      description: 'Validates LLM message format and content',
      schema: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['system', 'user', 'assistant', 'tool']
          },
          content: {
            type: 'string',
            format: 'llm-prompt',
            maxLength: 50000
          },
          tool_call_id: {
            type: 'string',
            format: 'uuid'
          },
          tool_calls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                type: { type: 'string', enum: ['function'] },
                function: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' },
                    arguments: { type: 'string' } // JSON string
                  },
                  required: ['name', 'arguments']
                }
              },
              required: ['id', 'type', 'function']
            }
          }
        },
        required: ['role', 'content'],
        additionalProperties: false
      },
      sanitizers: [
        (data: unknown) => {
          if (typeof data !== 'object' || data === null || !('content' in data)) {
            return data;
          }
          const dataWithContent = data as { content: unknown };
          return {
            ...dataWithContent,
            content: this.sanitizeLLMContent(String(dataWithContent.content))
          };
        }
      ]
    });

    // Agent Configuration validation
    this.addRule({
      id: 'agent-config',
      name: 'Agent Configuration Validation',
      description: 'Validates agent configuration parameters',
      schema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            format: 'agent-id'
          },
          agentType: {
            type: 'string',
            enum: ['llm-agent', 'data-agent', 'workflow-agent', 'security-agent']
          },
          tenantId: {
            type: 'string',
            format: 'tenant-id'
          },
          config: {
            type: 'object',
            properties: {
              model: { type: 'string', minLength: 1, maxLength: 100 },
              temperature: { type: 'number', minimum: 0, maximum: 2 },
              maxTokens: { type: 'number', minimum: 1, maximum: 32000 },
              timeout: { type: 'number', minimum: 1000, maximum: 300000 }
            },
            additionalProperties: false
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['read', 'write', 'execute', 'network', 'filesystem']
            }
          }
        },
        required: ['agentId', 'agentType', 'tenantId'],
        additionalProperties: false
      }
    });

    // API Request validation
    this.addRule({
      id: 'api-request',
      name: 'API Request Validation',
      description: 'Validates API request structure and parameters',
      schema: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
          },
          url: {
            type: 'string',
            format: 'uri',
            pattern: '^https://' // Only HTTPS allowed
          },
          headers: {
            type: 'object',
            patternProperties: {
              '^[a-zA-Z][a-zA-Z0-9-]*$': {
                type: 'string',
                maxLength: 1000
              }
            },
            additionalProperties: false
          },
          body: {
            // Allow any JSON-serializable data
          },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 300000,
            default: 30000
          }
        },
        required: ['method', 'url'],
        additionalProperties: false
      }
    });

    // Workflow Definition validation
    this.addRule({
      id: 'workflow-definition',
      name: 'Workflow Definition Validation',
      description: 'Validates workflow definition structure',
      schema: {
        type: 'object',
        properties: {
          workflowId: {
            type: 'string',
            format: 'uuid'
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            format: 'safe-string'
          },
          description: {
            type: 'string',
            maxLength: 1000,
            format: 'safe-string'
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stepId: { type: 'string', format: 'uuid' },
                type: { type: 'string', minLength: 1, maxLength: 50 },
                config: { type: 'object' },
                dependsOn: {
                  type: 'array',
                  items: { type: 'string', format: 'uuid' }
                }
              },
              required: ['stepId', 'type']
            },
            minItems: 1,
            maxItems: 100
          },
          tenantId: {
            type: 'string',
            format: 'tenant-id'
          }
        },
        required: ['workflowId', 'name', 'steps', 'tenantId'],
        additionalProperties: false
      }
    });

    logger.info('Default validation rules initialized');
  }

  /**
   * Add a validation rule
   */
  addRule(rule: ValidationRule): void {
    // Compile the schema
    const validate = this.ajv.compile(rule.schema);
    const ruleWithValidate = rule as unknown as { validate: typeof validate };
    ruleWithValidate.validate = validate;

    this.rules.set(rule.id, rule);
    logger.info('Validation rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Validate data against a rule
   */
  validate(ruleId: string, data: unknown): ValidationResult {
    const rule = this.rules.get(ruleId);

    if (!rule) {
      return {
        isValid: false,
        errors: [`Validation rule '${ruleId}' not found`]
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Run pre-validators
    if (rule.preValidators) {
      for (const preValidator of rule.preValidators) {
        try {
          if (!preValidator(data)) {
            errors.push('Pre-validation failed');
            break;
          }
        } catch (error) {
          errors.push(`Pre-validation error: ${(error as Error).message}`);
        }
      }
    }

    // Run schema validation
    const ruleWithValidate = rule as unknown as {
      validate?: ((data: unknown) => boolean) & { errors?: Array<{ instancePath: string; message?: string }> | null }
    };
    const validate = ruleWithValidate.validate;
    if (!validate) {
      return {
        isValid: false,
        errors: [`Validation rule '${ruleId}' has no compiled validator`]
      };
    }
    const isValid = validate(data);

    if (!isValid && validate.errors) {
      for (const error of validate.errors) {
        errors.push(`${error.instancePath || 'root'}: ${error.message}`);
      }
    }

    // Apply sanitizers
    let sanitizedData = data;
    if (rule.sanitizers && errors.length === 0) {
      try {
        for (const sanitizer of rule.sanitizers) {
          sanitizedData = sanitizer(sanitizedData);
        }
      } catch (error) {
        warnings.push(`Sanitization warning: ${(error as Error).message}`);
      }
    }

    // Run post-validators
    if (rule.postValidators && errors.length === 0) {
      for (const postValidator of rule.postValidators) {
        try {
          const result = postValidator(sanitizedData);
          if (!result.isValid) {
            errors.push(...(result.errors || []));
            warnings.push(...(result.warnings || []));
          }
        } catch (error) {
          errors.push(`Post-validation error: ${(error as Error).message}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      sanitizedData
    };
  }

  /**
   * Sanitize LLM content
   */
  private sanitizeLLMContent(content: string): string {
    if (typeof content !== 'string') return '';

    // Remove potentially dangerous patterns
    return content
      .replace(/<script[\s\S]*?<\/script>/gi, '[SCRIPT REMOVED]')
      .replace(/javascript:/gi, '[JAVASCRIPT REMOVED]')
      .replace(/on\w+\s*=/gi, '[EVENT REMOVED]')
      .slice(0, 50000); // Limit length
  }

  /**
   * Get available validation rules
   */
  getAvailableRules(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * Get rule details
   */
  getRule(ruleId: string): ValidationRule | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Validate multiple rules
   */
  validateMultiple(rules: Array<{ ruleId: string; data: unknown }>): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let allValid = true;

    for (const { ruleId, data } of rules) {
      const result = this.validate(ruleId, data);

      if (!result.isValid) {
        allValid = false;
        if (result.errors) {
          allErrors.push(...result.errors.map(err => `[${ruleId}] ${err}`));
        }
      }

      if (result.warnings) {
        allWarnings.push(...result.warnings.map(warn => `[${ruleId}] ${warn}`));
      }
    }

    return {
      isValid: allValid,
      errors: allErrors.length > 0 ? allErrors : undefined,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  }

  /**
   * Add custom validation keyword
   */
  addKeyword(keyword: string, definition: Parameters<Ajv['addKeyword']>[1]): void {
    this.ajv.addKeyword(keyword, definition);
    logger.info('Custom validation keyword added', { keyword });
  }
}

// Export singleton instance
export const inputValidator = EnhancedInputValidator.getInstance();
