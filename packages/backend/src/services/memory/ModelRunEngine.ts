import { createHash } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { BenchmarkSlice, ModelDiff, ModelRun, UUID } from "./types.js"

export class ModelRunEngine {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly benchmarkProvider: BenchmarkProvider
  ) {}

  public async calculateAndPersist(
    tenantId: UUID,
    value_case_id: string,
    inputs: Record<string, unknown>,
    engine_version: string,
    benchmark_ids: string[]
  ): Promise<ModelRun> {
    const benchmarks = await this.hydrateBenchmarks(benchmark_ids);
    const results = await this.executeCalculationLogic(inputs, benchmarks);
    const run_hash = this.computeRunHash(inputs, engine_version, benchmarks);

    const modelRun: ModelRun = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      value_case_id,
      model_name: "value-calculation-engine",
      engine_version,
      run_hash,
      input_prompt: null,
      output_response: null,
      inputs,
      results,
      benchmarks,
      tokens_used: null,
      latency_ms: null,
      status: "success",
      created_at: new Date(),
    };

    const { error } = await this.supabase.from("memory_model_runs").insert({
      id: modelRun.id,
      tenant_id: tenantId,
      value_case_id,
      model_name: modelRun.model_name,
      engine_version,
      run_hash,
      inputs,
      results,
      benchmarks,
      status: "success",
    });

    if (error) throw error;

    return modelRun;
  }

  public computeRunHash(
    inputs: Record<string, unknown>,
    engine_version: string,
    benchmarks: BenchmarkSlice[]
  ): string {
    const sortedInputs = Object.keys(inputs)
      .sort()
      .reduce(
        (obj, key) => {
          obj[key] = inputs[key];
          return obj;
        },
        {} as Record<string, unknown>
      );

    const canonicalState = JSON.stringify({
      inputs: sortedInputs,
      engine_version,
      benchmarks: benchmarks.sort((a, b) =>
        (a.benchmark_id || a.id).localeCompare(b.benchmark_id || b.id)
      ),
    });

    return createHash("sha256").update(canonicalState).digest("hex");
  }

  private async hydrateBenchmarks(
    benchmark_ids: string[]
  ): Promise<BenchmarkSlice[]> {
    const latestValues = await this.benchmarkProvider.getLatestValues(
      benchmark_ids
    );

    return latestValues.map((latest, index) => {
      const id = benchmark_ids[index];
      return {
        id: latest.id,
        parent_id: latest.parent_id,
        version: latest.version,
        name: latest.name,
        industry: latest.industry,
        geo: latest.geo,
        company_size_range: latest.company_size_range,
        tier: latest.tier,
        metrics: latest.metrics,
        checksum: latest.checksum,
        is_active: latest.is_active,
        created_at: latest.created_at,
        benchmark_id: id,
        version_id: latest.id,
        value_at_execution: (latest.metrics.value as number) || 0,
        label: latest.name,
      };
    });
  }

  private async executeCalculationLogic(
    inputs: Record<string, unknown>,
    benchmarks: BenchmarkSlice[]
  ): Promise<Record<string, number>> {
    const laborCost =
      ((inputs.hours_per_week as number) || 0) *
      ((inputs.hourly_rate as number) || 50) *
      52;
    const efficiency = (inputs.efficiency_gain as number) || 0.2;
    const savings = laborCost * efficiency;

    const benchmarkMultiplier =
      benchmarks.length > 0 ? benchmarks[0].value_at_execution || 1 : 1;

    return {
      npv: Math.round(savings * benchmarkMultiplier),
      irr: 0.12,
      payback_months: Math.round(12 / efficiency),
      total_savings: Math.round(savings),
    };
  }

  public async getLatestRun(valueCaseId: UUID): Promise<ModelRun | null> {
    const { data, error } = await this.supabase
      .from("memory_model_runs")
      .select("*")
      .eq("value_case_id", valueCaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as ModelRun;
  }

  public static getDiff(runA: ModelRun, runB: ModelRun): ModelDiff {
    const diff: ModelDiff = {};
    const resultsA = runA.results || {};
    const resultsB = runB.results || {};
    const keys = new Set([...Object.keys(resultsA), ...Object.keys(resultsB)]);

    keys.forEach((key) => {
      const valA = resultsA[key] || 0;
      const valB = resultsB[key] || 0;
      const absolute_delta = valB - valA;

      diff[key] = {
        absolute_delta,
        percentage_change:
          valA !== 0 ? (absolute_delta / Math.abs(valA)) * 100 : 0,
      };
    });

    return diff;
  }
}

export interface BenchmarkProvider {
  getLatestValue(benchmarkId: string): Promise<BenchmarkSlice>;
  getLatestValues(benchmarkIds: string[]): Promise<BenchmarkSlice[]>;
}

export class DefaultBenchmarkProvider implements BenchmarkProvider {
  constructor(private supabase: SupabaseClient) {}

  async getLatestValue(benchmarkId: string): Promise<BenchmarkSlice> {
    const { data, error } = await this.supabase
      .from("memory_benchmark_slices")
      .select("*")
      .eq("id", benchmarkId)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return {
        id: benchmarkId,
        parent_id: null,
        version: 1,
        name: "Default Benchmark",
        industry: "general",
        geo: "global",
        company_size_range: "all",
        tier: 2,
        metrics: { value: 1.0 },
        checksum: "",
        is_active: true,
        created_at: new Date(),
      };
    }

    return data as BenchmarkSlice;
  }

  async getLatestValues(benchmarkIds: string[]): Promise<BenchmarkSlice[]> {
    if (benchmarkIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from("memory_benchmark_slices")
      .select("*")
      .in("id", benchmarkIds)
      .eq("is_active", true);

    const slicesMap = new Map<string, BenchmarkSlice>();
    if (data && !error) {
      data.forEach((slice: BenchmarkSlice) => {
        slicesMap.set(slice.id, slice);
      });
    }

    return benchmarkIds.map((id) => {
      if (slicesMap.has(id)) {
        return slicesMap.get(id)!;
      }
      return {
        id,
        parent_id: null,
        version: 1,
        name: "Default Benchmark",
        industry: "general",
        geo: "global",
        company_size_range: "all",
        tier: 2,
        metrics: { value: 1.0 },
        checksum: "",
        is_active: true,
        created_at: new Date(),
      };
    });
  }
}
