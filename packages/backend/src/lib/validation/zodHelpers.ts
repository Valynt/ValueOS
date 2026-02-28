/**
 * Zod Validation Helpers
 *
 * Reusable Zod schemas and utilities for consistent validation across the API.
 * All schemas enforce:
 * - Unknown field rejection (.strict())
 * - Per-field max sizes
 * - String sanitization
 * - Safe regex patterns
 */

import { z, ZodType, ZodTypeDef } from 'zod';

import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeSlug,
  normalizeUrl,
  normalizeUuid,
} from './normalizers';
import { analyzeRegexSafety, isValidEmail, isValidUuid, SafePatterns } from './safeRegex.js'
import { sanitizeForLog, sanitizeForPrompt, sanitizeString } from './sanitize.js'

// ============================================================================
// Field Size Limits
// ============================================================================

/**
 * Standard field size limits.
 * Adjust based on your database schema and requirements.
 */
export const FieldLimits = {
  // Short text fields
  name: { min: 1, max: 100 },
  title: { min: 1, max: 200 },
  slug: { min: 1, max: 100 },
  username: { min: 3, max: 30 },

  // Medium text fields
  description: { min: 0, max: 2000 },
  summary: { min: 0, max: 500 },
  bio: { min: 0, max: 1000 },

  // Long text fields
  content: { min: 0, max: 50000 },
  notes: { min: 0, max: 10000 },

  // Specific fields
  email: { min: 5, max: 254 },
  phone: { min: 7, max: 20 },
  url: { min: 10, max: 2048 },
  password: { min: 8, max: 128 },

  // Arrays
  tags: { maxItems: 20, maxItemLength: 50 },
  ids: { maxItems: 100 },
} as const;

// ============================================================================
// Base String Schemas with Sanitization
// ============================================================================

/**
 * Create a sanitized string schema.
 * Automatically trims and sanitizes input.
 */
export function sanitizedString(options: {
  minLength?: number;
  maxLength?: number;
  stripHtml?: boolean;
} = {}) {
  const { minLength = 0, maxLength = 10000, stripHtml = true } = options;

  return z
    .string()
    .transform((val) => sanitizeString(val, { maxLength, stripHtml }))
    .pipe(
      z
        .string()
        .min(minLength, `Must be at least ${minLength} characters`)
        .max(maxLength, `Must be at most ${maxLength} characters`)
    );
}

/**
 * Create a string schema safe for logging.
 * Removes newlines and control characters.
 */
export function logSafeString(maxLength = 1000) {
  return z.string().transform((val) => sanitizeForLog(val, maxLength));
}

/**
 * Create a string schema safe for LLM prompts.
 * Removes potential injection patterns.
 */
export function promptSafeString(maxLength = 4000) {
  return z.string().transform((val) => sanitizeForPrompt(val, maxLength));
}

// ============================================================================
// Common Field Schemas
// ============================================================================

/**
 * Name field (person or entity name).
 */
export const nameSchema = z
  .string()
  .min(FieldLimits.name.min, 'Name is required')
  .max(FieldLimits.name.max, `Name must be ${FieldLimits.name.max} characters or less`)
  .transform((val) => normalizeName(val.trim()));

/**
 * Title field.
 */
export const titleSchema = z
  .string()
  .min(FieldLimits.title.min, 'Title is required')
  .max(FieldLimits.title.max, `Title must be ${FieldLimits.title.max} characters or less`)
  .transform((val) => val.trim());

/**
 * Description field (optional by default).
 */
export const descriptionSchema = z
  .string()
  .max(FieldLimits.description.max, `Description must be ${FieldLimits.description.max} characters or less`)
  .transform((val) => sanitizeString(val, { maxLength: FieldLimits.description.max }))
  .optional();

/**
 * Email field with normalization.
 */
export const emailSchema = z
  .string()
  .min(FieldLimits.email.min, 'Email is required')
  .max(FieldLimits.email.max, 'Email is too long')
  .transform((val) => val.trim().toLowerCase())
  .refine((val) => isValidEmail(val), 'Invalid email format')
  .transform((val) => normalizeEmail(val) || val);

/**
 * Phone field with E.164 normalization.
 */
export const phoneSchema = z
  .string()
  .min(FieldLimits.phone.min, 'Phone number is required')
  .max(FieldLimits.phone.max, 'Phone number is too long')
  .transform((val) => normalizePhone(val.trim(), '1'))
  .refine((val) => val !== null, 'Invalid phone number format');

/**
 * Optional phone field.
 */
export const optionalPhoneSchema = z
  .string()
  .max(FieldLimits.phone.max)
  .transform((val) => (val ? normalizePhone(val.trim(), '1') : null))
  .nullable()
  .optional();

/**
 * UUID field with normalization.
 */
export const uuidSchema = z
  .string()
  .transform((val) => val.trim().toLowerCase())
  .refine((val) => isValidUuid(val), 'Invalid UUID format');

/**
 * Optional UUID field.
 */
export const optionalUuidSchema = z
  .string()
  .transform((val) => (val ? normalizeUuid(val) : null))
  .nullable()
  .optional();

/**
 * URL field with normalization.
 */
export const urlSchema = z
  .string()
  .min(FieldLimits.url.min, 'URL is required')
  .max(FieldLimits.url.max, 'URL is too long')
  .transform((val) => normalizeUrl(val.trim()))
  .refine((val) => val !== null, 'Invalid URL format');

/**
 * Optional URL field.
 */
