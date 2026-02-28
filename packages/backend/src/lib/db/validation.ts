/**
 * Zod helpers for database boundary validation and sanitization.
 */

import { z } from 'zod';

import { DbValidationError } from './errors.js'

export interface SanitizedStringOptions {
  min?: number;
  max?: number;
  lowercase?: boolean;
  normalizeWhitespace?: boolean;
  trim?: boolean;
  label?: string;
}

export type EnumMapping<T extends string, U extends string> = Record<T, U>;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function sanitizedString(options: SanitizedStringOptions = {}): z.ZodType<string> {
  const {
    min,
    max,
    lowercase = false,
    normalizeWhitespace: normalize = false,
    trim = true,
    label = 'Value',
  } = options;

  const sanitizer = (value: string): string => {
    let next = value;
    if (trim) {
      next = next.trim();
    }
    if (normalize) {
      next = normalizeWhitespace(next);
    }
    if (lowercase) {
      next = next.toLowerCase();
    }
    return next;
  };

  let post = z.string();
  if (min !== undefined) {
    post = post.min(min, `${label} must be at least ${min} characters`);
  }
  if (max !== undefined) {
    post = post.max(max, `${label} must be at most ${max} characters`);
  }

  return z.string().transform(sanitizer).pipe(post);
}

export function sanitizedOptionalString(options: SanitizedStringOptions = {}): z.ZodType<string | undefined> {
  return sanitizedString(options).optional();
}

export function createEnumMapper<T extends string, U extends string>(mapping: EnumMapping<T, U>) {
  return (value: T): U => mapping[value];
}

export function formatZodErrors(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

export function parseDbInput<T>(schema: z.ZodSchema<T>, input: unknown, label = 'input'): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DbValidationError(`Invalid ${label}`, {
      errors: formatZodErrors(result.error),
    });
  }
  return result.data;
}
