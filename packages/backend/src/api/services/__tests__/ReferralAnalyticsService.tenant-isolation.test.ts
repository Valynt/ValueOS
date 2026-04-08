import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  })
}));

vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {},
  createServiceRoleSupabaseClient: () => ({
    from: fromMock
  })
}));

const { ReferralAnalyticsService } = await import('../ReferralAnalyticsService.js');

type Row = Record<string, unknown>;

type FixtureTables = Record<string, Row[]>;

function makeQueryBuilder(tableName: string, tables: FixtureTables) {
  const filters: Array<{ type: 'eq' | 'gte' | 'in'; column: string; value: unknown }> = [];
  let sortColumn: string | null = null;
  let sortAscending = true;
  let maxRows: number | null = null;

  const run = () => {
    let rows = [...(tables[tableName] ?? [])];

    for (const filter of filters) {
      if (filter.type === 'eq') {
        rows = rows.filter((row) => row[filter.column] === filter.value);
      }

      if (filter.type === 'gte') {
        rows = rows.filter((row) => {
          const rowValue = row[filter.column];
          if (typeof rowValue === 'number' && typeof filter.value === 'number') {
            return rowValue >= filter.value;
          }

          if (typeof rowValue === 'string' && typeof filter.value === 'string') {
            return rowValue >= filter.value;
          }

          return false;
        });
      }

      if (filter.type === 'in') {
        const allowed = Array.isArray(filter.value) ? filter.value : [];
        rows = rows.filter((row) => allowed.includes(row[filter.column]));
      }
    }

    if (sortColumn) {
      rows.sort((a, b) => {
        const left = a[sortColumn!];
        const right = b[sortColumn!];
        if (left === right) return 0;
        if (left === undefined) return sortAscending ? -1 : 1;
        if (right === undefined) return sortAscending ? 1 : -1;
        return left < right ? (sortAscending ? -1 : 1) : (sortAscending ? 1 : -1);
      });
    }

    if (maxRows !== null) {
      rows = rows.slice(0, maxRows);
    }

    return { data: rows, error: null };
  };

  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ type: 'eq', column, value });
      return builder;
    }),
    gte: vi.fn((column: string, value: unknown) => {
      filters.push({ type: 'gte', column, value });
      return builder;
    }),
    in: vi.fn((column: string, value: unknown) => {
      filters.push({ type: 'in', column, value });
      return builder;
    }),
    order: vi.fn((column: string, options?: { ascending?: boolean }) => {
      sortColumn = column;
      sortAscending = options?.ascending ?? true;
      return builder;
    }),
    limit: vi.fn((count: number) => {
      maxRows = count;
      return builder;
    }),
    returns: vi.fn(() => Promise.resolve(run())),
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve(run()).then(resolve)
  };

  return builder;
}

describe('ReferralAnalyticsService integration — tenant isolation', () => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const tables: FixtureTables = {
    referrals: [
      { id: 'ref-a-1', organization_id: 'tenant-a', status: 'completed', created_at: oneDayAgo, completed_at: oneDayAgo },
      { id: 'ref-a-2', organization_id: 'tenant-a', status: 'pending', created_at: oneDayAgo, completed_at: null },
      { id: 'ref-b-1', organization_id: 'tenant-b', status: 'completed', created_at: oneDayAgo, completed_at: oneDayAgo }
    ],
    referral_rewards: [
      { id: 'reward-a-1', organization_id: 'tenant-a', reward_type: 'referrer_bonus', reward_value: 29, created_at: oneDayAgo },
      { id: 'reward-b-1', organization_id: 'tenant-b', reward_type: 'referee_discount', reward_value: 6, created_at: oneDayAgo }
    ],
    referral_stats: [
      { user_id: 'user-a-1', organization_id: 'tenant-a', total_referrals: 2, completed_referrals: 1 },
      { user_id: 'user-b-1', organization_id: 'tenant-b', total_referrals: 10, completed_referrals: 9 }
    ],
    user_profile_directory: [
      { user_uuid: 'user-a-1', tenant_id: 'tenant-a', email: 'a@example.com' },
      { user_uuid: 'user-b-1', tenant_id: 'tenant-b', email: 'b@example.com' }
    ],
    referral_codes: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((tableName: string) => makeQueryBuilder(tableName, tables));
  });

  it('throws when organizationId is missing', async () => {
    const service = new ReferralAnalyticsService();
    await expect(service.getReferralAnalytics('')).rejects.toThrow('organizationId is required');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('tenant A cannot see tenant B referral stats', async () => {
    const service = new ReferralAnalyticsService();

    const analyticsA = await service.getReferralAnalytics('tenant-a', '90 days');

    expect(analyticsA).not.toBeNull();
    expect(analyticsA?.total_referrals).toBe(2);
    expect(analyticsA?.completed_referrals).toBe(1);
    expect(analyticsA?.top_referrers.map((row) => row.user_id)).toEqual(['user-a-1']);
    expect(analyticsA?.top_referrers.map((row) => row.user_email)).toEqual(['a@example.com']);

    const referralStatsQuery = fromMock.mock.calls.find((call) => call[0] === 'referral_stats');
    expect(referralStatsQuery).toBeDefined();
    const referralStatsBuilder = fromMock.mock.results.find((result, idx) => fromMock.mock.calls[idx]?.[0] === 'referral_stats')?.value;
    expect(referralStatsBuilder.eq).toHaveBeenCalledWith('organization_id', 'tenant-a');

    const profilesBuilder = fromMock.mock.results.find((result, idx) => fromMock.mock.calls[idx]?.[0] === 'user_profile_directory')?.value;
    expect(profilesBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(profilesBuilder.in).toHaveBeenCalledWith('user_uuid', ['user-a-1']);
  });
});
