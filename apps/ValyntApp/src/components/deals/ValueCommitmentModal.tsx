/**
 * ValueCommitmentModal Component
 *
 * The "Commit Phase" gate. Transitions a Case from "Modeling" to "Locked/Commercial".
 *
 * Trigger: User clicks "Formalize Targets" or tries to move Case to committed stage.
 *
 * Workflow:
 * 1. Prompt: "Should this commitment be attached to a deal?"
 * 2. If Yes: Opens DealLinkModal (if not linked) or confirms existing link
 * 3. Action: Locks ValueTree assumptions. Sets ValueCommit status to active.
 *    Flags "Ready for CRM Sync".
 */

import { AlertTriangle, ArrowRight, CheckCircle2, Link2, Lock } from 'lucide-react';
import { useState } from 'react';

import type { Deal } from './DealStatusCapsule';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';


export interface ValueCommitment {
  totalValue: number;
  assumptions: Array<{
    id: string;
    name: string;
    value: string | number;
    confidence: 'high' | 'medium' | 'low';
  }>;
  kpis: Array<{
    id: string;
    name: string;
    target: number;
    unit: string;
  }>;
}

export interface ValueCommitmentModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when commitment is confirmed */
  onCommit: (options: { linkDeal: boolean; syncToCRM: boolean }) => void;
  /** Callback to open deal link modal */
  onLinkDeal: () => void;
  /** Current linked deal, if any */
  linkedDeal?: Deal | null;
  /** Value commitment details */
  commitment: ValueCommitment;
  /** Whether the user has Closer role */
  isCloser?: boolean;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

const CONFIDENCE_COLORS = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-700',
};

export function ValueCommitmentModal({
  open,
  onClose,
  onCommit,
  onLinkDeal,
  linkedDeal,
  commitment,
  isCloser = false,
}: ValueCommitmentModalProps) {
  const [syncToCRM, setSyncToCRM] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);

  const hasLowConfidenceAssumptions = commitment.assumptions.some(
    (a) => a.confidence === 'low'
  );

  const handleCommit = () => {
    onCommit({
      linkDeal: !linkedDeal,
      syncToCRM,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Formalize Value Commitment
          </DialogTitle>
          <DialogDescription>
            Lock the value model assumptions and commit to the projected outcomes.
            This action will freeze the current value tree.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Value Summary */}
          <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Committed Value</p>
                <p className="text-3xl font-bold text-green-700">
                  {formatCurrency(commitment.totalValue)}
                </p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </Card>

          {/* Assumptions Summary */}
          <div>
            <h4 className="text-sm font-medium mb-2">Key Assumptions ({commitment.assumptions.length})</h4>
            <div className="space-y-2 max-h-[120px] overflow-y-auto">
              {commitment.assumptions.map((assumption) => (
                <div
                  key={assumption.id}
                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                >
                  <span className="text-sm">{assumption.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{assumption.value}</span>
                    <Badge className={cn('text-xs', CONFIDENCE_COLORS[assumption.confidence])}>
                      {assumption.confidence}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Confidence Warning */}
          {hasLowConfidenceAssumptions && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Low Confidence Assumptions Detected
                </p>
                <p className="text-xs text-amber-700">
                  Some assumptions have low confidence. Consider reviewing before committing.
                </p>
              </div>
            </div>
          )}

          {/* Deal Link Section */}
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">CRM Deal</span>
              </div>
              {linkedDeal ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  {linkedDeal.name}
                </Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={onLinkDeal}>
                  Link Deal
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
            {linkedDeal && (
              <div className="mt-2 flex items-center gap-2">
                <Checkbox
                  id="sync-crm"
                  checked={syncToCRM}
                  onCheckedChange={(checked) => setSyncToCRM(checked === true)}
                />
                <Label htmlFor="sync-crm" className="text-sm text-muted-foreground">
                  Sync commitment to CRM deal
                </Label>
              </div>
            )}
          </div>

          {/* Acknowledgment */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <Label htmlFor="acknowledge" className="text-sm text-muted-foreground leading-relaxed">
              I understand that committing will lock the value model assumptions.
              Changes will require creating a new version.
            </Label>
          </div>

          {/* Role Warning */}
          {!isCloser && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Strategist Role Detected
                </p>
                <p className="text-xs text-blue-700">
                  As a Strategist, you can prepare the commitment but a Closer must approve it.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCommit}
            disabled={!acknowledged}
            className="bg-green-600 hover:bg-green-700"
          >
            <Lock className="w-4 h-4 mr-2" />
            {isCloser ? 'Commit Value' : 'Submit for Approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
