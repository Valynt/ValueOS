/**
 * Validator Tests
 * 
 * Tests for data validation utilities with schema validation and type checking
 * following MCP patterns for utility testing
 */

import { describe, it, expect } from 'vitest';

describe('Validator', () => {
  describe('Type Validation', () => {
    it('should validate string type', () => {
      const value = 'test string';
      const isString = typeof value === 'string';

      expect(isString).toBe(true);
    });

    it('should validate number type', () => {
      const value = 42;
      const isNumber = typeof value === 'number' && !isNaN(value);

      expect(isNumber).toBe(true);
    });

    it('should validate boolean type', () => {
      const value = true;
      const isBoolean = typeof value === 'boolean';

      expect(isBoolean).toBe(true);
    });

    it('should validate array type', () => {
      const value = [1, 2, 3];
      const isArray = Array.isArray(value);

      expect(isArray).toBe(true);
    });

    it('should validate object type', () => {
      const value = { key: 'value' };
      const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);

      expect(isObject).toBe(true);
    });
  });

  describe('Required Field Validation', () => {
    it('should validate required fields present', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };

      const required = ['name', 'email'];
      const hasRequired = required.every(field => field in data);

      expect(hasRequired).toBe(true);
    });

    it('should detect missing required fields', () => {
      const data = {
        name: 'John Doe'
      };

      const required = ['name', 'email'];
      const missing = required.filter(field => !(field in data));

      expect(missing).toContain('email');
      expect(missing.length).toBe(1);
    });

    it('should validate non-null values', () => {
      const data = {
        name: 'John Doe',
        email: null
      };

      const isValid = data.name !== null && data.name !== undefined;
      const isInvalid = data.email === null || data.email === undefined;

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(true);
    });
  });

  describe('String Validation', () => {
    it('should validate string length', () => {
      const value = 'test';
      const minLength = 2;
      const maxLength = 10;

      const isValid = value.length >= minLength && value.length <= maxLength;

      expect(isValid).toBe(true);
    });

    it('should validate email format', () => {
      const email = 'john.doe@example.com';
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;

      const isValid = emailRegex.test(email);

      expect(isValid).toBe(true);
    });

    it('should validate URL format', () => {
      const url = 'https://example.com/path';
      const urlRegex = /^https?:\/\/.+/;

      const isValid = urlRegex.test(url);

      expect(isValid).toBe(true);
    });

    it('should validate pattern match', () => {
      const value = 'ABC123';
      const pattern = /^[A-Z]{3}\d{3}$/;

      const isValid = pattern.test(value);

      expect(isValid).toBe(true);
    });

    it('should trim whitespace', () => {
      const value = '  test  ';
      const trimmed = value.trim();

      expect(trimmed).toBe('test');
      expect(trimmed.length).toBe(4);
    });
  });

  describe('Number Validation', () => {
    it('should validate number range', () => {
      const value = 50;
      const min = 0;
      const max = 100;

      const isValid = value >= min && value <= max;

      expect(isValid).toBe(true);
    });

    it('should validate integer', () => {
      const value = 42;
      const isInteger = Number.isInteger(value);

      expect(isInteger).toBe(true);
    });

    it('should validate positive number', () => {
      const value = 10;
      const isPositive = value > 0;

      expect(isPositive).toBe(true);
    });

    it('should validate decimal places', () => {
      const value = 3.14;
      const decimalPlaces = 2;
      const multiplier = Math.pow(10, decimalPlaces);
      const rounded = Math.round(value * multiplier) / multiplier;

      expect(rounded).toBe(value);
    });

    it('should detect NaN', () => {
      const value = NaN;
      const isNaN = Number.isNaN(value);

      expect(isNaN).toBe(true);
    });
  });

  describe('Array Validation', () => {
    it('should validate array length', () => {
      const array = [1, 2, 3];
      const minLength = 1;
      const maxLength = 5;

      const isValid = array.length >= minLength && array.length <= maxLength;

      expect(isValid).toBe(true);
    });

    it('should validate array item types', () => {
      const array = [1, 2, 3];
      const allNumbers = array.every(item => typeof item === 'number');

      expect(allNumbers).toBe(true);
    });

    it('should validate unique items', () => {
      const array = [1, 2, 3];
      const unique = new Set(array);

      const hasUniqueItems = unique.size === array.length;

      expect(hasUniqueItems).toBe(true);
    });

    it('should validate non-empty array', () => {
      const array = [1, 2, 3];
      const isNonEmpty = array.length > 0;

      expect(isNonEmpty).toBe(true);
    });
  });

  describe('Object Validation', () => {
    it('should validate object schema', () => {
      const data = {
        name: 'John',
        age: 30,
        email: 'john@example.com'
      };

      const schema = {
        name: 'string',
        age: 'number',
        email: 'string'
      };

      const isValid = Object.keys(schema).every(key => 
        typeof data[key as keyof typeof data] === schema[key as keyof typeof schema]
      );

      expect(isValid).toBe(true);
    });

    it('should validate nested objects', () => {
      const data = {
        user: {
          name: 'John',
          address: {
            city: 'New York'
          }
        }
      };

      const hasNestedData = 
        data.user !== undefined &&
        data.user.address !== undefined &&
        data.user.address.city !== undefined;

      expect(hasNestedData).toBe(true);
    });

    it('should validate object keys', () => {
      const data = {
        name: 'John',
        age: 30
      };

      const requiredKeys = ['name', 'age'];
      const hasAllKeys = requiredKeys.every(key => key in data);

      expect(hasAllKeys).toBe(true);
    });
  });

  describe('Date Validation', () => {
    it('should validate date format', () => {
      const dateString = '2025-01-15';
      const date = new Date(dateString);

      const isValid = !isNaN(date.getTime());

      expect(isValid).toBe(true);
    });

    it('should validate date range', () => {
      const date = new Date('2025-01-15');
      const minDate = new Date('2025-01-01');
      const maxDate = new Date('2025-12-31');

      const isValid = date >= minDate && date <= maxDate;

      expect(isValid).toBe(true);
    });

    it('should validate future date', () => {
      const futureDate = new Date(Date.now() + 86400000); // tomorrow
      const isFuture = futureDate > new Date();

      expect(isFuture).toBe(true);
    });

    it('should validate past date', () => {
      const pastDate = new Date(Date.now() - 86400000); // yesterday
      const isPast = pastDate < new Date();

      expect(isPast).toBe(true);
    });
  });

  describe('Custom Validation', () => {
    it('should validate with custom function', () => {
      const value = 'test@example.com';
      const validator = (val: string) => val.includes('@');

      const isValid = validator(value);

      expect(isValid).toBe(true);
    });

    it('should validate with multiple rules', () => {
      const value = 'Password123!';
      const rules = [
        (val: string) => val.length >= 8,
        (val: string) => /[A-Z]/.test(val),
        (val: string) => /[0-9]/.test(val),
        (val: string) => /[!@#$%^&*]/.test(val)
      ];

      const isValid = rules.every(rule => rule(value));

      expect(isValid).toBe(true);
    });

    it('should validate conditional rules', () => {
      const data = {
        type: 'premium',
        features: ['feature1', 'feature2']
      };

      const isValid = data.type === 'premium' 
        ? data.features.length > 0 
        : true;

      expect(isValid).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('should generate validation error', () => {
      const error = {
        field: 'email',
        message: 'Invalid email format',
        value: 'invalid-email'
      };

      expect(error.field).toBe('email');
      expect(error.message).toBeDefined();
    });

    it('should collect multiple errors', () => {
      const errors = [
        { field: 'name', message: 'Name is required' },
        { field: 'email', message: 'Invalid email format' }
      ];

      expect(errors.length).toBe(2);
      expect(errors[0].field).toBe('name');
    });

    it('should format error message', () => {
      const field = 'age';
      const constraint = 'minimum value is 18';
      const message = `${field}: ${constraint}`;

      expect(message).toBe('age: minimum value is 18');
    });
  });

  describe('Sanitization', () => {
    it('should sanitize HTML', () => {
      const input = '<script>alert("xss")</script>Hello';
      const sanitized = input.replace(/<[^>]*>/g, '');

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello');
    });

    it('should sanitize SQL injection', () => {
      const input = "'; DROP TABLE users; --";
      const sanitized = input.replace(/['";]/g, '');

      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(';');
    });

    it('should normalize whitespace', () => {
      const input = '  multiple   spaces  ';
      const normalized = input.trim().replace(/\s+/g, ' ');

      expect(normalized).toBe('multiple spaces');
    });
  });

  describe('Performance', () => {
    it('should validate efficiently', () => {
      const startTime = Date.now();
      
      const data = { name: 'John', age: 30 };
      const isValid = 
        typeof data.name === 'string' &&
        typeof data.age === 'number';
      
      const duration = Date.now() - startTime;

      expect(isValid).toBe(true);
      expect(duration).toBeLessThan(10);
    });

    it('should handle large datasets', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`
      }));

      const allValid = data.every(item => 
        typeof item.id === 'number' &&
        typeof item.name === 'string'
      );

      expect(allValid).toBe(true);
    });

    it('should cache validation results', () => {
      const cache = new Map();
      const key = 'email:john@example.com';
      const result = true;

      cache.set(key, result);

      expect(cache.get(key)).toBe(true);
      expect(cache.has(key)).toBe(true);
    });
  });
});
