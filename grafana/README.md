# Grafana Dashboards

This directory contains Grafana dashboard configurations for monitoring ValueCanvas observability metrics.

## Dashboards

### 1. Agent Performance Dashboard
**File:** `dashboards/agent-performance.json`

Monitors agent execution metrics:
- Agent success rate by type
- Response time percentiles (p50, p95, p99)
- Confidence score distribution
- Hallucination rate
- Invocation counts

### 2. LLM Performance Dashboard
**File:** `dashboards/llm-performance.json`

Tracks LLM API performance:
- Call latency percentiles
- Cache hit rate
- Cost over time
- Token usage
- Error rate by provider

### 3. Value Prediction Accuracy Dashboard
**File:** `dashboards/value-prediction-accuracy.json`

Measures prediction accuracy:
- Accuracy trends over time
- Predicted vs actual values
- Error percentages
- Accuracy by prediction type

## Setup

### Prerequisites

1. **PostgreSQL Database** with Supabase
2. **Grafana** (v9.0+)
3. **OpenTelemetry Collector** (optional, for traces)

### Installation

#### Option 1: Docker Compose (Recommended)

1. Create `docker-compose.grafana.yml`:

```yaml
version: '3.8'

services:
  grafana:
    image: grafana/grafana:latest
    container_name: valuecanvas-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
      - grafana-data:/var/lib/grafana
    networks:
      - valuecanvas

  postgres:
    image: postgres:15
    container_name: valuecanvas-postgres
    environment:
      - POSTGRES_DB=valuecanvas
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - valuecanvas

volumes:
  grafana-data:
  postgres-data:

networks:
  valuecanvas:
```

2. Start services:

```bash
docker-compose -f docker-compose.grafana.yml up -d
```

3. Access Grafana at http://localhost:3000
   - Username: `admin`
   - Password: `admin`

#### Option 2: Local Installation

1. Install Grafana:

```bash
# macOS
brew install grafana

# Ubuntu/Debian
sudo apt-get install -y grafana

# Start Grafana
sudo systemctl start grafana-server
```

2. Access Grafana at http://localhost:3000

### Configure Data Source

1. Navigate to **Configuration** \u003e **Data Sources**
2. Click **Add data source**
3. Select **PostgreSQL**
4. Configure connection:
   - **Host:** `localhost:5432` (or your Supabase host)
   - **Database:** `valuecanvas`
   - **User:** Your database user
   - **Password:** Your database password
   - **SSL Mode:** `require` (for Supabase)
   - **Version:** 15+
5. Click **Save \u0026 Test**

### Import Dashboards

#### Method 1: Automatic Provisioning

1. Create `grafana/datasources/postgres.yml`:

```yaml
apiVersion: 1

datasources:
  - name: ValueCanvas PostgreSQL
    type: postgres
    access: proxy
    url: localhost:5432
    database: valuecanvas
    user: postgres
    secureJsonData:
      password: postgres
    jsonData:
      sslmode: disable
      postgresVersion: 1500
```

2. Create `grafana/dashboards/dashboard.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'ValueCanvas Dashboards'
    orgId: 1
    folder: 'ValueCanvas'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

3. Restart Grafana

#### Method 2: Manual Import

1. Navigate to **Dashboards** \u003e **Import**
2. Click **Upload JSON file**
3. Select a dashboard JSON file
4. Choose the PostgreSQL data source
5. Click **Import**

Repeat for each dashboard.

## Dashboard Usage

### Agent Performance Dashboard

**Use Cases:**
- Monitor agent health and success rates
- Identify slow agents (high p95/p99 latency)
- Track confidence score trends
- Detect hallucination spikes

**Key Metrics:**
- Success Rate: Should be \u003e 95%
- P95 Response Time: Should be \u003c 3 seconds
- Hallucination Rate: Should be \u003c 10%
- Avg Confidence Score: Should be \u003e 0.7

### LLM Performance Dashboard

**Use Cases:**
- Monitor LLM API costs
- Optimize cache hit rates
- Track token usage
- Identify slow providers

**Key Metrics:**
- Cache Hit Rate: Target \u003e 60%
- P95 Latency: Should be \u003c 2 seconds
- Hourly Cost: Monitor for budget alerts
- Error Rate: Should be \u003c 2%

### Value Prediction Accuracy Dashboard

**Use Cases:**
- Measure prediction quality
- Track accuracy improvements
- Identify prediction types needing tuning
- Validate business value claims

**Key Metrics:**
- Overall Accuracy: Target \u003e 85%
- Error Percentage: Should be \u003c 15%
- Predictions with Actuals: Track coverage

## Alerting

### Configure Alerts in Grafana

1. Navigate to **Alerting** \u003e **Alert rules**
2. Click **New alert rule**
3. Configure conditions:

#### Example: High Error Rate Alert

```yaml
Name: High Agent Error Rate
Condition: 
  - Query: SELECT (1 - SUM(high_confidence_count + medium_confidence_count)::float / SUM(total_invocations)) * 100 FROM agent_performance_metrics WHERE time_bucket \u003e NOW() - INTERVAL '1 hour'
  - Threshold: \u003e 5
  - For: 5 minutes
