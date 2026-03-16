-- Rollback: 20260401000000_security_anomaly_alerts
-- Drops security_anomaly_alerts and security_anomaly_suppressions.

BEGIN;

DROP TABLE IF EXISTS public.security_anomaly_suppressions CASCADE;
DROP TABLE IF EXISTS public.security_anomaly_alerts CASCADE;

COMMIT;
