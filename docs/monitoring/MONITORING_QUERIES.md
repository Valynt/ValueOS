# Monitoring Dashboard Queries

## Overview

SQL queries for monitoring the stateless agent orchestration system.

---

## Session Health Metrics

### Active Sessions Count

```sql
SELECT COUNT(*) as active_sessions
FROM agent_sessions
WHERE status = 'active'
  AND updated_at > NOW() - INTERVAL '1 hour';
```

### Session Status Distribution

```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
```

### Average Session Duration

```sql
SELECT 
  status,
  COUNT(*) as sessions,
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) as avg_duration_minutes,
  ROUND(MIN(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) as min_duration_minutes,
  ROUND(MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) as max_duration_minutes
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY avg_duration_minutes DESC;
```

---

## Error Tracking

### Error Rate by Hour

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*), 2) as error_rate_pct
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Top Error Patterns

```sql
SELECT 
  workflow_state->'context'->>'lastError' as error_message,
  COUNT(*) as occurrences,
  ARRAY_AGG(DISTINCT user_id) as affected_users
FROM agent_sessions
WHERE status = 'error'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND workflow_state->'context'->>'lastError' IS NOT NULL
GROUP BY error_message
ORDER BY occurrences DESC
LIMIT 10;
```

### Sessions with High Error Count

```sql
SELECT 
  id,
  user_id,
  (workflow_state->'metadata'->>'errorCount')::INTEGER as error_count,
  workflow_state->>'currentStage' as current_stage,
  created_at,
  updated_at
FROM agent_sessions
WHERE (workflow_state->'metadata'->>'errorCount')::INTEGER > 3
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY error_count DESC
LIMIT 20;
```

---

## Concurrency Monitoring

### Concurrent Sessions by User

```sql
SELECT 
  user_id,
  COUNT(*) as concurrent_sessions,
  ARRAY_AGG(id) as session_ids
FROM agent_sessions
WHERE status = 'active'
  AND updated_at > NOW() - INTERVAL '5 minutes'
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY concurrent_sessions DESC;
```

### Session Isolation Check

```sql
-- Detect potential cross-contamination
-- (Should return 0 rows in healthy system)
SELECT 
  a.id as session_a,
  b.id as session_b,
  a.user_id as user_a,
  b.user_id as user_b,
  a.workflow_state->'context' as context_a,
  b.workflow_state->'context' as context_b
FROM agent_sessions a
JOIN agent_sessions b ON a.id < b.id
WHERE a.user_id != b.user_id
  AND a.workflow_state->'context' = b.workflow_state->'context'
  AND a.created_at > NOW() - INTERVAL '1 hour'
  AND b.created_at > NOW() - INTERVAL '1 hour';
```

### Peak Concurrent Load

```sql
SELECT 
  DATE_TRUNC('minute', updated_at) as minute,
  COUNT(DISTINCT id) as concurrent_sessions,
  COUNT(DISTINCT user_id) as unique_users
FROM agent_sessions
WHERE updated_at > NOW() - INTERVAL '1 hour'
  AND status = 'active'
GROUP BY minute
ORDER BY concurrent_sessions DESC
LIMIT 10;
```

---

## Performance Metrics

### Workflow Stage Distribution

```sql
SELECT 
  workflow_state->>'currentStage' as stage,
  COUNT(*) as sessions,
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) as avg_time_in_stage_minutes
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY stage
ORDER BY sessions DESC;
```

### Workflow Completion Rate

```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'error') as failed,
  COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned,
  COUNT(*) FILTER (WHERE status = 'active') as in_progress,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*), 2) as completion_rate_pct
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Slowest Sessions

```sql
SELECT 
  id,
  user_id,
  workflow_state->>'currentStage' as stage,
  ROUND(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60, 2) as duration_minutes,
  status,
  created_at
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY duration_minutes DESC
LIMIT 20;
```

---

## User Activity

### Most Active Users

```sql
SELECT 
  user_id,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) as avg_duration_minutes
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY total_sessions DESC
LIMIT 20;
```

### New vs Returning Users

```sql
WITH user_first_session AS (
  SELECT 
    user_id,
    MIN(created_at) as first_session
  FROM agent_sessions
  GROUP BY user_id
)
SELECT 
  DATE_TRUNC('day', a.created_at) as day,
  COUNT(DISTINCT a.user_id) FILTER (
    WHERE u.first_session >= DATE_TRUNC('day', a.created_at)
  ) as new_users,
  COUNT(DISTINCT a.user_id) FILTER (
    WHERE u.first_session < DATE_TRUNC('day', a.created_at)
  ) as returning_users
