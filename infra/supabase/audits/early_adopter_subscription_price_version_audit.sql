\set ON_ERROR_STOP on

-- Early-adopter billing integrity audit.
-- Purpose: every target tenant must resolve, have at least one subscription,
-- and every subscription must have a non-null price_version_id that exists
-- in billing_price_versions.

WITH target_tenants(slug) AS (
    VALUES
        ('acme-corp'),
        ('techstart-inc'),
        ('demo-org')
),
resolved_targets AS (
    SELECT
        target_tenants.slug,
        organizations.id AS tenant_id
    FROM target_tenants
    LEFT JOIN public.organizations
        ON organizations.slug = target_tenants.slug
),
tenant_rollup AS (
    SELECT
        resolved_targets.slug,
        resolved_targets.tenant_id,
        COUNT(subscriptions.id) AS subscription_count,
        COUNT(*) FILTER (
            WHERE subscriptions.id IS NOT NULL
              AND subscriptions.price_version_id IS NULL
        ) AS null_price_version_count,
        COUNT(*) FILTER (
            WHERE subscriptions.id IS NOT NULL
              AND subscriptions.price_version_id IS NOT NULL
              AND billing_price_versions.id IS NULL
        ) AS invalid_price_version_count,
        CASE
            WHEN resolved_targets.tenant_id IS NULL THEN 'missing_tenant'
            WHEN COUNT(subscriptions.id) = 0 THEN 'missing_subscription'
            WHEN COUNT(*) FILTER (
                WHERE subscriptions.id IS NOT NULL
                  AND subscriptions.price_version_id IS NULL
            ) > 0 THEN 'null_price_version_id'
            WHEN COUNT(*) FILTER (
                WHERE subscriptions.id IS NOT NULL
                  AND subscriptions.price_version_id IS NOT NULL
                  AND billing_price_versions.id IS NULL
            ) > 0 THEN 'invalid_price_version_id'
            ELSE 'ok'
        END AS audit_status
    FROM resolved_targets
    LEFT JOIN public.subscriptions
        ON subscriptions.tenant_id = resolved_targets.tenant_id
    LEFT JOIN public.billing_price_versions
        ON billing_price_versions.id = subscriptions.price_version_id
    GROUP BY resolved_targets.slug, resolved_targets.tenant_id
)
SELECT
    slug,
    tenant_id,
    subscription_count,
    null_price_version_count,
    invalid_price_version_count,
    audit_status
FROM tenant_rollup
ORDER BY slug;

DO $$
DECLARE
    failed_targets integer;
BEGIN
    WITH target_tenants(slug) AS (
        VALUES
            ('acme-corp'),
            ('techstart-inc'),
            ('demo-org')
    ),
    resolved_targets AS (
        SELECT
            target_tenants.slug,
            organizations.id AS tenant_id
        FROM target_tenants
        LEFT JOIN public.organizations
            ON organizations.slug = target_tenants.slug
    ),
    tenant_rollup AS (
        SELECT
            resolved_targets.slug,
            resolved_targets.tenant_id,
            CASE
                WHEN resolved_targets.tenant_id IS NULL THEN 'missing_tenant'
                WHEN COUNT(subscriptions.id) = 0 THEN 'missing_subscription'
                WHEN COUNT(*) FILTER (
                    WHERE subscriptions.id IS NOT NULL
                      AND subscriptions.price_version_id IS NULL
                ) > 0 THEN 'null_price_version_id'
                WHEN COUNT(*) FILTER (
                    WHERE subscriptions.id IS NOT NULL
                      AND subscriptions.price_version_id IS NOT NULL
                      AND billing_price_versions.id IS NULL
                ) > 0 THEN 'invalid_price_version_id'
                ELSE 'ok'
            END AS audit_status
        FROM resolved_targets
        LEFT JOIN public.subscriptions
            ON subscriptions.tenant_id = resolved_targets.tenant_id
        LEFT JOIN public.billing_price_versions
            ON billing_price_versions.id = subscriptions.price_version_id
        GROUP BY resolved_targets.slug, resolved_targets.tenant_id
    )
    SELECT COUNT(*)
    INTO failed_targets
    FROM tenant_rollup
    WHERE audit_status <> 'ok';

    IF failed_targets > 0 THEN
        RAISE EXCEPTION
            'Early-adopter subscription price version audit failed for % tenant(s). Inspect table output above.',
            failed_targets;
    END IF;
END
$$;

SELECT 'PASS: early-adopter subscription price version audit completed.' AS audit_result;
