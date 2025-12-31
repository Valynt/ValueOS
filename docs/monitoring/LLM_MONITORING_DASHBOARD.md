# LLM Monitoring Dashboard

## Overview

This document provides SQL queries for monitoring Together.ai usage, costs, and performance. Use these queries to build dashboards in DataDog, Grafana, or your monitoring tool of choice.

---

## Cost Monitoring

### Current Hourly Cost

```sql
SELECT get_hourly_llm_cost() as hourly_cost;
```

**Alert if**: > $10/hour

---

### Current Daily Cost

```sql
SELECT get_daily_llm_cost() as daily_cost;
```

**Alert if**: > $100/day

---

### Current Monthly Cost

```sql
SELECT get_monthly_llm_cost() as monthly_cost;
```

**Alert if**: > $1000/month

---

### Cost Trend (Last 7 Days)

```sql
SELECT 
    DATE_TRUNC('day', created_at) as date,
    SUM(estimated_cost) as daily_cost,
    COUNT(*) as request_count,
    AVG(estimated_cost) as avg_cost_per_request
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

---

### Cost by Model

```sql
SELECT 
    model,
    COUNT(*) as request_count,
    SUM(estimated_cost) as total_cost,
    AVG(estimated_cost) as avg_cost,
    SUM(total_tokens) as total_tokens
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY model
ORDER BY total_cost DESC;
```

---

### Top 10 Cost Users (Last 24 Hours)

```sql
SELECT 
    u.email,
    lu.user_id,
    COUNT(*) as request_count,
    SUM(lu.estimated_cost) as total_cost,
    AVG(lu.estimated_cost) as avg_cost,
    SUM(lu.total_tokens) as total_tokens
FROM llm_usage lu
JOIN auth.users u ON lu.user_id = u.id
WHERE lu.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY u.email, lu.user_id
ORDER BY total_cost DESC
LIMIT 10;
```

---

## Performance Monitoring

### Average Latency by Model

```sql
SELECT 
    model,
    COUNT(*) as request_count,
    AVG(latency_ms) as avg_latency_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms,
    MAX(latency_ms) as max_latency_ms
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '1 hour'
AND latency_ms IS NOT NULL
GROUP BY model
ORDER BY avg_latency_ms DESC;
```

**Alert if**: p95 > 30000ms (30 seconds)

---

### Success Rate

```sql
SELECT 
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests,
    ROUND(
        COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*) * 100, 
        2
    ) as success_rate_percent
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

**Alert if**: success_rate < 95%

---

### Error Analysis

```sql
SELECT 
    error_message,
    COUNT(*) as occurrence_count,
    MAX(created_at) as last_occurrence
FROM llm_usage
WHERE success = false
AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY error_message
ORDER BY occurrence_count DESC
LIMIT 10;
```

---

### Requests Per Minute (Last Hour)

```sql
SELECT 
    DATE_TRUNC('minute', created_at) as minute,
    COUNT(*) as request_count,
    SUM(estimated_cost) as cost,
    AVG(latency_ms) as avg_latency_ms
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;
```

---

## Usage Analytics

### Comprehensive Usage Stats (Last 24 Hours)

```sql
SELECT * FROM get_llm_usage_stats(
    NOW() - INTERVAL '24 hours',
    NOW()
);
```

---

### Usage by Endpoint

```sql
SELECT 
    endpoint,
    COUNT(*) as request_count,
    SUM(estimated_cost) as total_cost,
    AVG(latency_ms) as avg_latency_ms,
    COUNT(*) FILTER (WHERE success = false) as error_count
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY request_count DESC;
```

---

### Usage by Provider

```sql
SELECT 
    provider,
    COUNT(*) as request_count,
    SUM(estimated_cost) as total_cost,
    AVG(latency_ms) as avg_latency_ms,
    ROUND(
        COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*) * 100, 
        2
    ) as success_rate_percent
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY provider
ORDER BY request_count DESC;
```

---

### Token Usage Statistics

```sql
SELECT 
    COUNT(*) as request_count,
    SUM(prompt_tokens) as total_prompt_tokens,
    SUM(completion_tokens) as total_completion_tokens,
    SUM(total_tokens) as total_tokens,
    AVG(prompt_tokens) as avg_prompt_tokens,
    AVG(completion_tokens) as avg_completion_tokens,
    MAX(total_tokens) as max_tokens_single_request
FROM llm_usage
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

---

## Rate Limiting

### Rate Limit Violations (Last 24 Hours)

```sql
SELECT 
    tier,
    COUNT(*) as violation_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM rate_limit_violations
WHERE violated_at >= NOW() - INTERVAL '24 hours'
GROUP BY tier
ORDER BY violation_count DESC;
```

---

### Top Rate Limit Violators

```sql
SELECT 
    u.email,
    rlv.user_id,
    rlv.tier,
    COUNT(*) as violation_count,
    MAX(rlv.violated_at) as last_violation
