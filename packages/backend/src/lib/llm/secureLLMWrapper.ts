/**
 * Secure LLM Wrapper
 * 
 * Security wrapper for LLM requests with input/output sanitization,
 * PII detection, and content filtering.
 */

import { logger } from '../logger.js';

export interface SecureLLMConfig {
  enable_pii_detection: boolean;
  enable_content_filtering: boolean;
  enable_rate_limiting: boolean;
  max_tokens_per_request: number;
}

export interface LLMSecurityResult {
  is_safe: boolean;
  violations: SecurityViolation[];
  sanitized_input?: string;
  sanitized_output?: string;
}

export interface SecurityViolation {
  type: 'pii' | 'content_filter' | 'rate_limit' | 'token_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
}

export class SecureLLMWrapper {
  private config: SecureLLMConfig;

  constructor(config: SecureLLMConfig) {
    this.config = config;
  }

  async validateInput(input: string): Promise<LLMSecurityResult> {
    const violations: SecurityViolation[] = [];

    if (this.config.enable_pii_detection) {
      const piiViolations = this.detectPII(input);
      violations.push(...piiViolations);
    }

    if (this.config.enable_content_filtering) {
      const contentViolations = this.filterContent(input);
      violations.push(...contentViolations);
    }

    const is_safe = violations.length === 0 || 
      violations.every(v => v.severity === 'low');

    return {
      is_safe,
      violations,
      sanitized_input: is_safe ? input : this.sanitize(input),
    };
  }

  async validateOutput(output: string): Promise<LLMSecurityResult> {
    const violations: SecurityViolation[] = [];

    if (this.config.enable_pii_detection) {
      const piiViolations = this.detectPII(output);
      violations.push(...piiViolations);
    }

    const is_safe = violations.length === 0;

    return {
      is_safe,
      violations,
      sanitized_output: is_safe ? output : this.sanitize(output),
    };
  }

  private detectPII(text: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    // Email detection
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
      violations.push({
        type: 'pii',
        severity: 'medium',
        message: 'Email address detected',
      });
    }

    // Phone number detection
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text)) {
      violations.push({
        type: 'pii',
        severity: 'medium',
        message: 'Phone number detected',
      });
    }

    // SSN detection
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
      violations.push({
        type: 'pii',
        severity: 'high',
        message: 'SSN detected',
      });
    }

    return violations;
  }

  private filterContent(text: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    // Basic content filtering (placeholder)
    const prohibitedPatterns = ['<script', 'javascript:', 'eval('];
    
    for (const pattern of prohibitedPatterns) {
      if (text.toLowerCase().includes(pattern)) {
        violations.push({
          type: 'content_filter',
          severity: 'high',
          message: `Prohibited pattern detected: ${pattern}`,
        });
      }
    }

    return violations;
  }

  private sanitize(text: string): string {
    // Basic sanitization
    return text
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  }
}

export function createSecureLLMWrapper(config: SecureLLMConfig): SecureLLMWrapper {
  return new SecureLLMWrapper(config);
}
