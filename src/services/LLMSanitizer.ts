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
    // Prompt injection attempts
    /system\s*:/i,
    /ignore\s+(previous|above|all|prior)\s+(instructions|prompts|rules)/i,
    /disregard\s+(previous|above|all|prior)\s+(instructions|prompts|rules)/i,
    /forget\s+(previous|above|all|prior)\s+(instructions|prompts|rules)/i,
    /jailbreak/i,
    /you\s+are\s+now\s+in\s+developer\s+mode/i,
    /pretend\s+you\s+are/i,
    /act\s+as\s+(if|though)/i,
    /new\s+instructions:/i,
    /override\s+(previous|system)\s+(instructions|rules)/i,
    
    // Code injection
    /\beval\s*\(/i,
    /\bFunction\s*\(/i,
    /\bexec\s*\(/i,
    /\bsetTimeout\s*\(/i,
    /\bsetInterval\s*\(/i,
    /\b(on\w+\s*=|javascript:)/i,
    /<script[\s>]/i,
    /document\.cookie/i,
    /localStorage/i,
    /sessionStorage/i,
    /window\.(location|open)/i,
    
    // Prototype pollution
    /__proto__/,
    /constructor\[/,
    /prototype\[/,
    
    // SQL injection patterns
    /;\s*(drop|delete|truncate|alter)\s+table/i,
    /union\s+select/i,
    /'\s*or\s+'1'\s*=\s*'1/i,
    
    // Command injection
    /;\s*(rm|del|format|shutdown)/i,
    /\|\s*(curl|wget|nc|netcat)/i,
    /`[^`]*`/,
    /\$\([^)]*\)/,
    
    // Path traversal
    /\.\.[\/\\]/,
    /\.\.%2[fF]/,
    
    // XXE/SSRF
    /<!ENTITY/i,
    /file:\/\//i,
    /gopher:\/\//i,
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

  /**
   * Detect prompt injection attempts
   */
  detectPromptInjection(content: string): {
    detected: boolean;
    confidence: number;
    patterns: string[];
    severity: 'low' | 'medium' | 'high';
  } {
    const patterns: string[] = [];
    let score = 0;

    // High-risk patterns (score: 10)
    const highRiskPatterns = [
      /ignore\s+(previous|above|all|prior)\s+(instructions|prompts|rules)/i,
      /disregard\s+(previous|above|all|prior)\s+(instructions|prompts|rules)/i,
      /override\s+(previous|system)\s+(instructions|rules)/i,
      /you\s+are\s+now\s+in\s+developer\s+mode/i,
    ];

    for (const pattern of highRiskPatterns) {
      if (pattern.test(content)) {
        patterns.push(`High-risk: ${pattern.source}`);
        score += 10;
      }
    }

    // Medium-risk patterns (score: 5)
    const mediumRiskPatterns = [
      /system\s*:/i,
      /new\s+instructions:/i,
      /pretend\s+you\s+are/i,
      /act\s+as\s+(if|though)/i,
    ];

    for (const pattern of mediumRiskPatterns) {
      if (pattern.test(content)) {
        patterns.push(`Medium-risk: ${pattern.source}`);
        score += 5;
      }
    }

    // Low-risk patterns (score: 2)
    const lowRiskPatterns = [
      /jailbreak/i,
      /forget\s+(previous|above|all|prior)/i,
    ];

    for (const pattern of lowRiskPatterns) {
      if (pattern.test(content)) {
        patterns.push(`Low-risk: ${pattern.source}`);
        score += 2;
      }
    }

    // Determine severity and confidence
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (score >= 10) severity = 'high';
    else if (score >= 5) severity = 'medium';

    const confidence = Math.min(score / 20, 1); // Normalize to 0-1

    return {
      detected: patterns.length > 0,
      confidence,
      patterns,
      severity
    };
  }

  /**
   * Apply XML sandboxing to user input
   */
  applyXmlSandbox(input: string): string {
    // Wrap user input in XML tags to clearly delineate it
    return `<user_input>${this.escapeXml(input)}</user_input>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Comprehensive input sanitization for agent invocations
   */
  sanitizeAgentInput(input: any): {
    sanitized: any;
    violations: string[];
    injectionDetected: boolean;
    severity: 'low' | 'medium' | 'high';
  } {
    const violations: string[] = [];
    let injectionDetected = false;
    let maxSeverity: 'low' | 'medium' | 'high' = 'low';

    // Handle different input types
    if (typeof input === 'string') {
      // Check for prompt injection
      const injection = this.detectPromptInjection(input);
      if (injection.detected) {
        injectionDetected = true;
        maxSeverity = injection.severity;
        violations.push(...injection.patterns);
      }

      // Sanitize the string
      const result = this.sanitizePrompt(input);
      violations.push(...result.violations);

      return {
        sanitized: result.content,
        violations,
        injectionDetected,
        severity: maxSeverity
      };
    }

    if (Array.isArray(input)) {
      const sanitizedArray = input.map(item => {
        const result = this.sanitizeAgentInput(item);
        violations.push(...result.violations);
        if (result.injectionDetected) {
          injectionDetected = true;
          if (result.severity === 'high' || maxSeverity !== 'high') {
            maxSeverity = result.severity;
          }
        }
        return result.sanitized;
      });

      return {
        sanitized: sanitizedArray,
        violations,
        injectionDetected,
        severity: maxSeverity
      };
    }

    if (typeof input === 'object' && input !== null) {
      const sanitizedObj: any = {};

      for (const [key, value] of Object.entries(input)) {
        const result = this.sanitizeAgentInput(value);
        violations.push(...result.violations);
        if (result.injectionDetected) {
          injectionDetected = true;
          if (result.severity === 'high' || maxSeverity !== 'high') {
            maxSeverity = result.severity;
          }
        }
        sanitizedObj[key] = result.sanitized;
      }

      return {
        sanitized: sanitizedObj,
        violations,
        injectionDetected,
        severity: maxSeverity
      };
    }

    // Primitive types (number, boolean, null, undefined)
    return {
      sanitized: input,
      violations,
      injectionDetected,
      severity: maxSeverity
    };
  }
}

export const llmSanitizer = new LLMSanitizer();
