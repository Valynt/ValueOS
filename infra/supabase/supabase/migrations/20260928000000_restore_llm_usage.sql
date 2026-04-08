-- Restore llm_usage table to the active migration chain.
--
-- The original CREATE TABLE lived in archive/deferred-superseded/20240101000000_release_v1.sql
-- and archive/pre-initial-release-2026-03/20260213000002_baseline_schema.sql. Those archives
-- are excluded from clean DB rebuilds, so LLMCostTracker.trackUsage() silently failed on
-- fresh environments. This migration promotes the canonical schema into the active chain.
--
-- Schema matches docs/db/schema_snapshot.sql exactly, including the column additions from
-- archive/deferred-superseded/20260205000000_canonicalize_llm_usage_schema.sql.
--
-- RLS classification: own_row
--   Users may INSERT their own rows (auth.uid() = user_id) or via service_role.
--   Users may SELECT only their own rows; admins may SELECT all.
--   service_role has full access (bypasses RLS).

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

CREATE TABLE IF NOT EXISTS public.llm_usage (
    id                 uuid             DEFAULT gen_random_uuid() NOT NULL,
    tenant_id          uuid,
    user_id            uuid             NOT NULL,
    session_id         uuid,
    provider           text             NOT NULL,
    model              text             NOT NULL,
    prompt_tokens      integer          NOT NULL,
    completion_tokens  integer          NOT NULL,
    total_tokens       integer          GENERATED ALWAYS AS ((prompt_tokens + completion_tokens)) STORED,
    estimated_cost     numeric(10,6)    NOT NULL,
    -- Canonical aliases added by 20260205 canonicalize migration (archived).
    -- Included here so a clean rebuild has the full column set from the start.
    input_tokens       integer,
    output_tokens      integer,
    cost               numeric(10,6),
    endpoint           text             NOT NULL,
    success            boolean          DEFAULT true NOT NULL,
    error_message      text,
    latency_ms         integer,
    created_at         timestamptz      DEFAULT now() NOT NULL,
    CONSTRAINT llm_usage_completion_tokens_check CHECK ((completion_tokens >= 0)),
    CONSTRAINT llm_usage_estimated_cost_check    CHECK ((estimated_cost >= (0)::numeric)),
    CONSTRAINT llm_usage_latency_ms_check        CHECK ((latency_ms >= 0)),
    CONSTRAINT llm_usage_prompt_tokens_check     CHECK ((prompt_tokens >= 0)),
    CONSTRAINT llm_usage_provider_check          CHECK ((provider = ANY (ARRAY['together_ai'::text, 'openai'::text])))
);

COMMENT ON TABLE public.llm_usage IS 'Tracks all LLM API calls with costs and performance metrics';

ALTER TABLE public.llm_usage ADD CONSTRAINT llm_usage_pkey PRIMARY KEY (id);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at
    ON public.llm_usage USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_model
    ON public.llm_usage USING btree (model);

CREATE INDEX IF NOT EXISTS idx_llm_usage_provider
    ON public.llm_usage USING btree (provider);

CREATE INDEX IF NOT EXISTS idx_llm_usage_session_id
    ON public.llm_usage USING btree (session_id);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_date_cost
    ON public.llm_usage USING btree (user_id, created_at DESC, estimated_cost);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id
    ON public.llm_usage USING btree (user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

-- Users may insert their own rows; service_role workers may insert for any user.
DROP POLICY IF EXISTS llm_usage_insert_own ON public.llm_usage;
CREATE POLICY llm_usage_insert_own ON public.llm_usage
    FOR INSERT
    WITH CHECK (
        (auth.uid() = user_id)
        OR ((auth.jwt() ->> 'role') = 'service_role')
    );

-- Users may read their own rows; admins may read all.
DROP POLICY IF EXISTS llm_usage_select_own ON public.llm_usage;
CREATE POLICY llm_usage_select_own ON public.llm_usage
    FOR SELECT
    USING (
        (auth.uid() = user_id)
        OR ((auth.jwt() ->> 'role') = 'admin')
    );

-- ── Grants ────────────────────────────────────────────────────────────────────

REVOKE ALL ON public.llm_usage FROM anon;
GRANT SELECT ON public.llm_usage TO anon;
GRANT SELECT ON public.llm_usage TO authenticated;
GRANT ALL   ON public.llm_usage TO service_role;

-- ── Legacy compatibility view ─────────────────────────────────────────────────
-- Mirrors the view created by the archived canonicalize migration so any
-- code referencing llm_usage_legacy_compat continues to work on clean rebuilds.

CREATE OR REPLACE VIEW public.llm_usage_legacy_compat AS
SELECT
    id,
    tenant_id,
    user_id,
    session_id,
    model,
    input_tokens  AS prompt_tokens,
    output_tokens AS completion_tokens,
    total_tokens,
    cost          AS estimated_cost,
    created_at    AS "timestamp",
    created_at
FROM public.llm_usage;

GRANT SELECT ON public.llm_usage_legacy_compat TO authenticated;

COMMIT;
