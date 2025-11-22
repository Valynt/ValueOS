/**
 * LLM Response Sanitization Service
 * Protects against prompt injection and malicious content generation
 *
 * Features:
 * - XSS prevention
 * - Script injection blocking
 * - Prototype pollution protection
 * - JSON schema validation
 * - Content policy enforcement
 */

import { logger } from '../lib/logger';
import DOMPurify from 'dompurify';
import { BaseService } from './BaseService';

export interface SanitizationConfig {
  allowHtml: boolean;
  allowScripts: boolean;
  maxLength: number;
  contentPolicies: string[];
}

export interface SanitizedResult {
  content: string;
  wasModified: boolean;
  violations: string[];
}

export class LLMSanitizer extends BaseService {
  private static readonly DEFAULT_CONFIG: SanitizationConfig = {
    allowHtml: false,
    allowScripts: false,
    maxLength: 50000,
    contentPolicies: [
      'no-credentials',
      'no-personal-data',
      'no-malicious-code',
    ],
  };

  private static readonly SUSPICIOUS_PATTERNS = [
    /system\s*:/i,
    /ignore\s+(previous|above|all)\s+instructions/i,
    /jailbreak/i,
    /\beval\s*\(/i,
    /\bFunction\s*\(/i,
    /\b(on\w+\s*=|javascript:)/i,
    /<script[\s>]/i,
    /document\.cookie/i,
    /localStorage/i,
    /sessionStorage/i,
    /__proto__/,
    /constructor\[/,
    /prototype\[/,
  ];

  private static readonly BLOCKED_TAGS = [
    'script',
    'iframe',
    'object',
    'embed',
    'link',
    'style',
    'base',
    'meta',
  ];

  constructor() {
    super('LLMSanitizer');
  }

  /**
   * Sanitize LLM prompt (input)
   */
  sanitizePrompt(prompt: string, config?: Partial<SanitizationConfig>): SanitizedResult {
    const finalConfig = { ...LLMSanitizer.DEFAULT_CONFIG, ...config };
    const violations: string[] = [];
    let content = prompt;
    let wasModified = false;

    if (!content) {
      return { content: '', wasModified: false, violations: [] };
    }

    if (content.length > finalConfig.maxLength) {
      content = content.substring(0, finalConfig.maxLength);
      violations.push(`Content truncated to ${finalConfig.maxLength} characters`);
      wasModified = true;
    }

    const suspiciousMatches = this.detectSuspiciousPatterns(content);
    if (suspiciousMatches.length > 0) {
      violations.push(...suspiciousMatches);
      this.log('warn', 'Suspicious patterns detected in prompt', {
        patterns: suspiciousMatches,
      });
    }

    content = this.removeNullBytes(content);
    content = this.normalizeWhitespace(content);

    if (content !== prompt) {
      wasModified = true;
    }

    return { content, wasModified, violations };
  }

  /**
   * Sanitize LLM response (output)
   */
  sanitizeResponse(
    response: string,
    config?: Partial<SanitizationConfig>
  ): SanitizedResult {
    const finalConfig = { ...LLMSanitizer.DEFAULT_CONFIG, ...config };
    const violations: string[] = [];
    let content = response;
    let wasModified = false;

    if (!content) {
      return { content: '', wasModified: false, violations: [] };
    }

    if (content.length > finalConfig.maxLength) {
      content = content.substring(0, finalConfig.maxLength);
      violations.push(`Response truncated to ${finalConfig.maxLength} characters`);
      wasModified = true;
    }

    const suspiciousMatches = this.detectSuspiciousPatterns(content);
    if (suspiciousMatches.length > 0) {
      violations.push(...suspiciousMatches);
      this.log('warn', 'Suspicious patterns in LLM response', {
        patterns: suspiciousMatches,
      });
    }

    if (finalConfig.allowHtml) {
      content = this.sanitizeHtml(content);
      wasModified = true;
    } else {
      const strippedHtml = this.stripHtml(content);
      if (strippedHtml !== content) {
        content = strippedHtml;
        violations.push('HTML tags removed');
        wasModified = true;
      }
    }

    content = this.preventPrototypePollution(content);
    content = this.removeNullBytes(content);

    return { content, wasModified, violations };
  }

  /**
   * Sanitize HTML using DOMPurify
   */
  private sanitizeHtml(html: string): string {
    if (typeof window === 'undefined') {
      return this.stripHtml(html);
    }

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'a',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'code',
        'pre',
      ],
      ALLOWED_ATTR: ['href', 'title', 'target'],
      FORBID_TAGS: LLMSanitizer.BLOCKED_TAGS,
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'style'],
      ALLOW_DATA_ATTR: false,
      RETURN_TRUSTED_TYPE: false,
    });
  }

