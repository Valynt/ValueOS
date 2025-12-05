-- Enable pg_stat_statements for slow query introspection
create extension if not exists pg_stat_statements with schema extensions;

comment on extension pg_stat_statements is 'Track execution statistics of all SQL statements executed by the server';

-- Harden tracking so we can surface long-running statements
select set_config('pg_stat_statements.track', 'all', false);
select set_config('pg_stat_statements.max', '20000', false);

-- Materialize a view for quick dashboard access to queries above 200ms
create schema if not exists observability;

create or replace view observability.slow_queries as
select
  queryid,
  regexp_replace(query, '\\s+', ' ', 'g') as query_text,
  calls,
  total_exec_time,
  mean_exec_time,
  rows
from pg_stat_statements
where mean_exec_time > 200
order by total_exec_time desc
limit 10;
