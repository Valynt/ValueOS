-- ============================================================================
-- Deal Assembly Pipeline — Deal Contexts, Stakeholders, and Use Cases (Rollback)
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.use_cases;
DROP TABLE IF EXISTS public.stakeholders;
DROP TABLE IF EXISTS public.deal_context_sources;
DROP TABLE IF EXISTS public.deal_contexts;

COMMIT;
