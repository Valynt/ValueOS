import { describe, expect, it } from 'vitest';
import { validateSDUISchema } from '../../sdui/schema';
import { OpportunityTemplate, IntegrityTemplate } from '../../sdui/templates';

describe('SDUI schema validation', () => {
  it('accepts valid layouts and preserves sections', () => {
    const result = validateSDUISchema(OpportunityTemplate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.page.sections.length).toBe(3);
    }
  });

  it('clamps unsupported versions and surfaces warnings', () => {
    const template = { ...IntegrityTemplate, version: 99 };
    const result = validateSDUISchema(template);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.page.version).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it('returns descriptive errors when schema is malformed', () => {
    const result = validateSDUISchema({ type: 'page', version: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('sections');
    }
  });
});
