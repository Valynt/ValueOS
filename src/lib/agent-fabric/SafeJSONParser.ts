/**
 * Safe JSON Parser for LLM Outputs
 * 
 * Handles malformed JSON, missing fields, type mismatches, and oversized payloads
 * with comprehensive error recovery and user-friendly error messages.
 */

import { logger } from '../logger';
import { z } from 'zod';

/**
 * Maximum JSON payload size (5 MB)
 */
const MAX_JSON_SIZE = 5 * 1024 * 1024;

/**
 * JSON extraction patterns (ordered by reliability)
 */
const JSON_PATTERNS = [
  // Standard JSON block
  /```json\s*(\{[\s\S]*?\})\s*```/,
  // Code fence without language
  /```\s*(\{[\s\S]*?\})\s*```/,
  // Plain JSON object
  /(\{[\s\S]*\})/,
  // Array format
  /(\[[\s\S]*\])/
];

export interface ParseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  recoveryStrategy?: string;
}

/**
 * Parse JSON from LLM output with comprehensive error handling
 */
export async function parseJSONFromLLM<T = any>(
  content: string,
  schema?: z.ZodSchema<T>,
  options: {
    maxSize?: number;
    allowPartial?: boolean;
    strictMode?: boolean;
  } = {}
): Promise<ParseResult<T>> {
  const {
    maxSize = MAX_JSON_SIZE,
    allowPartial = false,
    strictMode = false
  } = options;

  const warnings: string[] = [];

  // 1. Size validation
  if (content.length > maxSize) {
    logger.error('JSON payload exceeds size limit', {
      size: content.length,
      maxSize,
      preview: content.substring(0, 200)
    });
    return {
      success: false,
      error: `JSON payload too large: ${(content.length / 1024 / 1024).toFixed(2)} MB (max: ${(maxSize / 1024 / 1024).toFixed(2)} MB)`,
      warnings
    };
  }

  // 2. Extract JSON using multiple patterns
  let jsonString: string | null = null;
  let matchedPattern: string | null = null;

  for (const pattern of JSON_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      jsonString = match[1].trim();
      matchedPattern = pattern.source;
      break;
    }
  }

  if (!jsonString) {
    logger.warn('No JSON found in LLM output', {
      contentPreview: content.substring(0, 200),
      contentLength: content.length
    });
    return {
      success: false,
      error: 'No valid JSON structure found in response. Expected JSON object or array.',
      warnings: ['Consider adjusting the prompt to explicitly request JSON output'],
      recoveryStrategy: 'retry_with_json_instruction'
    };
  }

  // 3. Clean common LLM artifacts
  jsonString = cleanJSONString(jsonString, warnings);

  // 4. Parse JSON with error recovery
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseError: any) {
    logger.warn('Initial JSON parse failed, attempting recovery', {
      error: parseError.message,
      jsonPreview: jsonString.substring(0, 200)
    });

    // Try recovery strategies
    const recoveryResult = attemptJSONRecovery(jsonString, parseError);
    
    if (!recoveryResult.success) {
      return {
        success: false,
        error: `JSON parsing failed: ${parseError.message}`,
        warnings: [
          ...warnings,
          `Parse error at position ${parseError.message.match(/position (\\d+)/)?.[1] || 'unknown'}`,
          'This may indicate truncated LLM output or invalid JSON structure'
        ],
        recoveryStrategy: recoveryResult.recoveryStrategy
      };
    }

    parsed = recoveryResult.data;
    warnings.push(...(recoveryResult.warnings || []));
  }

  // 5. Schema validation (if provided)
  if (schema) {
    try {
      const validated = schema.parse(parsed);
      return {
        success: true,
        data: validated,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (validationError: any) {
      const zodError = validationError as z.ZodError;
      
      logger.error('Schema validation failed', {
        errors: zodError.errors,
        parsed: JSON.stringify(parsed).substring(0, 500)
      });

      // In non-strict mode, attempt partial recovery
      if (allowPartial && !strictMode) {
        const partialResult = attemptPartialRecovery(parsed, schema, zodError);
        if (partialResult.success) {
          return {
            ...partialResult,
            warnings: [
              ...warnings,
              'Schema validation failed, returning partial data',
              ...partialResult.warnings!
            ]
          };
        }
      }

      return {
        success: false,
        error: `Schema validation failed: ${formatZodErrors(zodError)}`,
        warnings: [
          ...warnings,
          'The JSON structure does not match expected schema',
          'Missing or invalid fields: ' + zodError.errors.map(e => e.path.join('.')).join(', ')
        ],
        recoveryStrategy: 'retry_with_schema_hint'
      };
    }
  }

  // 6. Success without schema validation
  return {
    success: true,
    data: parsed as T,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Clean common LLM JSON artifacts
 */
function cleanJSONString(json: string, warnings: string[]): string {
  let cleaned = json;

  // Remove trailing commas before closing braces/brackets
  const trailingCommaPattern = /,(\s*[}\]])/g;
  if (trailingCommaPattern.test(cleaned)) {
    cleaned = cleaned.replace(trailingCommaPattern, '$1');
    warnings.push('Removed trailing commas from JSON');
  }

  // Fix unescaped newlines in strings
  cleaned = cleaned.replace(/(?<!\\)\n/g, '\\n');

  // Remove control characters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

  // Fix common LLM escape issues
  cleaned = cleaned.replace(/\\'/g, "'"); // Single quotes don't need escaping in JSON

  return cleaned;
}

/**
 * Attempt JSON recovery strategies
 */
function attemptJSONRecovery(
  jsonString: string,
  parseError: any
): ParseResult {
  const strategies = [
    // Strategy 1: Remove text after last valid closing brace
    () => {
      const lastCloseBrace = jsonString.lastIndexOf('}');
      const lastCloseBracket = jsonString.lastIndexOf(']');
      const lastClose = Math.max(lastCloseBrace, lastCloseBracket);
      
      if (lastClose > 0) {
        const truncated = jsonString.substring(0, lastClose + 1);
        try {
          return {
            success: true,
            data: JSON.parse(truncated),
            warnings: ['Truncated trailing invalid content']
          };
        } catch {
          return { success: false };
        }
      }
      return { success: false };
    },

    // Strategy 2: Extract first complete JSON object/array
    () => {
      const braceMatch = jsonString.match(/\{[^{}]*\}/);
      if (braceMatch) {
        try {
          return {
            success: true,
            data: JSON.parse(braceMatch[0]),
            warnings: ['Extracted first complete JSON object']
          };
        } catch {
          return { success: false };
        }
      }
      return { success: false };
    },

    // Strategy 3: Fix common quote issues
    () => {
      const fixed = jsonString
        .replace(/'/g, '"') // Replace single quotes with double quotes
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // Quote unquoted keys
      
      try {
        return {
          success: true,
          data: JSON.parse(fixed),
          warnings: ['Fixed quote formatting issues']
        };
      } catch {
        return { success: false };
      }
    }
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result.success) {
      return result;
    }
  }

  return {
    success: false,
    recoveryStrategy: 'request_well_formed_json'
  };
}

/**
 * Attempt to extract partial valid data from failed schema validation
 */
function attemptPartialRecovery<T>(
  parsed: any,
  schema: z.ZodSchema<T>,
  zodError: z.ZodError
): ParseResult<Partial<T>> {
  const warnings: string[] = [];
  const partial: any = {};

  // Extract valid fields
  if (typeof parsed === 'object' && parsed !== null) {
    for (const [key, value] of Object.entries(parsed)) {
      try {
        // Try to validate individual field
        const fieldSchema = (schema as any).shape?.[key];
        if (fieldSchema) {
          partial[key] = fieldSchema.parse(value);
        } else {
          // No schema for this field, include as-is
          partial[key] = value;
        }
      } catch {
        warnings.push(`Skipped invalid field: ${key}`);
      }
    }
  }

  if (Object.keys(partial).length > 0) {
    return {
      success: true,
      data: partial as Partial<T>,
      warnings: [
        'Partial data recovery successful',
        `Recovered ${Object.keys(partial).length} valid fields`,
        ...warnings
      ]
    };
  }

  return {
    success: false,
    warnings: ['No valid fields could be recovered']
  };
}

/**
 * Format Zod errors into user-friendly message
 */
function formatZodErrors(zodError: z.ZodError): string {
  return zodError.errors
    .map(err => {
      const path = err.path.join('.');
      return `${path || 'root'}: ${err.message}`;
    })
    .join('; ');
}

/**
 * Legacy wrapper for backward compatibility
 */
export async function parseLLMOutputStrict<T>(
  content: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const result = await parseJSONFromLLM(content, schema, { strictMode: true });
  
  if (!result.success) {
    throw new Error(result.error || 'JSON parsing failed');
  }
  
  return result.data!;
}

/**
 * Extract JSON with graceful degradation
 */
export async function extractJSON<T = any>(
  content: string,
  schema?: z.ZodSchema<T>,
  options?: {
    maxSize?: number;
    allowPartial?: boolean;
  }
): Promise<T> {
  const result = await parseJSONFromLLM(content, schema, {
    ...options,
    strictMode: false,
    allowPartial: options?.allowPartial ?? true
  });

  if (!result.success) {
    logger.error('JSON extraction failed', {
      error: result.error,
      warnings: result.warnings,
      recoveryStrategy: result.recoveryStrategy
    });
    throw new Error(result.error || 'Failed to extract valid JSON from LLM output');
  }

  if (result.warnings && result.warnings.length > 0) {
    logger.warn('JSON extraction succeeded with warnings', {
      warnings: result.warnings
    });
  }

  return result.data!;
}
