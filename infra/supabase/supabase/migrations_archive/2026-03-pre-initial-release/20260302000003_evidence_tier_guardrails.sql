-- Canonical evidence taxonomy + downgrade guardrails.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'evidence_tier'
  ) THEN
    CREATE TYPE public.evidence_tier AS ENUM ('silver', 'gold', 'platinum');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.evidence_tier_rank(p_tier public.evidence_tier)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'silver'::public.evidence_tier THEN 1
    WHEN 'gold'::public.evidence_tier THEN 2
    WHEN 'platinum'::public.evidence_tier THEN 3
  END;
$$;

DO $$
BEGIN
  IF to_regclass('public.assumptions') IS NOT NULL THEN
    ALTER TABLE public.assumptions
      ADD COLUMN IF NOT EXISTS evidence_tier public.evidence_tier NOT NULL DEFAULT 'silver',
      ADD COLUMN IF NOT EXISTS source_provenance text NOT NULL DEFAULT 'agent_inference',
      ADD COLUMN IF NOT EXISTS override_downgrade boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS override_justification text,
      ADD COLUMN IF NOT EXISTS controller_approval_marker text,
      ADD COLUMN IF NOT EXISTS controller_approved_at timestamptz;

    ALTER TABLE public.assumptions DROP CONSTRAINT IF EXISTS assumptions_source_provenance_check;
    ALTER TABLE public.assumptions
      ADD CONSTRAINT assumptions_source_provenance_check
      CHECK (source_provenance IN ('crm', 'erp', 'agent_inference', 'user', 'benchmark', 'system'));
  END IF;

  IF to_regclass('public.provenance_records') IS NOT NULL THEN
    ALTER TABLE public.provenance_records
      ADD COLUMN IF NOT EXISTS evidence_tier public.evidence_tier NOT NULL DEFAULT 'silver',
      ADD COLUMN IF NOT EXISTS source_provenance text NOT NULL DEFAULT 'agent_inference',
      ADD COLUMN IF NOT EXISTS override_downgrade boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS override_justification text,
      ADD COLUMN IF NOT EXISTS controller_approval_marker text,
      ADD COLUMN IF NOT EXISTS controller_approved_at timestamptz;

    ALTER TABLE public.provenance_records DROP CONSTRAINT IF EXISTS provenance_records_source_provenance_check;
    ALTER TABLE public.provenance_records
      ADD CONSTRAINT provenance_records_source_provenance_check
      CHECK (source_provenance IN ('crm', 'erp', 'agent_inference', 'user', 'benchmark', 'system'));
  END IF;

  IF to_regclass('public.evidence_items') IS NOT NULL THEN
    ALTER TABLE public.evidence_items
      ADD COLUMN IF NOT EXISTS evidence_tier public.evidence_tier,
      ADD COLUMN IF NOT EXISTS source_provenance text NOT NULL DEFAULT 'agent_inference',
      ADD COLUMN IF NOT EXISTS override_downgrade boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS override_justification text,
      ADD COLUMN IF NOT EXISTS controller_approval_marker text,
      ADD COLUMN IF NOT EXISTS controller_approved_at timestamptz;

    UPDATE public.evidence_items
    SET evidence_tier = CASE tier
      WHEN 1 THEN 'silver'::public.evidence_tier
      WHEN 2 THEN 'gold'::public.evidence_tier
      ELSE 'platinum'::public.evidence_tier
    END
    WHERE evidence_tier IS NULL;

    ALTER TABLE public.evidence_items
      ALTER COLUMN evidence_tier SET NOT NULL;

    ALTER TABLE public.evidence_items DROP CONSTRAINT IF EXISTS evidence_items_source_provenance_check;
    ALTER TABLE public.evidence_items
      ADD CONSTRAINT evidence_items_source_provenance_check
      CHECK (source_provenance IN ('crm', 'erp', 'agent_inference', 'user', 'benchmark', 'system'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_evidence_downgrade_guardrail()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.evidence_tier_rank(NEW.evidence_tier) < public.evidence_tier_rank(OLD.evidence_tier) THEN
    IF NOT NEW.override_downgrade
       OR COALESCE(length(trim(NEW.override_justification)), 0) < 15
       OR COALESCE(length(trim(NEW.controller_approval_marker)), 0) = 0 THEN
      RAISE EXCEPTION
        'Evidence tier downgrade requires override_downgrade=true, detailed justification, and controller_approval_marker.';
    END IF;

    IF NEW.controller_approved_at IS NULL THEN
      NEW.controller_approved_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Old append-only trigger conflicts with guarded override workflow.
DROP TRIGGER IF EXISTS provenance_records_no_update ON public.provenance_records;

DROP TRIGGER IF EXISTS assumptions_evidence_downgrade_guardrail ON public.assumptions;
CREATE TRIGGER assumptions_evidence_downgrade_guardrail
  BEFORE UPDATE ON public.assumptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_evidence_downgrade_guardrail();

DROP TRIGGER IF EXISTS provenance_records_evidence_downgrade_guardrail ON public.provenance_records;
CREATE TRIGGER provenance_records_evidence_downgrade_guardrail
  BEFORE UPDATE ON public.provenance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_evidence_downgrade_guardrail();

DO $$
BEGIN
  IF to_regclass('public.evidence_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS evidence_items_evidence_downgrade_guardrail ON public.evidence_items;
    CREATE TRIGGER evidence_items_evidence_downgrade_guardrail
      BEFORE UPDATE ON public.evidence_items
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_evidence_downgrade_guardrail();
  END IF;
END $$;
