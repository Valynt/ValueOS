/**
 * CRM URL Parser Tests
 */

import { describe, it, expect } from "vitest";
import { parseCRMUrl, isCRMUrl } from "../crmUrlParser";

describe("parseCRMUrl", () => {
  describe("HubSpot URLs", () => {
    it("parses standard HubSpot deal URL", () => {
      const url = "https://app.hubspot.com/contacts/12345678/deal/987654321";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("hubspot");
      expect(result?.dealId).toBe("987654321");
      expect(result?.objectType).toBe("deal");
    });

    it("parses HubSpot deal URL with record path", () => {
      const url =
        "https://app.hubspot.com/contacts/12345678/record/0-3/987654321";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("hubspot");
      expect(result?.dealId).toBe("987654321");
    });

    it("parses HubSpot contact URL", () => {
      const url = "https://app.hubspot.com/contacts/12345678/contact/555666777";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("hubspot");
      expect(result?.dealId).toBe("555666777");
      expect(result?.objectType).toBe("contact");
    });

    it("parses HubSpot company URL", () => {
      const url = "https://app.hubspot.com/contacts/12345678/company/111222333";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("hubspot");
      expect(result?.dealId).toBe("111222333");
      expect(result?.objectType).toBe("company");
    });

    it("handles HubSpot EU domain", () => {
      const url =
        "https://app-eu1.hubspot.com/contacts/12345678/deal/987654321";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("hubspot");
    });

  });

  describe("Salesforce URLs", () => {
    it("parses Salesforce Lightning opportunity URL", () => {
      const url =
        "https://mycompany.lightning.force.com/lightning/r/Opportunity/006ABC123DEF456/view";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("salesforce");
      expect(result?.dealId).toBe("006ABC123DEF456");
      expect(result?.objectType).toBe("opportunity");
    });

    it("parses Salesforce Lightning account URL", () => {
      const url =
        "https://mycompany.lightning.force.com/lightning/r/Account/001ABC123DEF456/view";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("salesforce");
      expect(result?.dealId).toBe("001ABC123DEF456");
    });

    it("parses Salesforce Lightning contact URL", () => {
      const url =
        "https://mycompany.lightning.force.com/lightning/r/Contact/003ABC123DEF456/view";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("salesforce");
      expect(result?.objectType).toBe("contact");
    });

    it("parses Salesforce Classic URL", () => {
      const url = "https://mycompany.salesforce.com/006ABC123DEF456";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("salesforce");
      expect(result?.dealId).toBe("006ABC123DEF456");
    });

    it("parses Salesforce sandbox URL", () => {
      const url =
        "https://mycompany--sandbox.lightning.force.com/lightning/r/Opportunity/006ABC123DEF456/view";
      const result = parseCRMUrl(url);

      expect(result).not.toBeNull();
      expect(result?.provider).toBe("salesforce");
    });

    it("extracts instanceUrl from Salesforce URL", () => {
      const url =
        "https://mycompany.lightning.force.com/lightning/r/Opportunity/006ABC123DEF456/view";
      const result = parseCRMUrl(url);

      expect(result?.instanceUrl).toBeDefined();
    });
  });

  describe("Invalid URLs", () => {
    it("returns null for invalid URL", () => {
      expect(parseCRMUrl("not-a-url")).toBeNull();
    });

    it("returns null for non-CRM URL", () => {
      expect(parseCRMUrl("https://google.com/search?q=test")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseCRMUrl("")).toBeNull();
    });

    it("returns null for HubSpot URL without ID", () => {
      expect(
        parseCRMUrl("https://app.hubspot.com/contacts/12345678/deals"),
      ).toBeNull();
    });
  });
});

describe("isCRMUrl", () => {
  it("returns true for valid HubSpot URL", () => {
    expect(isCRMUrl("https://app.hubspot.com/contacts/123/deal/456")).toBe(
      true,
    );
  });

  it("returns true for valid Salesforce URL", () => {
    expect(
      isCRMUrl(
        "https://test.lightning.force.com/lightning/r/Opportunity/006ABC123DEF456/view",
      ),
    ).toBe(true);
  });

  it("returns false for invalid URL", () => {
    expect(isCRMUrl("https://google.com")).toBe(false);
  });
});
