/**
 * DealSummaryDrawer Component
 *
 * Read-only view of the Deal details for non-Closers (Strategists/Growers).
 *
 * Content:
 * - Deal Name, Stage, Amount, Close Date
 * - "Primary Case" link
 * - Value Reality Check: "Committed Value ($2.1M) vs Deal Amount ($2.0M)"
 */

import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';

import type { Deal } from './DealStatusCapsule';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';


export interface DealSummaryDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when drawer is closed */
  onClose: () => void;
  /** The deal to display */
  deal: Deal | null;
  /** Committed value from the Value Case */
  committedValue?: number;
  /** Realized value (if in realization phase) */
  realizedValue?: number;
  /** Primary case name */
  primaryCaseName?: string;
  /** Primary case ID for navigation */
  primaryCaseId?: string;
  /** Deal owner name */
  ownerName?: string;
  /** Last activity date */
  lastActivity?: Date;
  /** Callback to navigate to case */
  onNavigateToCase?: (caseId: string) => void;
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

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
}

export function DealSummaryDrawer({
  open,
  onClose,
  deal,
  committedValue,
  realizedValue,
  primaryCaseName,
  primaryCaseId,
  ownerName,
  lastActivity,
  onNavigateToCase,
}: DealSummaryDrawerProps) {
  if (!deal) return null;

  const dealAmount = deal.amount || 0;
  const valueGap = committedValue ? committedValue - dealAmount : 0;
  const valueGapPercent = dealAmount > 0 ? (valueGap / dealAmount) * 100 : 0;
  const realizationPercent = committedValue && realizedValue
    ? (realizedValue / committedValue) * 100
    : 0;

  const getValueGapStatus = () => {
    if (valueGapPercent > 10) return { icon: TrendingUp, color: 'text-green-600', label: 'Above Deal' };
    if (valueGapPercent < -10) return { icon: TrendingDown, color: 'text-red-600', label: 'Below Deal' };
    return { icon: CheckCircle2, color: 'text-blue-600', label: 'Aligned' };
  };

  const valueGapStatus = getValueGapStatus();
  const ValueGapIcon = valueGapStatus.icon;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('font-medium border', STAGE_COLORS[deal.stage])}
            >
              {STAGE_LABELS[deal.stage]}
            </Badge>
            {deal.crmSource && (
              <Badge variant="outline" className="text-xs capitalize">
                {deal.crmSource}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl">{deal.name}</SheetTitle>
          <SheetDescription>
            Deal summary and value alignment
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Deal Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Deal Amount</p>
                <p className="font-semibold">{formatCurrency(dealAmount)}</p>
              </div>
            </div>
            {deal.closeDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Close Date</p>
                  <p className="font-semibold">{formatDate(deal.closeDate)}</p>
                </div>
              </div>
            )}
            {ownerName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Owner</p>
                  <p className="font-semibold">{ownerName}</p>
                </div>
              </div>
            )}
            {lastActivity && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Last Activity</p>
                  <p className="font-semibold">{formatRelativeDate(lastActivity)}</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Primary Case Link */}
          {primaryCaseName && primaryCaseId && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Primary Value Case</p>
                    <p className="font-medium">{primaryCaseName}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateToCase?.(primaryCaseId)}
                >
                  View Case
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </Card>
          )}

          {/* Value Reality Check */}
          {committedValue && (
            <Card className="p-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Value Reality Check
              </h4>

              <div className="space-y-4">
                {/* Committed vs Deal Amount */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Committed Value</p>
                    <p className="text-lg font-bold">{formatCurrency(committedValue)}</p>
                  </div>
                  <div className="text-center">
                    <ValueGapIcon className={cn('w-6 h-6 mx-auto', valueGapStatus.color)} />
                    <p className={cn('text-xs font-medium', valueGapStatus.color)}>
                      {valueGapStatus.label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Deal Amount</p>
                    <p className="text-lg font-bold">{formatCurrency(dealAmount)}</p>
                  </div>
                </div>

                {/* Gap Indicator */}
                {valueGap !== 0 && (
                  <div className={cn(
                    'p-2 rounded text-sm text-center',
                    valueGap > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  )}>
                    {valueGap > 0 ? '+' : ''}{formatCurrency(valueGap)} ({valueGapPercent.toFixed(1)}%)
                  </div>
                )}

                {/* Realization Progress (if applicable) */}
                {realizedValue !== undefined && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Realized Value</p>
                      <p className="text-sm font-medium">
                        {formatCurrency(realizedValue)} / {formatCurrency(committedValue)}
                      </p>
                    </div>
                    <Progress value={realizationPercent} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {realizationPercent.toFixed(0)}% realized
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* CRM Link */}
          {deal.crmId && deal.crmSource && (
            <Button variant="outline" className="w-full" asChild>
              <a
                href={`#crm/${deal.crmSource}/${deal.crmId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View in {deal.crmSource.charAt(0).toUpperCase() + deal.crmSource.slice(1)}
              </a>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
