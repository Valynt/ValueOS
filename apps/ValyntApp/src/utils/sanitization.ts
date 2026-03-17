/**
 * Consolidated Sanitization Utilities
 * Extracted common sanitization logic from across the codebase
 */

import { logger } from '../lib/logger';

export interface SanitizationResult {
  sanitized: string;
  originalLength: number;
  sanitizedLength: number;
  changes: string[];
}

export interface SanitizationOptions {
  maxLength?: number;
  removeScripts?: boolean;
  encodeHtmlEntities?: boolean;
  removeEventHandlers?: boolean;
  removeDangerousProtocols?: boolean;
  trimWhitespace?: boolean;
}

/**
 * Default sanitization options
 */
export const DEFAULT_SANITIZATION_OPTIONS: Required<SanitizationOptions> = {
  maxLength: 50000,
  removeScripts: true,
  encodeHtmlEntities: true,
  removeEventHandlers: true,
  removeDangerousProtocols: true,
  trimWhitespace: false,
};

/**
 * Patterns for script tag removal (with content)
 */
const SCRIPT_PATTERNS = [
  /<script[\s\S]*?<\/script>/gi,
  /<!--[\s\S]*?-->/g,
];

/**
 * Patterns for event handler attribute removal (attribute only, not the element).
 * Matches the attribute name+value but preserves the preceding whitespace token.
 */
const EVENT_HANDLER_PATTERN = /on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;

/**
 * Patterns for dangerous protocol removal (full expression up to whitespace)
 */
const DANGEROUS_PROTOCOL_PATTERNS = [
  /javascript:\S*/gi,
  /data:text\/html\S*/gi,
];

/**
 * HTML entities mapping for encoding
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Encode dangerous HTML characters (does not encode / to preserve tag structure)
 */
function encodeHtmlEntities(text: string): string {
  return text.replace(/[&<>"']/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Remove dangerous patterns from content, respecting individual config flags
 */
function removeDangerousPatterns(
  content: string,
  opts: { removeScripts: boolean; removeEventHandlers: boolean; removeDangerousProtocols: boolean }
): { sanitized: string; changes: string[] } {
  const changes: string[] = [];
  let sanitized = content;

  if (opts.removeScripts) {
    for (const pattern of SCRIPT_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        changes.push(`Removed: ${match.slice(0, 50)}${match.length > 50 ? '...' : ''}`);
        return '';
      });
    }
  }

  if (opts.removeEventHandlers) {
    sanitized = sanitized.replace(EVENT_HANDLER_PATTERN, (match) => {
      changes.push(`Removed: ${match.trim().slice(0, 50)}`);
      return '';
    });
  }

  if (opts.removeDangerousProtocols) {
    for (const pattern of DANGEROUS_PROTOCOL_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        changes.push(`Removed: ${match.slice(0, 50)}${match.length > 50 ? '...' : ''}`);
        return '';
      });
    }
  }

  return { sanitized, changes };
}

/**
 * Trim excessive whitespace
 */
function trimWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')  // Multiple spaces/tabs to single space
    .replace(/\n{3,}/g, '\n\n')  // Multiple newlines to double newline
    .trim();
}

/**
 * Sanitize LLM content with comprehensive security measures
 */