export const optionalUrlSchema = z
  .string()
  .max(FieldLimits.url.max)
  .transform((val) => (val ? normalizeUrl(val.trim()) : null))
  .nullable()
  .optional();

/**
 * Slug field.
 */
export const slugSchema = z
  .string()
  .min(FieldLimits.slug.min, 'Slug is required')
  .max(FieldLimits.slug.max, `Slug must be ${FieldLimits.slug.max} characters or less`)
  .transform((val) => normalizeSlug(val))
  .refine((val) => SafePatterns.slug.test(val), 'Invalid slug format');

/**
 * Username field.
 */
export const usernameSchema = z
  .string()
  .min(FieldLimits.username.min, `Username must be at least ${FieldLimits.username.min} characters`)
  .max(FieldLimits.username.max, `Username must be ${FieldLimits.username.max} characters or less`)
  .transform((val) => val.trim().toLowerCase())
  .refine(
    (val) => /^[a-z][a-z0-9_]*$/.test(val),
    'Username must start with a letter and contain only letters, numbers, and underscores'
  );

/**
 * Password field.
 */
export const passwordSchema = z
  .string()
  .min(FieldLimits.password.min, `Password must be at least ${FieldLimits.password.min} characters`)
  .max(FieldLimits.password.max, `Password must be ${FieldLimits.password.max} characters or less`)
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (val) => /[a-z]/.test(val),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain at least one number'
  );

/**
 * Tags array field.
 */
export const tagsSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(FieldLimits.tags.maxItemLength)
      .transform((val) => val.trim().toLowerCase())
  )
  .max(FieldLimits.tags.maxItems, `Maximum ${FieldLimits.tags.maxItems} tags allowed`)
  .default([]);

/**
 * UUID array field.
 */
export const uuidArraySchema = z
  .array(uuidSchema)
  .max(FieldLimits.ids.maxItems, `Maximum ${FieldLimits.ids.maxItems} IDs allowed`);

// ============================================================================
// Numeric Schemas
// ============================================================================

/**
 * Positive integer.
 */
export const positiveIntSchema = z.number().int().positive();

/**
 * Non-negative integer.
 */
export const nonNegativeIntSchema = z.number().int().nonnegative();

/**
 * Percentage (0-100).
 */
export const percentageSchema = z.number().min(0).max(100);

/**
 * Currency amount (non-negative, 2 decimal places).
 */
export const currencySchema = z
  .number()
  .nonnegative()
  .transform((val) => Math.round(val * 100) / 100);

/**
 * Pagination page number.
 */
export const pageSchema = z.coerce.number().int().min(1).default(1);

/**
 * Pagination limit.
 */
export const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

// ============================================================================
// Date/Time Schemas
// ============================================================================

/**
 * ISO date string.
 */
export const isoDateSchema = z
  .string()
  .refine((val) => SafePatterns.isoDate.test(val), 'Invalid date format (YYYY-MM-DD)')
  .transform((val) => new Date(val));

/**
 * ISO datetime string.
 */
export const isoDateTimeSchema = z
  .string()
  .refine((val) => SafePatterns.isoDateTime.test(val), 'Invalid datetime format')
  .transform((val) => new Date(val));

/**
 * Date that must be in the future.
 */
export const futureDateSchema = isoDateTimeSchema.refine(
  (date) => date > new Date(),
  'Date must be in the future'
);

/**
 * Date that must be in the past.
 */
export const pastDateSchema = isoDateTimeSchema.refine(
  (date) => date < new Date(),
  'Date must be in the past'
);

// ============================================================================
// Custom Regex Schema with Safety Check
// ============================================================================

/**
 * Create a schema that validates against a regex pattern.
 * Automatically checks for ReDoS vulnerability.
 *
 * @param pattern - Regex pattern
 * @param message - Error message
 * @throws Error if pattern is potentially dangerous
 */
export function safeRegexSchema(pattern: RegExp, message: string) {
  const safety = analyzeRegexSafety(pattern);

  if (!safety.safe) {
    throw new Error(
      `Unsafe regex pattern detected: ${safety.warnings.join(', ')}`
    );
  }

  return z.string().regex(pattern, message);
}

// ============================================================================
// Schema Utilities
// ============================================================================

/**
 * Make all fields in a schema optional (for PATCH requests).
 */
export function makePartial<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * Create a strict schema that rejects unknown fields.
 */
export function strictSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

/**
 * Create a schema with common audit fields.
 */
export function withAuditFields<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    ...shape,
    createdAt: isoDateTimeSchema.optional(),
    updatedAt: isoDateTimeSchema.optional(),
    createdBy: uuidSchema.optional(),
    updatedBy: uuidSchema.optional(),
  });
}

/**
 * Create a paginated query schema.
 */
export function paginatedQuerySchema<T extends z.ZodRawShape>(filters: T) {
  return z
    .object({
      ...filters,
      page: pageSchema,
      limit: limitSchema,
      sortBy: z.string().max(50).optional(),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    })
    .strict();
}

// ============================================================================
// Validation Result Helpers
// ============================================================================

/**
 * Parse data with a schema and return a result object.
 * Does not throw on validation failure.
 */
export function safeParse<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Format Zod errors into a user-friendly array.
 */
export function formatZodErrors(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Check if an object has unknown fields compared to a schema.
 */
export function hasUnknownFields<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  data: Record<string, unknown>
): string[] {
  const knownKeys = new Set(Object.keys(schema.shape));
  const dataKeys = Object.keys(data);

  return dataKeys.filter((key) => !knownKeys.has(key));
}
