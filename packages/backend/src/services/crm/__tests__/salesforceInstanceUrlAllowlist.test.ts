/**
 * Regression tests for the Salesforce instance URL allowlist regex.
 *
 * Previously the pattern only matched a single subdomain label, so sandbox
 * URLs like https://myorg--sandbox.sandbox.my.salesforce.com were rejected.
 *
 * The regex is private to IntegrationConnectionService, so we test the same
 * pattern directly here rather than through the full service stack.
 */
import { describe, expect, it } from "vitest";

// Mirror of SALESFORCE_INSTANCE_URL_PATTERN in IntegrationConnectionService.ts.
// Keep in sync if the production pattern changes.
const SALESFORCE_INSTANCE_URL_PATTERN =
  /^https:\/\/([a-zA-Z0-9-]+\.)+salesforce\.com(\/|$)|^https:\/\/([a-zA-Z0-9-]+\.)+force\.com(\/|$)/;

describe("SALESFORCE_INSTANCE_URL_PATTERN", () => {
  const valid = [
    "https://myorg.salesforce.com",
    "https://myorg.salesforce.com/",
    "https://myorg.my.salesforce.com",
    "https://myorg--sandbox.sandbox.my.salesforce.com",
    "https://na1.my.salesforce.com",
    "https://myorg.lightning.force.com",
    "https://myorg.force.com",
  ];

  const invalid = [
    "https://evil.com",
    "https://evil.com/salesforce.com",
    "https://myorg.salesforce.com.evil.com",
    "http://myorg.salesforce.com",
    "https://salesforce.com",
    "https://force.com",
  ];

  it.each(valid)("accepts %s", (url) => {
    expect(SALESFORCE_INSTANCE_URL_PATTERN.test(url)).toBe(true);
  });

  it.each(invalid)("rejects %s", (url) => {
    expect(SALESFORCE_INSTANCE_URL_PATTERN.test(url)).toBe(false);
  });
});