export function sanitizeLLMContent(
  content: string,
  options: SanitizationOptions = {}
): SanitizationResult {
  if (!content || typeof content !== 'string') {
    return {
      sanitized: '',
      originalLength: 0,
      sanitizedLength: 0,
      changes: ['Empty or invalid content']
    };
  }

  const config = { ...DEFAULT_SANITIZATION_OPTIONS, ...options };
  const changes: string[] = [];
  let sanitized = content;

  // Track original length
  const originalLength = content.length;

  try {
    // Remove dangerous patterns
    if (config.removeScripts || config.removeEventHandlers || config.removeDangerousProtocols) {
      const patternResult = removeDangerousPatterns(sanitized, {
        removeScripts: config.removeScripts,
        removeEventHandlers: config.removeEventHandlers,
        removeDangerousProtocols: config.removeDangerousProtocols,
      });
      sanitized = patternResult.sanitized;
      changes.push(...patternResult.changes);
    }

    // Encode HTML entities
    if (config.encodeHtmlEntities) {
      const before = sanitized;
      sanitized = encodeHtmlEntities(sanitized);
      if (before !== sanitized) {
        changes.push('Encoded HTML entities');
      }
    }

    // Trim whitespace
    if (config.trimWhitespace) {
      const before = sanitized;
      sanitized = trimWhitespace(sanitized);
      if (before !== sanitized) {
        changes.push('Trimmed excessive whitespace');
      }
    }

    // Limit length
    if (config.maxLength && sanitized.length > config.maxLength) {
      sanitized = sanitized.slice(0, config.maxLength);
      changes.push(`Truncated to ${config.maxLength} characters`);
    }

    const sanitizedLength = sanitized.length;

    // Log significant changes for security monitoring
    if (changes.length > 0) {
      logger.debug('Content sanitized', {
        originalLength,
        sanitizedLength,
        changesCount: changes.length,
        significantChange: originalLength !== sanitizedLength
      });
    }

    return {
      sanitized,
      originalLength,
      sanitizedLength,
      changes
    };

  } catch (error) {
    logger.error('Sanitization error', { error: error instanceof Error ? error.message : error });
    return {
      sanitized: '',
      originalLength,
      sanitizedLength: 0,
      changes: ['Sanitization failed - content removed for security']
    };
  }
}

/**
 * Sanitize user input with basic validation
 */
export function sanitizeUserInput(
  input: string,
  maxLength = 2000
): SanitizationResult {
  return sanitizeLLMContent(input, {
    maxLength,
    removeScripts: true,
    encodeHtmlEntities: false, // User input might need different handling
    removeEventHandlers: true,
    removeDangerousProtocols: true,
    trimWhitespace: false,
  });
}

/**
 * Sanitize LLM messages for agent communication
 */
export function sanitizeLLMMessage(
  message: { role: string; content: string; [key: string]: unknown }
): { sanitized: typeof message; changes: string[] } {
  const changes: string[] = [];

  if (typeof message.content === 'string' && message.content.length > 0) {
    const contentResult = sanitizeLLMContent(message.content, { encodeHtmlEntities: false, trimWhitespace: false });
    if (contentResult.changes.length > 0) {
      changes.push(...contentResult.changes.map(change => `content: ${change}`));
    }

    return {
      sanitized: {
        ...message,
        content: contentResult.sanitized,
      },
      changes
    };
  }

  return { sanitized: message, changes };
}

/**
 * Check if content contains potentially dangerous patterns
 */
export function containsDangerousContent(content: string): {
  dangerous: boolean;
  patterns: string[];
  severity: 'low' | 'medium' | 'high';
} {
  const patterns: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  const allPatterns = [...SCRIPT_PATTERNS, EVENT_HANDLER_PATTERN, ...DANGEROUS_PROTOCOL_PATTERNS];
  for (const pattern of allPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      patterns.push(...matches.slice(0, 5)); // Limit to first 5 matches
      severity = 'high'; // Any dangerous pattern is high severity
    }
  }

  // Check for prompt injection patterns
  const injectionPatterns = [
    /^\s*system:/i,
    /^\s*ignore\s+(previous|all)/i,
    /jailbreak/i,
    /developer\s+mode/i,
    /\b(system|assistant):\s/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(content)) {
      patterns.push('Prompt injection pattern');
      severity = severity === 'high' ? 'high' : 'medium';
    }
  }

  return {
    dangerous: patterns.length > 0,
    patterns,
    severity
  };
}

/**
 * Batch sanitize multiple content strings
 */
export function sanitizeBatch(
  contents: string[],

  options: SanitizationOptions = {}
): Array<SanitizationResult & { index: number }> {
  return contents.map((content, index) => ({
    ...sanitizeLLMContent(content, options),
    index
  }));
}