FROM agent_sessions a
JOIN user_first_session u ON a.user_id = u.user_id
WHERE a.created_at > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;
```

---

## Alerting Queries

### High Error Rate Alert

```sql
-- Alert if error rate > 5% in last hour
SELECT 
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*), 2) as error_rate_pct
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
HAVING ROUND(COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*), 2) > 5;
```

### Stale Sessions Alert

```sql
-- Alert if sessions haven't updated in 30 minutes
SELECT 
  id,
  user_id,
  workflow_state->>'currentStage' as stage,
  ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60, 2) as minutes_stale
FROM agent_sessions
WHERE status = 'active'
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY minutes_stale DESC;
```

### Memory Leak Detection

```sql
-- Alert if conversation history is growing too large
SELECT 
  id,
  user_id,
  JSONB_ARRAY_LENGTH(workflow_state->'context'->'conversationHistory') as history_length,
  workflow_state->>'currentStage' as stage,
  created_at
FROM agent_sessions
WHERE JSONB_ARRAY_LENGTH(workflow_state->'context'->'conversationHistory') > 100
  AND status = 'active'
ORDER BY history_length DESC;
```

---

## Capacity Planning

### Sessions per Hour Trend

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as sessions_created,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) as avg_duration_minutes
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

### Peak Load Forecast

```sql
-- Predict peak load based on historical data
WITH hourly_stats AS (
  SELECT 
    EXTRACT(HOUR FROM created_at) as hour_of_day,
    EXTRACT(DOW FROM created_at) as day_of_week,
    COUNT(*) as sessions
  FROM agent_sessions
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY hour_of_day, day_of_week
)
SELECT 
  hour_of_day,
  day_of_week,
  ROUND(AVG(sessions), 0) as avg_sessions,
  ROUND(MAX(sessions), 0) as peak_sessions,
  ROUND(STDDEV(sessions), 0) as stddev_sessions
FROM hourly_stats
GROUP BY hour_of_day, day_of_week
ORDER BY avg_sessions DESC
LIMIT 20;
```

---

## Data Quality

### Workflow State Validation

```sql
-- Check for sessions with invalid workflow state
SELECT 
  id,
  user_id,
  status,
  CASE 
    WHEN workflow_state IS NULL THEN 'Missing workflow_state'
    WHEN NOT (workflow_state ? 'currentStage') THEN 'Missing currentStage'
    WHEN NOT (workflow_state ? 'status') THEN 'Missing status'
    WHEN NOT (workflow_state ? 'completedStages') THEN 'Missing completedStages'
    WHEN NOT (workflow_state ? 'context') THEN 'Missing context'
    ELSE 'Unknown issue'
  END as validation_error
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND (
    workflow_state IS NULL OR
    NOT (workflow_state ? 'currentStage') OR
    NOT (workflow_state ? 'status') OR
    NOT (workflow_state ? 'completedStages') OR
    NOT (workflow_state ? 'context')
  );
```

### Orphaned Sessions

```sql
-- Sessions that haven't been updated in a long time
SELECT 
  id,
  user_id,
  status,
  workflow_state->>'currentStage' as stage,
  created_at,
  updated_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600, 2) as hours_since_update
FROM agent_sessions
WHERE status = 'active'
  AND updated_at < NOW() - INTERVAL '24 hours'
ORDER BY hours_since_update DESC;
```

---

## Usage Examples

### Create Monitoring View

```sql
CREATE OR REPLACE VIEW agent_session_health AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE status = 'active') as active,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned,
  ROUND(COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*), 2) as error_rate_pct,
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 2) as avg_duration_minutes,
  COUNT(DISTINCT user_id) as unique_users
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Query the View

```sql
SELECT * FROM agent_session_health
WHERE error_rate_pct > 5
ORDER BY hour DESC;
```

---

## Grafana/Metabase Integration

These queries can be used directly in:
- **Grafana**: PostgreSQL data source
- **Metabase**: Native query
- **Supabase Dashboard**: SQL editor
- **Custom dashboards**: Via Supabase client

---

**Last Updated**: November 22, 2024  
**Version**: 1.0
