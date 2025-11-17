# Epic 4 — Orchestration Layer Refactor: Gap-Closure Execution Plan

This runbook converts the Epic 4 gaps into immediately executable steps. Commands assume a Supabase-compatible Postgres endpoint available in `$DATABASE_URL` and access to the existing orchestration schema (`workflow_definitions`, `workflow_executions`, `workflow_execution_logs`, `workflow_events`, `agents`, `task_queue`). Apply sections independently as needed.

## 1) Define Lifecycle DAGs (Initiate → Target → Realize → Integrity)
**Command:** seed canonical DAGs with explicit stage ordering and idempotent upserts.
```bash
psql "$DATABASE_URL" <<'SQL'
INSERT INTO workflow_definitions (name, description, version, dag_schema, is_active, created_by)
VALUES
  ('lifecycle_v1', 'E2E lifecycle orchestration', 1, '{
    "stages": [
      {"id": "discover", "next": ["qualify"], "capability": "opportunity"},
      {"id": "qualify", "next": ["target_design"], "capability": "assessment"},
      {"id": "target_design", "next": ["value_realization"], "capability": "design"},
      {"id": "value_realization", "next": ["integrity"], "capability": "execution"},
      {"id": "integrity", "next": [], "capability": "governance"}
    ],
    "edges": [
      {"from": "discover", "to": "qualify"},
      {"from": "qualify", "to": "target_design"},
      {"from": "target_design", "to": "value_realization"},
      {"from": "value_realization", "to": "integrity"}
    ]
  }'::jsonb, true, auth.uid())
ON CONFLICT (name, version) DO UPDATE
SET dag_schema = EXCLUDED.dag_schema, description = EXCLUDED.description, is_active = true;
SQL
```

## 2) Rollback Compensation Hooks
**Command:** attach a compensation function that rewinds artifacts and logs rollback events.
```bash
psql "$DATABASE_URL" <<'SQL'
CREATE OR REPLACE FUNCTION perform_workflow_compensation(p_execution_id uuid, p_reason text)
RETURNS void AS $$
BEGIN
  INSERT INTO workflow_events (execution_id, event_type, stage_id, metadata)
  VALUES (p_execution_id, 'workflow_rolled_back', 'compensation', jsonb_build_object('reason', p_reason));

  UPDATE workflow_execution_logs
    SET status = 'skipped'
  WHERE execution_id = p_execution_id AND status IN ('pending', 'in_progress');

  UPDATE workflow_executions
    SET status = 'rolled_back', error_message = p_reason, updated_at = now()
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;
SQL
```

## 3) Stage-Level Retries with Backoff
**Command:** deterministic retry with capped backoff using `attempt_number` in `workflow_execution_logs`.
```bash
psql "$DATABASE_URL" <<'SQL'
CREATE OR REPLACE FUNCTION retry_stage(p_log_id uuid, p_max_attempts int DEFAULT 3)
RETURNS void AS $$
DECLARE
  v_attempt int;
BEGIN
  SELECT attempt_number INTO v_attempt FROM workflow_execution_logs WHERE id = p_log_id FOR UPDATE;
  IF v_attempt >= p_max_attempts THEN
    UPDATE workflow_execution_logs SET status = 'failed', completed_at = now() WHERE id = p_log_id;
    RETURN;
  END IF;

  UPDATE workflow_execution_logs
    SET attempt_number = v_attempt + 1,
        status = 'pending',
        started_at = now() + make_interval(secs => power(2, v_attempt)),
        error_message = NULL
    WHERE id = p_log_id;

  INSERT INTO workflow_events (execution_id, event_type, stage_id, metadata)
  SELECT execution_id, 'stage_retrying', stage_id, jsonb_build_object('attempt', v_attempt + 1)
  FROM workflow_execution_logs WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql;
SQL
```

## 4) Circuit Breaker Guardrail
**Command:** fail fast when error budget or latency SLA is exceeded; persist breaker state.
```bash
psql "$DATABASE_URL" <<'SQL'
CREATE OR REPLACE FUNCTION trip_circuit_breaker(p_execution_id uuid, p_reason text)
RETURNS void AS $$
BEGIN
  UPDATE workflow_executions
    SET status = 'failed',
        circuit_breaker_state = jsonb_build_object('tripped_at', now(), 'reason', p_reason),
        updated_at = now()
    WHERE id = p_execution_id;

  INSERT INTO workflow_events (execution_id, event_type, metadata)
  VALUES (p_execution_id, 'workflow_failed', jsonb_build_object('reason', p_reason));
END;
$$ LANGUAGE plpgsql;
SQL
```

