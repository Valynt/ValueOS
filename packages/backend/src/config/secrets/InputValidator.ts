/**
 * Input Validation and Sanitization Utilities
 *
 * Comprehensive validation and sanitization for secret management inputs
 * Prevents injection attacks, ensures data integrity, and provides consistent error handling
 */

import { logger } from "../../lib/logger.js"

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

/**
 * Input validation rules
 */
export const ValidationRules = {
  // Tenant ID validation
  tenantId: {
    pattern: /^[a-zA-Z0-9_-]{1,64}$/,
    maxLength: 64,
    minLength: 1,
    description:
      "Tenant ID must be 1-64 characters, alphanumeric with underscores and hyphens",
  },

  // Secret key validation
  secretKey: {
    pattern: /^[a-zA-Z0-9_.-]{1,255}$/,
    maxLength: 255,
    minLength: 1,
    description:
      "Secret key must be 1-255 characters, alphanumeric with underscores, dots, and hyphens",
  },

  // User ID validation
  userId: {
    pattern: /^[a-zA-Z0-9_-]{1,128}$/,
    maxLength: 128,
    minLength: 1,
    description:
      "User ID must be 1-128 characters, alphanumeric with underscores and hyphens",
  },

  // Version validation
  version: {
    pattern: /^[a-zA-Z0-9_.-]{1,64}$/,
    maxLength: 64,
    minLength: 1,
    description:
      "Version must be 1-64 characters, alphanumeric with underscores, dots, and hyphens",
  },

  // Environment name validation
  environment: {
    pattern: /^(development|staging|production|test)$/,
    description:
      "Environment must be one of: development, staging, production, test",
  },

  // URL validation
  url: {
    pattern: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
    maxLength: 2048,
    description: "Must be a valid HTTP/HTTPS URL",
  },

  // AWS region validation
  awsRegion: {
    pattern: /^[a-z]{2}-[a-z]+-\d{1,2}$/,
    description:
      "Must be a valid AWS region format (e.g., us-east-1, eu-west-2)",
  },

  // Port validation
  port: {
    min: 1,
    max: 65535,
    description: "Port must be between 1 and 65535",
  },

  // Timeout validation (milliseconds)
  timeout: {
    min: 100,
    max: 300000, // 5 minutes
    description: "Timeout must be between 100ms and 5 minutes",
  },

  // Retry count validation
  retryCount: {
    min: 0,
    max: 10,
    description: "Retry count must be between 0 and 10",
  },
};

/**
 * Sanitization functions
 */
