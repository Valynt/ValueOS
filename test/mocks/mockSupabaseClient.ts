import { vi } from 'vitest';

export type TableData = Record<string, any[]>;

interface RLSConfig {
  policies?: Record<string, string[]>;
  role?: string;
}

class MockQueryBuilder {
  private filters: Array<(row: any) => boolean> = [];
  private orderBy?: { column: string; ascending: boolean };
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any;
  private error: Error | null = null;
  private rangeFrom?: number;
  private rangeTo?: number;

  constructor(
    private tableName: string,
    private tables: TableData,
    private rls?: RLSConfig
  ) {}

  select(): this {
    if (this.operation === 'select') {
      this.operation = 'select';
    }
    return this;
  }

  insert(payload: any): this {
    this.operation = 'insert';
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: any): this {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: any): this {
    this.filters.push(row => row[column] === value);
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters.push(row => values.includes(row[column]));
    return this;
  }

  contains(column: string, values: any[]): this {
    this.filters.push(row => {
      const current = row[column] || [];
      return values.every(v => current.includes(v));
    });
    return this;
  }

  ilike(column: string, pattern: string): this {
    const matcher = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push(row => String(row[column] || '').toLowerCase().includes(matcher));
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orderBy = { column, ascending: options.ascending ?? true };
    return this;
  }

  range(from: number, to: number): this {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  maybeSingle() {
    const { data, error } = this.execute();
    return Promise.resolve({ data: data[0] || null, error });
  }

  single() {
    const { data, error } = this.execute();
    if (error) return Promise.resolve({ data: null, error });
    if (data.length === 0) return Promise.resolve({ data: null, error: new Error('No rows found') });
    return Promise.resolve({ data: data[0], error: null });
  }

  then(resolve: any, reject: any) {
    return Promise.resolve(this.executeResponse()).then(resolve, reject);
  }

  private executeResponse() {
    const { data, error } = this.execute();
    return { data, error };
  }

  private execute(): { data: any[]; error: Error | null } {
    if (this.rls?.policies && this.rls.role) {
      const allowedRoles = this.rls.policies[this.tableName];
      if (allowedRoles && !allowedRoles.includes(this.rls.role)) {
        return { data: [], error: new Error('RLS violation: unauthorized role') };
      }
    }

    switch (this.operation) {
      case 'insert':
        return this.handleInsert();
      case 'update':
        return this.handleUpdate();
      case 'delete':
        return this.handleDelete();
      default:
        return this.handleSelect();
    }
  }

  private handleSelect() {
    const rows = (this.tables[this.tableName] || []).filter(row => this.filters.every(fn => fn(row)));

    if (this.orderBy) {
      rows.sort((a, b) => {
        const dir = this.orderBy!.ascending ? 1 : -1;
        if (a[this.orderBy!.column] < b[this.orderBy!.column]) return -1 * dir;
        if (a[this.orderBy!.column] > b[this.orderBy!.column]) return 1 * dir;
        return 0;
      });
    }

    const from = this.rangeFrom ?? 0;
    const to = this.rangeTo !== undefined ? this.rangeTo + 1 : undefined;
    const rangedRows = rows.slice(from, to);

    return { data: rangedRows, error: this.error };
  }

  private handleInsert() {
    const table = this.tables[this.tableName] || (this.tables[this.tableName] = []);

    const inserted = this.payload.map((row: any, index: number) => {
      const id = row.id || `${this.tableName}_${table.length + index + 1}`;
      const record = { ...row, id };
      table.push(record);
      if (this.tableName === 'value_tree_nodes') {
        const links = this.tables['value_tree_links'] || (this.tables['value_tree_links'] = []);
        links.forEach(link => {
          if (link.parent_id === record.id || link.child_id === record.id) {
            link._resolved = true;
          }
        });
      }
      return record;
    });

    return { data: inserted, error: null };
  }

  private handleUpdate() {
    const table = this.tables[this.tableName] || [];
    const updated: any[] = [];

    table.forEach(row => {
      if (this.filters.every(fn => fn(row))) {
        Object.assign(row, this.payload);
        updated.push(row);
      }
    });

    return { data: updated, error: null };
  }

  private handleDelete() {
    const table = this.tables[this.tableName] || [];
    const remaining = table.filter(row => !this.filters.every(fn => fn(row)));
    const deleted = table.filter(row => this.filters.every(fn => fn(row)));
    this.tables[this.tableName] = remaining;

    if (this.tableName === 'value_trees') {
      const removedNodes = this.cascadeDelete('value_tree_nodes', 'value_tree_id', deleted.map(d => d.id));
      const nodeIds = removedNodes.map(n => n.id);
      this.cascadeDelete('value_tree_links', 'parent_id', nodeIds);
      this.cascadeDelete('value_tree_links', 'child_id', nodeIds);
    }

    return { data: deleted, error: null };
  }

  private cascadeDelete(table: string, column: string, ids: string[]) {
    const rows = this.tables[table] || [];
    const removed = rows.filter(r => ids.includes(r[column]));
    this.tables[table] = rows.filter(r => !ids.includes(r[column]));
    return removed;
  }
}

export function createBoltClientMock(initialData: TableData = {}, rls?: RLSConfig) {
  const tables: TableData = JSON.parse(JSON.stringify(initialData));

  const supabase = {
    from: vi.fn((table: string) => new MockQueryBuilder(table, tables, rls)),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    get tables() {
      return tables;
    }
  } as any;

  return supabase;
}

export function createAgentInfrastructureMocks() {
  const llmGateway = { complete: vi.fn() } as any;
  const memorySystem = {
    storeSemanticMemory: vi.fn(),
    storeEpisodicMemory: vi.fn()
  } as any;
  const auditLogger = {
    logAction: vi.fn(),
    logMetric: vi.fn(),
    logPerformanceMetric: vi.fn()
  } as any;

  return { llmGateway, memorySystem, auditLogger };
}
