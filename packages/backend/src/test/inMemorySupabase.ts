import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;
type QueryResult<T = any> = { data: T; error: SupabaseError | null; count?: number | null; status?: number };

type SupabaseError = {
  code?: string;
  message: string;
};

type Filter =
  | { op: 'eq'; column: string; value: unknown }
  | { op: 'neq'; column: string; value: unknown }
  | { op: 'in'; column: string; value: unknown[] }
  | { op: 'gte'; column: string; value: unknown }
  | { op: 'lte'; column: string; value: unknown }
  | { op: 'lt'; column: string; value: unknown };

const VALID_USAGE_METRICS = new Set(['llm_tokens', 'agent_executions', 'api_calls', 'storage_gb']);
const VALID_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid']);
const VALID_PLAN_TIERS = new Set(['free', 'standard', 'enterprise']);

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getFieldValue(row: Row, column: string): unknown {
  if (column.includes('->')) {
    return column.split('->').reduce<unknown>((current, part, index) => {
      if (index === 0) {
        return row[part];
      }
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, undefined);
  }

  return row[column];
}

function compareUnknown(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  const leftDate = typeof left === 'string' ? Date.parse(left) : Number.NaN;
  const rightDate = typeof right === 'string' ? Date.parse(right) : Number.NaN;
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    return leftDate - rightDate;
  }

  return String(left).localeCompare(String(right));
}

function matchesFilters(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const fieldValue = getFieldValue(row, filter.column);
    switch (filter.op) {
      case 'eq':
        return fieldValue === filter.value;
      case 'neq':
        return fieldValue !== filter.value;
      case 'in':
        return filter.value.includes(fieldValue);
      case 'gte':
        return compareUnknown(fieldValue, filter.value) >= 0;
      case 'lte':
        return compareUnknown(fieldValue, filter.value) <= 0;
      case 'lt':
        return compareUnknown(fieldValue, filter.value) < 0;
      default:
        return false;
    }
  });
}

function validateInsert(table: string, row: Row, rows: Row[]): SupabaseError | null {
  if (table === 'usage_events') {
    if (typeof row.amount === 'number' && row.amount < 0) {
      return { code: '23514', message: 'amount must be greater than or equal to zero' };
    }
    if (row.metric && !VALID_USAGE_METRICS.has(String(row.metric))) {
      return { code: '23514', message: 'metric is outside the allowed enum' };
    }
  }

  if (table === 'subscriptions') {
    if (row.status && !VALID_SUBSCRIPTION_STATUSES.has(String(row.status))) {
      return { code: '23514', message: 'status is outside the allowed enum' };
    }
    if (row.plan_tier && !VALID_PLAN_TIERS.has(String(row.plan_tier))) {
      return { code: '23514', message: 'plan_tier is outside the allowed enum' };
    }
  }

  if (table === 'webhook_events' && row.stripe_event_id) {
    const duplicate = rows.some((existing) => existing.stripe_event_id === row.stripe_event_id);
    if (duplicate) {
      return { code: '23505', message: 'duplicate key value violates unique constraint webhook_events_stripe_event_id_key' };
    }
  }

  if (table === 'usage_aggregates' && row.idempotency_key) {
    const duplicate = rows.some((existing) => existing.idempotency_key === row.idempotency_key);
    if (duplicate) {
      return { code: '23505', message: 'duplicate key value violates unique constraint usage_aggregates_idempotency_key_key' };
    }
  }

  return null;
}

class InMemoryQueryBuilder implements PromiseLike<QueryResult<any>> {
  private readonly filters: Filter[] = [];
  private selectedColumns: string | null = null;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private mode: 'select' | 'update' | 'delete' = 'select';
  private updatePayload: Row | null = null;
  private head = false;
  private countMode: 'exact' | null = null;

  constructor(
    private readonly state: Map<string, Row[]>,
    private readonly table: string,
  ) {}

  select(columns?: string, options?: { count?: 'exact'; head?: boolean }) {
    this.mode = 'select';
    this.selectedColumns = columns ?? null;
    this.countMode = options?.count ?? null;
    this.head = options?.head ?? false;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ op: 'neq', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ op: 'in', column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ op: 'gte', column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ op: 'lte', column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ op: 'lt', column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  update(payload: Row) {
    this.mode = 'update';
    this.updatePayload = clone(payload);
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  async insert(payload: Row | Row[]): Promise<QueryResult<any>> {
    const rows = this.state.get(this.table) ?? [];
    const incoming = Array.isArray(payload) ? payload : [payload];

    for (const row of incoming) {
      const error = validateInsert(this.table, row, rows);
      if (error) {
        return { data: null, error, status: 400 };
      }
    }

    rows.push(...clone(incoming));
    this.state.set(this.table, rows);
    return { data: clone(payload), error: null, status: 201 };
  }

  async single(): Promise<QueryResult<any>> {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    return {
      ...result,
      data: rows[0] ?? null,
      error: rows.length > 0 ? result.error : result.error,
    };
  }

  async maybeSingle(): Promise<QueryResult<any>> {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    return {
      ...result,
      data: rows[0] ?? null,
      error: result.error,
    };
  }

  then<TResult1 = QueryResult<any>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<any>> {
    const rows = this.state.get(this.table) ?? [];
    const matchingRows = rows.filter((row) => matchesFilters(row, this.filters));

    if (this.mode === 'update') {
      for (const row of matchingRows) {
        Object.assign(row, clone(this.updatePayload));
      }
      return { data: clone(matchingRows), error: null, status: 200 };
    }

    if (this.mode === 'delete') {
      const survivors = rows.filter((row) => !matchesFilters(row, this.filters));
      this.state.set(this.table, survivors);
      return { data: clone(matchingRows), error: null, status: 200 };
    }

    const orderedRows = this.orderBy
      ? [...matchingRows].sort((left, right) => {
          const comparison = compareUnknown(
            getFieldValue(left, this.orderBy!.column),
            getFieldValue(right, this.orderBy!.column),
          );
          return this.orderBy!.ascending ? comparison : -comparison;
        })
      : matchingRows;

    const selectedRows = this.selectedColumns && this.selectedColumns !== '*'
      ? orderedRows.map((row) => this.pickColumns(row, this.selectedColumns!))
      : orderedRows;

    return {
      data: this.head ? null : clone(selectedRows),
      error: null,
      count: this.countMode === 'exact' ? selectedRows.length : null,
      status: 200,
    };
  }

  private pickColumns(row: Row, columns: string): Row {
    const picked: Row = {};
    for (const column of columns.split(',').map((value) => value.trim()).filter(Boolean)) {
      picked[column] = getFieldValue(row, column);
    }
    return picked;
  }
}

export function createInMemorySupabaseClient(seed?: Record<string, Row[]>): SupabaseClient {
  const state = new Map<string, Row[]>();

  if (seed) {
    for (const [table, rows] of Object.entries(seed)) {
      state.set(table, clone(rows));
    }
  }

  const client = {
    from(table: string) {
      if (!state.has(table)) {
        state.set(table, []);
      }
      return new InMemoryQueryBuilder(state, table);
    },
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
        updateUserById: async () => ({ data: { user: null }, error: null }),
        createUser: async ({ email }: { email: string }) => ({
          data: { user: { id: `user_${Math.random().toString(36).slice(2)}`, email } },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient;

  return client;
}
