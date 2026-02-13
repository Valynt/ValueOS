-- Evidence-tier downgrade guardrail tests

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'assumptions_evidence_downgrade_guardrail'
  ) THEN
    RAISE EXCEPTION 'Expected assumptions downgrade guardrail trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'provenance_records_evidence_downgrade_guardrail'
  ) THEN
    RAISE EXCEPTION 'Expected provenance_records downgrade guardrail trigger is missing';
  END IF;
END $$;

DO $$
DECLARE
  blocked boolean := false;
BEGIN
  CREATE TEMP TABLE assumptions_guardrail_test (
    id uuid PRIMARY KEY,
    evidence_tier public.evidence_tier NOT NULL,
    source_provenance text NOT NULL,
    override_downgrade boolean NOT NULL DEFAULT false,
    override_justification text,
    controller_approval_marker text,
    controller_approved_at timestamptz
  ) ON COMMIT DROP;

  CREATE TRIGGER assumptions_guardrail_test_trigger
    BEFORE UPDATE ON assumptions_guardrail_test
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_evidence_downgrade_guardrail();

  INSERT INTO assumptions_guardrail_test (id, evidence_tier, source_provenance)
  VALUES (gen_random_uuid(), 'platinum', 'crm');

  BEGIN
    UPDATE assumptions_guardrail_test
    SET evidence_tier = 'gold'
    WHERE source_provenance = 'crm';
  EXCEPTION WHEN OTHERS THEN
    blocked := true;
  END;

  IF NOT blocked THEN
    RAISE EXCEPTION 'Illegal evidence downgrade (platinum -> gold) was not blocked';
  END IF;
END $$;

DO $$
DECLARE
  applied boolean := false;
BEGIN
  CREATE TEMP TABLE provenance_guardrail_test (
    id uuid PRIMARY KEY,
    evidence_tier public.evidence_tier NOT NULL,
    source_provenance text NOT NULL,
    override_downgrade boolean NOT NULL DEFAULT false,
    override_justification text,
    controller_approval_marker text,
    controller_approved_at timestamptz
  ) ON COMMIT DROP;

  CREATE TRIGGER provenance_guardrail_test_trigger
    BEFORE UPDATE ON provenance_guardrail_test
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_evidence_downgrade_guardrail();

  INSERT INTO provenance_guardrail_test (id, evidence_tier, source_provenance)
  VALUES (gen_random_uuid(), 'platinum', 'agent_inference');

  UPDATE provenance_guardrail_test
  SET
    evidence_tier = 'gold',
    override_downgrade = true,
    override_justification = 'Controller-approved downgrade due to superseded external contract terms.',
    controller_approval_marker = 'controller-approval:qa-001'
  WHERE source_provenance = 'agent_inference';

  SELECT controller_approved_at IS NOT NULL INTO applied
  FROM provenance_guardrail_test
  LIMIT 1;

  IF NOT applied THEN
    RAISE EXCEPTION 'Expected controller_approved_at to be auto-populated for explicit downgrade override';
  END IF;
END $$;
