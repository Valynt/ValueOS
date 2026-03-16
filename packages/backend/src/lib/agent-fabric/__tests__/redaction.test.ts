import { describe, expect, it } from "vitest";

import { redactSensitiveText } from "../redaction.js";

// redactSensitiveText returns { redactedText, redactionCount }
function redact(text: string): string {
  return redactSensitiveText(text).redactedText;
}

describe("redactSensitiveText — PII patterns", () => {
  it("redacts US SSN (dashes)", () => {
    expect(redact("SSN: 123-45-6789")).toContain("[REDACTED_SSN]");
    expect(redact("SSN: 123-45-6789")).not.toContain("123-45-6789");
  });

  it("redacts US SSN (spaces)", () => {
    expect(redact("number 123 45 6789 here")).toContain("[REDACTED_SSN]");
  });

  it("redacts Visa card numbers", () => {
    expect(redact("card 4111111111111111 end")).toContain("[REDACTED_CC]");
    expect(redact("card 4111111111111111 end")).not.toContain("4111111111111111");
  });

  it("redacts Mastercard numbers", () => {
    expect(redact("card 5500005555555559 end")).toContain("[REDACTED_CC]");
  });

  it("redacts Amex card numbers", () => {
    expect(redact("card 371449635398431 end")).toContain("[REDACTED_CC]");
  });

  it("does not redact plain financial figures", () => {
    // 16-digit number without a card prefix should not be redacted
    expect(redact("revenue 1234567890123456 usd")).not.toContain("[REDACTED_CC]");
  });

  it("redacts passport numbers", () => {
    expect(redact("passport AB1234567")).toContain("[REDACTED_PASSPORT]");
  });

  it("redacts NPI healthcare IDs", () => {
    expect(redact("NPI: 1234567890")).toContain("[REDACTED_NPI]");
    expect(redact("NPI #1234567890")).toContain("[REDACTED_NPI]");
  });

  it("redacts DOB in MM/DD/YYYY format", () => {
    expect(redact("born 01/15/1990")).toContain("[REDACTED_DOB]");
    expect(redact("born 01/15/1990")).not.toContain("01/15/1990");
  });

  it("redacts DOB in YYYY-MM-DD format", () => {
    expect(redact("dob: 1990-01-15")).toContain("[REDACTED_DOB]");
  });

  it("redacts email addresses", () => {
    expect(redact("contact user@example.com today")).toContain("[REDACTED_EMAIL]");
    expect(redact("contact user@example.com today")).not.toContain("user@example.com");
  });

  it("redacts phone numbers", () => {
    expect(redact("call 555-867-5309")).toContain("[REDACTED_PHONE]");
  });

  it("does not alter non-PII text", () => {
    const clean = "The ROI is 35 percent over 18 months with a confidence of 0.85.";
    expect(redact(clean)).toBe(clean);
  });

  it("handles multiple PII types in one string", () => {
    const mixed = "Email user@test.com, SSN 123-45-6789";
    const result = redact(mixed);
    expect(result).toContain("[REDACTED_EMAIL]");
    expect(result).toContain("[REDACTED_SSN]");
    expect(result).not.toContain("user@test.com");
    expect(result).not.toContain("123-45-6789");
  });

  it("returns redactionCount > 0 when PII found", () => {
    const { redactionCount } = redactSensitiveText("SSN: 123-45-6789");
    expect(redactionCount).toBeGreaterThan(0);
  });

  it("returns redactionCount 0 for clean text", () => {
    const { redactionCount } = redactSensitiveText("No sensitive data here.");
    expect(redactionCount).toBe(0);
  });
});
