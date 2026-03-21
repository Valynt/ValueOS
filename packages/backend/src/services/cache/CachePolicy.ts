export const MAX_NEAR_CACHE_TTL_SECONDS = 15;

export interface CacheMetricLabels {
  cache_name: string;
  cache_namespace: string;
}

export function normalizeCacheKeyPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCacheKeyPayload(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, [key, nestedValue]) => {
        if (nestedValue === undefined) {
          return accumulator;
        }

        accumulator[key] = normalizeCacheKeyPayload(nestedValue);
        return accumulator;
      }, {});
  }

  return value;
}

export function resolveTenantScope(
  dimensions?: Record<string, unknown>
): string | null {
  const tenantId = dimensions?.tenantId;
  if (typeof tenantId === "string" && tenantId.trim().length > 0) {
    return tenantId;
  }

  const organizationId = dimensions?.organizationId;
  if (typeof organizationId === "string" && organizationId.trim().length > 0) {
    return organizationId;
  }

  const organizationIdSnake = dimensions?.organization_id;
  if (
    typeof organizationIdSnake === "string" &&
    organizationIdSnake.trim().length > 0
  ) {
    return organizationIdSnake;
  }

  const metadataTenantId = dimensions?.["filters.tenant_id"];
  if (
    typeof metadataTenantId === "string" &&
    metadataTenantId.trim().length > 0
  ) {
    return metadataTenantId;
  }

  const metadataOrganizationId = dimensions?.["filters.organization_id"];
  if (
    typeof metadataOrganizationId === "string" &&
    metadataOrganizationId.trim().length > 0
  ) {
    return metadataOrganizationId;
  }

  return null;
}

export function getNearCacheTtlSeconds(ttlSeconds?: number): number {
  if (!ttlSeconds || ttlSeconds <= 0) {
    return MAX_NEAR_CACHE_TTL_SECONDS;
  }

  return Math.min(ttlSeconds, MAX_NEAR_CACHE_TTL_SECONDS);
}

