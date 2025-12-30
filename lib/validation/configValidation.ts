/**
 * Configuration Validation Rules
 * 
 * Inline validation for configuration settings
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const configValidation = {
  // Organization Settings
  maxUsers: (value: number): ValidationResult => {
    if (value < 1) {
      return { valid: false, error: 'Must be at least 1 user' };
    }
    if (value > 10000) {
      return { valid: false, error: 'Cannot exceed 10,000 users' };
    }
    return { valid: true };
  },

  maxStorageGB: (value: number): ValidationResult => {
    if (value < 1) {
      return { valid: false, error: 'Must be at least 1 GB' };
    }
    if (value > 10000) {
      return { valid: false, error: 'Cannot exceed 10,000 GB' };
    }
    return { valid: true };
  },

  companyName: (value: string): ValidationResult => {
    if (!value || value.trim().length === 0) {
      return { valid: false, error: 'Company name is required' };
    }
    if (value.length > 100) {
      return { valid: false, error: 'Cannot exceed 100 characters' };
    }
    return { valid: true };
  },

  logoUrl: (value: string): ValidationResult => {
    if (!value) return { valid: true }; // Optional field
    
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { valid: false, error: 'Must be a valid HTTP(S) URL' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Must be a valid URL' };
    }
  },

  primaryColor: (value: string): ValidationResult => {
    if (!value) return { valid: true }; // Optional field
    
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(value)) {
      return { valid: false, error: 'Must be a valid hex color (e.g., #FF5733)' };
    }
    return { valid: true };
  },

  region: (value: string): ValidationResult => {
    const validRegions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
    if (!validRegions.includes(value)) {
      return { valid: false, error: 'Invalid region' };
    }
    return { valid: true };
  },

  // AI Settings
  defaultModel: (value: string): ValidationResult => {
    if (!value || value.trim().length === 0) {
      return { valid: false, error: 'Default model is required' };
    }
    return { valid: true };
  },

  maxTokens: (value: number): ValidationResult => {
    if (value < 1) {
      return { valid: false, error: 'Must be at least 1 token' };
    }
    if (value > 128000) {
      return { valid: false, error: 'Cannot exceed 128,000 tokens' };
    }
    return { valid: true };
  },

  temperature: (value: number): ValidationResult => {
    if (value < 0) {
      return { valid: false, error: 'Must be at least 0' };
    }
    if (value > 2) {
      return { valid: false, error: 'Cannot exceed 2.0' };
    }
    return { valid: true };
  },

  monthlyBudget: (value: number): ValidationResult => {
    if (value < 0) {
      return { valid: false, error: 'Cannot be negative' };
    }
    if (value > 1000000) {
      return { valid: false, error: 'Cannot exceed $1,000,000' };
    }
    return { valid: true };
  },

  alertThreshold: (value: number): ValidationResult => {
    if (value < 0 || value > 1) {
      return { valid: false, error: 'Must be between 0 and 1' };
    }
    return { valid: true };
  },

  apiKey: (value: string): ValidationResult => {
    if (!value) return { valid: true }; // Optional field
    
    if (value.length < 20) {
      return { valid: false, error: 'API key appears too short' };
    }
    if (value.length > 200) {
      return { valid: false, error: 'API key appears too long' };
    }
    return { valid: true };
  },

  webhookUrl: (value: string): ValidationResult => {
    if (!value) return { valid: true }; // Optional field
    
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { valid: false, error: 'Must be a valid HTTP(S) URL' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Must be a valid URL' };
    }
  }
};

export type ValidationKey = keyof typeof configValidation;
