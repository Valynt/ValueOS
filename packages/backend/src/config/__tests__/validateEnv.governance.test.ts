import { beforeEach, describe, expect, it } from 'vitest';
import { validateEnv } from '../validateEnv.js';

const originalEnv = { ...process.env };

function setBaseEnv(): void {
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = 'postgresql://localhost:5432/valueos';
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_KEY = 'test-key';
  process.env.WEB_SCRAPER_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.TCT_SECRET = 'test-tct-secret';
}

describe('validateEnv governance config validation', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    setBaseEnv();
  });

  it('fails safely when governance env values are malformed', () => {
    process.env.GOVERNANCE_PERMISSION_CACHE_TTL_MS = 'oops';

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('GOVERNANCE_PERMISSION_CACHE_TTL_MS'))).toBe(true);
  });

  it('preserves valid startup when governance env values are absent', () => {
    delete process.env.GOVERNANCE_PERMISSION_CACHE_TTL_MS;
    delete process.env.GOVERNANCE_PERMISSION_CACHE_MAX;
    delete process.env.GOVERNANCE_DESTRUCTIVE_ACTIONS;
    delete process.env.GOVERNANCE_ELEVATED_ROLES;
    delete process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS;

    const result = validateEnv();
    expect(result.errors.some((error) => error.includes('GOVERNANCE_'))).toBe(false);
  });

  it('fails in production when GOVERNANCE_STAGE_REQUIRED_FIELDS is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.GOVERNANCE_DESTRUCTIVE_ACTIONS = 'value_model.delete';
    process.env.GOVERNANCE_ELEVATED_ROLES = 'admin';
    process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS = 'proposal.publish';
    delete process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS;

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid GOVERNANCE_STAGE_REQUIRED_FIELDS: required in production/prod runtime stage');
  });

  it('allows missing GOVERNANCE_STAGE_REQUIRED_FIELDS in non-prod with fallback path', () => {
    process.env.NODE_ENV = 'staging';
    delete process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS;

    const result = validateEnv();
    expect(result.errors.some((error) => error.includes('GOVERNANCE_STAGE_REQUIRED_FIELDS'))).toBe(false);
  });
});
