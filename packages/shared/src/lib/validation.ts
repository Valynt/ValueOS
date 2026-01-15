/**
 * Validation Utilities
 *
 * Composable validation helpers built on Zod schemas.
 * Returns Result types for consistent error handling.
 *
 * @example
 * const result = validate(UserSchema, data);
 * if (result.ok) {
 *   console.log(result.value.email);
 * } else {
 *   console.error(result.error.issues);
 * }
 */

import { z, type ZodSchema, type ZodError } from 'zod';
import { Result, type AsyncResult } from '../types/result.js';

/**
 * Validation error with structured details
 */
export interface ValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

/**
 * Convert ZodError to ValidationError
 */
function toValidationError(error: ZodError): ValidationError {
  return {
    code: 'VALIDATION_ERROR',
    message: `Validation failed: ${error.issues.length} issue(s)`,
    issues: error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
      code: issue.code,
    })),
  };
}

/**
 * Validate data against a Zod schema
 * Returns Result<T, ValidationError>
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): Result<T, ValidationError> {
  const result = schema.safeParse(data);
  if (result.success) {
    return Result.ok(result.data);
  }
  return Result.err(toValidationError(result.error));
}

/**
 * Validate data asynchronously (for schemas with async refinements)
 */
export async function validateAsync<T>(
  schema: ZodSchema<T>,
  data: unknown
): AsyncResult<T, ValidationError> {
  const result = await schema.safeParseAsync(data);
  if (result.success) {
    return Result.ok(result.data);
  }
  return Result.err(toValidationError(result.error));
}

/**
 * Validate and return data or null (no error details)
 */
export function safeValidate<T>(schema: ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate and throw on failure (for cases where you want exceptions)
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Create a validator function from a schema
 */
export function createValidator<T>(schema: ZodSchema<T>) {
  return {
    validate: (data: unknown) => validate(schema, data),
    validateAsync: (data: unknown) => validateAsync(schema, data),
    safeValidate: (data: unknown) => safeValidate(schema, data),
    validateOrThrow: (data: unknown) => validateOrThrow(schema, data),
    isValid: (data: unknown): data is T => schema.safeParse(data).success,
  };
}

/**
 * Compose multiple validations
 */
export function validateAll<T extends Record<string, unknown>>(
  validations: { [K in keyof T]: Result<T[K], ValidationError> }
): Result<T, ValidationError> {
  const errors: ValidationIssue[] = [];
  const values: Partial<T> = {};

  for (const [key, result] of Object.entries(validations)) {
    if (result.ok) {
      values[key as keyof T] = result.value as T[keyof T];
    } else {
      errors.push(
        ...result.error.issues.map((issue: ValidationIssue) => ({
          ...issue,
          path: [key, ...issue.path],
        }))
      );
    }
  }

  if (errors.length > 0) {
    return Result.err({
      code: 'VALIDATION_ERROR',
      message: `Validation failed: ${errors.length} issue(s)`,
      issues: errors,
    });
  }

  return Result.ok(values as T);
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  /**
   * UUID v4 format
   */
  uuid: z.string().uuid(),

  /**
   * Prefixed ID format (e.g., "usr_abc123")
   */
  prefixedId: (prefix: string) =>
    z.string().regex(new RegExp(`^${prefix}_[a-zA-Z0-9_-]+$`), {
      message: `Invalid ${prefix} ID format`,
    }),

  /**
   * Email address
   */
  email: z.string().email(),

  /**
   * Non-empty string
   */
  nonEmpty: z.string().min(1, 'Cannot be empty'),

  /**
   * Positive integer
   */
  positiveInt: z.number().int().positive(),

  /**
   * ISO date string
   */
  isoDate: z.string().datetime(),

  /**
   * URL
   */
  url: z.string().url(),

  /**
   * Pagination params
   */
  pagination: z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
  }),
};

/**
 * Type-safe schema inference helper
 */
export type Infer<T extends ZodSchema> = z.infer<T>;
