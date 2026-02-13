-- No new tables created; no RLS action required in this migration.
-- Add tenant_id columns + RLS for benchmark tables and model run evidence

alter table public.memory_benchmark_versions
  add column if not exists tenant_id uuid;

alter table public.memory_benchmark_slices
  add column if not exists tenant_id uuid;

alter table public.memory_benchmark_run_locks
  add column if not exists tenant_id uuid;

alter table public.memory_model_run_evidence
  add column if not exists tenant_id uuid;

update public.memory_benchmark_versions as versions
set tenant_id = datasets.tenant_id
from public.memory_benchmark_datasets as datasets
where versions.dataset_id = datasets.id
  and versions.tenant_id is null;

update public.memory_model_run_evidence as evidence
set tenant_id = runs.tenant_id
from public.memory_model_runs as runs
where evidence.model_run_id = runs.id
  and evidence.tenant_id is null;

update public.memory_benchmark_run_locks as locks
set tenant_id = runs.tenant_id
from public.memory_model_runs as runs
where locks.run_id = runs.id
  and locks.tenant_id is null;

update public.memory_benchmark_slices as slices
set tenant_id = runs.tenant_id
from public.memory_benchmark_run_locks as locks
join public.memory_model_runs as runs on runs.id = locks.run_id
where locks.slice_id = slices.id
  and slices.tenant_id is null;

alter table public.memory_benchmark_versions
  alter column tenant_id set not null;

alter table public.memory_benchmark_slices
  alter column tenant_id set not null;

alter table public.memory_benchmark_run_locks
  alter column tenant_id set not null;

alter table public.memory_model_run_evidence
  alter column tenant_id set not null;

alter table public.memory_benchmark_versions
  add constraint memory_benchmark_versions_tenant_fk
  foreign key (tenant_id) references public.memory_tenants(id);

alter table public.memory_benchmark_slices
  add constraint memory_benchmark_slices_tenant_fk
  foreign key (tenant_id) references public.memory_tenants(id);

alter table public.memory_benchmark_run_locks
  add constraint memory_benchmark_run_locks_tenant_fk
  foreign key (tenant_id) references public.memory_tenants(id);

alter table public.memory_model_run_evidence
  add constraint memory_model_run_evidence_tenant_fk
  foreign key (tenant_id) references public.memory_tenants(id);

alter table public.memory_benchmark_versions enable row level security;
alter table public.memory_benchmark_slices enable row level security;
alter table public.memory_benchmark_run_locks enable row level security;
alter table public.memory_model_run_evidence enable row level security;

create policy tenant_isolation_select on public.memory_benchmark_versions
  as restrictive
  for select
  using (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_insert on public.memory_benchmark_versions
  as restrictive
  for insert
  with check (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_update on public.memory_benchmark_versions
  as restrictive
  for update
  using (security.user_has_tenant_access(tenant_id))
  with check (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_delete on public.memory_benchmark_versions
  as restrictive
  for delete
  using (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_select on public.memory_benchmark_slices
  as restrictive
  for select
  using (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_insert on public.memory_benchmark_slices
  as restrictive
  for insert
  with check (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_update on public.memory_benchmark_slices
  as restrictive
  for update
  using (security.user_has_tenant_access(tenant_id))
  with check (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_delete on public.memory_benchmark_slices
  as restrictive
  for delete
  using (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_select on public.memory_benchmark_run_locks
  as restrictive
  for select
  using (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_insert on public.memory_benchmark_run_locks
  as restrictive
  for insert
  with check (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_update on public.memory_benchmark_run_locks
  as restrictive
  for update
  using (security.user_has_tenant_access(tenant_id))
  with check (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_delete on public.memory_benchmark_run_locks
  as restrictive
  for delete
  using (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_select on public.memory_model_run_evidence
  as restrictive
  for select
  using (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_insert on public.memory_model_run_evidence
  as restrictive
  for insert
  with check (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_update on public.memory_model_run_evidence
  as restrictive
  for update
  using (security.user_has_tenant_access(tenant_id))
  with check (security.user_has_tenant_access(tenant_id));

create policy tenant_isolation_delete on public.memory_model_run_evidence
  as restrictive
  for delete
  using (security.user_has_tenant_access(tenant_id));

create index if not exists idx_memory_benchmark_versions_tenant
  on public.memory_benchmark_versions(tenant_id);

create index if not exists idx_memory_benchmark_slices_tenant
  on public.memory_benchmark_slices(tenant_id);

create index if not exists idx_memory_benchmark_run_locks_tenant
  on public.memory_benchmark_run_locks(tenant_id);

create index if not exists idx_memory_model_run_evidence_tenant
  on public.memory_model_run_evidence(tenant_id);
