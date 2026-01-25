/**
 * Safety and security utilities for agents
 */

import { metrics } from "./metrics.js";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export class SafetyGuard {
  private blockedKeywords: string[] = [
    // Placeholder for harmful content keywords
    "ignore previous instructions",
    "system override",
  ];

  private injectionPatterns: RegExp[] = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
    /javascript:/gim,
    /vbscript:/gim,
    /onload=/gim,
    /onerror=/gim,
  ];

  /**
   * Validate user input for safety
   */
  validateInput(input: string, agentType: string = "unknown"): ValidationResult {
    const lowerInput = input.toLowerCase();

    // Check for blocked keywords (Prompt Injection)
    for (const keyword of this.blockedKeywords) {
      if (lowerInput.includes(keyword)) {
        metrics.agentSafetyViolations.inc({
          agent_type: agentType,
          violation_type: "prompt_injection",
          source: "input",
        });
        return { valid: false, reason: "Input contains blocked keywords" };
      }
    }

    // Check for injection patterns
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(input)) {
        metrics.agentSafetyViolations.inc({
          agent_type: agentType,
          violation_type: "injection_attempt",
          source: "input",
        });
        return { valid: false, reason: "Input contains potentially unsafe patterns" };
      }
    }

    return { valid: true };
  }

  /**
   * Validate agent output for safety
   */
  validateOutput(output: string, agentType: string = "unknown"): ValidationResult {
    // Check for harmful content
    // This is a simplified check. Real systems would use a specialized model.
    const lowerOutput = output.toLowerCase();
    for (const keyword of this.blockedKeywords) {
      if (lowerOutput.includes(keyword)) {
        metrics.agentSafetyViolations.inc({
          agent_type: agentType,
          violation_type: "harmful_content",
          source: "output",
        });
        return { valid: false, reason: "Output contains blocked keywords" };
      }
    }

    return { valid: true };
  }

  /**
   * Basic text sanitization
   */
  sanitize(text: string): string {
    let sanitized = text;
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, "");
    // Normalize newlines
    sanitized = sanitized.replace(/\r\n/g, "\n");
    return sanitized;
  }
}
