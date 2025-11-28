/**
 * CRM Field Mapper
 * 
 * Maps CRM deal/opportunity data to Value Case fields.
 * Handles differences between HubSpot and Salesforce schemas.
 */

import { CRMDeal, CRMContact, CRMProvider } from '../mcp-crm/types';

// ============================================================================
// Types
// ============================================================================

export interface MappedValueCase {
  name: string;
  company: string;
  stage: 'opportunity' | 'target' | 'realization' | 'expansion';
  status: 'in-progress' | 'completed' | 'paused';
  metadata: {
    crmProvider: CRMProvider;
    crmDealId: string;
    dealValue?: number;
    dealCurrency?: string;
    closeDate?: string;
    crmStage?: string;
    stakeholders?: MappedStakeholder[];
    customFields?: Record<string, unknown>;
  };
}

export interface MappedStakeholder {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  title?: string;
  isPrimary?: boolean;
}

// ============================================================================
// Stage Mapping
// ============================================================================

// HubSpot default stages to Value Case stages
const HUBSPOT_STAGE_MAP: Record<string, MappedValueCase['stage']> = {
  // Early stages
  'appointmentscheduled': 'opportunity',
  'qualifiedtobuy': 'opportunity',
  'presentationscheduled': 'opportunity',
  'decisionmakerboughtin': 'target',
  // Mid stages
  'contractsent': 'target',
  'negotiation': 'target',
  // Late stages
  'closedwon': 'realization',
  'closedlost': 'opportunity', // Reset to opportunity for lost deals
  // Custom stage keywords
  'discovery': 'opportunity',
  'qualification': 'opportunity',
  'proposal': 'target',
  'negotiating': 'target',
  'closed': 'realization',
  'won': 'realization',
  'expansion': 'expansion',
  'upsell': 'expansion',
  'renewal': 'expansion',
};

// Salesforce default stages to Value Case stages
const SALESFORCE_STAGE_MAP: Record<string, MappedValueCase['stage']> = {
  // Standard stages
  'prospecting': 'opportunity',
  'qualification': 'opportunity',
  'needs analysis': 'opportunity',
  'value proposition': 'target',
  'id. decision makers': 'target',
  'perception analysis': 'target',
  'proposal/price quote': 'target',
  'negotiation/review': 'target',
  'closed won': 'realization',
  'closed lost': 'opportunity',
  // Custom stage keywords
  'discovery': 'opportunity',
  'demo': 'opportunity',
  'pilot': 'target',
  'contract': 'target',
  'won': 'realization',
  'lost': 'opportunity',
  'expansion': 'expansion',
  'renewal': 'expansion',
};

// ============================================================================
// Field Mapper Class
// ============================================================================

class CRMFieldMapperService {
  /**
   * Map a CRM deal to a Value Case
   */
  mapDealToValueCase(
    deal: CRMDeal,
    contacts: CRMContact[] = [],
    provider: CRMProvider
  ): MappedValueCase {
    const stage = this.mapStage(deal.stage, provider);
    const stakeholders = this.mapContacts(contacts);

    return {
      name: this.generateCaseName(deal),
      company: deal.companyName || 'Unknown Company',
      stage,
      status: this.mapStatus(deal, stage),
      metadata: {
        crmProvider: provider,
        crmDealId: deal.id,
        dealValue: deal.amount,
        dealCurrency: deal.currency,
        closeDate: deal.closeDate?.toISOString(),
        crmStage: deal.stage,
        stakeholders,
        customFields: deal.properties,
      },
    };
  }

  /**
   * Map CRM stage to Value Case stage
   */
  mapStage(
    crmStage: string | undefined,
    provider: CRMProvider
  ): MappedValueCase['stage'] {
    if (!crmStage) return 'opportunity';

    const normalizedStage = crmStage.toLowerCase().replace(/[^a-z0-9]/g, '');
    const stageMap = provider === 'hubspot' ? HUBSPOT_STAGE_MAP : SALESFORCE_STAGE_MAP;

    // Try exact match first
    if (stageMap[normalizedStage]) {
      return stageMap[normalizedStage];
    }

    // Try partial match on keywords
    for (const [key, value] of Object.entries(stageMap)) {
      if (normalizedStage.includes(key) || key.includes(normalizedStage)) {
        return value;
      }
    }

    // Fallback based on common keywords
    const stageLower = crmStage.toLowerCase();
    if (stageLower.includes('won') || stageLower.includes('closed')) {
      return 'realization';
    }
    if (stageLower.includes('proposal') || stageLower.includes('negotiat')) {
      return 'target';
    }
    if (stageLower.includes('expan') || stageLower.includes('upsell') || stageLower.includes('renew')) {
      return 'expansion';
    }

    return 'opportunity';
  }

  /**
   * Map CRM contacts to stakeholders
   */
  mapContacts(contacts: CRMContact[]): MappedStakeholder[] {
    return contacts.map((contact, index) => ({
      name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Unknown',
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      role: this.inferRole(contact),
      isPrimary: index === 0, // First contact is assumed primary
    }));
  }

  /**
   * Infer stakeholder role from title
   */
  private inferRole(contact: CRMContact): string | undefined {
    const title = contact.title?.toLowerCase() || '';

    if (title.includes('ceo') || title.includes('chief executive')) {
      return 'Executive Sponsor';
    }
    if (title.includes('cfo') || title.includes('chief financial')) {
      return 'Economic Buyer';
    }
    if (title.includes('cto') || title.includes('cio') || title.includes('chief technology') || title.includes('chief information')) {
      return 'Technical Buyer';
    }
    if (title.includes('vp') || title.includes('vice president') || title.includes('director')) {
      return 'Decision Maker';
    }
    if (title.includes('manager') || title.includes('lead')) {
      return 'Champion';
    }
    if (title.includes('engineer') || title.includes('developer') || title.includes('architect')) {
      return 'Technical Evaluator';
    }
    if (title.includes('procurement') || title.includes('purchasing')) {
      return 'Procurement';
    }

    return undefined;
  }

  /**
   * Generate a case name from deal data
   */
  private generateCaseName(deal: CRMDeal): string {
    if (deal.name) {
      return deal.name;
    }

    const parts: string[] = [];
    if (deal.companyName) parts.push(deal.companyName);
    if (deal.amount) {
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: deal.currency || 'USD',
        maximumFractionDigits: 0,
      }).format(deal.amount);
      parts.push(formattedAmount);
    }

    return parts.length > 0 ? parts.join(' - ') : 'Imported Deal';
  }

  /**
   * Map deal status
   */
  private mapStatus(
    deal: CRMDeal,
    _stage: MappedValueCase['stage']
  ): MappedValueCase['status'] {
    const stageLower = deal.stage?.toLowerCase() || '';

    // Check for closed states
    if (stageLower.includes('won')) {
      return 'completed';
    }
    if (stageLower.includes('lost') || stageLower.includes('paused')) {
      return 'paused';
    }

    // Active deals based on stage
    return 'in-progress';
  }

  /**
   * Format deal value for display
   */
  formatDealValue(amount?: number, currency?: string): string {
    if (!amount) return 'N/A';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Format close date for display
   */
  formatCloseDate(dateString?: string): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const crmFieldMapper = new CRMFieldMapperService();
