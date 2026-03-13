-- Rollback: 20260802000000_projects
-- Drops the projects table.

BEGIN;

DROP TABLE IF EXISTS public.projects CASCADE;

COMMIT;
