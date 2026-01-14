/**
 * CRM URL Parser
 *
 * Parses HubSpot and Salesforce deal/opportunity URLs to extract IDs.
 */

export type CRMProvider = "hubspot" | "salesforce";

export interface ParsedCRMUrl {
  provider: CRMProvider;
  dealId: string;
  objectType: "deal" | "opportunity" | "contact" | "company";
  instanceUrl?: string; // For Salesforce
}

/**
 * Parse a CRM URL and extract the provider and deal/opportunity ID
 */
export function parseCRMUrl(url: string): ParsedCRMUrl | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmedUrl = url.trim();

  // Validate URL length (prevent DoS with extremely long URLs)
  if (trimmedUrl.length > 2048) {
    return null;
  }

  // Basic URL sanitization - remove dangerous characters
  const sanitizedUrl = sanitizeUrl(trimmedUrl);
  if (!sanitizedUrl) {
    return null;
  }

  // Validate basic URL format
  if (!isValidUrlFormat(sanitizedUrl)) {
    return null;
  }

  // Try HubSpot patterns
  const hubspotResult = parseHubSpotUrl(sanitizedUrl);
  if (hubspotResult) return hubspotResult;

  // Try Salesforce patterns
  const salesforceResult = parseSalesforceUrl(sanitizedUrl);
  if (salesforceResult) return salesforceResult;

  return null;
}

/**
 * Parse HubSpot URLs
 *
 * Formats:
 * - https://app.hubspot.com/contacts/PORTAL_ID/deal/DEAL_ID
 * - https://app.hubspot.com/contacts/PORTAL_ID/record/0-3/DEAL_ID
 * - https://app.hubspot.com/sales/PORTAL_ID/deal/DEAL_ID
 */
function parseHubSpotUrl(url: string): ParsedCRMUrl | null {
  // Standard deal URL
  const dealMatch = url.match(
    /hubspot\.com\/(?:contacts|sales)\/\d+\/deal\/(\d+)/i
  );
  if (dealMatch && isValidHubSpotId(dealMatch[1])) {
    return {
      provider: "hubspot",
      dealId: dealMatch[1],
      objectType: "deal",
    };
  }

  // Record URL format (0-3 is deals in HubSpot)
  const recordMatch = url.match(
    /hubspot\.com\/(?:contacts|sales)\/\d+\/record\/0-3\/(\d+)/i
  );
  if (recordMatch && isValidHubSpotId(recordMatch[1])) {
    return {
      provider: "hubspot",
      dealId: recordMatch[1],
      objectType: "deal",
    };
  }

  // Contact URL
  const contactMatch = url.match(
    /hubspot\.com\/(?:contacts|sales)\/\d+\/(?:contact|record\/0-1)\/(\d+)/i
  );
  if (contactMatch && isValidHubSpotId(contactMatch[1])) {
    return {
      provider: "hubspot",
      dealId: contactMatch[1],
      objectType: "contact",
    };
  }

  // Company URL
  const companyMatch = url.match(
    /hubspot\.com\/(?:contacts|sales)\/\d+\/(?:company|record\/0-2)\/(\d+)/i
  );
  if (companyMatch && isValidHubSpotId(companyMatch[1])) {
    return {
      provider: "hubspot",
      dealId: companyMatch[1],
      objectType: "company",
    };
  }

  return null;
}

/**
 * Validate HubSpot ID
 */
function isValidHubSpotId(id: string): boolean {
  // HubSpot IDs are numeric and 10-15 characters long
  return /^\d{10,15}$/.test(id);
}

/**
 * Validate Salesforce ID
 */
function isValidSalesforceId(id: string): boolean {
  // Salesforce IDs are 15 or 18 character alphanumeric strings
  return /^[a-zA-Z0-9]{15,18}$/.test(id);
}

/**
 * Parse Salesforce URLs
 *
 * Formats:
 * - https://[instance].lightning.force.com/lightning/r/Opportunity/006XXXX/view
 * - https://[instance].my.salesforce.com/006XXXX
 * - https://[instance].salesforce.com/lightning/r/Opportunity/006XXXX/view
 */
function parseSalesforceUrl(url: string): ParsedCRMUrl | null {
  // Extract instance URL
  const instanceMatch = url.match(/(https?:\/\/[^\/]+)/i);
  const instanceUrl = instanceMatch?.[1];

  // Lightning URL format
  const lightningMatch = url.match(
    /(?:lightning\.force\.com|salesforce\.com)\/lightning\/r\/Opportunity\/([a-zA-Z0-9]{15,18})(?:\/|$)/i
  );
  if (lightningMatch && isValidSalesforceId(lightningMatch[1])) {
    return {
      provider: "salesforce",
      dealId: lightningMatch[1],
      objectType: "opportunity",
      instanceUrl,
    };
  }

  // Classic URL format (starts with 006 for Opportunities)
  const classicOpportunityMatch = url.match(
    /(?:salesforce\.com|force\.com)\/([0][0][6][a-zA-Z0-9]{12,15})(?:\/|$|\?)/i
  );
  if (
    classicOpportunityMatch &&
    isValidSalesforceId(classicOpportunityMatch[1])
  ) {
    return {
      provider: "salesforce",
      dealId: classicOpportunityMatch[1],
      objectType: "opportunity",
      instanceUrl,
    };
  }

  // Contact (003)
  const contactMatch = url.match(
    /(?:salesforce\.com|force\.com)\/(?:lightning\/r\/Contact\/)?([0][0][3][a-zA-Z0-9]{12,15})(?:\/|$|\?)/i
  );
  if (contactMatch && isValidSalesforceId(contactMatch[1])) {
    return {
      provider: "salesforce",
      dealId: contactMatch[1],
      objectType: "contact",
      instanceUrl,
    };
  }

  // Account (001)
  const accountMatch = url.match(
    /(?:salesforce\.com|force\.com)\/(?:lightning\/r\/Account\/)?([0][0][1][a-zA-Z0-9]{12,15})(?:\/|$|\?)/i
  );
  if (accountMatch && isValidSalesforceId(accountMatch[1])) {
    return {
      provider: "salesforce",
      dealId: accountMatch[1],
      objectType: "company",
      instanceUrl,
    };
  }

  return null;
}

/**
 * Sanitize URL to remove dangerous characters and prevent injection attacks
 */
function sanitizeUrl(url: string): string | null {
  try {
    // Remove null bytes and other dangerous characters
    const cleaned = url.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

    // Basic URL validation - must start with http/https
    if (!cleaned.match(/^https?:\/\//i)) {
      return null;
    }

    // Decode URL to check for encoded dangerous content
    const decoded = decodeURIComponent(cleaned);

    // Check for dangerous protocols or content
    if (decoded.match(/(javascript|data|vbscript|file):/i)) {
      return null;
    }

    // Check for extremely long hostnames (potential DoS)
    const urlObj = new URL(cleaned);
    if (urlObj.hostname.length > 253) {
      return null;
    }

    return cleaned;
  } catch {
    // Invalid URL format
    return null;
  }
}

/**
 * Validate basic URL format
 */
function isValidUrlFormat(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Must have a valid protocol and hostname
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Get the display name for a CRM provider
 */
export function getCRMProviderName(provider: CRMProvider): string {
  switch (provider) {
    case "hubspot":
      return "HubSpot";
    case "salesforce":
      return "Salesforce";
    default:
      return provider;
  }
}
