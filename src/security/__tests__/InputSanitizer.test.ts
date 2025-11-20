/**
 * Input Sanitizer Tests
 */

import { describe, it, expect } from 'vitest';
import {
  encodeHtml,
  sanitizeHtml,
  sanitizeString,
  sanitizeUrl,
  sanitizeFilePath,
  validateEmail,
  validatePhoneNumber,
  sanitizeJson,
  validateFileUpload,
} from '../InputSanitizer';

describe('InputSanitizer', () => {
  describe('encodeHtml', () => {
    it('should encode HTML entities', () => {
      const result = encodeHtml('<script>alert("XSS")</script>');
      
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should encode special characters', () => {
      const result = encodeHtml('Test & "quotes" <tags>');
      
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const result = sanitizeHtml('<p>Hello</p><script>alert("XSS")</script>');
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove dangerous attributes', () => {
      const result = sanitizeHtml('<div onclick="alert(\'XSS\')">Click me</div>');
      
      expect(result).not.toContain('onclick');
    });

    it('should allow safe HTML when specified', () => {
      const result = sanitizeHtml('<p>Hello <strong>World</strong></p>', {
        allowHtml: true,
        allowedTags: ['p', 'strong'],
      });
      
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
    });

    it('should encode all HTML when not allowed', () => {
      const result = sanitizeHtml('<p>Hello</p>', { allowHtml: false });
      
      expect(result).toBe('&lt;p&gt;Hello&lt;&#x2F;p&gt;');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(20000);
      const result = sanitizeHtml(longString, { maxLength: 1000 });
      
      expect(result).toHaveLength(1000);
    });
  });

  describe('sanitizeString', () => {
    it('should detect SQL injection attempts', () => {
      const result = sanitizeString("'; DROP TABLE users; --");
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect command injection attempts', () => {
      const result = sanitizeString('test; rm -rf /');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should allow safe strings', () => {
      const result = sanitizeString('Hello, World!');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow HTTP and HTTPS URLs', () => {
      const result1 = sanitizeUrl('http://example.com');
      const result2 = sanitizeUrl('https://example.com');
      
      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });

    it('should reject javascript: URLs', () => {
      const result = sanitizeUrl('javascript:alert("XSS")');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('JavaScript URLs are not allowed');
    });

    it('should warn about data: URLs', () => {
      const result = sanitizeUrl('data:text/html,<script>alert("XSS")</script>');
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject invalid URLs', () => {
      const result = sanitizeUrl('not a url');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL format');
    });
  });

  describe('sanitizeFilePath', () => {
    it('should detect path traversal attempts', () => {
      const result = sanitizeFilePath('../../../etc/passwd');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Path contains directory traversal patterns');
    });

    it('should warn about absolute paths', () => {
      const result = sanitizeFilePath('/etc/passwd');
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should allow safe relative paths', () => {
      const result = sanitizeFilePath('documents/file.txt');
      
      expect(result.valid).toBe(true);
    });

    it('should remove dangerous characters', () => {
      const result = sanitizeFilePath('file<>:"|?*.txt');
      
      expect(result.sanitized).not.toContain('<');
      expect(result.sanitized).not.toContain('>');
      expect(result.sanitized).not.toContain(':');
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const result = validateEmail('user@example.com');
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const result = validateEmail('not-an-email');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should normalize email addresses', () => {
      const result = validateEmail('  User@Example.COM  ');
      
      expect(result.sanitized).toBe('user@example.com');
    });

    it('should warn about consecutive dots', () => {
      const result = validateEmail('user..name@example.com');
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should accept valid phone numbers', () => {
      const result = validatePhoneNumber('+1234567890');
      
      expect(result.valid).toBe(true);
    });

    it('should clean phone number formatting', () => {
      const result = validatePhoneNumber('(123) 456-7890');
      
      expect(result.sanitized).toBe('1234567890');
    });

    it('should reject invalid phone numbers', () => {
      const result = validatePhoneNumber('abc123');
      
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeJson', () => {
    it('should parse and sanitize valid JSON', () => {
      const result = sanitizeJson('{"name": "John", "age": 30}');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeTruthy();
    });

    it('should reject invalid JSON', () => {
      const result = sanitizeJson('{invalid json}');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid JSON format');
    });

    it('should detect excessive object depth', () => {
      const deepObject = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: {} } } } } } } } } } } };
      const result = sanitizeJson(JSON.stringify(deepObject));
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('depth');
    });

    it('should sanitize string values in JSON', () => {
      const result = sanitizeJson('{"html": "<script>alert(\\"XSS\\")</script>"}');
      
      expect(result.sanitized).not.toContain('<script>');
    });
  });

  describe('validateFileUpload', () => {
    it('should accept allowed file types', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const result = validateFileUpload(file);
      
      expect(result.valid).toBe(true);
    });

    it('should reject disallowed file types', () => {
      const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });
      const result = validateFileUpload(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not allowed');
    });

    it('should reject files that are too large', () => {
      const largeContent = new Array(20 * 1024 * 1024).fill('a').join(''); // 20MB
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const result = validateFileUpload(file);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum');
    });

    it('should sanitize file names', () => {
      const file = new File(['content'], '../../../etc/passwd.jpg', { type: 'image/jpeg' });
      const result = validateFileUpload(file);
      
      expect(result.sanitized).not.toContain('../');
    });
  });
});
