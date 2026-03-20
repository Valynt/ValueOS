import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should join multiple string inputs with spaces', () => {
    expect(cn('class1', 'class2', 'class3')).toBe('class1 class2 class3');
  });

  it('should filter out undefined, null, and false', () => {
    expect(cn('class1', undefined, 'class2', null, false, 'class3')).toBe('class1 class2 class3');
  });

  it('should filter out empty strings', () => {
    expect(cn('class1', '', 'class2', '', 'class3')).toBe('class1 class2 class3');
  });

  it('should return an empty string if all inputs are falsy', () => {
    expect(cn(undefined, null, false, '')).toBe('');
  });

  it('should return an empty string if no inputs are provided', () => {
    expect(cn()).toBe('');
  });

  it('should handle single input correctly', () => {
    expect(cn('class1')).toBe('class1');
  });
});
