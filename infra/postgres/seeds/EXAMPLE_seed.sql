-- EXAMPLE_seed.sql
-- Purpose: example seed to exercise data-level behavior after applying migrations.

INSERT INTO public.example_table (id, name, created_at)
VALUES (1, 'seed-example', now())
ON CONFLICT (id) DO NOTHING;
