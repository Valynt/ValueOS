// Migrated from apps/ValyntApp/src/services/CRMFieldMapper.ts
// and packages/backend/src/services/CRMFieldMapper.ts (identical logic, import path differed).
// Canonical location: packages/core-services/src/CRMFieldMapper.ts
//
// CRM types inlined from @mcp/crm/types to avoid a cross-package dependency
// on a non-shared workspace package.

// ---------------------------------------------------------------------------
// Inlined CRM types (source: packages/mcp/crm/types/index.ts)
// ---------------------------------------------------------------------------

export type CRMProvider = 'hubspot' | 'salesforce' | 'dynamics';

export interface CRMDeal {
  id: string;
  externalId: string;
  provider: CRMProvider;
  name: string;
  amount?: number;
  currency?: string;
  stage: string;
  probability?: number;
  closeDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string;
  ownerName?: string;
  companyId?: string;
  companyName?: string;
  properties: Record<string, unknown>;
}

export interface CRMContact {
  id: string;
  externalId: string;
  provider: CRMProvider;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  role?: string;
  companyId?: string;
  companyName?: string;
  properties: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Mapper types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Stage maps
// ---------------------------------------------------------------------------

const HUBSPOT_STAGE_MAP: Record<string, MappedValueCase['stage']> = {
  appointmentscheduled: 'opportunity',
  qualifiedtobuy: 'opportunity',
  presentationscheduled: 'opportunity',
  decisionmakerboughtin: 'target',
  contractsent: 'target',
  negotiation: 'target',
  closedwon: 'realization',
  closedlost: 'opportunity',
  discovery: 'opportunity',
  qualification: 'opportunity',
  proposal: 'target',
  negotiating: 'target',
  closed: 'realization',
  won: 'realization',
  expansion: 'expansion',
  upsell: 'expansion',
  renewal: 'expansion',
};

const SALESFORCE_STAGE_MAP: Record<string, MappedValueCase['stage']> = {
  prospecting: 'opportunity',
  qualification: 'opportunity',
  'needs analysis': 'opportunity',
  'value proposition': 'target',
  'id. decision makers': 'target',
  'perception analysis': 'target',
  'proposal/price quote': 'target',
  'negotiation/review': 'target',
  'closed won': 'realization',
  'closed lost': 'opportunity',
  discovery: 'opportunity',
  demo: 'opportunity',
  pilot: 'target',
  contract: 'target',
  won: 'realization',
  lost: 'opportunity',
  expansion: 'expansion',
  renewal: 'expansion',
};

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

class CRMFieldMapperService {
  mapDealToValueCase(deal: CRMDeal, contacts: CRMContact[] = [], provider: CRMProvider): MappedValueCase {
    const stage = this.mapStage(deal.stage, provider);
    return {
      name: this.generateCaseName(deal),
      company: deal.companyName ?? 'Unknown Company',
      stage,
      status: this.mapStatus(deal),
      metadata: {
        crmProvider: provider,
        crmDealId: deal.id,
        dealValue: deal.amount,
        dealCurrency: deal.currency,
        closeDate: deal.closeDate?.toISOString(),
        crmStage: deal.stage,
        stakeholders: this.mapContacts(contacts),
        customFields: deal.properties,
      },
    };
  }

  mapStage(crmStage: string | undefined, provider: CRMProvider): MappedValueCase['stage'] {
    if (!crmStage) return 'opportunity';

    const normalized = crmStage.toLowerCase().replace(/[^a-z0-9]/g, '');
    const map = provider === 'hubspot' ? HUBSPOT_STAGE_MAP : SALESFORCE_STAGE_MAP;

    if (map[normalized]) return map[normalized];

    for (const [key, value] of Object.entries(map)) {
      if (normalized.includes(key) || key.includes(normalized)) return value;
    }

    const lower = crmStage.toLowerCase();
    if (lower.includes('won') || lower.includes('closed')) return 'realization';
    if (lower.includes('proposal') || lower.includes('negotiat')) return 'target';
    if (lower.includes('expan') || lower.includes('upsell') || lower.includes('renew')) return 'expansion';

    return 'opportunity';
  }

  mapContacts(contacts: CRMContact[]): MappedStakeholder[] {
    return contacts.map((contact, index) => ({
      name: `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || contact.email || 'Unknown',
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      role: this.inferRole(contact),
      isPrimary: index === 0,
    }));
  }

  private inferRole(contact: CRMContact): string | undefined {
    const title = contact.title?.toLowerCase() ?? '';
    if (title.includes('ceo') || title.includes('chief executive')) return 'Executive Sponsor';
    if (title.includes('cfo') || title.includes('chief financial')) return 'Economic Buyer';
    if (title.includes('cto') || title.includes('cio')) return 'Technical Buyer';
    if (title.includes('vp') || title.includes('vice president') || title.includes('director')) return 'Decision Maker';
    if (title.includes('manager') || title.includes('lead')) return 'Champion';
    if (title.includes('engineer') || title.includes('developer') || title.includes('architect')) return 'Technical Evaluator';
    if (title.includes('procurement') || title.includes('purchasing')) return 'Procurement';
    return undefined;
  }

  private generateCaseName(deal: CRMDeal): string {
    if (deal.name) return deal.name;
    const parts: string[] = [];
    if (deal.companyName) parts.push(deal.companyName);
    if (deal.amount) {
      parts.push(new Intl.NumberFormat('en-US', {
        style: 'currency', currency: deal.currency ?? 'USD', maximumFractionDigits: 0,
      }).format(deal.amount));
    }
    return parts.length > 0 ? parts.join(' - ') : 'Imported Deal';
  }

  private mapStatus(deal: CRMDeal): MappedValueCase['status'] {
    const lower = deal.stage?.toLowerCase() ?? '';
    if (lower.includes('won')) return 'completed';
    if (lower.includes('lost') || lower.includes('paused')) return 'paused';
    return 'in-progress';
  }

  formatDealValue(amount?: number, currency?: string): string {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency ?? 'USD', maximumFractionDigits: 0,
    }).format(amount);
  }

  formatCloseDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  }
}

export const crmFieldMapper = new CRMFieldMapperService();
