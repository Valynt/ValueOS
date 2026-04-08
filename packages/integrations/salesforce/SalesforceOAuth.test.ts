/**
 * Tests for SalesforceOAuth.
 *
 * Regression coverage for the loginUrl SSRF guard: an arbitrary loginUrl must
 * be rejected in the constructor so that client_secret cannot be exfiltrated
 * by passing a malicious URL.
 */
import { describe, expect, it } from "vitest";

import { AuthError } from "../base/errors.js";

import { SalesforceOAuth } from "./SalesforceOAuth.js";

const BASE_CONFIG = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "https://app.example.com/oauth/callback",
};

describe("SalesforceOAuth constructor — loginUrl allowlist", () => {
  it("accepts the default (no loginUrl provided)", () => {
    expect(() => new SalesforceOAuth(BASE_CONFIG)).not.toThrow();
  });

  it("accepts https://login.salesforce.com", () => {
    expect(
      () => new SalesforceOAuth({ ...BASE_CONFIG, loginUrl: "https://login.salesforce.com" })
    ).not.toThrow();
  });

  it("accepts https://test.salesforce.com (sandbox login)", () => {
    expect(
      () => new SalesforceOAuth({ ...BASE_CONFIG, loginUrl: "https://test.salesforce.com" })
    ).not.toThrow();
  });

  it("accepts a custom my.salesforce.com login URL", () => {
    expect(
      () =>
        new SalesforceOAuth({
          ...BASE_CONFIG,
          loginUrl: "https://myorg.my.salesforce.com",
        })
    ).not.toThrow();
  });

  it("rejects an arbitrary HTTPS URL", () => {
    expect(
      () => new SalesforceOAuth({ ...BASE_CONFIG, loginUrl: "https://attacker.com" })
    ).toThrow(AuthError);
  });

  it("rejects a URL that embeds salesforce.com as a path segment", () => {
    expect(
      () =>
        new SalesforceOAuth({
          ...BASE_CONFIG,
          loginUrl: "https://evil.com/salesforce.com",
        })
    ).toThrow(AuthError);
  });

  it("rejects a URL that appends .evil.com after salesforce.com", () => {
    expect(
      () =>
        new SalesforceOAuth({
          ...BASE_CONFIG,
          loginUrl: "https://myorg.salesforce.com.evil.com",
        })
    ).toThrow(AuthError);
  });

  it("rejects an HTTP (non-TLS) Salesforce URL", () => {
    expect(
      () =>
        new SalesforceOAuth({
          ...BASE_CONFIG,
          loginUrl: "http://login.salesforce.com",
        })
    ).toThrow(AuthError);
  });
});

describe("SalesforceOAuth.getAuthorizationUrl", () => {
  it("returns a URL, state, and optional codeVerifier", async () => {
    const oauth = new SalesforceOAuth(BASE_CONFIG);
    const result = await oauth.getAuthorizationUrl();
    expect(result.url).toContain("https://login.salesforce.com/services/oauth2/authorize");
    expect(result.state).toBeTruthy();
    expect(result.codeVerifier).toBeUndefined();
  });

  it("includes code_challenge when usePKCE is true", async () => {
    const oauth = new SalesforceOAuth({ ...BASE_CONFIG, usePKCE: true });
    const result = await oauth.getAuthorizationUrl();
    expect(result.url).toContain("code_challenge");
    expect(result.url).toContain("code_challenge_method=S256");
    expect(result.codeVerifier).toBeTruthy();
    // Verify the challenge is not the plain verifier (i.e. S256 was applied)
    const url = new URL(result.url);
    expect(url.searchParams.get("code_challenge")).not.toBe(result.codeVerifier);
  });
});
