import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOnboardingBypass,
  isOnboardingBypassed,
  markOnboardingBypassed,
} from "@/lib/onboarding-bypass";

describe("onboarding bypass storage behavior", () => {
  const tenantId = "tenant-123";
  const storageKey = `valynt:onboarding:bypassed:${tenantId}`;

  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReset();
    vi.mocked(window.localStorage.setItem).mockReset();
    vi.mocked(window.localStorage.removeItem).mockReset();

    vi.mocked(window.sessionStorage.getItem).mockReset();
    vi.mocked(window.sessionStorage.setItem).mockReset();
    vi.mocked(window.sessionStorage.removeItem).mockReset();
  });

  it("stores bypass flags in sessionStorage only", () => {
    markOnboardingBypassed(tenantId);

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(storageKey, "1");
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("removes legacy localStorage bypass flags when checking bypass state", () => {
    vi.mocked(window.sessionStorage.getItem).mockReturnValueOnce(null);

    expect(isOnboardingBypassed(tenantId)).toBe(false);
    expect(window.sessionStorage.getItem).toHaveBeenCalledWith(storageKey);
    expect(window.localStorage.removeItem).toHaveBeenCalledWith(storageKey);
  });

  it("clears bypass flags from both storages", () => {
    clearOnboardingBypass(tenantId);

    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith(storageKey);
    expect(window.localStorage.removeItem).toHaveBeenCalledWith(storageKey);
  });
});