Notification: Email, Slack, PagerDuty
```

#### Example: High LLM Cost Alert

```yaml
Name: High LLM Cost
Condition:
  - Query: SELECT SUM(total_cost) FROM llm_performance_metrics WHERE time_bucket \u003e NOW() - INTERVAL '1 hour'
  - Threshold: \u003e 10
  - For: 5 minutes
Notification: Email, Slack
```

### Notification Channels

Configure in **Alerting** \u003e **Contact points**:

1. **Email:**
   - SMTP server configuration
   - Recipient addresses

2. **Slack:**
   - Webhook URL
   - Channel name

3. **PagerDuty:**
   - Integration key
   - Severity mapping

## Maintenance

### Refresh Materialized Views

The dashboards use materialized views for performance. Refresh them periodically:

```sql
-- Manual refresh
SELECT refresh_agent_performance_metrics();
SELECT refresh_llm_performance_metrics();
SELECT refresh_value_prediction_accuracy_metrics();

-- Or set up automatic refresh (requires pg_cron)
SELECT cron.schedule(
  'refresh-metrics',
  '*/5 * * * *',
  'SELECT refresh_agent_performance_metrics(); SELECT refresh_llm_performance_metrics(); SELECT refresh_value_prediction_accuracy_metrics();'
);
```

### Data Retention

Configure data retention policies:

```sql
-- Delete old metrics (keep 90 days)
DELETE FROM agent_predictions WHERE created_at \u003c NOW() - INTERVAL '90 days';
DELETE FROM llm_calls WHERE created_at \u003c NOW() - INTERVAL '90 days';
DELETE FROM value_prediction_accuracy WHERE created_at \u003c NOW() - INTERVAL '90 days';

-- Refresh materialized views after cleanup
SELECT refresh_agent_performance_metrics();
SELECT refresh_llm_performance_metrics();
SELECT refresh_value_prediction_accuracy_metrics();
```

## Troubleshooting

### Dashboard Shows No Data

1. **Check database connection:**
   ```bash
   psql -h localhost -U postgres -d valuecanvas -c "SELECT COUNT(*) FROM agent_predictions;"
   ```

2. **Verify materialized views exist:**
   ```sql
   SELECT * FROM pg_matviews WHERE schemaname = 'public';
   ```

3. **Refresh materialized views:**
   ```sql
   REFRESH MATERIALIZED VIEW agent_performance_metrics;
   ```

### Slow Dashboard Performance

1. **Check indexes:**
   ```sql
   SELECT * FROM pg_indexes WHERE tablename IN ('agent_predictions', 'llm_calls', 'value_prediction_accuracy');
   ```

2. **Analyze query performance:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM agent_performance_metrics WHERE time_bucket \u003e NOW() - INTERVAL '24 hours';
   ```

3. **Increase refresh interval** in dashboard settings (e.g., from 30s to 1m)

### Missing Metrics

1. **Verify observability is enabled:**
   ```typescript
   import { isObservabilityEnabled } from './lib/observability';
   console.log('Observability enabled:', isObservabilityEnabled());
   ```

2. **Check metrics are being recorded:**
   ```sql
   SELECT COUNT(*), MAX(created_at) FROM agent_predictions;
   SELECT COUNT(*), MAX(created_at) FROM llm_calls;
   ```

3. **Review application logs** for errors

## Advanced Configuration

### Custom Panels

Add custom panels to dashboards:

1. Click **Add panel**
2. Select visualization type
3. Configure query:
   ```sql
   SELECT 
     time_bucket,
     agent_type,
     your_custom_metric
   FROM your_custom_table
   WHERE time_bucket \u003e NOW() - INTERVAL '24 hours'
   ORDER BY time_bucket
   ```
4. Configure field options (unit, thresholds, etc.)
5. Save panel

### Variables

Add dashboard variables for filtering:

1. Navigate to **Dashboard settings** \u003e **Variables**
2. Click **Add variable**
3. Configure:
   - **Name:** `agent_type`
   - **Type:** Query
   - **Query:** `SELECT DISTINCT agent_type FROM agent_performance_metrics`
4. Use in queries: `WHERE agent_type = '$agent_type'`

### Annotations

Add event annotations:

1. Navigate to **Dashboard settings** \u003e **Annotations**
2. Click **Add annotation query**
3. Configure:
   - **Name:** Deployments
   - **Query:** `SELECT created_at as time, message as text FROM deployment_events`
4. Events will appear as vertical lines on time series

## Resources

- [Grafana Documentation](https://grafana.com/docs/)
- [PostgreSQL Data Source](https://grafana.com/docs/grafana/latest/datasources/postgres/)
- [Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/best-practices-for-creating-dashboards/)
- [Alerting Guide](https://grafana.com/docs/grafana/latest/alerting/)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review application logs
3. Consult Grafana documentation
4. Open an issue in the repository
