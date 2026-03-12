-- Rollback: remove pg_cron job for monthly partition maintenance.
-- Safe to run multiple times.

SET search_path = public, pg_temp;

DO $$
DECLARE
  scheduled_job_id integer;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job is unavailable; nothing to unschedule';
    RETURN;
  END IF;

  FOR scheduled_job_id IN
    SELECT jobid
      FROM cron.job
     WHERE jobname = 'partition-monthly'
        OR command = 'SELECT public.create_next_monthly_partitions();'
  LOOP
    PERFORM cron.unschedule(scheduled_job_id);
  END LOOP;
END
$$;
