const ONBOARDING_BYPASS_PREFIX = "valynt:onboarding:bypassed";

function buildBypassKey(tenantId: string | undefined) {
  return `${ONBOARDING_BYPASS_PREFIX}:${tenantId ?? "default"}`;
}

export function markOnboardingBypassed(tenantId: string | undefined): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildBypassKey(tenantId), "1");
}

export function clearOnboardingBypass(tenantId: string | undefined): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(buildBypassKey(tenantId));
}

export function isOnboardingBypassed(tenantId: string | undefined): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(buildBypassKey(tenantId)) === "1";
}

