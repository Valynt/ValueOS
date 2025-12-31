/**
 * Small helper to enforce tenant namespaced redis keys.
 * Always call `ns(organizationId, key)` to avoid accidental cross-tenant keys.
 */
export function ns(organizationId: string | undefined | null, key: string): string {
  const org = (organizationId || 'public').toString();
  // Prevent unsafe keys
  const sanitized = key.replace(/^:+|:+$/g, '');
  return `${org}:${sanitized}`;
}

export default ns;
