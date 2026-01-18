/**
 * Security Event Validation Service
 *
 * Provides schema validation for security events to prevent injection attacks
 * and ensure data integrity in the threat detection pipeline
 */

import { SecurityEvent } from './AdvancedThreatDetectionService';
import { log } from '../lib/logger';

export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: string[];
    properties?: ValidationSchema;
    items?: ValidationSchema;
    sanitize?: boolean;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: any;
}

export class SecurityEventValidator {
  private readonly SECURITY_EVENT_SCHEMA: ValidationSchema = {
    tenantId: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 255,
      pattern: /^[a-zA-Z0-9_-]+$/,
      sanitize: true
    },
    userId: {
      type: 'string',
      maxLength: 255,
      pattern: /^[a-zA-Z0-9_-]*$/,
      sanitize: true
    },
    eventType: {
      type: 'string',
      required: true,
      maxLength: 100,
      enum: [
        'auth.success',
        'auth.failed',
        'auth.denied',
        'auth.lockout',
        'api.rate_limit_exceeded',
        'api.abuse',
        'data.export',
        'data.access',
        'privilege.escalation',
        'system.error',
        'security.threat',
        'network.anomaly',
        'resource.abuse'
      ],
      sanitize: true
    },
    severity: {
      type: 'string',
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      sanitize: true
    },
    source: {
      type: 'string',
      required: true,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_.-]+$/,
      sanitize: true
    },
    details: {
      type: 'object',
      required: true,
      properties: {
        ip: {
          type: 'string',
          pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^unknown$/,
          sanitize: true
        },
        userAgent: {
          type: 'string',
          maxLength: 500,
          sanitize: true
        },
        endpoint: {
          type: 'string',
          maxLength: 255,
          pattern: /^[\/a-zA-Z0-9_-]*$/,
          sanitize: true
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
          sanitize: true
        },
        statusCode: {
          type: 'number',
          min: 100,
          max: 599
        },
        responseTime: {
          type: 'number',
          min: 0,
          max: 300000 // 5 minutes max
        },
        failureReason: {
          type: 'string',
          maxLength: 255,
          enum: ['invalid_credentials', 'account_locked', 'session_expired', 'insufficient_permissions', 'rate_limited', 'unknown'],
          sanitize: true
        },
        attemptCount: {
          type: 'number',
          min: 1,
          max: 1000
        },
        recordCount: {
          type: 'number',
          min: 1,
          max: 1000000
        },
        resourceType: {
          type: 'string',
          maxLength: 100,
          enum: ['admin', 'user', 'data', 'system', 'api', 'network'],
          sanitize: true
        },
        isGeographicAnomaly: {
          type: 'boolean'
        },
        location: {
          type: 'string',
          maxLength: 255,
          pattern: /^[a-zA-Z\s,-.]*$/,
          sanitize: true
        },
        timeWindow: {
          type: 'string',
          enum: ['minute', 'hour', 'day'],
          sanitize: true
        },
        requestCount: {
          type: 'number',
          min: 1,
          max: 100000
        }
      }
    },
    timestamp: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
    },
    riskScore: {
      type: 'number',
      min: 0,
      max: 100
    }
  };

  /**
   * Validate security event against schema
   */
  validateSecurityEvent(event: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizedData = { ...event };

    try {
      // Validate required fields first
      this.validateRequiredFields(event, this.SECURITY_EVENT_SCHEMA, errors);

      // Validate field types and constraints
      this.validateFieldTypes(event, this.SECURITY_EVENT_SCHEMA, '', errors, warnings);

      // Sanitize data if validation passes
      if (errors.length === 0) {
        sanitizedData = this.sanitizeData(event, this.SECURITY_EVENT_SCHEMA);
      }

      // Additional business logic validation
      this.validateBusinessLogic(sanitizedData, errors, warnings);

      const isValid = errors.length === 0;

      if (!isValid) {
        log.warn('Security event validation failed', {
          errors,
          warnings,
          eventType: event.eventType,
          tenantId: event.tenantId
        });
      }

      return {
        isValid,
        errors,
        warnings,
        sanitizedData: isValid ? sanitizedData : undefined
      };

    } catch (error) {
      log.error('Security event validation error', error as Error, {
        eventType: event.eventType,
        tenantId: event.tenantId
      });

      return {
        isValid: false,
        errors: ['Validation system error'],
        warnings: [],
        sanitizedData: undefined
      };
    }
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(
    data: any,
    schema: ValidationSchema,
    errors: string[],
    path: string = ''
  ): void {
    for (const [field, rules] of Object.entries(schema)) {
      const currentPath = path ? `${path}.${field}` : field;

      if (rules.required && (data[field] === undefined || data[field] === null)) {
        errors.push(`Required field '${currentPath}' is missing`);
        continue;
      }

      if (data[field] !== undefined && rules.type === 'object' && rules.properties) {
        this.validateRequiredFields(data[field], rules.properties, errors, currentPath);
      }
    }
  }

  /**
   * Validate field types and constraints
   */
  private validateFieldTypes(
    data: any,
    schema: ValidationSchema,
    path: string,
    errors: string[],
    warnings: string[]
  ): void {
    for (const [field, rules] of Object.entries(schema)) {
      const currentPath = path ? `${path}.${field}` : field;
      const value = data[field];

      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, rules.type)) {
        errors.push(`Field '${currentPath}' must be of type ${rules.type}`);
        continue;
      }

      // String validations
      if (rules.type === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`Field '${currentPath}' must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`Field '${currentPath}' must not exceed ${rules.maxLength} characters`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Field '${currentPath}' format is invalid`);
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`Field '${currentPath}' must be one of: ${rules.enum.join(', ')}`);
        }
      }

      // Number validations
      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`Field '${currentPath}' must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`Field '${currentPath}' must not exceed ${rules.max}`);
        }
      }

      // Object validations
      if (rules.type === 'object' && rules.properties) {
        if (typeof value === 'object' && value !== null) {
          this.validateFieldTypes(value, rules.properties, currentPath, errors, warnings);
        } else {
          errors.push(`Field '${currentPath}' must be an object`);
        }
      }

      // Array validations
      if (rules.type === 'array' && rules.items) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            this.validateFieldTypes(
              { item },
              { item: { ...rules.items!, type: rules.items!.type } },
              `${currentPath}[${index}]`,
              errors,
              warnings
            );
          });
        } else {
          errors.push(`Field '${currentPath}' must be an array`);
        }
      }

      // Security warnings
      this.checkSecurityIssues(value, currentPath, warnings);
    }
  }

  /**
   * Validate data type
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Check for security issues in data
   */
  private checkSecurityIssues(value: any, fieldPath: string, warnings: string[]): void {
    if (typeof value === 'string') {
      // Check for potential injection attempts
      if (/<script|javascript:|on\w+=/i.test(value)) {
        warnings.push(`Field '${fieldPath}' contains potentially dangerous content`);
      }

      // Check for path traversal attempts
      if (/\.\.[\/\\]/.test(value)) {
        warnings.push(`Field '${fieldPath}' contains potential path traversal`);
      }

      // Check for SQL injection patterns
      if (/('|(\\')|(;|\s)(drop|delete|insert|update|create|alter)\s)/i.test(value)) {
        warnings.push(`Field '${fieldPath}' contains potential SQL injection`);
      }

      // Check for command injection
      if (/(\||&|;|\$\(|`)/.test(value)) {
        warnings.push(`Field '${fieldPath}' contains potential command injection`);
      }
    }
  }

  /**
   * Sanitize data according to schema rules
   */
  private sanitizeData(data: any, schema: ValidationSchema): any {
    const sanitized: any = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      if (value === undefined || value === null) {
        continue;
      }

      if (rules.sanitize && typeof value === 'string') {
        sanitized[field] = this.sanitizeString(value);
      } else if (rules.type === 'object' && rules.properties) {
        sanitized[field] = this.sanitizeData(value, rules.properties);
      } else if (rules.type === 'array' && rules.items) {
        sanitized[field] = Array.isArray(value)
          ? value.map(item => this.sanitizeData({ item }, { item: { ...rules.items!, type: rules.items!.type } }).item)
          : value;
      } else {
        sanitized[field] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize string values
   */
  private sanitizeString(value: string): string {
    return value
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Escape special characters
      .replace(/[<>"'&]/g, (match) => {
        const escapes: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return escapes[match];
      })
      // Trim whitespace
      .trim();
  }

  /**
   * Additional business logic validation
   */
  private validateBusinessLogic(
    event: SecurityEvent,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate timestamp is not in the future
    const eventTime = new Date(event.timestamp);
    const now = new Date();

    if (eventTime > now) {
      errors.push('Event timestamp cannot be in the future');
    }

    // Validate timestamp is not too old (more than 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (eventTime < thirtyDaysAgo) {
      warnings.push('Event timestamp is more than 30 days old');
    }

    // Validate event type consistency with details
    if (event.eventType.startsWith('auth.') && !event.details.ip) {
      warnings.push('Authentication events should include IP address');
    }

    if (event.eventType === 'api.rate_limit_exceeded' && !event.details.requestCount) {
      errors.push('Rate limit events must include request count');
    }

    if (event.eventType === 'data.export' && !event.details.recordCount) {
      errors.push('Data export events must include record count');
    }

    // Validate severity consistency
    const expectedSeverity = this.inferSeverity(event);
    if (expectedSeverity && event.severity !== expectedSeverity) {
      warnings.push(`Severity '${event.severity}' may not match event type '${event.eventType}'`);
    }
  }

  /**
   * Infer expected severity from event type
   */
  private inferSeverity(event: SecurityEvent): string | null {
    const severityMap: Record<string, string> = {
      'auth.success': 'low',
      'auth.failed': 'medium',
      'auth.denied': 'high',
      'auth.lockout': 'high',
      'api.rate_limit_exceeded': 'medium',
      'api.abuse': 'high',
      'data.export': 'medium',
      'privilege.escalation': 'critical',
      'security.threat': 'high',
      'network.anomaly': 'medium'
    };

    return severityMap[event.eventType] || null;
  }

  /**
   * Validate batch of security events
   */
  validateBatch(events: any[]): ValidationResult[] {
    return events.map(event => this.validateSecurityEvent(event));
  }

  /**
   * Get validation statistics
   */
  getValidationStats(results: ValidationResult[]): {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
    commonErrors: Record<string, number>;
  } {
    const total = results.length;
    const valid = results.filter(r => r.isValid).length;
    const invalid = total - valid;
    const warnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

    const commonErrors = results
      .filter(r => !r.isValid)
      .flatMap(r => r.errors)
      .reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      total,
      valid,
      invalid,
      warnings,
      commonErrors
    };
  }
}
