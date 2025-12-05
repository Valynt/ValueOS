-- Tenant cost summary view migration
-- NOTE: Ensure tables usage_events and llm_usage exist before applying.

CREATE OR REPLACE VIEW tenant_cost_summary AS
WITH tenant_tokens AS (
  SELECT
    tenant_id,
    SUM(amount) AS total_llm_tokens
  FROM usage_events
  WHERE metric = 'llm_tokens'
  GROUP BY tenant_id
),
global_tokens AS (
  SELECT SUM(total_llm_tokens) AS total_tokens FROM tenant_tokens
),
global_cost AS (
  SELECT COALESCE(SUM(estimated_cost), 0) AS total_cost FROM llm_usage
)
SELECT
  t.tenant_id,
  t.total_llm_tokens,
  CASE
    WHEN g.total_tokens > 0 THEN
      (t.total_llm_tokens::numeric / g.total_tokens::numeric) * c.total_cost
    ELSE 0
  END AS approx_llm_cost_usd
FROM tenant_tokens t
CROSS JOIN global_tokens g
CROSS JOIN global_cost c;
