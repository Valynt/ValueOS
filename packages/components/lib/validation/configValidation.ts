/**
 * Configuration validation rules used by admin settings components.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const configValidation = {
  maxUsers: (value: number): ValidationResult => {
    if (value < 1) {
      return { valid: false, error: "Must be at least 1 user" };
    }
    if (value > 10000) {
      return { valid: false, error: "Cannot exceed 10,000 users" };
    }
    return { valid: true };
  },

  maxStorageGB: (value: number): ValidationResult => {
    if (value < 1) {
      return { valid: false, error: "Must be at least 1 GB" };
    }
    if (value > 10000) {
      return { valid: false, error: "Cannot exceed 10,000 GB" };
    }
    return { valid: true };
  },

  logoUrl: (value: string): ValidationResult => {
    if (!value) return { valid: true };

    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) {
        return { valid: false, error: "Must be a valid HTTP(S) URL" };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "Must be a valid URL" };
    }
  },

  primaryColor: (value: string): ValidationResult => {
    if (!value) return { valid: true };

    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(value)) {
      return { valid: false, error: "Must be a valid hex color (e.g., #FF5733)" };
    }
    return { valid: true };
  },

  monthlyBudget: (value: number): ValidationResult => {
    if (value < 0) {
      return { valid: false, error: "Cannot be negative" };
    }
    if (value > 1000000) {
      return { valid: false, error: "Cannot exceed $1,000,000" };
    }
    return { valid: true };
  },

  alertThreshold: (value: number): ValidationResult => {
    if (value < 0 || value > 1) {
      return { valid: false, error: "Must be between 0 and 1" };
    }
    return { valid: true };
  },
};

export type ValidationKey = keyof typeof configValidation;
