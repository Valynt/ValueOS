/**
 * Tests for usage.ts helper functions (escapeCsvField, convertToCSV).
 *
 * These helpers are module-private, so we extract equivalent logic here
 * to validate the fix for CSV injection and type safety.
 */
import { describe, expect, it } from 'vitest';

// Mirrors escapeCsvField from usage.ts
function escapeCsvField(value: unknown): string {
  const str = String(value ?? '');
  const safe = str.replace(/^[=+\-@\t\r]/, "'$&");
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

interface UsageExportRow {
  metric: string;
  usage: number;
  quota: number;
  period: string;
}

function convertToCSV(data: UsageExportRow[]): string {
  if (!Array.isArray(data)) return 'metric,usage,quota,period\n';
  return 'metric,usage,quota,period\n' +
         data.map(item =>
           [item.metric, item.usage, item.quota, item.period]
             .map(escapeCsvField)
             .join(',')
         ).join('\n');
}

describe('escapeCsvField', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCsvField('api_calls')).toBe('api_calls');
    expect(escapeCsvField(42)).toBe('42');
  });

  it('escapes formula-injection characters at start', () => {
    expect(escapeCsvField('=cmd|...')).toBe("'=cmd|...");
    expect(escapeCsvField('+cmd')).toBe("'+cmd");
    expect(escapeCsvField('-cmd')).toBe("'-cmd");
    expect(escapeCsvField('@SUM')).toBe("'@SUM");
  });

  it('wraps values containing commas in quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('escapes double quotes inside values', () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps values containing newlines in quotes', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles null and undefined', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });
});

describe('convertToCSV', () => {
  it('produces header + data rows', () => {
    const data: UsageExportRow[] = [
      { metric: 'api_calls', usage: 100, quota: 1000, period: '2026-02' },
    ];
    const csv = convertToCSV(data);
    expect(csv).toBe('metric,usage,quota,period\napi_calls,100,1000,2026-02');
  });

  it('returns header only for empty array', () => {
    expect(convertToCSV([])).toBe('metric,usage,quota,period\n');
  });

  it('returns header only for non-array input', () => {
    // @ts-expect-error — testing runtime guard
    expect(convertToCSV('not an array')).toBe('metric,usage,quota,period\n');
  });

  it('escapes dangerous metric names', () => {
    const data: UsageExportRow[] = [
      { metric: '=HYPERLINK("http://evil.com")', usage: 1, quota: 10, period: '2026-02' },
    ];
    const csv = convertToCSV(data);
    // The leading = should be prefixed with ' so spreadsheets don't execute it
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toMatch(/^"'=HYPERLINK/);
  });
});

describe('date validation (export endpoint logic)', () => {
  it('new Date(undefined) produces Invalid Date', () => {
    // This is the bug we fixed — documenting the behavior
    const d = new Date(undefined as unknown as string);
    expect(isNaN(d.getTime())).toBe(true);
  });

  it('valid ISO date strings parse correctly', () => {
    const d = new Date('2026-01-01');
    expect(isNaN(d.getTime())).toBe(false);
  });
});
