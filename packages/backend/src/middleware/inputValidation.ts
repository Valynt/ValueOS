/**
 * Enhanced Input Validation Middleware
 * Provides comprehensive input sanitization and validation for API endpoints
 */

import { NextFunction, Request, Response } from 'express';
import { createLogger } from '@shared/lib/logger';
import { sanitizeForLogging } from '@shared/lib/piiFilter';

const logger = createLogger({ component: 'InputValidation' });

// Input validation patterns
const PATTERNS = {
  // SQL injection patterns
  sqlInjection: /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b|\band\b|\bor\b.*=.*|\bxor\b|\/\*|\*\/|--|#|;)/gi,

  // XSS patterns
  xss: /<script[^>]*>[\s\S]*?<\/script>|javascript:|vbscript:|on\w+\s*=|style\s*=.*expression\s*\(|style\s*=.*javascript\s*:/gi,

  // Path traversal
  pathTraversal: /\.\.[/\\]/g,

  // Command injection
  commandInjection: /[;&|`$()]/g,

  // Prompt injection patterns for LLM
  promptInjection: /<system>|<\/system>|\b(ignore|forget|override)\s+(previous|all|these)\s+(instructions?|prompts?|rules?)\b/gi,

  // Email validation
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // URL validation (basic)
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,

  // UUID validation
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

/**
 * Input sanitization levels
 */
export enum SanitizationLevel {
  BASIC = 'basic',      // Basic XSS and script removal
  STRICT = 'strict',    // Remove all HTML and special chars
  LLM = 'llm',         // LLM prompt sanitization
  NONE = 'none'        // No sanitization (use with caution)
}

/**
 * Validation rules interface
 */
export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  customValidator?: (value: any) => boolean | string;
}

/**
 * Validation schema interface
 */
export interface ValidationSchema {
  [key: string]: ValidationRule;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedData?: any;
}

/**
 * Comprehensive input sanitization function
 */
export function sanitizeInput(input: string, level: SanitizationLevel = SanitizationLevel.BASIC): string {
  if (typeof input !== 'string') return '';

  let sanitized = input.trim();

  switch (level) {
    case SanitizationLevel.STRICT:
      // Remove all HTML tags and encode special characters
      sanitized = sanitized
        .replace(/<[^>]*>/g, '')
        .replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;'
        }[char] || char));
      break;

    case SanitizationLevel.LLM:
      // LLM-specific sanitization for prompt injection prevention
      sanitized = sanitized
        .replace(PATTERNS.promptInjection, '[FILTERED]')
        .replace(/<system[^>]*>/gi, '[SYSTEM_TAG]')
        .replace(/<\/system>/gi, '[/SYSTEM_TAG]')
        .replace(/ignore\s+previous/gi, '[FILTERED]')
        .substring(0, 2000); // Hard limit for LLM inputs
      break;

    case SanitizationLevel.BASIC:
    default:
      // Basic XSS prevention
      sanitized = sanitized
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/style\s*=.*expression\s*\(/gi, '')
        .replace(/style\s*=.*javascript\s*:/gi, '');
      break;
  }

  return sanitized.substring(0, 10000); // General length limit
}

/**
 * Security scan for malicious patterns
 */
export function securityScan(input: string): { safe: boolean; threats: string[] } {
  const threats: string[] = [];

  if (PATTERNS.sqlInjection.test(input)) {
    threats.push('Potential SQL injection detected');
  }

  if (PATTERNS.xss.test(input)) {
    threats.push('Potential XSS attack detected');
  }

  if (PATTERNS.pathTraversal.test(input)) {
    threats.push('Potential path traversal detected');
  }

  if (PATTERNS.commandInjection.test(input)) {
    threats.push('Potential command injection detected');
  }

  if (PATTERNS.promptInjection.test(input)) {
    threats.push('Potential prompt injection detected');
  }

  return {
    safe: threats.length === 0,
    threats
  };
}

/**
 * Validate single value against rule
 */
function validateValue(value: any, rule: ValidationRule, fieldName: string): string[] {
  const errors: string[] = [];

  // Required check
  if (rule.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  // Skip further validation if not required and empty
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return errors;
  }

  // Type validation
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${fieldName} must be a string`);
      } else {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${fieldName} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${fieldName} must be at most ${rule.maxLength} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${fieldName} format is invalid`);
        }
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`${fieldName} must be a number`);
      } else {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${fieldName} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${fieldName} must be at most ${rule.max}`);
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`${fieldName} must be a boolean`);
      }
      break;

    case 'email':
      if (typeof value !== 'string' || !PATTERNS.email.test(value)) {
        errors.push(`${fieldName} must be a valid email address`);
      }
      break;

    case 'url':
      if (typeof value !== 'string' || !PATTERNS.url.test(value)) {
        errors.push(`${fieldName} must be a valid URL`);
      }
      break;

    case 'uuid':
      if (typeof value !== 'string' || !PATTERNS.uuid.test(value)) {
        errors.push(`${fieldName} must be a valid UUID`);
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${fieldName} must be an array`);
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`${fieldName} must be an object`);
      }
      break;
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`${fieldName} must be one of: ${rule.enum.join(', ')}`);
  }

  // Custom validation
  if (rule.customValidator) {
    const result = rule.customValidator(value);
    if (result !== true) {
      errors.push(typeof result === 'string' ? result : `${fieldName} validation failed`);
    }
  }

  return errors;
}

/**
 * Validate data against schema
 */
export function validateData(
  data: any,
  schema: ValidationSchema,
  sanitize: boolean = true,
  options: { allowUnknown?: boolean } = {}
): ValidationResult {
  const errors: string[] = [];
  const sanitizedData: any = {};
  const payload = typeof data === 'object' && data !== null ? data : {};
  const allowUnknown = options.allowUnknown ?? false;

  if (!allowUnknown) {
    const unknownFields = Object.keys(payload).filter(
      (field) => !(field in schema)
    );
    if (unknownFields.length > 0) {
      errors.push(
        ...unknownFields.map((field) => `Unknown field: ${field}`)
      );
    }
  }

  for (const [field, rule] of Object.entries(schema)) {
    const value = payload[field];
    const fieldErrors = validateValue(value, rule, field);

    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors);
    } else if (sanitize && typeof value === 'string') {
      // Auto-sanitize strings
      const level =
        field.includes('prompt') || field.includes('message')
          ? SanitizationLevel.LLM
          : SanitizationLevel.BASIC;
      sanitizedData[field] = sanitizeInput(value, level);
    } else {
      sanitizedData[field] = value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedData,
  };
}

/**
 * Express middleware for input validation
 */
export function validateRequest(
  schema: ValidationSchema,
  source: 'body' | 'query' | 'params' = 'body',
  options: { allowUnknown?: boolean } = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const result = validateData(data, schema, true, options);

      if (!result.valid) {
        logger.warn('Input validation failed', {
          errors: result.errors,
          path: sanitizeForLogging(req.path),
          method: req.method,
          ip: sanitizeForLogging(req.ip),
          requestId: (req as any).requestId ?? res.locals.requestId
        });

        res.status(400).json({
          error: 'Validation failed',
          details: result.errors
        });
        return;
      }

      // Store sanitized data
      if (result.sanitizedData) {
        req[source] = { ...req[source], ...result.sanitizedData };
      }

      // Security scan
      const securityCheck = securityScan(JSON.stringify(data));
      if (!securityCheck.safe) {
        logger.warn('Security threat detected', {
          threats: securityCheck.threats,
          path: sanitizeForLogging(req.path),
          method: req.method,
          ip: sanitizeForLogging(req.ip)
        });

        res.status(403).json({
          error: 'Request blocked for security reasons'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Input validation middleware error', sanitizeForLogging(error));
      res.status(500).json({ error: 'Validation service error' });
    }
  };
}

/**
 * Predefined validation schemas
 */
export const ValidationSchemas = {
  // User authentication
  login: {
    email: { type: 'email' as const, required: true },
    password: { type: 'string' as const, required: true, minLength: 1 }
  },

  signup: {
    email: { type: 'email' as const, required: true },
    password: { type: 'string' as const, required: true, minLength: 8 },
    fullName: { type: 'string' as const, required: true, minLength: 2, maxLength: 100 }
  },

  adminInviteUser: {
    email: { type: 'email' as const, required: true },
    role: {
      type: 'string' as const,
      required: true,
      enum: ['owner', 'admin', 'member', 'viewer'],
    },
  },

  adminChangeRole: {
    role: {
      type: 'string' as const,
      required: true,
      enum: ['owner', 'admin', 'member', 'viewer'],
    },
  },

  // Agent/LLM interactions
  agentPrompt: {
    prompt: { type: 'string' as const, required: true, maxLength: 2000 },
    context: { type: 'string' as const, maxLength: 1000 },
    tenantId: { type: 'uuid' as const, required: true }
  },

  // API keys and tokens
  apiKey: {
    name: { type: 'string' as const, required: true, minLength: 3, maxLength: 50 },
    description: { type: 'string' as const, maxLength: 200 },
    scopes: { type: 'array' as const, required: true }
  },

  // General user input
  userMessage: {
    content: { type: 'string' as const, required: true, maxLength: 5000 },
    type: { type: 'string' as const, enum: ['text', 'markdown', 'html'] }
  }
};
