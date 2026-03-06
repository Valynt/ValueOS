-- Top query fingerprints by total_exec_time, mean_exec_time, and calls.
-- Requires pg_stat_statements extension.
WITH scoped AS (
  SELECT
    queryid,
    calls,
    total_exec_time,
    mean_exec_time,
    rows,
    shared_blks_hit,
    shared_blks_read,
    temp_blks_written,
    query
  FROM pg_stat_statements
  WHERE query NOT ILIKE '%pg_stat_statements%'
)
SELECT
  metric,
  rank,
  queryid,
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  rows,
  shared_blks_hit,
  shared_blks_read,
  temp_blks_written,
  query
FROM (
  SELECT
    'total_exec_time'::text AS metric,
    ROW_NUMBER() OVER (ORDER BY total_exec_time DESC) AS rank,
    *
  FROM scoped

  UNION ALL

  SELECT
    'mean_exec_time'::text AS metric,
    ROW_NUMBER() OVER (ORDER BY mean_exec_time DESC) AS rank,
    *
  FROM scoped

  UNION ALL

  SELECT
    'calls'::text AS metric,
    ROW_NUMBER() OVER (ORDER BY calls DESC) AS rank,
    *
  FROM scoped
) ranked
WHERE rank <= 25
ORDER BY metric, rank;
