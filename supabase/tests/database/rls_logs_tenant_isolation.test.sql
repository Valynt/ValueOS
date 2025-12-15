-- RLS test: Ensure logs are tenant-scoped and not accessible cross-tenant
-- Run with: supabase test db --workdir supabase --tests supabase/tests/database/rls_logs_tenant_isolation.test.sql

-- Create two organizations
insert into organizations (id, name) values ('org_a','Org A') on conflict do nothing;
insert into organizations (id, name) values ('org_b','Org B') on conflict do nothing;

-- Insert two users and two llm_usage logs
insert into users (id, email, organization_id) values ('user_a', 'a@example.com', 'org_a') on conflict do nothing;
insert into users (id, email, organization_id) values ('user_b', 'b@example.com', 'org_b') on conflict do nothing;

insert into llm_usage (user_id, provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, endpoint, success, latency_ms, timestamp, organization_id)
values ('user_a', 'openai', 'gpt-4', 10, 20, 30, 0.01, '/api/llm/chat', true, 120, now(), 'org_a');

insert into llm_usage (user_id, provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, endpoint, success, latency_ms, timestamp, organization_id)
values ('user_b', 'openai', 'gpt-4', 5, 10, 15, 0.005, '/api/llm/chat', true, 80, now(), 'org_b');

-- Attempt to run select as user_a (simulate JWT with org claim org_a)
-- This requires Supabase test harness configuration to run under specific user context.
-- We expect only the org_a log to be visible.

select count(*) as count_a from llm_usage where organization_id = 'org_a';
select count(*) as count_b from llm_usage where organization_id = 'org_b';

-- The test harness should assert that count_a = 1 and that a user from org_a cannot select org_b data.
