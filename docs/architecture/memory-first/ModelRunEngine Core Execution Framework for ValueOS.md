### ValueOS Model Execution Framework: ModelRunEngine

The `ModelRunEngine` serves as the core execution layer of ValueOS. It is designed with a **Memory-First** philosophy, prioritizing the provenance, auditability, and reproducibility of a calculation over the transient output. By hashing the entire state—including inputs, engine versions, and benchmark snapshots—the engine ensures that every value generated can be traced back to its specific temporal and logic-based origins.

#### 1. Core Type Definitions

These interfaces establish the contract for model runs and their associated benchmark dependencies.

```typescript
import { createHash } from 'node:crypto';

export interface BenchmarkSlice {
  benchmark_id: string;
  version_id: string;
  value_at_execution: number;
  label: string;
}

export interface ModelRun {
  id: string;
  value_case_id: string;
  engine_version: string;
  run_hash: string;
  inputs: Record<string, any>;
  results: Record<string, number>;
  benchmarks: BenchmarkSlice[];
  created_at: Date;
}

export interface ModelDiff {
  [key: string]: {
    absolute_delta: number;
    percentage_change: number;
  };
}
```

#### 2. Implementation: ModelRunEngine

```typescript
/**
 * ModelRunEngine
 * Responsible for executing value calculations, managing provenance,
 * and ensuring data integrity through deterministic hashing.
 */
export class ModelRunEngine {
  constructor(
    private readonly repository: any, // Placeholder for Database/Repository layer
    private readonly benchmarkProvider: any // Placeholder for Benchmark service
  ) {}

  /**
   * Primary execution method. Performs calculation and persists the run with full metadata.
   */
  public async calculateAndPersist(
    value_case_id: string,
    inputs: Record<string, any>,
    engine_version: string,
    benchmark_ids: string[]
  ): Promise<ModelRun> {
    // 1. Hydrate benchmarks to capture their state at this exact moment
    const benchmarks = await this.hydrateBenchmarks(benchmark_ids);

    // 2. Perform calculation logic (Simulated for this implementation)
    // In production, this would call a specific model logic provider
    const results = await this.executeCalculationLogic(inputs, benchmarks);

    // 3. Generate deterministic hash of the run state
    const run_hash = this.computeRunHash(inputs, engine_version, benchmarks);

    const modelRun: ModelRun = {
      id: crypto.randomUUID(),
      value_case_id,
      engine_version,
      run_hash,
      inputs,
      results,
      benchmarks,
      created_at: new Date(),
    };

    // 4. Persist to storage
    await this.repository.saveModelRun(modelRun);

    return modelRun;
  }

  /**
   * Generates a SHA-256 hash representing the immutable state of the calculation.
   * Includes inputs, engine logic version, and external benchmark values.
   */
  public computeRunHash(
    inputs: Record<string, any>,
    engine_version: string,
    benchmarks: BenchmarkSlice[]
  ): string {
    // Sort keys and benchmarks to ensure deterministic hashing
    const canonicalState = JSON.stringify({
      inputs: Object.keys(inputs).sort().reduce((obj, key) => {
        obj[key] = inputs[key];
        return obj;
      }, {} as any),
      engine_version,
      benchmarks: benchmarks.sort((a, b) => a.benchmark_id.localeCompare(b.benchmark_id)),
    });

    return createHash('sha256').update(canonicalState).digest('hex');
  }

  /**
   * Resolves raw benchmark IDs into detailed slices containing specific versions 
   * and values at the time of execution.
   */
  private async hydrateBenchmarks(benchmark_ids: string[]): Promise<BenchmarkSlice[]> {
    return Promise.all(
      benchmark_ids.map(async (id) => {
        const latest = await this.benchmarkProvider.getLatestValue(id);
        return {
          benchmark_id: id,
          version_id: latest.version_id,
          value_at_execution: latest.value,
          label: latest.label,
        };
      })
    );
  }

  /**
   * Internal execution logic placeholder.
   */
  private async executeCalculationLogic(
    inputs: Record<string, any>,
    benchmarks: BenchmarkSlice[]
  ): Promise<Record<string, number>> {
    // Logic implementation would go here
    return { npv: 150000, irr: 0.12 };
  }

  /**
   * Calculates the variance between two ModelRun objects.
   * Useful for sensitivity analysis and auditing logic changes.
   */
  public static getDiff(runA: ModelRun, runB: ModelRun): ModelDiff {
    const diff: ModelDiff = {};
    const keys = new Set([...Object.keys(runA.results), ...Object.keys(runB.results)]);

    keys.forEach((key) => {
      const valA = runA.results[key] || 0;
      const valB = runB.results[key] || 0;
      const absolute_delta = valB - valA;
      
      diff[key] = {
        absolute_delta,
        percentage_change: valA !== 0 ? (absolute_delta / Math.abs(valA)) * 100 : 0,
      };
    });

    return diff;
  }
}
```

#### 3. Strategic Considerations

| Feature | Design Rationale |
| :--- | :--- |
| **Deterministic Hashing** | By hashing `inputs`, `engine_version`, and `benchmarks`, we create a "Run Fingerprint." If any variable changes, the hash changes, alerting the system to potential data drift. |
| **Benchmark Hydration** | Models often rely on external data (interest rates, market benchmarks). `hydrateBenchmarks` snapshots these values, preventing "silent updates" from invalidating historical runs. |
| **Memory-First Architecture** | The `ModelRun` object saves the *entire context* of the calculation. This allows ValueOS to reconstruct the "why" behind a number years after the run was performed. |
| **Static Variance Analysis** | `getDiff` enables immediate comparison between "As-Is" and "To-Be" scenarios, which is critical for value-based decision making. |

#### 4. Analytical Insights: The Memory-First Philosophy

In traditional modeling, the "Result" is the asset. In ValueOS, the **Run Metadata** is the asset.

1.  **Auditability as a First-Class Citizen**: By using `node:crypto` to generate `run_hash`, we provide a cryptographic guarantee that the results stored in the database actually correspond to the inputs and engine version claimed.
2.  **Context Preservation**: Most systems lose the specific benchmark values used during a calculation (e.g., "What was the LIBOR rate on the day this was calculated?"). `BenchmarkSlice` solves this by embedding the value directly into the run record.
3.  **Engine Evolution**: Including `engine_version` in the hash ensures that if the underlying mathematical formulas change, the hash will reflect that divergence, even if the inputs remain identical. This allows for safe A/B testing of model logic.