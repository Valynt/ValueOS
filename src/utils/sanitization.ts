/**
 * Consolidated Sanitization Utilities
 * Extracted common sanitization logic from across the codebase
 */

import { logger } from "../lib/logger";

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
  trimWhitespace: true,
};

/**
 * Dangerous patterns to remove from content
 */
const DANGEROUS_PATTERNS = [
  // Script tags and their content
  /<script[\s\S]*?<\/script>/gi,
  // JavaScript protocol
  /javascript:/gi,
  // Event handlers
  /on\w+\s*=/gi,
  // Dangerous HTML elements
  /<(iframe|object|embed|form|input|button|select|textarea|meta|link)[\s\S]*?>/gi,
  // Base64 encoded data that might contain scripts
  /data:text\/html/gi,
  // Comments that might contain sensitive info
  /<!--[\s\S]*?-->/g,
];

/**
 * HTML entities mapping for encoding
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Encode dangerous HTML characters
 */
function encodeHtmlEntities(text: string): string {
  return text.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove dangerous patterns from content
 */
function removeDangerousPatterns(content: string): {
  sanitized: string;
  changes: string[];
} {
  const changes: string[] = [];
  let sanitized = content;

  for (const pattern of DANGEROUS_PATTERNS) {
    const original = sanitized;
    sanitized = sanitized.replace(pattern, (match) => {
      changes.push(
        `Removed: ${match.slice(0, 50)}${match.length > 50 ? "..." : ""}`
      );
      return "";
    });
  }

  return { sanitized, changes };
}

/**
 * Trim excessive whitespace
 */
function trimWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, " ") // Multiple spaces/tabs to single space
    .replace(/\n{3,}/g, "\n\n") // Multiple newlines to double newline
    .trim();
}

/**
 * Sanitize LLM content with comprehensive security measures
 */