export const Sanitizers = {
  /**
   * Trim whitespace and normalize
   */
  trim: (value: string): string => {
    return value.trim();
  },

  /**
   * Remove potentially dangerous characters
   */
  safeString: (value: string): string => {
    return value.replace(/[<>'"&]/g, "");
  },

  /**
   * Normalize path separators
   */
  normalizePath: (path: string): string => {
    return path.replace(/\\/g, "/").replace(/\/+/g, "/");
  },

  /**
   * Lowercase and trim
   */
  normalizeCase: (value: string): string => {
    return value.toLowerCase().trim();
  },
};

/**
 * Input validation utilities
 */
export class InputValidator {
  /**
   * Validate tenant ID
   */
  static validateTenantId(value: any): ValidationResult {
    return this.validateString(value, ValidationRules.tenantId, "tenantId");
  }

  /**
   * Validate secret key
   */
  static validateSecretKey(value: any): ValidationResult {
    return this.validateString(value, ValidationRules.secretKey, "secretKey");
  }

  /**
   * Validate user ID
   */
  static validateUserId(value: any): ValidationResult {
    return this.validateString(value, ValidationRules.userId, "userId");
  }

  /**
   * Validate version
   */
  static validateVersion(value: any): ValidationResult {
    return this.validateString(value, ValidationRules.version, "version");
  }

  /**
   * Validate environment
   */
  static validateEnvironment(value: any): ValidationResult {
    return this.validateString(
      value,
      ValidationRules.environment,
      "environment"
    );
  }

  /**
   * Validate URL
   */
  static validateUrl(value: any): ValidationResult {
    return this.validateString(value, ValidationRules.url, "url");
  }

  /**
   * Validate AWS region
   */
  static validateAwsRegion(value: any): ValidationResult {
    return this.validateString(value, ValidationRules.awsRegion, "awsRegion");
  }

  /**
   * Validate port number
   */
  static validatePort(value: any): ValidationResult {
    return this.validateNumber(value, ValidationRules.port, "port");
  }

  /**
   * Validate timeout
   */
  static validateTimeout(value: any): ValidationResult {
    return this.validateNumber(value, ValidationRules.timeout, "timeout");
  }

  /**
   * Validate retry count
   */
  static validateRetryCount(value: any): ValidationResult {
    return this.validateNumber(value, ValidationRules.retryCount, "retryCount");
  }

  /**
   * Generic string validation
   */
  private static validateString(
    value: any,
    rules: {
      pattern?: RegExp;
      maxLength?: number;
      minLength?: number;
      description: string;
    },
    fieldName: string
  ): ValidationResult {
    const errors: string[] = [];

    if (value === null || value === undefined) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    if (typeof value !== "string") {
      errors.push(`${fieldName} must be a string`);
      return { isValid: false, errors };
    }

    const trimmed = value.trim();

    if (rules.minLength && trimmed.length < rules.minLength) {
      errors.push(
        `${fieldName} must be at least ${rules.minLength} characters`
      );
    }

    if (rules.maxLength && trimmed.length > rules.maxLength) {
      errors.push(`${fieldName} must be at most ${rules.maxLength} characters`);
    }

    if (rules.pattern && !rules.pattern.test(trimmed)) {
      errors.push(rules.description);
    }

    const sanitizedValue = Sanitizers.safeString(trimmed);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue,
    };
  }

  /**
   * Generic number validation
   */
  private static validateNumber(
    value: any,
    rules: { min?: number; max?: number; description: string },
    fieldName: string
  ): ValidationResult {
    const errors: string[] = [];

    if (value === null || value === undefined) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    const num = typeof value === "string" ? parseInt(value, 10) : value;

    if (isNaN(num) || !Number.isInteger(num)) {
      errors.push(`${fieldName} must be an integer`);
      return { isValid: false, errors };
    }

    if (rules.min !== undefined && num < rules.min) {
      errors.push(`${fieldName} must be at least ${rules.min}`);
    }

    if (rules.max !== undefined && num > rules.max) {
      errors.push(`${fieldName} must be at most ${rules.max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: num,
    };
  }

  /**
   * Validate secret value (basic checks)
   */
  static validateSecretValue(value: any): ValidationResult {
    const errors: string[] = [];

    if (value === null || value === undefined) {
      errors.push("Secret value cannot be null or undefined");
      return { isValid: false, errors };
    }

    // Secret values can be objects (key-value pairs) or strings
    if (typeof value !== "object" && typeof value !== "string") {
      errors.push("Secret value must be an object or string");
      return { isValid: false, errors };
    }

    // Check for potentially dangerous content in string values
    if (typeof value === "string") {
      if (value.length > 65536) {
        // 64KB limit
        errors.push("Secret value too large (max 64KB)");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: value,
    };
  }

  /**
   * Validate and sanitize input, throw on failure
   */
  static validateOrThrow<T>(
    value: any,
    validator: (val: any) => ValidationResult,
    fieldName: string
  ): T {
    const result = validator(value);

    if (!result.isValid) {
      const error = new ValidationError(
        `Validation failed for ${fieldName}: ${result.errors.join(", ")}`,
        fieldName
      );
      logger.warn("Input validation failed", {
        field: fieldName,
        value:
          typeof value === "string" ? value.substring(0, 100) : typeof value,
        errors: result.errors,
      });
      throw error;
    }

    return result.sanitizedValue;
  }
}

/**
 * Environment variable validation utilities
 */
export class EnvValidator {
  /**
   * Validate and get environment variable with validation
   */
  static getValidatedString(
    key: string,
    validator: (val: any) => ValidationResult,
    defaultValue?: string
  ): string {
    const value = process.env[key] || defaultValue;

    if (value === undefined) {
      throw new ValidationError(`Environment variable ${key} is required`);
    }

    const result = InputValidator.validateOrThrow(value, validator, key);
    return result;
  }

  /**
   * Validate and get environment variable as number
   */
  static getValidatedNumber(
    key: string,
    validator: (val: any) => ValidationResult,
    defaultValue?: number
  ): number {
    const value = process.env[key];
    const numValue = value ? parseInt(value, 10) : defaultValue;

    if (numValue === undefined) {
      throw new ValidationError(`Environment variable ${key} is required`);
    }

    const result = InputValidator.validateOrThrow(numValue, validator, key);
    return result;
  }

  /**
   * Safely get environment variable with optional validation
   */
  static getOptionalValidated(
    key: string,
    validator?: (val: any) => ValidationResult,
    defaultValue?: any
  ): any {
    const value = process.env[key] || defaultValue;

    if (value === undefined) {
      return undefined;
    }

    if (validator) {
      try {
        return InputValidator.validateOrThrow(value, validator, key);
      } catch (error) {
        logger.warn(`Invalid environment variable ${key}, using default`, {
          value: value.substring ? value.substring(0, 50) : typeof value,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return defaultValue;
      }
    }

    return value;
  }
}
