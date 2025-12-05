import { describe, expect, it } from 'vitest';
import { VectorSearchService } from '../VectorSearchService';

describe('VectorSearchService lineage enforcement', () => {
  const service = new VectorSearchService();

  it('injects lineage guards into filter clauses', () => {
    const clause = (service as any).buildFilterClause(undefined, {});

    expect(clause).toContain("(metadata ? 'source_origin')");
    expect(clause).toContain("(metadata ? 'data_sensitivity_level')");
    expect(clause).toContain("LOWER(metadata->>'source_origin') <> 'unknown'");
    expect(clause).toContain("LOWER(metadata->>'data_sensitivity_level') <> 'unknown'");
  });

  it('appends additional filters while retaining lineage requirements', () => {
    const clause = (service as any).buildFilterClause('opportunity', { workflowId: 'wf-123' });

    expect(clause.startsWith('WHERE')).toBe(true);
    expect(clause).toContain("type = 'opportunity'");
    expect(clause).toContain("metadata->>'workflowId' = 'wf-123'");
    expect(clause).toContain("metadata->>'source_origin' <> ''");
  });
});
