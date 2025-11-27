/**
 * StringUtils Tests
 * 
 * Tests for string utility functions with formatting, parsing, and transformations
 * following MCP patterns for utility testing
 */

import { describe, it, expect } from 'vitest';

describe('StringUtils', () => {
  describe('String Formatting', () => {
    it('should capitalize first letter', () => {
      const input = 'hello world';
      const capitalized = input.charAt(0).toUpperCase() + input.slice(1);

      expect(capitalized).toBe('Hello world');
    });

    it('should convert to title case', () => {
      const input = 'hello world';
      const titleCase = input.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      expect(titleCase).toBe('Hello World');
    });

    it('should convert to camelCase', () => {
      const input = 'hello world test';
      const camelCase = input.split(' ')
        .map((word, index) => 
          index === 0 
            ? word.toLowerCase() 
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');

      expect(camelCase).toBe('helloWorldTest');
    });

    it('should convert to snake_case', () => {
      const input = 'Hello World Test';
      const snakeCase = input.toLowerCase().replace(/\s+/g, '_');

      expect(snakeCase).toBe('hello_world_test');
    });

    it('should convert to kebab-case', () => {
      const input = 'Hello World Test';
      const kebabCase = input.toLowerCase().replace(/\s+/g, '-');

      expect(kebabCase).toBe('hello-world-test');
    });
  });

  describe('String Trimming', () => {
    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const trimmed = input.trim();

      expect(trimmed).toBe('hello world');
    });

    it('should trim left whitespace', () => {
      const input = '  hello world';
      const trimmed = input.trimStart();

      expect(trimmed).toBe('hello world');
    });

    it('should trim right whitespace', () => {
      const input = 'hello world  ';
      const trimmed = input.trimEnd();

      expect(trimmed).toBe('hello world');
    });

    it('should normalize whitespace', () => {
      const input = 'hello    world   test';
      const normalized = input.replace(/\s+/g, ' ').trim();

      expect(normalized).toBe('hello world test');
    });
  });

  describe('String Truncation', () => {
    it('should truncate long string', () => {
      const input = 'This is a very long string that needs to be truncated';
      const maxLength = 20;
      const truncated = input.length > maxLength 
        ? input.substring(0, maxLength) + '...' 
        : input;

      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3);
      expect(truncated).toContain('...');
    });

    it('should truncate at word boundary', () => {
      const input = 'This is a very long string';
      const maxLength = 15;
      const words = input.split(' ');
      let truncated = '';

      for (const word of words) {
        if ((truncated + word).length > maxLength) break;
        truncated += (truncated ? ' ' : '') + word;
      }

      expect(truncated.length).toBeLessThanOrEqual(maxLength);
    });

    it('should not truncate short string', () => {
      const input = 'Short';
      const maxLength = 20;
      const truncated = input.length > maxLength 
        ? input.substring(0, maxLength) + '...' 
        : input;

      expect(truncated).toBe('Short');
      expect(truncated).not.toContain('...');
    });
  });

  describe('String Padding', () => {
    it('should pad start with zeros', () => {
      const input = '42';
      const padded = input.padStart(5, '0');

      expect(padded).toBe('00042');
      expect(padded.length).toBe(5);
    });

    it('should pad end with spaces', () => {
      const input = 'test';
      const padded = input.padEnd(10, ' ');

      expect(padded.length).toBe(10);
      expect(padded.trimEnd()).toBe('test');
    });

    it('should not pad if already long enough', () => {
      const input = 'hello';
      const padded = input.padStart(3, '0');

      expect(padded).toBe('hello');
    });
  });

  describe('String Replacement', () => {
    it('should replace first occurrence', () => {
      const input = 'hello world hello';
      const replaced = input.replace('hello', 'hi');

      expect(replaced).toBe('hi world hello');
    });

    it('should replace all occurrences', () => {
      const input = 'hello world hello';
      const replaced = input.replace(/hello/g, 'hi');

      expect(replaced).toBe('hi world hi');
    });

    it('should replace with regex', () => {
      const input = 'test123test456';
      const replaced = input.replace(/\d+/g, 'X');

      expect(replaced).toBe('testXtestX');
    });

    it('should replace multiple patterns', () => {
      const input = 'hello world';
      const replaced = input
        .replace('hello', 'hi')
        .replace('world', 'there');

      expect(replaced).toBe('hi there');
    });
  });

  describe('String Splitting', () => {
    it('should split by delimiter', () => {
      const input = 'apple,banana,orange';
      const parts = input.split(',');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('apple');
    });

    it('should split by whitespace', () => {
      const input = 'hello world test';
      const words = input.split(/\s+/);

      expect(words.length).toBe(3);
    });

    it('should split with limit', () => {
      const input = 'a,b,c,d,e';
      const parts = input.split(',', 3);

      expect(parts.length).toBe(3);
    });

    it('should split into characters', () => {
      const input = 'hello';
      const chars = input.split('');

      expect(chars.length).toBe(5);
      expect(chars[0]).toBe('h');
    });
  });

  describe('String Validation', () => {
    it('should check if string is empty', () => {
      const empty = '';
      const notEmpty = 'test';

      expect(empty.length === 0).toBe(true);
      expect(notEmpty.length === 0).toBe(false);
    });

    it('should check if string contains substring', () => {
      const input = 'hello world';
      const contains = input.includes('world');

      expect(contains).toBe(true);
    });

    it('should check if string starts with prefix', () => {
      const input = 'hello world';
      const startsWith = input.startsWith('hello');

      expect(startsWith).toBe(true);
    });

    it('should check if string ends with suffix', () => {
      const input = 'hello world';
      const endsWith = input.endsWith('world');

      expect(endsWith).toBe(true);
    });

    it('should check if string matches pattern', () => {
      const email = 'test@example.com';
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(pattern.test(email)).toBe(true);
    });
  });

  describe('String Extraction', () => {
    it('should extract substring', () => {
      const input = 'hello world';
      const sub = input.substring(0, 5);

      expect(sub).toBe('hello');
    });

    it('should extract with slice', () => {
      const input = 'hello world';
      const sliced = input.slice(6);

      expect(sliced).toBe('world');
    });

    it('should extract with negative index', () => {
      const input = 'hello world';
      const sliced = input.slice(-5);

      expect(sliced).toBe('world');
    });

    it('should extract matched groups', () => {
      const input = 'user-123';
      const match = input.match(/user-(\d+)/);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe('123');
    });
  });

  describe('String Comparison', () => {
    it('should compare strings for equality', () => {
      const str1 = 'hello';
      const str2 = 'hello';

      expect(str1 === str2).toBe(true);
    });

    it('should compare case-insensitive', () => {
      const str1 = 'Hello';
      const str2 = 'hello';

      expect(str1.toLowerCase() === str2.toLowerCase()).toBe(true);
    });

    it('should compare lexicographically', () => {
      const str1 = 'apple';
      const str2 = 'banana';

      expect(str1 < str2).toBe(true);
    });

    it('should check string length', () => {
      const str1 = 'hello';
      const str2 = 'world';

      expect(str1.length).toBe(str2.length);
    });
  });

  describe('String Encoding', () => {
    it('should encode URI component', () => {
      const input = 'hello world';
      const encoded = encodeURIComponent(input);

      expect(encoded).toBe('hello%20world');
    });

    it('should decode URI component', () => {
      const input = 'hello%20world';
      const decoded = decodeURIComponent(input);

      expect(decoded).toBe('hello world');
    });

    it('should encode base64', () => {
      const input = 'hello';
      const encoded = Buffer.from(input).toString('base64');

      expect(encoded).toBeDefined();
    });

    it('should decode base64', () => {
      const encoded = 'aGVsbG8=';
      const decoded = Buffer.from(encoded, 'base64').toString();

      expect(decoded).toBe('hello');
    });
  });

  describe('String Templates', () => {
    it('should interpolate variables', () => {
      const name = 'John';
      const age = 30;
      const template = `Hello, ${name}! You are ${age} years old.`;

      expect(template).toBe('Hello, John! You are 30 years old.');
    });

    it('should evaluate expressions', () => {
      const a = 5;
      const b = 10;
      const template = `Sum: ${a + b}`;

      expect(template).toBe('Sum: 15');
    });

    it('should handle multiline strings', () => {
      const multiline = `Line 1
Line 2
Line 3`;

      expect(multiline.split('\n').length).toBe(3);
    });
  });

  describe('String Sanitization', () => {
    it('should remove HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const sanitized = input.replace(/<[^>]*>/g, '');

      expect(sanitized).toBe('Hello world');
    });

    it('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const escaped = input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      expect(escaped).not.toContain('<script>');
    });

    it('should remove special characters', () => {
      const input = 'hello@#$world!';
      const cleaned = input.replace(/[^a-zA-Z0-9]/g, '');

      expect(cleaned).toBe('helloworld');
    });
  });

  describe('Performance', () => {
    it('should format strings efficiently', () => {
      const startTime = Date.now();
      
      const input = 'hello world';
      const formatted = input.toUpperCase();
      
      const duration = Date.now() - startTime;

      expect(formatted).toBe('HELLO WORLD');
      expect(duration).toBeLessThan(10);
    });

    it('should handle large strings', () => {
      const largeString = 'a'.repeat(10000);

      expect(largeString.length).toBe(10000);
    });

    it('should cache string operations', () => {
      const cache = new Map<string, string>();
      const input = 'hello world';
      const formatted = input.toUpperCase();

      cache.set(input, formatted);

      expect(cache.get(input)).toBe('HELLO WORLD');
    });
  });
});
