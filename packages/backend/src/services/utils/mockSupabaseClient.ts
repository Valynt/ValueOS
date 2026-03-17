export function createBoltClientMock(initialData: Record<string, any[]> = {}) {
  const tables = JSON.parse(JSON.stringify(initialData));

  const getTable = (table: string) => {
      if (!tables[table]) tables[table] = [];
      return tables[table];
  };

  const mock = {
    tables,
    from: (table: string) => {
      let currentData = [...getTable(table)];
      let filters: Array<{ column: string; value: unknown; type?: string; values?: unknown[] }> = [];
      let sort: { column: string; ascending: boolean } | null = null;
      let operation = 'select';
      let updateData: Record<string, unknown> | null = null;

      const builder = {
        select: (_columns: string = '*') => {
          operation = 'select';
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters.push({ type: 'eq', column, value });
          return builder;
        },
        in: (column: string, values: unknown[]) => {
           filters.push({ type: 'in', column, values });
           return builder;
        },
        maybeSingle: async () => {
             const res = applyFilters(currentData, filters);
             return { data: res[0] || null, error: null };
        },
        delete: () => {
            operation = 'delete';
            return builder;
        },
        update: (data: Record<string, unknown>) => {
            operation = 'update';
            updateData = data;
            return builder;
        },
        insert: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
            const rows = Array.isArray(data) ? data : [data];
            getTable(table).push(...rows);
            return { data: rows, error: null };
        },
        order: (column: string, { ascending }: { ascending: boolean } = { ascending: true }) => {
            sort = { column, ascending };
            return builder;
        },
        then: (resolve: Function, reject: Function) => {
            // Apply filters
            let filtered = applyFilters(currentData, filters);

            if (sort) {
                filtered.sort((a, b) => {
                    if (a[sort.column] < b[sort.column]) return sort.ascending ? -1 : 1;
                    if (a[sort.column] > b[sort.column]) return sort.ascending ? 1 : -1;
                    return 0;
                });
            }

            if (operation === 'delete') {
                const targetTable = getTable(table);
                // We need to delete from the actual table array.
                // We find items in `filtered` and remove them from `targetTable`
                for (const item of filtered) {
                    // Try to find by reference (since currentData is shallow copy of array)
                    let idx = targetTable.indexOf(item);

                    if (idx === -1 && item.id !== undefined) {
                         // Fallback using ID if reference check fails (should not happen if consistent)
                         idx = targetTable.findIndex((r: Record<string, unknown>) => r.id === item.id);
                    }

                    if (idx !== -1) {
                         targetTable.splice(idx, 1);
                    }
                }
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
            }

            if (operation === 'update') {
                 // For updates, we need to update the objects in targetTable.
                 // Since objects in currentData are same references as in targetTable, modifying item works.
                 for (const item of filtered) {
                     Object.assign(item, updateData);
                 }
                 return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
            }

            // Select
            return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
        }
      };

      return builder;
    }
  };
  return mock;
}

function matchesFilters(row: Record<string, unknown>, filters: Array<{ column: string; value: unknown; type?: string; values?: unknown[] }>) {
    for (const f of filters) {
        if (f.type === 'eq') {
            if (row[f.column] !== f.value) return false;
        } else if (f.type === 'in') {
            if (!f.values.includes(row[f.column])) return false;
        }
    }
    return true;
}

function applyFilters(rows: Record<string, unknown>[], filters: Array<{ column: string; value: unknown; type?: string; values?: unknown[] }>) {
    return rows.filter(r => matchesFilters(r, filters));
}