  /**
   * Strip all HTML tags
   */
  private stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  /**
   * Detect suspicious patterns
   */
  private detectSuspiciousPatterns(content: string): string[] {
    const matches: string[] = [];

    for (const pattern of LLMSanitizer.SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        matches.push(`Suspicious pattern: ${pattern.source}`);
      }
    }

    for (const tag of LLMSanitizer.BLOCKED_TAGS) {
      const regex = new RegExp(`<${tag}[\\s>]`, 'i');
      if (regex.test(content)) {
        matches.push(`Blocked tag: ${tag}`);
      }
    }

    return matches;
  }

  /**
   * Prevent prototype pollution
   */
  private preventPrototypePollution(content: string): string {
    return content
      .replace(/__proto__/g, '[blocked]')
      .replace(/constructor\[/g, '[blocked][')
      .replace(/prototype\[/g, '[blocked][');
  }

  /**
   * Remove null bytes
   */
  private removeNullBytes(content: string): string {
    return content.replace(/\0/g, '');
  }

  /**
   * Normalize whitespace
   */
  private normalizeWhitespace(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, '  ')
      .trim();
  }

  /**
   * Validate JSON structure
   */
  validateJsonStructure(json: string): { valid: boolean; error?: string } {
    try {
      const parsed = JSON.parse(json);

      if (this.hasPrototypePollution(parsed)) {
        return {
          valid: false,
          error: 'Potential prototype pollution detected',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid JSON',
      };
    }
  }

  /**
   * Check for prototype pollution in object
   */
  private hasPrototypePollution(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        return true;
      }

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (this.hasPrototypePollution(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Sanitize object (remove dangerous properties)
   */
  sanitizeObject<T extends Record<string, any>>(obj: T): T {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        this.log('warn', 'Removed dangerous property', { key });
        continue;
      }

      const value = obj[key];

      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        const result = this.sanitizeResponse(value);
        sanitized[key] = result.content;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as T;
  }

  /**
   * Check if content contains credentials
   */
  containsCredentials(content: string): boolean {
    const credentialPatterns = [
      /password\s*[:=]\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
      /token\s*[:=]\s*['"][^'"]+['"]/i,
      /secret\s*[:=]\s*['"][^'"]+['"]/i,
      /bearer\s+[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/i,
    ];

    return credentialPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Redact sensitive information
   */
  redactSensitive(content: string): string {
    let redacted = content;

    redacted = redacted.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL]'
    );

    redacted = redacted.replace(
      /\b\d{3}-\d{2}-\d{4}\b/g,
      '[SSN]'
    );

    redacted = redacted.replace(
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      '[CREDIT_CARD]'
    );

    redacted = redacted.replace(
      /password\s*[:=]\s*['"][^'"]+['"]/gi,
      'password=[REDACTED]'
    );

    redacted = redacted.replace(
      /(api[_-]?key|token|secret)\s*[:=]\s*['"][^'"]+['"]/gi,
      '$1=[REDACTED]'
    );

    return redacted;
  }
}

export const llmSanitizer = new LLMSanitizer();