FROM rate_limit_violations rlv
LEFT JOIN auth.users u ON rlv.user_id = u.id
WHERE rlv.violated_at >= NOW() - INTERVAL '24 hours'
GROUP BY u.email, rlv.user_id, rlv.tier
ORDER BY violation_count DESC
LIMIT 10;
```

---

### Rate Limit Violations by Endpoint

```sql
SELECT 
    endpoint,
    COUNT(*) as violation_count,
    COUNT(DISTINCT user_id) as unique_users
FROM rate_limit_violations
WHERE violated_at >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY violation_count DESC;
```

---

## Cost Alerts

### Active Cost Alerts

```sql
SELECT 
    level,
    period,
    threshold,
    actual_cost,
    message,
    created_at
FROM cost_alerts
WHERE acknowledged = false
ORDER BY 
    CASE level 
        WHEN 'critical' THEN 1 
        WHEN 'warning' THEN 2 
    END,
    created_at DESC;
```

---

### Cost Alert History

```sql
SELECT 
    level,
    period,
    COUNT(*) as alert_count,
    AVG(actual_cost - threshold) as avg_overage,
    MAX(actual_cost) as max_cost,
    MAX(created_at) as last_alert
FROM cost_alerts
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY level, period
ORDER BY alert_count DESC;
```

---

## Backup Monitoring

### Recent Backups

```sql
SELECT 
    backup_file,
    size_bytes / 1024 / 1024 as size_mb,
    duration_seconds,
    status,
    created_at
FROM backup_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

### Backup Success Rate

```sql
SELECT 
    COUNT(*) as total_backups,
    COUNT(*) FILTER (WHERE status = 'success') as successful_backups,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / COUNT(*) * 100, 
        2
    ) as success_rate_percent,
    AVG(duration_seconds) FILTER (WHERE status = 'success') as avg_duration_seconds
FROM backup_logs
WHERE created_at >= NOW() - INTERVAL '30 days';
```

**Alert if**: success_rate < 95%

---

### Last Successful Backup Age

```sql
SELECT 
    backup_file,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
FROM backup_logs
WHERE status = 'success'
ORDER BY created_at DESC
LIMIT 1;
```

**Alert if**: hours_ago > 25 (backups should run daily)

---

## Dashboard Recommendations

### Critical Metrics (Update Every Minute)

1. **Hourly Cost** - Alert if > $10
2. **Success Rate** - Alert if < 95%
3. **P95 Latency** - Alert if > 30s
4. **Active Cost Alerts** - Alert if any critical

### Important Metrics (Update Every 5 Minutes)

1. **Daily Cost** - Alert if > $100
2. **Requests Per Minute**
3. **Error Rate by Model**
4. **Top Cost Users**

### Informational Metrics (Update Every Hour)

1. **Monthly Cost Trend**
2. **Usage by Endpoint**
3. **Token Usage Statistics**
4. **Rate Limit Violations**

---

## Alert Configuration

### DataDog Monitors

```yaml
# Hourly Cost Alert
- name: "LLM Hourly Cost Exceeded"
  query: "SELECT get_hourly_llm_cost()"
  threshold:
    warning: 10
    critical: 50
  message: "LLM hourly cost exceeded threshold"

# Success Rate Alert
- name: "LLM Success Rate Low"
  query: "SELECT success_rate FROM get_llm_usage_stats(NOW() - INTERVAL '1 hour', NOW())"
  threshold:
    warning: 95
    critical: 90
  message: "LLM success rate below threshold"

# Latency Alert
- name: "LLM P95 Latency High"
  query: "SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) FROM llm_usage WHERE created_at >= NOW() - INTERVAL '5 minutes'"
  threshold:
    warning: 20000
    critical: 30000
  message: "LLM P95 latency exceeded threshold"
```

---

## Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "LLM Monitoring",
    "panels": [
      {
        "title": "Hourly Cost",
        "targets": [{
          "rawSql": "SELECT NOW() as time, get_hourly_llm_cost() as value"
        }],
        "alert": {
          "conditions": [{
            "evaluator": { "params": [10], "type": "gt" }
          }]
        }
      },
      {
        "title": "Requests Per Minute",
        "targets": [{
          "rawSql": "SELECT DATE_TRUNC('minute', created_at) as time, COUNT(*) as value FROM llm_usage WHERE created_at >= NOW() - INTERVAL '1 hour' GROUP BY 1 ORDER BY 1"
        }]
      },
      {
        "title": "Cost by Model",
        "targets": [{
          "rawSql": "SELECT model, SUM(estimated_cost) as cost FROM llm_usage WHERE created_at >= NOW() - INTERVAL '24 hours' GROUP BY model"
        }]
      }
    ]
  }
}
```

---

## Maintenance Queries

### Cleanup Old Data (Run Monthly)

```sql
SELECT cleanup_old_llm_usage();
```

### Vacuum Tables (Run Weekly)

```sql
VACUUM ANALYZE llm_usage;
VACUUM ANALYZE cost_alerts;
VACUUM ANALYZE rate_limit_violations;
```

---

**Last Updated**: November 23, 2024  
**Version**: 1.0  
**Author**: ValueCanvas DevOps Team
