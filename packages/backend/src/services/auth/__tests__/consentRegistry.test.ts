import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../../config/settings.js', () => ({
  settings: {
    VITE_SUPABASE_URL: 'https://example.supabase.co',
  },
}));

import { createConsentRegistry } from '../consentRegistry.js';

type ConsentRow = {
  id: string;
  tenant_id: string;
  auth_subject: string;
  consent_type: string;
  withdrawn_at: string | null;
};

function getConsentRowValue(row: ConsentRow, column: string): unknown {
  switch (column) {
    case 'id':
      return row.id;
    case 'tenant_id':
      return row.tenant_id;
    case 'auth_subject':
      return row.auth_subject;
    case 'consent_type':
      return row.consent_type;
    case 'withdrawn_at':
      return row.withdrawn_at;
    default:
      return undefined;
  }
}

function createMockSupabase(rows: ConsentRow[]) {
  return {
    from: vi.fn(() => {
      const filters = new Map<string, unknown>();
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((column: string, value: unknown) => {
          filters.set(column, value);
          return builder;
        }),
        is: vi.fn((column: string, value: unknown) => {
          filters.set(column, value);
          return builder;
        }),
        limit: vi.fn(async (count: number) => {
          const matches = rows
            .filter((row) => {
              for (const [column, value] of filters.entries()) {
                if (getConsentRowValue(row, column) !== value) {
                  return false;
                }
              }
              return true;
            })
            .slice(0, count)
            .map(({ id }) => ({ id }));

          return { data: matches, error: null };
        }),
      };

      return builder;
    }),
  };
}

describe('createConsentRegistry', () => {
  it('returns true only for the matching tenant, subject, and consent type', async () => {
    const registry = createConsentRegistry();
    const supabase = createMockSupabase([
      {
        id: 'consent-a',
        tenant_id: 'tenant-1',
        auth_subject: 'user-a',
        consent_type: 'llm.chat',
        withdrawn_at: null,
      },
    ]);

    await expect(
      registry.hasConsent({
        tenantId: 'tenant-1',
        subject: 'user-a',
        scope: 'llm.chat',
        supabase,
      })
    ).resolves.toBe(true);

    await expect(
      registry.hasConsent({
        tenantId: 'tenant-1',
        subject: 'user-b',
        scope: 'llm.chat',
        supabase,
      })
    ).resolves.toBe(false);
  });

  it('does not treat withdrawn consent as active consent', async () => {
    const registry = createConsentRegistry();
    const supabase = createMockSupabase([
      {
        id: 'consent-withdrawn',
        tenant_id: 'tenant-1',
        auth_subject: 'user-a',
        consent_type: 'llm.chat',
        withdrawn_at: '2026-03-18T12:00:00Z',
      },
    ]);

    await expect(
      registry.hasConsent({
        tenantId: 'tenant-1',
        subject: 'user-a',
        scope: 'llm.chat',
        supabase,
      })
    ).resolves.toBe(false);
  });

  it('does not allow a consent record from another tenant to satisfy the check', async () => {
    const registry = createConsentRegistry();
    const supabase = createMockSupabase([
      {
        id: 'consent-cross-tenant',
        tenant_id: 'tenant-2',
        auth_subject: 'user-a',
        consent_type: 'llm.chat',
        withdrawn_at: null,
      },
    ]);

    await expect(
      registry.hasConsent({
        tenantId: 'tenant-1',
        subject: 'user-a',
        scope: 'llm.chat',
        supabase,
      })
    ).resolves.toBe(false);
  });
});
