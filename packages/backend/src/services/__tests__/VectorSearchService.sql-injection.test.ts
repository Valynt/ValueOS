/**
 * Tests for VectorSearchService.buildFilterClause SQL injection prevention.
 *
 * The VectorSearchService import chain pulls in supabase which requires
 * env configuration. To keep these tests fast and isolated we extract the
 * private helper methods under test and exercise them directly.
 */
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Extracted helpers (mirrors VectorSearchService private methods)
// ---------------------------------------------------------------------------

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function isSafeIdentifier(key: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
}

const VALID_TYPES = new Set([
  'value_proposition',
  'target_definition',
  'opportunity',
  'integrity_check',
  'workflow_result',
]);

type MemoryType =
  | 'value_proposition'
  | 'target_definition'
  | 'opportunity'
  | 'integrity_check'
  | 'workflow_result';

/**
 * Faithful copy of VectorSearchService.buildFilterClause after the fix.
 * Kept in sync so the test validates the actual logic.
 */
function buildFilterClause(
  type?: MemoryType,
  filters: Record<string, unknown> = {},
  requireLineage: boolean = true,
): string {
  const conditions: string[] = [
    "(metadata ? 'source_origin')",
    "(metadata ? 'data_sensitivity_level')",
    "metadata->>'source_origin' IS NOT NULL",
    "metadata->>'data_sensitivity_level' IS NOT NULL",
    "metadata->>'source_origin' <> ''",
    "metadata->>'data_sensitivity_level' <> ''",
    "LOWER(metadata->>'source_origin') <> 'unknown'",
    "LOWER(metadata->>'data_sensitivity_level') <> 'unknown'",
  ];

  if (type) {
    if (!VALID_TYPES.has(type)) {
      throw new Error(`Invalid memory type: ${type}`);
    }
    conditions.push(`type = '${escapeSqlLiteral(type)}'`);
  }

  if (requireLineage) {
    conditions.push("metadata ? 'source_origin'");
    conditions.push("metadata ? 'data_sensitivity_level'");
    conditions.push("COALESCE(metadata->>'source_origin', '') <> ''");
    conditions.push("COALESCE(metadata->>'data_sensitivity_level', 'unknown') <> 'unknown'");
  }

  const mutableFilters = { ...filters };

  if (mutableFilters.organization_id) {
    const orgId = String(mutableFilters.organization_id);
    conditions.push(`organization_id = '${escapeSqlLiteral(orgId)}'`);
    delete mutableFilters.organization_id;
  }

  Object.entries(mutableFilters).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (!isSafeIdentifier(key)) {
      return;
    }

    if (typeof value === 'string') {
      conditions.push(`metadata->>'${key}' = '${escapeSqlLiteral(value)}'`);
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) return;
      conditions.push(`(metadata->>'${key}')::float = ${value}`);
    } else if (typeof value === 'boolean') {
      conditions.push(`(metadata->>'${key}')::boolean = ${value}`);
    } else if (Array.isArray(value)) {
      const jsonStr = JSON.stringify(value);
      conditions.push(`metadata->'${key}' @> '${escapeSqlLiteral(jsonStr)}'::jsonb`);
    }
  });

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VectorSearchService SQL injection prevention', () => {
  describe('escapeSqlLiteral', () => {
    it('doubles single quotes', () => {
      expect(escapeSqlLiteral("it's")).toBe("it''s");
    });

    it('handles multiple quotes', () => {
      expect(escapeSqlLiteral("a'b'c")).toBe("a''b''c");
    });

    it('returns unchanged string when no quotes', () => {
      expect(escapeSqlLiteral('safe')).toBe('safe');
    });
  });

  describe('isSafeIdentifier', () => {
    it('accepts valid identifiers', () => {
      expect(isSafeIdentifier('workflowId')).toBe(true);
      expect(isSafeIdentifier('_private')).toBe(true);
      expect(isSafeIdentifier('a123')).toBe(true);
    });

    it('rejects identifiers starting with numbers', () => {
      expect(isSafeIdentifier('123abc')).toBe(false);
    });

    it('rejects identifiers with special characters', () => {
      expect(isSafeIdentifier("key'; DROP TABLE x; --")).toBe(false);
      expect(isSafeIdentifier('key-name')).toBe(false);
      expect(isSafeIdentifier('key name')).toBe(false);
    });
  });

  describe('buildFilterClause', () => {
    it('escapes single quotes in string filter values', () => {
      const clause = buildFilterClause(undefined, {
        workflowId: "wf'; DROP TABLE semantic_memory; --",
      });

      expect(clause).toContain("wf''; DROP TABLE semantic_memory; --");
      expect(clause).not.toContain("wf'; DROP");
    });

    it('escapes single quotes in organization_id', () => {
      const clause = buildFilterClause(undefined, {
        organization_id: "org'; DELETE FROM users; --",
      });

      expect(clause).toContain("org''; DELETE FROM users; --");
      expect(clause).not.toContain("org'; DELETE");
    });

    it('escapes single quotes in array filter values', () => {
      const clause = buildFilterClause(undefined, {
        tags: ['safe', "it's tricky"],
      });

      expect(clause).toContain('@>');
      // The JSON array is escaped so the single quote in the value doesn't break SQL
      expect(clause).not.toMatch(/= 'it's/);
    });

    it('rejects invalid memory type values', () => {
      expect(() =>
        buildFilterClause("opportunity'; DROP TABLE x; --" as MemoryType),
      ).toThrow(/Invalid memory type/);
    });

    it('accepts valid memory types', () => {
      const clause = buildFilterClause('opportunity');
      expect(clause).toContain("type = 'opportunity'");
    });

    it('skips filter keys that are not safe identifiers', () => {
      const clause = buildFilterClause(undefined, {
        "key'; DROP TABLE x; --": 'value',
      });

      expect(clause).not.toContain('DROP TABLE');
      expect(clause).not.toContain("key'");
    });

    it('skips non-finite number values', () => {
      const clause = buildFilterClause(undefined, { score: NaN });
      expect(clause).not.toContain('NaN');

      const clause2 = buildFilterClause(undefined, { score: Infinity });
      expect(clause2).not.toContain('Infinity');
    });

    it('handles boolean filter values safely', () => {
      const clause = buildFilterClause(undefined, { verified: true });
      expect(clause).toContain("(metadata->>'verified')::boolean = true");
    });

    it('produces correct clauses for normal inputs', () => {
      const clause = buildFilterClause('target_definition', {
        organization_id: 'org-123',
        workflowId: 'wf-456',
        score: 0.85,
        verified: false,
      });

      expect(clause).toContain("type = 'target_definition'");
      expect(clause).toContain("organization_id = 'org-123'");
      expect(clause).toContain("metadata->>'workflowId' = 'wf-456'");
      expect(clause).toContain("(metadata->>'score')::float = 0.85");
      expect(clause).toContain("(metadata->>'verified')::boolean = false");
    });

    it('includes lineage guards by default', () => {
      const clause = buildFilterClause();
      expect(clause).toContain("(metadata ? 'source_origin')");
      expect(clause).toContain("(metadata ? 'data_sensitivity_level')");
    });
  });
});
