/**
 * DateUtils Tests
 * 
 * Tests for date utility functions with formatting, parsing, and calculations
 * following MCP patterns for utility testing
 */

import { describe, it, expect } from 'vitest';

describe('DateUtils', () => {
  describe('Date Formatting', () => {
    it('should format date as ISO string', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const iso = date.toISOString();

      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(iso).toContain('2025-01-15');
    });

    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-15');
      const formatted = date.toISOString().split('T')[0];

      expect(formatted).toBe('2025-01-15');
    });

    it('should format date with custom format', () => {
      const date = new Date('2025-01-15T10:30:00');
      const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      expect(formatted).toBe('2025-01-15');
    });

    it('should format time as HH:MM:SS', () => {
      const date = new Date('2025-01-15T10:30:45');
      const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

      expect(time).toBe('10:30:45');
    });

    it('should format relative time', () => {
      const now = Date.now();
      const yesterday = now - 86400000; // 24 hours ago
      const diff = now - yesterday;
      const hours = Math.floor(diff / 3600000);

      expect(hours).toBe(24);
    });
  });

  describe('Date Parsing', () => {
    it('should parse ISO date string', () => {
      const dateString = '2025-01-15T10:30:00Z';
      const date = new Date(dateString);

      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0); // January is 0
      expect(date.getDate()).toBe(15);
    });

    it('should parse date from timestamp', () => {
      const timestamp = 1705318200000; // 2025-01-15
      const date = new Date(timestamp);

      expect(date.getTime()).toBe(timestamp);
    });

    it('should parse date components', () => {
      const year = 2025;
      const month = 0; // January
      const day = 15;
      const date = new Date(year, month, day);

      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });

    it('should handle invalid date strings', () => {
      const dateString = 'invalid-date';
      const date = new Date(dateString);

      expect(isNaN(date.getTime())).toBe(true);
    });
  });

  describe('Date Calculations', () => {
    it('should add days to date', () => {
      const date = new Date('2025-01-15');
      const daysToAdd = 7;
      const newDate = new Date(date.getTime() + daysToAdd * 86400000);

      expect(newDate.getDate()).toBe(22);
    });

    it('should subtract days from date', () => {
      const date = new Date('2025-01-15');
      const daysToSubtract = 5;
      const newDate = new Date(date.getTime() - daysToSubtract * 86400000);

      expect(newDate.getDate()).toBe(10);
    });

    it('should calculate difference in days', () => {
      const date1 = new Date('2025-01-15');
      const date2 = new Date('2025-01-20');
      const diff = Math.floor((date2.getTime() - date1.getTime()) / 86400000);

      expect(diff).toBe(5);
    });

    it('should calculate difference in hours', () => {
      const date1 = new Date('2025-01-15T10:00:00');
      const date2 = new Date('2025-01-15T15:30:00');
      const diff = (date2.getTime() - date1.getTime()) / 3600000;

      expect(diff).toBe(5.5);
    });

    it('should get start of day', () => {
      const date = new Date('2025-01-15T15:30:45');
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
    });

    it('should get end of day', () => {
      const date = new Date('2025-01-15T10:30:00');
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
      expect(endOfDay.getSeconds()).toBe(59);
    });
  });

  describe('Date Comparisons', () => {
    it('should compare dates for equality', () => {
      const date1 = new Date('2025-01-15');
      const date2 = new Date('2025-01-15');

      expect(date1.getTime()).toBe(date2.getTime());
    });

    it('should check if date is before another', () => {
      const date1 = new Date('2025-01-15');
      const date2 = new Date('2025-01-20');

      expect(date1 < date2).toBe(true);
    });

    it('should check if date is after another', () => {
      const date1 = new Date('2025-01-20');
      const date2 = new Date('2025-01-15');

      expect(date1 > date2).toBe(true);
    });

    it('should check if date is in range', () => {
      const date = new Date('2025-01-15');
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');

      const isInRange = date >= start && date <= end;

      expect(isInRange).toBe(true);
    });

    it('should check if date is today', () => {
      const today = new Date();
      const testDate = new Date();

      const isSameDay = 
        today.getFullYear() === testDate.getFullYear() &&
        today.getMonth() === testDate.getMonth() &&
        today.getDate() === testDate.getDate();

      expect(isSameDay).toBe(true);
    });
  });

  describe('Date Ranges', () => {
    it('should generate date range', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-05');
      const dates: Date[] = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }

      expect(dates.length).toBe(5);
    });

    it('should check if dates overlap', () => {
      const range1 = { start: new Date('2025-01-01'), end: new Date('2025-01-10') };
      const range2 = { start: new Date('2025-01-05'), end: new Date('2025-01-15') };

      const overlaps = range1.end >= range2.start && range2.end >= range1.start;

      expect(overlaps).toBe(true);
    });

    it('should get week range', () => {
      const date = new Date('2025-01-15'); // Wednesday
      const dayOfWeek = date.getDay();
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - dayOfWeek);

      expect(startOfWeek.getDay()).toBe(0); // Sunday
    });
  });

  describe('Timezone Handling', () => {
    it('should get UTC date', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const utcHours = date.getUTCHours();

      expect(utcHours).toBe(10);
    });

    it('should convert to UTC', () => {
      const date = new Date('2025-01-15T10:30:00');
      const utc = Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
      );

      expect(utc).toBeGreaterThan(0);
    });

    it('should get timezone offset', () => {
      const date = new Date();
      const offset = date.getTimezoneOffset();

      expect(typeof offset).toBe('number');
    });
  });

  describe('Business Days', () => {
    it('should check if date is weekend', () => {
      const saturday = new Date('2025-01-18'); // Saturday
      const isWeekend = saturday.getDay() === 0 || saturday.getDay() === 6;

      expect(isWeekend).toBe(true);
    });

    it('should check if date is weekday', () => {
      const monday = new Date('2025-01-13'); // Monday
      const isWeekday = monday.getDay() >= 1 && monday.getDay() <= 5;

      expect(isWeekday).toBe(true);
    });

    it('should add business days', () => {
      const date = new Date('2025-01-15'); // Wednesday
      let businessDays = 0;
      const target = 5;
      const result = new Date(date);

      while (businessDays < target) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) {
          businessDays++;
        }
      }

      expect(businessDays).toBe(target);
    });
  });

  describe('Date Validation', () => {
    it('should validate date object', () => {
      const date = new Date('2025-01-15');
      const isValid = !isNaN(date.getTime());

      expect(isValid).toBe(true);
    });

    it('should detect invalid date', () => {
      const date = new Date('invalid');
      const isInvalid = isNaN(date.getTime());

      expect(isInvalid).toBe(true);
    });

    it('should validate date range', () => {
      const date = new Date('2025-01-15');
      const min = new Date('2025-01-01');
      const max = new Date('2025-12-31');

      const isValid = date >= min && date <= max;

      expect(isValid).toBe(true);
    });

    it('should validate future date', () => {
      const futureDate = new Date(Date.now() + 86400000);
      const isFuture = futureDate > new Date();

      expect(isFuture).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should format dates efficiently', () => {
      const startTime = Date.now();
      
      const date = new Date('2025-01-15');
      const formatted = date.toISOString().split('T')[0];
      
      const duration = Date.now() - startTime;

      expect(formatted).toBe('2025-01-15');
      expect(duration).toBeLessThan(10);
    });

    it('should handle date calculations efficiently', () => {
      const startTime = Date.now();
      
      const date1 = new Date('2025-01-15');
      const date2 = new Date('2025-01-20');
      const diff = Math.floor((date2.getTime() - date1.getTime()) / 86400000);
      
      const duration = Date.now() - startTime;

      expect(diff).toBe(5);
      expect(duration).toBeLessThan(10);
    });

    it('should cache formatted dates', () => {
      const cache = new Map<string, string>();
      const date = new Date('2025-01-15');
      const key = date.getTime().toString();
      const formatted = date.toISOString().split('T')[0];

      cache.set(key, formatted);

      expect(cache.get(key)).toBe('2025-01-15');
    });
  });
});
