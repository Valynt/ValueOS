import type { HallucinationSignal } from './BaseAgent.js';

export const REFUSAL_PATTERNS = [
  /I'm sorry,? but I cannot/i,
  /I don't have access to/i,
  /As an AI,? I must/i,
  /I cannot provide/i,
  /I'm unable to/i,
  /I apologize,? but/i,
  /I need to clarify that/i,
  /It's important to note that I/i,
];

export const SELF_REFERENCE_PATTERNS = [
  /as an? (?:AI )?language model/i,
  /as an AI assistant/i,
  /my training data/i,
  /I was trained/i,
  /my knowledge cutoff/i,
  /I don't have real-time/i,
];

export function extractNumbers(
  obj: unknown,
  keyPattern: string,
  results: number[] = []
): number[] {
  if (obj === null || obj === undefined) return results;
  if (typeof obj === 'number') return results;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractNumbers(item, keyPattern, results);
    }
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key.toLowerCase().includes(keyPattern) && typeof value === 'number') {
        results.push(value);
      } else {
        extractNumbers(value, keyPattern, results);
      }
    }
  }

  return results;
}

export function extractRanges(
  obj: unknown,
  path = '',
  results: Array<{ low: number; high: number; path: string }> = []
): Array<{ low: number; high: number; path: string }> {
  if (obj === null || obj === undefined || typeof obj !== 'object') return results;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      extractRanges(obj[i], `${path}[${i}]`, results);
    }
  } else {
    const record = obj as Record<string, unknown>;
    if (typeof record.low === 'number' && typeof record.high === 'number') {
      results.push({ low: record.low, high: record.high, path: path || 'root' });
    }
    for (const [key, value] of Object.entries(record)) {
      extractRanges(value, path ? `${path}.${key}` : key, results);
    }
  }

  return results;
}

export function extractArrayLengths(
  obj: unknown,
  keyPattern: string,
  results: number[] = []
): number[] {
  if (obj === null || obj === undefined || typeof obj !== 'object') return results;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractArrayLengths(item, keyPattern, results);
    }
  } else {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key.toLowerCase().includes(keyPattern) && Array.isArray(value)) {
        results.push(value.length);
      } else {
        extractArrayLengths(value, keyPattern, results);
      }
    }
  }

  return results;
}

export function computeGroundingScore(signals: HallucinationSignal[]): number {
  const severityWeights: Record<string, number> = {
    low: 0.1,
    medium: 0.25,
    high: 0.5,
  };
  const totalPenalty = signals.reduce((sum, s) => sum + (severityWeights[s.severity] || 0.1), 0);
  return Math.max(0, Math.min(1, 1 - totalPenalty));
}
