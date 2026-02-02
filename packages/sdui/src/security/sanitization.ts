/**
 * SDUI Security - Input Sanitization
 * 
 * Protects against XSS attacks by sanitizing all user-provided content
 * before rendering in SDUI components.
 * 
 * CRITICAL: All component props must pass through sanitizeProps() before rendering.
 */

import DOMPurify from 'dompurify';
import { logger } from '@shared/lib/logger';

/**
 * DOMPurify configuration for different security contexts
 */
const SANITIZATION_CONFIGS = {
  // Strict: Only allow basic formatting, no HTML
  strict: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  },
  
  // Standard: Allow safe HTML formatting
  standard: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  },
  
  // Rich: Allow more HTML but still safe
  rich: {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id', 'style'],
    ALLOWED_STYLES: {
      'color': [/^#[0-9a-fA-F]{3,6}$/],
      'background-color': [/^#[0-9a-fA-F]{3,6}$/],
      'font-size': [/^\d+(?:px|em|rem)$/],
      'font-weight': [/^(?:normal|bold|\d{3})$/],
      'text-align': [/^(?:left|right|center|justify)$/],
    },
  },
};

/**
 * Sanitization policy based on component type
 */
const COMPONENT_POLICIES: Record<string, keyof typeof SANITIZATION_CONFIGS> = {
  // Strict components (no HTML allowed)
  'MetricBadge': 'strict',
  'ConfidenceIndicator': 'strict',
  'Breadcrumbs': 'strict',
  'TabBar': 'strict',
  
  // Standard components (basic HTML)
  'InfoBanner': 'standard',
  'DiscoveryCard': 'standard',
  'ValueTreeCard': 'standard',
  'AgentResponseCard': 'standard',
  'KPIForm': 'standard',
  'DataTable': 'standard',
  
  // Rich content components
  'NarrativeBlock': 'rich',
  'AgentWorkflowPanel': 'rich',
  'IntegrityReviewPanel': 'rich',
};

/**
 * Statistics for monitoring XSS attempts
 */
let xssBlockCount = 0;
let lastResetTime = Date.now();

/**
 * Get XSS block statistics
 */
export function getXSSStats(): { blocked: number; sinceTimestamp: number } {
  return {
    blocked: xssBlockCount,
    sinceTimestamp: lastResetTime,
  };
}

/**
 * Reset XSS statistics (called periodically by monitoring)
 */
export function resetXSSStats(): void {
  xssBlockCount = 0;
  lastResetTime = Date.now();
}

/**
 * Sanitize a single string value
 */
export function sanitizeString(
  value: string,
  policy: keyof typeof SANITIZATION_CONFIGS = 'standard'
): string {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Block javascript: URLs explicitly (DOMPurify only blocks in HTML attributes)
  if (value.toLowerCase().trim().startsWith('javascript:')) {
    xssBlockCount++;
    logger.warn('XSS attempt blocked: javascript: URL', {
      original: value.substring(0, 100),
      blocked: xssBlockCount,
    });
    return ''; // Return empty string instead of malicious URL
  }
  
  const config = SANITIZATION_CONFIGS[policy];
  const sanitized = DOMPurify.sanitize(value, config);
  
  // Detect if content was modified (potential XSS attempt)
  if (sanitized !== value) {
    xssBlockCount++;
    logger.warn('XSS attempt blocked during sanitization', {
      original: value.substring(0, 100),
      sanitized: sanitized.substring(0, 100),
      policy,
      blocked: xssBlockCount,
    });
  }
  
  return sanitized;
}

/**
 * Sanitize component props recursively
 * 
 * @param props - Component props to sanitize
 * @param componentType - Component type for policy selection
 * @param depth - Current recursion depth (prevents infinite loops)
 * @returns Sanitized props
 */
export function sanitizeProps(
  props: Record<string, any>,
  componentType?: string,
  depth: number = 0
): Record<string, any> {
  // Prevent infinite recursion
  if (depth > 10) {
    logger.error('Max sanitization depth exceeded', new Error('Deep object'), { depth });
    return props;
  }
  
  // Determine sanitization policy
  const policy = componentType 
    ? (COMPONENT_POLICIES[componentType] || 'standard')
    : 'standard';
  
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(props)) {
    // Skip null/undefined
    if (value === null || value === undefined) {
      sanitized[key] = value;
      continue;
    }
    
    // Sanitize strings
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, policy);
    }
    // Recursively sanitize arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (typeof item === 'string') {
          return sanitizeString(item, policy);
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeProps(item, componentType, depth + 1);
        }
        return item;
      });
    }
    // Pass through Date objects (don't recursively sanitize)
    else if (value instanceof Date) {
      sanitized[key] = value;
    }
    // Recursively sanitize nested objects
    else if (typeof value === 'object') {
      sanitized[key] = sanitizeProps(value, componentType, depth + 1);
    }
    // Pass through primitives (numbers, booleans)
    else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validate that sanitization is working correctly
 * Returns true if sanitization blocked malicious content
 */
export function testSanitization(testVector: string): boolean {
  const before = xssBlockCount;
  sanitizeString(testVector);
  return xssBlockCount > before;
}

/**
 * Common XSS test vectors for validation
 */
export const XSS_TEST_VECTORS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror="alert(1)">',
  '<svg onload="alert(1)">',
  'javascript:alert(1)',
  '<iframe src="javascript:alert(1)">',
  '<body onload="alert(1)">',
  '<input onfocus="alert(1)" autofocus>',
  '<select onfocus="alert(1)" autofocus>',
  '<textarea onfocus="alert(1)" autofocus>',
  '<marquee onstart="alert(1)">',
  '<div style="background:url(javascript:alert(1))">',
  '"><script>alert(String.fromCharCode(88,83,83))</script>',
];

/**
 * Run self-test to ensure sanitization is working
 */
export function runSanitizationSelfTest(): { passed: boolean; results: string[] } {
  const results: string[] = [];
  let passed = true;
  
  for (const vector of XSS_TEST_VECTORS) {
    const sanitized = sanitizeString(vector, 'standard');
    
    // Check that dangerous patterns are removed
    const hasDangerousContent = 
      sanitized.includes('<script') ||
      sanitized.includes('javascript:') ||
      sanitized.includes('onerror=') ||
      sanitized.includes('onload=') ||
      sanitized.includes('onfocus=');
    
    if (hasDangerousContent) {
      passed = false;
      results.push(`FAIL: Vector not sanitized: ${vector} → ${sanitized}`);
    } else {
      results.push(`PASS: Vector blocked: ${vector}`);
    }
  }
  
  return { passed, results };
}
