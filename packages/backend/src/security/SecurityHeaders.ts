/**
 * @deprecated Use ../middleware/securityHeaders.js directly.
 * This module now delegates to the shared production header source so the
 * legacy weaker header set cannot be reintroduced accidentally.
 */
import { getSecurityHeaders as getUnifiedSecurityHeaders } from "../middleware/securityHeaders.js";

export function getSecurityHeaders(): Record<string, string> {
  return getUnifiedSecurityHeaders();
}
