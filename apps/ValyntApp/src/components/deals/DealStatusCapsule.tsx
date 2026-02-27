/**
 * DealStatusCapsule Component
 *
 * Shows the commercial context of the current Value Case.
 * This is the primary header integration point for Deal information.
 *
 * States:
 * - Unlinked: "[ Draft ] No Deal Linked (+ Link / Create)"
 * - Linked: "[ Negotiation ] Acme Q2 Expansion ▾ (ARR: $2.1M)"
 */

import { useState } from 'react';
import { ChevronDown, Eye, Link2, Plus, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface Deal {
  id: string;
  name: string;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  amount?: number;
  closeDate?: Date;
  crmId?: string;
  crmSource?: 'salesforce' | 'hubspot' | 'pipedrive';
}

export interface DealStatusCapsuleProps {
  /** The linked deal, if any */
  deal?: Deal | null;
  /** Whether the value case is in draft/committed state */
  caseStatus: 'draft' | 'modeling' | 'committed' | 'locked';
  /** Callback when user wants to link a deal */
  onLinkDeal?: () => void;
  /** Callback when user wants to create a new deal */
  onCreateDeal?: () => void;
  /** Callback when user wants to unlink the deal */
  onUnlinkDeal?: () => void;
  /** Callback when user wants to view deal summary */
  onViewSummary?: () => void;
  /** Whether the user has permission to modify deal links (Closer role) */
  canModifyDeal?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const STAGE_COLORS: Record<Deal['stage'], string> = {
  prospecting: 'bg-slate-100 text-slate-700 border-slate-300',
  qualification: 'bg-blue-100 text-blue-700 border-blue-300',
  proposal: 'bg-purple-100 text-purple-700 border-purple-300',
  negotiation: 'bg-amber-100 text-amber-700 border-amber-300',
  closed_won: 'bg-green-100 text-green-700 border-green-300',
  closed_lost: 'bg-red-100 text-red-700 border-red-300',
};

const STAGE_LABELS: Record<Deal['stage'], string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const CASE_STATUS_COLORS: Record<DealStatusCapsuleProps['caseStatus'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  modeling: 'bg-blue-100 text-blue-600',
  committed: 'bg-amber-100 text-amber-600',
  locked: 'bg-green-100 text-green-600',
};

const CASE_STATUS_LABELS: Record<DealStatusCapsuleProps['caseStatus'], string> = {
  draft: 'Draft',
  modeling: 'Modeling',
  committed: 'Committed',
  locked: 'Locked',
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

export function DealStatusCapsule({
  deal,
  caseStatus,
  onLinkDeal,
  onCreateDeal,
  onUnlinkDeal,
  onViewSummary,
  canModifyDeal = true,
  className,
}: DealStatusCapsuleProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Unlinked state
  if (!deal) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant="outline" className={cn('font-medium', CASE_STATUS_COLORS[caseStatus])}>
          {CASE_STATUS_LABELS[caseStatus]}
        </Badge>
        <span className="text-sm text-muted-foreground">No Deal Linked</span>
        {canModifyDeal && (
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Plus className="w-4 h-4 mr-1" />
                Link
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onLinkDeal}>
                <Link2 className="w-4 h-4 mr-2" />
                Link Existing Deal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateDeal}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Deal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  // Linked state
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge
        variant="outline"
        className={cn('font-medium border', STAGE_COLORS[deal.stage])}
      >
        {STAGE_LABELS[deal.stage]}
      </Badge>

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 font-medium">
            {deal.name}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onViewSummary}>
            <Eye className="w-4 h-4 mr-2" />
            View Deal Summary
          </DropdownMenuItem>
          {canModifyDeal && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLinkDeal}>
                <Link2 className="w-4 h-4 mr-2" />
                Link Different Deal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onUnlinkDeal}
                className="text-destructive focus:text-destructive"
              >
                <Unlink className="w-4 h-4 mr-2" />
                Unlink Deal
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {deal.amount && (
        <span className="text-sm text-muted-foreground">
          ARR: {formatCurrency(deal.amount)}
        </span>
      )}
    </div>
  );
}
