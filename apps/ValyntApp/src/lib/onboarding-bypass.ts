const ONBOARDING_BYPASS_PREFIX = "valynt:onboarding:bypassed";

function buildBypassKey(tenantId: string | undefined) {
  return `${ONBOARDING_BYPASS_PREFIX}:${tenantId ?? "default"}`;
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function markOnboardingBypassed(tenantId: string | undefined): void {
  getStorage()?.setItem(buildBypassKey(tenantId), "1");
}

export function clearOnboardingBypass(tenantId: string | undefined): void {
  const key = buildBypassKey(tenantId);
  getStorage()?.removeItem(key);

  // Defensive cleanup for legacy persisted bypass keys.
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
}

export function isOnboardingBypassed(tenantId: string | undefined): boolean {
  const key = buildBypassKey(tenantId);
  const bypassed = getStorage()?.getItem(key) === "1";

  // Ensure older localStorage bypass values cannot keep suppressing the gate.
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }

  return bypassed;
}