## 5) Workflow Audit Logging (Structured)
**Command:** create an insert-only audit view that joins execution, logs, and events.
```bash
psql "$DATABASE_URL" <<'SQL'
CREATE OR REPLACE VIEW workflow_audit_feed AS
SELECT
  we.id AS execution_id,
  wd.name AS workflow_name,
  wd.version,
  wel.stage_id,
  wel.status AS stage_status,
  wel.attempt_number,
  wel.started_at,
  wel.completed_at,
  wel.error_message,
  we.status AS workflow_status,
  we.circuit_breaker_state,
  we.context,
  e.event_type,
  e.metadata,
  e.timestamp AS event_timestamp
FROM workflow_executions we
JOIN workflow_definitions wd ON wd.id = we.workflow_definition_id
LEFT JOIN workflow_execution_logs wel ON wel.execution_id = we.id
LEFT JOIN workflow_events e ON e.execution_id = we.id
ORDER BY e.timestamp DESC NULLS LAST, wel.started_at DESC NULLS LAST;
SQL
```

## 6) Workflow Definition Versioning and Activation
**Command:** publish a new version, deactivate the old one atomically.
```bash
psql "$DATABASE_URL" <<'SQL'
WITH current AS (
  SELECT id, version, dag_schema FROM workflow_definitions WHERE name = 'lifecycle_v1' AND is_active = true ORDER BY version DESC LIMIT 1
), new_def AS (
  INSERT INTO workflow_definitions (name, description, version, dag_schema, is_active, created_by)
  SELECT 'lifecycle_v1', 'Lifecycle DAG v2 with integrity checks', current.version + 1,
         current.dag_schema || jsonb_build_object('stages', (current.dag_schema->'stages') || jsonb_build_array(jsonb_build_object('id','post_integrity','next',jsonb_build_array(),'capability','audit'))),
         true, '00000000-0000-0000-0000-000000000000'
  FROM current
  RETURNING id, version
)
UPDATE workflow_definitions
SET is_active = false
WHERE name = 'lifecycle_v1' AND id <> (SELECT id FROM new_def);
SQL
```

## 7) Agent Routing Logic
**Command:** map DAG stage capabilities to agents and enqueue tasks via `task_queue`.
```bash
psql "$DATABASE_URL" <<'SQL'
-- Route by capability → agent.name
INSERT INTO agent_ontologies (agent_id, domain, knowledge, version)
SELECT a.id, 'orchestration', jsonb_build_object('capability', c.capability), 1
FROM (VALUES ('opportunity','Opportunity Agent'),('assessment','Assessment Agent'),('design','Design Agent'),('execution','Realization Agent'),('governance','Integrity Agent')) AS c(capability, agent_name)
JOIN agents a ON a.name = c.agent_name
ON CONFLICT (agent_id, domain, version) DO NOTHING;

-- Enqueue pending tasks for active executions
INSERT INTO task_queue (workflow_execution_id, task_type, input_data)
SELECT wel.execution_id, wel.stage_id, wel.input_data
FROM workflow_execution_logs wel
JOIN workflow_executions we ON we.id = wel.execution_id
WHERE wel.status = 'pending' AND we.status = 'in_progress';
SQL
```

## 8) Smoke Test the Orchestrator Path
**Command:** create a workflow execution and drive a happy-path completion.
```bash
psql "$DATABASE_URL" <<'SQL'
-- Create execution instance
WITH def AS (
  SELECT id FROM workflow_definitions WHERE name = 'lifecycle_v1' AND is_active = true ORDER BY version DESC LIMIT 1
)
INSERT INTO workflow_executions (workflow_definition_id, status, current_stage, context, created_by)
SELECT id, 'in_progress', 'discover', jsonb_build_object('customer','ACME Corp'), auth.uid() FROM def
RETURNING id;
SQL
```
After obtaining the `id`, mark the first stage as complete and advance:
```bash
EXECUTION_ID=<returned-uuid>
psql "$DATABASE_URL" <<SQL
INSERT INTO workflow_execution_logs (execution_id, stage_id, status, started_at, completed_at, attempt_number, output_data)
VALUES ('$EXECUTION_ID', 'discover', 'completed', now(), now(), 1, jsonb_build_object('summary','captured'));

UPDATE workflow_executions SET current_stage = 'qualify' WHERE id = '$EXECUTION_ID';
SQL
```
Repeat for subsequent stages to validate event logging and audit feed population.
