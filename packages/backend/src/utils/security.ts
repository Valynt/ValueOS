/**
 * Backend Security Utilities
 *
 * Security functions for input sanitization, error handling, and validation.
 */

import { createLogger } from "@shared/lib/logger";

import { llmSanitizer } from "../services/LLMSanitizer.js"

const logger = createLogger({ component: "SecurityUtils" });

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
}

export const defaultPasswordPolicy: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
};

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password against policy
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = defaultPasswordPolicy
): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must include at least one uppercase letter");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must include at least one lowercase letter");
  }
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must include at least one number");
  }
  if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include at least one symbol");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Log the full error internally
    logger.debug("Sanitizing error for user response", { originalError: error.message });
    return "Request failed. Please try again or contact support.";
  }
  return "An unexpected error occurred.";
}

/**
 * Sanitize LLM content to prevent XSS
 */
export function sanitizeLLMContent(content: string): string {
  if (!content) return "";
  const withoutScripts = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  return withoutScripts
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitize and detect prompt injection in agent input
 * Uses the backend LLMSanitizer for comprehensive sanitization
 */
export function sanitizeAgentInput(input: any): {
  sanitized: any;
  safe: boolean;
  violations: string[];
  severity: "none" | "low" | "medium" | "high" | "critical";
} {
  try {
    return llmSanitizer.sanitizeAgentInput(input);
  } catch (error) {
    logger.error("Error in sanitizeAgentInput", { error });
    return {
      sanitized: input,
      safe: false,
      violations: ["Sanitization error"],
      severity: "high",
    };
  }
}

/**
 * Sanitize user input for general use
 */
export function sanitizeUserInput(value: string, maxLength = 2000): string {
  if (!value) return "";

  const INPUT_SANITIZE_PATTERN = /<[^>]*>|\s{2,}/g;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(INPUT_SANITIZE_PATTERN, (match) => (match.startsWith("<") ? "" : " "))
    .trim();
}
