import { createHash, randomUUID } from "crypto";

import { SupabaseClient } from "@supabase/supabase-js";

import {
  BenchmarkFilter,
  BenchmarkSlice,
  BenchmarkTier,
  LockedBenchmarkRun,
} from "./types";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class VersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersionConflictError";
  }
}

function generateChecksum(data: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function shortId(): string {
  return randomUUID().substring(0, 8);
}

export class MemoryBenchmarkService {
  constructor(private supabase: SupabaseClient) {}

  async findSlices(filters: BenchmarkFilter): Promise<BenchmarkSlice[]> {
    let query = this.supabase
      .from("memory_benchmark_slices")
      .select("*")
      .eq("is_active", true);

    if (filters.industry) {
      query = query.eq("industry", filters.industry);
    }
    if (filters.geo) {
      query = query.eq("geo", filters.geo);
    }
    if (filters.size_range) {
      query = query.eq("company_size_range", filters.size_range);
    }
    if (filters.tier) {
      query = query.eq("tier", filters.tier);
    }

    const { data, error } = await query
      .order("tier", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as BenchmarkSlice[];
  }

  async updateBenchmark(
    currentSliceId: string,
    newData: Partial<BenchmarkSlice>
  ): Promise<BenchmarkSlice> {
    const { data: current, error: fetchError } = await this.supabase
      .from("memory_benchmark_slices")
      .select("*")
      .eq("id", currentSliceId)
      .eq("is_active", true)
      .single();

    if (fetchError || !current) {
      throw new NotFoundError("Active benchmark slice not found");
    }

    const { error: deactivateError } = await this.supabase
      .from("memory_benchmark_slices")
      .update({ is_active: false })
      .eq("id", currentSliceId);

    if (deactivateError) throw deactivateError;

    const newVersion = current.version + 1;
    const combinedMetrics = { ...current.metrics, ...newData.metrics };
    const checksum = generateChecksum(combinedMetrics);

    const newSlice = {
      id: randomUUID(),
      parent_id: current.parent_id || current.id,
      version: newVersion,
      name: newData.name || current.name,
      industry: newData.industry || current.industry,
      geo: newData.geo || current.geo,
      company_size_range:
        newData.company_size_range || current.company_size_range,
      tier: newData.tier || current.tier,
      metrics: combinedMetrics,
      checksum,
      is_active: true,
    };

    const { data, error: insertError } = await this.supabase
      .from("memory_benchmark_slices")
      .insert(newSlice)
      .select()
      .single();

    if (insertError) throw insertError;

    return data as BenchmarkSlice;
  }

  async lockSliceForRun(
    sliceId: string,
    runId: string
  ): Promise<LockedBenchmarkRun> {
    const { data: slice, error: fetchError } = await this.supabase
      .from("memory_benchmark_slices")
      .select("*")
      .eq("id", sliceId)
      .single();

    if (fetchError || !slice) {
      throw new NotFoundError("Slice not found");
    }

    const provenanceHash = createHash("sha256")
      .update(`${slice.checksum}:${runId}`)
      .digest("hex");

    const lockId = `lock_${shortId()}`;

    const { error: insertError } = await this.supabase
      .from("memory_benchmark_run_locks")
      .insert({
        id: lockId,
        slice_id: sliceId,
        run_id: runId,
        provenance_hash: provenanceHash,
      });

    if (insertError) throw insertError;

    return {
      lock_id: lockId,
      slice_id: sliceId,
      provenance_hash: provenanceHash,
      timestamp: new Date(),
    };
  }

  async createSlice(data: {
    name: string;
    industry: string;
    geo: string;
    company_size_range: string;
    tier: BenchmarkTier;
    metrics: Record<string, unknown>;
  }): Promise<BenchmarkSlice> {
    const checksum = generateChecksum(data.metrics);

    const { data: slice, error } = await this.supabase
      .from("memory_benchmark_slices")
      .insert({
        id: randomUUID(),
        name: data.name,
        industry: data.industry,
        geo: data.geo,
        company_size_range: data.company_size_range,
        tier: data.tier,
        metrics: data.metrics,
        checksum,
        version: 1,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return slice as BenchmarkSlice;
  }

  async getSliceById(sliceId: string): Promise<BenchmarkSlice | null> {
    const { data, error } = await this.supabase
      .from("memory_benchmark_slices")
      .select("*")
      .eq("id", sliceId)
      .single();

    if (error) return null;
    return data as BenchmarkSlice;
  }

  async getSliceHistory(parentId: string): Promise<BenchmarkSlice[]> {
    const { data, error } = await this.supabase
      .from("memory_benchmark_slices")
      .select("*")
      .or(`id.eq.${parentId},parent_id.eq.${parentId}`)
      .order("version", { ascending: false });

    if (error) throw error;
    return data as BenchmarkSlice[];
  }

  async getLatestValue(benchmarkId: string): Promise<BenchmarkSlice> {
    const { data, error } = await this.supabase
      .from("memory_benchmark_slices")
      .select("*")
      .or(`id.eq.${benchmarkId},parent_id.eq.${benchmarkId}`)
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
        tier: BenchmarkTier.TIER_2,
        metrics: { value: 1.0 },
        checksum: "",
        is_active: true,
        created_at: new Date(),
      };
    }

    return data as BenchmarkSlice;
  }

  async deactivateSlice(sliceId: string): Promise<void> {
    const { error } = await this.supabase
      .from("memory_benchmark_slices")
      .update({ is_active: false })
      .eq("id", sliceId);

    if (error) throw error;
  }
}
