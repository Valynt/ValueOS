/**
 * Task #029: SDUI Sanitization
 * 
 * Sanitizes SDUI payloads to prevent XSS and injection attacks
 */

import DOMPurify from 'isomorphic-dompurify';
import { logger } from '../logger';

export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripScripts?: boolean;
  stripEventHandlers?: boolean;
  maxStringLength?: number;
  maxDepth?: number;
}

export interface SanitizationResult {
  sanitized: any;
  modified: boolean;
  violations: string[];
  warnings: string[];
}

export class SDUISanitizer {
  private defaultOptions: SanitizationOptions = {
    allowedTags: [
      'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
      'br', 'code', 'pre', 'blockquote',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      '*': ['class', 'id', 'data-*'],
    },
    stripScripts: true,
    stripEventHandlers: true,
    maxStringLength: 10000,
    maxDepth: 10,
  };

  /**
   * Sanitize SDUI page definition
   */
  sanitizePage(page: any, options?: Partial<SanitizationOptions>): SanitizationResult {
    const opts = { ...this.defaultOptions, ...options };
    const violations: string[] = [];
    const warnings: string[] = [];
    let modified = false;

    try {
      // Validate structure
      if (!page || typeof page !== 'object') {
        violations.push('Page must be an object');
        return {
          sanitized: null,
          modified: true,
          violations,
          warnings,
        };
      }

      // Sanitize sections
      const sanitizedSections = page.sections?.map((section: any, idx: number) => {
        const result = this.sanitizeSection(section, opts, idx);
        if (result.modified) modified = true;
        violations.push(...result.violations);
        warnings.push(...result.warnings);
        return result.sanitized;
      });

      // Sanitize metadata
      const sanitizedMetadata = this.sanitizeObject(page.metadata || {}, opts, 'metadata');
      if (sanitizedMetadata.modified) modified = true;
      violations.push(...sanitizedMetadata.violations);

      const sanitized = {
        ...page,
        sections: sanitizedSections || [],
        metadata: sanitizedMetadata.sanitized,
      };

      return {
        sanitized,
        modified,
        violations,
        warnings,
      };
    } catch (error) {
      logger.error('SDUI sanitization error', error);
      violations.push(`Sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        sanitized: null,
        modified: true,
        violations,
        warnings,
      };
    }
  }

  /**
   * Sanitize section
   */
  private sanitizeSection(
    section: any,
    opts: SanitizationOptions,
    index: number
  ): SanitizationResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    let modified = false;

    if (!section || typeof section !== 'object') {
      violations.push(`Section ${index}: Invalid section structure`);
      return {
        sanitized: null,
        modified: true,
        violations,
        warnings,
      };
    }

    // Check component name
    if (!section.component || typeof section.component !== 'string') {
      violations.push(`Section ${index}: Missing or invalid component name`);
    }

    // Sanitize component name (prevent script injection)
    const sanitizedComponent = this.sanitizeString(section.component, opts);
    if (sanitizedComponent !== section.component) {
      modified = true;
      warnings.push(`Section ${index}: Component name sanitized`);
    }

    // Sanitize props
    const sanitizedProps = this.sanitizeObject(section.props || {}, opts, `section-${index}-props`);
    if (sanitizedProps.modified) modified = true;
    violations.push(...sanitizedProps.violations);

    // Sanitize layout directive
    if (section.intent) {
      const sanitizedIntent = this.sanitizeString(section.intent, opts);
      if (sanitizedIntent !== section.intent) {
        modified = true;
        warnings.push(`Section ${index}: Intent sanitized`);
      }
      section.intent = sanitizedIntent;
    }

    return {
      sanitized: {
        ...section,
        component: sanitizedComponent,
        props: sanitizedProps.sanitized,
      },
      modified,
      violations,
      warnings,
    };
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(
    obj: any,
    opts: SanitizationOptions,
    path: string,
    depth: number = 0
  ): SanitizationResult {
    const violations: string[] = [];
    let modified = false;

    // Check depth
    if (depth > (opts.maxDepth || 10)) {
      violations.push(`${path}: Maximum depth exceeded`);
      return {
        sanitized: {},
        modified: true,
        violations,
        warnings: [],
      };
    }

    if (!obj || typeof obj !== 'object') {
      return {
        sanitized: obj,
        modified: false,
        violations: [],
        warnings: [],
      };
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const sanitizedKey = this.sanitizeString(key, opts);
      if (sanitizedKey !== key) {
        modified = true;
      }

      // Sanitize value
      if (typeof value === 'string') {
        const sanitizedValue = this.sanitizeString(value, opts);
        sanitized[sanitizedKey] = sanitizedValue;
        if (sanitizedValue !== value) modified = true;
      } else if (typeof value === 'object' && value !== null) {
        const result = this.sanitizeObject(value, opts, `${path}.${key}`, depth + 1);
        sanitized[sanitizedKey] = result.sanitized;
        if (result.modified) modified = true;
        violations.push(...result.violations);
      } else {
        // Numbers, booleans, null
        sanitized[sanitizedKey] = value;
      }
    }

    return {
      sanitized,
      modified,
      violations,
      warnings: [],
    };
  }

  /**
   * Sanitize string
   */
  private sanitizeString(str: string, opts: SanitizationOptions): string {
    if (typeof str !== 'string') return str;

    // Check length
    if (opts.maxStringLength && str.length > opts.maxStringLength) {
      str = str.substring(0, opts.maxStringLength);
    }

    // Strip scripts
    if (opts.stripScripts) {
      str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    // Strip event handlers
    if (opts.stripEventHandlers) {
      str = str.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
      str = str.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
    }

    // Use DOMPurify for HTML sanitization
    if (this.containsHTML(str)) {
      str = DOMPurify.sanitize(str, {
        ALLOWED_TAGS: opts.allowedTags || [],
        ALLOWED_ATTR: this.flattenAttributes(opts.allowedAttributes || {}),
      });
    }

    // Remove null bytes
    str = str.replace(/\0/g, '');

    return str;
  }

  /**
   * Check if string contains HTML
   */
  private containsHTML(str: string): boolean {
    return /<[^>]+>/.test(str);
  }

  /**
   * Flatten allowed attributes for DOMPurify
   */
  private flattenAttributes(attrs: Record<string, string[]>): string[] {
    const flattened: string[] = [];
    for (const [, attrList] of Object.entries(attrs)) {
      flattened.push(...attrList);
    }
    return flattened;
  }

  /**
   * Validate SDUI payload against schema
   */
  validate(page: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!page) {
      errors.push('Page is null or undefined');
      return { valid: false, errors };
    }

    if (page.type !== 'page') {
      errors.push('Page type must be "page"');
    }

    if (!Array.isArray(page.sections)) {
      errors.push('Page must have sections array');
    }

    if (page.sections) {
      page.sections.forEach((section: any, idx: number) => {
        if (!section.type) {
          errors.push(`Section ${idx}: Missing type`);
        }
        if (!section.component) {
          errors.push(`Section ${idx}: Missing component`);
        }
        if (section.type === 'layout.directive' && !section.intent) {
          errors.push(`Section ${idx}: Layout directive missing intent`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const sduiSanitizer = new SDUISanitizer();
