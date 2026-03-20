import { describe, expect, it, beforeEach } from "vitest";
import SecurityHeaders from "../securityHeaders";

describe("SecurityHeaders", () => {
  beforeEach(() => {
    // Reset singleton instance config
    const headers = SecurityHeaders.getInstance();
    headers["config"] = headers["getDefaultConfig"]();
  });

  it("should generate the default headers", () => {
    const headers = SecurityHeaders.getInstance();
    const config = headers.generateHeaders();

    expect(config["X-XSS-Protection"]).toBe("1; mode=block");
    expect(config["X-Frame-Options"]).toBe("DENY");
    expect(config["X-Content-Type-Options"]).toBe("nosniff");
    expect(config["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("should update config properly", () => {
    const headers = SecurityHeaders.getInstance();
    headers.updateConfig({ xFrameOptions: { value: "SAMEORIGIN", enabled: true } });
    const config = headers.generateHeaders();

    expect(config["X-Frame-Options"]).toBe("SAMEORIGIN");
  });

  it("should generate a strict content security policy", () => {
    const headers = SecurityHeaders.getInstance();
    headers.updateConfig({
        contentSecurityPolicy: {
          enabled: true,
          reportOnly: false,
          directives: {
            "default-src": "'self'",
            "script-src": "'self' https://trusted.cdn.com",
            "style-src": "'self' 'unsafe-inline'"
          }
        }
    });

    const config = headers.generateHeaders();
    expect(config["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(config["Content-Security-Policy"]).toContain("script-src 'self' https://trusted.cdn.com");
    expect(config["Content-Security-Policy"]).toContain("style-src 'self' 'unsafe-inline'");
  });
});
