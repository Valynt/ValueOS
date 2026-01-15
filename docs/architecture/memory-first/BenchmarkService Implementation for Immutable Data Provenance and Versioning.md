# BenchmarkService Implementation: Immutable Data Provenance & Versioning

The `BenchmarkService` serves as the authoritative source for industry benchmarks within the system. Following **Memory-First** principles, it ensures that every data point used by the `ModelRunEngine` is immutable, versioned, and traceable. By preventing "silent updates," we guarantee that model provenance hashes remain valid over time.

## 1. Data Structures and Interfaces

```typescript
/**
 * Represents the hierarchical importance of a benchmark.
 * Tier 1: Gold standard (e.g., audited financial data)
 * Tier 3: General industry estimates
 */
export enum BenchmarkTier {
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3
}

export interface BenchmarkFilter {
  industry?: string;
  geo?: string;
  size_range?: string;
  tier?: BenchmarkTier;
  tags?: string[];
}

export interface BenchmarkSlice {
  id: string;
  parent_id: string | null; // Links versions of the same benchmark
  version: number;
  name: string;
  industry: string;
  geo: string;
  company_size_range: string;
  tier: BenchmarkTier;
  metrics: Record<string, any>;
  checksum: string;
  is_active: boolean;
  created_at: Date;
}

export interface LockedBenchmarkRun {
  lock_id: string;
  slice_id: string;
  provenance_hash: string;
  timestamp: Date;
}
```

## 2. BenchmarkService Implementation

```typescript
import { DatabaseClient } from './db'; // Abstract DB client
import { CryptoUtils } from './utils/crypto';
import { NotFoundError, VersionConflictError } from './errors';

export class BenchmarkService {
  private db = DatabaseClient;

  /**
   * Queries the benchmark_slices table using specific industry dimensions.
   * Prioritizes Tier ranking (1 > 2 > 3).
   */
  async findSlices(filters: BenchmarkFilter): Promise<BenchmarkSlice[]> {
    const query = this.db('benchmark_slices')
      .where('is_active', true)
      .modify((queryBuilder) => {
        if (filters.industry) queryBuilder.where('industry', filters.industry);
        if (filters.geo) queryBuilder.where('geo', filters.geo);
        if (filters.size_range) queryBuilder.where('company_size_range', filters.size_range);
        if (filters.tier) queryBuilder.where('tier', filters.tier);
      })
      .orderBy([
        { column: 'tier', order: 'asc' }, // Tier 1 first
        { column: 'created_at', order: 'desc' }
      ]);

    return await query;
  }

  /**
   * Prevents 'silent updates'. 
   * Instead of modifying a record, it deprecates the old version and creates a new one.
   */
  async updateBenchmark(
    currentSliceId: string, 
    newData: Partial<BenchmarkSlice>
  ): Promise<BenchmarkSlice> {
    return await this.db.transaction(async (trx) => {
      const current = await trx('benchmark_slices')
        .where({ id: currentSliceId, is_active: true })
        .first();

      if (!current) throw new NotFoundError('Active benchmark slice not found');

      // 1. Mark existing slice as inactive
      await trx('benchmark_slices')
        .where({ id: currentSliceId })
        .update({ is_active: false });

      // 2. Calculate new version and checksum
      const newVersion = current.version + 1;
      const combinedMetrics = { ...current.metrics, ...newData.metrics };
      const checksum = CryptoUtils.generateChecksum(combinedMetrics);

      // 3. Insert new slice version
      const [newSlice] = await trx('benchmark_slices').insert({
        ...current,
        ...newData,
        id: CryptoUtils.uuid(),
        parent_id: current.parent_id || current.id,
        version: newVersion,
        checksum,
        is_active: true,
        created_at: new Date()
      }).returning('*');

      return newSlice;
    });
  }

  /**
   * Creates a 'Lock' for a specific data snapshot.
   * This ID is used by the ModelRunEngine to ensure that even if a 
   * benchmark is updated globally, the Run uses the data exactly as it existed.
   */
  async lockSliceForRun(sliceId: string, runId: string): Promise<LockedBenchmarkRun> {
    const slice = await this.db('benchmark_slices')
      .where({ id: sliceId })
      .first();

    if (!slice) throw new NotFoundError('Slice not found');

    // Provenance Hash = Hash(Slice Checksum + Run ID)
    const provenanceHash = CryptoUtils.generateHash(`${slice.checksum}:${runId}`);

    const lockId = `lock_${CryptoUtils.shortId()}`;

    await this.db('benchmark_run_locks').insert({
      id: lockId,
      slice_id: sliceId,
      run_id: runId,
      provenance_hash: provenanceHash,
      created_at: new Date()
    });

    return {
      lock_id: lockId,
      slice_id: sliceId,
      provenance_hash: provenanceHash,
      timestamp: new Date()
    };
  }
}
```

## 3. Key Design Patterns

### Anti-Silent Update Logic
The system enforces **Versioned State Management**. Every update follows a *Deprecate-and-Insert* workflow. This ensures that historical `ModelRun` results can be re-validated against the exact data present at the time of execution.
*   `parent_id` tracks the lineage of a benchmark across years or updates.
*   `is_active` acts as a soft-delete and current-version pointer.

### Tiered Ranking Strategy
The `RetrievalEngine` leverages the `tier` metadata to handle data density issues. If a specific industry filter (e.g., "SaaS" in "Norway") yields no results, the engine can broaden the search while maintaining the `tier` priority:

| Scenario | Logic | Result |
| :--- | :--- | :--- |
| **High Precision** | Exact match + Tier 1 | Use audited industry specific data. |
| **Fallback** | Regional match + Tier 2 | Use verified regional data. |
| **Broad** | Global match + Tier 3 | Use general estimates. |

### Model Provenance & Locking
The `lockSliceForRun` method is critical for **Regulatory Compliance**. By generating a `provenance_hash`, the system can prove that the output of a model was derived from a specific, untampered snapshot of benchmark data.

1.  **Checksum:** Validates internal data integrity of the slice.
2.  **Provenance Hash:** Validates the association between a specific Model Run and the data slice used.

## 4. SQL Schema Alignment (Reference)

```sql
CREATE TABLE benchmark_slices (
    id UUID PRIMARY KEY,
    parent_id UUID REFERENCES benchmark_slices(id),
    version INTEGER NOT NULL,
    industry VARCHAR(100),
    geo VARCHAR(50),
    company_size_range VARCHAR(50),
    tier SMALLINT DEFAULT 3,
    metrics JSONB NOT NULL,
    checksum TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE benchmark_run_locks (
    id VARCHAR(50) PRIMARY KEY,
    slice_id UUID REFERENCES benchmark_slices(id),
    run_id UUID NOT NULL,
    provenance_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```