/**
 * SDUI Test Setup
 *
 * Mocks and configuration for SDUI tests
 */

import { vi, beforeEach } from "vitest";

// Mock DOMPurify for security tests
vi.mock("dompurify", () => {
  return {
    default: {
      sanitize: vi.fn((value: string, config?: any) => {
        // Simple mock that removes script tags and event handlers
        if (typeof value !== "string") return value;

        let sanitized = value;

        // Remove script tags
        sanitized = sanitized.replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          "",
        );

        // Remove iframe tags
        sanitized = sanitized.replace(
          /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
          "",
        );

        // Remove event handlers
        sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
        sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, "");

        // Remove javascript: URLs completely
        sanitized = sanitized.replace(/javascript:[^"'\s]*/gi, "");
        sanitized = sanitized.replace(/["']javascript:[^"']*["']/gi, '""');

        // Remove data: URLs with scripts
        sanitized = sanitized.replace(/data:text\/html[^"'\s]*/gi, "");

        // For strict mode (no tags allowed)
        if (config?.ALLOWED_TAGS?.length === 0) {
          sanitized = sanitized.replace(/<[^>]*>/g, "");
        }

        return sanitized;
      }),
      isSupported: true,
    },
  };
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
