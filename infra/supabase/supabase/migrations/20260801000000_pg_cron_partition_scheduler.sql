-- Schedule monthly partition maintenance for high-volume partitioned tables.
-- Idempotent by design: re-running keeps exactly one active job with the expected cadence/command.

SET search_path = public, pg_temp;

BEGIN;

-- Enable pg_cron when available in the environment.
-- Wrapped to survive Supabase supautils hook.
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN others THEN RAISE NOTICE 'pg_cron: skipped (%)' , SQLERRM; END $$;

DO $$
DECLARE
  existing_job_id integer;
  duplicate_job_id integer;
  monthly_schedule text := '0 0 1 * *';
  maintenance_command text := 'SELECT public.create_next_monthly_partitions();';
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job is unavailable; skipping partition scheduler registration';
    RETURN;
  END IF;

  IF to_regprocedure('public.create_next_monthly_partitions()') IS NULL THEN
    RAISE EXCEPTION 'Required function public.create_next_monthly_partitions() was not found';
  END IF;

  SELECT jobid
    INTO existing_job_id
    FROM cron.job
   WHERE jobname = 'partition-monthly'
   ORDER BY jobid
   LIMIT 1;

  IF existing_job_id IS NULL THEN
    PERFORM cron.schedule(
      'partition-monthly',
      monthly_schedule,
      maintenance_command
    );
  ELSE
    UPDATE cron.job
       SET schedule = monthly_schedule,
           command = maintenance_command,
           active = true
     WHERE jobid = existing_job_id;
  END IF;

  FOR duplicate_job_id IN
    SELECT jobid
      FROM cron.job
     WHERE jobname = 'partition-monthly'
       AND jobid <> existing_job_id
  LOOP
    PERFORM cron.unschedule(duplicate_job_id);
  END LOOP;
END
$$;

COMMIT;
