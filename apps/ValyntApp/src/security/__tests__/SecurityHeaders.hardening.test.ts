import { beforeEach, describe, expect, it } from "vitest";

import { getSecurityConfig, resetSecurityConfig } from "../SecurityConfig";
import { generateCSPHeader, getSecurityHeaders } from "../SecurityHeaders";

function parseCspDirectives(csp: string): Record<string, string> {
  return csp
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, directive) => {
      const [name, ...values] = directive.split(/\s+/);
      acc[name] = values.join(" ");
      return acc;
    }, {});
}

describe("SecurityHeaders hardening invariants", () => {
  beforeEach(() => {
    resetSecurityConfig();
  });

  it("does not allow unsafe inline or eval sources in CSP", () => {
    const csp = generateCSPHeader();

    expect(csp).toBeTruthy();
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("keeps object-src and frame-ancestors locked to 'none'", () => {
    const csp = generateCSPHeader();
    const directives = parseCspDirectives(csp);

    expect(directives["object-src"]).toBe("'none'");
    expect(directives["frame-ancestors"]).toBe("'none'");
  });

  it("includes critical hardening headers when enabled", () => {
    const config = getSecurityConfig();

    expect(config.headers.strictTransportSecurity.enabled).toBe(true);
    expect(config.headers.xFrameOptions.enabled).toBe(true);
    expect(config.headers.referrerPolicy.enabled).toBe(true);
    expect(config.headers.permissionsPolicy.enabled).toBe(true);

    const headers = getSecurityHeaders();

    expect(headers["Strict-Transport-Security"]).toBeTruthy();
    expect(headers["X-Frame-Options"]).toBeTruthy();
    expect(headers["Referrer-Policy"]).toBeTruthy();
    expect(headers["Permissions-Policy"]).toBeTruthy();
  });
});
