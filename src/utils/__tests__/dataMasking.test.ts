import { describe, it, expect } from 'vitest';
import { maskEmail } from '../dataMasking';
import { sanitizeUserInput } from '../security';

describe('data masking and input sanitization', () => {
  it('masks email addresses leaving domain intact', () => {
    expect(maskEmail('person@example.com')).toBe('pe***@example.com');
  });

  it('sanitizes user input by stripping scripts and collapsing whitespace', () => {
    const dirty = '  <script>alert(1)</script>Hello   World  ';
    expect(sanitizeUserInput(dirty)).toBe('Hello World');
  });
});
