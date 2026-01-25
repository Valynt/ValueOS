/**
 * DealLinkModal Component
 *
 * Connects an existing Value Case to a CRM Deal.
 * Workflow:
 * 1. User clicks "Link Deal" in capsule
 * 2. Searches CRM (mocked or real) for open opportunities
 * 3. Selects a deal
 * 4. System establishes deal_id on the value_case record
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Building2, Calendar, DollarSign, Loader2, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Deal } from './DealStatusCapsule';

export interface CRMDeal extends Deal {
  company: string;
  owner?: string;
  lastActivity?: Date;
}

export interface DealLinkModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when a deal is selected and linked */
  onLinkDeal: (deal: CRMDeal) => void;
  /** Current value case ID for context */
  valueCaseId: string;
  /** Optional: pre-filter by company name */
  companyFilter?: string;
}

const STAGE_COLORS: Record<Deal['stage'], string> = {
  prospecting: 'bg-slate-100 text-slate-700',
  qualification: 'bg-blue-100 text-blue-700',
  proposal: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-amber-100 text-amber-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-700',
};

const STAGE_LABELS: Record<Deal['stage'], string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// Mock CRM deals for development
const MOCK_CRM_DEALS: CRMDeal[] = [
  {
    id: 'deal-1',
    name: 'Acme Corp Q2 Expansion',
    company: 'Acme Corporation',
    stage: 'negotiation',
    amount: 2_100_000,
    closeDate: new Date('2026-03-31'),
    crmId: 'sf-001',
    crmSource: 'salesforce',
    owner: 'John Smith',
    lastActivity: new Date('2026-01-15'),
  },
  {
    id: 'deal-2',
    name: 'TechStart Platform License',
    company: 'TechStart Inc',
    stage: 'proposal',
    amount: 450_000,
    closeDate: new Date('2026-02-28'),
    crmId: 'sf-002',
    crmSource: 'salesforce',
    owner: 'Jane Doe',
    lastActivity: new Date('2026-01-14'),
  },
  {
    id: 'deal-3',
    name: 'Global Retail Digital Transformation',
    company: 'Global Retail Co',
    stage: 'qualification',
    amount: 3_500_000,
    closeDate: new Date('2026-06-30'),
    crmId: 'hs-001',
    crmSource: 'hubspot',
    owner: 'Mike Johnson',
    lastActivity: new Date('2026-01-10'),
  },
  {
    id: 'deal-4',
    name: 'FinServ Compliance Suite',
    company: 'FinServ Partners',
    stage: 'prospecting',
    amount: 800_000,
    closeDate: new Date('2026-04-15'),
    crmId: 'hs-002',
    crmSource: 'hubspot',
    owner: 'Sarah Wilson',
    lastActivity: new Date('2026-01-12'),
  },
];

export function DealLinkModal({
  open,
  onClose,
  onLinkDeal,
  valueCaseId,
  companyFilter,
}: DealLinkModalProps) {
  const [searchQuery, setSearchQuery] = useState(companyFilter || '');
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);

  // Simulate CRM search
  const searchDeals = useCallback(async (query: string) => {
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const filtered = MOCK_CRM_DEALS.filter(deal => {
      const searchLower = query.toLowerCase();
      return (
        deal.name.toLowerCase().includes(searchLower) ||
        deal.company.toLowerCase().includes(searchLower)
      );
    });

    setDeals(filtered);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      searchDeals(searchQuery);
    }
  }, [open, searchQuery, searchDeals]);

  const handleLink = () => {
    if (selectedDeal) {
      onLinkDeal(selectedDeal);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Link to CRM Deal</DialogTitle>
          <DialogDescription>
            Search for an existing deal in your CRM to link with this Value Case.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search deals by name or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Deal List */}
          <ScrollArea className="h-[300px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : deals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Building2 className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No deals found</p>
                <p className="text-xs">Try a different search term</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {deals.map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-colors',
                      'hover:bg-accent hover:border-accent-foreground/20',
                      selectedDeal?.id === deal.id
                        ? 'bg-accent border-primary'
                        : 'bg-card border-border'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{deal.name}</span>
                          <Badge className={cn('text-xs', STAGE_COLORS[deal.stage])}>
                            {STAGE_LABELS[deal.stage]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {deal.company}
                          </span>
                          {deal.amount && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(deal.amount)}
                            </span>
                          )}
                          {deal.closeDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(deal.closeDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      {deal.crmSource && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {deal.crmSource}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Deal Preview */}
          {selectedDeal && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Selected Deal</p>
                  <p className="text-sm text-muted-foreground">{selectedDeal.name}</p>
                </div>
                {selectedDeal.crmId && (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={`#crm/${selectedDeal.crmSource}/${selectedDeal.crmId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View in CRM
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedDeal}>
            Link Deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
