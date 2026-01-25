-- Performance optimization indexes for tenant isolation and foreign keys

-- Add tenant_id indexes for frequent RLS filtering
CREATE INDEX IF NOT EXISTS idx_memory_artifact_chunks_tenant ON public.memory_artifact_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memory_value_cases_tenant ON public.memory_value_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memory_narratives_tenant ON public.memory_narratives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memory_benchmark_datasets_tenant ON public.memory_benchmark_datasets(tenant_id);

-- Add foreign key indexes for join performance
CREATE INDEX IF NOT EXISTS idx_memory_benchmark_versions_dataset ON public.memory_benchmark_versions(dataset_id);