export function sanitizeLLMContent(
  content: string,
  options: SanitizationOptions = {}
): SanitizationResult {
  if (!content || typeof content !== "string") {
    return {
      sanitized: "",
      originalLength: 0,
      sanitizedLength: 0,
      changes: ["Empty or invalid content"],
    };
  }

  const config = { ...DEFAULT_SANITIZATION_OPTIONS, ...options };
  const changes: string[] = [];
  let sanitized = content;

  // Track original length
  const originalLength = content.length;

  try {
    // Remove dangerous patterns
    if (
      config.removeScripts ||
      config.removeEventHandlers ||
      config.removeDangerousProtocols
    ) {
      const patternResult = removeDangerousPatterns(sanitized);
      sanitized = patternResult.sanitized;
      changes.push(...patternResult.changes);
    }

    // Encode HTML entities
    if (config.encodeHtmlEntities) {
      const before = sanitized;
      sanitized = encodeHtmlEntities(sanitized);
      if (before !== sanitized) {
        changes.push("Encoded HTML entities");
      }
    }

    // Trim whitespace
    if (config.trimWhitespace) {
      const before = sanitized;
      sanitized = trimWhitespace(sanitized);
      if (before !== sanitized) {
        changes.push("Trimmed excessive whitespace");
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
      logger.debug("Content sanitized", {
        originalLength,
        sanitizedLength,
        changesCount: changes.length,
        significantChange: originalLength !== sanitizedLength,
      });
    }

    return {
      sanitized,
      originalLength,
      sanitizedLength,
      changes,
    };
  } catch (error) {
    logger.error("Sanitization error", {
      error: error instanceof Error ? error.message : error,
    });
    return {
      sanitized: "",
      originalLength,
      sanitizedLength: 0,
      changes: ["Sanitization failed - content removed for security"],
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
    trimWhitespace: true,
  });
}

/**
 * Sanitize LLM messages for agent communication
 */
export function sanitizeLLMMessage(message: {
  role: string;
  content: string;
  [key: string]: any;
}): { sanitized: typeof message; changes: string[] } {
  const changes: string[] = [];

  if (typeof message.content === "string") {
    const contentResult = sanitizeLLMContent(message.content);
    if (contentResult.changes.length > 0) {
      changes.push(
        ...contentResult.changes.map((change) => `content: ${change}`)
      );
    }

    return {
      sanitized: {
        ...message,
        content: contentResult.sanitized,
      },
      changes,
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
  severity: "low" | "medium" | "high";
} {
  const patterns: string[] = [];
  let severity: "low" | "medium" | "high" = "low";

  for (const pattern of DANGEROUS_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      patterns.push(...matches.slice(0, 5)); // Limit to first 5 matches
      severity = "high"; // Any dangerous pattern is high severity
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
      patterns.push("Prompt injection pattern");
      severity = severity === "high" ? "high" : "medium";
    }
  }

  return {
    dangerous: patterns.length > 0,
    patterns,
    severity,
  };
}

/**
 * Enhanced LLM output sanitization with additional security checks
 * Applied AFTER provider sanitization for defense-in-depth
 */
export function sanitizeLLMOutput(
  content: string,
  options: SanitizationOptions & {
    checkForHallucinations?: boolean;
    validateStructure?: boolean;
    maxJsonDepth?: number;
  } = {}
): SanitizationResult & {
  securityFlags: string[];
  hallucinationRisk: "low" | "medium" | "high";
  structuralIntegrity: boolean;
} {
  const baseResult = sanitizeLLMContent(content, options);
  const securityFlags: string[] = [];
  let hallucinationRisk: "low" | "medium" | "high" = "low";
  let structuralIntegrity = true;

  try {
    // Additional LLM-specific security checks
    const dangerousLLMPatterns = [
      // Attempted prompt injection in output
      /system:/gi,
      /assistant:/gi,
      /ignore\s+(previous|all)/gi,
      /developer\s+mode/gi,
      /jailbreak/gi,
      // Dangerous code patterns
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      // File system access attempts
      /fs\./gi,
      /require\s*\(/gi,
      /import\s*\(/gi,
      // Network access attempts
      /fetch\s*\(/gi,
      /XMLHttpRequest/gi,
      /axios\./gi,
    ];

    for (const pattern of dangerousLLMPatterns) {
      const matches = baseResult.sanitized.match(pattern);
      if (matches) {
        securityFlags.push(`Dangerous pattern detected: ${pattern.source}`);
        hallucinationRisk = "high";
      }
    }

    // Check for unusual confidence patterns that might indicate manipulation
    const confidencePatterns = [
      /confidence:\s*1\.0/gi,
      /confidence:\s*100%/gi,
      /absolutely\s+certain/gi,
      /definitely/gi,
      /unquestionably/gi,
    ];

    let confidenceOverclaims = 0;
    for (const pattern of confidencePatterns) {
      const matches = baseResult.sanitized.match(pattern);
      if (matches) {
        confidenceOverclaims += matches.length;
      }
    }

    if (confidenceOverclaims > 3) {
      securityFlags.push("Excessive confidence claims detected");
      hallucinationRisk = hallucinationRisk === "high" ? "high" : "medium";
    }

    // Check for structural integrity (JSON parsing if applicable)
    if (options.validateStructure) {
      try {
        // Try to parse as JSON if it looks like JSON
        if (
          baseResult.sanitized.trim().startsWith("{") ||
          baseResult.sanitized.trim().startsWith("[")
        ) {
          JSON.parse(baseResult.sanitized);
        }
      } catch (jsonError) {
        structuralIntegrity = false;
        securityFlags.push("JSON structure validation failed");
      }
    }

    // Check for maximum JSON depth if specified
    if (options.maxJsonDepth && options.validateStructure) {
      const depthCheck = checkJsonDepth(
        baseResult.sanitized,
        options.maxJsonDepth
      );
      if (!depthCheck.valid) {
        structuralIntegrity = false;
        securityFlags.push(
          `JSON depth exceeds limit (${options.maxJsonDepth})`
        );
      }
    }

    // Log security issues for monitoring
    if (securityFlags.length > 0) {
      logger.warn("LLM output sanitization detected security issues", {
        securityFlagsCount: securityFlags.length,
        hallucinationRisk,
        structuralIntegrity,
        contentLength: baseResult.sanitizedLength,
      });
    }
  } catch (error) {
    logger.error("LLM output sanitization error", {
      error: error instanceof Error ? error.message : error,
      contentLength: baseResult.sanitizedLength,
    });
    securityFlags.push("Sanitization processing failed");
    hallucinationRisk = "high";
    structuralIntegrity = false;
  }

  return {
    ...baseResult,
    securityFlags,
    hallucinationRisk,
    structuralIntegrity,
  };
}

/**
 * Check JSON depth to prevent deep nesting attacks
 */
function checkJsonDepth(
  jsonString: string,
  maxDepth: number
): { valid: boolean; actualDepth: number } {
  try {
    const parsed = JSON.parse(jsonString);
    const depth = calculateDepth(parsed);
    return { valid: depth <= maxDepth, actualDepth: depth };
  } catch {
    return { valid: false, actualDepth: 0 };
  }
}

/**
 * Calculate nesting depth of a JSON object
 */
function calculateDepth(obj: any, currentDepth = 0): number {
  if (typeof obj !== "object" || obj === null) {
    return currentDepth;
  }

  let maxChildDepth = currentDepth;
  for (const value of Object.values(obj)) {
    maxChildDepth = Math.max(
      maxChildDepth,
      calculateDepth(value, currentDepth + 1)
    );
  }

  return maxChildDepth;
}
