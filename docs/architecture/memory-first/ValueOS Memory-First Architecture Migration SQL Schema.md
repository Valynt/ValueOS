```sql
-- ValueOS Memory-First Architecture Migration
-- Description: Production-ready SQL schema for a B2B deal-centric knowledge OS.
-- Features: Multi-tenancy via RLS, pgvector HNSW indexing, Hybrid Search, and Governance.

-- ==========================================
-- 1. EXTENSIONS & INITIAL SETUP
-- ==========================================

create extension if not exists "vector" with schema "public";
create extension if not exists "uuid-ossp" with schema "public";
create extension if not exists "fuzzystrmatch" with schema "public";

-- Create a schema-specific search path security helper
create or replace function public.get_tenant_id()
returns uuid language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- ==========================================
-- 2. CORE IDENTITY & ISOLATION
-- ==========================================

-- Tenants (Companies/Accounts)
create table public.tenants (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    slug text unique not null,
    settings jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Profiles (Extends Supabase Auth)
create table public.profiles (
    id uuid primary key references auth.users on delete cascade,
    tenant_id uuid not null references public.tenants(id),
    full_name text,
    role text check (role in ('admin', 'editor', 'viewer', 'guest')),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- ==========================================
-- 3. THE KNOWLEDGE INPUT LAYER
-- ==========================================

-- Value Cases (High-level business initiatives or deals)
create table public.value_cases (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    title text not null,
    description text,
    status text default 'active' check (status in ('active', 'archived', 'won', 'lost')),
    fts tsvector generated always as (to_tsvector('english', title || ' ' || coalesce(description, ''))) stored,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Artifacts (Documents, Emails, Transcripts)
create table public.artifacts (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    value_case_id uuid references public.value_cases(id) on delete set null,
    source_url text,
    title text not null,
    content_type text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null
);

-- Artifact Chunks (Vectorized segments)
create table public.artifact_chunks (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    artifact_id uuid not null references public.artifacts(id) on delete cascade,
    content text not null,
    embedding vector(1536), -- Optimized for OpenAI/Modern embeddings
    chunk_index int not null,
    fts tsvector generated always as (to_tsvector('english', content)) stored,
    metadata jsonb default '{}'::jsonb
);

-- ==========================================
-- 4. SEMANTIC LAYER (KNOWLEDGE GRAPH)
-- ==========================================

-- Entities (Extracted people, companies, technologies)
create table public.entities (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    name text not null,
    entity_type text not null, -- e.g., 'PERSON', 'ORG', 'PRODUCT'
    description text,
    embedding vector(1536),
    fts tsvector generated always as (to_tsvector('english', name || ' ' || coalesce(description, ''))) stored,
    created_at timestamptz default now() not null
);

-- Entity Edges (Relationships in the Graph)
create table public.entity_edges (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    source_id uuid not null references public.entities(id) on delete cascade,
    target_id uuid not null references public.entities(id) on delete cascade,
    relationship_type text not null, -- e.g., 'WORKS_AT', 'COMPETES_WITH'
    weight float default 1.0,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null
);

-- ==========================================
-- 5. HIGH-FIDELITY KNOWLEDGE (FACTS)
-- ==========================================

-- Facts (Curated Truths with Versioning)
create table public.facts (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    claim text not null,
    status text default 'draft' check (status in ('draft', 'approved', 'deprecated')),
    version int default 1 not null,
    embedding vector(1536),
    fts tsvector generated always as (to_tsvector('english', claim)) stored,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    created_by uuid references public.profiles(id)
);

-- Fact Evidence (Provenance/Lineage)
create table public.fact_evidence (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    fact_id uuid not null references public.facts(id) on delete cascade,
    chunk_id uuid references public.artifact_chunks(id),
    quote text,
    confidence_score float,
    created_at timestamptz default now() not null
);

-- ==========================================
-- 6. EVALUATION & BENCHMARKING
-- ==========================================

create table public.benchmark_datasets (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    name text not null,
    description text,
    created_at timestamptz default now() not null
);

create table public.benchmark_versions (
    id uuid primary key default uuid_generate_v4(),
    dataset_id uuid not null references public.benchmark_datasets(id) on delete cascade,
    version_tag text not null,
    is_active boolean default false,
    created_at timestamptz default now() not null
);

create table public.benchmark_slices (
    id uuid primary key default uuid_generate_v4(),
    version_id uuid not null references public.benchmark_versions(id) on delete cascade,
    slice_name text not null, -- e.g., 'Technical Questions', 'Pricing Queries'
    filter_criteria jsonb default '{}'::jsonb
);

-- Model Runs (Tracking Agentic Actions)
create table public.model_runs (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    model_name text not null,
    input_prompt text,
    output_response text,
    tokens_used int,
    latency_ms int,
    status text default 'success',
    created_at timestamptz default now() not null
);

create table public.model_run_evidence (
    id uuid primary key default uuid_generate_v4(),
    model_run_id uuid not null references public.model_runs(id) on delete cascade,
    fact_id uuid references public.facts(id),
    relevance_score float
);

-- ==========================================
-- 7. NARRATIVES & APPROVALS
-- ==========================================

-- Narratives (AI Generated reports/outbound content)
create table public.narratives (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    value_case_id uuid references public.value_cases(id),
    title text not null,
    body text not null,
    status text default 'draft' check (status in ('draft', 'review', 'final', 'deprecated')),
    version int default 1 not null,
    fts tsvector generated always as (to_tsvector('english', title || ' ' || body)) stored,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Approvals (Audit Trail)
create table public.approvals (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    resource_type text not null, -- 'fact', 'narrative'
    resource_id uuid not null,
    approver_id uuid references public.profiles(id),
    decision text check (decision in ('approved', 'rejected')),
    comments text,
    created_at timestamptz default now() not null
);

-- ==========================================
-- 8. SECURITY & GUEST ACCESS
-- ==========================================

-- Access Grants (For Guest Links or External Collab)
create table public.access_grants (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id),
    resource_type text not null,
    resource_id uuid not null,
    grantee_email text,
    token_hash text unique,
    expires_at timestamptz,
    created_at timestamptz default now() not null
);

-- ==========================================
-- 9. PERFORMANCE INDEXING
-- ==========================================

-- HNSW Vector Indexes (Optimized for Cosine Similarity)
create index idx_artifact_chunks_embedding on public.artifact_chunks 
using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

create index idx_entities_embedding on public.entities 
using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

create index idx_facts_embedding on public.facts 
using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

-- GIN Full Text Search Indexes
create index idx_value_cases_fts on public.value_cases using gin(fts);
create index idx_artifact_chunks_fts on public.artifact_chunks using gin(fts);
create index idx_entities_fts on public.entities using gin(fts);
create index idx_facts_fts on public.facts using gin(fts);
create index idx_narratives_fts on public.narratives using gin(fts);

-- ==========================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
do $$ 
declare 
    t text;
begin
    for t in (select table_name from information_schema.tables where table_schema = 'public') 
    loop
        execute format('alter table public.%I enable row level security', t);
    end loop;
end $$;

-- Policy Template: Tenant Isolation
-- Applies to all tables with tenant_id
do $$ 
declare 
    t text;
begin
    for t in (select table_name from information_schema.columns where column_name = 'tenant_id' and table_schema = 'public') 
    loop
        execute format('
            create policy "Tenant Access" on public.%I
            for all using (
                tenant_id = public.get_tenant_id()
                or 
                exists (
                    select 1 from public.access_grants 
                    where resource_id = id 
                    and (grantee_email = auth.jwt()->>''email'' or token_hash = current_setting(''app.guest_token'', true))
                    and (expires_at is null or expires_at > now())
                )
            )', t);
    end loop;
end $$;

-- Special Case: Profiles (Users can see their own profile and coworkers)
create policy "Profile Access" on public.profiles
for select using (tenant_id = public.get_tenant_id());

-- Special Case: Tenants (Only admins can see tenant config)
create policy "Tenant Visibility" on public.tenants
for select using (id = public.get_tenant_id());

-- ==========================================
-- 11. HYBRID SEARCH UTILITY FUNCTION
-- ==========================================

create or replace function public.hybrid_search_chunks(
    p_tenant_id uuid,
    query_text text,
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    full_text_weight float default 1.0,
    semantic_weight float default 1.0
)
returns table (
    id uuid,
    content text,
    metadata jsonb,
    similarity float,
    fts_rank float,
    combined_score float
)
language sql stable as $$
    with semantic_results as (
        select id, 1 - (embedding <=> query_embedding) as similarity
        from public.artifact_chunks
        where tenant_id = p_tenant_id
        order by embedding <=> query_embedding
        limit match_count * 2
    ),
    fts_results as (
        select id, ts_rank_cd(fts, plainto_tsquery('english', query_text)) as fts_rank
        from public.artifact_chunks
        where tenant_id = p_tenant_id and fts @@ plainto_tsquery('english', query_text)
        limit match_count * 2
    )
    select
        c.id,
        c.content,
        c.metadata,
        coalesce(s.similarity, 0)::float as similarity,
        coalesce(f.fts_rank, 0)::float as fts_rank,
        (coalesce(s.similarity, 0) * semantic_weight + coalesce(f.fts_rank, 0) * full_text_weight) as combined_score
    from public.artifact_chunks c
    left join semantic_results s on c.id = s.id
    left join fts_results f on c.id = f.id
    where c.tenant_id = p_tenant_id
    and (s.similarity > match_threshold or f.fts_rank > 0)
    order by combined_score desc
    limit match_count;
$$;
```