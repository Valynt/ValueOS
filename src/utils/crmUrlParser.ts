/**
 * CRM URL Parser
 * 
 * Parses HubSpot and Salesforce deal/opportunity URLs to extract IDs.
 */

export type CRMProvider = 'hubspot' | 'salesforce';

export interface ParsedCRMUrl {
  provider: CRMProvider;
  dealId: string;
  objectType: 'deal' | 'opportunity' | 'contact' | 'company';
  instanceUrl?: string; // For Salesforce
}

/**
 * Parse a CRM URL and extract the provider and deal/opportunity ID
 */
export function parseCRMUrl(url: string): ParsedCRMUrl | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();

  // Try HubSpot patterns
  const hubspotResult = parseHubSpotUrl(trimmedUrl);
  if (hubspotResult) return hubspotResult;

  // Try Salesforce patterns
  const salesforceResult = parseSalesforceUrl(trimmedUrl);
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
  if (dealMatch) {
    return {
      provider: 'hubspot',
      dealId: dealMatch[1],
      objectType: 'deal',
    };
  }

  // Record URL format (0-3 is deals in HubSpot)
  const recordMatch = url.match(
    /hubspot\.com\/(?:contacts|sales)\/\d+\/record\/0-3\/(\d+)/i
  );
  if (recordMatch) {
    return {
      provider: 'hubspot',
      dealId: recordMatch[1],
      objectType: 'deal',
    };
  }

  // Contact URL
  const contactMatch = url.match(
    /hubspot\.com\/(?:contacts|sales)\/\d+\/(?:contact|record\/0-1)\/(\d+)/i
  );
  if (contactMatch) {
    return {
      provider: 'hubspot',
      dealId: contactMatch[1],
      objectType: 'contact',
    };
  }

  // Company URL
  const companyMatch = url.match(
    /hubspot\.com\/(?:contacts|sales)\/\d+\/(?:company|record\/0-2)\/(\d+)/i
  );
  if (companyMatch) {
    return {
      provider: 'hubspot',
      dealId: companyMatch[1],
      objectType: 'company',
    };
  }

  return null;
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
  if (lightningMatch) {
    return {
      provider: 'salesforce',
      dealId: lightningMatch[1],
      objectType: 'opportunity',
      instanceUrl,
    };
  }

  // Classic URL format (starts with 006 for Opportunities)
  const classicOpportunityMatch = url.match(
    /(?:salesforce\.com|force\.com)\/([0][0][6][a-zA-Z0-9]{12,15})(?:\/|$|\?)/i
  );
  if (classicOpportunityMatch) {
    return {
      provider: 'salesforce',
      dealId: classicOpportunityMatch[1],
      objectType: 'opportunity',
      instanceUrl,
    };
  }

  // Contact (003)
  const contactMatch = url.match(
    /(?:salesforce\.com|force\.com)\/(?:lightning\/r\/Contact\/)?([0][0][3][a-zA-Z0-9]{12,15})(?:\/|$|\?)/i
  );
  if (contactMatch) {
    return {
      provider: 'salesforce',
      dealId: contactMatch[1],
      objectType: 'contact',
      instanceUrl,
    };
  }

  // Account (001)
  const accountMatch = url.match(
    /(?:salesforce\.com|force\.com)\/(?:lightning\/r\/Account\/)?([0][0][1][a-zA-Z0-9]{12,15})(?:\/|$|\?)/i
  );
  if (accountMatch) {
    return {
      provider: 'salesforce',
      dealId: accountMatch[1],
      objectType: 'company',
      instanceUrl,
    };
  }

  return null;
}

/**
 * Validate if a string looks like a CRM URL
 */
export function isCRMUrl(url: string): boolean {
  return parseCRMUrl(url) !== null;
}

/**
 * Get the display name for a CRM provider
 */
export function getCRMProviderName(provider: CRMProvider): string {
  switch (provider) {
    case 'hubspot':
      return 'HubSpot';
    case 'salesforce':
      return 'Salesforce';
    default:
      return provider;
  }
}
