import { createPlatformAdminSupabaseClient } from "./platformAdmin.js";

export interface ReadGlobalBenchmarksOptions {
  industry: string;
  kpiName?: string;
}

/**
 * Global benchmark catalog read isolated behind an allowlisted privileged module.
 * This is only used as a fallback when request-scoped customer-token access to
 * `benchmarks` fails due to token transport/RLS context mismatches.
 */
export async function readGlobalBenchmarksByIndustry(options: ReadGlobalBenchmarksOptions) {
  const privilegedClient = createPlatformAdminSupabaseClient({
    justification:
      "service-role:justified customer portal fallback read for global benchmarks reference catalog",
  });

  let query = privilegedClient
    .from("benchmarks")
    .select("*")
    .eq("industry", options.industry)
    .order("kpi_name");

  if (options.kpiName) {
    query = query.eq("kpi_name", options.kpiName);
  }

  return query;
}
